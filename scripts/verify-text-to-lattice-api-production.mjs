import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  LATTICE_API_ERROR_CODES,
  LATTICE_API_PATH,
  LATTICE_API_SCHEMA_VERSION,
  LATTICE_RESULT_VERSION,
  LATTICE_VISITOR_SESSION_ACCEPT,
  exactRecord,
  isLatticeApiError,
  isLatticeApiResult,
} from "../app/resume/lattice/remoteProtocol.js";
import {
  HUGGING_FACE_CHAT_COMPLETIONS_URL,
  LATTICE_PROVIDER_CALL_LIMIT,
  LATTICE_PROVIDER_CALL_TIMEOUT_MS,
  LATTICE_PROVIDER_REQUEST_BYTE_LIMIT,
  LATTICE_PROVIDER_RESPONSE_BYTE_LIMIT,
  LATTICE_REMOTE_MODELS,
} from "../workers/text-to-lattice-api/huggingFaceAdapter.js";
import {
  LATTICE_API_ORIGIN,
  LATTICE_API_REQUEST_BYTE_LIMIT,
  LATTICE_API_REQUEST_TIMEOUT_MS,
  LATTICE_API_RESPONSE_BYTE_LIMIT,
} from "../workers/text-to-lattice-api/worker.js";
import {
  LATTICE_TRANSFORMATIONS_PER_UTC_DAY,
  LATTICE_TRANSFORMATIONS_PER_VISITOR_UTC_DAY,
} from "../workers/text-to-lattice-api/capacityPolicy.js";
import {
  LATTICE_API_VISITOR_COOKIE_MAX_AGE_SECONDS,
  LATTICE_API_VISITOR_COOKIE_NAME,
  LATTICE_API_VISITOR_COOKIE_PATH,
} from "../workers/text-to-lattice-api/visitorCookie.js";
import {
  TEXT_TO_LATTICE_DOCUMENT_POLICY,
} from "../workers/text-to-lattice-response-policy/worker.js";

export const LATTICE_PRODUCTION_EVIDENCE_SCHEMA =
  "TEXT_TO_LATTICE_REMOTE_DEPLOYMENT_EVIDENCE";

const API_RESPONSE_LIMIT = LATTICE_API_RESPONSE_BYTE_LIMIT;
const ERROR_RESPONSE_LIMIT = 4_096;
const PAGE_RESPONSE_LIMIT = 2 * 1024 * 1024;
const NEGATIVE_PROBE_TIMEOUT_MS = 15_000;
const CANARY_TIMEOUT_MS = 255_000;
export const LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT = LATTICE_VISITOR_SESSION_ACCEPT;
const SYNTHETIC_NEGATIVE_MARKER = "lattice-live-negative-canary-2026-09-14";
const SYNTHETIC_CANARY_TEXT =
  "A visitor places a blue notebook on the desk, reads the first page, and closes it.";
const DOCUMENT_PATHS = Object.freeze([
  "/",
  "/index.html",
  "/resume/",
  "/resume/index.html",
]);
const EXPECTED_API_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
});
const BROWSER_NAVIGATION_HEADERS = Object.freeze({
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15",
});

function fail(message) {
  throw new Error(`Text to Lattice live API verification failed: ${message}`);
}

function jsonBody(value) {
  return JSON.stringify(value);
}

function apiPost(body, {
  contentType = "application/json",
  headers = {},
  origin = LATTICE_API_ORIGIN,
  raw = false,
} = {}) {
  const requestHeaders = {
    Accept: "application/json",
    ...headers,
  };
  if (contentType !== null) requestHeaders["Content-Type"] = contentType;
  if (origin !== null) requestHeaders.Origin = origin;
  return Object.freeze({
    method: "POST",
    headers: requestHeaders,
    body: raw ? body : jsonBody(body),
  });
}

function visitorSessionPost() {
  return Object.freeze({
    method: "POST",
    headers: Object.freeze({
      Accept: LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT,
      Origin: LATTICE_API_ORIGIN,
    }),
  });
}

function credentialProbe(name) {
  return apiPost("{", {
    headers: { [name]: "synthetic-credential" },
    raw: true,
  });
}

