import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as tick } from "node:timers/promises";
import { runTextToLattice } from "../app/resume/latticeDemo.js";
import { LATTICE_RESULT_VERSION } from "../app/resume/lattice/remoteProtocol.js";
import {
  LATTICE_SERVICE_EVENTS_MIME,
  LATTICE_SERVICE_PHASE_LIMIT,
  LATTICE_SERVICE_PHASES,
} from "../app/resume/lattice/serviceTelemetry.js";
import { createLatticeApiWorker } from "../workers/text-to-lattice-api/worker.js";
import { LatticeProviderError } from "../workers/text-to-lattice-api/huggingFaceAdapter.js";

const payload = { text: "Open the document, review it, and save the approved revision.", requested_mode: "operative", schema_version: 1 };
const env = { HF_TOKEN: "test-only-token", VISITOR_COOKIE_SECRET: "test-only-secret" };
const result = (text = "Review the document, then save the approved revision.") => ({
  version: LATTICE_RESULT_VERSION, status: "translated", text,
  wordCount: text.trim().split(/\s+/u).length,
  primaryLayer: "operative", layerId: "operative", layerLabel: "Operative layer",
  layersUsed: ["operative"], passageCount: 1, revisedPassageCount: 1,
  retainedPassageCount: 0, batchCount: 1, verificationPasses: 1, findings: [], questions: [],
});
const request = (accept = LATTICE_SERVICE_EVENTS_MIME, headers = {}, signal) => new Request("https://hah.dev/api/lattice", {
  method: "POST", headers: {
    Origin: "https://hah.dev", Accept: accept, "Content-Type": "application/json",
    Cookie: "__Secure-hah-lattice-api-visitor=test-cookie", ...headers,
  },
  body: JSON.stringify(payload), signal,
});
const worker = (options = {}) => createLatticeApiWorker({
  enforceRateLimit: async () => {},
  admitTransformation: async () => ({ allowed: true, retryAfterSeconds: null }),
  resolveVisitor: async () => ({ visitorId: "A".repeat(24), cookieValue: "test-cookie" }),
  createAdapter: () => ({}),
  runTextToLatticeImpl: async () => result(),
  ...options,
});
const frames = async (response) => {
  const text = await response.text();
  assert.ok(text.endsWith("\n"));
  assert.equal(new TextEncoder().encode(text).byteLength <= 262_144, true);
  return text.slice(0, -1).split("\n").map((line, index) => {
    const frame = JSON.parse(line);
    assert.equal(frame.sequence, index + 1);
    return frame;
  });
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const clock = () => {
  let callback;
  let disposed = 0;
  return {
    scheduleTimeout: (value) => { callback = value; return 1; },
    cancelTimeout: () => { disposed += 1; },
    fire: () => callback(),
    disposed: () => disposed,
  };
};

test("admitted stream exposes only real hook phases before the result settles", async () => {
  const gate = deferred();
  const timer = clock();
  let observer;
  let settled = false;
  let extraReads = 0;
  const response = await worker({ ...timer, runTextToLatticeImpl: async (_text, options) => {
    observer = options.onProgress;
    observer({ phase: "atomizing", get text() { extraReads += 1; throw Error("PRIVATE"); } });
    observer({ phase: "atomizing", current: 1, total: 7, batchId: "PRIVATE" });
    await gate.promise;
    observer({ phase: "verifying", text: "PRIVATE", progress: 0.7 });
    settled = true;
    return result();
  } }).fetch(request(), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), `${LATTICE_SERVICE_EVENTS_MIME}; charset=utf-8`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'", "stream headers must preserve the held policy before a possible late qualification expiry");
  assert.equal(timer.disposed(), 0, "returning headers must not dispose the request deadline");
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.deepEqual(JSON.parse(new TextDecoder().decode(first.value)), { type: "phase", sequence: 1, phase: "atomizing" });
  assert.equal(settled, false);
  gate.resolve();
  const remaining = [];
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    remaining.push(...new TextDecoder().decode(part.value).trimEnd().split("\n").map(JSON.parse));
  }
  reader.releaseLock();
  assert.deepEqual(remaining, [
    { type: "phase", sequence: 2, phase: "verifying" },
    { type: "terminal", sequence: 3, status: 200, body: { result: result(), schema_version: 1 } },
  ]);
  assert.equal(extraReads, 0);
  assert.equal(timer.disposed(), 1);
  assert.doesNotThrow(() => observer({ phase: "unknown", text: "PRIVATE-LATE" }));
  assert.equal(timer.disposed(), 1);
});

