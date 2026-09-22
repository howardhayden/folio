import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { preflightLatticeInput } from "../app/resume/latticeDemo.js";
import {
  LATTICE_RESULT_VERSION,
  LATTICE_VISITOR_SESSION_ACCEPT,
  isLatticeApiError,
} from "../app/resume/lattice/remoteProtocol.js";
import {
  DOCUMENT_CERTIFICATION_SCHEMA,
  REANALYSIS_SCHEMA,
} from "../app/resume/lattice/promptContract.js";
import {
  HUGGING_FACE_CHAT_COMPLETIONS_URL,
  LATTICE_PROVIDER_CALL_LIMIT,
  LATTICE_PROVIDER_FAILURE_CLASSES,
  LATTICE_PROVIDER_REQUEST_BYTE_LIMIT,
  LATTICE_REMOTE_MODELS,
  LATTICE_PROVIDER_STAGES,
  LatticeProviderError,
  createHuggingFaceLatticeAdapter,
  requestHuggingFaceJson,
} from "../workers/text-to-lattice-api/huggingFaceAdapter.js";
import {
  LATTICE_TRANSFORMATION_CAPACITY_INTERNAL_URL,
  LATTICE_TRANSFORMATION_CAPACITY_OBJECT_NAME,
  LATTICE_TRANSFORMATION_VISITOR_HEADER,
  claimGlobalLatticeTransformation,
} from "../workers/text-to-lattice-api/capacityClient.js";
import {
  LATTICE_TRANSFORMATIONS_PER_UTC_DAY,
  LATTICE_TRANSFORMATIONS_PER_VISITOR_UTC_DAY,
  claimLatticeTransformation,
  latticeTransformationStateExpiresAt,
} from "../workers/text-to-lattice-api/capacityPolicy.js";
import {
  LATTICE_API_ORIGIN,
  LATTICE_API_PATH,
  LATTICE_API_RATE_LIMIT_KEY,
  LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER,
  LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_EXPIRES_AT_BINDING,
  createLatticeApiWorker as createProductionLatticeApiWorker,
  qualificationWindowAllowsRequests,
} from "../workers/text-to-lattice-api/worker.js";
import {
  LATTICE_API_VISITOR_COOKIE_NAME,
  LATTICE_API_VISITOR_COOKIE_PATH,
  LatticeApiVisitorCookieError,
  establishLatticeApiVisitor,
  latticeApiVisitorCookieMaxAge,
  resolveLatticeApiVisitor,
  withLatticeApiVisitorCookie,
} from "../workers/text-to-lattice-api/visitorCookie.js";

const validPayload = Object.freeze({
  text: "Open the document, review it, and save the approved revision.",
  requested_mode: "operative",
  schema_version: 1,
});
const TEST_VISITOR_ID = "A".repeat(24);
const TEST_VISITOR_COOKIE_VALUE = `v1.${TEST_VISITOR_ID}.${"B".repeat(43)}`;
const TEST_VISITOR_SECRET = "test-only-independent-api-visitor-secret-value";
const allowTransformation = async () => Object.freeze({
  allowed: true,
  retryAfterSeconds: null,
});
const resolveTestVisitor = async () => Object.freeze({
  visitorId: TEST_VISITOR_ID,
  cookieValue: TEST_VISITOR_COOKIE_VALUE,
});
function capacityVisitor(index) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  return alphabet[index].repeat(24);
}

function createLatticeApiWorker(options = {}) {
  return createProductionLatticeApiWorker({
    enforceRateLimit: async () => {},
    admitTransformation: allowTransformation,
    resolveVisitor: resolveTestVisitor,
    ...options,
  });
}

function validLatticeResult(text = "Review the document, then save the approved revision.") {
  return Object.freeze({
    version: LATTICE_RESULT_VERSION,
    status: "translated",
    text,
    wordCount: text.trim().split(/\s+/u).length,
    primaryLayer: "operative",
    layerId: "operative",
    layerLabel: "Operative layer",
    layersUsed: Object.freeze(["operative"]),
    passageCount: 1,
    revisedPassageCount: 1,
    retainedPassageCount: 0,
    batchCount: 1,
    verificationPasses: 1,
    findings: Object.freeze([]),
    questions: Object.freeze([]),
  });
}

function apiRequest(body = validPayload, {
  url = `${LATTICE_API_ORIGIN}${LATTICE_API_PATH}`,
  method = "POST",
  origin = LATTICE_API_ORIGIN,
  accept = "application/json",
  contentType = "application/json",
  headers = {},
  visitorCookie = TEST_VISITOR_COOKIE_VALUE,
  raw = false,
} = {}) {
  const requestHeaders = new Headers(headers);
  if (visitorCookie !== null && !requestHeaders.has("Cookie")) {
    requestHeaders.set("Cookie", `${LATTICE_API_VISITOR_COOKIE_NAME}=${visitorCookie}`);
  }
  if (origin !== null) requestHeaders.set("Origin", origin);
  if (accept !== null && !requestHeaders.has("Accept")) requestHeaders.set("Accept", accept);
  if (contentType !== null) requestHeaders.set("Content-Type", contentType);
  const init = { method, headers: requestHeaders };
  if (method !== "GET" && method !== "HEAD") {
    init.body = raw ? body : JSON.stringify(body);
  }
  return new Request(url, init);
}

function visitorSessionRequest({
  headers = {},
  origin = LATTICE_API_ORIGIN,
  visitorCookie = null,
  body,
} = {}) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", LATTICE_VISITOR_SESSION_ACCEPT);
  if (origin !== null) requestHeaders.set("Origin", origin);
  if (visitorCookie !== null && !requestHeaders.has("Cookie")) {
    requestHeaders.set("Cookie", `${LATTICE_API_VISITOR_COOKIE_NAME}=${visitorCookie}`);
  }
  const init = {
    method: "POST",
    headers: requestHeaders,
  };
  if (body !== undefined) {
    init.body = body;
    if (body instanceof ReadableStream) init.duplex = "half";
  }
  return new Request(`${LATTICE_API_ORIGIN}${LATTICE_API_PATH}`, init);
}

async function json(response) {
  return JSON.parse(await response.text());
}

function successfulProviderResponse(value = { accepted: true }) {
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: "stop",
      message: { role: "assistant", content: JSON.stringify(value) },
    }],
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function minimalAnalysisRequest(text = validPayload.text) {
  const preflight = preflightLatticeInput(text);
  return Object.freeze({
    batch: preflight.batches[0],
    documentLedger: Object.freeze([]),
    context: null,
    signal: new AbortController().signal,
  });
}

function providerRequestOptions(fetchImpl, overrides = {}) {
  return {
    token: "hf_test_secret_value",
    role: "generator",
    messages: [{ role: "user", content: "inert test" }],
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { accepted: { type: "boolean" } },
      required: ["accepted"],
    },
    schemaName: "lattice_test_v1",
    maxTokens: 64,
    temperature: 0.1,
    topP: 0.9,
    fetchImpl,
    ...overrides,
  };
}

test("the exact same-origin API accepts the three-field v1 request and returns the exact success envelope", async () => {
  const events = [];
  const adapter = Object.freeze({ marker: "injected-provider" });
  const result = validLatticeResult();
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("the injected pipeline must not use the network"),
    createAdapter(options) {
      events.push({ kind: "adapter", options });
      return adapter;
    },
    async runTextToLatticeImpl(text, options) {
      events.push({ kind: "pipeline", text, options });
      return result;
    },
  });

  const response = await worker.fetch(apiRequest(), { HF_TOKEN: "server_only_token" });
  assert.equal(response.status, 200);
  assert.deepEqual(await json(response), { result, schema_version: 1 });
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(response.headers.has("access-control-allow-origin"), false);
  assert.equal(events.length, 2);
  assert.equal(events[0].options.token, "server_only_token");
  assert.equal(events[0].options.requestedMode, "operative");
  assert.equal(Object.hasOwn(events[0].options, "claimProviderCall"), false);
  assert.equal(events[1].text, validPayload.text);
  assert.equal(events[1].options.adapter, adapter);
  assert.equal(events[1].options.requestedMode, "operative");
  assert.equal(events[1].options.allowClarification, false);
  assert.deepEqual(events[1].options.clarificationAnswers, []);
});

test("path, query, method, origin, and media type are rejected before conversion", async () => {
  let executions = 0;
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("rejected requests must not use the network"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => {
      executions += 1;
      return { status: "translated" };
    },
  });
  const cases = [
    [apiRequest(validPayload, { url: "https://hah.dev/api/lattice/" }), 404, null],
    [apiRequest(validPayload, { url: "https://hah.dev/api/lattice?debug=1" }), 404, null],
    [apiRequest(validPayload, { url: "https://www.hah.dev/api/lattice", origin: "https://www.hah.dev" }), 404, null],
    [apiRequest(validPayload, { method: "GET" }), 405, "POST"],
    [apiRequest(validPayload, { origin: null }), 403, null],
    [apiRequest(validPayload, { origin: "https://attacker.invalid" }), 403, null],
    [apiRequest("{", { accept: null, raw: true }), 400, null],
    [apiRequest("{", { accept: "*/*", raw: true }), 400, null],
    [apiRequest("{", { accept: "application/json, text/plain", raw: true }), 400, null],
    [apiRequest(validPayload, { contentType: "text/plain" }), 415, null],
    [apiRequest(validPayload, { contentType: "application/problem+json" }), 415, null],
  ];

  for (const [request, expectedStatus, allow] of cases) {
    const response = await worker.fetch(request, { HF_TOKEN: "unused" });
    assert.equal(response.status, expectedStatus);
    assert.deepEqual(await json(response), {
      error: expectedStatus === 415 ? "unsupported_media_type" : "invalid_request",
    });
    assert.equal(response.headers.get("allow"), allow);
    assert.equal(response.headers.has("access-control-allow-origin"), false);
  }
  assert.equal(executions, 0);
});

