import assert from "node:assert/strict";
import test from "node:test";
import { preflightLatticeInput } from "../app/resume/latticeDemo.js";
import { latticeSourceSpansForBatch } from "../app/resume/lattice/segments.js";
import {
  LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT,
  LATTICE_PROVIDER_OUTPUT_LIMIT_SHAPE_VALUES,
  LatticeProviderError,
  createHuggingFaceLatticeAdapter,
  getLatticeProviderOutputLimitShape,
  isClosedProviderOutputLimitShape,
  requestHuggingFaceJson,
} from "../workers/text-to-lattice-api/huggingFaceAdapter.js";

function verificationRequest() {
  const batch = preflightLatticeInput("Review the document, then save the approved revision.").batches[0];
  const sourceSpans = latticeSourceSpansForBatch(batch);
  const passageId = batch.passages[0].id;
  const atom = { id: "a1", kind: "action", value: "perform the supported action", priority: "hard",
    preservation: "equivalent", evidenceSpanIds: sourceSpans[0].spans.map(({ id }) => id), links: [] };
  return { batch, sourceSpans, context: null, documentLedger: [], signal: new AbortController().signal,
    analysis: { documentKind: "instruction", passages: [{ passageId, discourseFunction: "directs one bounded action",
      layer: "operative", disposition: "rewrite", rationale: "make the supported action explicit", atoms: [atom],
      ambiguityAtomIds: [], conformanceCriteria: [], conformanceEvidenceSpanIds: [], conformanceAssertions: [] }], questions: [] },
    candidate: { passages: [{ passageId, layer: "operative", text: "Check the document before saving the approved revision.", preservedAtomIds: [atom.id] }] } };
}

