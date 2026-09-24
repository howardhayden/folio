import {
  ANALYSIS_SCHEMA,
  CANDIDATE_SCHEMA,
  DOCUMENT_CERTIFICATION_SCHEMA,
  LATTICE_BATCH_ATOM_LIMIT,
  LATTICE_FITTED_ANALYSIS_CONTEXT,
  REANALYSIS_SCHEMA,
  VERIFICATION_SCHEMA,
  analysisMessages,
  candidateMessages,
  documentCertificationMessages,
  repairMessages,
  verificationMessages,
} from "../../app/resume/lattice/promptContract.js";

export const HUGGING_FACE_CHAT_COMPLETIONS_URL =
  "https://router.huggingface.co/v1/chat/completions";

export const LATTICE_REMOTE_MODELS = Object.freeze({
  generator: "Qwen/Qwen3-4B:featherless-ai",
  verifier: "meta-llama/Llama-3.2-3B-Instruct:featherless-ai",
});

export const LATTICE_PROVIDER_FAILURE_CLASSES = Object.freeze([
  "provider_not_configured",
  "provider_timeout",
  "provider_unavailable",
  "provider_request_too_large",
  "provider_redirect",
  "provider_http_error",
  "provider_response_too_large",
  "provider_output_limit",
  "provider_malformed_response",
]);

export const LATTICE_PROVIDER_CALL_TIMEOUT_MS = 60_000;
export const LATTICE_PROVIDER_CALL_LIMIT = 32;
export const LATTICE_PROVIDER_REQUEST_BYTE_LIMIT = 1_048_576;
export const LATTICE_PROVIDER_RESPONSE_BYTE_LIMIT = 262_144;
export const LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT = 128_000;

const REMOTE_ROLES = new Set(Object.keys(LATTICE_REMOTE_MODELS));
const REQUESTED_MODES = new Set(["auto", "operative", "experiential"]);
const JSON_HEADERS = Object.freeze({
  Accept: "application/json",
  "Content-Type": "application/json",
});
const PROVIDER_JSON_CONTENT_TYPE = /^application\/json(?:\s*;.*)?$/iu;

const STAGES = Object.freeze({
  analysis: Object.freeze({
    role: "generator",
    schema: REANALYSIS_SCHEMA,
    schemaName: "lattice_analysis_v1",
    messages: analysisMessages,
    maxTokens: 3_072,
    temperature: 0.7,
    topP: 0.8,
    topK: 20,
    minP: 0,
    presencePenalty: 1.5,
  }),
  candidate: Object.freeze({
    role: "generator",
    schema: CANDIDATE_SCHEMA,
    schemaName: "lattice_candidate_v1",
    messages: candidateMessages,
    maxTokens: 800,
    temperature: 0.45,
    topP: 0.9,
  }),
  verification: Object.freeze({
    role: "verifier",
    schema: VERIFICATION_SCHEMA,
    schemaName: "lattice_verification_v1",
    messages: verificationMessages,
    maxTokens: 1_200,
    temperature: 0,
    topP: 1,
  }),
  certification: Object.freeze({
    role: "verifier",
    schema: DOCUMENT_CERTIFICATION_SCHEMA,
    schemaName: "lattice_certification_v1",
    messages: documentCertificationMessages,
    maxTokens: 520,
    temperature: 0,
    topP: 1,
  }),
  repair: Object.freeze({
    role: "generator",
    schema: CANDIDATE_SCHEMA,
    schemaName: "lattice_repair_v1",
    messages: repairMessages,
    maxTokens: 800,
    temperature: 0.45,
    topP: 0.9,
  }),
});

export const LATTICE_PROVIDER_STAGES = Object.freeze(Object.keys(STAGES));