function exactPayload(text = SYNTHETIC_NEGATIVE_MARKER) {
  return Object.freeze({
    text,
    requested_mode: "operative",
    schema_version: LATTICE_API_SCHEMA_VERSION,
  });
}

const NEGATIVE_PROBES = Object.freeze([
  Object.freeze({
    id: "wrong-path",
    pathname: `${LATTICE_API_PATH}/undeclared`,
    init: Object.freeze({ method: "GET", headers: { Accept: "application/json" } }),
    status: 404,
    apiJson: false,
  }),
  Object.freeze({
    id: "wrong-query",
    pathname: `${LATTICE_API_PATH}?undeclared=1`,
    init: apiPost(exactPayload()),
    status: 404,
    error: "invalid_request",
  }),
  Object.freeze({
    id: "wrong-method",
    pathname: LATTICE_API_PATH,
    init: Object.freeze({ method: "GET", headers: { Accept: "application/json" } }),
    status: 405,
    error: "invalid_request",
    allow: "POST",
  }),
  Object.freeze({
    id: "missing-origin",
    pathname: LATTICE_API_PATH,
    init: apiPost(exactPayload(), { origin: null }),
    status: 403,
    error: "invalid_request",
  }),
  Object.freeze({
    id: "wrong-origin",
    pathname: LATTICE_API_PATH,
    init: apiPost(exactPayload(), { origin: "https://attacker.invalid" }),
    status: 403,
    error: "invalid_request",
  }),
  Object.freeze({
    id: "missing-visitor-session",
    pathname: LATTICE_API_PATH,
    init: apiPost(exactPayload()),
    status: 428,
    error: "visitor_session_required",
    visitorCookie: false,
  }),
  Object.freeze({
    id: "wrong-media-type",
    pathname: LATTICE_API_PATH,
    init: apiPost(SYNTHETIC_NEGATIVE_MARKER, { contentType: "text/plain", raw: true }),
    status: 415,
    error: "unsupported_media_type",
  }),
  Object.freeze({
    id: "malformed-json",
    pathname: LATTICE_API_PATH,
    init: apiPost("{", { raw: true }),
    status: 400,
    error: "invalid_request",
  }),
  Object.freeze({
    id: "missing-text",
    pathname: LATTICE_API_PATH,
    init: apiPost({ requested_mode: "operative", schema_version: LATTICE_API_SCHEMA_VERSION }),
    status: 400,
    error: "invalid_request",
  }),
  Object.freeze({
    id: "missing-requested-mode",
    pathname: LATTICE_API_PATH,
    init: apiPost({ text: SYNTHETIC_NEGATIVE_MARKER, schema_version: LATTICE_API_SCHEMA_VERSION }),
    status: 400,
    error: "invalid_request",
  }),
  Object.freeze({
    id: "missing-schema-version",
    pathname: LATTICE_API_PATH,
    init: apiPost({ text: SYNTHETIC_NEGATIVE_MARKER, requested_mode: "operative" }),
    status: 400,
    error: "invalid_request",
  }),
  Object.freeze({
    id: "additional-field",
    pathname: LATTICE_API_PATH,
    init: apiPost({ ...exactPayload(), undeclared: true }),
    status: 400,
    error: "invalid_request",
  }),
  Object.freeze({
    id: "invalid-text-type",
    pathname: LATTICE_API_PATH,
    init: apiPost({ ...exactPayload(), text: 42 }),
    status: 400,
    error: "invalid_request",
  }),
  Object.freeze({
    id: "invalid-mode",
    pathname: LATTICE_API_PATH,
    init: apiPost({ ...exactPayload(), requested_mode: "interpretive" }),
    status: 400,
    error: "invalid_request",
  }),
  Object.freeze({
    id: "invalid-schema-version",
    pathname: LATTICE_API_PATH,
    init: apiPost({ ...exactPayload(), schema_version: 2 }),
    status: 400,
    error: "invalid_request",
  }),
  Object.freeze({
    id: "credential-cookie",
    pathname: LATTICE_API_PATH,
    init: apiPost(exactPayload(), {
      headers: { Cookie: "synthetic-credential" },
    }),
    status: 403,
    error: "invalid_request",
  }),
  ...[
    ["authorization", "Authorization"],
    ["proxy-authorization", "Proxy-Authorization"],
    ["api-key", "X-Api-Key"],
    ["auth-token", "X-Auth-Token"],
    ["message-signature", "Signature-Input"],
  ].map(([id, name]) => Object.freeze({
    id: `credential-${id}`,
    pathname: LATTICE_API_PATH,
    init: credentialProbe(name),
    status: 403,
    error: "invalid_request",
  })),
  Object.freeze({
    id: "word-limit-701",
    pathname: LATTICE_API_PATH,
    init: apiPost(exactPayload(Array.from({ length: 701 }, () => "word").join(" "))),
    status: 413,
    error: "input_too_large",
  }),
  Object.freeze({
    id: "request-byte-limit",
    pathname: LATTICE_API_PATH,
    init: apiPost(exactPayload("x".repeat(66_000))),
    status: 413,
    error: "input_too_large",
  }),
]);

