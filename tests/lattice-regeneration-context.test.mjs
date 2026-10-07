import assert from "node:assert/strict";
import test from "node:test";
import {
  carryLatticeRegenerationRetentionContext,
  getLatticeRegenerationRetentionPositions,
  withLatticeRegenerationRetentionContext,
} from "../app/resume/lattice/regenerationContext.js";

const freeze = (value) => {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};
function fixture() {
  const batch = freeze({ passages: [0, 1, 2].map((i) => ({ id: `p${i}`, text: `source ${i}` })) });
  const verification = freeze({ available: true, gates: { languageSupported: true },
    passages: batch.passages.map(({ id }, i) => ({ passageId: id,
      requiresPositiveConformance: i !== 1, conformanceConfirmed: i === 2 })) });
  const analysis = freeze({ passages: batch.passages.map(({ id }) => ({ passageId: id, disposition: "rewrite" })) });
  return { batch, verification, analysis,
    request: freeze({ regenerationFromReanalysis: true, batch, verification, analysis }) };
}
const positions = getLatticeRegenerationRetentionPositions;
const invoke = (f, action, request = f.request) => withLatticeRegenerationRetentionContext(
  request, f.batch, f.verification, f.analysis, action,
);

test("D26 context selects only prior unconfirmed retention and expires every carried alias", async () => {
  const f = fixture();
  let carried;
  assert.deepEqual(positions(f.request), []);
  await invoke(f, async () => {
    assert.deepEqual(positions(f.request), [0]);
    assert.ok(Object.isFrozen(positions(f.request)));
    const clone = Object.freeze({ ...f.request });
    assert.deepEqual(positions(clone), []);
    assert.deepEqual(positions(new Proxy(f.request, {})), []);
    carried = carryLatticeRegenerationRetentionContext(f.request, clone);
    assert.deepEqual(positions(carried), [0]);
    await Promise.resolve();
    assert.deepEqual(positions(carried), [0]);
  });
  assert.deepEqual(positions(f.request), []);
  assert.deepEqual(positions(carried), []);
  assert.deepEqual(positions(carryLatticeRegenerationRetentionContext(f.request,
    Object.freeze({ ...f.request }))), []);
});

test("D26 context refuses replaced batch, review, plan and forged flags at binding and transfer", async (context) => {
  for (const key of ["batch", "verification", "analysis", "regenerationFromReanalysis"]) {
    await context.test(key, async () => {
      const f = fixture();
      const wrong = Object.freeze({ ...f.request, [key]: key === "regenerationFromReanalysis"
        ? "true" : freeze(structuredClone(f.request[key])) });
      await invoke(f, () => assert.deepEqual(positions(wrong), []), wrong);
      await invoke(f, () => {
        assert.deepEqual(positions(carryLatticeRegenerationRetentionContext(f.request, wrong)), []);
        assert.deepEqual(positions(carryLatticeRegenerationRetentionContext(wrong,
          Object.freeze({ ...f.request }))), []);
        assert.deepEqual(positions(f.request), [0]);
      });
    });
  }
});

test("D26 context never promotes unavailable, ordinary rewrite, positive or unmatched review facts", async (context) => {
  const changes = {
    unavailable: (f) => { f.verification.available = false; },
    "missing availability": (f) => { delete f.verification.available; },
    "unsupported language": (f) => { f.verification.gates.languageSupported = false; },
    "ordinary rewrite": (f) => { f.verification.passages[0].requiresPositiveConformance = false; },
    "positive retention": (f) => { f.verification.passages[0].conformanceConfirmed = true; },
    "missing conformance": (f) => { delete f.verification.passages[0].conformanceConfirmed; },
    "string conformance": (f) => { f.verification.passages[0].conformanceConfirmed = "false"; },
    "unknown review passage": (f) => { f.verification.passages[0].passageId = "other"; },
    "duplicate review passage": (f) => { f.verification.passages.push({ ...f.verification.passages[0] }); },
    "current retain": (f) => { f.analysis.passages[0].disposition = "retain-if-conformant"; },
    "unknown plan passage": (f) => { f.analysis.passages[0].passageId = "other"; },
    "duplicate source passage": (f) => { f.batch.passages.push({ ...f.batch.passages[0] }); },
    "not regeneration": (f) => { f.request.regenerationFromReanalysis = false; },
  };
  for (const [name, change] of Object.entries(changes)) await context.test(name, async () => {
    const f = structuredClone(fixture());
    change(f);
    f.request = { ...f.request, batch: f.batch, verification: f.verification, analysis: f.analysis };
    freeze(f);
    await invoke(f, () => assert.deepEqual(positions(f.request), []));
  });
});

test("D26 context uses only immutable own data and does not invoke conformance accessors", async () => {
  const f = structuredClone(fixture());
  let calls = 0;
  Object.defineProperty(f.verification.passages[0], "conformanceConfirmed", {
    get() { calls += 1; return false; },
  });
  Object.freeze(f.verification.passages[0]);
  for (const value of f.verification.passages.slice(1)) Object.freeze(value);
  Object.freeze(f.verification.passages);Object.freeze(f.verification.gates);Object.freeze(f.verification);
  freeze(f.batch);freeze(f.analysis);
  f.request = Object.freeze({ regenerationFromReanalysis: true, batch: f.batch,
    verification: f.verification, analysis: f.analysis });
  await invoke(f, () => assert.deepEqual(positions(f.request), []));
  assert.equal(calls, 0);
  const mutable = fixture();
  const request = { ...mutable.request };
  await invoke(mutable, () => assert.deepEqual(positions(request), []), request);
});

test("D26 context is revoked after either synchronous or asynchronous generation failure", async (context) => {
  for (const asyncFailure of [false, true]) await context.test(String(asyncFailure), async () => {
    const f = fixture();let carried;
    const failure = new Error("synthetic generation failure");
    await assert.rejects(invoke(f, () => {
      carried = carryLatticeRegenerationRetentionContext(f.request, Object.freeze({ ...f.request }));
      assert.deepEqual(positions(carried), [0]);
      if (asyncFailure) return Promise.reject(failure);
      throw failure;
    }), (error) => error === failure);
    assert.deepEqual(positions(f.request), []);assert.deepEqual(positions(carried), []);
  });
});