export class LatticeProviderError extends Error {
  constructor(code, message, { status = null, retryAfterSeconds = null, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "LatticeProviderError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function providerError(code, message, options) {
  return new LatticeProviderError(code, message, options);
}

function withQualificationDiagnostic(error, stage, callOrdinal) {
  if (!(error instanceof LatticeProviderError)
    || !LATTICE_PROVIDER_STAGES.includes(stage)
    || !Number.isSafeInteger(callOrdinal)
    || callOrdinal < 1
    || callOrdinal > LATTICE_PROVIDER_CALL_LIMIT) {
    return error;
  }
  Object.defineProperties(error, {
    qualificationStage: {
      configurable: false,
      enumerable: false,
      value: stage,
      writable: false,
    },
    qualificationCallOrdinal: {
      configurable: false,
      enumerable: false,
      value: callOrdinal,
      writable: false,
    },
  });
  return error;
}

function abortError(message = "The Lattice provider request was canceled.") {
  return new DOMException(message, "AbortError");
}

function validPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonObjectMessages(messages, role, schemaName, schema) {
  const contract = [
    `Response contract ${schemaName}: Return exactly one minified JSON object matching the following closed JSON Schema.`,
    "Do not wrap the JSON object in Markdown or add text before or after it.",
    `<LATTICE_RESPONSE_SCHEMA>${JSON.stringify(schema)}</LATTICE_RESPONSE_SCHEMA>`,
  ].join("\n");
  const content = role === "generator" ? `${contract}\n/no_think` : contract;
  const systemIndex = messages.findIndex((message) => (
    record(message) && message.role === "system" && typeof message.content === "string"
  ));
  if (systemIndex === -1) {
    return Object.freeze([
      Object.freeze({ role: "system", content }),
      ...messages.map((message) => Object.freeze({ ...message })),
    ]);
  }
  return Object.freeze(messages.map((message, index) => Object.freeze(index === systemIndex
    ? { ...message, content: `${message.content}\n${content}` }
    : { ...message })));
}

function raceAbort(operation, signal) {
  if (!signal) return Promise.resolve(operation);
  if (signal.aborted) return Promise.reject(signal.reason ?? abortError());
  return new Promise((resolve, reject) => {
    const cancel = () => reject(signal.reason ?? abortError());
    signal.addEventListener("abort", cancel, { once: true });
    Promise.resolve(operation).then(
      (value) => {
        signal.removeEventListener("abort", cancel);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", cancel);
        reject(error);
      },
    );
  });
}

function ignoreCancellation(cancellation) {
  if (cancellation && typeof cancellation.catch === "function") {
    cancellation.catch(() => {});
  }
}

function cancelReader(reader, reason) {
  try {
    ignoreCancellation(reader.cancel(reason));
  } catch {
    // Cancellation is best-effort and must not extend the provider deadline.
  }
}

function discardResponseBody(response, reason) {
  if (!response?.body) return;
  try {
    ignoreCancellation(response.body.cancel(reason));
  } catch {
    // A rejected provider response is never read, logged, or reflected.
  }
}

function linkedDeadline(parentSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort(parentSignal.reason ?? abortError());
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(abortError("The Lattice provider request timed out."));
  }, timeoutMs);
  return Object.freeze({
    signal: controller.signal,
    didTimeOut: () => timedOut,
    dispose() {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
  });
}

async function boundedResponseText(response, maximumBytes, signal) {
  const claimedLength = response.headers.get("content-length");
  if (claimedLength !== null) {
    if (!/^\d+$/u.test(claimedLength) || Number(claimedLength) > maximumBytes) {
      discardResponseBody(response);
      throw providerError("provider_response_too_large", "The Lattice provider response exceeded its limit.");
    }
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let result = "";
  try {
    while (true) {
      const part = await raceAbort(reader.read(), signal);
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maximumBytes) {
        cancelReader(reader);
        throw providerError("provider_response_too_large", "The Lattice provider response exceeded its limit.");
      }
      result += decoder.decode(part.value, { stream: true });
    }
    result += decoder.decode();
    return result;
  } catch (error) {
    if (error instanceof LatticeProviderError || signal?.aborted) throw error;
    throw providerError("provider_malformed_response", "The Lattice provider returned an unreadable response.", {
      cause: error,
    });
  } finally {
    if (signal?.aborted) {
      cancelReader(reader, signal.reason);
    }
    try {
      reader.releaseLock();
    } catch {
      // A pending platform read remains governed by the same abort signal.
    }
  }
}

function parsedProviderContent(body) {
  let envelope;
  try {
    envelope = JSON.parse(body);
  } catch (error) {
    throw providerError("provider_malformed_response", "The Lattice provider returned invalid JSON.", { cause: error });
  }
  const choice = Array.isArray(envelope?.choices) && envelope.choices.length === 1
    ? envelope.choices[0]
    : null;
  if (!record(choice) || choice.finish_reason !== "stop" || !record(choice.message)
    || choice.message.role !== "assistant") {
    const code = choice?.finish_reason === "length"
      ? "provider_output_limit"
      : "provider_malformed_response";
    throw providerError(code, code === "provider_output_limit"
      ? "The Lattice provider reached its output limit."
      : "The Lattice provider returned an invalid completion envelope.");
  }
  const content = choice.message.content;
  if (typeof content !== "string" || !content.trim()) {
    throw providerError("provider_malformed_response", "The Lattice provider returned no structured content.");
  }
  if (content.length > LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT) {
    throw providerError("provider_response_too_large", "The Lattice provider content exceeded its limit.");
  }
  try {
    const parsed = JSON.parse(content);
    if (!record(parsed)) throw new TypeError("Structured content was not an object.");
    return parsed;
  } catch (error) {
    throw providerError("provider_malformed_response", "The Lattice provider returned invalid structured content.", {
      cause: error,
    });
  }
}

export async function requestHuggingFaceJson({
  token,
  role,
  messages,
  schema,
  schemaName,
  maxTokens,
  temperature,
  topP,
  topK,
  minP,
  presencePenalty,
  signal,
  fetchImpl = globalThis.fetch,
  callTimeoutMs = LATTICE_PROVIDER_CALL_TIMEOUT_MS,
  maximumRequestBytes = LATTICE_PROVIDER_REQUEST_BYTE_LIMIT,
  maximumResponseBytes = LATTICE_PROVIDER_RESPONSE_BYTE_LIMIT,
}) {
  if (typeof token !== "string" || !token.trim()) {
    throw providerError("provider_not_configured", "The Lattice provider is not configured.");
  }
  if (!REMOTE_ROLES.has(role) || !Array.isArray(messages) || !record(schema)
    || typeof schemaName !== "string" || !/^[A-Za-z0-9_-]{1,64}$/u.test(schemaName)
    || !validPositiveInteger(maxTokens) || !validPositiveInteger(callTimeoutMs)
    || !validPositiveInteger(maximumRequestBytes)
    || !validPositiveInteger(maximumResponseBytes) || typeof fetchImpl !== "function"
    || !Number.isFinite(temperature) || temperature < 0 || temperature > 2
    || !Number.isFinite(topP) || topP <= 0 || topP > 1
    || (topK !== undefined && !validPositiveInteger(topK))
    || (minP !== undefined && (!Number.isFinite(minP) || minP < 0 || minP > 1))
    || (presencePenalty !== undefined
      && (!Number.isFinite(presencePenalty) || presencePenalty < 0 || presencePenalty > 2))) {
    throw new TypeError("The Lattice provider received an invalid server configuration.");
  }

  const providerRequestBody = JSON.stringify({
    model: LATTICE_REMOTE_MODELS[role],
    messages: jsonObjectMessages(messages, role, schemaName, schema),
    response_format: { type: "json_object" },
    ...(role === "generator"
      ? { chat_template_kwargs: { enable_thinking: false } }
      : {}),
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
    ...(topK === undefined ? {} : { top_k: topK }),
    ...(minP === undefined ? {} : { min_p: minP }),
    ...(presencePenalty === undefined ? {} : { presence_penalty: presencePenalty }),
    seed: 71_903,
    stream: false,
  });
  if (new TextEncoder().encode(providerRequestBody).byteLength > maximumRequestBytes) {
    throw providerError(
      "provider_request_too_large",
      "The Lattice provider request exceeded its byte limit.",
    );
  }

  const deadline = linkedDeadline(signal, callTimeoutMs);
  try {
    let response;
    try {
      const responsePromise = Promise.resolve(fetchImpl(HUGGING_FACE_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          ...JSON_HEADERS,
          Authorization: `Bearer ${token}`,
        },
        body: providerRequestBody,
        cache: "no-store",
        credentials: "omit",
        // Workerd does not implement Fetch's `error` redirect mode. Manual
        // mode exposes a 3xx response for the explicit rejection below.
        redirect: "manual",
        referrerPolicy: "no-referrer",
        signal: deadline.signal,
      }));
      void responsePromise.then((lateResponse) => {
        if (deadline.signal.aborted) discardResponseBody(lateResponse, deadline.signal.reason);
      }, () => {});
      response = await raceAbort(responsePromise, deadline.signal);
    } catch (error) {
      if (deadline.didTimeOut()) {
        throw providerError("provider_timeout", "The Lattice provider timed out.", { cause: error });
      }
      if (signal?.aborted) throw signal.reason ?? abortError();
      throw providerError("provider_unavailable", "The Lattice provider could not be reached.", { cause: error });
    }