export const LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS = Object.freeze(
  NEGATIVE_PROBES.map(({ id }) => id),
);
export const LATTICE_PRODUCTION_NEGATIVE_PROBE_CONTRACT = Object.freeze(
  NEGATIVE_PROBES.map(({ id, status, error, apiJson = true, allow = null }) => Object.freeze({
    id,
    status,
    error: error ?? null,
    apiJson,
    allow,
  })),
);

function assertOrigin(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail("the production origin is invalid");
  }
  if (parsed.origin !== value || value !== LATTICE_API_ORIGIN) {
    fail(`the exact ${LATTICE_API_ORIGIN} production origin is required`);
  }
  return value;
}

function safeContext(context) {
  const commit = `${context?.commit ?? ""}`;
  const runId = `${context?.runId ?? ""}`;
  const runAttempt = `${context?.runAttempt ?? ""}`;
  const job = `${context?.job ?? ""}`;
  const repository = `${context?.repository ?? ""}`;
  const serverUrl = `${context?.serverUrl ?? ""}`;
  if (!/^[a-f0-9]{40}$/u.test(commit)
    || !/^[1-9]\d*$/u.test(runId)
    || !/^[1-9]\d*$/u.test(runAttempt)
    || !/^[A-Za-z0-9_-]{1,100}$/u.test(job)
    || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)
    || !/^https:\/\/[A-Za-z0-9.-]+$/u.test(serverUrl)) {
    fail("the deployment evidence context is incomplete or malformed");
  }
  return Object.freeze({ commit, runId, runAttempt, job, repository, serverUrl });
}

function responseHeader(response, name, label) {
  const value = response.headers.get(name);
  if (!value) fail(`${label} omitted ${name}`);
  return value;
}

function quotaCookie(response, label) {
  const header = response.headers.get("set-cookie");
  if (header === null) fail(`${label} omitted the browser quota cookie`);
  const escapedName = LATTICE_API_VISITOR_COOKIE_NAME.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const escapedPath = LATTICE_API_VISITOR_COOKIE_PATH.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = header.match(new RegExp(
    `^${escapedName}=v1\\.[A-Za-z0-9_-]{24}\\.[A-Za-z0-9_-]{43}; Max-Age=([1-9][0-9]{0,4}); Path=${escapedPath}; Secure; HttpOnly; SameSite=Strict$`,
    "u",
  ));
  const maxAgeSeconds = Number(match?.[1]);
  if (!match || !Number.isSafeInteger(maxAgeSeconds)
    || maxAgeSeconds < 1 || maxAgeSeconds > LATTICE_API_VISITOR_COOKIE_MAX_AGE_SECONDS) {
    fail(`${label} returned an invalid browser quota cookie`);
  }
  return Object.freeze({
    requestHeader: header.slice(0, header.indexOf(";")),
    metadata: Object.freeze({
      name: LATTICE_API_VISITOR_COOKIE_NAME,
      path: LATTICE_API_VISITOR_COOKIE_PATH,
      max_age_seconds: maxAgeSeconds,
      secure: true,
      http_only: true,
      same_site: "Strict",
      domain_attribute_present: false,
      value_recorded: false,
    }),
  });
}