test("default JSON omits the hook and retains the exact response envelope", async () => {
  const response = await worker({ runTextToLatticeImpl: async (_text, options) => {
    assert.equal(Object.hasOwn(options, "onProgress"), false);
    return result();
  } }).fetch(request("application/json"), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(await response.text(), JSON.stringify({ result: result(), schema_version: 1 }));
});

test("stream preadmission rejection uses original JSON and makes no pipeline call", async () => {
  let pipeline = 0;
  let admissions = 0;
  const run = worker({
    admitTransformation: async () => { admissions += 1; return { allowed: false, retryAfterSeconds: 12 }; },
    runTextToLatticeImpl: async () => { pipeline += 1; return result(); },
  });
  const diagnostic = await run.fetch(request(LATTICE_SERVICE_EVENTS_MIME, { "X-Lattice-Qualification-Diagnostic": "v22" }), env);
  assert.equal(diagnostic.status, 400);
  assert.deepEqual(await diagnostic.json(), { error: "invalid_request" });
  assert.equal(admissions, 0);
  const denied = await run.fetch(request(), env);
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get("content-type"), "application/json; charset=utf-8");
  assert.deepEqual(await denied.json(), { error: "rate_limited", retry_after_seconds: 12 });
  assert.equal(pipeline, 0);
});

test("stream errors retain existing status and bounded error semantics", async (context) => {
  for (const [error, status, body] of [
    [new LatticeProviderError("provider_timeout", "PRIVATE"), 504, { error: "upstream_timeout" }],
    [new LatticeProviderError("provider_http_error", "PRIVATE", { status: 402 }), 502, { error: "upstream_unavailable" }],
    [new LatticeProviderError("provider_http_error", "PRIVATE", { status: 429, retryAfterSeconds: 15 }), 429, { error: "rate_limited", retry_after_seconds: 15 }],
    [new LatticeProviderError("provider_malformed_response", "PRIVATE"), 502, { error: "malformed_upstream_response" }],
    [new Error("PRIVATE"), 500, { error: "internal_error" }],
  ]) await context.test(body.error, async () => {
    const response = await worker({ runTextToLatticeImpl: async (_text, { onProgress }) => {
      onProgress({ phase: "verifying" });
      throw error;
    } }).fetch(request(), env);
    assert.equal(response.status, 200, "transport admission is not transformation success");
    assert.deepEqual((await frames(response)).at(-1), { type: "terminal", sequence: 2, status, body });
  });
});

test("invalid own phase, accessor and swallowed projection errors abort the pipeline", async (context) => {
  for (const event of [{ phase: "PRIVATE" }, Object.create({ phase: "atomizing" }), { get phase() { throw Error("PRIVATE"); } }]) {
    await context.test("closed own phase required", async () => {
      let signal;
      const response = await worker({ runTextToLatticeImpl: async (_text, options) => {
        signal = options.signal;
        try { options.onProgress(event); } catch { /* Simulate an engine recovery catch. */ }
        return result();
      } }).fetch(request(), env);
      assert.equal(signal.aborted, true);
      assert.deepEqual(await frames(response), [{ type: "terminal", sequence: 1, status: 500, body: { error: "internal_error" } }]);
    });
  }
});

test("the finite queue permits128 coalesced phases and rejects129 even before a slow reader", async () => {
  for (const count of [128, 129]) {
    let signal;
    const response = await worker({ runTextToLatticeImpl: async (_text, options) => {
      signal = options.signal;
      for (let i = 0; i < count; i += 1) {
        try { options.onProgress({ phase: i % 2 ? "generating" : "atomizing" }); } catch { break; }
      }
      return result();
    } }).fetch(request(), env);
    await tick();
    const records = await frames(response);
    assert.equal(records.length, LATTICE_SERVICE_PHASE_LIMIT + 1);
    assert.equal(records.at(-1).sequence, 129);
    assert.equal(records.at(-1).status, count === 128 ? 200 : 500);
    assert.equal(signal.aborted, count === 129);
  }
});