    try {
      if (!(response instanceof Response)) {
        throw providerError("provider_malformed_response", "The Lattice provider returned an invalid response.");
      }
      if (response.redirected
        || response.type === "opaqueredirect"
        || (response.status >= 300 && response.status < 400)
        || response.url && response.url !== HUGGING_FACE_CHAT_COMPLETIONS_URL) {
        discardResponseBody(response);
        throw providerError("provider_redirect", "The Lattice provider attempted an unexpected redirect.");
      }
      if (!response.ok) {
        discardResponseBody(response);
        throw providerError("provider_http_error", "The Lattice provider rejected the request.", {
          status: response.status,
          retryAfterSeconds: response.status === 429
            ? parseRetryAfterSeconds(response.headers.get("retry-after"))
            : null,
        });
      }
      if (!PROVIDER_JSON_CONTENT_TYPE.test(response.headers.get("content-type") ?? "")) {
        discardResponseBody(response);
        throw providerError("provider_malformed_response", "The Lattice provider returned an invalid media type.");
      }
      const body = await boundedResponseText(response, maximumResponseBytes, deadline.signal);
      return parsedProviderContent(body);
    } catch (error) {
      if (deadline.didTimeOut()) {
        throw providerError("provider_timeout", "The Lattice provider timed out.", { cause: error });
      }
      if (signal?.aborted) throw signal.reason ?? abortError();
      if (error instanceof LatticeProviderError) throw error;
      throw providerError("provider_malformed_response", "The Lattice provider returned an invalid response.", {
        cause: error,
      });
    }
  } finally {
    deadline.dispose();
  }
}