function assertApiHeaders(response, label, {
  contentType = "application/json; charset=utf-8",
  quotaCookie: expectedQuotaCookie = "absent",
} = {}) {
  for (const [name, expected] of Object.entries(EXPECTED_API_HEADERS)) {
    const actual = responseHeader(response, name, label);
    if (actual.toLowerCase() !== expected) fail(`${label} returned an invalid ${name}`);
  }
  if (response.headers.has("access-control-allow-origin")) {
    fail(`${label} exposed a cross-origin response allowance`);
  }
  if (contentType === null) {
    if (response.headers.has("content-type")) fail(`${label} set an undeclared content-type`);
  } else if (responseHeader(response, "content-type", label).toLowerCase() !== contentType) {
    fail(`${label} returned an invalid content-type`);
  }
  if (expectedQuotaCookie === "required") return quotaCookie(response, label);
  if (response.headers.has("set-cookie")) fail(`${label} set an undeclared cookie`);
  return null;
}

async function boundedBytes(response, maximumBytes, label) {
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) > maximumBytes)) {
    await response.body?.cancel().catch(() => {});
    fail(`${label} exceeded its response-size boundary`);
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => {});
        fail(`${label} exceeded its response-size boundary`);
      }
      chunks.push(part.value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // The bounded read has already settled.
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function utf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`${label} did not return UTF-8`);
  }
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(utf8(bytes, label));
  } catch {
    fail(`${label} did not return JSON`);
  }
}

function elapsedMilliseconds(startedAt, monotonicNow, label) {
  const finishedAt = monotonicNow();
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt) {
    fail(`${label} produced an invalid elapsed-time measurement`);
  }
  return Math.round(finishedAt - startedAt);
}

async function fetchOnce(fetchImpl, url, init, timeoutMs, label) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...init,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    fail(`${label} could not reach the deployed boundary`);
  }
  if (!(response instanceof Response)) fail(`${label} returned an invalid response`);
  return response;
}

async function verifyDocumentPolicies(origin, fetchImpl, monotonicNow) {
  const evidence = [];
  for (const pathname of DOCUMENT_PATHS) {
    const label = `document policy ${pathname}`;
    const startedAt = monotonicNow();
    const response = await fetchOnce(
      fetchImpl,
      `${origin}${pathname}`,
      { method: "GET", headers: BROWSER_NAVIGATION_HEADERS },
      NEGATIVE_PROBE_TIMEOUT_MS,
      label,
    );
    if (response.status !== 200) fail(`${label} returned HTTP ${response.status}`);
    const policy = responseHeader(response, "content-security-policy", label);
    if (policy !== TEXT_TO_LATTICE_DOCUMENT_POLICY["Content-Security-Policy"]) {
      await response.body?.cancel().catch(() => {});
      fail(`${label} returned an unexpected Content-Security-Policy`);
    }
    if (responseHeader(response, "permissions-policy", label)
      !== TEXT_TO_LATTICE_DOCUMENT_POLICY["Permissions-Policy"]) {
      await response.body?.cancel().catch(() => {});
      fail(`${label} returned an unexpected Permissions-Policy`);
    }
    const cacheTokens = responseHeader(response, "cache-control", label)
      .toLowerCase()
      .split(/\s*,\s*/u);
    if (!cacheTokens.includes("no-transform")) {
      await response.body?.cancel().catch(() => {});
      fail(`${label} omitted Cache-Control: no-transform`);
    }
    const bytes = await boundedBytes(response, PAGE_RESPONSE_LIMIT, label);
    const source = utf8(bytes, label);
    if (/static\.cloudflareinsights\.com\/beacon\.min\.js|data-cf-beacon|\/cdn-cgi\/rum/iu.test(source)) {
      fail(`${label} contains an injected analytics marker`);
    }
    evidence.push(Object.freeze({
      path: pathname,
      status: response.status,
      elapsed_ms: elapsedMilliseconds(startedAt, monotonicNow, label),
      response_bytes: bytes.byteLength,
      connect_src: Object.freeze(["'self'"]),
      analytics_markers_absent: true,
    }));
  }
  return Object.freeze(evidence);
}

