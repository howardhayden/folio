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
  LATTICE_VISITOR_SESSION_ACCEPT,
  isLatticeApiRequest,
  isLatticeApiResult,
} from "../../app/resume/lattice/remoteProtocol.js";
import {
  preflightLatticeInput,
  runTextToLattice,
} from "../../app/resume/latticeDemo.js";
import {
  LATTICE_PROVIDER_ANALYSIS_ATTEMPTS,
  LATTICE_PROVIDER_ANALYSIS_ORIGINS,
  LATTICE_PROVIDER_CALL_LIMIT,
  LATTICE_PROVIDER_COMPLETION_TOKEN_BUCKETS,
  LATTICE_PROVIDER_FAILURE_CLASSES,
  LATTICE_PROVIDER_FINISH_REASONS,
  LATTICE_PROVIDER_MALFORMED_SUBTYPES,
  LATTICE_PROVIDER_SIZE_BUCKETS,
  LATTICE_PROVIDER_STAGES,
  LatticeProviderError,
  createHuggingFaceLatticeAdapter,
} from "./huggingFaceAdapter.js";
import {
  LATTICE_ANALYSIS_VALIDATION_CATEGORIES,
} from "../../app/resume/lattice/promptContract.js";
import {
  claimGlobalLatticeTransformation,
} from "./capacityClient.js";
import {
  LatticeApiVisitorCookieError,
  establishLatticeApiVisitor,
  resolveLatticeApiVisitor,
  withLatticeApiVisitorCookie,
} from "./visitorCookie.js";

export const LATTICE_API_ORIGIN = "https://hah.dev";
export { LATTICE_API_PATH, LATTICE_API_SCHEMA_VERSION };
export const LATTICE_API_REQUEST_TIMEOUT_MS = 240_000;
export const LATTICE_API_REQUEST_BYTE_LIMIT = 65_536;
export const LATTICE_API_RESPONSE_BYTE_LIMIT = 262_144;
export const LATTICE_API_RATE_LIMIT_KEY = "text-to-lattice:transform";
export const LATTICE_API_RATE_LIMIT_RETRY_AFTER_SECONDS = 60;
export const LATTICE_QUALIFICATION_EXPIRES_AT_BINDING = "LATTICE_QUALIFICATION_EXPIRES_AT";
export const LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER =
  "X-Lattice-Qualification-Diagnostic";
export const LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE = "v2";
export const LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS = Object.freeze({
  failureClass: "X-Lattice-Qualification-Failure-Class",
  upstreamStatus: "X-Lattice-Qualification-Upstream-Status",
  stage: "X-Lattice-Qualification-Stage",
  callOrdinal: "X-Lattice-Qualification-Call-Ordinal",
  subtype: "X-Lattice-Qualification-Subtype",
  finishReason: "X-Lattice-Qualification-Finish-Reason",
  requestSize: "X-Lattice-Qualification-Request-Size",
  responseSize: "X-Lattice-Qualification-Response-Size",
  contentSize: "X-Lattice-Qualification-Content-Size",
  completionTokens: "X-Lattice-Qualification-Completion-Tokens",
  analysisOrigin: "X-Lattice-Qualification-Analysis-Origin",
  analysisAttempt: "X-Lattice-Qualification-Analysis-Attempt",
  priorValidationCategory: "X-Lattice-Qualification-Prior-Validation",
});

const JSON_CONTENT_TYPE = /^application\/json(?:\s*;\s*charset=utf-8)?$/iu;
const EXPLICIT_CALLER_CREDENTIAL_HEADERS = new Set([
  "apikey",
  "authorization",
  "cf-access-client-id",
  "cf-access-client-secret",
  "cf-access-jwt-assertion",
  "cookie2",
  "dpop",
  "proxy-authorization",
  "signature",
  "signature-input",
  "ssl-client-cert",
  "x-amz-security-token",
  "x-api-key",
  "x-auth-token",
  "x-client-cert",
  "x-forwarded-client-cert",
  "x-goog-api-key",
]);
const EXPLICIT_CALLER_CREDENTIAL_HEADER_PATTERN =
  /(?:^|-)(?:auth(?:entication|orization)?|cookies?|credentials?|password|private-key|secret|signature|tokens?)(?:-|$)|(?:^|-)api-?key(?:-|$)/u;
