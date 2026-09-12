import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { latticeAttestationSize } from "../app/resume/lattice/attestation.js";

const resumeProjectsSource = await readFile(new URL("../app/resume/ResumeProjects.tsx", import.meta.url), "utf8");
const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const attestationSource = await readFile(new URL("../app/resume/lattice/attestation.js", import.meta.url), "utf8");
const promptSource = await readFile(new URL("../app/resume/lattice/promptContract.js", import.meta.url), "utf8");
const modelContractSource = await readFile(new URL("../app/resume/lattice/modelContract.js", import.meta.url), "utf8");
const canonicalPageSource = await readFile(new URL("../app/projects/lattice/text-to-lattice/page.tsx", import.meta.url), "utf8");

test("the interactive release uses only the established project SVG as its card launcher", () => {
  assert.match(resumeProjectsSource, /data-lattice-launch="text-to-lattice"/u);
  assert.match(
    resumeProjectsSource,
    /className="tool-icon project-modal-trigger signal-fuzz"[\s\S]*?data-lattice-launch="text-to-lattice"[\s\S]*?aria-label="Use Text to Lattice"[\s\S]*?aria-haspopup="dialog"[\s\S]*?aria-controls="lattice-demo-dialog"[\s\S]*?onClick=\{onLatticeLaunch\}[\s\S]*?<ProjectIcon/u,
  );
  assert.match(resumeProjectsSource, /onLatticeLaunch=\{[\s\S]*?project\.interaction === "lattice-demo" \? launchLattice : undefined\}/u);
  assert.match(resumeProjectsSource, /<h3[\s\S]*?<a[\s\S]*?className="signal-fuzz"[\s\S]*?href=\{project\.canonicalPath\}[\s\S]*?>[\s\S]*?\{project\.name\}[\s\S]*?<\/a>[\s\S]*?<\/h3>/u);
  assert.match(resumeProjectsSource, /url\.hash !== "#text-to-lattice"/u);
  assert.match(resumeProjectsSource, /window\.location\.replace\("\/resume\/#text-to-lattice"\)/u);
  assert.match(resumeProjectsSource, /window\.history\.replaceState[\s\S]*?openLattice\(trigger\)/u);
  assert.match(canonicalPageSource, /href="\/resume\/#text-to-lattice"[^>]*>Use Text to Lattice<\/a>/u);
  assert.match(canonicalPageSource, /releaseHeld \? \([\s\S]*?Use Text to Lattice/u);
});

test("the interaction binds model disclosure and source-specific acceptable use", () => {
  assert.match(resumeProjectsSource, /Model-assisted result: Qwen drafts locally and Llama 3\.2 checks locally/u);
  assert.match(resumeProjectsSource, /Review every result before relying on it/u);
  assert.match(resumeProjectsSource, />Built with Llama<\/a>/u);
  assert.match(resumeProjectsSource, /id="lattice-use-confirmation"[\s\S]*?type="checkbox"[\s\S]*?required/u);
  assert.match(resumeProjectsSource, /!latticeUseConfirmed/u);
  assert.match(resumeProjectsSource, /if \(!latticeUseConfirmed\)[\s\S]*?return;[\s\S]*?acquireLatticeLease/u);
  assert.match(resumeProjectsSource, /const updateLatticeInput = \(value: string\) => \{\s*setLatticeUseConfirmed\(false\)/u);
  assert.match(resumeProjectsSource, /First use downloads about 4\.10 GB[\s\S]*?3\.5 GB of working memory/u);
  assert.match(modelContractSource, /https:\/\/developer\.meta\.com\/ai\/llama3_2\/license\//u);
  assert.match(modelContractSource, /https:\/\/developer\.meta\.com\/ai\/llama3_2\/use-policy\//u);
});

test("the verifier safety contract judges purpose and consequence without topic bans", () => {
  assert.match(promptSource, /Safety is purpose- and consequence-aware/u);
  assert.match(promptSource, /materially further prohibited conduct/u);
  assert.match(promptSource, /lack necessary authority, consent, or license/u);
  for (const context of ["Quotation", "history", "criticism", "journalism", "fiction", "prevention", "defensive discussion"]) {
    assert.match(promptSource, new RegExp(context, "iu"));
  }
  assert.match(promptSource, /never keyword-ban/u);
});

test("the modal focus trap includes an interactive attestation iframe", () => {
  assert.match(resumeProjectsSource, /"iframe:not\(\[tabindex='-1'\]\)"/u);
  assert.match(resumeProjectsSource, /"summary"/u);
});

test("focus remains contained when controls disable or the attestation frame is removed", () => {
  assert.match(resumeProjectsSource, /const focusObserver = new MutationObserver\(scheduleFocusContainment\)/u);
  assert.match(resumeProjectsSource, /attributeFilter: \["aria-hidden", "disabled", "hidden", "tabindex"\]/u);
  assert.match(resumeProjectsSource, /childList: true,[\s\S]*?subtree: true/u);
  assert.match(resumeProjectsSource, /latticeAttestationRef\.current[\s\S]*?latticeCancelButtonRef\.current[\s\S]*?needs-clarification[\s\S]*?latticeOutputRef\.current[\s\S]*?latticeInputRef\.current/u);
  assert.match(resumeProjectsSource, /focusObserver\.disconnect\(\)/u);
  assert.match(resumeProjectsSource, /latticeCloseRef\.current\(\)/u);
  assert.match(resumeProjectsSource, /\}, \[latticeOpen\]\);/u);
});

test("backdrop dismissal waits for a completed same-target click", () => {
  assert.match(resumeProjectsSource, /onClick=\{\(event\) => \{[\s\S]*?event\.target === event\.currentTarget[\s\S]*?closeLattice\(\)/u);
  assert.doesNotMatch(resumeProjectsSource, /onPointerDown=\{closeLattice\}/u);
});

test("Text to Lattice uses the shared frosted Resume backdrop without clipping its isolated viewport", () => {
  assert.match(resumeProjectsSource, /className="modal resume-modal lattice-modal"/u);
  assert.match(
    globalsCss,
    /\.modal\.resume-modal\.lattice-modal \{\s*isolation: isolate;\s*\}/u,
  );
  assert.doesNotMatch(
    globalsCss.match(/\.modal\.resume-modal\.lattice-modal \{([\s\S]*?)\n\}/u)?.[1] ?? "",
    /background/u,
    "Text to Lattice must inherit the same transparent backdrop as every Resume modal",
  );
  assert.match(resumeProjectsSource, /document\.body\.classList\.add\("resume-modal-open"\)/u);
  assert.match(
    globalsCss,
    /\.resume-modal-open main > \.container,[\s\S]*?\.resume-modal-open \.resume-search-canonical > \.container,[\s\S]*?\.resume-modal-open \.resume-search-results \{ filter: blur\(5px\); \}/u,
  );

  const baseStageRule = globalsCss.match(/\.resume-search-stage \{([\s\S]*?)\n\}/u)?.[1] ?? "";
  const clippedStageRule = globalsCss.match(/\.resume-search-stage--clip-canonical \{([\s\S]*?)\n\}/u)?.[1] ?? "";
  assert.doesNotMatch(
    baseStageRule,
    /\b(?:filter|isolation|perspective|transform|will-change)\s*:/u,
    "the canonical Search stage must not trap the fixed dialog below a sibling stacking context",
  );
  assert.match(
    clippedStageRule,
    /isolation: isolate/u,
    "Search-only crossfades remain locally isolated while the canonical modal is closed",
  );
});

test("the source field is a large instance of the Resume Search input treatment", () => {
  const sourceInput = resumeProjectsSource.match(/<textarea[\s\S]*?\/>/u)?.[0] ?? "";
  assert.match(sourceInput, /className="form-control shelf-search-entry lattice-input"/u);
  assert.match(sourceInput, /id="lattice-demo-input"/u);
  assert.match(sourceInput, /rows=\{9\}/u);
  assert.match(resumeProjectsSource, /<label className="lattice-input-label" htmlFor="lattice-demo-input">/u);

  assert.match(
    globalsCss,
    /\.form-control\.resume-search-input,\s*\.form-control\.resume-search-input:focus,\s*\.form-control\.lattice-input,\s*\.form-control\.lattice-input:focus \{\s*box-shadow: 0 6px 6px -7px rgb\(0 0 0 \/ 58%\);/u,
    "both inputs use the same faint lower-edge and lower-corner shadow atom",
  );
  const latticeInputRule = globalsCss.match(/\.form-control\.lattice-input \{([\s\S]*?)\n\}/u)?.[1] ?? "";
  assert.match(latticeInputRule, /min-height: 13rem/u);
  assert.match(latticeInputRule, /resize: vertical/u);
  assert.doesNotMatch(
    latticeInputRule,
    /(?:background(?:-color)?|border(?:-radius)?|box-shadow)\s*:/u,
    "the large field must inherit Search's visual atoms rather than introduce another skin",
  );
});

test("dismissing and reopening preserves the same Text to Lattice session", () => {
  const closeStart = resumeProjectsSource.indexOf("const closeLattice = useCallback");
  const closeEnd = resumeProjectsSource.indexOf("useEffect(() => {\n    latticeCloseRef.current", closeStart);
  const closeSource = resumeProjectsSource.slice(closeStart, closeEnd);
  assert.match(closeSource, /setLatticeOpen\(false\)/u);
  assert.doesNotMatch(closeSource, /cancelLattice\(|abort\(|releaseCurrentLatticeLease|discardLocalLatticeModel/u);
  for (const destructiveCall of [
    "setLatticeInput(\"\")",
    "setLatticeResult(null)",
    "setLatticeProgress(null)",
    "setClarificationHistory([])",
  ]) {
    assert.equal(closeSource.includes(destructiveCall), false, `dismiss does not call ${destructiveCall}`);
  }

  const openStart = resumeProjectsSource.indexOf("const openLattice = useCallback");
  const openEnd = resumeProjectsSource.indexOf("const launchLattice", openStart);
  const openSource = resumeProjectsSource.slice(openStart, openEnd);
  assert.match(openSource, /setLatticeOpen\(true\)/u);
  assert.match(openSource, /latticeSupported === null && latticePhase === "idle"/u);
  assert.doesNotMatch(openSource, /setLatticeInput|setLatticeResult|setLatticeProgress|setLatticeUseConfirmed/u);
  assert.match(resumeProjectsSource, /aria-label=\{taskContinuesWhileClosed \? "Close; current task continues" : "Close"\}/u);
  assert.match(resumeProjectsSource, /if \(result && latticeOutputRef\.current\) return latticeOutputRef\.current;[\s\S]*?input && !input\.disabled/u);
  const protectionStart = resumeProjectsSource.indexOf('window.addEventListener("blur", shield)');
  const protectionEnd = resumeProjectsSource.indexOf("}, [latticeOpen]);", protectionStart);
  const protectionLifecycle = resumeProjectsSource.slice(protectionStart, protectionEnd);
  assert.match(protectionLifecycle, /return \(\) => \{[\s\S]*?output\?\.setAttribute\("data-shielded", "true"\)/u);
  assert.match(protectionLifecycle, /window\.addEventListener\("pageshow", reveal\)/u);
  assert.match(protectionLifecycle, /document\.addEventListener\("focusin", reveal\)/u);
  assert.match(resumeProjectsSource, />\s*\{latticePhase === "checking" \? "Checking again…" : "Check again"\}\s*</u);
});

test("model preparation completion cannot masquerade as a finished conversion", async () => {
  const localModelSource = await readFile(new URL("../app/resume/lattice/localModel.js", import.meta.url), "utf8");
  const rpcSource = await readFile(new URL("../app/resume/lattice/modelRpc.js", import.meta.url), "utf8");
  const workerSource = await readFile(new URL("../app/resume/lattice/latticeWebllm.worker.ts", import.meta.url), "utf8");
  assert.match(localModelSource, /initializing \? "initializing-model" : "loading-model"/u);
  assert.match(localModelSource, /progress: initializing \? null : progress/u);
  assert.match(localModelSource, /phase: "model-inference"/u);
  assert.match(localModelSource, /phase: "token-counting"/u);
  assert.match(
    localModelSource,
    /await assertContextEnvelope\(role, firstMessages, maxTokens, signal, onProgress\);\s*modelInferenceProgress\(role, onProgress\);\s*let response = await generateCompletion/u,
    "inference is announced only after local token counting finishes",
  );
  assert.match(localModelSource, /MODEL_RPC_INACTIVITY_TIMEOUTS[\s\S]*?prepare: 120_000[\s\S]*?complete: 720_000/u);
  assert.match(localModelSource, /MODEL_RPC_COMPLETED_PHASE_PROGRESS = 0\.999/u);
  assert.match(localModelSource, /startsNextProgressPhase[\s\S]*?pending\.lastProgress >= MODEL_RPC_COMPLETED_PHASE_PROGRESS/u);
  assert.match(localModelSource, /pending\.completedProgressPhase = true/u);
  assert.match(localModelSource, /if \(advance\.meaningful\) resetPendingInactivity\(parsed\.id, pending\)/u);
  assert.match(localModelSource, /if \(parsed\.kind === "started"\)[\s\S]*?armPendingExecution/u);
  assert.match(workerSource, /latticeModelRpcStarted\(id, operation\)/u);
  assert.match(resumeProjectsSource, /"initializing-model": "Finishing setup on this device"/u);
  assert.match(resumeProjectsSource, /"token-counting": "Checking local context"/u);
  assert.match(resumeProjectsSource, /"model-inference": "Processing on this device"/u);
  assert.match(resumeProjectsSource, /latticePhase === "converting"[\s\S]*?"Converting…"/u);
  assert.match(rpcSource, /"probe", "cached", "prepare"/u);
  assert.match(workerSource, /async function probeWorkerCapability/u);
  assert.match(localModelSource, /requestModelWorker\("probe", \{\}\)/u);
});

test("the custom clarification control keeps its visible label in its accessible name", () => {
  const start = resumeProjectsSource.indexOf("<label className=\"lattice-clarification-input-label\"");
  const end = resumeProjectsSource.indexOf("spellCheck={false}", start);
  assert.ok(start >= 0 && end > start, "custom clarification control is present");
  const controlSource = resumeProjectsSource.slice(start, end);

  assert.match(controlSource, />Something else<\/label>/u);
  assert.doesNotMatch(controlSource, /aria-label=/u);
});

test("source and clarification length failures are explicit instead of native truncation", () => {
  assert.doesNotMatch(resumeProjectsSource, /\bmaxLength=/u);
  assert.match(
    resumeProjectsSource,
    /if \(value\.length > LATTICE_INPUT_SAFETY_LIMIT\) \{[\s\S]*?setLatticeInputInvalid\(true\);[\s\S]*?return;[\s\S]*?\}\s*setLatticeInput\(value\);/u,
  );
  assert.match(
    resumeProjectsSource,
    /if \(value\.length > LATTICE_CLARIFICATION_SAFETY_LIMIT\) \{[\s\S]*?setClarificationErrors[\s\S]*?return;[\s\S]*?\}\s*setClarificationAnswers/u,
  );
});

test("forced-colors mode restores a visible clarification field and focus outline", () => {
  const start = globalsCss.indexOf("@media (forced-colors: active)");
  const end = globalsCss.indexOf("@media print", start);
  assert.ok(start >= 0 && end > start, "forced-colors rules are present");
  const forcedColors = globalsCss.slice(start, end);

  assert.match(forcedColors, /\.form-control\.lattice-clarification-input,[\s\S]*?border: 1px solid ButtonText !important;/u);
  assert.match(forcedColors, /\.form-control\.lattice-clarification-input:focus-visible[\s\S]*?outline: 2px solid Highlight !important;/u);
});

test("the visual quota countdown is silent while the live status changes only at quota and expiry", () => {
  assert.match(
    resumeProjectsSource,
    /<p className="lattice-retry-eta" aria-hidden="true">[\s\S]*?latticeRetryEta\(latticeRetryAt, latticeRetryClock, undefined, latticeRetryMode\)/u,
  );
  assert.match(
    resumeProjectsSource,
    /<p className="lattice-retry-announcement" role="status" aria-live="polite">/u,
  );
  assert.doesNotMatch(resumeProjectsSource, /aria-atomic/u);

  const effectStart = resumeProjectsSource.indexOf("if (latticeRetryAt === null) return;");
  const effectEnd = resumeProjectsSource.indexOf("}, [latticeRetryAt, latticeRetryMode]);", effectStart);
  assert.ok(effectStart >= 0 && effectEnd > effectStart, "retry timer effect is present");
  const timerEffect = resumeProjectsSource.slice(effectStart, effectEnd);
  assert.equal(
    timerEffect.match(/setLatticeRetryAnnouncement\(/gu)?.length ?? 0,
    1,
    "the one-second timer announces only expiry",
  );
  assert.match(timerEffect, /if \(now >= latticeRetryAt\)[\s\S]*?latticeRetryMode === "automatic" \? "The run is retrying now\." : "You can try again now\."/u);
  assert.match(resumeProjectsSource, /setLatticeRetryAnnouncement\(latticeRetryEta\(retryAt, now\)\)/u);
  assert.match(resumeProjectsSource, /latticeRetryEta\(retryAt, now, undefined, "automatic"\)/u);
  assert.match(
    resumeProjectsSource,
    /if \(currentLease\.expiresAt <= Date\.now\(\)\) \{[\s\S]*?expireCurrentLatticeLease\(lease\.token, "expired"\);[\s\S]*?return;/u,
  );
  assert.match(
    resumeProjectsSource,
    /if \(retryAt \+ LATTICE_RENEWAL_RETRY_MARGIN_MS >= currentLease\.expiresAt\) \{[\s\S]*?expireCurrentLatticeLease\(lease\.token, "renewal"\);[\s\S]*?setLatticeRetryMode\("manual"\);[\s\S]*?latticeRetryEta\(retryAt, now\)/u,
  );

  const statusStart = globalsCss.indexOf(".lattice-retry-announcement,");
  const statusEnd = globalsCss.indexOf("}", statusStart);
  const statusCss = globalsCss.slice(statusStart, statusEnd);
  assert.match(statusCss, /clip-path: inset\(50%\)/u);
  assert.doesNotMatch(statusCss, /display:\s*none|visibility:\s*hidden/u);
});

test("ending an active run clears any automatic renewal ETA", () => {
  const inputStart = resumeProjectsSource.indexOf("const updateLatticeInput =");
  const inputEnd = resumeProjectsSource.indexOf("const executeLattice =", inputStart);
  const inputSource = resumeProjectsSource.slice(inputStart, inputEnd);
  assert.match(
    inputSource,
    /const endedActiveLease = latticeLeaseRef\.current !== null;[\s\S]*?releaseCurrentLatticeLease\(\);[\s\S]*?if \(endedActiveLease\)[\s\S]*?setLatticeRetryAt\(null\);[\s\S]*?setLatticeRetryMode\("manual"\);/u,
  );

  const completionStart = resumeProjectsSource.indexOf('if (result.status !== "needs-clarification")');
  const completionEnd = resumeProjectsSource.indexOf("setLatticePhase(\"ready\")", completionStart);
  const completionSource = resumeProjectsSource.slice(completionStart, completionEnd);
  assert.match(completionSource, /releaseCurrentLatticeLease\(\);/u);
  assert.match(completionSource, /setLatticeRetryAt\(null\);/u);
  assert.match(completionSource, /setLatticeRetryMode\("manual"\);/u);
  assert.match(completionSource, /setLatticeRetryAnnouncement\(""\);/u);
});

test("engine diagnostics cannot pass through as interface copy", () => {
  const failureStart = resumeProjectsSource.indexOf("function latticeFailureMessage");
  const failureEnd = resumeProjectsSource.indexOf("function isLatticeQuotaLimit", failureStart);
  const failureSource = resumeProjectsSource.slice(failureStart, failureEnd);
  assert.ok(failureStart >= 0 && failureEnd > failureStart, "fixed failure-copy boundary is present");
  assert.doesNotMatch(failureSource, /return error\.message|return message \|\|/u);
  assert.match(resumeProjectsSource, /setLatticeInputInvalid\(isLatticeInputFailure\(error\)\)/u);
  assert.doesNotMatch(resumeProjectsSource, /setLatticeInputInvalid\(error instanceof RangeError\)/u);

  const progressStart = resumeProjectsSource.indexOf("function latticeProgressText");
  const progressEnd = resumeProjectsSource.indexOf("function latticeFindingMessage", progressStart);
  const progressSource = resumeProjectsSource.slice(progressStart, progressEnd);
  assert.ok(progressStart >= 0 && progressEnd > progressStart, "fixed progress-copy boundary is present");
  assert.doesNotMatch(progressSource, /report\.text/u);

  assert.match(resumeProjectsSource, /findings\.map\(latticeFindingMessage\)/u);
  assert.doesNotMatch(resumeProjectsSource, /\{finding\.message\}/u);
});

test("a completed result has one concise live announcement", () => {
  assert.match(
    resumeProjectsSource,
    /<p className="lattice-result-announcement" role="status" aria-live="polite">[\s\S]*?latticeResultAnnouncement\(latticeResult\)/u,
  );
  assert.doesNotMatch(resumeProjectsSource, /className="lattice-output-register" role="status"/u);
  assert.match(globalsCss, /\.lattice-retry-announcement,\s*\.lattice-result-announcement \{[\s\S]*?clip-path: inset\(50%\)/u);
});

test("Turnstile uses a compact widget below its normal width and remains contained", () => {
  assert.equal(latticeAttestationSize({ clientWidth: 299 }), "compact");
  assert.equal(latticeAttestationSize({ clientWidth: 300 }), "flexible");
  assert.equal(latticeAttestationSize({ getBoundingClientRect: () => ({ width: 240 }) }), "compact");
  assert.equal(latticeAttestationSize({ getBoundingClientRect: () => ({ width: 480 }) }), "flexible");
  assert.match(attestationSource, /const size = latticeAttestationSize\(container\)/u);
  assert.match(attestationSource, /frame\.title = "Text to Lattice acquisition check"/u);
  assert.match(attestationSource, /frame\.setAttribute\("aria-label", "Text to Lattice acquisition check"\)/u);
  assert.doesNotMatch(attestationSource, /Human verification|Security verification/iu);
  assert.match(attestationSource, /frame\.tabIndex = -1/u);
  assert.match(attestationSource, /message\.type === "interactive"[\s\S]*?frame\.tabIndex = 0[\s\S]*?frame\.focus/u);
  assert.match(globalsCss, /\.lattice-attestation \{[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: auto;[\s\S]*?width: 100%;[\s\S]*?\}/u);
  assert.match(globalsCss, /\.lattice-attestation iframe \{[\s\S]*?max-width: 100%;/u);
  assert.match(globalsCss, /\.lattice-attestation-frame \{[\s\S]*?border: 0;[\s\S]*?width: 100%;/u);
});
