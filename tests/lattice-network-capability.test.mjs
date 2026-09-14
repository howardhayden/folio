import assert from "node:assert/strict";
import test from "node:test";

import {
  REMOTE_CAPABILITIES,
  NetworkPolicyError,
  capabilityFetch,
} from "../app/privacy/networkCapabilities.js";
import {
  LATTICE_API_PATH,
  LATTICE_BROWSER_QUOTA_LOCK_NAME,
  LATTICE_RESPONSE_BYTE_LIMIT,
  LATTICE_VISITOR_SESSION_ACCEPT,
  LatticeRemoteError,
  makeLatticeRequest,
  requestRemoteLattice,
} from "../app/resume/lattice/remoteRequest.js";

const ORIGIN = "https://hah.dev";
const words = (count) => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
const result = Object.freeze({
  version: "text-to-lattice.v7",
  status: "translated",
  text: "A returned result.",
  wordCount: 3,
  primaryLayer: "experiential",
  layerId: "experiential",
  layerLabel: "Experiential layer",
  layersUsed: ["experiential"],
  passageCount: 1,
  revisedPassageCount: 1,
  retainedPassageCount: 0,
  batchCount: 1,
  verificationPasses: 1,
  findings: [],
  questions: [],
});

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function visitorSessionResponse(headers = {}) {
  return new Response(null, { status: 204, headers });
}

function afterVisitorSession(transform) {
  return async (url, init) => init.headers.Accept === LATTICE_VISITOR_SESSION_ACCEPT
    ? visitorSessionResponse()
    : transform(url, init);
}

async function withBrowserWindow(windowValue, operation) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: windowValue,
  });
  try {
    return await operation();
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else delete globalThis.window;
  }
}

test("the production capability manifest contains one purpose-bound content route", () => {
  assert.deepEqual(REMOTE_CAPABILITIES, {
    textToLattice: {
      id: "text-to-lattice",
      allowedOrigin: "https://hah.dev",
      route: "/api/lattice",
      method: "POST",
      trigger: "explicit-user-submit",
      sameOriginOnly: true,
      transmitsUserContent: true,
      transmittedFields: ["text", "requested_mode", "schema_version"],
      retainedByApplication: false,
      credentialMode: "same-origin",
      browserOwnedCookie: {
        name: "__Secure-hah-lattice-api-visitor",
        path: "/api/lattice",
        purpose: "per-browser-utc-day-request-limit",
        httpOnly: true,
        containsUserContent: false,
        expiresAtNextUtcDay: true,
      },
      visitorSessionSetup: {
        accept: "application/vnd.hah.text-to-lattice-visitor-session.v1+json",
        sameRoute: true,
        transmitsUserContent: false,
        hasBody: false,
        hasContentType: false,
      },
      automaticRetry: false,
      alternateProviderFallback: false,
    },
  });
});

test("capabilityFetch fails closed for undeclared capabilities, origins, methods, paths, and query injection", async () => {
  const fetchImpl = () => assert.fail("denied requests must not reach fetch");
  const denied = [
    ["unknown", LATTICE_API_PATH, { method: "POST" }],
    ["text-to-lattice", "https://provider.example/transform", { method: "POST" }],
    ["text-to-lattice", `${ORIGIN}/api/lattice`, { method: "POST" }],
    ["text-to-lattice", "//hah.dev/api/lattice", { method: "POST" }],
    ["text-to-lattice", LATTICE_API_PATH, { method: "GET" }],
    ["text-to-lattice", LATTICE_API_PATH, { method: 1 }],
    ["text-to-lattice", "/api/other", { method: "POST" }],
    ["text-to-lattice", "/api/%6cattice", { method: "POST" }],
    ["text-to-lattice", "/api/lattice?target=https://provider.example", { method: "POST" }],
    ["text-to-lattice", "/api/lattice#other", { method: "POST" }],
  ];
  for (const [capability, path, init] of denied) {
    await assert.rejects(
      capabilityFetch(capability, path, init, { baseOrigin: ORIGIN, fetchImpl }),
      NetworkPolicyError,
    );
  }

  const validRequest = {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Source", requested_mode: "auto", schema_version: 1 }),
  };
  for (const baseOrigin of [
    "http://localhost:3000",
    "https://preview.hah.dev",
    "https://hah.dev/",
    "not an origin",
  ]) {
    await assert.rejects(
      capabilityFetch("text-to-lattice", LATTICE_API_PATH, validRequest, { baseOrigin, fetchImpl }),
      NetworkPolicyError,
    );
  }
});