test("the qualification API fails closed at its absolute evidence expiry", async () => {
  const expiresAt = "2026-09-14T17:30:00.000Z";
  const expiryMilliseconds = new Date(expiresAt).valueOf();
  assert.equal(qualificationWindowAllowsRequests(undefined, expiryMilliseconds), true);
  assert.equal(qualificationWindowAllowsRequests(expiresAt, expiryMilliseconds - 1), true);
  assert.equal(qualificationWindowAllowsRequests(expiresAt, expiryMilliseconds), false);
  assert.equal(qualificationWindowAllowsRequests("malformed", expiryMilliseconds - 1), false);
  assert.equal(
    qualificationWindowAllowsRequests("2026-02-31T17:30:00.000Z", expiryMilliseconds - 1),
    false,
  );

  let downstreamCalls = 0;
  const worker = createProductionLatticeApiWorker({
    now: () => expiryMilliseconds,
    enforceRateLimit: async () => { downstreamCalls += 1; },
    admitTransformation: async () => { downstreamCalls += 1; },
    resolveVisitor: async () => { downstreamCalls += 1; },
    createAdapter: () => { downstreamCalls += 1; },
    runTextToLatticeImpl: async () => { downstreamCalls += 1; },
  });
  const response = await worker.fetch(apiRequest(), {
    HF_TOKEN: "server_only_token",
    [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: expiresAt,
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await json(response), { error: "upstream_unavailable" });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(response.headers.has("access-control-allow-origin"), false);
  assert.equal(downstreamCalls, 0);
});

test("an admitted stalled pipeline is cut off at qualification expiry without output or cookie leakage", async () => {
  const requestStartedAt = Date.UTC(2026, 8, 14, 17, 29, 58, 750);
  const expiresAt = new Date(requestStartedAt + 1_250).toISOString();
  const lateResult = validLatticeResult("This late result must never reach the caller.");
  let bindingReads = 0;
  let nowCalls = 0;
  let admissions = 0;
  let pipelineSignal;
  let startPipeline;
  let finishPipeline;
  let scheduledDeadline;
  const pipelineStarted = new Promise((resolve) => { startPipeline = resolve; });
  const latePipeline = new Promise((resolve) => { finishPipeline = resolve; });
  const env = { HF_TOKEN: "server_only_token" };
  Object.defineProperty(env, LATTICE_QUALIFICATION_EXPIRES_AT_BINDING, {
    enumerable: true,
    get() {
      bindingReads += 1;
      return expiresAt;
    },
  });

  const worker = createLatticeApiWorker({
    now() {
      nowCalls += 1;
      return requestStartedAt;
    },
    requestTimeoutMs: 9_000,
    scheduleTimeout(callback, milliseconds) {
      assert.equal(scheduledDeadline, undefined);
      scheduledDeadline = { callback, milliseconds, canceled: false };
      return scheduledDeadline;
    },
    cancelTimeout(deadline) {
      assert.equal(deadline, scheduledDeadline);
      deadline.canceled = true;
    },
    admitTransformation: async () => {
      admissions += 1;
      return { allowed: true, retryAfterSeconds: null };
    },
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async (_text, { signal }) => {
      pipelineSignal = signal;
      startPipeline();
      return latePipeline;
    },
  });

  const pendingResponse = worker.fetch(apiRequest(), env);
  await pipelineStarted;
  assert.equal(bindingReads, 1);
  assert.equal(nowCalls, 7);
  assert.equal(admissions, 1);
  assert.equal(scheduledDeadline.milliseconds, 1_250);
  assert.equal(pipelineSignal.aborted, false);

  scheduledDeadline.callback();
  finishPipeline(lateResult);
  const response = await pendingResponse;
  assert.equal(pipelineSignal.aborted, true);
  assert.equal(scheduledDeadline.canceled, true);
  assert.equal(admissions, 1);
  assert.equal(response.status, 503);
  assert.deepEqual(await json(response), { error: "upstream_unavailable" });
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(response.headers.has("access-control-allow-origin"), false);
});

test("visitor setup completed at the absolute cutoff cannot return a cookie before its timer callback runs", async () => {
  const requestStartedAt = Date.UTC(2026, 8, 14, 17, 29, 59, 900);
  const expiresAt = new Date(requestStartedAt + 100).toISOString();
  let wallClock = requestStartedAt;
  let bindingReads = 0;
  let nowCalls = 0;
  let startSetup;
  let finishSetup;
  let scheduledDeadline;
  const setupStarted = new Promise((resolve) => { startSetup = resolve; });
  const delayedSetup = new Promise((resolve) => { finishSetup = resolve; });
  const env = {};
  Object.defineProperty(env, LATTICE_QUALIFICATION_EXPIRES_AT_BINDING, {
    enumerable: true,
    get() {
      bindingReads += 1;
      return expiresAt;
    },
  });
  const worker = createProductionLatticeApiWorker({
    now() {
      nowCalls += 1;
      return wallClock;
    },
    scheduleTimeout(callback, milliseconds) {
      scheduledDeadline = { callback, milliseconds, canceled: false };
      return scheduledDeadline;
    },
    cancelTimeout(deadline) {
      deadline.canceled = true;
    },
    establishVisitor: async () => {
      startSetup();
      return delayedSetup;
    },
  });

  const pendingResponse = worker.fetch(visitorSessionRequest(), env);
  await setupStarted;
  assert.equal(bindingReads, 1);
  assert.equal(nowCalls, 2);
  assert.equal(scheduledDeadline.milliseconds, 100);
  wallClock = requestStartedAt + 100;
  finishSetup(await resolveTestVisitor());
  const response = await pendingResponse;

  assert.equal(bindingReads, 1);
  assert.equal(nowCalls, 3);
  assert.equal(scheduledDeadline.canceled, true);
  assert.equal(response.status, 503);
  assert.deepEqual(await json(response), { error: "upstream_unavailable" });
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
});

test("delayed visitor setup bases cookie expiry on its final response-time snapshot", async () => {
  const requestStartedAt = Date.UTC(2026, 8, 14, 23, 59, 0, 0);
  const responseTime = requestStartedAt + 30_500;
  let wallClock = requestStartedAt;
  let nowCalls = 0;
  const worker = createProductionLatticeApiWorker({
    now() {
      nowCalls += 1;
      return wallClock;
    },
    establishVisitor: async () => {
      wallClock = responseTime;
      return resolveTestVisitor();
    },
  });

  const response = await worker.fetch(visitorSessionRequest());
  assert.equal(response.status, 204);
  assert.equal(nowCalls, 3);
  assert.equal(
    response.headers.get("set-cookie"),
    `${LATTICE_API_VISITOR_COOKIE_NAME}=${TEST_VISITOR_COOKIE_VALUE}; Max-Age=30; Path=${LATTICE_API_VISITOR_COOKIE_PATH}; Secure; HttpOnly; SameSite=Strict`,
  );
});

test("content completed at the absolute cutoff cannot return output before its timer callback runs", async () => {
  const requestStartedAt = Date.UTC(2026, 8, 14, 17, 29, 59, 900);
  const expiresAt = new Date(requestStartedAt + 100).toISOString();
  let wallClock = requestStartedAt;
  let bindingReads = 0;
  let nowCalls = 0;
  let admissions = 0;
  let startPipeline;
  let finishPipeline;
  let scheduledDeadline;
  const pipelineStarted = new Promise((resolve) => { startPipeline = resolve; });
  const delayedPipeline = new Promise((resolve) => { finishPipeline = resolve; });
  const env = { HF_TOKEN: "server_only_token" };
  Object.defineProperty(env, LATTICE_QUALIFICATION_EXPIRES_AT_BINDING, {
    enumerable: true,
    get() {
      bindingReads += 1;
      return expiresAt;
    },
  });
  const worker = createLatticeApiWorker({
    now() {
      nowCalls += 1;
      return wallClock;
    },
    scheduleTimeout(callback, milliseconds) {
      scheduledDeadline = { callback, milliseconds, canceled: false };
      return scheduledDeadline;
    },
    cancelTimeout(deadline) {
      deadline.canceled = true;
    },
    admitTransformation: async () => {
      admissions += 1;
      return { allowed: true, retryAfterSeconds: null };
    },
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => {
      startPipeline();
      return delayedPipeline;
    },
  });

  const pendingResponse = worker.fetch(apiRequest(), env);
  await pipelineStarted;
  assert.equal(bindingReads, 1);
  assert.equal(nowCalls, 7);
  assert.equal(admissions, 1);
  assert.equal(scheduledDeadline.milliseconds, 100);
  wallClock = requestStartedAt + 100;
  finishPipeline(validLatticeResult("This cutoff result must not reach the caller."));
  const response = await pendingResponse;

  assert.equal(bindingReads, 1);
  assert.equal(nowCalls, 8);
  assert.equal(scheduledDeadline.canceled, true);
  assert.equal(response.status, 503);
  assert.deepEqual(await json(response), { error: "upstream_unavailable" });
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
});

test("an expired qualification cannot eagerly start visitor setup before its timer callback runs", async () => {
  const requestStartedAt = Date.UTC(2026, 8, 14, 17, 29, 59, 900);
  const expiresAt = new Date(requestStartedAt + 100).toISOString();
  let nowCalls = 0;
  let setupCalls = 0;
  let scheduledDeadline;
  const worker = createProductionLatticeApiWorker({
    now() {
      nowCalls += 1;
      return nowCalls === 1 ? requestStartedAt : requestStartedAt + 100;
    },
    scheduleTimeout(callback, milliseconds) {
      scheduledDeadline = { callback, milliseconds, canceled: false };
      return scheduledDeadline;
    },
    cancelTimeout(deadline) {
      deadline.canceled = true;
    },
    establishVisitor: async () => {
      setupCalls += 1;
      return resolveTestVisitor();
    },
  });

  const response = await worker.fetch(visitorSessionRequest(), {
    [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: expiresAt,
  });
  assert.equal(nowCalls, 2);
  assert.equal(setupCalls, 0);
  assert.equal(scheduledDeadline.canceled, true);
  assert.equal(response.status, 503);
  assert.deepEqual(await json(response), { error: "upstream_unavailable" });
  assert.equal(response.headers.has("set-cookie"), false);
});

test("qualification phase guards stop the next limiter, quota, adapter, or provider side effect", async () => {
  const phaseOrder = ["visitor", "limiter", "admission", "adapter"];
  for (const cutoffAfter of phaseOrder) {
    const requestStartedAt = Date.UTC(2026, 8, 14, 17, 29, 59, 900);
    const expiryMilliseconds = requestStartedAt + 100;
    const expiresAt = new Date(expiryMilliseconds).toISOString();
    let wallClock = requestStartedAt;
    const events = [];
    const markPhase = (phase) => {
      events.push(phase);
      if (phase === cutoffAfter) wallClock = expiryMilliseconds;
    };
    const worker = createProductionLatticeApiWorker({
      now: () => wallClock,
      scheduleTimeout: () => Object.freeze({}),
      cancelTimeout: () => {},
      resolveVisitor: async () => {
        markPhase("visitor");
        return resolveTestVisitor();
      },
      enforceRateLimit: async () => { markPhase("limiter"); },
      admitTransformation: async () => {
        markPhase("admission");
        return { allowed: true, retryAfterSeconds: null };
      },
      createAdapter: () => {
        markPhase("adapter");
        return Object.freeze({});
      },
      runTextToLatticeImpl: async () => {
        markPhase("pipeline");
        return validLatticeResult();
      },
    });

    const response = await worker.fetch(apiRequest(), {
      HF_TOKEN: "server_only_token",
      [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: expiresAt,
    });
    assert.equal(response.status, 503, cutoffAfter);
    assert.deepEqual(await json(response), { error: "upstream_unavailable" }, cutoffAfter);
    assert.deepEqual(
      events,
      phaseOrder.slice(0, phaseOrder.indexOf(cutoffAfter) + 1),
      cutoffAfter,
    );
  }
});

test("explicit caller credential headers fail closed before body parsing, admission, or provider work", async () => {
  let limiterCalls = 0;
  let adapterCreations = 0;
  let executions = 0;
  const worker = createProductionLatticeApiWorker({
    fetchImpl: async () => assert.fail("credential-bearing requests must not use the network"),
    enforceRateLimit: async () => {
      limiterCalls += 1;
    },
    createAdapter: () => {
      adapterCreations += 1;
      return Object.freeze({});
    },
    runTextToLatticeImpl: async () => {
      executions += 1;
      return validLatticeResult();
    },
  });

  for (const name of [
    "Authorization",
    "Proxy-Authorization",
    "X-Api-Key",
    "X-Auth-Token",
    "X-CSRF-Token",
    "CF-Access-Jwt-Assertion",
    "Signature-Input",
  ]) {
    const response = await worker.fetch(apiRequest("{", {
      headers: { [name]: "synthetic-credential" },
      raw: true,
    }), {
      HF_TOKEN: "unused",
      LATTICE_API_RATE_LIMITER: { limit: async () => ({ success: true }) },
    });
    assert.equal(response.status, 403, name);
    assert.deepEqual(await json(response), { error: "invalid_request" }, name);
    assert.equal(response.headers.get("cache-control"), "no-store", name);
  }

  assert.equal(limiterCalls, 0);
  assert.equal(adapterCreations, 0);
  assert.equal(executions, 0);
});

test("the dedicated API cookie is opaque, signed, day-expiring, and the only permitted cookie", async () => {
  const dayStart = Date.UTC(2026, 8, 14);
  assert.equal(await resolveLatticeApiVisitor(new Headers(), TEST_VISITOR_SECRET), null);
  const first = await establishLatticeApiVisitor(new Headers(), TEST_VISITOR_SECRET);
  assert.match(first.visitorId, /^[A-Za-z0-9_-]{24}$/u);
  assert.match(first.cookieValue, /^v1\.[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{43}$/u);

  const returning = await resolveLatticeApiVisitor(new Headers({
    Cookie: `${LATTICE_API_VISITOR_COOKIE_NAME}=${first.cookieValue}`,
  }), TEST_VISITOR_SECRET);
  assert.equal(returning.visitorId, first.visitorId);
  assert.equal(returning.cookieValue, first.cookieValue);

  for (const cookie of [
    "ambient=1",
    `${LATTICE_API_VISITOR_COOKIE_NAME}=${first.cookieValue}; ambient=1`,
    `${LATTICE_API_VISITOR_COOKIE_NAME}=${first.cookieValue.slice(0, -1)}${first.cookieValue.endsWith("A") ? "B" : "A"}`,
  ]) {
    await assert.rejects(
      resolveLatticeApiVisitor(new Headers({ Cookie: cookie }), TEST_VISITOR_SECRET),
      LatticeApiVisitorCookieError,
    );
  }

  assert.equal(latticeApiVisitorCookieMaxAge(dayStart), 86_400);
  assert.equal(latticeApiVisitorCookieMaxAge(dayStart + 86_399_500), 1);
  const response = withLatticeApiVisitorCookie(
    new Response("{}"),
    first.cookieValue,
    dayStart + 12 * 60 * 60_000,
  );
  assert.equal(
    response.headers.get("set-cookie"),
    `${LATTICE_API_VISITOR_COOKIE_NAME}=${first.cookieValue}; Max-Age=43200; Path=${LATTICE_API_VISITOR_COOKIE_PATH}; Secure; HttpOnly; SameSite=Strict`,
  );
  assert.doesNotMatch(response.headers.get("set-cookie"), /Domain=/iu);
});

test("the bodyless visitor-session setup creates only the API cookie and touches no quota or provider", async () => {
  const calls = [];
  let hfTokenReads = 0;
  const worker = createProductionLatticeApiWorker({
    enforceRateLimit: async () => { calls.push("rate-limiter"); },
    admitTransformation: async () => {
      calls.push("admission");
      return { allowed: true, retryAfterSeconds: null };
    },
    createAdapter: () => {
      calls.push("adapter");
      return Object.freeze({});
    },
    runTextToLatticeImpl: async () => {
      calls.push("pipeline");
      return validLatticeResult();
    },
  });
  const env = { VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET };
  Object.defineProperty(env, "HF_TOKEN", {
    get() {
      hfTokenReads += 1;
      return "must-not-be-read";
    },
  });

  const response = await worker.fetch(visitorSessionRequest(), env);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.has("content-type"), false);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(
    response.headers.get("set-cookie"),
    new RegExp(`^${LATTICE_API_VISITOR_COOKIE_NAME}=v1\\.[A-Za-z0-9_-]{24}\\.[A-Za-z0-9_-]{43}; Max-Age=[1-9][0-9]{0,5}; Path=${LATTICE_API_VISITOR_COOKIE_PATH}; Secure; HttpOnly; SameSite=Strict$`, "u"),
  );
  assert.deepEqual(calls, []);
  assert.equal(hfTokenReads, 0);
});

test("visitor-session setup accepts a non-null stream only after proving it contains zero bytes", async () => {
  const calls = [];
  let hfTokenReads = 0;
  const worker = createProductionLatticeApiWorker({
    establishVisitor: async () => {
      calls.push("visitor");
      return resolveTestVisitor();
    },
    enforceRateLimit: async () => { calls.push("rate-limiter"); },
    admitTransformation: async () => {
      calls.push("admission");
      return { allowed: true, retryAfterSeconds: null };
    },
    createAdapter: () => {
      calls.push("adapter");
      return Object.freeze({});
    },
    runTextToLatticeImpl: async () => {
      calls.push("pipeline");
      return validLatticeResult();
    },
  });
  const env = { VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET };
  Object.defineProperty(env, "HF_TOKEN", {
    get() {
      hfTokenReads += 1;
      return "must-not-be-read";
    },
  });
  const request = visitorSessionRequest({
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(0));
        controller.close();
      },
    }),
  });
  assert.notEqual(request.body, null);
  assert.equal(request.headers.has("content-type"), false);

  const response = await worker.fetch(request, env);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.match(
    response.headers.get("set-cookie"),
    new RegExp(`^${LATTICE_API_VISITOR_COOKIE_NAME}=`, "u"),
  );
  assert.deepEqual(calls, ["visitor"]);
  assert.equal(hfTokenReads, 0);
});

