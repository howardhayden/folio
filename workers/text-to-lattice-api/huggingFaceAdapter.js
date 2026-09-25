import {
  ANALYSIS_SCHEMA,
  CANDIDATE_SCHEMA,
  DOCUMENT_CERTIFICATION_SCHEMA,
  LATTICE_ANALYSIS_DIAGNOSTIC_CONTEXT,
  LATTICE_ANALYSIS_DIAGNOSTIC_ORIGINS,
  LATTICE_ANALYSIS_VALIDATION_CATEGORIES,
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
  generator: "Qwen/Qwen3-4B-Instruct-2507:nscale",
  verifier: "meta-llama/Llama-3.1-8B-Instruct:deepinfra",
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

export const LATTICE_PROVIDER_MALFORMED_SUBTYPES = Object.freeze([
  "none",
  "response_read",
  "response_type",
  "media_type",
  "envelope_json",
  "choice_count",
  "choice_shape",
  "finish_reason",
  "message_shape",
  "message_role",
  "content_empty",
  "content_json",
  "content_shape",
  "response_processing",
]);

export const LATTICE_PROVIDER_FINISH_REASONS = Object.freeze([
  "none",
  "stop",
  "tool_calls",
  "length",
  "other",
]);

export const LATTICE_PROVIDER_SIZE_BUCKETS = Object.freeze([
  "none",
  "0",
  "1-4096",
  "4097-16384",
  "16385-65536",
  "65537-262144",
  "262145-1048576",
  "1048577-plus",
]);

export const LATTICE_PROVIDER_COMPLETION_TOKEN_BUCKETS = Object.freeze([
  "none",
  "0",
  "1-255",
  "256-511",
  "512-1023",
  "1024-2047",
  "2048-3071",
  "3072-plus",
]);

export const LATTICE_PROVIDER_ANALYSIS_ORIGINS = Object.freeze([
  "none",
  ...LATTICE_ANALYSIS_DIAGNOSTIC_ORIGINS,
]);

export const LATTICE_PROVIDER_ANALYSIS_ATTEMPTS = Object.freeze([
  "none",
  "1",
  "2",
]);

export const LATTICE_PROVIDER_CALL_TIMEOUT_MS = 60_000;
export const LATTICE_PROVIDER_CALL_LIMIT = 32;
export const LATTICE_PROVIDER_REQUEST_BYTE_LIMIT = 1_048_576;
export const LATTICE_PROVIDER_RESPONSE_BYTE_LIMIT = 262_144;
export const LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT = 128_000;

const REMOTE_ROLES = new Set(Object.keys(LATTICE_REMOTE_MODELS));
const REQUESTED_MODES = new Set(["auto", "operative", "experiential"]);
const MALFORMED_SUBTYPE_SET = new Set(LATTICE_PROVIDER_MALFORMED_SUBTYPES);
const FINISH_REASON_SET = new Set(LATTICE_PROVIDER_FINISH_REASONS);
const SIZE_BUCKET_SET = new Set(LATTICE_PROVIDER_SIZE_BUCKETS);
const COMPLETION_TOKEN_BUCKET_SET = new Set(LATTICE_PROVIDER_COMPLETION_TOKEN_BUCKETS);
const ANALYSIS_ORIGIN_SET = new Set(LATTICE_ANALYSIS_DIAGNOSTIC_ORIGINS);
const ANALYSIS_VALIDATION_CATEGORY_SET = new Set(LATTICE_ANALYSIS_VALIDATION_CATEGORIES);
const PROVIDER_DIAGNOSTICS = new WeakMap();
const JSON_HEADERS = Object.freeze({
  Accept: "application/json",
  "Content-Type": "application/json",
});
const PROVIDER_JSON_CONTENT_TYPE = /^application\/json(?:\s*;.*)?$/iu;

function fixedTuple(...items) {
  return Object.freeze({
    type: "array",
    minItems: items.length,
    maxItems: items.length,
    prefixItems: Object.freeze(items),
  });
}

function boundedString(schema, maxLength) {
  return Object.freeze({
    ...schema,
    minLength: 1,
    maxLength,
  });
}

function boundedStringArray(schema, maxLength) {
  return Object.freeze({
    ...schema,
    items: boundedString(schema.items, maxLength),
  });
}

const INTERNAL_ANALYSIS_PASSAGE_SCHEMA = REANALYSIS_SCHEMA.properties.passages.items;
const INTERNAL_ANALYSIS_ATOM_SCHEMA = INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.atoms.items;
const INTERNAL_ANALYSIS_LINK_SCHEMA = INTERNAL_ANALYSIS_ATOM_SCHEMA.properties.links.items;
const INTERNAL_ANALYSIS_ASSERTION_SCHEMA =
  INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.conformanceAssertions.items;
const ANALYSIS_WIRE_LINK_SCHEMA = fixedTuple(
  INTERNAL_ANALYSIS_LINK_SCHEMA.properties.relation,
  boundedString(INTERNAL_ANALYSIS_LINK_SCHEMA.properties.targetAtomId, 180),
);
const ANALYSIS_WIRE_ATOM_SCHEMA = fixedTuple(
  boundedString(INTERNAL_ANALYSIS_ATOM_SCHEMA.properties.id, 120),
  INTERNAL_ANALYSIS_ATOM_SCHEMA.properties.kind,
  boundedString(INTERNAL_ANALYSIS_ATOM_SCHEMA.properties.value, 600),
  INTERNAL_ANALYSIS_ATOM_SCHEMA.properties.priority,
  INTERNAL_ANALYSIS_ATOM_SCHEMA.properties.preservation,
  boundedStringArray(INTERNAL_ANALYSIS_ATOM_SCHEMA.properties.evidenceSpanIds, 160),
  Object.freeze({
    ...INTERNAL_ANALYSIS_ATOM_SCHEMA.properties.links,
    items: ANALYSIS_WIRE_LINK_SCHEMA,
  }),
);
const ANALYSIS_WIRE_ASSERTION_SCHEMA = fixedTuple(
  INTERNAL_ANALYSIS_ASSERTION_SCHEMA.properties.criterion,
  boundedStringArray(INTERNAL_ANALYSIS_ASSERTION_SCHEMA.properties.evidenceSpanIds, 160),
);
const ANALYSIS_WIRE_PASSAGE_SCHEMA = fixedTuple(
  boundedString(INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.passageId, 120),
  boundedString(INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.discourseFunction, 300),
  INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.layer,
  INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.disposition,
  boundedString(INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.rationale, 600),
  Object.freeze({
    ...INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.atoms,
    items: ANALYSIS_WIRE_ATOM_SCHEMA,
  }),
  boundedStringArray(INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.ambiguityAtomIds, 160),
  INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.conformanceCriteria,
  boundedStringArray(INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.conformanceEvidenceSpanIds, 160),
  Object.freeze({
    ...INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.conformanceAssertions,
    items: ANALYSIS_WIRE_ASSERTION_SCHEMA,
  }),
);
const ANALYSIS_WIRE_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: Object.freeze({
    d: REANALYSIS_SCHEMA.properties.documentKind,
    p: Object.freeze({
      ...REANALYSIS_SCHEMA.properties.passages,
      items: ANALYSIS_WIRE_PASSAGE_SCHEMA,
    }),
    q: Object.freeze({ type: "array", maxItems: 0 }),
  }),
  required: Object.freeze(["d", "p", "q"]),
});
const ANALYSIS_WIRE_GUIDE = [
  "Supply one complete private analysis instance as this function's arguments; the single-letter root keys and tuple positions are mandatory.",
  "The root has exactly d, p, and q: d is the document-kind enum string; p is the passage-tuple array; q is the empty array [].",
  "Passage tuple positions 0-9: [passage ID,discourse function,layer,disposition,rationale,atom tuples,ambiguity atom IDs,conformance criterion IDs,conformance evidence span IDs,conformance assertion tuples].",
  "Atom tuple positions 0-6: [atom ID,kind,value,priority,preservation,evidence span IDs,link tuples].",
  "Link tuple positions 0-1: [relation,target atom ID]. Conformance assertion tuple positions 0-1: [criterion,evidence span IDs].",
  "Fill passage position 1 with the discourse function and position 4 with the rationale. Keep all free text concise. Do not put long field names, Markdown, explanations, or reasoning in assistant content.",
].join("\n");