function parseRetryAfterSeconds(value) {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,8})$/u.test(value)) return null;
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds < 1) return null;
  return Math.min(seconds, 300);
}

function messagesWithMode(factory, request, requestedMode) {
  const messages = factory(Object.freeze({
    ...request,
    requestedMode,
    allowClarification: false,
    clarificationAnswers: Object.freeze([]),
  }));
  return Object.freeze(messages.map((message) => Object.freeze({ ...message })));
}

export function createHuggingFaceLatticeAdapter({
  token,
  requestedMode = "auto",
  fetchImpl = globalThis.fetch,
  callTimeoutMs = LATTICE_PROVIDER_CALL_TIMEOUT_MS,
  maximumRequestBytes = LATTICE_PROVIDER_REQUEST_BYTE_LIMIT,
  maximumResponseBytes = LATTICE_PROVIDER_RESPONSE_BYTE_LIMIT,
} = {}) {
  if (!REQUESTED_MODES.has(requestedMode)) {
    throw new TypeError("The Lattice provider received an invalid requested mode.");
  }

  const budget = { used: 0 };

  const complete = async (stageName, request) => {
    if (budget.used >= LATTICE_PROVIDER_CALL_LIMIT) {
      throw providerError("provider_call_limit", "The Lattice provider call budget was exhausted.");
    }
    budget.used += 1;
    const callOrdinal = budget.used;
    const stage = STAGES[stageName];
    let result;
    try {
      result = await requestHuggingFaceJson({
        token,
        role: stage.role,
        messages: messagesWithMode(stage.messages, request, requestedMode),
        schema: stage.schema,
        schemaName: stage.schemaName,
        maxTokens: stage.maxTokens,
        temperature: stage.temperature,
        topP: stage.topP,
        topK: stage.topK,
        minP: stage.minP,
        presencePenalty: stage.presencePenalty,
        signal: request.signal,
        fetchImpl,
        callTimeoutMs,
        maximumRequestBytes,
        maximumResponseBytes,
      });
    } catch (error) {
      throw withQualificationDiagnostic(error, stageName, callOrdinal);
    }
    if (stageName === "analysis") {
      Object.defineProperty(result, LATTICE_FITTED_ANALYSIS_CONTEXT, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: Object.freeze({
          analysisAtomLimit: request.analysisAtomLimit ?? LATTICE_BATCH_ATOM_LIMIT,
          documentLedgerAtomIds: Object.freeze((request.documentLedger ?? []).map(({ id }) => id)),
        }),
      });
    }
    return result;
  };

  return Object.freeze({
    completionCapacity() {
      return Object.freeze({
        used: budget.used,
        limit: LATTICE_PROVIDER_CALL_LIMIT,
        remaining: LATTICE_PROVIDER_CALL_LIMIT - budget.used,
      });
    },
    analyze: (request) => complete("analysis", request),
    generate: (request) => complete("candidate", request),
    verify: (request) => complete("verification", request),
    certify: (request) => complete("certification", request),
    repair: (request) => complete("repair", request),
  });
}

// Keep the public analysis schema imported alongside the closed schema. This
// assertion fails during module evaluation if the prompt contract stops
// distinguishing public clarification from closed server execution.
if (ANALYSIS_SCHEMA === REANALYSIS_SCHEMA || REANALYSIS_SCHEMA.properties.questions.maxItems !== 0) {
  throw new Error("The closed Lattice analysis schema is unavailable.");
}
