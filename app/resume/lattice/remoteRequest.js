import { NetworkPolicyError, capabilityFetch } from "../../privacy/networkCapabilities.js";
import { latticeUtf8Length, validateLatticeInput } from "./inputPolicy.js";
import {
  LATTICE_API_PATH,
  LATTICE_API_SCHEMA_VERSION,
  LATTICE_REQUEST_MODES,
  isLatticeApiError,
  isLatticeApiResult,
} from "./remoteProtocol.js";

export const LATTICE_REMOTE_CAPABILITY = "text-to-lattice";
export { LATTICE_API_PATH, LATTICE_API_SCHEMA_VERSION, LATTICE_REQUEST_MODES };
export const LATTICE_CLIENT_TIMEOUT_MS = 240_000;
export const LATTICE_RESPONSE_BYTE_LIMIT = 262_144;

/** @typedef {"auto" | "operative" | "experiential"} LatticeRequestedMode */
/** @typedef {"validating" | "submitting" | "processing" | "success"} LatticeRemoteState */
/**
 * @typedef {object} LatticeRemoteRequestOptions
 * @property {LatticeRequestedMode} [requestedMode]
 * @property {AbortSignal} [signal]
 * @property {(state: LatticeRemoteState) => void} [onState]
 * @property {typeof globalThis.fetch} [fetchImpl]
 * @property {string} [baseOrigin]
 * @property {number} [timeoutMs]
 */

const ERROR_POLICY = Object.freeze({
  invalid_request: Object.freeze({ retryable: false }),
  input_too_large: Object.freeze({ retryable: false }),
  rate_limited: Object.freeze({ retryable: true }),
  upstream_timeout: Object.freeze({ retryable: true }),
  upstream_unavailable: Object.freeze({ retryable: true }),
  malformed_upstream_response: Object.freeze({ retryable: false }),
  internal_error: Object.freeze({ retryable: false }),
  client_timeout: Object.freeze({ retryable: true }),
  invalid_response: Object.freeze({ retryable: false }),
  network_failure: Object.freeze({ retryable: true }),
  unsupported_media_type: Object.freeze({ retryable: false }),
});

const ERROR_STATUSES = Object.freeze({
  invalid_request: Object.freeze([400, 403, 404, 405]),
  input_too_large: Object.freeze([413]),
  rate_limited: Object.freeze([429]),
  upstream_timeout: Object.freeze([504]),
  upstream_unavailable: Object.freeze([502]),
  malformed_upstream_response: Object.freeze([502]),
  internal_error: Object.freeze([500]),
  unsupported_media_type: Object.freeze([415]),
});

const JSON_CONTENT_TYPE = /^application\/json(?:\s*;\s*charset=utf-8)?$/iu;

export class LatticeRemoteError extends Error {
  constructor(code, { status = 0, retryAfterSeconds = null, cause } = {}) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = "LatticeRemoteError";
    this.code = code;
    this.status = status;
    this.retryable = ERROR_POLICY[code]?.retryable === true;
    this.retryAfterSeconds = Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds >= 0
      ? retryAfterSeconds
      : null;
  }
}

function exactKeys(value, keys) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function requestedMode(mode) {
  if (!LATTICE_REQUEST_MODES.includes(mode)) {
    throw new LatticeRemoteError("invalid_request");
  }
  return mode;
}

export function makeLatticeRequest(text, mode = "auto") {
  const { source } = validateLatticeInput(text);
  return Object.freeze({
    text: source,
    requested_mode: requestedMode(mode),
    schema_version: LATTICE_API_SCHEMA_VERSION,
  });
}

function abortReason(signal) {
  if (signal?.reason instanceof Error) return signal.reason;
  return new DOMException("Text to Lattice was canceled.", "AbortError");
}

function combineAbort(parentSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort(abortReason(parentSignal));
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Text to Lattice timed out.", "TimeoutError"));
  }, timeoutMs);
  return Object.freeze({
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose() {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
  });
}

