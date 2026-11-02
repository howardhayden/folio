import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { latticeServiceViewState } from "../app/resume/lattice/serviceView.js";
import { LATTICE_SERVICE_PHASES } from "../app/resume/lattice/serviceTelemetry.js";

test("service view highlights only four browser-observed phase milestones", () => {
  for (const [phase, stepId, phaseNumber, label, widthPercent] of [
    ["validating", "input", 1, "Validating", 10],
    ["submitting", "submit", 2, "Submitting", 20],
    ["processing", "service", 3, "Transforming", 25],
    ["success", "result", 4, "Complete", 100],
  ]) {
    assert.deepEqual(latticeServiceViewState({ phase, resultStatus: "translated" }), {
      label, stepId, phaseNumber, widthPercent,
      tone: phase === "success" ? "storm-gray" : "blue-green",
    });
  }
});

test("idle and ready retain a full gray track without a completed phase claim", () => {
  for (const phase of ["idle", "ready"]) {
    assert.deepEqual(latticeServiceViewState({ phase, lastActivePhase: "processing" }), {
      label: phase === "idle" ? "Idle" : "Ready", tone: "storm-gray",
      stepId: null, phaseNumber: 0, widthPercent: 100,
    });
  }
});

test("cancellation and failure retain the last observed boundary without advancing", () => {
  for (const [lastActivePhase, stepId, phaseNumber, widthPercent] of [
    ["validating", "input", 1, 10], ["submitting", "submit", 2, 20], ["processing", "service", 3, 25],
  ]) {
    for (const phase of ["canceling", "error", "ready"]) {
      assert.deepEqual(latticeServiceViewState({ phase, lastActivePhase, hasError: phase === "ready" }), {
        label: phase === "canceling" ? "Canceling" : "Stopped", tone: "red-orange",
        stepId, phaseNumber, widthPercent,
      });
    }
  }
});

test("local input errors and unrecognized history cannot imply remote work", () => {
  for (const lastActivePhase of [null, "idle", "ready", "analysis", "repair", "certification", "__proto__"]) {
    assert.deepEqual(latticeServiceViewState({ phase: "ready", lastActivePhase, hasError: true }), {
      label: "Check input", tone: "red-orange", stepId: "input", phaseNumber: 1, widthPercent: 10,
    });
  }
  for (const phase of ["analysis", "repair", "certification", "__proto__"]) {
    assert.equal(latticeServiceViewState({ phase }).phaseNumber, 0);
    assert.equal(latticeServiceViewState({ phase }).stepId, null);
  }
});

test("returned review and refusal dispositions are not displayed as normal completion", () => {
  for (const [resultStatus, label] of [["review-required", "Review required"], ["unable-to-attempt", "Unable to attempt"]]) {
    assert.deepEqual(latticeServiceViewState({ phase: "success", resultStatus }), {
      label, tone: "red-orange", stepId: "result", phaseNumber: 4, widthPercent: 100,
    });
  }
  assert.equal(latticeServiceViewState({ phase: "success", resultStatus: "conformant-for-context" }).tone, "storm-gray");
});

test("phase presentation is independent of time and does not mutate its input", () => {
  const input = Object.freeze({ phase: "processing", lastActivePhase: "submitting", hasError: false });
  assert.deepEqual(latticeServiceViewState(input), latticeServiceViewState(input));
  assert.deepEqual(input, { phase: "processing", lastActivePhase: "submitting", hasError: false });
});

