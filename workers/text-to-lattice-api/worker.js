import {
  LATTICE_INPUT_SAFETY_LIMIT,
  LATTICE_INPUT_UTF8_LIMIT,
  LATTICE_WORD_LIMIT,
  countLatticeWords,
  latticeUtf8Length,
} from "../../app/resume/lattice/inputPolicy.js";
import {
  LATTICE_API_PATH,
  LATTICE_API_SCHEMA_VERSION,
  isLatticeApiRequest,
  isLatticeApiResult,
} from "../../app/resume/lattice/remoteProtocol.js";
import {
  preflightLatticeInput,
  runTextToLattice,
} from "../../app/resume/latticeDemo.js";
import {
  LatticeProviderError,
  createHuggingFaceLatticeAdapter,
} from "./huggingFaceAdapter.js";

export const LATTICE_API_ORIGIN = "https://hah.dev";
export { LATTICE_API_PATH, LATTICE_API_SCHEMA_VERSION };
export const LATTICE_API_REQUEST_TIMEOUT_MS = 240_000;
export const LATTICE_API_REQUEST_BYTE_LIMIT = 65_536;
export const LATTICE_API_RESPONSE_BYTE_LIMIT = 262_144;
export const LATTICE_API_RATE_LIMIT_KEY = "text-to-lattice:transform";
export const LATTICE_API_RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

const JSON_CONTENT_TYPE = /^application\/json(?:\s*;\s*charset=utf-8)?$/iu;
const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
});

class LatticeApiError extends Error {
  constructor(status, code, retryAfterSeconds = null) {
    super(code);
    this.name = "LatticeApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function apiError(status, code, retryAfterSeconds) {
  return new LatticeApiError(status, code, retryAfterSeconds);
}

function abortError(message = "The Lattice request was canceled.") {
  return new DOMException(message, "AbortError");
}

function raceAbort(operation, signal) {
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

function cancelReader(reader, reason) {
  try {
    const cancellation = reader.cancel(reason);
    if (cancellation && typeof cancellation.catch === "function") {
      cancellation.catch(() => {});
    }
  } catch {
    // Cancellation is best-effort and must not extend the public deadline.
  }
}

function requestDeadline(request, milliseconds) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromClient = () => controller.abort(request.signal.reason ?? abortError());
  if (request.signal.aborted) abortFromClient();
  else request.signal.addEventListener("abort", abortFromClient, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(abortError("The Lattice request timed out."));
  }, milliseconds);
  return Object.freeze({
    signal: controller.signal,
    didTimeOut: () => timedOut,
    dispose() {
      clearTimeout(timeout);
      request.signal.removeEventListener("abort", abortFromClient);
    },
  });
}

function jsonResponse(value, status) {
  return new Response(JSON.stringify(value), {
    status,
    headers: RESPONSE_HEADERS,
  });
}

function errorResponse(status, code, retryAfterSeconds = null) {
  const body = { error: code };
  if (Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds >= 1 && retryAfterSeconds <= 300) {
    body.retry_after_seconds = retryAfterSeconds;
  }
  return jsonResponse(body, status);
}

async function boundedRequestText(request, maximumBytes, signal) {
  const claimedLength = request.headers.get("content-length");
  if (claimedLength !== null) {
    if (!/^\d+$/u.test(claimedLength)) {
      throw apiError(400, "invalid_request");
    }
    if (Number(claimedLength) > maximumBytes) {
      throw apiError(413, "input_too_large");
    }
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
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
        throw apiError(413, "input_too_large");
      }
      result += decoder.decode(part.value, { stream: true });
    }
    result += decoder.decode();
    return result;
  } catch (error) {
    if (error instanceof LatticeApiError || signal.aborted) throw error;
    throw apiError(400, "invalid_request");
  } finally {
    if (signal.aborted) {
      cancelReader(reader, signal.reason);
    }
    try {
      reader.releaseLock();
    } catch {
      // A pending platform read remains governed by the same abort signal.
    }
  }
}

function validateEnvelope(value) {
  if (!isLatticeApiRequest(value)) {
    throw apiError(400, "invalid_request");
  }
  return value;
}

function safeProviderResponse(error) {
  switch (error.code) {
    case "provider_timeout":
      return errorResponse(504, "upstream_timeout");
    case "provider_not_configured":
      return errorResponse(500, "internal_error");
    case "provider_http_error":
      return error.status === 429
        ? errorResponse(429, "rate_limited", error.retryAfterSeconds)
        : errorResponse(502, "upstream_unavailable");
    case "provider_unavailable":
    case "provider_call_limit":
    case "provider_redirect":
      return errorResponse(502, "upstream_unavailable");
    case "provider_response_too_large":
    case "provider_output_limit":
    case "provider_malformed_response":
      return errorResponse(502, "malformed_upstream_response");
    default:
      return errorResponse(502, "upstream_unavailable");
  }
}