test("capabilityFetch fixes an exact browser-owned origin and allows only its same-origin quota cookie context", async () => {
  let observed;
  await capabilityFetch("text-to-lattice", LATTICE_API_PATH, {
    method: "post",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Source", requested_mode: "auto", schema_version: 1 }),
  }, {
    baseOrigin: ORIGIN,
    fetchImpl: async (url, init) => {
      observed = { url: url.href, init };
      return jsonResponse({});
    },
  });
  assert.equal(observed.url, `${ORIGIN}/api/lattice`);
  assert.equal(observed.init.method, "POST");
  assert.equal(observed.init.credentials, "same-origin");
  assert.equal(observed.init.cache, "no-store");
  assert.equal(observed.init.redirect, "error");
  assert.equal(observed.init.keepalive, false);
  assert.equal(observed.init.mode, "same-origin");
  assert.equal(observed.init.referrer, "");
  assert.equal(observed.init.referrerPolicy, "same-origin");
  assert.deepEqual(observed.init.headers, {
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  assert.equal(Object.prototype.hasOwnProperty.call(observed.init.headers, "Origin"), false);

  for (const init of [
    { method: "POST", credentials: "include" },
    { method: "POST", credentials: "omit" },
    { method: "POST", cache: "force-cache" },
    { method: "POST", redirect: "follow" },
    { method: "POST", keepalive: true },
    { method: "POST", mode: "cors" },
    { method: "POST", referrer: "https://hah.dev/resume/" },
    { method: "POST", referrerPolicy: "no-referrer" },
  ]) {
    await assert.rejects(
      capabilityFetch("text-to-lattice", LATTICE_API_PATH, init, {
        baseOrigin: ORIGIN,
        fetchImpl: () => assert.fail("invalid transport options must fail before fetch"),
      }),
      NetworkPolicyError,
    );
  }
});

test("capabilityFetch permits only the declared bodyless visitor-session setup on the content route", async () => {
  let observed;
  await capabilityFetch("text-to-lattice", LATTICE_API_PATH, {
    method: "POST",
    headers: { Accept: LATTICE_VISITOR_SESSION_ACCEPT },
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    keepalive: false,
    mode: "same-origin",
    referrer: "",
    referrerPolicy: "same-origin",
  }, {
    baseOrigin: ORIGIN,
    fetchImpl: async (url, init) => {
      observed = { url: url.href, init };
      return visitorSessionResponse();
    },
  });

  assert.equal(observed.url, `${ORIGIN}${LATTICE_API_PATH}`);
  assert.equal(observed.init.method, "POST");
  assert.deepEqual(observed.init.headers, { Accept: LATTICE_VISITOR_SESSION_ACCEPT });
  assert.equal(Object.prototype.hasOwnProperty.call(observed.init, "body"), false);
  assert.equal(observed.init.credentials, "same-origin");
  assert.equal(observed.init.cache, "no-store");
  assert.equal(observed.init.redirect, "error");
  assert.equal(observed.init.keepalive, false);
  assert.equal(observed.init.mode, "same-origin");
  assert.equal(observed.init.referrer, "");
  assert.equal(observed.init.referrerPolicy, "same-origin");

  for (const init of [
    {
      method: "POST",
      headers: { Accept: LATTICE_VISITOR_SESSION_ACCEPT },
      body: "",
    },
    {
      method: "POST",
      headers: {
        Accept: LATTICE_VISITOR_SESSION_ACCEPT,
        "Content-Type": "application/json",
      },
    },
    {
      method: "POST",
      headers: { Accept: `${LATTICE_VISITOR_SESSION_ACCEPT}, application/json` },
    },
  ]) {
    await assert.rejects(
      capabilityFetch("text-to-lattice", LATTICE_API_PATH, init, {
        baseOrigin: ORIGIN,
        fetchImpl: () => assert.fail("invalid setup must fail before fetch"),
      }),
      NetworkPolicyError,
    );
  }
});

test("capabilityFetch rejects undeclared headers, fields, and request-init channels", async () => {
  const base = {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Source", requested_mode: "auto", schema_version: 1 }),
  };
  for (const mutation of [
    { ...base, headers: { ...base.headers, Authorization: "Bearer ambient" } },
    { ...base, headers: { "Content-Type": "application/json" } },
    { ...base, headers: { ...base.headers, Origin: ORIGIN } },
    { ...base, headers: { ...base.headers, Cookie: "ambient=1" } },
    { ...base, headers: { ...base.headers, "Content-Type": "application/json; charset=utf-8" } },
    { ...base, body: JSON.stringify({ text: "Source", requested_mode: "auto", schema_version: 1, analytics_id: "x" }) },
    { ...base, body: JSON.stringify({ text: "Source", requested_mode: "auto" }) },
    { ...base, body: JSON.stringify({ text: 1, requested_mode: "auto", schema_version: 1 }) },
    { ...base, body: JSON.stringify({ text: "Source", requested_mode: "interpretive", schema_version: 1 }) },
    { ...base, keepalive: true },
    { ...base, referrer: "https://hah.dev/resume/" },
    { ...base, integrity: "sha256-undeclared" },
  ]) {
    await assert.rejects(
      capabilityFetch("text-to-lattice", LATTICE_API_PATH, mutation, {
        baseOrigin: ORIGIN,
        fetchImpl: () => assert.fail("invalid context must fail before fetch"),
      }),
      NetworkPolicyError,
    );
  }
});

test("the request constructor emits only the three allowed fields and enforces modes", () => {
  assert.deepEqual(makeLatticeRequest("  Source words.  "), {
    text: "  Source words.  ",
    requested_mode: "auto",
    schema_version: 1,
  });
  assert.deepEqual(Object.keys(makeLatticeRequest("Source", "operative")), [
    "text", "requested_mode", "schema_version",
  ]);
  assert.deepEqual(makeLatticeRequest("Source", "experiential"), {
    text: "Source",
    requested_mode: "experiential",
    schema_version: 1,
  });
  assert.throws(() => makeLatticeRequest("Source", "interpretive"), LatticeRemoteError);
  assert.throws(() => makeLatticeRequest("   "), /at least one word/u);
});

test("700 words pass and 701 words fail before any network transmission", async () => {
  assert.equal(makeLatticeRequest(words(700)).text, words(700));
  let calls = 0;
  await assert.rejects(
    requestRemoteLattice(words(701), {
      baseOrigin: ORIGIN,
      fetchImpl: async () => { calls += 1; return jsonResponse({ result, schema_version: 1 }); },
    }),
    /accepts up to 700 words/u,
  );
  assert.equal(calls, 0);
});

test("text existence, typing, and paste do not invoke transport; explicit request invokes setup then one content POST", async () => {
  let input = "";
  const calls = [];
  input = "typed";
  input += " pasted";
  assert.equal(calls.length, 0);

  const returned = await requestRemoteLattice(input, {
    baseOrigin: ORIGIN,
    fetchImpl: async (url, init) => {
      calls.push({ url: url.href, init });
      assert.equal(url.href, `${ORIGIN}/api/lattice`);
      assert.equal(init.method, "POST");
      assert.equal(init.credentials, "same-origin");
      if (calls.length === 1) {
        assert.deepEqual(init.headers, { Accept: LATTICE_VISITOR_SESSION_ACCEPT });
        assert.equal(Object.prototype.hasOwnProperty.call(init, "body"), false);
        assert.equal(Object.prototype.hasOwnProperty.call(init.headers, "Content-Type"), false);
        return visitorSessionResponse();
      }
      assert.deepEqual(JSON.parse(init.body), {
        text: "typed pasted",
        requested_mode: "auto",
        schema_version: 1,
      });
      return jsonResponse({ result, schema_version: 1 });
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(returned.text, result.text);
});

test("an origin-wide browser lock serializes concurrent submissions through the first cookie lifecycle", async () => {
  const lockCalls = [];
  let lockTail = Promise.resolve();
  const lockManager = {
    async query() {
      return { held: [], pending: [] };
    },
    request(name, options, callback) {
      lockCalls.push({ name, options });
      const turn = lockTail.then(() => callback({ name, mode: "exclusive" }));
      lockTail = turn.catch(() => {});
      return turn;
    },
  };
  let releaseFirstBody;
  const firstBodyReady = new Promise((resolve) => { releaseFirstBody = resolve; });
  let announceFirstFetch;
  const firstFetchStarted = new Promise((resolve) => { announceFirstFetch = resolve; });
  let firstContentLifecycleComplete = false;
  const transmitted = [];

  await withBrowserWindow({
    location: { origin: ORIGIN },
    navigator: { locks: lockManager },
  }, async () => {
    const fetchImpl = async (url, init) => {
      const setup = init.headers.Accept === LATTICE_VISITOR_SESSION_ACCEPT;
      transmitted.push({
        url: url.href,
        operation: setup ? "visitor-session-setup" : "content",
        body: setup ? null : JSON.parse(init.body),
      });
      if (setup) {
        assert.equal(Object.prototype.hasOwnProperty.call(init, "body"), false);
        assert.equal(Object.prototype.hasOwnProperty.call(init.headers, "Content-Type"), false);
        if (transmitted.length > 2) assert.equal(firstContentLifecycleComplete, true);
        return visitorSessionResponse();
      }
      if (transmitted.filter(({ operation }) => operation === "content").length === 1) {
        announceFirstFetch();
        return new Response(new ReadableStream({
          async start(controller) {
            await firstBodyReady;
            firstContentLifecycleComplete = true;
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ result, schema_version: 1 })));
            controller.close();
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      assert.equal(firstContentLifecycleComplete, true);
      return jsonResponse({ result, schema_version: 1 });
    };

    const first = requestRemoteLattice("First source", { fetchImpl });
    await firstFetchStarted;
    const second = requestRemoteLattice("Second source", { fetchImpl });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(transmitted.length, 2);

    releaseFirstBody();
    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.equal(firstResult.text, result.text);
    assert.equal(secondResult.text, result.text);
  });

  assert.equal(lockCalls.length, 2);
  assert.ok(lockCalls.every(({ name }) => name === LATTICE_BROWSER_QUOTA_LOCK_NAME));
  assert.ok(lockCalls.every(({ options }) => options.mode === "exclusive"
    && options.signal instanceof AbortSignal));
  assert.deepEqual(transmitted, [
    {
      url: `${ORIGIN}${LATTICE_API_PATH}`,
      operation: "visitor-session-setup",
      body: null,
    },
    {
      url: `${ORIGIN}${LATTICE_API_PATH}`,
      operation: "content",
      body: { text: "First source", requested_mode: "auto", schema_version: 1 },
    },
    {
      url: `${ORIGIN}${LATTICE_API_PATH}`,
      operation: "visitor-session-setup",
      body: null,
    },
    {
      url: `${ORIGIN}${LATTICE_API_PATH}`,
      operation: "content",
      body: { text: "Second source", requested_mode: "auto", schema_version: 1 },
    },
  ]);
});

test("a browser without a conforming quota lock manager fails before transmitting content", async () => {
  let calls = 0;
  await withBrowserWindow({
    location: { origin: ORIGIN },
    navigator: {},
  }, async () => {
    await assert.rejects(
      requestRemoteLattice("Never transmitted", {
        fetchImpl: async () => {
          calls += 1;
          return jsonResponse({ result, schema_version: 1 });
        },
      }),
      (error) => error instanceof LatticeRemoteError
        && error.code === "network_failure",
    );
  });
  assert.equal(calls, 0);
});

test("visitor-session setup failure sends no content request and is bounded for the interface", async () => {
  const requests = [];
  await assert.rejects(
    requestRemoteLattice("Must remain local", {
      baseOrigin: ORIGIN,
      fetchImpl: async (url, init) => {
        requests.push({ url: url.href, init });
        return jsonResponse({ error: "internal_error" }, 500);
      },
    }),
    (error) => error instanceof LatticeRemoteError
      && error.code === "visitor_session_required"
      && error.status === 500
      && error.retryable === false,
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `${ORIGIN}${LATTICE_API_PATH}`);
  assert.deepEqual(requests[0].init.headers, { Accept: LATTICE_VISITOR_SESSION_ACCEPT });
  assert.equal(Object.prototype.hasOwnProperty.call(requests[0].init, "body"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(requests[0].init.headers, "Content-Type"), false);
});

test("a missing setup cookie is rejected once before provider processing without duplicating content", async () => {
  const requests = [];
  await assert.rejects(
    requestRemoteLattice("One content request", {
      baseOrigin: ORIGIN,
      fetchImpl: async (url, init) => {
        requests.push({
          url: url.href,
          accept: init.headers.Accept,
          body: Object.prototype.hasOwnProperty.call(init, "body") ? init.body : null,
        });
        if (requests.length === 1) return visitorSessionResponse();
        return jsonResponse({ error: "visitor_session_required" }, 428);
      },
    }),
    (error) => error instanceof LatticeRemoteError
      && error.code === "visitor_session_required"
      && error.status === 428
      && error.retryable === false,
  );
  assert.deepEqual(requests, [
    {
      url: `${ORIGIN}${LATTICE_API_PATH}`,
      accept: LATTICE_VISITOR_SESSION_ACCEPT,
      body: null,
    },
    {
      url: `${ORIGIN}${LATTICE_API_PATH}`,
      accept: "application/json",
      body: JSON.stringify({
        text: "One content request",
        requested_mode: "auto",
        schema_version: 1,
      }),
    },
  ]);
});

test("remote lifecycle exposes validating, submitting, processing, and success", async () => {
  const states = [];
  await requestRemoteLattice("Source", {
    baseOrigin: ORIGIN,
    onState: (state) => states.push(state),
    fetchImpl: afterVisitorSession(async () => jsonResponse({ result, schema_version: 1 })),
  });
  assert.deepEqual(states, ["validating", "submitting", "processing", "success"]);
});

test("the response boundary is structural across realms and accepts the declared JSON charset", async () => {
  const response = {
    status: 200,
    headers: new Headers({ "Content-Type": "application/json; charset=UTF-8" }),
    body: null,
    text: async () => JSON.stringify({ result, schema_version: 1 }),
  };
  const returned = await requestRemoteLattice("Source", {
    baseOrigin: ORIGIN,
    fetchImpl: afterVisitorSession(async () => response),
  });
  assert.equal(returned.text, result.text);
});

test("remote errors retain a bounded machine-readable taxonomy", async () => {
  for (const [status, payload, expected, retryable] of [
    [400, { error: "invalid_request" }, "invalid_request", false],
    [428, { error: "visitor_session_required" }, "visitor_session_required", false],
    [413, { error: "input_too_large" }, "input_too_large", false],
    [429, { error: "rate_limited", retry_after_seconds: 17 }, "rate_limited", true],
    [504, { error: "upstream_timeout" }, "upstream_timeout", true],
    [502, { error: "upstream_unavailable" }, "upstream_unavailable", true],
    [503, { error: "upstream_unavailable" }, "upstream_unavailable", true],
    [502, { error: "malformed_upstream_response" }, "malformed_upstream_response", false],
    [500, { error: "internal_error" }, "internal_error", false],
    [415, { error: "unsupported_media_type" }, "unsupported_media_type", false],
  ]) {
    let calls = 0;
    await assert.rejects(
      requestRemoteLattice("Source", {
        baseOrigin: ORIGIN,
        fetchImpl: afterVisitorSession(async () => {
          calls += 1;
          return jsonResponse(payload, status, { "Retry-After": "99" });
        }),
      }),
      (error) => {
        assert.equal(error.code, expected);
        assert.equal(error.retryable, retryable);
        if (expected === "rate_limited") assert.equal(error.retryAfterSeconds, 17);
        return true;
      },
    );
    assert.equal(calls, 1, `${payload.error} content must not be retried automatically`);
  }
});

test("HTML, malformed JSON, wrong envelopes, statuses, and oversized bodies fail closed", async () => {
  const oversized = "x".repeat(LATTICE_RESPONSE_BYTE_LIMIT + 1);
  const responses = [
    new Response("<html>failure</html>", { status: 502, headers: { "Content-Type": "text/html" } }),
    new Response("{}", { status: 502, headers: { "Content-Type": "application/jsonp" } }),
    new Response("{", { status: 200, headers: { "Content-Type": "application/json" } }),
    jsonResponse({ error: "unknown_internal_detail" }, 500),
    jsonResponse({ error: "internal_error", detail: "private" }, 500),
    jsonResponse({ error: "upstream_unavailable", retry_after_seconds: 17 }, 502),
    jsonResponse({ result, schema_version: 1 }, 201),
    jsonResponse({ result }),
    jsonResponse({ result: { ...result, wordCount: -1 }, schema_version: 1 }),
    jsonResponse({ result: { ...result, extra: true }, schema_version: 1 }),
    jsonResponse({ result: { ...result, version: "text-to-lattice.remote.v1" }, schema_version: 1 }),
    jsonResponse({ result: { ...result, questions: ["Send more source text."] }, schema_version: 1 }),
    jsonResponse({ result: { ...result, status: "translated", text: null }, schema_version: 1 }),
    jsonResponse({
      result: {
        ...result,
        findings: [{ id: "finding:1", passageId: "passage:1", atomIds: ["atom:1"], message: "detail" }],
      },
      schema_version: 1,
    }),
    new Response(oversized, { status: 200, headers: { "Content-Type": "application/json" } }),
    new Response("{}", {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(LATTICE_RESPONSE_BYTE_LIMIT + 1),
      },
    }),
  ];
  for (const response of responses) {
    await assert.rejects(
      requestRemoteLattice("Source", {
        baseOrigin: ORIGIN,
        fetchImpl: afterVisitorSession(async () => response),
      }),
      (error) => error instanceof LatticeRemoteError && error.code === "invalid_response",
    );
  }
});

test("an already-canceled request never reaches transport", async () => {
  const controller = new AbortController();
  const states = [];
  let calls = 0;
  controller.abort();
  await assert.rejects(
    requestRemoteLattice("Source", {
      baseOrigin: ORIGIN,
      signal: controller.signal,
      onState: (state) => states.push(state),
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ result, schema_version: 1 });
      },
    }),
    (error) => error?.name === "AbortError",
  );
  assert.equal(calls, 0);
  assert.deepEqual(states, ["validating"]);
});

test("client timeout settles an uncooperative transport and makes no automatic retry", async () => {
  let calls = 0;
  await assert.rejects(
    requestRemoteLattice("Source", {
      baseOrigin: ORIGIN,
      timeoutMs: 5,
      fetchImpl: afterVisitorSession(async () => {
        calls += 1;
        await new Promise(() => {});
      }),
    }),
    (error) => error instanceof LatticeRemoteError
      && error.code === "client_timeout"
      && error.retryable === true,
  );
  assert.equal(calls, 1);
});

test("caller cancellation and timeout settle stalled response bodies without success", async () => {
  for (const canceledByCaller of [true, false]) {
    const controller = new AbortController();
    const states = [];
    let bodyCanceled = false;
    let pullStarted = false;
    await assert.rejects(
      requestRemoteLattice("Source", {
        baseOrigin: ORIGIN,
        signal: controller.signal,
        timeoutMs: 10,
        onState: (state) => states.push(state),
        fetchImpl: afterVisitorSession(async () => new Response(new ReadableStream({
          pull() {
            if (pullStarted) return;
            pullStarted = true;
            if (canceledByCaller) queueMicrotask(() => controller.abort());
          },
          cancel() {
            bodyCanceled = true;
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })),
      }),
      (error) => canceledByCaller
        ? error?.name === "AbortError"
        : error instanceof LatticeRemoteError && error.code === "client_timeout",
    );
    assert.equal(bodyCanceled, true);
    assert.deepEqual(states, ["validating", "submitting", "processing"]);
  }
});