const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
});
const CONTENT_FREE_RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
});
const HELD_RESPONSE_HEADERS = Object.freeze({
  ...RESPONSE_HEADERS,
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
});
const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const LATTICE_PROVIDER_FAILURE_CLASS_SET = new Set(LATTICE_PROVIDER_FAILURE_CLASSES);
const LATTICE_PROVIDER_STAGE_SET = new Set(LATTICE_PROVIDER_STAGES);
const LATTICE_PROVIDER_MALFORMED_SUBTYPE_SET = new Set(LATTICE_PROVIDER_MALFORMED_SUBTYPES);
const LATTICE_PROVIDER_FINISH_REASON_SET = new Set(LATTICE_PROVIDER_FINISH_REASONS);
const LATTICE_PROVIDER_SIZE_BUCKET_SET = new Set(LATTICE_PROVIDER_SIZE_BUCKETS);
const LATTICE_PROVIDER_COMPLETION_TOKEN_BUCKET_SET = new Set(
  LATTICE_PROVIDER_COMPLETION_TOKEN_BUCKETS,
);
const LATTICE_PROVIDER_ANALYSIS_ORIGIN_SET = new Set(LATTICE_PROVIDER_ANALYSIS_ORIGINS);
const LATTICE_PROVIDER_ANALYSIS_ATTEMPT_SET = new Set(LATTICE_PROVIDER_ANALYSIS_ATTEMPTS);
const LATTICE_PROVIDER_ACTIVE_ANALYSIS_ATTEMPT_SET = new Set(["1", "2"]);
const LATTICE_ANALYSIS_VALIDATION_CATEGORY_SET = new Set(LATTICE_ANALYSIS_VALIDATION_CATEGORIES);

