import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { preflightLatticeInput } from "../app/resume/latticeDemo.js";
import {
  LATTICE_RESULT_VERSION,
  isLatticeApiError,
} from "../app/resume/lattice/remoteProtocol.js";
import {
  HUGGING_FACE_CHAT_COMPLETIONS_URL,
  LATTICE_PROVIDER_CALL_LIMIT,
  LATTICE_REMOTE_MODELS,
  LatticeProviderError,
  createHuggingFaceLatticeAdapter,
  requestHuggingFaceJson,
} from "../workers/text-to-lattice-api/huggingFaceAdapter.js";
import {
  LATTICE_API_ORIGIN,
  LATTICE_API_PATH,
  LATTICE_API_RATE_LIMIT_KEY,
  createLatticeApiWorker as createProductionLatticeApiWorker,
} from "../workers/text-to-lattice-api/worker.js";

const validPayload = Object.freeze({
  text: "Open the document, review it, and save the approved revision.",
  requested_mode: "operative",
  schema_version: 1,
});

function createLatticeApiWorker(options = {}) {
  return createProductionLatticeApiWorker({
    enforceRateLimit: async () => {},
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
  contentType = "application/json",
  headers = {},
  raw = false,
} = {}) {
  const requestHeaders = new Headers(headers);
  if (origin !== null) requestHeaders.set("Origin", origin);
  if (contentType !== null) requestHeaders.set("Content-Type", contentType);
  const init = { method, headers: requestHeaders };
  if (method !== "GET" && method !== "HEAD") {
    init.body = raw ? body : JSON.stringify(body);
  }
  return new Request(url, init);
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
  assert.equal(response.headers.has("access-control-allow-origin"), false);
  assert.equal(events.length, 2);
  assert.equal(events[0].options.token, "server_only_token");
  assert.equal(events[0].options.requestedMode, "operative");
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

test("the adapter uses one fixed provider, strict schemas, closed clarification, fixed roles, and Qwen no-think", async () => {
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
  for (const { init, body } of calls) {
    assert.equal(init.method, "POST");
    assert.equal(init.cache, "no-store");
    assert.equal(init.credentials, "omit");
    assert.equal(init.redirect, "error");
    assert.equal(init.referrerPolicy, "no-referrer");
    assert.equal(init.headers.Authorization, "Bearer hf_server_only_token");
    assert.equal(body.stream, false);
    assert.equal(body.response_format.type, "json_schema");
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
  }
  assert.equal(calls[0].body.response_format.json_schema.schema.properties.questions.maxItems, 0);
  assert.match(calls[0].body.messages[0].content, /Requested mode: experiential/u);
  assert.match(calls[0].body.messages[0].content, /\/no_think/u);
  assert.doesNotMatch(calls[1].body.messages[0].content, /\/no_think/u);
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
    (error) => error instanceof LatticeProviderError && error.code === "provider_call_limit",
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
      () => new Response(JSON.stringify({
        choices: [{ finish_reason: "stop", message: { role: "user", content: "{\"accepted\":true}" } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
      "provider_malformed_response",
    ],
    [
      () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "" } }] }), { status: 200 }),
      "provider_malformed_response",
    ],
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

test("typed provider failures map to exact flat public errors with a bounded 429 hint", async () => {
  const cases = [
    [new LatticeProviderError("provider_timeout", "private timeout"), 504, { error: "upstream_timeout" }],
    [new LatticeProviderError("provider_unavailable", "private network error"), 502, { error: "upstream_unavailable" }],
    [new LatticeProviderError("provider_call_limit", "private budget"), 502, { error: "upstream_unavailable" }],
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
  }
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

test("server sources contain no content logging, persistence, fallback endpoint, or embedded token", async () => {
  const workerSource = await readFile(new URL("../workers/text-to-lattice-api/worker.js", import.meta.url), "utf8");
  const adapterSource = await readFile(new URL("../workers/text-to-lattice-api/huggingFaceAdapter.js", import.meta.url), "utf8");
  const wrangler = JSON.parse(await readFile(
    new URL("../workers/text-to-lattice-api/wrangler.jsonc", import.meta.url),
    "utf8",
  ));
  const sources = `${workerSource}\n${adapterSource}`;

  assert.doesNotMatch(sources, /\bconsole\s*\./u);
  assert.doesNotMatch(sources, /\b(?:localStorage|sessionStorage|indexedDB|caches\.(?:open|default)|env\.(?:KV|DB|D1|R2))\b/u);
  assert.doesNotMatch(sources, /hf_[A-Za-z0-9]{8,}/u);
  assert.equal(sources.split(HUGGING_FACE_CHAT_COMPLETIONS_URL).length - 1, 1);
  assert.match(workerSource, /env\.HF_TOKEN/u);
  assert.equal(wrangler.send_metrics, false);
  assert.deepEqual(wrangler.observability, { enabled: false });
  assert.deepEqual(wrangler.routes, [{ pattern: "hah.dev/api/lattice", zone_name: "hah.dev" }]);
  assert.deepEqual(wrangler.ratelimits, [{
    name: "LATTICE_API_RATE_LIMITER",
    namespace_id: "857321",
    simple: { limit: 10, period: 60 },
  }]);
  assert.equal(JSON.stringify(wrangler).includes("HF_TOKEN"), false);
});
