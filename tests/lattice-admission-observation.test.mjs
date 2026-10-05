import assert from "node:assert/strict";
import test from "node:test";
import {
  createLatticeAdmissionObservation, observeLatticeAdmissionValidation,
  observeLatticeAdmissionTrustedStep, beginLatticeAdmissionClaim, endLatticeAdmissionClaim,
  observeLatticeAdmissionPipeline, beginLatticeAdmissionProviderFetch,
  endLatticeAdmissionProviderFetch, sealLatticeAdmissionObservation,
  isClosedLatticeAdmissionObservation,
} from "../workers/text-to-lattice-api/admissionObservation.js";
import { claimGlobalLatticeTransformation } from "../workers/text-to-lattice-api/capacityClient.js";
import { requestHuggingFaceJson } from "../workers/text-to-lattice-api/huggingFaceAdapter.js";

const unavailable = Object.freeze({ status: "unavailable", claim: "unavailable", order: "unavailable", provider: "unavailable" });
const allowed = Object.freeze({ status: "complete", claim: "allowed-once", order: "after-validation", provider: "not-started" });
const visitor = "A".repeat(24);
function request() {
  const controller = new AbortController();
  const handle = createLatticeAdmissionObservation(controller.signal);
  return { controller, signal: controller.signal, handle };
}
function namespace(fetch) { return { getByName: () => ({ fetch }) }; }
function acknowledgment(allow = true) {
  return Response.json(allow ? { allowed: true, schema_version: 1 }
    : { allowed: false, scope: "visitor-day", retry_after_seconds: 60, schema_version: 1 }, { status: allow ? 200 : 429 });
}
async function claim(entry, allow = true) {
  observeLatticeAdmissionValidation(entry.handle);
  const call = beginLatticeAdmissionClaim(entry.handle, true);
  const result = await claimGlobalLatticeTransformation(namespace(() => acknowledgment(allow)), visitor, entry.signal);
  endLatticeAdmissionClaim(entry.handle, call, result);
  return result;
}
function providerRequest(entry, fetchImpl, overrides = {}) {
  observeLatticeAdmissionPipeline(entry.handle, true);
  return requestHuggingFaceJson({ token: "synthetic-only", role: "generator",
    messages: [{ role: "system", content: "Return JSON." }, { role: "user", content: "{}" }],
    schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
    schemaName: "admission_fixture", maxTokens: 32, temperature: 0, topP: 1,
    signal: entry.signal, fetchImpl, ...overrides });
}
const providerResponse = () => Response.json({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: '{"ok":true}' } }] });

test("admission observation uses closed finite tuples and never reads accessor values", () => {
  const valid = [allowed, { ...allowed, provider: "after-admission" },
    { ...allowed, claim: "denied-once" }, unavailable,
    { status: "complete", claim: "not-called", order: "not-called", provider: "not-started" }];
  for (const record of valid) assert.equal(isClosedLatticeAdmissionObservation(record), true);
  let reads = 0;
  const hidden = { ...allowed };Object.defineProperty(hidden, "private", { value: "PRIVATE" });
  for (const record of [null, [], {}, { ...allowed, claim: "multiple" }, { ...allowed, order: "not-called" },
    { ...allowed, claim: "denied-once", provider: "after-admission" }, { ...unavailable, claim: "not-called" },
    { ...allowed, claim: "allowed-once\n" }, { ...allowed, status: "complete\u2028" },
    { ...allowed, [Symbol("PRIVATE")]: true }, hidden,
    { ...allowed, get provider() { reads += 1; return "not-started"; } }]) {
    assert.equal(isClosedLatticeAdmissionObservation(record), false);
  }
  assert.equal(reads, 0);
});

test("default-client parsing authenticates one current request acknowledgment without asserting native DO identity", async () => {
  for (const permit of [true, false]) {
    const entry = request();const result = await claim(entry, permit);
    assert.deepEqual(result, { allowed: permit, retryAfterSeconds: permit ? null : 60 });
    assert.deepEqual(sealLatticeAdmissionObservation(entry.handle, false), { ...allowed, claim: permit ? "allowed-once" : "denied-once" });
    assert.deepEqual(Object.keys(entry.handle), []);
    assert.equal(createLatticeAdmissionObservation(entry.signal), null);
  }
});

