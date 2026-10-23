import assert from "node:assert/strict";
import test from "node:test";
import {
  rememberLatticeVerificationIssueAlignmentError,
  withLatticeVerificationCorrection,
  getLatticeVerificationCorrection,
} from "../app/resume/lattice/verificationCorrection.js";

function fixture(stage = "verification") {
  const batch = Object.freeze({});
  const analysis = Object.freeze({});
  const candidate = Object.freeze({});
  const request = Object.freeze({ batch, analysis, candidate,
    protocolFeedback: Object.freeze({ stage, attempt: 2 }) });
  const error = new Error("private synthetic host failure");
  rememberLatticeVerificationIssueAlignmentError(error, batch, analysis, candidate, stage);
  return { request, error };
}

test("issue-alignment guidance exists only during the owned correction and cannot replay", async () => {
  const { request, error } = fixture();
  assert.equal(getLatticeVerificationCorrection(request), null);
  const result = await withLatticeVerificationCorrection(request, error, async () => {
    assert.equal(getLatticeVerificationCorrection(request), "issue-alignment");
    await Promise.resolve();
    assert.equal(getLatticeVerificationCorrection(request), "issue-alignment");
    assert.equal(getLatticeVerificationCorrection(Object.freeze({ ...request })), null);
    return 42;
  });
  assert.equal(result, 42);
  assert.equal(getLatticeVerificationCorrection(request), null);
  await withLatticeVerificationCorrection(request, error, () => {
    assert.equal(getLatticeVerificationCorrection(request), null);
  });
  assert.equal(JSON.stringify(request).includes("private synthetic"), false);
});

test("issue-alignment guidance expires when the provider invocation rejects", async () => {
  const { request, error } = fixture("reverification");
  const failure = new Error("bounded provider refusal");
  await assert.rejects(withLatticeVerificationCorrection(request, error, async () => {
    assert.equal(getLatticeVerificationCorrection(request), "issue-alignment");
    throw failure;
  }), (caught) => caught === failure);
  assert.equal(getLatticeVerificationCorrection(request), null);
});

test("mismatched identities and stage or attempt cannot consume a correction", async (context) => {
  for (const field of ["batch", "analysis", "candidate", "stage", "attempt", "mutable-request", "mutable-feedback"]) {
    await context.test(field, async () => {
      const { request, error } = fixture();
      const copy = { ...request };
      if (["batch", "analysis", "candidate"].includes(field)) copy[field] = Object.freeze({});
      if (field === "stage") copy.protocolFeedback = Object.freeze({ stage: "reverification", attempt: 2 });
      if (field === "attempt") copy.protocolFeedback = Object.freeze({ stage: "verification", attempt: 1 });
      if (field === "mutable-feedback") copy.protocolFeedback = { ...request.protocolFeedback };
      if (field !== "mutable-request") Object.freeze(copy);
      await withLatticeVerificationCorrection(copy, error, () => {
        assert.equal(getLatticeVerificationCorrection(copy), null);
      });
      await withLatticeVerificationCorrection(request, error, () => {
        assert.equal(getLatticeVerificationCorrection(request), "issue-alignment");
      });
    });
  }
});

test("lookalike errors, diagnostic properties and request accessors cannot select guidance", async () => {
  const { request } = fixture();
  const error = Object.freeze({ message: "A verifier issue must identify a failed gate or passage check.",
    diagnostic: Object.freeze({ boundary: "host-normalizer", category: "decision-consistency" }) });
  await withLatticeVerificationCorrection(request, error, () => {
    assert.equal(getLatticeVerificationCorrection(request), null);
  });
  const owned = fixture();
  let reads = 0;
  const accessor = { ...owned.request };
  Object.defineProperty(accessor, "candidate", { get() { reads += 1; return owned.request.candidate; } });
  Object.freeze(accessor);
  await withLatticeVerificationCorrection(accessor, owned.error, () => {
    assert.equal(getLatticeVerificationCorrection(accessor), null);
  });
  assert.equal(reads, 0);
});

test("nested attempts cannot overwrite or revoke an existing owned correction", async () => {
  const { request, error } = fixture();
  await withLatticeVerificationCorrection(request, error, async () => {
    await withLatticeVerificationCorrection(request, error, () => {
      assert.equal(getLatticeVerificationCorrection(request), "issue-alignment");
    });
    assert.equal(getLatticeVerificationCorrection(request), "issue-alignment");
  });
  assert.equal(getLatticeVerificationCorrection(request), null);
});

test("concurrent owned corrections expire independently", async () => {
  const a = fixture();
  const b = fixture("reverification");
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const first = withLatticeVerificationCorrection(a.request, a.error, async () => {
    await pending;
    assert.equal(getLatticeVerificationCorrection(a.request), "issue-alignment");
  });
  await withLatticeVerificationCorrection(b.request, b.error, () => {
    assert.equal(getLatticeVerificationCorrection(a.request), "issue-alignment");
    assert.equal(getLatticeVerificationCorrection(b.request), "issue-alignment");
  });
  assert.equal(getLatticeVerificationCorrection(b.request), null);
  release();
  await first;
  assert.equal(getLatticeVerificationCorrection(a.request), null);
});