function withVisitorCookie(init, visitorCookieHeader) {
  const headers = { ...init.headers };
  if (!Object.keys(headers).some((name) => name.toLowerCase() === "cookie")) {
    headers.Cookie = visitorCookieHeader;
  }
  return Object.freeze({ ...init, headers: Object.freeze(headers) });
}

async function verifyVisitorSessionSetup(origin, fetchImpl, monotonicNow) {
  const label = "content-free visitor-session setup";
  const startedAt = monotonicNow();
  const response = await fetchOnce(
    fetchImpl,
    `${origin}${LATTICE_API_PATH}`,
    visitorSessionPost(),
    NEGATIVE_PROBE_TIMEOUT_MS,
    label,
  );
  if (response.status !== 204) {
    await response.body?.cancel().catch(() => {});
    fail(`${label} returned HTTP ${response.status}; expected 204`);
  }
  const cookie = assertApiHeaders(response, label, {
    contentType: null,
    quotaCookie: "required",
  });
  const bytes = await boundedBytes(response, ERROR_RESPONSE_LIMIT, label);
  if (bytes.byteLength !== 0) fail(`${label} returned an undeclared response body`);
  return Object.freeze({
    requestHeader: cookie.requestHeader,
    evidence: Object.freeze({
      request_count: 1,
      automatic_retry: false,
      method: "POST",
      path: LATTICE_API_PATH,
      accept: LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT,
      content_type_header_present: false,
      request_body_present: false,
      request_body_bytes: 0,
      elapsed_ms: elapsedMilliseconds(startedAt, monotonicNow, label),
      http_status: response.status,
      response_body_present: false,
      response_body_bytes: 0,
      browser_quota: cookie.metadata,
    }),
  });
}

async function verifyNegativeProbes(origin, fetchImpl, monotonicNow, visitorCookieHeader) {
  const evidence = [];
  for (const probe of NEGATIVE_PROBES) {
    const label = `negative probe ${probe.id}`;
    const startedAt = monotonicNow();
    const response = await fetchOnce(
      fetchImpl,
      `${origin}${probe.pathname}`,
      probe.visitorCookie === false
        ? probe.init
        : withVisitorCookie(probe.init, visitorCookieHeader),
      NEGATIVE_PROBE_TIMEOUT_MS,
      label,
    );
    if (response.status !== probe.status) {
      await response.body?.cancel().catch(() => {});
      fail(`${label} returned HTTP ${response.status}; expected ${probe.status}`);
    }
    if (probe.apiJson === false) {
      const bytes = await boundedBytes(response, PAGE_RESPONSE_LIMIT, label);
      if (utf8(bytes, label).includes(SYNTHETIC_NEGATIVE_MARKER)) {
        fail(`${label} reflected the synthetic marker`);
      }
      evidence.push(Object.freeze({
        id: probe.id,
        status: response.status,
        api_json: false,
        elapsed_ms: elapsedMilliseconds(startedAt, monotonicNow, label),
        response_bytes: bytes.byteLength,
      }));
      continue;
    }

    assertApiHeaders(response, label);
    const bytes = await boundedBytes(response, ERROR_RESPONSE_LIMIT, label);
    const source = utf8(bytes, label);
    if (source.includes(SYNTHETIC_NEGATIVE_MARKER)
      || source.includes("synthetic-credential")) {
      fail(`${label} reflected probe content`);
    }
    const body = parseJson(bytes, label);
    if (!isLatticeApiError(body)
      || !exactRecord(body, ["error"])
      || body.error !== probe.error
      || !LATTICE_API_ERROR_CODES.includes(body.error)) {
      fail(`${label} returned an unexpected closed error envelope`);
    }
    if (probe.allow !== undefined) {
      if (response.headers.get("allow") !== probe.allow) fail(`${label} returned an invalid Allow header`);
    } else if (response.headers.has("allow")) {
      fail(`${label} returned an undeclared Allow header`);
    }
    evidence.push(Object.freeze({
      id: probe.id,
      status: response.status,
      error: body.error,
      elapsed_ms: elapsedMilliseconds(startedAt, monotonicNow, label),
      response_bytes: bytes.byteLength,
      no_store: true,
      non_reflective: true,
    }));
  }
  return Object.freeze(evidence);
}