class LatticeApiError extends Error {
  constructor(status, code, retryAfterSeconds = null) {
    super(code);
    this.name = "LatticeApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

class LatticeQualificationExpiredError extends Error {
  constructor() {
    super("The Lattice qualification window expired.");
    this.name = "LatticeQualificationExpiredError";
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

function requestDeadline(
  request,
  milliseconds,
  qualificationWindow,
  scheduleTimeout,
  cancelTimeout,
) {
  const controller = new AbortController();
  const qualificationMilliseconds = qualificationWindow.expiresAt === null
    ? null
    : qualificationWindow.expiresAt - qualificationWindow.requestStartedAt;
  const endsAtQualificationExpiry = qualificationMilliseconds !== null
    && qualificationMilliseconds <= milliseconds;
  const deadlineMilliseconds = endsAtQualificationExpiry
    ? qualificationMilliseconds
    : milliseconds;
  let deadlineCause = null;
  const abortFromClient = () => controller.abort(request.signal.reason ?? abortError());
  if (request.signal.aborted) abortFromClient();
  else request.signal.addEventListener("abort", abortFromClient, { once: true });
  const timeout = scheduleTimeout(() => {
    deadlineCause = endsAtQualificationExpiry ? "qualification-expiry" : "request-timeout";
    const message = endsAtQualificationExpiry
      ? "The Lattice qualification window expired."
      : "The Lattice request timed out.";
    controller.abort(abortError(message));
  }, deadlineMilliseconds);
  return Object.freeze({
    signal: controller.signal,
    didQualificationExpire: () => deadlineCause === "qualification-expiry",
    didTimeOut: () => deadlineCause === "request-timeout",
    dispose() {
      cancelTimeout(timeout);
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

function qualificationHeldResponse() {
  return new Response(JSON.stringify({ error: "upstream_unavailable" }), {
    status: 503,
    headers: HELD_RESPONSE_HEADERS,
  });
}

function visitorSessionResponse() {
  return new Response(null, { status: 204, headers: CONTENT_FREE_RESPONSE_HEADERS });
}

export function qualificationWindowAllowsRequests(value, now = Date.now()) {
  return captureQualificationWindow(value, now).allowsRequests;
}

function captureQualificationWindow(value, requestStartedAt) {
  if (value === undefined) {
    return Object.freeze({ allowsRequests: true, expiresAt: null, requestStartedAt });
  }
  if (typeof value !== "string" || !CANONICAL_UTC_TIMESTAMP.test(value)
    || !Number.isFinite(requestStartedAt)) {
    return Object.freeze({ allowsRequests: false, expiresAt: null, requestStartedAt });
  }
  const expiresAt = new Date(value).valueOf();
  const isCanonical = Number.isFinite(expiresAt) && new Date(expiresAt).toISOString() === value;
  return Object.freeze({
    allowsRequests: isCanonical && requestStartedAt < expiresAt,
    expiresAt: isCanonical ? expiresAt : null,
    requestStartedAt,
  });
}

function qualificationWindowAllowsOutput(qualificationWindow, responseTime) {
  return qualificationWindow.expiresAt === null
    || (Number.isFinite(responseTime) && responseTime < qualificationWindow.expiresAt);
}

function assertRequestPhaseOpen(deadline, qualificationWindow, currentTime) {
  if (deadline.signal.aborted) {
    throw deadline.signal.reason ?? abortError();
  }
  if (!qualificationWindowAllowsOutput(qualificationWindow, currentTime)) {
    throw new LatticeQualificationExpiredError();
  }
}

function hasExplicitCallerCredentialHeader(headers) {
  for (const name of headers.keys()) {
    if (name === "cookie") continue;
    if (EXPLICIT_CALLER_CREDENTIAL_HEADERS.has(name)
      || EXPLICIT_CALLER_CREDENTIAL_HEADER_PATTERN.test(name)) {
      return true;
    }
  }
  return false;
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

async function requestBodyHasBytes(request, signal) {
  if (request.body === null) return false;
  let reader;
  try {
    reader = request.body.getReader();
    // Cloudflare can represent a zero-byte POST as a non-null, already-closing
    // stream. Inspect only until closure or the first actual payload byte.
    while (true) {
      const part = await raceAbort(reader.read(), signal);
      if (part.done) return false;
      if ((part.value?.byteLength ?? 0) > 0) return true;
    }
  } catch (error) {
    if (signal.aborted) throw signal.reason ?? error;
    return true;
  } finally {
    if (reader) {
      cancelReader(reader);
      try {
        reader.releaseLock();
      } catch {
        // The content-free body check has already settled.
      }
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
    case "provider_request_too_large":
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

function qualificationProviderDiagnostic(error) {
  const failureClass = error.code;
  const upstreamStatus = error.status === null ? "none" : `${error.status}`;
  const stage = error.qualificationStage;
  const callOrdinal = error.qualificationCallOrdinal;
  const subtype = error.qualificationSubtype;
  const finishReason = error.qualificationFinishReason;
  const requestSize = error.qualificationRequestSize;
  const responseSize = error.qualificationResponseSize;
  const contentSize = error.qualificationContentSize;
  const completionTokens = error.qualificationCompletionTokens;
  const analysisOrigin = error.qualificationAnalysisOrigin;
  const analysisAttempt = error.qualificationAnalysisAttempt;
  const priorValidationCategory = error.qualificationPriorValidationCategory;
  if (!LATTICE_PROVIDER_FAILURE_CLASS_SET.has(failureClass)
    || !(upstreamStatus === "none" || /^[45]\d{2}$/u.test(upstreamStatus))
    || !LATTICE_PROVIDER_STAGE_SET.has(stage)
    || !Number.isSafeInteger(callOrdinal)
    || callOrdinal < 1
    || callOrdinal > LATTICE_PROVIDER_CALL_LIMIT
    || !LATTICE_PROVIDER_MALFORMED_SUBTYPE_SET.has(subtype)
    || !LATTICE_PROVIDER_FINISH_REASON_SET.has(finishReason)
    || !LATTICE_PROVIDER_SIZE_BUCKET_SET.has(requestSize)
    || !LATTICE_PROVIDER_SIZE_BUCKET_SET.has(responseSize)
    || !LATTICE_PROVIDER_SIZE_BUCKET_SET.has(contentSize)
    || !LATTICE_PROVIDER_COMPLETION_TOKEN_BUCKET_SET.has(completionTokens)
    || !LATTICE_PROVIDER_ANALYSIS_ORIGIN_SET.has(analysisOrigin)
    || !LATTICE_PROVIDER_ANALYSIS_ATTEMPT_SET.has(analysisAttempt)
    || !LATTICE_ANALYSIS_VALIDATION_CATEGORY_SET.has(priorValidationCategory)
    || (failureClass === "provider_malformed_response" && subtype === "none")
    || (failureClass !== "provider_malformed_response" && subtype !== "none")
    || (failureClass === "provider_output_limit" && finishReason !== "length")
    || (stage === "analysis" && (
      analysisOrigin === "none"
      || !LATTICE_PROVIDER_ACTIVE_ANALYSIS_ATTEMPT_SET.has(analysisAttempt)
      || (analysisAttempt === "1" && priorValidationCategory !== "none")
      || (analysisAttempt === "2" && priorValidationCategory === "none")
    ))
    || (stage !== "analysis" && (
      analysisOrigin !== "none"
      || analysisAttempt !== "none"
      || priorValidationCategory !== "none"
    ))) {
    return null;
  }
  return Object.freeze({
    failureClass,
    upstreamStatus,
    stage,
    callOrdinal: `${callOrdinal}`,
    subtype,
    finishReason,
    requestSize,
    responseSize,
    contentSize,
    completionTokens,
    analysisOrigin,
    analysisAttempt,
    priorValidationCategory,
  });
}

function withQualificationProviderDiagnostic(response, error, enabled) {
  if (!enabled) return response;
  const diagnostic = qualificationProviderDiagnostic(error);
  if (diagnostic === null) return response;
  for (const [field, header] of Object.entries(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)) {
    response.headers.set(header, diagnostic[field]);
  }
  return response;
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
  admitTransformation = claimGlobalLatticeTransformation,
  establishVisitor = establishLatticeApiVisitor,
  resolveVisitor = resolveLatticeApiVisitor,
  now = Date.now,
  scheduleTimeout = setTimeout,
  cancelTimeout = clearTimeout,
} = {}) {
  if (typeof runTextToLatticeImpl !== "function" || typeof preflightLatticeInputImpl !== "function"
    || typeof createAdapter !== "function" || typeof fetchImpl !== "function"
    || !Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs <= 0
    || !Number.isSafeInteger(requestByteLimit) || requestByteLimit <= 0
    || !Number.isSafeInteger(responseByteLimit) || responseByteLimit <= 0
    || typeof enforceRateLimit !== "function"
    || typeof admitTransformation !== "function"
    || typeof establishVisitor !== "function"
    || typeof resolveVisitor !== "function"
    || typeof now !== "function"
    || typeof scheduleTimeout !== "function"
    || typeof cancelTimeout !== "function") {
    throw new TypeError("The Lattice API worker received an invalid server configuration.");
  }

  return Object.freeze({
    async fetch(request, env = {}) {
      const qualificationWindow = captureQualificationWindow(
        env[LATTICE_QUALIFICATION_EXPIRES_AT_BINDING],
        now(),
      );
      if (!qualificationWindow.allowsRequests) return qualificationHeldResponse();
      const qualificationDiagnosticRequested = qualificationWindow.expiresAt !== null
        && request.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER)
          === LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE;

      let url;
      try {
        url = new URL(request.url);
      } catch {
        return errorResponse(400, "invalid_request");
      }
      if (url.href !== `${LATTICE_API_ORIGIN}${LATTICE_API_PATH}`) {
        return errorResponse(404, "invalid_request");
      }
      if (hasExplicitCallerCredentialHeader(request.headers)) {
        return errorResponse(403, "invalid_request");
      }
      if (request.method !== "POST") {
        const response = errorResponse(405, "invalid_request");
        response.headers.set("Allow", "POST");
        return response;
      }
      if (request.headers.get("origin") !== LATTICE_API_ORIGIN) {
        return errorResponse(403, "invalid_request");
      }
      const isVisitorSessionSetup = request.headers.get("accept") === LATTICE_VISITOR_SESSION_ACCEPT;
      if (isVisitorSessionSetup && request.headers.has("content-type")) {
        return errorResponse(400, "invalid_request");
      }
      if (!isVisitorSessionSetup && request.headers.get("accept") !== "application/json") {
        return errorResponse(400, "invalid_request");
      }
      if (!isVisitorSessionSetup
        && !JSON_CONTENT_TYPE.test(request.headers.get("content-type") ?? "")) {
        return errorResponse(415, "unsupported_media_type");
      }

      const deadline = requestDeadline(
        request,
        requestTimeoutMs,
        qualificationWindow,
        scheduleTimeout,
        cancelTimeout,
      );
      let visitorCookieValue = null;
      let response;
      try {
        if (isVisitorSessionSetup) {
          if (await requestBodyHasBytes(request, deadline.signal)) {
            throw apiError(400, "invalid_request");
          }
          let visitor;
          try {
            assertRequestPhaseOpen(deadline, qualificationWindow, now());
            visitor = await raceAbort(
              establishVisitor(request.headers, env.VISITOR_COOKIE_SECRET),
              deadline.signal,
            );
          } catch (error) {
            if (error instanceof LatticeApiVisitorCookieError) {
              throw apiError(403, "invalid_request");
            }
            throw error;
          }
          if (visitor === null
            || typeof visitor !== "object"
            || Array.isArray(visitor)
            || Object.keys(visitor).length !== 2
            || typeof visitor.visitorId !== "string"
            || typeof visitor.cookieValue !== "string") {
            throw apiError(500, "internal_error");
          }
          visitorCookieValue = visitor.cookieValue;
          response = visitorSessionResponse();
          const responseTime = now();
          assertRequestPhaseOpen(deadline, qualificationWindow, responseTime);
          return withLatticeApiVisitorCookie(response, visitorCookieValue, responseTime);
        }

        if (!request.headers.has("cookie")) {
          throw apiError(428, "visitor_session_required");
        }
        let visitor;
        try {
          assertRequestPhaseOpen(deadline, qualificationWindow, now());
          visitor = await raceAbort(
            resolveVisitor(request.headers, env.VISITOR_COOKIE_SECRET),
            deadline.signal,
          );
        } catch (error) {
          if (error instanceof LatticeApiVisitorCookieError) {
            throw apiError(403, "invalid_request");
          }
          throw error;
        }
        if (visitor === null) {
          throw apiError(428, "visitor_session_required");
        }
        if (typeof visitor !== "object"
          || Array.isArray(visitor)
          || Object.keys(visitor).length !== 2
          || typeof visitor.visitorId !== "string"
          || typeof visitor.cookieValue !== "string") {
          throw apiError(500, "internal_error");
        }

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

        assertRequestPhaseOpen(deadline, qualificationWindow, now());
        await raceAbort(enforceRateLimit(env.LATTICE_API_RATE_LIMITER), deadline.signal);

        assertRequestPhaseOpen(deadline, qualificationWindow, now());
        if (typeof env.HF_TOKEN !== "string" || !env.HF_TOKEN.trim()) {
          throw apiError(500, "internal_error");
        }
        let admission;
        try {
          assertRequestPhaseOpen(deadline, qualificationWindow, now());
          admission = await raceAbort(admitTransformation(
            env.LATTICE_TRANSFORMATION_BUDGET,
            visitor.visitorId,
            deadline.signal,
          ), deadline.signal);
        } catch (error) {
          if (deadline.signal.aborted) throw error;
          throw apiError(500, "internal_error");
        }
        if (admission === null
          || typeof admission !== "object"
          || Array.isArray(admission)
          || Object.keys(admission).length !== 2
          || typeof admission.allowed !== "boolean"
          || !Object.prototype.hasOwnProperty.call(admission, "retryAfterSeconds")
          || (admission.allowed && admission.retryAfterSeconds !== null)
          || (!admission.allowed && admission.retryAfterSeconds !== null
            && (!Number.isSafeInteger(admission.retryAfterSeconds)
              || admission.retryAfterSeconds < 1
              || admission.retryAfterSeconds > 300))) {
          throw apiError(500, "internal_error");
        }
        if (!admission.allowed) {
          throw apiError(429, "rate_limited", admission.retryAfterSeconds);
        }

        assertRequestPhaseOpen(deadline, qualificationWindow, now());
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
        assertRequestPhaseOpen(deadline, qualificationWindow, now());
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
        assertRequestPhaseOpen(deadline, qualificationWindow, now());
        response = new Response(responseBody, { status: 200, headers: RESPONSE_HEADERS });
      } catch (error) {
        if (deadline.didQualificationExpire()
          || error instanceof LatticeQualificationExpiredError) {
          response = qualificationHeldResponse();
        } else if (deadline.didTimeOut()) {
          response = errorResponse(504, "upstream_timeout");
        } else if (error instanceof LatticeApiError) {
          response = errorResponse(error.status, error.code, error.retryAfterSeconds);
        } else if (error instanceof LatticeProviderError) {
          response = withQualificationProviderDiagnostic(
            safeProviderResponse(error),
            error,
            qualificationDiagnosticRequested
              && qualificationWindowAllowsOutput(qualificationWindow, now()),
          );
        } else if (deadline.signal.aborted) {
          response = errorResponse(400, "invalid_request");
        } else {
          response = errorResponse(500, "internal_error");
        }
      } finally {
        deadline.dispose();
      }
      return response;
    },
  });
}

const latticeApiWorker = createLatticeApiWorker();

export default latticeApiWorker;