function response(content, { finish = "length", message = { role: "assistant", content } } = {}) {
  return new Response(JSON.stringify({ choices: [{ finish_reason: finish, message }],
    usage: { prompt_tokens: 400, completion_tokens: 2048 } }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function capture(content, { observed = true, finish = "length", message, method = "verify" } = {}) {
  const calls = [];
  const adapter = createHuggingFaceLatticeAdapter({ token: "synthetic-test-token",
    ...(observed === undefined ? {} : { observeQualificationOutputLimitShape: observed }),
    fetchImpl: async (url, init) => { calls.push({ url, body: init.body }); return response(content, { finish, ...(message === undefined ? {} : { message }) }); } });
  let error;
  try {
    await adapter[method](method === "verify" ? verificationRequest()
      : { certificateId: "certificate:test", obligationIds: ["document:whole"], source: "Original source.",
        candidate: "Candidate source.", analysis: null, signal: new AbortController().signal });
  } catch (caught) { error = caught; }
  assert.ok(error instanceof LatticeProviderError);
  assert.equal(calls.length, 1);
  assert.deepEqual(adapter.completionCapacity(), { used: 1, limit: 32, remaining: 31 });
  return { error, calls, shape: getLatticeProviderOutputLimitShape(error) };
}

function expected(syntax, rootShape = "not-applicable", leadingWhitespace = "none", trailingWhitespace = "none") {
  return { syntax, rootShape, leadingWhitespace, trailingWhitespace };
}

const unavailable = expected("unavailable", "not-applicable", "unavailable", "unavailable");

test("D25 observes syntax and exact root field sets while preserving the length rejection", async (t) => {
  const cases = [
    ['{"d":0,"g":"PRIVATE-CONTENT","p":{},"i":[]}', expected("complete-object", "verification-root-fields")],
    ['{"i":false,"p":null,"g":{},"d":"PRIVATE-INVALID-VALUE"}', expected("complete-object", "verification-root-fields")],
    ['{"d":0,"d":1,"g":0,"p":0,"i":0}', expected("complete-object", "verification-root-fields")],
    ['{"type":"PRIVATE-TYPE","properties":null,"required":3,"additionalProperties":false}', expected("complete-object", "schema-root-fields")],
    ['{"d":0,"g":0,"p":0,"i":0,"PRIVATE-FIELD":"PRIVATE-VALUE"}', expected("complete-object", "other")],
    ['{"__proto__":{"PRIVATE-FIELD":true}}', expected("complete-object", "other")],
    ['{"d":0}', expected("complete-object", "other")],
    ['{}', expected("complete-object", "other")],
    ['null', expected("complete-nonobject")], ['true', expected("complete-nonobject")],
    ['123', expected("complete-nonobject")], ['"PRIVATE-TEXT"', expected("complete-nonobject")],
    ['["PRIVATE-TEXT"]', expected("complete-nonobject")],
    ['{"d":', expected("invalid-or-incomplete")], ['{}{}', expected("invalid-or-incomplete")],
    ['```json\n{}\n```', expected("invalid-or-incomplete")], ['', expected("invalid-or-incomplete")],
  ];
  for (const [index, [content, shape]] of cases.entries()) await t.test(`shape ${index}`, async () => {
    const result = await capture(content);
    assert.equal(result.error.code, "provider_output_limit");
    assert.equal(result.error.message, "The Lattice provider reached its output limit.");
    assert.equal(result.error.qualificationStage, "verification");
    assert.equal(result.error.qualificationSubtype, "none");
    assert.equal(result.error.qualificationFinishReason, "length");
    assert.deepEqual(result.shape, shape);
    assert.equal(isClosedProviderOutputLimitShape(result.shape), true);
    assert.equal(Object.isFrozen(result.shape), true);
    assert.doesNotMatch(JSON.stringify(result.error) + JSON.stringify(result.shape) + result.error.message, /PRIVATE|__proto__/u);
    assert.equal(Object.hasOwn(result.error, "outputLimitShape"), false);
    assert.equal(Object.hasOwn(result.error, "qualificationOutputLimitShape"), false);
  });
});

test("D25 whitespace buckets use only SP TAB LF CR and exact boundaries", async (t) => {
  for (const [count, bucket] of [[0, "none"], [1, "1-63"], [63, "1-63"], [64, "64-1023"],
    [1023, "64-1023"], [1024, "1024+"]]) await t.test(`boundary ${count}`, async () => {
    const whitespace = " \t\r\n".repeat(Math.ceil(count / 4)).slice(0, count);
    assert.deepEqual((await capture(`${whitespace}{}${whitespace}`)).shape, expected("complete-object", "other", bucket, bucket));
    if (count) assert.deepEqual((await capture(whitespace)).shape, expected("invalid-or-incomplete", "not-applicable", bucket, bucket));
  });
  for (const character of ["\u00a0", "\uFEFF", "\v", "\f", "\u2028", "\u2029"]) {
    assert.deepEqual((await capture(`${character}{}${character}`)).shape, expected("invalid-or-incomplete"));
  }
  assert.deepEqual((await capture('"  PRIVATE  "')).shape, expected("complete-nonobject"));
});

test("D25 missing or oversized content is unavailable and the parse stays bounded", async () => {
  for (const message of [null, [], { role: "assistant" }, { role: "assistant", content: null },
    { role: "assistant", content: 3 }, { role: "assistant", content: { private: "PRIVATE" } },
    { role: "assistant", content: " ".repeat(LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT + 1) }]) {
    const result = await capture(undefined, { message });
    assert.deepEqual(result.shape, unavailable);
    assert.equal(result.error.code, "provider_output_limit");
  }
  const atBound = "{}" + " ".repeat(LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT - 2);
  assert.deepEqual((await capture(atBound)).shape, expected("complete-object", "other", "none", "1024+"));
});

test("D25 leaves provider request bytes, public error properties and default behavior unchanged", async () => {
  const content = '{"d":0,"g":"PRIVATE","p":{},"i":[]}';
  const on = await capture(content);
  const off = await capture(content, { observed: false });
  // Omit the new option explicitly to exercise its public adapter default.
  let defaultError;
  const defaultCalls = [];
  const adapter = createHuggingFaceLatticeAdapter({ token: "synthetic-test-token", fetchImpl: async (url, init) => {
    defaultCalls.push({ url, body: init.body }); return response(content);
  } });
  try { await adapter.verify(verificationRequest()); } catch (error) { defaultError = error; }
  assert.deepEqual(on.calls, off.calls);
  assert.deepEqual(on.calls, defaultCalls);
  assert.equal(off.shape, null);
  assert.equal(getLatticeProviderOutputLimitShape(defaultError), null);
  const publicProperties = (error) => Object.fromEntries(Object.getOwnPropertyNames(error)
    .filter((name) => name !== "stack").map((name) => [name, Object.getOwnPropertyDescriptor(error, name)]));
  assert.deepEqual(publicProperties(on.error), publicProperties(off.error));
  assert.deepEqual(publicProperties(on.error), publicProperties(defaultError));
  const body = JSON.parse(on.calls[0].body);
  assert.equal(body.max_tokens, 2048);
  assert.equal(body.model, "meta-llama/Llama-3.1-8B-Instruct:nscale");
  assert.equal(body.stream, false);
});

function helperOptions(fetchImpl, overrides = {}) {
  return { token: "synthetic-test-token", role: "verifier", messages: [{ role: "user", content: "inert" }],
    schema: { type: "object", properties: { accepted: { type: "boolean" } }, required: ["accepted"], additionalProperties: false },
    schemaName: "lattice_verification_wire_v2", responseFormat: "json_schema", requireMinimalVerificationContent: true,
    maxTokens: 2048, temperature: 0.1, topP: 0.9, observeQualificationOutputLimitShape: true, fetchImpl, ...overrides };
}

test("D25 is restricted to verification length failures and never changes successful content", async () => {
  assert.equal((await capture("{}", { method: "certify" })).shape, null);
  for (const finish of ["content_filter", "unknown", null]) {
    const result = await capture("{}", { finish });
    assert.equal(result.error.code, "provider_malformed_response");
    assert.equal(result.shape, null);
  }
  for (const override of [
    { role: "generator", schemaName: "lattice_candidate_v1", requireMinimalVerificationContent: false },
    { schemaName: "lattice_document_certification_wire_v1" },
    { responseFormat: "json_object", requireMinimalVerificationContent: false },
  ]) {
    await assert.rejects(requestHuggingFaceJson(helperOptions(async () => response("{}"), override)), (error) => {
      assert.equal(getLatticeProviderOutputLimitShape(error), null); return true;
    });
  }
  const bodies = [];
  for (const observed of [false, true]) {
    const result = await requestHuggingFaceJson(helperOptions(async (_url, init) => {
      bodies.push(init.body); return response('{"accepted":true}', { finish: "stop" });
    }, { observeQualificationOutputLimitShape: observed }));
    assert.deepEqual(result, { accepted: true });
  }
  assert.equal(bodies[0], bodies[1]);
  for (const invalid of [null, 1, "true", {}]) {
    assert.throws(() => createHuggingFaceLatticeAdapter({ observeQualificationOutputLimitShape: invalid }), /invalid requested mode/u);
    await assert.rejects(requestHuggingFaceJson(helperOptions(() => assert.fail("must reject before fetch"),
      { observeQualificationOutputLimitShape: invalid })), /invalid server configuration/u);
  }
});

test("D25 shape validation rejects open or impossible groups without invoking accessors", () => {
  const valid = expected("complete-object", "verification-root-fields");
  assert.equal(isClosedProviderOutputLimitShape(Object.freeze({ ...valid })), true);
  assert.equal(isClosedProviderOutputLimitShape(Object.freeze(unavailable)), true);
  assert.equal(Object.isFrozen(LATTICE_PROVIDER_OUTPUT_LIMIT_SHAPE_VALUES), true);
  assert.ok(Object.values(LATTICE_PROVIDER_OUTPUT_LIMIT_SHAPE_VALUES).every(Object.isFrozen));
  let reads = 0;
  const accessor = Object.freeze({ ...valid, get syntax() { reads += 1; return valid.syntax; } });
  const inherited = Object.freeze(Object.assign(Object.create({ syntax: valid.syntax }), {
    rootShape: valid.rootShape, leadingWhitespace: "none", trailingWhitespace: "none" }));
  const nonenumerable = { ...valid };
  Object.defineProperty(nonenumerable, "syntax", { value: valid.syntax, enumerable: false });
  const { proxy, revoke } = Proxy.revocable({}, {}); revoke();
  const bad = [null, undefined, [], valid, accessor, inherited, Object.freeze(nonenumerable), proxy,
    Object.freeze(Object.assign(Object.create(null), valid)), Object.freeze({ ...valid, extra: "PRIVATE" }),
    Object.freeze({ ...valid, [Symbol("PRIVATE")]: true }),
    ...[{ syntax: "PRIVATE" }, { rootShape: "not-applicable" }, { syntax: "complete-nonobject" },
      { syntax: "invalid-or-incomplete" }, { leadingWhitespace: "unavailable" },
      { trailingWhitespace: "unavailable" }, { syntax: "unavailable" }, { leadingWhitespace: "none\n" }]
      .map((patch) => Object.freeze({ ...valid, ...patch }))];
  for (const value of bad) assert.equal(isClosedProviderOutputLimitShape(value), false);
  assert.equal(reads, 0);
});

test("D25 error provenance cannot be fabricated through properties, clones or proxies", async () => {
  const { error, shape } = await capture('{"d":0,"g":0,"p":0,"i":0}');
  assert.throws(() => { shape.syntax = "unavailable"; }, TypeError);
  let reads = 0;
  const forged = new LatticeProviderError("provider_output_limit", "PRIVATE");
  Object.defineProperties(forged, Object.getOwnPropertyDescriptors(error));
  Object.defineProperty(forged, "outputLimitShape", { get() { reads += 1; return shape; } });
  const { proxy, revoke } = Proxy.revocable(error, {}); revoke();
  for (const value of [undefined, null, "PRIVATE", { ...error }, forged, Object.freeze({ outputLimitShape: shape }),
    new Proxy(error, {}), proxy]) assert.equal(getLatticeProviderOutputLimitShape(value), null);
  assert.equal(reads, 0);
  assert.equal(getLatticeProviderOutputLimitShape(error), shape);
});

test("D25 unexpected observer exceptions suppress only the observation", async () => {
  const originalParse = JSON.parse;
  const content = '{"PRIVATE-OBSERVER-EXCEPTION":true}';
  let observedParseCalls = 0;
  JSON.parse = function parse(value, ...rest) {
    if (value === content) { observedParseCalls += 1; throw new Error("PRIVATE-OBSERVER-EXCEPTION"); }
    return originalParse(value, ...rest);
  };
  try {
    const { error, shape } = await capture(content);
    assert.equal(error.code, "provider_output_limit");
    assert.equal(error.message, "The Lattice provider reached its output limit.");
    assert.equal(error.qualificationFinishReason, "length");
    assert.equal(shape, null);
    assert.equal(observedParseCalls, 1);
    assert.doesNotMatch(JSON.stringify(error) + error.message, /PRIVATE/u);
  } finally { JSON.parse = originalParse; }
});