test("validated service telemetry highlights the real stage, including repair loops", () => {
  const expected = [
    ["binding-source-integrity", "prepare", "Preparing"],
    ["atomizing", "analysis", "Analyzing"],
    ["generating", "draft", "Drafting"],
    ["binding-result-integrity", "bind", "Binding candidate"],
    ["verifying", "verify", "Verifying"],
    ["reatomizing", "analysis", "Reanalyzing"],
    ["regenerating", "repair", "Regenerating"],
    ["repairing", "repair", "Repairing"],
    ["reverifying", "verify", "Reverifying"],
    ["planning-certification", "certify", "Planning checks"],
    ["certifying-windows", "certify", "Certifying windows"],
    ["certifying-document", "certify", "Certifying document"],
    ["certifying-relations", "certify", "Certifying relations"],
  ];
  assert.deepEqual(expected.map(([phase]) => phase).sort(), [...LATTICE_SERVICE_PHASES].sort());
  for (const [servicePhase, stepId, label] of expected) {
    const active = latticeServiceViewState({ phase: "processing", servicePhase });
    assert.equal(active.stepId, stepId);
    assert.equal(active.label, label);
    assert.equal(active.tone, "blue-green");
    const failed = latticeServiceViewState({ phase: "error", lastActivePhase: "processing", servicePhase });
    assert.equal(failed.stepId, stepId);
    assert.equal(failed.label, `Stopped · ${label}`);
    assert.equal(failed.tone, "red-orange");
    assert.equal(failed.widthPercent, active.widthPercent);
  }
  const repair = latticeServiceViewState({ phase: "processing", servicePhase: "repairing" });
  const verify = latticeServiceViewState({ phase: "processing", servicePhase: "verifying" });
  assert.ok(repair.widthPercent < verify.widthPercent, "correction revisits a phase rather than inventing completion");
});

test("stale service telemetry cannot override input, submission or a terminal result", () => {
  for (const phase of ["ready", "validating", "submitting", "success"]) {
    assert.deepEqual(latticeServiceViewState({ phase, servicePhase: "repairing" }), latticeServiceViewState({ phase }));
  }
  for (const servicePhase of ["__proto__", "provider-output", "unknown", ""]) {
    assert.deepEqual(latticeServiceViewState({ phase: "processing", servicePhase }), latticeServiceViewState({ phase: "processing" }));
  }
});

test("switching the shipped service tabs preserves the mounted request and result", async () => {
  const source = await readFile(new URL("../app/resume/ResumeProjects.tsx", import.meta.url), "utf8");
  const handler = source.match(/onSelect=\{(\(view\) => \{[^\n]+\})\}/u)?.[1];
  assert.ok(handler, "the service-view callback is present");
  const selections = [];
  const forbidden = () => { throw new Error("view selection must not execute or reset a request"); };
  const select = vm.runInNewContext(`(${handler})`, {
    setLatticeView: (view) => selections.push(view),
    requestRemoteLattice: forbidden,
    executeLattice: forbidden,
    cancelLattice: forbidden,
    setLatticePhase: forbidden,
    setLatticeResult: forbidden,
    setLatticeInput: forbidden,
  });
  select("diagram");
  select("api");
  select("unknown");
  assert.deepEqual(selections, ["diagram", "api"]);
  assert.match(source, /<div className="lattice-api-view" hidden=\{latticeView !== "api"\}>/u);
  assert.match(source, /<div className="lattice-service-view" hidden=\{latticeView !== "diagram"\}>/u);
  assert.doesNotMatch(source, /latticeView === "api"\s*&&/u, "switching views must not unmount the API form or protected result");
});

test("the shipped focus filter excludes inactive tabs, hidden panels and closed disclosure contents", async () => {
  const source = await readFile(new URL("../app/resume/ResumeProjects.tsx", import.meta.url), "utf8");
  const predicate = source.match(/\)\.filter\((\(element\) => element\.tabIndex[^\n]+)\);/u)?.[1];
  assert.ok(predicate);
  const accepts = vm.runInNewContext(`(${predicate})`);
  const element = (tabIndex, hiddenAncestor, hasLayout = true) => ({
    tabIndex,
    getClientRects: () => hasLayout ? [{}] : [],
    closest: (selector) => {
      assert.equal(selector, "[hidden], [aria-hidden='true']");
      return hiddenAncestor ? {} : null;
    },
  });
  assert.equal(accepts(element(0, false)), true);
  assert.equal(accepts(element(-1, false)), false);
  assert.equal(accepts(element(0, false, false)), false);
  assert.equal(accepts(element(0, true)), false);
  assert.equal(accepts(element(1, true)), false);
});
