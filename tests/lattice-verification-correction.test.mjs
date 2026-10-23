import assert from "node:assert/strict";
import test from "node:test";
import {
  rememberLatticeVerificationIssueAlignmentError,
  rememberLatticeVerificationDecisionAlignmentError,
  withLatticeVerificationCorrection as during,
  getLatticeVerificationCorrection as cue,
} from "../app/resume/lattice/verificationCorrection.js";

const producers = {
  "issue-alignment": rememberLatticeVerificationIssueAlignmentError,
  "decision-alignment": rememberLatticeVerificationDecisionAlignmentError,
};
function fixture(kind, stage = "verification") {
  const batch = Object.freeze({}), analysis = Object.freeze({}), candidate = Object.freeze({});
  const request = Object.freeze({ batch, analysis, candidate,
    protocolFeedback: Object.freeze({ stage, attempt: 2 }) });
  const error = new Error("private synthetic host failure");
  producers[kind](error, batch, analysis, candidate, stage);
  return { request, error, stage };
}
function mark(kind, error, request, stage) {
  return producers[kind](error, request.batch, request.analysis, request.candidate, stage);
}

for (const kind of Object.keys(producers)) {
  test(`${kind} is scoped to either owned second stage and cannot replay or be remarked`, async () => {
    for (const stage of ["verification", "reverification"]) {
      const { request, error } = fixture(kind, stage);
      assert.equal(cue(request), null);
      const result = await during(request, error, async () => {
        assert.equal(cue(request), kind);
        await Promise.resolve();
        assert.equal(cue(request), kind);
        assert.equal(cue(Object.freeze({ ...request })), null);
        return 42;
      });
      assert.equal(result, 42);
      assert.equal(cue(request), null);
      for (const producer of Object.keys(producers)) mark(producer, error, request, stage);
      await during(request, error, () => assert.equal(cue(request), null));
      assert.equal(JSON.stringify(request).includes("private synthetic"), false);
    }
  });

  test(`${kind} rejects wrong origins, stage, attempt, mutability and own-data accessors`, async (context) => {
    for (const field of ["batch", "analysis", "candidate", "stage", "attempt1", "attempt3", "string-attempt", "foreign-stage", "mutable-request", "mutable-feedback", "batch-getter", "analysis-getter", "candidate-getter", "feedback-getter", "stage-getter", "attempt-getter", "inherited-candidate"]) {
      await context.test(field, async () => {
        const { request, error } = fixture(kind);
        let copy = { ...request }, reads = 0;
        if (["batch", "analysis", "candidate"].includes(field)) copy[field] = Object.freeze({});
        if (field === "stage") copy.protocolFeedback = Object.freeze({ stage: "reverification", attempt: 2 });
        if (field === "foreign-stage") copy.protocolFeedback = Object.freeze({ stage: "certification", attempt: 2 });
        if (field.startsWith("attempt") && !field.endsWith("getter")) copy.protocolFeedback = Object.freeze({ stage: "verification", attempt: Number(field.slice(-1)) });
        if (field === "string-attempt") copy.protocolFeedback = Object.freeze({ stage: "verification", attempt: "2" });
        if (field === "mutable-feedback") copy.protocolFeedback = { ...request.protocolFeedback };
        const ownGetter = { "batch-getter": "batch", "analysis-getter": "analysis", "candidate-getter": "candidate", "feedback-getter": "protocolFeedback" }[field];
        if (ownGetter) Object.defineProperty(copy, ownGetter, { enumerable: true, get() { reads += 1; return request[ownGetter]; } });
        if (["stage-getter", "attempt-getter"].includes(field)) {
          const key = field.split("-")[0], feedback = { ...request.protocolFeedback };
          Object.defineProperty(feedback, key, { enumerable: true, get() { reads += 1; return request.protocolFeedback[key]; } });
          copy.protocolFeedback = Object.freeze(feedback);
        }
        if (field === "inherited-candidate") {
          delete copy.candidate;
          copy = Object.assign(Object.create(Object.freeze({ get candidate() { reads += 1; return request.candidate; } })), copy);
        }
        if (field !== "mutable-request") Object.freeze(copy);
        await during(copy, error, () => assert.equal(cue(copy), null));
        assert.equal(reads, 0);
        await during(request, error, () => assert.equal(cue(request), kind));
      });
    }
  });

  test(`${kind} ignores forged errors, diagnostic properties and caller feedback`, async () => {
    const { request, error } = fixture(kind);
    const forgedRequest = Object.freeze({ ...request, wireCorrection: kind,
      diagnostic: Object.freeze({ boundary: "host-normalizer", category: "decision-consistency" }),
      protocolFeedback: Object.freeze({ ...request.protocolFeedback, issue: "private synthetic host failure", wireCorrection: kind }) });
    for (const lookalike of [new Error(error.message), Object.freeze({ message: error.message, kind,
      diagnostic: Object.freeze({ boundary: "host-normalizer", category: "decision-consistency" }) })]) {
      await during(forgedRequest, lookalike, () => assert.equal(cue(forgedRequest), null));
    }
    await during(request, error, () => assert.equal(cue(request), kind));
  });

  test(`${kind} requires frozen origins and actual verifier stage when marked`, async () => {
    const { request } = fixture(kind);
    for (const field of ["batch", "analysis", "candidate", "stage"]) {
      const origins = { ...request }, error = new Error("unmarked host failure");
      const stage = field === "stage" ? "analysis" : "verification";
      if (field !== "stage") origins[field] = {};
      mark(kind, error, origins, stage);
      if (field !== "stage") Object.freeze(origins[field]);
      const copy = Object.freeze({ ...origins });
      await during(copy, error, () => assert.equal(cue(copy), null));
    }
  });

  test(`${kind} expires on synchronous, asynchronous and thenable failures`, async () => {
    for (const failureKind of ["synchronous", "asynchronous", "then-getter"]) {
      const { request, error } = fixture(kind, "reverification");
      const failure = new Error("bounded provider refusal");
      await assert.rejects(during(request, error, () => {
        assert.equal(cue(request), kind);
        if (failureKind === "synchronous") throw failure;
        if (failureKind === "asynchronous") return Promise.reject(failure);
        return { get then() { throw failure; } };
      }), (caught) => caught === failure);
      assert.equal(cue(request), null);
      await during(request, error, () => assert.equal(cue(request), null));
    }
  });
}