export async function enforceLatticeApiRateLimit(binding) {
  if (!binding || typeof binding.limit !== "function") {
    throw apiError(500, "internal_error");
  }
  let outcome;
  try {
    outcome = await binding.limit({ key: LATTICE_API_RATE_LIMIT_KEY });
  } catch {
    throw apiError(500, "internal_error");
  }
  if (outcome === null || typeof outcome !== "object" || typeof outcome.success !== "boolean") {
    throw apiError(500, "internal_error");
  }
  if (!outcome.success) {
    throw apiError(429, "rate_limited", LATTICE_API_RATE_LIMIT_RETRY_AFTER_SECONDS);
  }
}

export function createLatticeApiWorker({
  runTextToLatticeImpl = runTextToLattice,
  preflightLatticeInputImpl = preflightLatticeInput,
  createAdapter = createHuggingFaceLatticeAdapter,
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = LATTICE_API_REQUEST_TIMEOUT_MS,
  requestByteLimit = LATTICE_API_REQUEST_BYTE_LIMIT,
  responseByteLimit = LATTICE_API_RESPONSE_BYTE_LIMIT,
  providerCallTimeoutMs,
  providerResponseByteLimit,
  enforceRateLimit = enforceLatticeApiRateLimit,
} = {}) {
  if (typeof runTextToLatticeImpl !== "function" || typeof preflightLatticeInputImpl !== "function"
    || typeof createAdapter !== "function" || typeof fetchImpl !== "function"
    || !Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs <= 0
    || !Number.isSafeInteger(requestByteLimit) || requestByteLimit <= 0
    || !Number.isSafeInteger(responseByteLimit) || responseByteLimit <= 0
    || typeof enforceRateLimit !== "function") {
    throw new TypeError("The Lattice API worker received an invalid server configuration.");
  }

  return Object.freeze({
    async fetch(request, env = {}) {
      let url;
      try {
        url = new URL(request.url);
      } catch {
        return errorResponse(400, "invalid_request");
      }
      if (url.href !== `${LATTICE_API_ORIGIN}${LATTICE_API_PATH}`) {
        return errorResponse(404, "invalid_request");
      }
      if (request.method !== "POST") {
        const response = errorResponse(405, "invalid_request");
        response.headers.set("Allow", "POST");
        return response;
      }
      if (request.headers.get("origin") !== LATTICE_API_ORIGIN) {
        return errorResponse(403, "invalid_request");
      }
      if (!JSON_CONTENT_TYPE.test(request.headers.get("content-type") ?? "")) {
        return errorResponse(415, "unsupported_media_type");
      }

      const deadline = requestDeadline(request, requestTimeoutMs);
      try {
        let body;
        try {
          body = JSON.parse(await boundedRequestText(request, requestByteLimit, deadline.signal));
        } catch (error) {
          if (error instanceof LatticeApiError) throw error;
          if (deadline.signal.aborted) throw deadline.signal.reason ?? abortError();
          throw apiError(400, "invalid_request");
        }
        const payload = validateEnvelope(body);
        try {
          preflightLatticeInputImpl(payload.text);
        } catch {
          const inputTooLarge = payload.text.length > LATTICE_INPUT_SAFETY_LIMIT
            || latticeUtf8Length(payload.text) > LATTICE_INPUT_UTF8_LIMIT
            || countLatticeWords(payload.text) > LATTICE_WORD_LIMIT;
          throw apiError(inputTooLarge ? 413 : 400, inputTooLarge ? "input_too_large" : "invalid_request");
        }

        await raceAbort(enforceRateLimit(env.LATTICE_API_RATE_LIMITER), deadline.signal);

        const adapterOptions = {
          token: env.HF_TOKEN,
          requestedMode: payload.requested_mode,
          fetchImpl,
        };
        if (providerCallTimeoutMs !== undefined) adapterOptions.callTimeoutMs = providerCallTimeoutMs;
        if (providerResponseByteLimit !== undefined) {
          adapterOptions.maximumResponseBytes = providerResponseByteLimit;
        }
        const adapter = createAdapter(adapterOptions);
        const result = await raceAbort(runTextToLatticeImpl(payload.text, {
          adapter,
          signal: deadline.signal,
          allowClarification: false,
          clarificationAnswers: Object.freeze([]),
          requestedMode: payload.requested_mode,
        }), deadline.signal);
        if (!isLatticeApiResult(result)) {
          throw apiError(502, "malformed_upstream_response");
        }
        const responseBody = JSON.stringify({
          result,
          schema_version: LATTICE_API_SCHEMA_VERSION,
        });
        if (new TextEncoder().encode(responseBody).byteLength > responseByteLimit) {
          throw apiError(500, "internal_error");
        }
        return new Response(responseBody, { status: 200, headers: RESPONSE_HEADERS });
      } catch (error) {
        if (deadline.didTimeOut()) {
          return errorResponse(504, "upstream_timeout");
        }
        if (error instanceof LatticeApiError) {
          return errorResponse(error.status, error.code, error.retryAfterSeconds);
        }
        if (error instanceof LatticeProviderError) return safeProviderResponse(error);
        if (deadline.signal.aborted) {
          return errorResponse(400, "invalid_request");
        }
        return errorResponse(500, "internal_error");
      } finally {
        deadline.dispose();
      }
    },
  });
}

const latticeApiWorker = createLatticeApiWorker();

export default latticeApiWorker;