const ANALYSIS_TOOL_NAME = "lattice_analysis_wire_v1";
const VERIFICATION_TOOL_NAME = "lattice_verification_v1";
const CERTIFICATION_TOOL_NAME = "lattice_certification_v1";

function analysisWireMessages(request) {
  return analysisMessages(request, { responseDialect: "compact-wire-v1" });
}

const STAGES = Object.freeze({
  analysis: Object.freeze({
    role: "generator",
    schema: ANALYSIS_WIRE_SCHEMA,
    schemaName: "lattice_analysis_wire_v1",
    toolName: ANALYSIS_TOOL_NAME,
    responseGuide: ANALYSIS_WIRE_GUIDE,
    messages: analysisWireMessages,
    maxTokens: 3_072,
    temperature: 0.7,
    topP: 0.8,
    topK: 20,
    minP: 0,
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
    toolName: VERIFICATION_TOOL_NAME,
    responseGuide: "Supply one complete verification record as this function's arguments.",
    messages: verificationMessages,
    maxTokens: 1_200,
    temperature: 0,
    topP: 1,
  }),
  certification: Object.freeze({
    role: "verifier",
    schema: DOCUMENT_CERTIFICATION_SCHEMA,
    schemaName: "lattice_certification_v1",
    toolName: CERTIFICATION_TOOL_NAME,
    responseGuide: "Supply one complete document-certification record as this function's arguments.",
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

function sizeBucket(value) {
  if (!Number.isSafeInteger(value) || value < 0) return "none";
  if (value === 0) return "0";
  if (value <= 4_096) return "1-4096";
  if (value <= 16_384) return "4097-16384";
  if (value <= 65_536) return "16385-65536";
  if (value <= 262_144) return "65537-262144";
  if (value <= 1_048_576) return "262145-1048576";
  return "1048577-plus";
}

function completionTokenBucket(value) {
  if (!Number.isSafeInteger(value) || value < 0) return "none";
  if (value === 0) return "0";
  if (value <= 255) return "1-255";
  if (value <= 511) return "256-511";
  if (value <= 1_023) return "512-1023";
  if (value <= 2_047) return "1024-2047";
  if (value <= 3_071) return "2048-3071";
  return "3072-plus";
}

function finishReason(value) {
  if (value === "stop" || value === "tool_calls" || value === "length") return value;
  return value === undefined || value === null ? "none" : "other";
}

function withProviderDiagnostic(error, patch) {
  if (!(error instanceof LatticeProviderError) || !record(patch)) return error;
  const current = PROVIDER_DIAGNOSTICS.get(error) ?? Object.freeze({
    subtype: "none",
    finishReason: "none",
    requestSize: "none",
    responseSize: "none",
    contentSize: "none",
    completionTokens: "none",
  });
  const next = { ...current };
  if (MALFORMED_SUBTYPE_SET.has(patch.subtype)) next.subtype = patch.subtype;
  if (FINISH_REASON_SET.has(patch.finishReason)) next.finishReason = patch.finishReason;
  if (SIZE_BUCKET_SET.has(patch.requestSize)) next.requestSize = patch.requestSize;
  if (SIZE_BUCKET_SET.has(patch.responseSize)) next.responseSize = patch.responseSize;
  if (SIZE_BUCKET_SET.has(patch.contentSize)) next.contentSize = patch.contentSize;
  if (COMPLETION_TOKEN_BUCKET_SET.has(patch.completionTokens)) {
    next.completionTokens = patch.completionTokens;
  }
  if (error.code !== "provider_malformed_response") next.subtype = "none";
  PROVIDER_DIAGNOSTICS.set(error, Object.freeze(next));
  return error;
}

function providerError(code, message, options) {
  return new LatticeProviderError(code, message, options);
}

function analysisQualificationDiagnostic(stage, context) {
  if (stage !== "analysis" || !record(context) || !Object.isFrozen(context)
    || !ANALYSIS_ORIGIN_SET.has(context.origin)
    || ![1, 2].includes(context.attempt)
    || !ANALYSIS_VALIDATION_CATEGORY_SET.has(context.priorValidationCategory)
    || (context.attempt === 1 && context.priorValidationCategory !== "none")
    || (context.attempt === 2 && context.priorValidationCategory === "none")) {
    return Object.freeze({
      origin: "none",
      attempt: "none",
      priorValidationCategory: "none",
    });
  }
  return Object.freeze({
    origin: context.origin,
    attempt: `${context.attempt}`,
    priorValidationCategory: context.priorValidationCategory,
  });
}

function withQualificationDiagnostic(error, stage, callOrdinal, analysisContext) {
  if (!(error instanceof LatticeProviderError)
    || !LATTICE_PROVIDER_STAGES.includes(stage)
    || !Number.isSafeInteger(callOrdinal)
    || callOrdinal < 1
    || callOrdinal > LATTICE_PROVIDER_CALL_LIMIT) {
    return error;
  }
  const providerDiagnostic = PROVIDER_DIAGNOSTICS.get(error) ?? Object.freeze({
    subtype: "none",
    finishReason: "none",
    requestSize: "none",
    responseSize: "none",
    contentSize: "none",
    completionTokens: "none",
  });
  const analysisDiagnostic = analysisQualificationDiagnostic(stage, analysisContext);
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
    qualificationSubtype: {
      configurable: false,
      enumerable: false,
      value: providerDiagnostic.subtype,
      writable: false,
    },
    qualificationFinishReason: {
      configurable: false,
      enumerable: false,
      value: providerDiagnostic.finishReason,
      writable: false,
    },
    qualificationRequestSize: {
      configurable: false,
      enumerable: false,
      value: providerDiagnostic.requestSize,
      writable: false,
    },
    qualificationResponseSize: {
      configurable: false,
      enumerable: false,
      value: providerDiagnostic.responseSize,
      writable: false,
    },
    qualificationContentSize: {
      configurable: false,
      enumerable: false,
      value: providerDiagnostic.contentSize,
      writable: false,
    },
    qualificationCompletionTokens: {
      configurable: false,
      enumerable: false,
      value: providerDiagnostic.completionTokens,
      writable: false,
    },
    qualificationAnalysisOrigin: {
      configurable: false,
      enumerable: false,
      value: analysisDiagnostic.origin,
      writable: false,
    },
    qualificationAnalysisAttempt: {
      configurable: false,
      enumerable: false,
      value: analysisDiagnostic.attempt,
      writable: false,
    },
    qualificationPriorValidationCategory: {
      configurable: false,
      enumerable: false,
      value: analysisDiagnostic.priorValidationCategory,
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

function analysisAtomLimitForRequest(request) {
  const value = request?.analysisAtomLimit ?? LATTICE_BATCH_ATOM_LIMIT;
  if (!validPositiveInteger(value) || value > LATTICE_BATCH_ATOM_LIMIT) {
    throw new TypeError("The Lattice provider received an invalid analysis atom limit.");
  }
  return value;
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonObjectMessages(messages, schemaName, schema, responseGuide) {
  const contract = [
    `Response contract ${schemaName}: Return exactly one minified JSON object matching the following closed JSON Schema.`,
    "Do not wrap the JSON object in Markdown or add text before or after it.",
    ...(responseGuide ? [responseGuide] : []),
    `<LATTICE_RESPONSE_SCHEMA>${JSON.stringify(schema)}</LATTICE_RESPONSE_SCHEMA>`,
  ].join("\n");
  const content = contract;
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

function forcedToolMessages(messages, toolName) {
  const contract = [
    `Response channel ${toolName}: Call this function exactly once with the complete structured result as its arguments.`,
    "Do not return a normal assistant response or call any other function.",
  ].join("\n");
  const content = contract;
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

function analysisWireSchemaForRequest(request) {
  const passageIds = Array.isArray(request?.batch?.passages)
    ? request.batch.passages.map(({ id }) => id)
    : [];
  const passageIdSchema = Object.freeze({
    ...ANALYSIS_WIRE_PASSAGE_SCHEMA.prefixItems[0],
    ...(passageIds.length > 0 ? { enum: Object.freeze([...passageIds]) } : {}),
  });
  const requestedAtomLimit = analysisAtomLimitForRequest(request);
  const atomSchema = Object.freeze({
    ...ANALYSIS_WIRE_PASSAGE_SCHEMA.prefixItems[5],
    maxItems: requestedAtomLimit,
  });
  const passageSchema = fixedTuple(
    passageIdSchema,
    ANALYSIS_WIRE_PASSAGE_SCHEMA.prefixItems[1],
    ANALYSIS_WIRE_PASSAGE_SCHEMA.prefixItems[2],
    ANALYSIS_WIRE_PASSAGE_SCHEMA.prefixItems[3],
    ANALYSIS_WIRE_PASSAGE_SCHEMA.prefixItems[4],
    atomSchema,
    ANALYSIS_WIRE_PASSAGE_SCHEMA.prefixItems[6],
    ANALYSIS_WIRE_PASSAGE_SCHEMA.prefixItems[7],
    ANALYSIS_WIRE_PASSAGE_SCHEMA.prefixItems[8],
    ANALYSIS_WIRE_PASSAGE_SCHEMA.prefixItems[9],
  );
  return Object.freeze({
    ...ANALYSIS_WIRE_SCHEMA,
    properties: Object.freeze({
      ...ANALYSIS_WIRE_SCHEMA.properties,
      p: Object.freeze({
        ...ANALYSIS_WIRE_SCHEMA.properties.p,
        ...(passageIds.length > 0 ? {
          minItems: passageIds.length,
          maxItems: passageIds.length,
        } : {}),
        items: passageSchema,
      }),
    }),
  });
}

function exactKeys(value, keys) {
  if (!record(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function decodeAnalysisWire(value) {
  if (!exactKeys(value, ["d", "p", "q"])
    || !Array.isArray(value.p)
    || !Array.isArray(value.q)) return {};
  const passages = [];
  for (const passage of value.p) {
    if (!Array.isArray(passage) || passage.length !== 10 || !Array.isArray(passage[5])) return {};
    const atoms = [];
    for (const atom of passage[5]) {
      if (!Array.isArray(atom) || atom.length !== 7 || !Array.isArray(atom[6])) return {};
      const links = [];
      for (const link of atom[6]) {
        if (!Array.isArray(link) || link.length !== 2) return {};
        links.push({ relation: link[0], targetAtomId: link[1] });
      }
      atoms.push({
        id: atom[0],
        kind: atom[1],
        value: atom[2],
        priority: atom[3],
        preservation: atom[4],
        evidenceSpanIds: atom[5],
        links,
      });
    }
    if (!Array.isArray(passage[9])) return {};
    const conformanceAssertions = [];
    for (const assertion of passage[9]) {
      if (!Array.isArray(assertion) || assertion.length !== 2) return {};
      conformanceAssertions.push({
        criterion: assertion[0],
        evidenceSpanIds: assertion[1],
      });
    }
    passages.push({
      passageId: passage[0],
      discourseFunction: passage[1],
      layer: passage[2],
      disposition: passage[3],
      rationale: passage[4],
      atoms,
      ambiguityAtomIds: passage[6],
      conformanceCriteria: passage[7],
      conformanceEvidenceSpanIds: passage[8],
      conformanceAssertions,
    });
  }
  return {
    documentKind: value.d,
    passages,
    questions: value.q,
  };
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
      throw withProviderDiagnostic(
        providerError("provider_response_too_large", "The Lattice provider response exceeded its limit."),
        { responseSize: /^\d+$/u.test(claimedLength) ? sizeBucket(Number(claimedLength)) : "none" },
      );
    }
  }

  if (!response.body) return Object.freeze({ text: "", responseSize: "0" });
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
        throw withProviderDiagnostic(
          providerError("provider_response_too_large", "The Lattice provider response exceeded its limit."),
          { responseSize: sizeBucket(total) },
        );
      }
      result += decoder.decode(part.value, { stream: true });
    }
    result += decoder.decode();
    return Object.freeze({ text: result, responseSize: sizeBucket(total) });
  } catch (error) {
    if (error instanceof LatticeProviderError || signal?.aborted) throw error;
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned an unreadable response.", {
        cause: error,
      }),
      { subtype: "response_read", responseSize: sizeBucket(total) },
    );
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

function parsedProviderContent(body, responseSize, toolName) {
  let envelope;
  try {
    envelope = JSON.parse(body);
  } catch (error) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned invalid JSON.", { cause: error }),
      { subtype: "envelope_json", responseSize },
    );
  }
  const completionTokens = completionTokenBucket(envelope?.usage?.completion_tokens);
  if (!Array.isArray(envelope?.choices) || envelope.choices.length !== 1) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned an invalid completion envelope."),
      { subtype: "choice_count", responseSize, completionTokens },
    );
  }
  const choice = envelope.choices[0];
  if (!record(choice)) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned an invalid completion envelope."),
      { subtype: "choice_shape", responseSize, completionTokens },
    );
  }
  const providerFinishReason = finishReason(choice.finish_reason);
  const provisionalToolArguments = toolName !== undefined
    && record(choice.message)
    && Array.isArray(choice.message.tool_calls)
    && typeof choice.message.tool_calls[0]?.function?.arguments === "string"
    ? choice.message.tool_calls[0].function.arguments
    : null;
  const providerContentSize = sizeBucket(
    provisionalToolArguments !== null
      ? provisionalToolArguments.length
      : record(choice.message) && typeof choice.message.content === "string"
      ? choice.message.content.length
      : null,
  );
  const validFinishReason = toolName === undefined
    ? choice.finish_reason === "stop"
    : choice.finish_reason === "stop" || choice.finish_reason === "tool_calls";
  if (!validFinishReason) {
    const code = choice.finish_reason === "length"
      ? "provider_output_limit"
      : "provider_malformed_response";
    throw withProviderDiagnostic(
      providerError(code, code === "provider_output_limit"
        ? "The Lattice provider reached its output limit."
        : "The Lattice provider returned an invalid completion envelope."),
      {
        subtype: code === "provider_malformed_response" ? "finish_reason" : "none",
        finishReason: providerFinishReason,
        responseSize,
        contentSize: providerContentSize,
        completionTokens,
      },
    );
  }
  if (!record(choice.message)) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned an invalid completion envelope."),
      {
        subtype: "message_shape",
        finishReason: providerFinishReason,
        responseSize,
        completionTokens,
      },
    );
  }
  if (choice.message.role !== "assistant") {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned an invalid completion envelope."),
      {
        subtype: "message_role",
        finishReason: providerFinishReason,
        responseSize,
        completionTokens,
      },
    );
  }
  if (toolName !== undefined) {
    // Some OpenAI-compatible providers retain auxiliary assistant content or a
    // legacy function_call while also returning the authoritative tool_calls
    // entry. Ignore those fields: they are never interpreted, exposed, or used as a
    // fallback, and the exact single named tool call below remains mandatory.
    if (!Array.isArray(choice.message.tool_calls) || choice.message.tool_calls.length !== 1) {
      throw withProviderDiagnostic(
        providerError("provider_malformed_response", "The Lattice provider returned an invalid completion envelope."),
        {
          subtype: "message_shape",
          finishReason: providerFinishReason,
          responseSize,
          contentSize: providerContentSize,
          completionTokens,
        },
      );
    }
    const toolCall = choice.message.tool_calls[0];
    if (!record(toolCall)
      || typeof toolCall.id !== "string"
      || !toolCall.id.trim()
      || toolCall.id.length > 256
      || toolCall.type !== "function"
      || !record(toolCall.function)
      || toolCall.function.name !== toolName
      || typeof toolCall.function.arguments !== "string") {
      throw withProviderDiagnostic(
        providerError("provider_malformed_response", "The Lattice provider returned an invalid completion envelope."),
        {
          subtype: "message_shape",
          finishReason: providerFinishReason,
          responseSize,
          contentSize: providerContentSize,
          completionTokens,
        },
      );
    }
    const content = toolCall.function.arguments;
    const contentSize = sizeBucket(content.length);
    if (!content.trim()) {
      throw withProviderDiagnostic(
        providerError("provider_malformed_response", "The Lattice provider returned no structured content."),
        {
          subtype: "content_empty",
          finishReason: providerFinishReason,
          responseSize,
          contentSize,
          completionTokens,
        },
      );
    }
    if (content.length > LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT) {
      throw withProviderDiagnostic(
        providerError("provider_response_too_large", "The Lattice provider content exceeded its limit."),
        {
          finishReason: providerFinishReason,
          responseSize,
          contentSize,
          completionTokens,
        },
      );
    }
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw withProviderDiagnostic(
        providerError("provider_malformed_response", "The Lattice provider returned invalid structured content.", {
          cause: error,
        }),
        {
          subtype: "content_json",
          finishReason: providerFinishReason,
          responseSize,
          contentSize,
          completionTokens,
        },
      );
    }
    if (!record(parsed)) {
      throw withProviderDiagnostic(
        providerError("provider_malformed_response", "The Lattice provider returned invalid structured content.", {
          cause: new TypeError("Structured content was not an object."),
        }),
        {
          subtype: "content_shape",
          finishReason: providerFinishReason,
          responseSize,
          contentSize,
          completionTokens,
        },
      );
    }
    return parsed;
  }
  const content = choice.message.content;
  const contentSize = providerContentSize;
  if (typeof content !== "string" || !content.trim()) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned no structured content."),
      {
        subtype: "content_empty",
        finishReason: providerFinishReason,
        responseSize,
        contentSize,
        completionTokens,
      },
    );
  }
  if (content.length > LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT) {
    throw withProviderDiagnostic(
      providerError("provider_response_too_large", "The Lattice provider content exceeded its limit."),
      {
        finishReason: providerFinishReason,
        responseSize,
        contentSize,
        completionTokens,
      },
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned invalid structured content.", {
        cause: error,
      }),
      {
        subtype: "content_json",
        finishReason: providerFinishReason,
        responseSize,
        contentSize,
        completionTokens,
      },
    );
  }
  if (!record(parsed)) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned invalid structured content.", {
        cause: new TypeError("Structured content was not an object."),
      }),
      {
        subtype: "content_shape",
        finishReason: providerFinishReason,
        responseSize,
        contentSize,
        completionTokens,
      },
    );
  }
  return parsed;
}

