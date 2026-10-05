import assert from "node:assert/strict";
import test from "node:test";
import {
  getLatticeAnalysisPassageRetentionDowngrade,
  rememberLatticeAnalysisPassageOrigins,
} from "../app/resume/lattice/analysisProvenance.js";

const lookup = getLatticeAnalysisPassageRetentionDowngrade;
const remember = rememberLatticeAnalysisPassageOrigins;

function fixture() {
  const source = Object.freeze({ id: "p1", text: "A visitor closes a notebook." });
  const passage = Object.freeze({ passageId: "p1", disposition: "rewrite" });
  const analysis = Object.freeze({ passages: Object.freeze([passage]) });
  return { analysis, passage, source };
}

test("passage origins preserve true, false, and absent as distinct exact identity facts", () => {
  for (const retentionDowngraded of [true, false]) {
    const { analysis, passage, source } = fixture();
    const descriptors = [analysis, passage, source].map(Object.getOwnPropertyDescriptors);
    assert.equal(lookup(analysis, passage, source), null);
    assert.equal(remember(analysis, [{ passage, source, retentionDowngraded }]), analysis);
    assert.equal(lookup(analysis, passage, source), retentionDowngraded);
    assert.deepEqual([analysis, passage, source].map(Object.getOwnPropertyDescriptors), descriptors);
    assert.equal(lookup(analysis, passage, { ...source }), null, "matching source text or ID is not source identity");
    assert.equal(lookup(analysis, { ...passage }, source), null, "matching passage fields are not passage identity");
    assert.equal(lookup({ ...analysis }, passage, source), null, "matching analysis fields are not analysis identity");
    assert.equal(lookup(JSON.parse(JSON.stringify(analysis)), passage, source), null);
  }
});

test("registration is first-write-only and cannot upgrade, downgrade, or extend an authenticated analysis", () => {
  for (const retentionDowngraded of [true, false]) {
    const { analysis, passage, source } = fixture();
    const other = fixture();
    remember(analysis, [{ passage, source, retentionDowngraded }]);
    for (const later of [
      [{ passage, source, retentionDowngraded: !retentionDowngraded }],
      [{ passage, source: other.source, retentionDowngraded: true }],
      [{ passage: other.passage, source: other.source, retentionDowngraded: true }],
      [], null,
    ]) {
      assert.equal(remember(analysis, later), analysis);
      assert.equal(lookup(analysis, passage, source), retentionDowngraded);
      assert.equal(lookup(analysis, passage, other.source), null);
      assert.equal(lookup(analysis, other.passage, other.source), null);
    }
  }
});

test("passages are independently bound within their complete analysis and cannot borrow another passage's positive fact", () => {
  const first = fixture();
  const second = fixture();
  const analysis = {};
  remember(analysis, [
    { passage: first.passage, source: first.source, retentionDowngraded: true },
    { passage: second.passage, source: second.source, retentionDowngraded: false },
  ]);
  assert.equal(lookup(analysis, first.passage, first.source), true);
  assert.equal(lookup(analysis, second.passage, second.source), false);
  assert.equal(lookup(analysis, first.passage, second.source), null);
  assert.equal(lookup(analysis, second.passage, first.source), null);
  assert.equal(lookup(first.analysis, first.passage, first.source), null);
  assert.equal(lookup(second.analysis, second.passage, second.source), null);
});

test("invalid origin lists publish no partial fact and do not consume the first valid registration", () => {
  const invalidValues = [undefined, null, 0, 1, "true", "false", {}, [], () => true];
  const invalidLists = [undefined, null, false, 0, {}, "origins"];
  for (const invalid of invalidValues) {
    invalidLists.push([{ passage: {}, source: {}, retentionDowngraded: invalid }]);
  }
  for (const invalid of [undefined, null, false, 0, "record", [], () => {}]) {
    invalidLists.push([invalid]);
    invalidLists.push([{ passage: invalid, source: {}, retentionDowngraded: true }]);
    invalidLists.push([{ passage: {}, source: invalid, retentionDowngraded: true }]);
  }
  for (const invalid of invalidLists) {
    const { analysis, passage, source } = fixture();
    const valid = { passage, source, retentionDowngraded: true };
    const origins = Array.isArray(invalid) ? [valid, ...invalid] : invalid;
    assert.equal(remember(analysis, origins), analysis);
    assert.equal(lookup(analysis, passage, source), null);
    remember(analysis, [valid]);
    assert.equal(lookup(analysis, passage, source), true);
  }
  const { analysis, passage, source } = fixture();
  remember(analysis, [
    { passage, source, retentionDowngraded: true },
    { passage, source, retentionDowngraded: false },
  ]);
  assert.equal(lookup(analysis, passage, source), null, "duplicate passage identities invalidate the complete registration");
  remember(analysis, [{ passage, source, retentionDowngraded: false }]);
  assert.equal(lookup(analysis, passage, source), false);
});

test("registration snapshots the trusted origin records without retaining their mutable list or boolean fields", () => {
  const { analysis, passage, source } = fixture();
  const other = fixture();
  const origin = { passage, source, retentionDowngraded: true };
  const origins = [origin];
  remember(analysis, origins);
  origin.passage = other.passage;
  origin.source = other.source;
  origin.retentionDowngraded = false;
  origins.splice(0, 1, { passage: other.passage, source: other.source, retentionDowngraded: true });
  assert.equal(lookup(analysis, passage, source), true);
  assert.equal(lookup(analysis, passage, other.source), null);
  assert.equal(lookup(analysis, other.passage, other.source), null);
});

test("property, symbol, prototype and proxy lookalikes cannot authenticate any of the three identities", () => {
  const { analysis, passage, source } = fixture();
  remember(analysis, [{ passage, source, retentionDowngraded: true }]);
  let reads = 0;
  const trap = () => { reads += 1; throw new Error("PRIVATE-CONTENT"); };
  const trapped = new Proxy({}, { get: trap, ownKeys: trap, getOwnPropertyDescriptor: trap, getPrototypeOf: trap });
  const { proxy: revoked, revoke } = Proxy.revocable({}, {});
  revoke();
  const accessor = {};
  for (const name of ["passages", "passageId", "source", "retentionDowngraded"]) {
    Object.defineProperty(accessor, name, { enumerable: true, get: trap });
  }
  for (const impostor of [
    accessor, trapped, revoked,
    { retentionDowngraded: true },
    { [Symbol.for("lattice-analysis-passage-origins")]: true },
    Object.create(analysis), Object.create(passage), Object.create(source),
    new Proxy(analysis, {}), new Proxy(passage, {}), new Proxy(source, {}),
  ]) {
    assert.equal(lookup(impostor, passage, source), null);
    assert.equal(lookup(analysis, impostor, source), null);
    assert.equal(lookup(analysis, passage, impostor), null);
  }
  assert.equal(reads, 0, "identity lookup must not inspect provider-owned fields or execute proxy traps");
  assert.equal(lookup(analysis, passage, source), true);
});

test("primitive and non-record lookups remain unavailable, and non-record analyses cannot be registered", () => {
  const { analysis, passage, source } = fixture();
  remember(analysis, [{ passage, source, retentionDowngraded: true }]);
  for (const value of [undefined, null, true, false, 0, 1, NaN, 1n, Symbol("private"), "record", [], () => {}]) {
    assert.equal(lookup(value, passage, source), null);
    assert.equal(lookup(analysis, value, source), null);
    assert.equal(lookup(analysis, passage, value), null);
    assert.equal(remember(value, [{ passage, source, retentionDowngraded: true }]), value);
    assert.equal(lookup(value, passage, source), null);
  }
});