test("framing bytes count toward the existing total limit and reserve a finite error", async () => {
  const largeResult = result("x".repeat(2_000));
  const cap = new TextEncoder().encode(JSON.stringify({ result: largeResult, schema_version: 1 })).byteLength;
  const response = await worker({ responseByteLimit: cap, runTextToLatticeImpl: async (_text, { onProgress }) => {
    onProgress({ phase: "generating" });
    return largeResult;
  } }).fetch(request(), env);
  const text = await response.text();
  assert.ok(new TextEncoder().encode(text).byteLength <= cap);
  assert.deepEqual(JSON.parse(text.trimEnd().split("\n").at(-1)).body, { error: "internal_error" });
  assert.equal(text.includes(largeResult.text), false);

  let signal;
  const tiny = await worker({ responseByteLimit: 512, runTextToLatticeImpl: async (_text, options) => {
    signal = options.signal;
    options.onProgress({ phase: "generating" });
    return result();
  } }).fetch(request(), env);
  assert.equal(signal.aborted, true);
  assert.deepEqual(await frames(tiny), [{ type: "terminal", sequence: 1, status: 500, body: { error: "internal_error" } }]);
});

test("reader cancellation aborts the same pipeline and closes late observation", async () => {
  const timer = clock();
  let signal;
  let observer;
  const response = await worker({ ...timer, runTextToLatticeImpl: async (_text, options) => {
    signal = options.signal;
    observer = options.onProgress;
    observer({ phase: "generating" });
    await new Promise(() => {});
  } }).fetch(request(), env);
  const reader = response.body.getReader();
  await reader.read();
  await reader.cancel("PRIVATE-CANCEL");
  reader.releaseLock();
  await tick();
  assert.equal(signal.aborted, true);
  assert.equal(timer.disposed(), 1);
  assert.doesNotThrow(() => observer({ phase: "unknown" }));
});

test("absolute timeout and qualification expiry remain active after stream headers", async () => {
  for (const qualification of [false, true]) {
    const timer = clock();
    const now = Date.UTC(2026, 10, 2, 12);
    const response = await worker({ ...timer, now: () => now, runTextToLatticeImpl: async (_text, { onProgress }) => {
      onProgress({ phase: "certifying-document" });
      await new Promise(() => {});
    } }).fetch(request(), { ...env, ...(qualification ? { LATTICE_QUALIFICATION_EXPIRES_AT: new Date(now + 1_000).toISOString() } : {}) });
    assert.equal(timer.disposed(), 0);
    timer.fire();
    const terminal = (await frames(response)).at(-1);
    assert.equal(terminal.status, qualification ? 503 : 504);
    assert.deepEqual(terminal.body, { error: qualification ? "upstream_unavailable" : "upstream_timeout" });
    assert.equal(timer.disposed(), 1);
  }
});

test("a source-time expiry before terminal suppresses an otherwise valid result", async () => {
  const gate = deferred();
  let now = Date.UTC(2026, 10, 2, 12);
  const expires = now + 1_000;
  const response = await worker({ now: () => now, runTextToLatticeImpl: async (_text, { onProgress }) => {
    onProgress({ phase: "verifying" });
    await gate.promise;
    return result();
  } }).fetch(request(), { ...env, LATTICE_QUALIFICATION_EXPIRES_AT: new Date(expires).toISOString() });
  now = expires;
  gate.resolve();
  const terminal = (await frames(response)).at(-1);
  assert.equal(terminal.status, 503);
  assert.deepEqual(terminal.body, { error: "upstream_unavailable" });
});

test("the real engine hook supplies closed phases while its existing result stays unchanged", async () => {
  const options = {
    runTextToLatticeImpl: runTextToLattice,
    createAdapter: () => ({
      analyze: async () => { throw new Error("synthetic unavailable analysis"); },
      generate: async () => { throw new Error("unexpected generation"); },
      verify: async () => { throw new Error("unexpected verification"); },
      repair: async () => { throw new Error("unexpected repair"); },
    }),
  };
  const ordinary = await worker(options).fetch(request("application/json"), env);
  const streamed = await worker(options).fetch(request(), env);
  const records = await frames(streamed);
  assert.deepEqual(records.filter(({ type }) => type === "phase").map(({ phase }) => phase), ["binding-source-integrity", "atomizing"]);
  for (const frame of records.filter(({ type }) => type === "phase")) {
    assert.deepEqual(Object.keys(frame), ["type", "sequence", "phase"]);
    assert.ok(LATTICE_SERVICE_PHASES.includes(frame.phase));
  }
  assert.deepEqual(records.at(-1).body, await ordinary.json());
  assert.equal(records.at(-1).status, ordinary.status);
});