test("visitor-session setup rejects a real body byte or Content-Type before visitor or downstream work", async () => {
  const calls = [];
  let hfTokenReads = 0;
  const worker = createProductionLatticeApiWorker({
    establishVisitor: async () => {
      calls.push("visitor");
      return resolveTestVisitor();
    },
    enforceRateLimit: async () => { calls.push("rate-limiter"); },
    admitTransformation: async () => {
      calls.push("admission");
      return { allowed: true, retryAfterSeconds: null };
    },
    createAdapter: () => {
      calls.push("adapter");
      return Object.freeze({});
    },
    runTextToLatticeImpl: async () => {
      calls.push("pipeline");
      return validLatticeResult();
    },
  });
  const env = { VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET };
  Object.defineProperty(env, "HF_TOKEN", {
    get() {
      hfTokenReads += 1;
      return "must-not-be-read";
    },
  });
  let bodyCanceled = false;
  const requests = [
    visitorSessionRequest({
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1]));
        },
        cancel() {
          bodyCanceled = true;
        },
      }),
    }),
    visitorSessionRequest({ headers: { "Content-Type": "application/octet-stream" } }),
  ];

  for (const request of requests) {
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 400);
    assert.deepEqual(await json(response), { error: "invalid_request" });
    assert.equal(response.headers.has("set-cookie"), false);
  }
  assert.equal(bodyCanceled, true);
  assert.deepEqual(calls, []);
  assert.equal(hfTokenReads, 0);
});

test("visitor-session setup preserves and reissues a valid identity without rotating it", async () => {
  const worker = createProductionLatticeApiWorker();
  const env = { VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET };
  const first = await worker.fetch(visitorSessionRequest(), env);
  const firstValue = first.headers.get("set-cookie").split(";", 1)[0].split("=", 2)[1];
  const returning = await worker.fetch(visitorSessionRequest({ visitorCookie: firstValue }), env);
  const returningValue = returning.headers.get("set-cookie").split(";", 1)[0].split("=", 2)[1];

  assert.equal(first.status, 204);
  assert.equal(returning.status, 204);
  assert.equal(returningValue, firstValue);
});

test("a cookie-less transformation requires setup before any limiter, quota, token, or provider work", async () => {
  const calls = [];
  let hfTokenReads = 0;
  const worker = createProductionLatticeApiWorker({
    enforceRateLimit: async () => { calls.push("rate-limiter"); },
    admitTransformation: async () => {
      calls.push("admission");
      return { allowed: true, retryAfterSeconds: null };
    },
    resolveVisitor: async () => {
      calls.push("visitor-resolution");
      return resolveTestVisitor();
    },
    createAdapter: () => {
      calls.push("adapter");
      return Object.freeze({});
    },
    runTextToLatticeImpl: async () => {
      calls.push("pipeline");
      return validLatticeResult();
    },
  });
  const env = {};
  Object.defineProperty(env, "HF_TOKEN", {
    get() {
      hfTokenReads += 1;
      return "must-not-be-read";
    },
  });

  const response = await worker.fetch(apiRequest(validPayload, { visitorCookie: null }), env);
  assert.equal(response.status, 428);
  assert.deepEqual(await json(response), { error: "visitor_session_required" });
  assert.equal(response.headers.has("set-cookie"), false);
  assert.deepEqual(calls, []);
  assert.equal(hfTokenReads, 0);
});

