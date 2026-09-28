import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LATTICE_EVIDENCE_CLAIM_BOUNDARY,
  textToLatticeAdapterBoundary,
  textToLatticeAdmissionStateMachine,
  textToLatticeEndToEndFlow,
  textToLatticeEvidenceViews,
  textToLatticeReconciliation,
  textToLatticeReconciliationRows,
  textToLatticeServiceBlueprintLanes,
  textToLatticeServiceBlueprintStages,
} from "../app/resume/lattice/evidenceViews.js";

const readSource = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

const [
  resumeProjects,
  evidenceComponent,
  diagramInfrastructure,
  chromebookComponent,
  resumeExperience,
  globalsCss,
] = await Promise.all([
  readSource("../app/resume/ResumeProjects.tsx"),
  readSource("../app/resume/lattice/TextToLatticeEvidence.tsx"),
  readSource("../app/resume/lattice/diagramInfrastructure.tsx"),
  readSource("../app/resume/ChromebookManagementViews.tsx"),
  readSource("../app/resume/ResumeExperience.tsx"),
  readSource("../app/globals.css"),
]);

test("defaults every modal opening to Try without resetting the mounted request state", () => {
  assert.match(resumeProjects, /useState<LatticeView>\("try"\)/u);
  assert.deepEqual(textToLatticeEvidenceViews, [
    { id: "end-to-end", label: "End-to-end flow" },
    { id: "adapter", label: "Adapter boundary" },
    { id: "admission", label: "Request admission" },
    { id: "reconciliation", label: "Reconciliation matrix" },
    { id: "blueprint", label: "Service blueprint" },
  ]);

  const openStart = resumeProjects.indexOf("const openLattice = useCallback");
  const openEnd = resumeProjects.indexOf("const selectLatticeView", openStart);
  const openSource = resumeProjects.slice(openStart, openEnd);
  assert.match(openSource, /latticeViewRef\.current = "try";\s*setLatticeView\("try"\);\s*setLatticeOpen\(true\)/u);
  assert.doesNotMatch(openSource, /setLatticeInput|setLatticeResult|abort\(/u);

  const selectStart = resumeProjects.indexOf("const selectLatticeView = useCallback");
  const selectEnd = resumeProjects.indexOf("const launchLattice", selectStart);
  const selectSource = resumeProjects.slice(selectStart, selectEnd);
  assert.match(selectSource, /id !== "try" && id !== "evidence"/u);
  assert.match(selectSource, /latticeViewRef\.current = id;\s*setLatticeView\(id\)/u);
  assert.doesNotMatch(selectSource, /requestRemoteLattice|executeLattice|cancelLattice|abort\(|setLatticePhase|setLatticeResult/u);

  assert.match(
    resumeProjects,
    /<div className="lattice-try-view" hidden=\{latticeView !== "try"\}>[\s\S]*?<div className="lattice-evidence-view" hidden=\{latticeView !== "evidence"\}>/u,
    "Try and Evidence stay mounted as sibling views",
  );
});

test("keeps Try on the single real API path and Evidence free of request side effects", () => {
  assert.equal((resumeProjects.match(/await requestRemoteLattice\(/gu) ?? []).length, 1);
  assert.equal((resumeProjects.match(/void executeLattice\(\)/gu) ?? []).length, 1);
  assert.match(resumeProjects, /<form className="lattice-form" onSubmit=\{runLattice\} noValidate>/u);
  assert.match(
    resumeProjects,
    /requestRemoteLattice\(latticeInput, \{[\s\S]*?requestedMode: "auto",[\s\S]*?signal: controller\.signal,[\s\S]*?onState:/u,
  );
  assert.doesNotMatch(
    `${evidenceComponent}\n${JSON.stringify({
      textToLatticeAdapterBoundary,
      textToLatticeAdmissionStateMachine,
      textToLatticeEndToEndFlow,
    })}`,
    /requestRemoteLattice|fetch\(|XMLHttpRequest|AbortController|onSubmit=/u,
  );
  assert.match(evidenceComponent, /Viewing or switching[\s\S]*?does not run a request/u);
});

test("uses the Chromebook diagram infrastructure directly for all five Evidence substates", () => {
  for (const sharedName of [
    "FrostedStateStage",
    "ReconciliationTable",
    "RovingStateTabs",
    "ServiceBlueprint",
    "StateFlowFigure",
    "useFrostedState",
  ]) {
    assert.ok(evidenceComponent.includes(sharedName), `Evidence uses ${sharedName}`);
    assert.ok(chromebookComponent.includes(sharedName), `Chromebook uses ${sharedName}`);
    assert.doesNotMatch(evidenceComponent, new RegExp(`function ${sharedName}\\b`, "u"));
  }
  assert.match(evidenceComponent, /from "\.\/diagramInfrastructure"/u);
  assert.match(chromebookComponent, /from "\.\/lattice\/diagramInfrastructure"/u);
  assert.match(evidenceComponent, /useFrostedState\("end-to-end"\)/u);
  for (const viewId of textToLatticeEvidenceViews.map(({ id }) => id)) {
    assert.ok(evidenceComponent.includes(viewId), `Evidence renders ${viewId}`);
  }

  assert.match(diagramInfrastructure, /role="tablist" aria-label=\{label\}/u);
  assert.match(diagramInfrastructure, /role="tab"[\s\S]*?aria-controls=\{panelId\}[\s\S]*?aria-selected=\{isSelected\}/u);
  assert.match(diagramInfrastructure, /tabIndex=\{isSelected \? 0 : -1\}/u);
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"]) {
    assert.ok(diagramInfrastructure.includes(`event.key === "${key}"`), `${key} is supported`);
  }
});

test("gives every Evidence diagram a complete non-spatial text equivalent", () => {
  assert.match(LATTICE_EVIDENCE_CLAIM_BOUNDARY, /not live request telemetry/u);
  assert.match(LATTICE_EVIDENCE_CLAIM_BOUNDARY, /not .*deployment observation/u);
  for (const model of [
    textToLatticeEndToEndFlow,
    textToLatticeAdapterBoundary,
    textToLatticeAdmissionStateMachine,
  ]) {
    assert.ok(model.diagram.length > 0);
    assert.ok(model.description.length > 0);
    assert.ok(model.equivalentSteps.length >= 4);
    assert.ok(Math.max(...model.diagram.split("\n").map((line) => line.length)) <= 48);
    for (const step of model.equivalentSteps) {
      for (const field of ["actor", "action", "condition", "outcome", "recovery"]) {
        assert.ok(step[field].trim(), `${model.title} ${field}`);
      }
    }
  }
  assert.match(textToLatticeEndToEndFlow.description, /confirmed form submission starts[\s\S]*?confirmation alone sends nothing/u);
  assert.match(textToLatticeAdmissionStateMachine.diagram, /window expires → HELD 503/u);

  assert.ok(textToLatticeReconciliation.diagram.length > 0);
  assert.ok(textToLatticeReconciliation.description.length > 0);
  assert.deepEqual(textToLatticeReconciliationRows.map(({ label }) => label), [
    "translated",
    "conformant-for-context",
    "review-required",
    "unable-to-attempt",
    "Bounded request or provider error",
    "Client invalid-response error",
  ]);
  for (const row of textToLatticeReconciliationRows) {
    for (const field of ["Condition and evidence:", "Host reconciliation:", "Public outcome:", "Recovery:"]) {
      assert.ok(row.value.includes(field), `${row.label} includes ${field}`);
    }
  }

  assert.deepEqual(
    textToLatticeServiceBlueprintStages.map(({ stage }) => stage),
    ["BP-01", "BP-02", "BP-03", "BP-04", "BP-05", "BP-06", "BP-07", "BP-08"],
  );
  assert.equal(textToLatticeServiceBlueprintLanes.length, 7);
  for (const stage of textToLatticeServiceBlueprintStages) {
    for (const field of ["actor", "action", "condition", "outcome", "recovery", "boundary"]) {
      assert.ok(stage[field].trim(), `${stage.stage} includes ${field}`);
    }
  }
  assert.match(textToLatticeServiceBlueprintStages[2].condition, /confirmed explicit form submission[\s\S]*?confirmation alone sends nothing/u);
  assert.match(textToLatticeServiceBlueprintStages[6].condition, /tool_calls[\s\S]*?Compatibility content requires stop/u);
  assert.match(textToLatticeReconciliationRows[0].value, /bounded-window or whole-document certification/u);

  assert.match(evidenceComponent, /<details className="lattice-evidence-text-equivalent"/u);
  assert.match(evidenceComponent, /<summary[^>]*>\{title\}<\/summary>/u);
  assert.match(evidenceComponent, /<dt>Actor<\/dt>[\s\S]*?<dt>Action<\/dt>[\s\S]*?<dt>Condition<\/dt>[\s\S]*?<dt>Outcome<\/dt>[\s\S]*?<dt>Recovery<\/dt>/u);
  const reconciliationViewStart = evidenceComponent.indexOf("function ReconciliationMatrixView");
  const reconciliationViewEnd = evidenceComponent.indexOf("function BlueprintTextEquivalent", reconciliationViewStart);
  const reconciliationView = evidenceComponent.slice(reconciliationViewStart, reconciliationViewEnd);
  assert.ok(
    reconciliationView.indexOf("<ReconciliationTable") < reconciliationView.indexOf("<details"),
    "the shared reconciliation table is the primary visible matrix, not collapsed in its text equivalent",
  );
  assert.match(reconciliationView, /<details[\s\S]*?<summary[^>]*>Complete reconciliation text equivalent<\/summary>/u);
  assert.match(reconciliationView, /\{textToLatticeReconciliation\.description\}[\s\S]*?textToLatticeReconciliationRows\.map/u);
  assert.match(reconciliationView, /<h6>\{row\.label\}<\/h6>[\s\S]*?<p>\{row\.value\}<\/p>/u);
  assert.match(evidenceComponent, /id=\{descriptionId\}[\s\S]*?not live request telemetry or deployment proof/u);
  assert.match(diagramInfrastructure, /role="img"[\s\S]*?aria-label=\{description\}[\s\S]*?tabIndex=\{0\}/u);
  assert.match(diagramInfrastructure, /<pre className="tools-card-accent signal-fuzz" aria-hidden="true">/u);
  assert.doesNotMatch(evidenceComponent, /onMouseEnter|onMouseOver|title="/u);
});

test("literally reuses the Teaching Assistant progress bar, caret, completion, and error tones", () => {
  assert.match(resumeExperience, /manifest: "technology-ethics-global-society", percent: 20, tone: "red-orange"/u);
  assert.match(resumeExperience, /manifest: "software-engineering-ui-ux", percent: 34, tone: "blue-green"/u);
  assert.match(resumeExperience, /manifest: "introduction-software-engineering", percent: 46, tone: "storm-gray"/u);
  for (const className of [
    "teaching-manifest-track",
    "teaching-manifest-fill",
    "teaching-manifest-caret",
    "teaching-manifest-percent signal-fuzz",
  ]) {
    assert.ok(resumeProjects.includes(`className="${className}"`), `modal uses ${className}`);
  }
  assert.match(resumeProjects, /className=\{`lattice-progress teaching-manifest-entry--\$\{progress\.tone\}`\}/u);
  assert.match(resumeProjects, /"--teaching-support": `\$\{progress\.percent\}%`/u);
  assert.match(resumeProjects, /role="progressbar"[\s\S]*?aria-valuemin=\{0\}[\s\S]*?aria-valuemax=\{100\}[\s\S]*?aria-valuenow=\{progress\.percent\}/u);
  assert.match(resumeProjects, /Mapped interface lifecycle; not elapsed provider work\./u);
  assert.match(globalsCss, /\.teaching-manifest-entry--red-orange \{[\s\S]*?--teaching-caret-fill:[\s\S]*?--teaching-caret-outline:/u);
  assert.match(globalsCss, /\.teaching-manifest-entry--blue-green \{[\s\S]*?--teaching-caret-fill:[\s\S]*?--teaching-caret-outline:/u);
  assert.match(globalsCss, /\.teaching-manifest-entry--storm-gray \{[\s\S]*?--teaching-caret-fill:[\s\S]*?--teaching-caret-outline:/u);
  assert.match(globalsCss, /\.teaching-manifest-caret \{[\s\S]*?background: var\(--teaching-caret-fill\)[\s\S]*?var\(--teaching-caret-outline\)/u);
});

test("keeps the last observed lifecycle milestone separate from cancel and terminal state", () => {
  assert.match(
    resumeProjects,
    /useState<LatticeMilestonePhase>\("idle"\)/u,
  );
  assert.match(
    resumeProjects,
    /latticeModalPresentation\(\{[\s\S]*?phase: latticePhase,[\s\S]*?lastObservedPhase: latticeLastObservedPhase,[\s\S]*?disposition: latticePresentationDisposition/u,
  );
  assert.match(
    resumeProjects,
    /onState: \(phase: LatticeMilestonePhase\) => \{[\s\S]*?setLatticePhase\(phase\);[\s\S]*?setLatticeLastObservedPhase\(phase\);/u,
  );

  const cancelStart = resumeProjects.indexOf("const cancelLattice = useCallback");
  const cancelEnd = resumeProjects.indexOf("useEffect(() => {", cancelStart);
  const cancelSource = resumeProjects.slice(cancelStart, cancelEnd);
  assert.match(cancelSource, /setLatticePhase\("canceling"\)/u);
  assert.doesNotMatch(cancelSource, /setLatticeLastObservedPhase/u);

  const executeStart = resumeProjects.indexOf("const executeLattice = async () => {");
  const catchStart = resumeProjects.indexOf("    } catch (error) {", executeStart);
  const catchEnd = resumeProjects.indexOf("    } finally {", catchStart);
  const catchSource = resumeProjects.slice(catchStart, catchEnd);
  assert.match(catchSource, /setLatticePresentationDisposition\("canceled"\)[\s\S]*?setLatticePhase\("ready"\)/u);
  assert.match(catchSource, /setLatticePresentationDisposition\(latticeFailureDisposition\(error\)\)[\s\S]*?setLatticePhase\("error"\)/u);
  assert.doesNotMatch(catchSource, /setLatticeLastObservedPhase/u);
});

test("retains focus, reduced-motion, forced-color, and mobile safeguards", () => {
  assert.match(resumeProjects, /closest\("\[hidden\], \[aria-hidden='true'\], \[inert\]"\)/u);
  assert.match(
    resumeProjects,
    /if \(!output \|\| modal\?\.hasAttribute\("hidden"\) \|\| output\.closest\("\[hidden\], \[aria-hidden='true'\], \[inert\]"\)\) return;/u,
  );
  assert.match(resumeProjects, /activeView !== "try"[\s\S]*?#lattice-demo-view-\$\{activeView\}-tab/u);
  assert.match(resumeProjects, /aria-label=\{taskContinuesWhileClosed \? "Close Evidence; current task continues" : "Close Evidence"\}/u);
  for (const query of [
    "(prefers-reduced-motion: reduce)",
    "(prefers-reduced-transparency: reduce)",
    "(forced-colors: active)",
  ]) {
    assert.ok(diagramInfrastructure.includes(`"${query}"`), `${query} disables the diagram transition`);
  }
  assert.match(globalsCss, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.teaching-manifest-caret \{ animation: none; \}/u);
  assert.match(globalsCss, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.chromebook-state-tab,[\s\S]*?transition: none;/u);
  assert.match(globalsCss, /@media \(forced-colors: active\) \{[\s\S]*?\.lattice-progress \.teaching-manifest-fill \{[\s\S]*?background: Highlight !important;/u);
  assert.match(globalsCss, /\.chromebook-state-flow \{[\s\S]*?overflow-x: auto;/u);
  assert.match(globalsCss, /\.chromebook-evidence-table \{[\s\S]*?width: 100%;/u);
  assert.match(globalsCss, /@media \(max-width: 520px\) \{[\s\S]*?\.chromebook-view-tabs \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/u);
  assert.match(globalsCss, /@media screen and \(max-width: 600px\) \{[\s\S]*?\.lattice-modal-content \{[\s\S]*?width: calc\(100% - 2rem\);/u);
});