test("first producer owns an error across kinds, origins, consumption and expiry", async () => {
  for (const first of Object.keys(producers)) {
    const other = first === "issue-alignment" ? "decision-alignment" : "issue-alignment";
    const a = fixture(first), b = fixture(other, "reverification");
    mark(other, a.error, b.request, b.stage);
    await during(b.request, a.error, () => assert.equal(cue(b.request), null));
    await during(a.request, a.error, () => assert.equal(cue(a.request), first));
    mark(other, a.error, b.request, b.stage);
    await during(b.request, a.error, () => assert.equal(cue(b.request), null));
    await during(b.request, b.error, () => assert.equal(cue(b.request), other));
  }
});

test("nested cross-kind calls cannot overwrite, revoke or consume another owned context", async () => {
  const a = fixture("issue-alignment"), pending = new Error("separate actual failure");
  mark("decision-alignment", pending, a.request, a.stage);
  await during(a.request, a.error, async () => {
    await during(a.request, pending, () => assert.equal(cue(a.request), "issue-alignment"));
    await during(a.request, a.error, () => assert.equal(cue(a.request), "issue-alignment"));
    assert.equal(cue(a.request), "issue-alignment");
  });
  assert.equal(cue(a.request), null);
  await during(a.request, pending, () => assert.equal(cue(a.request), "decision-alignment"));
  assert.equal(cue(a.request), null);
});

test("concurrent cross-kind corrections expire independently and consumption precedes invoke", async () => {
  const a = fixture("issue-alignment"), b = fixture("decision-alignment", "reverification");
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  const first = during(a.request, a.error, async () => {
    const copy = Object.freeze({ ...a.request });
    await during(copy, a.error, () => assert.equal(cue(copy), null));
    await wait;
    assert.equal(cue(a.request), "issue-alignment");
  });
  await during(b.request, b.error, () => {
    assert.equal(cue(a.request), "issue-alignment");
    assert.equal(cue(b.request), "decision-alignment");
  });
  assert.equal(cue(b.request), null);
  release();
  await first;
  assert.equal(cue(a.request), null);
});