test("visitor-session setup rejects an invalid cookie without rotating it or touching downstream work", async () => {
  let downstreamCalls = 0;
  const worker = createProductionLatticeApiWorker({
    enforceRateLimit: async () => { downstreamCalls += 1; },
    admitTransformation: async () => { downstreamCalls += 1; },
    createAdapter: () => { downstreamCalls += 1; },
    runTextToLatticeImpl: async () => { downstreamCalls += 1; },
  });
  const response = await worker.fetch(visitorSessionRequest({
    visitorCookie: `v1.${TEST_VISITOR_ID}.${"B".repeat(43)}`,
  }), { VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET });

  assert.equal(response.status, 403);
  assert.deepEqual(await json(response), { error: "invalid_request" });
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(downstreamCalls, 0);
});

test("a transformation succeeds with the valid cookie from setup and never reissues it", async () => {
  const calls = [];
  const worker = createProductionLatticeApiWorker({
    enforceRateLimit: async () => { calls.push("rate-limiter"); },
    admitTransformation: async (_namespace, visitorId) => {
      calls.push(["admission", visitorId]);
      return { allowed: true, retryAfterSeconds: null };
    },
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => {
      calls.push("pipeline");
      return validLatticeResult();
    },
  });
  const env = {
    HF_TOKEN: "server_only_token",
    VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
  };
  const setup = await worker.fetch(visitorSessionRequest(), env);
  const cookieValue = setup.headers.get("set-cookie").split(";", 1)[0].split("=", 2)[1];
  const response = await worker.fetch(apiRequest(validPayload, { visitorCookie: cookieValue }), env);

  assert.equal(response.status, 200);
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(calls[0], "rate-limiter");
  assert.match(calls[1][1], /^[A-Za-z0-9_-]{24}$/u);
  assert.equal(calls[2], "pipeline");
});

test("tampered or unrelated cookies fail before transformation admission or provider work", async () => {
  let admissions = 0;
  let executions = 0;
  const worker = createProductionLatticeApiWorker({
    enforceRateLimit: async () => {},
    admitTransformation: async () => {
      admissions += 1;
      return { allowed: true, retryAfterSeconds: null };
    },
    fetchImpl: async () => assert.fail("an invalid cookie must not reach the provider"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => {
      executions += 1;
      return validLatticeResult();
    },
  });
  for (const cookie of [
    "ambient=1",
    `${LATTICE_API_VISITOR_COOKIE_NAME}=v1.${TEST_VISITOR_ID}.${"B".repeat(43)}`,
  ]) {
    const response = await worker.fetch(apiRequest(validPayload, {
      headers: { Cookie: cookie },
    }), {
      HF_TOKEN: "server_only_token",
      VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await json(response), { error: "invalid_request" });
    assert.equal(response.headers.has("set-cookie"), false);
  }
  assert.equal(admissions, 0);
  assert.equal(executions, 0);
});

test("a missing dedicated visitor-cookie secret fails before admission", async () => {
  let admissions = 0;
  const worker = createProductionLatticeApiWorker({
    enforceRateLimit: async () => {},
    admitTransformation: async () => {
      admissions += 1;
      return { allowed: true, retryAfterSeconds: null };
    },
    fetchImpl: async () => assert.fail("a missing cookie secret must not reach the provider"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => assert.fail("a missing cookie secret must not run the pipeline"),
  });
  const response = await worker.fetch(apiRequest(), { HF_TOKEN: "server_only_token" });
  assert.equal(response.status, 500);
  assert.deepEqual(await json(response), { error: "internal_error" });
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(admissions, 0);
});

test("invalid JSON and every non-exact request schema fail closed", async () => {
  let executions = 0;
  let limiterCalls = 0;
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("invalid requests must not use the network"),
    createAdapter: () => Object.freeze({}),
    enforceRateLimit: async () => {
      limiterCalls += 1;
    },
    runTextToLatticeImpl: async () => {
      executions += 1;
      return { status: "translated" };
    },
  });
  const invalidBodies = [
    ["{", true],
    [null, false],
    [[], false],
    [{ text: "valid words", requested_mode: "auto" }, false],
    [{ ...validPayload, extra: true }, false],
    [{ ...validPayload, schema_version: 2 }, false],
    [{ ...validPayload, schema_version: "1" }, false],
    [{ ...validPayload, requested_mode: "interpretive" }, false],
    [{ ...validPayload, requested_mode: "AUTO" }, false],
    [{ ...validPayload, text: 42 }, false],
    [{ ...validPayload, text: "" }, false],
  ];
  for (const [body, raw] of invalidBodies) {
    const response = await worker.fetch(apiRequest(body, { raw }), { HF_TOKEN: "unused" });
    assert.equal(response.status, 400);
    assert.deepEqual(await json(response), { error: "invalid_request" });
  }
  assert.equal(executions, 0);
  assert.equal(limiterCalls, 0, "invalid payloads cannot consume the shared rate token");
});

test("the content-free rate limiter allows, denies, and fails closed before provider work", async () => {
  let adapterCreations = 0;
  let executions = 0;
  const worker = createProductionLatticeApiWorker({
    admitTransformation: allowTransformation,
    resolveVisitor: resolveTestVisitor,
    fetchImpl: async () => assert.fail("the injected pipeline must not use the provider network"),
    createAdapter: () => {
      adapterCreations += 1;
      return Object.freeze({});
    },
    runTextToLatticeImpl: async () => {
      executions += 1;
      return validLatticeResult();
    },
  });

  const keys = [];
  const allowed = await worker.fetch(apiRequest(), {
    HF_TOKEN: "unused",
    LATTICE_API_RATE_LIMITER: {
      async limit(options) {
        keys.push(options);
        return { success: true };
      },
    },
  });
  assert.equal(allowed.status, 200);
  assert.deepEqual(keys, [{ key: LATTICE_API_RATE_LIMIT_KEY }]);
  assert.equal(JSON.stringify(keys).includes(validPayload.text), false);
  assert.equal(adapterCreations, 1);
  assert.equal(executions, 1);

  const denied = await worker.fetch(apiRequest(), {
    HF_TOKEN: "unused",
    LATTICE_API_RATE_LIMITER: { limit: async () => ({ success: false }) },
  });
  assert.equal(denied.status, 429);
  assert.deepEqual(await json(denied), { error: "rate_limited", retry_after_seconds: 60 });

  for (const malformedBinding of [
    undefined,
    {},
    { limit: async () => null },
    { limit: async () => ({ success: "yes" }) },
    { limit: async () => { throw new Error("private limiter failure"); } },
  ]) {
    const response = await worker.fetch(apiRequest(), {
      HF_TOKEN: "unused",
      LATTICE_API_RATE_LIMITER: malformedBinding,
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await json(response), { error: "internal_error" });
  }
  assert.equal(adapterCreations, 1);
  assert.equal(executions, 1);
});

test("the 700-word boundary is accepted and 701 words is input_too_large", async () => {
  const acceptedText = Array.from({ length: 700 }, (_value, index) => `word${index}`).join(" ");
  const rejectedText = `${acceptedText} overflow`;
  const seen = [];
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("the injected pipeline must not use the network"),
    createAdapter: () => Object.freeze({}),
    async runTextToLatticeImpl(text) {
      seen.push(text);
      return validLatticeResult("bounded");
    },
  });

  const accepted = await worker.fetch(apiRequest({
    ...validPayload,
    text: acceptedText,
  }), { HF_TOKEN: "unused" });
  assert.equal(accepted.status, 200);
  assert.equal((await json(accepted)).schema_version, 1);

  const rejected = await worker.fetch(apiRequest({
    ...validPayload,
    text: rejectedText,
  }), { HF_TOKEN: "unused" });
  assert.equal(rejected.status, 413);
  assert.deepEqual(await json(rejected), { error: "input_too_large" });
  assert.deepEqual(seen, [acceptedText]);
});

test("the API rejects non-exact or internally inconsistent result envelopes", async () => {
  const valid = validLatticeResult();
  const invalidResults = [
    { ...valid, debug: true },
    { ...valid, version: "text-to-lattice.remote.v1" },
    { ...valid, questions: ["Send more source text."] },
    { ...valid, status: "translated", text: null },
    {
      ...valid,
      findings: [{ id: "finding:1", passageId: "passage:1", atomIds: ["atom:1"], message: "private detail" }],
    },
  ];

  for (const invalidResult of invalidResults) {
    const worker = createLatticeApiWorker({
      fetchImpl: async () => assert.fail("the injected pipeline must not use the network"),
      createAdapter: () => Object.freeze({}),
      runTextToLatticeImpl: async () => invalidResult,
    });
    const response = await worker.fetch(apiRequest(), { HF_TOKEN: "unused" });
    assert.equal(response.status, 502);
    assert.deepEqual(await json(response), { error: "malformed_upstream_response" });
  }
});

test("the shared error protocol rejects unknown fields and invalid retry hints", () => {
  assert.equal(isLatticeApiError({ error: "invalid_request" }), true);
  assert.equal(isLatticeApiError({ error: "rate_limited", retry_after_seconds: 60 }), true);
  for (const value of [
    { error: "unknown" },
    { error: "invalid_request", details: "must not cross the boundary" },
    { error: "rate_limited", retry_after_seconds: 0 },
    { error: "rate_limited", retry_after_seconds: 301 },
    { error: "upstream_timeout", retry_after_seconds: 60 },
  ]) {
    assert.equal(isLatticeApiError(value), false);
  }
});

test("the request-body byte ceiling fails before JSON allocation or conversion", async () => {
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("oversized requests must not use the network"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => assert.fail("oversized requests must not run the pipeline"),
    requestByteLimit: 32,
  });
  const response = await worker.fetch(apiRequest(validPayload), { HF_TOKEN: "unused" });
  assert.equal(response.status, 413);
  assert.deepEqual(await json(response), { error: "input_too_large" });
});