test("admission observations reject stale genuine results, clones, proxies and injected client results", async () => {
  const original = request();const genuine = await claim(original);
  let reads = 0;
  const revoked = Proxy.revocable(genuine, {});revoked.revoke();
  for (const result of [genuine, { ...genuine }, new Proxy(genuine, { get() { reads += 1; return true; } }), revoked.proxy,
    { get allowed() { reads += 1; return true; }, retryAfterSeconds: null }]) {
    const current = request();observeLatticeAdmissionValidation(current.handle);
    const call = beginLatticeAdmissionClaim(current.handle, true);
    endLatticeAdmissionClaim(current.handle, call, result);
    assert.deepEqual(sealLatticeAdmissionObservation(current.handle, false), unavailable);
  }
  const injected = request();observeLatticeAdmissionValidation(injected.handle);
  const call = beginLatticeAdmissionClaim(injected.handle, false);
  const actual = await claimGlobalLatticeTransformation(namespace(() => acknowledgment()), visitor, injected.signal);
  endLatticeAdmissionClaim(injected.handle, call, actual);
  assert.deepEqual(sealLatticeAdmissionObservation(injected.handle, false), unavailable);
  assert.equal(reads, 0);
});

test("admission authority cannot be supplied by cloned or forged handles", () => {
  const original = request();let reads = 0;
  const proxy = new Proxy(original.handle, { get() { reads += 1; throw Error("PRIVATE"); } });
  const revoked = Proxy.revocable(original.handle, {});revoked.revoke();
  for (const handle of [null, undefined, {}, { ...original.handle }, proxy, revoked.proxy]) {
    assert.equal(beginLatticeAdmissionClaim(handle, true), null);
    assert.equal(sealLatticeAdmissionObservation(handle, false), null);
  }
  assert.equal(reads, 0);
});

test("multiple claims, wrong ordering and untrusted reached dependencies cannot produce complete evidence", async () => {
  const multiple = request();await claim(multiple);await claim(multiple);
  assert.deepEqual(sealLatticeAdmissionObservation(multiple.handle, false), unavailable);
  const unvalidated = request();const call = beginLatticeAdmissionClaim(unvalidated.handle, true);
  const result = await claimGlobalLatticeTransformation(namespace(() => acknowledgment()), visitor, unvalidated.signal);
  endLatticeAdmissionClaim(unvalidated.handle, call, result);
  assert.deepEqual(sealLatticeAdmissionObservation(unvalidated.handle, false), unavailable);
  const earlyProvider = request();const dispatch = beginLatticeAdmissionProviderFetch(earlyProvider.signal);
  endLatticeAdmissionProviderFetch(dispatch);
  assert.deepEqual(sealLatticeAdmissionObservation(earlyProvider.handle, false), unavailable);
  for (const dependency of ["step", "pipeline"]) {
    const entry = request();await claim(entry);
    if (dependency === "step") observeLatticeAdmissionTrustedStep(entry.handle, false);
    else observeLatticeAdmissionPipeline(entry.handle, false);
    assert.deepEqual(sealLatticeAdmissionObservation(entry.handle, false), unavailable);
  }
});

test("pending gate fetch or response body remains unavailable after late settlement", async (t) => {
  for (const bodyPending of [false, true]) await t.test(bodyPending ? "response body pending" : "fetch pending", async () => {
    const entry = request();observeLatticeAdmissionValidation(entry.handle);
    const call = beginLatticeAdmissionClaim(entry.handle, true);
    let release;
    const response = bodyPending ? new Response(new ReadableStream({ start(controller) {
      release = () => { controller.enqueue(new TextEncoder().encode('{"allowed":true,"schema_version":1}'));controller.close(); };
    } }), { headers: { "Content-Type": "application/json" } }) : null;
    const operation = claimGlobalLatticeTransformation(namespace(() => bodyPending ? response : new Promise((resolve) => { release = () => resolve(acknowledgment()); })), visitor, entry.signal);
    await Promise.resolve();
    const sealed = sealLatticeAdmissionObservation(entry.handle, false);
    assert.deepEqual(sealed, unavailable);
    release();const result = await operation;
    endLatticeAdmissionClaim(entry.handle, call, result);
    assert.equal(sealLatticeAdmissionObservation(entry.handle, false), sealed);
    assert.deepEqual(result, { allowed: true, retryAfterSeconds: null });
  });
});