export async function requestHuggingFaceJson({
  token,
  role,
  messages,
  schema,
  schemaName,
  responseGuide,
  toolName,
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
      && (!Number.isFinite(presencePenalty) || presencePenalty < 0 || presencePenalty > 2))
    || (responseGuide !== undefined
      && (typeof responseGuide !== "string" || !responseGuide.trim() || responseGuide.length > 4_096))
    || (toolName !== undefined
      && (typeof toolName !== "string" || !/^[A-Za-z0-9_-]{1,64}$/u.test(toolName)))) {
    throw new TypeError("The Lattice provider received an invalid server configuration.");
  }

  // Each structured stage supplies one exact named tool choice. The response
  // parser below fails closed unless that matching structured call is returned.
  const providerRequestBody = JSON.stringify({
    model: LATTICE_REMOTE_MODELS[role],
    messages: toolName === undefined
      ? jsonObjectMessages(messages, schemaName, schema, responseGuide)
      : forcedToolMessages(messages, toolName),
    ...(toolName === undefined
      ? { response_format: { type: "json_object" } }
      : {
        tools: [{
          type: "function",
          function: {
            name: toolName,
            description: responseGuide ?? "Supply one complete structured response.",
            parameters: schema,
          },
        }],
        tool_choice: {
          type: "function",
          function: { name: toolName },
        },
      }),
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
    ...(topK === undefined ? {} : { top_k: topK }),
    ...(minP === undefined ? {} : { min_p: minP }),
    ...(presencePenalty === undefined ? {} : { presence_penalty: presencePenalty }),
    seed: 71_903,
    stream: false,
  });
  const requestByteLength = new TextEncoder().encode(providerRequestBody).byteLength;
  const requestSize = sizeBucket(requestByteLength);
  if (requestByteLength > maximumRequestBytes) {
    throw withProviderDiagnostic(
      providerError(
        "provider_request_too_large",
        "The Lattice provider request exceeded its byte limit.",
      ),
      { requestSize },
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
        throw withProviderDiagnostic(
          providerError("provider_malformed_response", "The Lattice provider returned an invalid response."),
          { subtype: "response_type" },
        );
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
        throw withProviderDiagnostic(
          providerError("provider_malformed_response", "The Lattice provider returned an invalid media type."),
          { subtype: "media_type" },
        );
      }
      const boundedBody = await boundedResponseText(response, maximumResponseBytes, deadline.signal);
      return parsedProviderContent(boundedBody.text, boundedBody.responseSize, toolName);
    } catch (error) {
      if (deadline.didTimeOut()) {
        throw providerError("provider_timeout", "The Lattice provider timed out.", { cause: error });
      }
      if (signal?.aborted) throw signal.reason ?? abortError();
      if (error instanceof LatticeProviderError) throw error;
      throw withProviderDiagnostic(
        providerError("provider_malformed_response", "The Lattice provider returned an invalid response.", {
          cause: error,
        }),
        { subtype: "response_processing" },
      );
    }
  } catch (error) {
    if (error instanceof LatticeProviderError) {
      throw withProviderDiagnostic(error, { requestSize });
    }
    throw error;
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
    const analysisContext = stageName === "analysis"
      ? request?.[LATTICE_ANALYSIS_DIAGNOSTIC_CONTEXT]
      : null;
    let result;
    try {
      result = await requestHuggingFaceJson({
        token,
        role: stage.role,
        messages: messagesWithMode(stage.messages, request, requestedMode),
        schema: stageName === "analysis" ? analysisWireSchemaForRequest(request) : stage.schema,
        schemaName: stage.schemaName,
        responseGuide: stage.responseGuide,
        toolName: stage.toolName,
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
      throw withQualificationDiagnostic(error, stageName, callOrdinal, analysisContext);
    }
    if (stageName === "analysis") {
      result = decodeAnalysisWire(result);
      Object.defineProperty(result, LATTICE_FITTED_ANALYSIS_CONTEXT, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: Object.freeze({
          analysisAtomLimit: analysisAtomLimitForRequest(request),
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

function exactRequiredFields(schema, fields) {
  return Array.isArray(schema?.required)
    && schema.required.length === fields.length
    && [...schema.required].sort().every((field, index) => field === [...fields].sort()[index]);
}

if (!exactRequiredFields(REANALYSIS_SCHEMA, ["documentKind", "passages", "questions"])
  || !exactRequiredFields(INTERNAL_ANALYSIS_PASSAGE_SCHEMA, [
    "passageId", "discourseFunction", "layer", "disposition", "rationale", "atoms",
    "ambiguityAtomIds", "conformanceCriteria", "conformanceEvidenceSpanIds",
    "conformanceAssertions",
  ])
  || !exactRequiredFields(INTERNAL_ANALYSIS_ATOM_SCHEMA, [
    "id", "kind", "value", "priority", "preservation", "evidenceSpanIds", "links",
  ])
  || !exactRequiredFields(INTERNAL_ANALYSIS_LINK_SCHEMA, ["relation", "targetAtomId"])
  || !exactRequiredFields(INTERNAL_ANALYSIS_ASSERTION_SCHEMA, ["criterion", "evidenceSpanIds"])) {
  throw new Error("The private analysis wire schema has drifted from the closed host schema.");
}