test("the adapter uses one fixed provider, Featherless-compatible JSON objects, closed host schemas, fixed roles, and Qwen no-think", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return successfulProviderResponse({
      documentKind: "instruction",
      passages: [],
      questions: [],
    });
  };
  const adapter = createHuggingFaceLatticeAdapter({
    token: "hf_server_only_token",
    requestedMode: "experiential",
    fetchImpl,
    callTimeoutMs: 1_000,
  });
  await adapter.analyze(minimalAnalysisRequest());
  await adapter.certify({
    certificateId: "certificate:test",
    obligationIds: Object.freeze(["document:whole"]),
    source: "Original source.",
    candidate: "Candidate source.",
    analysis: null,
    signal: new AbortController().signal,
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(new Set(calls.map(({ url }) => url)), new Set([HUGGING_FACE_CHAT_COMPLETIONS_URL]));
  assert.deepEqual(calls.map(({ body }) => body.model), [
    LATTICE_REMOTE_MODELS.generator,
    LATTICE_REMOTE_MODELS.verifier,
  ]);
  assert.deepEqual(calls.map(({ body }) => body.max_tokens), [3_072, 520]);
  assert.deepEqual(calls.map(({ body }) => body.temperature), [0.7, 0]);
  assert.deepEqual(calls.map(({ body }) => body.top_p), [0.8, 1]);
  assert.deepEqual(calls.map(({ body }) => body.seed), [71_903, 71_903]);
  for (const [index, { init, body }] of calls.entries()) {
    const expectedKeys = [
      "max_tokens",
      "messages",
      "model",
      "response_format",
      "seed",
      "stream",
      "temperature",
      "top_p",
    ];
    if (index === 0) expectedKeys.push("chat_template_kwargs", "min_p", "top_k");
    assert.deepEqual(Object.keys(body).sort(), expectedKeys.sort());
    assert.equal(init.method, "POST");
    assert.equal(init.cache, "no-store");
    assert.equal(init.credentials, "omit");
    assert.equal(init.redirect, "manual");
    assert.equal(init.referrerPolicy, "no-referrer");
    assert.equal(init.headers.Authorization, "Bearer hf_server_only_token");
    assert.equal(body.stream, false);
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.equal(Object.hasOwn(body.response_format, "json_schema"), false);
    assert.equal(JSON.stringify(body.response_format).includes("strict"), false);
  }
  assert.deepEqual(calls[0].body.chat_template_kwargs, { enable_thinking: false });
  assert.equal(calls[0].body.top_k, 20);
  assert.equal(calls[0].body.min_p, 0);
  assert.equal(Object.hasOwn(calls[1].body, "chat_template_kwargs"), false);
  assert.equal(Object.hasOwn(calls[1].body, "top_k"), false);
  assert.equal(Object.hasOwn(calls[1].body, "min_p"), false);
  assert.match(calls[0].body.messages[0].content, /Return exactly one minified JSON object/u);
  assert.ok(calls[0].body.messages[0].content.includes(JSON.stringify(REANALYSIS_SCHEMA)));
  assert.ok(calls[1].body.messages[0].content.includes(JSON.stringify(DOCUMENT_CERTIFICATION_SCHEMA)));
  for (const { body } of calls) {
    assert.equal(body.messages.slice(1).some(({ content }) => (
      typeof content === "string" && content.includes("LATTICE_RESPONSE_SCHEMA")
    )), false);
  }
  assert.equal(calls[0].body.messages[0].content.includes(validPayload.text), false);
  assert.equal(calls[0].body.messages.slice(1).some(({ content }) => (
    typeof content === "string" && content.includes(validPayload.text)
  )), true);
  assert.match(calls[0].body.messages[0].content, /Requested mode: experiential/u);
  assert.match(calls[0].body.messages[0].content, /\/no_think$/u);
  assert.doesNotMatch(calls[1].body.messages[0].content, /\/no_think/u);
});

test("provider failures carry only an immutable allowlisted stage and bounded call ordinal", async () => {
  const privateBody = "PRIVATE-PROVIDER-BODY-MUST-NOT-CROSS";
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => new Response(privateBody, {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    }),
  });
  await assert.rejects(
    adapter.analyze(minimalAnalysisRequest()),
    (error) => {
      assert.ok(error instanceof LatticeProviderError);
      assert.equal(error.code, "provider_http_error");
      assert.equal(error.status, 503);
      assert.equal(error.qualificationStage, "analysis");
      assert.equal(error.qualificationCallOrdinal, 1);
      assert.equal(LATTICE_PROVIDER_FAILURE_CLASSES.includes(error.code), true);
      assert.equal(LATTICE_PROVIDER_STAGES.includes(error.qualificationStage), true);
      assert.equal(Object.keys(error).includes("qualificationStage"), false);
      assert.equal(Object.keys(error).includes("qualificationCallOrdinal"), false);
      assert.equal(error.message.includes(privateBody), false);
      return true;
    },
  );
});

test("provider diagnostics attribute a later verifier-stage failure to its exact call ordinal", async () => {
  const calls = [];
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body));
      if (calls.length === 1) {
        return successfulProviderResponse({
          documentKind: "instruction",
          passages: [],
          questions: [],
        });
      }
      return new Response("PRIVATE-LATER-STAGE-BODY", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      });
    },
  });
  await adapter.analyze(minimalAnalysisRequest());
  await assert.rejects(
    adapter.certify({
      certificateId: "certificate:diagnostic-stage",
      obligationIds: Object.freeze(["document:whole"]),
      source: "Original source.",
      candidate: "Candidate source.",
      analysis: null,
      signal: new AbortController().signal,
    }),
    (error) => {
      assert.ok(error instanceof LatticeProviderError);
      assert.equal(error.code, "provider_http_error");
      assert.equal(error.status, 503);
      assert.equal(error.qualificationStage, "certification");
      assert.equal(error.qualificationCallOrdinal, 2);
      return true;
    },
  );
  assert.deepEqual(calls.map(({ model }) => model), [
    LATTICE_REMOTE_MODELS.generator,
    LATTICE_REMOTE_MODELS.verifier,
  ]);
});

test("a direct JSON-object request prepends the trusted closed schema without changing user data", async () => {
  let body;
  const options = providerRequestOptions(async (_url, init) => {
    body = JSON.parse(init.body);
    return successfulProviderResponse({ accepted: true });
  });
  await requestHuggingFaceJson(options);

  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
  assert.equal(body.messages[0].role, "system");
  assert.match(body.messages[0].content, /Response contract lattice_test_v1/u);
  assert.ok(body.messages[0].content.includes(JSON.stringify(options.schema)));
  assert.match(body.messages[0].content, /\/no_think$/u);
  assert.deepEqual(body.messages[1], options.messages[0]);
});

test("optional provider sampler extensions fail closed before external fetch", async () => {
  let fetches = 0;
  const fetchImpl = async () => {
    fetches += 1;
    return successfulProviderResponse();
  };
  for (const overrides of [
    { topK: 0 },
    { topK: 1.5 },
    { minP: -0.1 },
    { minP: 1.1 },
    { minP: Number.NaN },
  ]) {
    await assert.rejects(
      requestHuggingFaceJson(providerRequestOptions(fetchImpl, overrides)),
      TypeError,
    );
  }
  assert.equal(fetches, 0);
});

test("the immutable 32-call adapter budget blocks a 33rd provider fetch", async () => {
  let fetches = 0;
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => {
      fetches += 1;
      return successfulProviderResponse({
        documentKind: "instruction",
        passages: [],
        questions: [],
      });
    },
  });
  const initial = adapter.completionCapacity();
  assert.deepEqual(initial, {
    used: 0,
    limit: LATTICE_PROVIDER_CALL_LIMIT,
    remaining: LATTICE_PROVIDER_CALL_LIMIT,
  });
  assert.equal(Object.isFrozen(initial), true);

  const request = minimalAnalysisRequest();
  for (let index = 0; index < LATTICE_PROVIDER_CALL_LIMIT; index += 1) {
    await adapter.analyze(request);
  }
  assert.deepEqual(adapter.completionCapacity(), {
    used: LATTICE_PROVIDER_CALL_LIMIT,
    limit: LATTICE_PROVIDER_CALL_LIMIT,
    remaining: 0,
  });
  await assert.rejects(
    adapter.analyze(request),
    (error) => {
      assert.ok(error instanceof LatticeProviderError);
      assert.equal(error.code, "provider_call_limit");
      assert.equal(error.qualificationStage, undefined);
      assert.equal(error.qualificationCallOrdinal, undefined);
      assert.equal(LATTICE_PROVIDER_FAILURE_CLASSES.includes(error.code), false);
      return true;
    },
  );
  assert.equal(fetches, LATTICE_PROVIDER_CALL_LIMIT);
});

test("provider timeout is typed, bounded, and makes only one request", async () => {
  let calls = 0;
  let observedAbort = false;
  const fetchImpl = async (_url, init) => {
    calls += 1;
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        observedAbort = true;
        reject(init.signal.reason);
      }, { once: true });
    });
  };
  await assert.rejects(
    requestHuggingFaceJson(providerRequestOptions(fetchImpl, { callTimeoutMs: 10 })),
    (error) => error instanceof LatticeProviderError && error.code === "provider_timeout",
  );
  assert.equal(calls, 1);
  assert.equal(observedAbort, true);
});