async function verifyTransformationCanary(origin, fetchImpl, monotonicNow, visitorCookieHeader) {
  const label = "synthetic transformation canary";
  const startedAt = monotonicNow();
  const response = await fetchOnce(
    fetchImpl,
    `${origin}${LATTICE_API_PATH}`,
    withVisitorCookie(apiPost(exactPayload(SYNTHETIC_CANARY_TEXT)), visitorCookieHeader),
    CANARY_TIMEOUT_MS,
    label,
  );
  assertApiHeaders(response, label);
  const bytes = await boundedBytes(response, API_RESPONSE_LIMIT, label);
  const envelope = parseJson(bytes, label);
  if (response.status !== 200) {
    const code = isLatticeApiError(envelope) ? envelope.error : "invalid_response";
    fail(`${label} returned HTTP ${response.status} (${code})`);
  }
  if (!exactRecord(envelope, ["result", "schema_version"])
    || envelope.schema_version !== LATTICE_API_SCHEMA_VERSION
    || !isLatticeApiResult(envelope.result)) {
    fail(`${label} returned an invalid strict result envelope`);
  }
  if (envelope.result.status === "unable-to-attempt") {
    fail(`${label} did not reach a non-error terminal transformation result`);
  }
  return Object.freeze({
    request_count: 1,
    automatic_retry: false,
    elapsed_ms: elapsedMilliseconds(startedAt, monotonicNow, label),
    response_bytes: bytes.byteLength,
    input_id: "synthetic-notebook-v1",
    input_content_recorded: false,
    result_content_recorded: false,
    http_status: response.status,
    schema_version: envelope.schema_version,
    result_version: envelope.result.version,
    terminal_status: envelope.result.status,
    primary_layer: envelope.result.primaryLayer,
    layers_used: Object.freeze([...envelope.result.layersUsed]),
    word_count: envelope.result.wordCount,
    passage_count: envelope.result.passageCount,
    finding_count: envelope.result.findings.length,
    question_count: envelope.result.questions.length,
    strict_result_valid: true,
    browser_quota_cookie_sent: true,
    browser_quota_cookie_value_recorded: false,
    set_cookie_header_present: false,
    browser_quota_cookie_rotated: false,
  });
}

export function serializeLatticeProductionEvidence(evidence) {
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  const payloadSha256 = createHash("sha256").update(serialized).digest("hex");
  return Object.freeze({
    payload: Object.freeze({ ...evidence }),
    payloadSha256,
    serialized,
  });
}

