import assert from "node:assert/strict";
import test from "node:test";
import {
  LATTICE_MODAL_MILESTONE_PERCENTAGES,
  latticeModalPresentation,
} from "../app/resume/lattice/modalPresentation.js";

test("maps observable request phases to fixed lifecycle milestones", () => {
  assert.deepEqual(LATTICE_MODAL_MILESTONE_PERCENTAGES, {
    idle: 0,
    ready: 0,
    validating: 20,
    submitting: 45,
    processing: 75,
    success: 100,
  });

  assert.deepEqual(
    latticeModalPresentation({ phase: "idle" }),
    { label: "Ready", percent: 0, tone: "storm-gray", terminal: false, successful: false },
  );
  assert.equal(latticeModalPresentation({ phase: "submitting" }).percent, 45);
  assert.deepEqual(
    latticeModalPresentation({ phase: "success" }),
    { label: "Complete", percent: 100, tone: "blue-green", terminal: true, successful: true },
  );
});

test("cancellation preserves the last validating, submitting, or processing milestone", () => {
  for (const lastObservedPhase of ["validating", "submitting", "processing"]) {
    const active = latticeModalPresentation({ phase: lastObservedPhase });
    const canceling = latticeModalPresentation({ phase: "canceling", lastObservedPhase });
    const canceled = latticeModalPresentation({
      phase: "ready",
      lastObservedPhase,
      disposition: "canceled",
    });

    assert.equal(canceling.percent, active.percent, `${lastObservedPhase} -> canceling`);
    assert.equal(canceled.percent, active.percent, `${lastObservedPhase} -> canceled`);
    assert.deepEqual(
      [canceling.label, canceling.tone, canceling.terminal, canceling.successful],
      ["Canceling", "storm-gray", false, false],
    );
    assert.deepEqual(
      [canceled.label, canceled.tone, canceled.terminal, canceled.successful],
      ["Canceled", "storm-gray", true, false],
    );
  }
});

test("failures and rejections preserve each last client-observed milestone", () => {
  const trajectories = [
    { lastObservedPhase: "ready", phase: "ready", disposition: "rejected", expected: 0 },
    { lastObservedPhase: "validating", phase: "error", disposition: null, expected: 20 },
    { lastObservedPhase: "validating", phase: "error", disposition: "rejected", expected: 20 },
    { lastObservedPhase: "submitting", phase: "error", disposition: "rejected", expected: 45 },
    { lastObservedPhase: "submitting", phase: "error", disposition: "unavailable", expected: 45 },
    { lastObservedPhase: "processing", phase: "error", disposition: "rejected", expected: 75 },
    { lastObservedPhase: "processing", phase: "error", disposition: "unavailable", expected: 75 },
  ];

  for (const trajectory of trajectories) {
    const before = latticeModalPresentation({ phase: trajectory.lastObservedPhase });
    const after = latticeModalPresentation(trajectory);
    assert.equal(before.percent, trajectory.expected, `${trajectory.lastObservedPhase} starts at expected milestone`);
    assert.equal(after.percent, before.percent, JSON.stringify(trajectory));
    assert.equal(after.successful, false);
    assert.equal(after.tone, "red-orange");
    assert.equal(after.terminal, true);
  }
});

test("keeps held, refusal, and availability states distinct from success", () => {
  const cases = [
    { disposition: "held", lastObservedPhase: "ready", expected: 0 },
    { disposition: "rejected", lastObservedPhase: "validating", expected: 20 },
    { disposition: "unavailable", lastObservedPhase: "processing", expected: 75 },
  ];

  for (const { disposition, lastObservedPhase, expected } of cases) {
    const state = latticeModalPresentation({ phase: "ready", lastObservedPhase, disposition });
    assert.equal(state.percent, expected, disposition);
    assert.equal(state.successful, false, disposition);
    assert.notEqual(state.tone, "blue-green", disposition);
    assert.notEqual(state.percent, 100, disposition);
  }
});

test("uses result context to distinguish completed results from unable-to-attempt", () => {
  for (const resultStatus of ["translated", "conformant-for-context"]) {
    assert.deepEqual(
      latticeModalPresentation({ phase: "success", resultStatus }),
      { label: "Complete", percent: 100, tone: "blue-green", terminal: true, successful: true },
      resultStatus,
    );
  }

  assert.deepEqual(
    latticeModalPresentation({ phase: "success", resultStatus: "review-required" }),
    { label: "Review required", percent: 100, tone: "blue-green", terminal: true, successful: true },
  );
  assert.deepEqual(
    latticeModalPresentation({ phase: "success", resultStatus: "unable-to-attempt" }),
    { label: "Unable to produce a result", percent: 75, tone: "red-orange", terminal: true, successful: false },
  );
});

test("fails closed for unsupported or contradictory presentation input", () => {
  assert.throws(
    () => latticeModalPresentation({ phase: "unknown" }),
    /Unsupported Text to Lattice phase/u,
  );
  assert.throws(
    () => latticeModalPresentation({ phase: "ready", lastObservedPhase: "ready", disposition: "complete" }),
    /Unsupported Text to Lattice disposition/u,
  );
  assert.throws(
    () => latticeModalPresentation({ phase: "success", resultStatus: "unknown" }),
    /Unsupported Text to Lattice result status/u,
  );
  assert.throws(
    () => latticeModalPresentation({ phase: "processing", resultStatus: "translated" }),
    /requires the success phase/u,
  );
  for (const state of [
    { phase: "canceling" },
    { phase: "error" },
    { phase: "ready", disposition: "rejected" },
  ]) {
    assert.throws(
      () => latticeModalPresentation(state),
      /requires its last observed milestone phase/u,
    );
  }
  assert.throws(
    () => latticeModalPresentation({ phase: "error", lastObservedPhase: "canceling" }),
    /Unsupported Text to Lattice milestone phase/u,
  );
});

test("presentation records are immutable and use only established tones", () => {
  const states = [
    latticeModalPresentation({ phase: "ready" }),
    latticeModalPresentation({ phase: "validating" }),
    latticeModalPresentation({ phase: "submitting" }),
    latticeModalPresentation({ phase: "processing" }),
    latticeModalPresentation({ phase: "success" }),
    latticeModalPresentation({ phase: "canceling", lastObservedPhase: "submitting" }),
    latticeModalPresentation({ phase: "error", lastObservedPhase: "processing" }),
    latticeModalPresentation({ phase: "error", lastObservedPhase: "processing", disposition: "unavailable" }),
  ];
  const tones = new Set(["storm-gray", "blue-green", "red-orange"]);
  for (const state of states) {
    assert.equal(Object.isFrozen(state), true);
    assert.equal(tones.has(state.tone), true, state.tone);
  }
  assert.equal(Object.isFrozen(LATTICE_MODAL_MILESTONE_PERCENTAGES), true);
});