test("a provider response that resolves after timeout has its unread body canceled", async () => {
  let bodyCanceled = false;
  let resolveFetch;
  const fetchImpl = () => new Promise((resolve) => {
    resolveFetch = resolve;
  });
  const operation = requestHuggingFaceJson(providerRequestOptions(fetchImpl, { callTimeoutMs: 10 }));

  await assert.rejects(
    operation,
    (error) => error instanceof LatticeProviderError && error.code === "provider_timeout",
  );
  resolveFetch(new Response(new ReadableStream({
    cancel() {
      bodyCanceled = true;
    },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(bodyCanceled, true);
});

test("provider timeout is not extended by a response stream whose cancel never settles", async () => {
  const never = () => new Promise(() => {});
  const responseStream = new ReadableStream({
    pull: never,
    cancel: never,
  });
  const operation = requestHuggingFaceJson(providerRequestOptions(async () => new Response(responseStream, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }), { callTimeoutMs: 10 }));

  const outcome = await Promise.race([
    operation.then(
      () => ({ resolved: true }),
      (error) => ({ error }),
    ),
    new Promise((resolve) => setTimeout(() => resolve({ expired: true }), 250)),
  ]);
  assert.equal(outcome.expired, undefined);
  assert.ok(outcome.error instanceof LatticeProviderError);
  assert.equal(outcome.error.code, "provider_timeout");
});

test("upstream 500, malformed envelopes, empty content, and response overflow fail without retry", async () => {
  const cases = [
    [
      () => new Response("secret upstream diagnostics must-not-reflect", { status: 500 }),
      "provider_http_error",
    ],
    [
      () => new Response("not-json", { status: 200 }),
      "provider_malformed_response",
    ],
    [
      () => new Response(JSON.stringify({
        choices: [{ finish_reason: "stop", message: { content: "{\"accepted\":true}" } }],
      }), { status: 200, headers: { "Content-Type": "text/plain" } }),
      "provider_malformed_response",
    ],
    [
      () => successfulProviderResponse({ accepted: true }),
      "provider_redirect",
      { markRedirected: true },
    ],
    [
      () => new Response("redirect body", {
        status: 302,
        headers: { Location: "https://unreviewed.invalid/provider" },
      }),
      "provider_redirect",
    ],
    [
      () => new Response(JSON.stringify({
        choices: [{ finish_reason: "stop", message: { role: "user", content: "{\"accepted\":true}" } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
      "provider_malformed_response",
    ],
    [
      () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "" } }] }), { status: 200 }),
      "provider_malformed_response",
    ],
    ...[
      "```json\n{\"accepted\":true}\n```",
      "{\"accepted\":true} trailing",
      "[]",
      "true",
    ].map((content) => [
      () => new Response(JSON.stringify({
        choices: [{ finish_reason: "stop", message: { role: "assistant", content } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
      "provider_malformed_response",
    ]),
    [
      () => successfulProviderResponse({ accepted: true }),
      "provider_response_too_large",
      { maximumResponseBytes: 16 },
    ],
  ];
  for (const [responseFactory, expectedCode, options = {}] of cases) {
    let calls = 0;
    const { markRedirected = false, ...overrides } = options;
    await assert.rejects(
      requestHuggingFaceJson(providerRequestOptions(async () => {
        calls += 1;
        const response = responseFactory();
        if (markRedirected) Object.defineProperty(response, "redirected", { value: true });
        return response;
      }, overrides)),
      (error) => {
        assert.ok(error instanceof LatticeProviderError);
        assert.equal(error.code, expectedCode);
        assert.doesNotMatch(error.message, /must-not-reflect|hf_test_secret_value/u);
        return true;
      },
    );
    assert.equal(calls, 1);
  }
});

test("a provider HTTP 400 body is discarded without retry, logging, or reflection", async () => {
  let calls = 0;
  let bodyCanceled = false;
  await assert.rejects(
    requestHuggingFaceJson(providerRequestOptions(async () => {
      calls += 1;
      return new Response(new ReadableStream({
        cancel() {
          bodyCanceled = true;
        },
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    })),
    (error) => error instanceof LatticeProviderError
      && error.code === "provider_http_error"
      && error.status === 400
      && !error.message.includes("private-provider-body"),
  );
  assert.equal(calls, 1);
  assert.equal(bodyCanceled, true);
});

test("provider HTTP 402 at analysis call four remains private and qualification-only", async () => {
  const privateBody = "PRIVATE-PAYMENT-DIAGNOSTIC-MUST-NOT-CROSS";
  const privateCookie = "provider-private-cookie-must-not-cross";
  const diagnosticHeaders = {
    [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]:
      LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  };
  const activeQualification = {
    HF_TOKEN: "server_only_token",
    [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z",
  };
  const cases = [
    ["ordinary runtime", { HF_TOKEN: "server_only_token" }, {}, false],
    ["active qualification", activeQualification, diagnosticHeaders, true],
  ];

  for (const [name, env, headers, diagnosticExpected] of cases) {
    let providerCalls = 0;
    let rejectedBodyCanceled = 0;
    const worker = createLatticeApiWorker({
      fetchImpl: async () => {
        providerCalls += 1;
        if (providerCalls < 4) {
          return successfulProviderResponse({
            documentKind: "instruction",
            passages: [],
            questions: [],
          });
        }
        return new Response(new ReadableStream({
          cancel() {
            rejectedBodyCanceled += 1;
          },
        }), {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "120",
            "Set-Cookie": privateCookie,
            "X-Private-Provider-Diagnostic": privateBody,
          },
        });
      },
      runTextToLatticeImpl: async (_text, { adapter }) => {
        for (let call = 0; call < 4; call += 1) {
          await adapter.analyze(minimalAnalysisRequest());
        }
        return validLatticeResult();
      },
    });

    const response = await worker.fetch(
      apiRequest(validPayload, { headers }),
      env,
    );
    const responseBody = await response.text();
    assert.equal(providerCalls, 4, name);
    assert.equal(rejectedBodyCanceled, 1, name);
    assert.equal(response.status, 502, name);
    assert.deepEqual(JSON.parse(responseBody), { error: "upstream_unavailable" }, name);
    assert.equal(responseBody.includes(privateBody), false, name);
    assert.equal(responseBody.includes("retry_after_seconds"), false, name);
    assert.equal(response.headers.has("retry-after"), false, name);
    assert.equal(response.headers.has("set-cookie"), false, name);
    assert.equal(JSON.stringify([...response.headers]).includes(privateBody), false, name);
    assert.equal(JSON.stringify([...response.headers]).includes(privateCookie), false, name);

    const expectedDiagnostic = diagnosticExpected
      ? {
        failureClass: "provider_http_error",
        upstreamStatus: "402",
        stage: "analysis",
        callOrdinal: "4",
      }
      : {
        failureClass: null,
        upstreamStatus: null,
        stage: null,
        callOrdinal: null,
      };
    for (const [key, header] of Object.entries(
      LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS,
    )) {
      assert.equal(response.headers.get(header), expectedDiagnostic[key], `${name}: ${key}`);
    }
  }
});

test("typed provider failures map to exact flat public errors with a bounded 429 hint", async () => {
  const cases = [
    [new LatticeProviderError("provider_timeout", "private timeout"), 504, { error: "upstream_timeout" }],
    [new LatticeProviderError("provider_unavailable", "private network error"), 502, { error: "upstream_unavailable" }],
    [new LatticeProviderError("provider_call_limit", "private budget"), 502, { error: "upstream_unavailable" }],
    [new LatticeProviderError("provider_request_too_large", "private request"), 502, { error: "upstream_unavailable" }],
    [new LatticeProviderError("provider_redirect", "private redirect"), 502, { error: "upstream_unavailable" }],
    [new LatticeProviderError("provider_http_error", "private 500", { status: 500 }), 502, { error: "upstream_unavailable" }],
    [new LatticeProviderError("provider_malformed_response", "private body"), 502, { error: "malformed_upstream_response" }],
    [new LatticeProviderError("provider_output_limit", "private body"), 502, { error: "malformed_upstream_response" }],
    [new LatticeProviderError("provider_http_error", "private 429", {
      status: 429,
      retryAfterSeconds: 300,
    }), 429, { error: "rate_limited", retry_after_seconds: 300 }],
  ];
  for (const [failure, expectedStatus, expectedBody] of cases) {
    const worker = createLatticeApiWorker({
      fetchImpl: async () => assert.fail("the injected failure does not use the network"),
      createAdapter: () => Object.freeze({}),
      runTextToLatticeImpl: async () => { throw failure; },
    });
    const response = await worker.fetch(apiRequest(), { HF_TOKEN: "must-not-reflect-token" });
    assert.equal(response.status, expectedStatus);
    assert.deepEqual(await json(response), expectedBody);
    assert.equal(
      response.headers.has("set-cookie"),
      false,
    );
    for (const header of Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)) {
      assert.equal(response.headers.has(header), false);
    }
  }
});

test("the four-field provider diagnostic is opt-in and confined to an active qualification window", async () => {
  const privateBody = "PRIVATE-UPSTREAM-BODY-MUST-NOT-CROSS";
  const createFailureWorker = (overrides = {}) => createLatticeApiWorker({
    fetchImpl: async () => new Response(privateBody, {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    }),
    runTextToLatticeImpl: async (_text, { adapter }) => {
      await adapter.analyze(minimalAnalysisRequest());
      return validLatticeResult();
    },
    ...overrides,
  });
  const diagnosticHeaders = {
    [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]:
      LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  };
  const activeQualification = {
    HF_TOKEN: "server_only_token",
    [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z",
  };
  const cases = [
    ["qualified runtime", createFailureWorker(), { HF_TOKEN: "server_only_token" }, diagnosticHeaders],
    ["unmarked qualification request", createFailureWorker(), activeQualification, {}],
    [
      "wrong diagnostic version",
      createFailureWorker(),
      activeQualification,
      { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v2" },
    ],
  ];
  for (const [name, worker, env, headers] of cases) {
    const response = await worker.fetch(apiRequest(validPayload, { headers }), env);
    assert.equal(response.status, 502, name);
    assert.deepEqual(await json(response), { error: "upstream_unavailable" }, name);
    for (const header of Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)) {
      assert.equal(response.headers.has(header), false, `${name}: ${header}`);
    }
  }

  const response = await createFailureWorker().fetch(
    apiRequest(validPayload, { headers: diagnosticHeaders }),
    activeQualification,
  );
  assert.equal(response.status, 502);
  assert.deepEqual(await json(response), { error: "upstream_unavailable" });
  assert.equal(
    response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.failureClass),
    "provider_http_error",
  );
  assert.equal(
    response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.upstreamStatus),
    "503",
  );
  assert.equal(
    response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.stage),
    "analysis",
  );
  assert.equal(
    response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.callOrdinal),
    "1",
  );
  assert.equal(JSON.stringify([...response.headers]).includes(privateBody), false);

  const successfulQualification = await createLatticeApiWorker({
    runTextToLatticeImpl: async () => validLatticeResult(),
  }).fetch(
    apiRequest(validPayload, { headers: diagnosticHeaders }),
    activeQualification,
  );
  assert.equal(successfulQualification.status, 200);
  for (const header of Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)) {
    assert.equal(successfulQualification.headers.has(header), false);
  }

  const qualificationCutoff = Date.parse(activeQualification[LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]);
  let diagnosticClock = qualificationCutoff - 1;
  let cutoffDeadline;
  const cutoffWorker = createFailureWorker({
    fetchImpl: async () => {
      diagnosticClock = qualificationCutoff;
      return new Response(null, { status: 503 });
    },
    now: () => diagnosticClock,
    scheduleTimeout(callback, milliseconds) {
      assert.equal(cutoffDeadline, undefined);
      const deadline = { milliseconds, canceled: false, fired: false };
      deadline.callback = () => {
        deadline.fired = true;
        callback();
      };
      cutoffDeadline = deadline;
      return cutoffDeadline;
    },
    cancelTimeout(deadline) {
      assert.equal(deadline, cutoffDeadline);
      deadline.canceled = true;
    },
  });
  const cutoff = await cutoffWorker.fetch(
    apiRequest(validPayload, { headers: diagnosticHeaders }),
    activeQualification,
  );
  assert.equal(cutoff.status, 502);
  assert.deepEqual(await json(cutoff), { error: "upstream_unavailable" });
  assert.equal(cutoffDeadline.milliseconds, 1);
  assert.equal(cutoffDeadline.fired, false);
  assert.equal(cutoffDeadline.canceled, true);
  for (const header of Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)) {
    assert.equal(cutoff.headers.has(header), false);
  }

  let expiredProviderCalls = 0;
  const expiredWorker = createFailureWorker({
    fetchImpl: async () => {
      expiredProviderCalls += 1;
      return new Response(null, { status: 503 });
    },
    now: () => Date.parse("2100-01-01T00:00:00.000Z"),
  });
  const expired = await expiredWorker.fetch(
    apiRequest(validPayload, { headers: diagnosticHeaders }),
    activeQualification,
  );
  assert.equal(expired.status, 503);
  assert.deepEqual(await json(expired), { error: "upstream_unavailable" });
  assert.equal(expiredProviderCalls, 0);
  for (const header of Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)) {
    assert.equal(expired.headers.has(header), false);
  }
});

test("a provider failure after setup does not rotate or reissue the quota cookie", async () => {
  let admissions = 0;
  const worker = createProductionLatticeApiWorker({
    enforceRateLimit: async () => {},
    admitTransformation: async (_namespace, visitorId) => {
      admissions += 1;
      assert.match(visitorId, /^[A-Za-z0-9_-]{24}$/u);
      return { allowed: true, retryAfterSeconds: null };
    },
    fetchImpl: async () => assert.fail("the injected provider failure does not use the network"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => {
      throw new LatticeProviderError("provider_timeout", "private timeout");
    },
  });
  const env = {
    HF_TOKEN: "server_only_token",
    VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
  };
  const setup = await worker.fetch(visitorSessionRequest(), env);
  const cookieValue = setup.headers.get("set-cookie").split(";", 1)[0].split("=", 2)[1];
  const response = await worker.fetch(apiRequest(validPayload, { visitorCookie: cookieValue }), env);
  assert.equal(response.status, 504);
  assert.deepEqual(await json(response), { error: "upstream_timeout" });
  assert.equal(admissions, 1);
  assert.equal(response.headers.has("set-cookie"), false);
});

test("the exact UTC-day policy admits 30 transformations globally and 3 per cooperating cookie jar", () => {
  const dayStart = Date.UTC(2026, 8, 14);
  let state;
  for (let visitorIndex = 0; visitorIndex < 10; visitorIndex += 1) {
    const visitorId = capacityVisitor(visitorIndex);
    for (let requestIndex = 0; requestIndex < LATTICE_TRANSFORMATIONS_PER_VISITOR_UTC_DAY; requestIndex += 1) {
      const outcome = claimLatticeTransformation(state, {
        now: dayStart + visitorIndex * 1_000 + requestIndex,
        visitorId,
      });
      assert.deepEqual(outcome.result, {
        allowed: true,
        scope: null,
        retryAfterSeconds: null,
      });
      assert.equal(outcome.stateChanged, true);
      state = outcome.state;
    }
    if (visitorIndex === 0) {
      const denied = claimLatticeTransformation(state, {
        now: dayStart + 10_000,
        visitorId,
      });
      assert.equal(denied.result.allowed, false);
      assert.equal(denied.result.scope, "visitor-day");
      assert.equal(denied.stateChanged, false);
    }
  }
  assert.equal(state.acceptedTransformations, LATTICE_TRANSFORMATIONS_PER_UTC_DAY);
  assert.equal(Object.keys(state.visitorTransformations).length, 10);
  assert.equal(latticeTransformationStateExpiresAt(state), dayStart + 24 * 60 * 60_000);

  const globalDenial = claimLatticeTransformation(state, {
    now: dayStart + 20_000,
    visitorId: capacityVisitor(10),
  });
  assert.equal(globalDenial.result.allowed, false);
  assert.equal(globalDenial.result.scope, "global-day");
  assert.equal(globalDenial.result.retryAfterSeconds, 86_380);
  assert.equal(globalDenial.stateChanged, false);

  const nextDay = claimLatticeTransformation(state, {
    now: dayStart + 24 * 60 * 60_000,
    visitorId: capacityVisitor(0),
  });
  assert.equal(nextDay.result.allowed, true);
  assert.equal(nextDay.state.acceptedTransformations, 1);
  assert.deepEqual(nextDay.state.visitorTransformations, { [capacityVisitor(0)]: 1 });
});

test("the transformation policy fails closed for malformed state, identity, totals, and clock regression", () => {
  const now = Date.UTC(2026, 8, 14);
  const valid = claimLatticeTransformation(undefined, {
    now,
    visitorId: capacityVisitor(0),
  }).state;
  for (const malformed of [
    null,
    {},
    { ...valid, source: validPayload.text },
    { ...valid, version: 2 },
    { ...valid, acceptedTransformations: -1 },
    { ...valid, acceptedTransformations: LATTICE_TRANSFORMATIONS_PER_UTC_DAY + 1 },
    { ...valid, acceptedTransformations: 2 },
    { ...valid, visitorTransformations: { invalid: 1 } },
    { ...valid, visitorTransformations: { [capacityVisitor(0)]: 0 } },
    { ...valid, visitorTransformations: { [capacityVisitor(0)]: 4 } },
    { ...valid, dayStartedAt: valid.dayStartedAt + 1 },
  ]) {
    assert.throws(() => claimLatticeTransformation(malformed, {
      now,
      visitorId: capacityVisitor(1),
    }), TypeError);
  }
  assert.throws(() => claimLatticeTransformation(valid, {
    now: now - 60_000,
    visitorId: capacityVisitor(1),
  }), /clock moved backwards/u);
  assert.throws(() => claimLatticeTransformation(valid, {
    now,
    visitorId: "invalid",
  }), TypeError);
});

test("the capacity client sends one bodyless pseudonymous claim to one global object", async () => {
  const events = [];
  const namespace = {
    getByName(name) {
      events.push({ name });
      return {
        async fetch(request) {
          events.push({ request });
          return new Response(JSON.stringify({ allowed: true, schema_version: 1 }), {
            status: 200,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          });
        },
      };
    },
  };
  assert.deepEqual(await claimGlobalLatticeTransformation(namespace, TEST_VISITOR_ID), {
    allowed: true,
    retryAfterSeconds: null,
  });
  assert.equal(events[0].name, LATTICE_TRANSFORMATION_CAPACITY_OBJECT_NAME);
  const request = events[1].request;
  assert.equal(request.url, LATTICE_TRANSFORMATION_CAPACITY_INTERNAL_URL);
  assert.equal(request.method, "POST");
  assert.equal(request.body, null);
  assert.equal(request.headers.get(LATTICE_TRANSFORMATION_VISITOR_HEADER), TEST_VISITOR_ID);
  assert.equal(request.credentials, "omit");
  assert.equal(request.cache, "no-store");
  assert.equal(request.redirect, "manual");
  assert.equal(request.referrer, "");
  assert.equal(request.headers.has("origin"), false);
  assert.equal(request.headers.has("referer"), false);
  assert.equal(request.headers.has("cookie"), false);
  assert.equal(request.headers.has("authorization"), false);
  assert.equal(JSON.stringify(events[0]).includes(validPayload.text), false);
});

test("global and visitor daily denials are closed and malformed capacity responses fail", async () => {
  const namespaceFor = (value, status = 429, contentType = "application/json") => ({
    getByName: () => ({
      fetch: async () => new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": contentType },
      }),
    }),
  });
  assert.deepEqual(await claimGlobalLatticeTransformation(namespaceFor({
    allowed: false,
    scope: "visitor-day",
    retry_after_seconds: 27,
    schema_version: 1,
  }), TEST_VISITOR_ID), { allowed: false, retryAfterSeconds: 27 });
  assert.deepEqual(await claimGlobalLatticeTransformation(namespaceFor({
    allowed: false,
    scope: "global-day",
    retry_after_seconds: 40_000,
    schema_version: 1,
  }), TEST_VISITOR_ID), { allowed: false, retryAfterSeconds: null });

  for (const malformed of [
    undefined,
    {},
    { getByName: () => ({}) },
    namespaceFor({ allowed: true, schema_version: 1, extra: true }, 200),
    namespaceFor({ allowed: false, scope: "global-day", retry_after_seconds: 0, schema_version: 1 }),
    namespaceFor({ allowed: false, scope: "thirty-day", retry_after_seconds: 20, schema_version: 1 }),
    namespaceFor({ allowed: true, schema_version: 1 }, 200, "text/plain"),
  ]) {
    await assert.rejects(
      () => claimGlobalLatticeTransformation(malformed, TEST_VISITOR_ID),
      /capacity gate is unavailable/u,
    );
  }
  await assert.rejects(
    () => claimGlobalLatticeTransformation(namespaceFor({ allowed: true, schema_version: 1 }, 200), "invalid"),
    /capacity gate is unavailable/u,
  );
});

test("one admitted transformation can complete multiple provider stages without another quota claim", async () => {
  const events = [];
  const worker = createLatticeApiWorker({
    async admitTransformation(namespace, visitorId) {
      assert.equal(namespace, "transformation-budget-binding");
      assert.equal(visitorId, TEST_VISITOR_ID);
      events.push("admission");
      return { allowed: true, retryAfterSeconds: null };
    },
    fetchImpl: async () => {
      events.push("provider-fetch");
      return successfulProviderResponse({
        documentKind: "instruction",
        passages: [],
        questions: [],
      });
    },
    async runTextToLatticeImpl(_text, { adapter }) {
      await adapter.analyze(minimalAnalysisRequest());
      await adapter.analyze(minimalAnalysisRequest());
      return validLatticeResult();
    },
  });
  const response = await worker.fetch(apiRequest(), {
    HF_TOKEN: "server_only_token",
    LATTICE_TRANSFORMATION_BUDGET: "transformation-budget-binding",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(events, ["admission", "provider-fetch", "provider-fetch"]);
});

test("the production request admission fails closed on a missing or exhausted Durable Object binding", async () => {
  const rateLimiter = { limit: async () => ({ success: true }) };
  const runOneProviderCall = async (_text, { adapter }) => {
    await adapter.analyze(minimalAnalysisRequest());
    return validLatticeResult();
  };

  const allowedEvents = [];
  const allowedWorker = createProductionLatticeApiWorker({
    async fetchImpl() {
      allowedEvents.push("provider-fetch");
      return successfulProviderResponse();
    },
    runTextToLatticeImpl: runOneProviderCall,
  });
  const allowedCapacity = {
    getByName(name) {
      assert.equal(name, LATTICE_TRANSFORMATION_CAPACITY_OBJECT_NAME);
      return {
        async fetch(request) {
          allowedEvents.push("transformation-admission");
          assert.equal(request.body, null);
          assert.match(
            request.headers.get(LATTICE_TRANSFORMATION_VISITOR_HEADER),
            /^[A-Za-z0-9_-]{24}$/u,
          );
          return new Response(JSON.stringify({ allowed: true, schema_version: 1 }), {
            status: 200,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          });
        },
      };
    },
  };
  const productionVisitor = await establishLatticeApiVisitor(new Headers(), TEST_VISITOR_SECRET);
  const allowedResponse = await allowedWorker.fetch(apiRequest(validPayload, {
    visitorCookie: productionVisitor.cookieValue,
  }), {
    HF_TOKEN: "server_only_token",
    VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
    LATTICE_API_RATE_LIMITER: rateLimiter,
    LATTICE_TRANSFORMATION_BUDGET: allowedCapacity,
  });
  assert.equal(allowedResponse.status, 200);
  assert.deepEqual(allowedEvents, ["transformation-admission", "provider-fetch"]);
  assert.equal(allowedResponse.headers.has("set-cookie"), false);

  let deniedFetches = 0;
  const deniedWorker = createProductionLatticeApiWorker({
    async fetchImpl() {
      deniedFetches += 1;
      return successfulProviderResponse();
    },
    runTextToLatticeImpl: runOneProviderCall,
  });
  const deniedCapacity = {
    getByName: () => ({
      fetch: async () => new Response(JSON.stringify({
        allowed: false,
        scope: "global-day",
        retry_after_seconds: 60_000,
        schema_version: 1,
      }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    }),
  };
  const deniedResponse = await deniedWorker.fetch(apiRequest(validPayload, {
    visitorCookie: productionVisitor.cookieValue,
  }), {
    HF_TOKEN: "server_only_token",
    VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
    LATTICE_API_RATE_LIMITER: rateLimiter,
    LATTICE_TRANSFORMATION_BUDGET: deniedCapacity,
  });
  assert.equal(deniedResponse.status, 429);
  assert.deepEqual(await json(deniedResponse), { error: "rate_limited" });
  assert.equal(deniedFetches, 0);

  const missingResponse = await deniedWorker.fetch(apiRequest(validPayload, {
    visitorCookie: productionVisitor.cookieValue,
  }), {
    HF_TOKEN: "server_only_token",
    VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
    LATTICE_API_RATE_LIMITER: rateLimiter,
  });
  assert.equal(missingResponse.status, 500);
  assert.deepEqual(await json(missingResponse), { error: "internal_error" });
  assert.equal(deniedFetches, 0);
});

test("the serialized provider request is byte-bounded before external fetch", async () => {
  let fetches = 0;
  const baseOptions = providerRequestOptions(async () => {
    fetches += 1;
    return successfulProviderResponse();
  });
  const preContractBody = JSON.stringify({
    model: LATTICE_REMOTE_MODELS.generator,
    messages: baseOptions.messages,
    response_format: { type: "json_object" },
    chat_template_kwargs: { enable_thinking: false },
    max_tokens: baseOptions.maxTokens,
    temperature: baseOptions.temperature,
    top_p: baseOptions.topP,
    seed: 71_903,
    stream: false,
  });
  await assert.rejects(
    requestHuggingFaceJson({
      ...baseOptions,
      maximumRequestBytes: new TextEncoder().encode(preContractBody).byteLength,
    }),
    (error) => error instanceof LatticeProviderError
      && error.code === "provider_request_too_large",
  );
  assert.equal(fetches, 0);
  assert.equal(LATTICE_PROVIDER_REQUEST_BYTE_LIMIT, 1_048_576);
});

test("the whole-request deadline bounds a pipeline that ignores abort", async () => {
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("the injected pipeline does not use the network"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => new Promise(() => {}),
    requestTimeoutMs: 10,
  });
  const response = await worker.fetch(apiRequest(), { HF_TOKEN: "unused" });
  assert.equal(response.status, 504);
  assert.deepEqual(await json(response), { error: "upstream_timeout" });
});

test("the whole-request deadline is not extended by request-body cancellation", async () => {
  const never = () => new Promise(() => {});
  const requestBody = new ReadableStream({
    pull: never,
    cancel: never,
  });
  const request = new Request(`${LATTICE_API_ORIGIN}${LATTICE_API_PATH}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Cookie: `${LATTICE_API_VISITOR_COOKIE_NAME}=${TEST_VISITOR_COOKIE_VALUE}`,
      Origin: LATTICE_API_ORIGIN,
      "Content-Type": "application/json",
    },
    body: requestBody,
    duplex: "half",
  });
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("an incomplete request must not use the network"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => assert.fail("an incomplete request must not run the pipeline"),
    requestTimeoutMs: 10,
  });

  const outcome = await Promise.race([
    worker.fetch(request, { HF_TOKEN: "unused" }),
    new Promise((resolve) => setTimeout(() => resolve(null), 250)),
  ]);
  assert.ok(outcome instanceof Response);
  assert.equal(outcome.status, 504);
  assert.deepEqual(await json(outcome), { error: "upstream_timeout" });
});

test("server sources store only aggregate capacity, with no content logging, fallback, or embedded token", async () => {
  const workerSource = await readFile(new URL("../workers/text-to-lattice-api/worker.js", import.meta.url), "utf8");
  const adapterSource = await readFile(new URL("../workers/text-to-lattice-api/huggingFaceAdapter.js", import.meta.url), "utf8");
  const capacityClientSource = await readFile(new URL("../workers/text-to-lattice-api/capacityClient.js", import.meta.url), "utf8");
  const capacityGateSource = await readFile(new URL("../workers/text-to-lattice-api/capacityGate.js", import.meta.url), "utf8");
  const capacityPolicySource = await readFile(new URL("../workers/text-to-lattice-api/capacityPolicy.js", import.meta.url), "utf8");
  const visitorCookieSource = await readFile(new URL("../workers/text-to-lattice-api/visitorCookie.js", import.meta.url), "utf8");
  const entrySource = await readFile(new URL("../workers/text-to-lattice-api/entry.js", import.meta.url), "utf8");
  const wrangler = JSON.parse(await readFile(
    new URL("../workers/text-to-lattice-api/wrangler.jsonc", import.meta.url),
    "utf8",
  ));
  const sources = [
    workerSource,
    adapterSource,
    capacityClientSource,
    capacityGateSource,
    capacityPolicySource,
    visitorCookieSource,
    entrySource,
  ].join("\n");

  assert.doesNotMatch(sources, /\bconsole\s*\./u);
  assert.doesNotMatch(sources, /\b(?:localStorage|sessionStorage|indexedDB|caches\.(?:open|default)|env\.(?:KV|DB|D1|R2))\b/u);
  assert.doesNotMatch(sources, /hf_[A-Za-z0-9]{8,}/u);
  assert.equal(sources.split(HUGGING_FACE_CHAT_COMPLETIONS_URL).length - 1, 1);
  assert.match(workerSource, /env\.HF_TOKEN/u);
  assert.equal(wrangler.send_metrics, false);
  assert.deepEqual(wrangler.observability, { enabled: false });
  assert.deepEqual(wrangler.routes, [{ pattern: "hah.dev/api/lattice", zone_name: "hah.dev" }]);
  assert.equal(wrangler.main, "entry.js");
  assert.deepEqual(wrangler.durable_objects, { bindings: [{
    name: "LATTICE_TRANSFORMATION_BUDGET",
    class_name: "LatticeTransformationBudget",
  }] });
  assert.deepEqual(wrangler.migrations, [{
    tag: "v1",
    new_sqlite_classes: ["LatticeTransformationBudget"],
  }]);
  assert.match(entrySource, /export \{ LatticeTransformationBudget \} from "\.\/capacityGate\.js";/u);
  assert.match(entrySource, /export \{ default \} from "\.\/worker\.js";/u);
  assert.deepEqual(wrangler.ratelimits, [{
    name: "LATTICE_API_RATE_LIMITER",
    namespace_id: "857321",
    simple: { limit: 30, period: 60 },
  }]);
  assert.equal(JSON.stringify(wrangler).includes("HF_TOKEN"), false);
  assert.equal(JSON.stringify(wrangler).includes("VISITOR_COOKIE_SECRET"), false);
  assert.doesNotMatch(capacityGateSource, /\b(?:text|prompt|message|source|candidate|output|user|ip)\b/iu);
  assert.doesNotMatch(capacityClientSource, /CF-Connecting-IP|\bCookie\b|Authorization/u);
  assert.match(capacityGateSource, /transaction\(/u);
  assert.match(capacityGateSource, /this\.ctx\.storage\.setAlarm\(/u);
  assert.doesNotMatch(capacityGateSource, /\btransaction\.(?:setAlarm|deleteAlarm)\b/u);
  assert.match(capacityGateSource, /async alarm\(\)/u);
  assert.match(capacityPolicySource, /LATTICE_TRANSFORMATIONS_PER_UTC_DAY\s*=\s*30/u);
  assert.match(capacityPolicySource, /LATTICE_TRANSFORMATIONS_PER_VISITOR_UTC_DAY\s*=\s*3/u);
  assert.doesNotMatch(adapterSource, /claimProviderCall|capacityGate|capacityClient/u);
  assert.match(visitorCookieSource, /__Secure-hah-lattice-api-visitor/u);
  assert.match(visitorCookieSource, /Path=\$\{LATTICE_API_VISITOR_COOKIE_PATH\}; Secure; HttpOnly; SameSite=Strict/u);
  assert.doesNotMatch(visitorCookieSource, /Domain=/u);
  assert.match(adapterSource, /LATTICE_PROVIDER_REQUEST_BYTE_LIMIT\s*=\s*1_048_576/u);
});