export async function verifyTextToLatticeApiProduction({
  origin = LATTICE_API_ORIGIN,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  monotonicNow = () => performance.now(),
  context,
} = {}) {
  if (typeof fetchImpl !== "function" || typeof now !== "function"
    || typeof monotonicNow !== "function") {
    throw new TypeError("The live API verifier received an invalid dependency.");
  }
  const exactOrigin = assertOrigin(origin);
  const deployment = safeContext(context);
  const verifiedAt = now();
  if (!(verifiedAt instanceof Date) || Number.isNaN(verifiedAt.valueOf())) {
    fail("the verification timestamp is invalid");
  }

  const documentPolicies = await verifyDocumentPolicies(exactOrigin, fetchImpl, monotonicNow);
  const visitorSession = await verifyVisitorSessionSetup(exactOrigin, fetchImpl, monotonicNow);
  const negativeProbes = await verifyNegativeProbes(
    exactOrigin,
    fetchImpl,
    monotonicNow,
    visitorSession.requestHeader,
  );
  const transformationCanary = await verifyTransformationCanary(
    exactOrigin,
    fetchImpl,
    monotonicNow,
    visitorSession.requestHeader,
  );
  const runUrl = `${deployment.serverUrl}/${deployment.repository}/actions/runs/${deployment.runId}`;

  const evidence = Object.freeze({
    format: LATTICE_PRODUCTION_EVIDENCE_SCHEMA,
    schemaVersion: 1,
    verified_at: verifiedAt.toISOString(),
    deployment: Object.freeze({
      repository: deployment.repository,
      run_url: runUrl,
      run_attempt: Number(deployment.runAttempt),
      job: deployment.job,
      commit: deployment.commit,
    }),
    boundary: Object.freeze({
      origin: exactOrigin,
      path: LATTICE_API_PATH,
      method: "POST",
      request_schema_version: LATTICE_API_SCHEMA_VERSION,
      response_result_version: LATTICE_RESULT_VERSION,
      application_content_recorded: false,
    }),
    declared_provider_contract: Object.freeze({
      endpoint: HUGGING_FACE_CHAT_COMPLETIONS_URL,
      generator_model: LATTICE_REMOTE_MODELS.generator,
      verifier_model: LATTICE_REMOTE_MODELS.verifier,
      automatic_retry: false,
      alternate_provider_or_model_fallback: false,
    }),
    declared_hard_limits: Object.freeze({
      api_request_timeout_ms: LATTICE_API_REQUEST_TIMEOUT_MS,
      api_request_bytes: LATTICE_API_REQUEST_BYTE_LIMIT,
      api_response_bytes: LATTICE_API_RESPONSE_BYTE_LIMIT,
      provider_call_timeout_ms: LATTICE_PROVIDER_CALL_TIMEOUT_MS,
      provider_request_bytes: LATTICE_PROVIDER_REQUEST_BYTE_LIMIT,
      provider_response_bytes: LATTICE_PROVIDER_RESPONSE_BYTE_LIMIT,
      provider_calls_per_request: LATTICE_PROVIDER_CALL_LIMIT,
      accepted_transformations_per_utc_day: LATTICE_TRANSFORMATIONS_PER_UTC_DAY,
      accepted_transformations_per_cooperating_ordinary_persistent_browser_cookie_jar_utc_day:
        LATTICE_TRANSFORMATIONS_PER_VISITOR_UTC_DAY,
      maximum_provider_calls_from_accepted_transformations_per_utc_day:
        LATTICE_TRANSFORMATIONS_PER_UTC_DAY * LATTICE_PROVIDER_CALL_LIMIT,
    }),
    document_policy: Object.freeze({
      exact_connect_src: Object.freeze(["'self'"]),
      paths: documentPolicies,
    }),
    negative_probes: Object.freeze({
      count: negativeProbes.length,
      all_rejected: true,
      raw_request_or_response_content_recorded: false,
      outcomes: negativeProbes,
    }),
    visitor_session_setup: visitorSession.evidence,
    transformation_canary: transformationCanary,
  });

  if (JSON.stringify(evidence).includes(SYNTHETIC_CANARY_TEXT)
    || JSON.stringify(evidence).includes(SYNTHETIC_NEGATIVE_MARKER)
    || JSON.stringify(evidence).includes("synthetic-credential")) {
    fail("the evidence receipt contains probe content");
  }
  return evidence;
}

async function main() {
  const evidencePath = process.env.LATTICE_API_EVIDENCE_PATH;
  if (typeof evidencePath !== "string" || !isAbsolute(evidencePath)) {
    fail("LATTICE_API_EVIDENCE_PATH must be an absolute path");
  }
  const evidence = await verifyTextToLatticeApiProduction({
    origin: process.env.LATTICE_API_BASE_URL,
    context: {
      commit: process.env.GITHUB_SHA,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      job: process.env.GITHUB_JOB,
      repository: process.env.GITHUB_REPOSITORY,
      serverUrl: process.env.GITHUB_SERVER_URL,
    },
  });
  const serialized = serializeLatticeProductionEvidence(evidence);
  const resolvedEvidencePath = resolve(evidencePath);
  await mkdir(dirname(resolvedEvidencePath), { recursive: true });
  await writeFile(resolvedEvidencePath, serialized.serialized, { encoding: "utf8", mode: 0o600 });
  await writeFile(
    `${resolvedEvidencePath}.sha256`,
    `${serialized.payloadSha256}  ${basename(resolvedEvidencePath)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  process.stdout.write(`Text to Lattice live API verified; sanitized evidence SHA-256 ${serialized.payloadSha256}.\n`);
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) await main();