function raceAbort(operation, signal) {
  if (signal.aborted) return Promise.reject(abortReason(signal));
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(operation).then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

function cancelReadable(readable, reason) {
  try {
    const cancellation = readable?.cancel(reason);
    if (cancellation && typeof cancellation.catch === "function") {
      void cancellation.catch(() => {});
    }
  } catch {
    // Cleanup failure cannot replace the bounded public request failure.
  }
}

function invalidResponse(status, cause) {
  return new LatticeRemoteError("invalid_response", { status, cause });
}

function validateResponseShape(response) {
  if (response === null
    || typeof response !== "object"
    || !Number.isSafeInteger(response.status)
    || response.status < 200
    || response.status > 599
    || typeof response.headers?.get !== "function"
    || typeof response.text !== "function") {
    cancelReadable(response?.body);
    throw invalidResponse(0);
  }
  return response.status;
}

function declaredResponseLength(response) {
  const header = response.headers.get("content-length");
  if (header === null) return null;
  if (!/^[0-9]+$/u.test(header)) {
    throw invalidResponse(response.status);
  }
  const canonical = header.replace(/^0+(?=[0-9])/u, "");
  if (canonical.length > String(LATTICE_RESPONSE_BYTE_LIMIT).length) {
    throw invalidResponse(response.status);
  }
  const value = Number(canonical);
  if (!Number.isSafeInteger(value) || value > LATTICE_RESPONSE_BYTE_LIMIT) {
    throw invalidResponse(response.status);
  }
  return value;
}

async function boundedResponseText(response, signal) {
  try {
    declaredResponseLength(response);
  } catch (error) {
    cancelReadable(response.body);
    throw error;
  }

  if (!response.body
    || typeof response.body.getReader !== "function"
    || typeof TextDecoder !== "function") {
    let text;
    try {
      text = await raceAbort(response.text(), signal);
    } catch (error) {
      cancelReadable(response.body, signal.reason);
      throw error;
    }
    if (latticeUtf8Length(text) > LATTICE_RESPONSE_BYTE_LIMIT) {
      cancelReadable(response.body);
      throw invalidResponse(response.status);
    }
    return text;
  }

  let reader;
  try {
    reader = response.body.getReader();
  } catch (cause) {
    cancelReadable(response.body);
    throw invalidResponse(response.status, cause);
  }
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let text = "";
  let complete = false;
  try {
    while (true) {
      const part = await raceAbort(reader.read(), signal);
      if (part.done) break;
      if (!part.value || !Number.isSafeInteger(part.value.byteLength)) {
        throw invalidResponse(response.status);
      }
      bytesRead += part.value.byteLength;
      if (bytesRead > LATTICE_RESPONSE_BYTE_LIMIT) {
        throw invalidResponse(response.status);
      }
      try {
        text += decoder.decode(part.value, { stream: true });
      } catch (cause) {
        throw invalidResponse(response.status, cause);
      }
    }
    try {
      text += decoder.decode();
    } catch (cause) {
      throw invalidResponse(response.status, cause);
    }
    complete = true;
    return text;
  } finally {
    if (!complete) cancelReadable(reader, signal.reason);
    try {
      reader.releaseLock();
    } catch {
      // A pending platform read remains governed by the same abort signal.
    }
  }
}

function parseRetryAfter(response, payload) {
  if (Number.isSafeInteger(payload.retry_after_seconds)) return payload.retry_after_seconds;
  const header = response.headers.get("retry-after");
  if (typeof header !== "string" || !/^[0-9]+$/u.test(header)) return null;
  const canonical = header.replace(/^0+(?=[0-9])/u, "");
  if (canonical.length > 3) return null;
  const value = Number(canonical);
  return Number.isSafeInteger(value) && value >= 1 && value <= 300 ? value : null;
}

function parseJson(text, status) {
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new LatticeRemoteError("invalid_response", { status, cause });
  }
}

function validErrorStatus(code, status) {
  return Object.prototype.hasOwnProperty.call(ERROR_STATUSES, code)
    && ERROR_STATUSES[code].includes(status);
}

/**
 * Submit one explicitly authorized Text-to-Lattice request.
 *
 * @param {string} text
 * @param {LatticeRemoteRequestOptions} [options]
 */
export async function requestRemoteLattice(text, options = {}) {
  const {
    requestedMode = "auto",
    signal,
    onState,
    fetchImpl,
    baseOrigin,
    timeoutMs = LATTICE_CLIENT_TIMEOUT_MS,
  } = options;
  onState?.("validating");
  const payload = makeLatticeRequest(text, requestedMode);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > LATTICE_CLIENT_TIMEOUT_MS) {
    throw new LatticeRemoteError("invalid_request");
  }
  if (signal?.aborted) throw abortReason(signal);
  const lifecycle = combineAbort(signal, timeoutMs);
  try {
    try {
      onState?.("submitting");
      if (lifecycle.signal.aborted) throw abortReason(lifecycle.signal);
      const responsePromise = capabilityFetch(LATTICE_REMOTE_CAPABILITY, LATTICE_API_PATH, {
        method: "POST",
        headers: Object.freeze({
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(payload),
        signal: lifecycle.signal,
      }, { fetchImpl, baseOrigin });
      void responsePromise.then((lateResponse) => {
        if (lifecycle.signal.aborted) cancelReadable(lateResponse?.body, lifecycle.signal.reason);
      }, () => {});
      onState?.("processing");
      const response = await raceAbort(responsePromise, lifecycle.signal);
      const status = validateResponseShape(response);
      const contentType = response.headers.get("content-type") ?? "";
      if (!JSON_CONTENT_TYPE.test(contentType)) {
        cancelReadable(response.body);
        throw invalidResponse(status);
      }
      const bodyText = await boundedResponseText(response, lifecycle.signal);
      if (lifecycle.signal.aborted) throw abortReason(lifecycle.signal);
      const body = parseJson(bodyText, status);
      if (status !== 200) {
        if (!isLatticeApiError(body) || !validErrorStatus(body.error, status)) {
          throw invalidResponse(status);
        }
        throw new LatticeRemoteError(body.error, {
          status,
          retryAfterSeconds: body.error === "rate_limited"
            ? parseRetryAfter(response, body)
            : null,
        });
      }
      if (!exactKeys(body, ["result", "schema_version"])
        || body.schema_version !== LATTICE_API_SCHEMA_VERSION
        || !isLatticeApiResult(body.result)) {
        throw invalidResponse(status);
      }
      if (lifecycle.signal.aborted) throw abortReason(lifecycle.signal);
      onState?.("success");
      return Object.freeze(body.result);
    } catch (cause) {
      if (signal?.aborted) throw abortReason(signal);
      if (lifecycle.timedOut()) {
        throw new LatticeRemoteError("client_timeout", { cause });
      }
      if (cause instanceof NetworkPolicyError || cause instanceof LatticeRemoteError) throw cause;
      throw new LatticeRemoteError("network_failure", { cause });
    }
  } finally {
    lifecycle.dispose();
  }
}