test("malformed admission responses and aborted requests never default to no claim", async () => {
  const entry = request();observeLatticeAdmissionValidation(entry.handle);
  beginLatticeAdmissionClaim(entry.handle, true);
  await assert.rejects(claimGlobalLatticeTransformation(namespace(() => Response.json({ allowed: true, schema_version: 1, extra: "PRIVATE" })), visitor, entry.signal));
  assert.deepEqual(sealLatticeAdmissionObservation(entry.handle, false), unavailable);
  const aborted = request();assert.deepEqual(sealLatticeAdmissionObservation(aborted.handle, true), unavailable);
});

test("actual provider fetch invocation is observed even when it synchronously throws", async () => {
  const entry = request();await claim(entry);let calls = 0;
  await assert.rejects(providerRequest(entry, () => { calls += 1;throw Error("PRIVATE"); }), { code: "provider_unavailable" });
  assert.equal(calls, 1);
  assert.deepEqual(sealLatticeAdmissionObservation(entry.handle, false), { ...allowed, provider: "after-admission" });
});

test("provider lifecycle completion requires an explicit positive internal observation", async () => {
  const entry = request();await claim(entry);observeLatticeAdmissionPipeline(entry.handle, true);
  const dispatch = beginLatticeAdmissionProviderFetch(entry.signal);
  endLatticeAdmissionProviderFetch(dispatch);
  assert.deepEqual(sealLatticeAdmissionObservation(entry.handle, false), unavailable);
});

test("provider preparation without fetch is not a provider-start observation", async () => {
  const entry = request();await claim(entry);let calls = 0;
  await assert.rejects(providerRequest(entry, () => { calls += 1;return providerResponse(); }, { maximumRequestBytes: 1 }));
  assert.equal(calls, 0);
  assert.deepEqual(sealLatticeAdmissionObservation(entry.handle, false), allowed);
});

test("provider deadline can settle while fetch remains pending without producing complete evidence", async () => {
  const entry = request();await claim(entry);let release;
  await assert.rejects(providerRequest(entry, () => new Promise((resolve) => { release = resolve; }), { callTimeoutMs: 5 }), { code: "provider_timeout" });
  const sealed = sealLatticeAdmissionObservation(entry.handle, false);
  assert.deepEqual(sealed, unavailable);
  release(providerResponse());await Promise.resolve();
  assert.equal(sealLatticeAdmissionObservation(entry.handle, false), sealed);
});

test("provider headers do not settle an unfinished response body or pending cancellation", async () => {
  const entry = request();await claim(entry);let releaseCancellation, cancelled = false;
  const response = new Response(new ReadableStream({ cancel() {
    cancelled = true;return new Promise((resolve) => { releaseCancellation = resolve; });
  } }), { headers: { "Content-Type": "application/json" } });
  await assert.rejects(providerRequest(entry, () => response, { callTimeoutMs: 5 }), { code: "provider_timeout" });
  assert.equal(entry.signal.aborted, false);assert.equal(cancelled, true);
  const sealed = sealLatticeAdmissionObservation(entry.handle, false);
  assert.deepEqual(sealed, unavailable);
  releaseCancellation();await Promise.resolve();await Promise.resolve();
  assert.equal(sealLatticeAdmissionObservation(entry.handle, false), sealed);
});

test("marked and unmarked provider requests have identical bytes and public results", async () => {
  const bodies = [];const observed = request();await claim(observed);
  const unobserved = { signal: new AbortController().signal, handle: null };
  const fetch = (_url, init) => { bodies.push(init.body);return providerResponse(); };
  const first = await providerRequest(observed, fetch), second = await providerRequest(unobserved, fetch);
  assert.deepEqual(first, second);assert.deepEqual(bodies[0], bodies[1]);
  assert.deepEqual(sealLatticeAdmissionObservation(observed.handle, false), { ...allowed, provider: "after-admission" });
  assert.equal(sealLatticeAdmissionObservation(unobserved.handle, false), null);
});
