import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const resumeProjectsSource = await readFile(new URL("../app/resume/ResumeProjects.tsx", import.meta.url), "utf8");
const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const promptSource = await readFile(new URL("../app/resume/lattice/promptContract.js", import.meta.url), "utf8");
const publicTermsSource = await readFile(new URL("../app/resume/lattice/publicTerms.js", import.meta.url), "utf8");
const canonicalPageSource = await readFile(new URL("../app/projects/lattice/text-to-lattice/page.tsx", import.meta.url), "utf8");

test("the interactive release keeps its established project launcher and native-link behavior", () => {
  assert.match(resumeProjectsSource, /data-lattice-launch="text-to-lattice"/u);
  assert.match(
    resumeProjectsSource,
    /className="tool-icon project-modal-trigger signal-fuzz"[\s\S]*?aria-label="Use Text to Lattice"[\s\S]*?aria-haspopup="dialog"[\s\S]*?aria-controls="lattice-demo-dialog"/u,
  );
  assert.match(resumeProjectsSource, /project\.interaction === "lattice-demo" \? launchLattice : undefined/u);
  assert.match(resumeProjectsSource, /url\.hash !== "#text-to-lattice"/u);
  assert.match(resumeProjectsSource, /window\.location\.replace\("\/resume\/#text-to-lattice"\)/u);
  assert.match(resumeProjectsSource, /window\.history\.replaceState[\s\S]*?openLattice\(trigger\)/u);
  assert.match(canonicalPageSource, /href="\/resume\/#text-to-lattice"[^>]*>Use Text to Lattice<\/a>/u);
});

test("the modal discloses the external boundary before the user can submit", () => {
  for (const disclosure of [
    "This text leaves hah.dev",
    "configured external Hugging Face inference service",
    "hah.dev does not retain your sample or result",
    "classified",
    "controlled",
    "privileged",
    "export-controlled",
    "operationally sensitive",
    "otherwise restricted information",
  ]) {
    assert.ok(resumeProjectsSource.includes(disclosure), `missing disclosure: ${disclosure}`);
  }

  assert.match(resumeProjectsSource, /id="lattice-external-privacy"/u);
  assert.match(resumeProjectsSource, /aria-describedby="[^"]*lattice-external-privacy[^"]*"/u);
  assert.match(resumeProjectsSource, /<button className="lattice-run-button" type="submit"[^>]*>[\s\S]*?Process with external service[\s\S]*?<\/button>/u);
  assert.match(resumeProjectsSource, /id="lattice-use-confirmation"[\s\S]*?type="checkbox"[\s\S]*?required/u);
  assert.match(resumeProjectsSource, /authorized to send it to the configured external service/u);
  assert.match(resumeProjectsSource, /if \(!latticeUseConfirmed\)[\s\S]*?return;/u);
  assert.match(resumeProjectsSource, /const updateLatticeInput = \(value: string\) => \{\s*setLatticeUseConfirmed\(false\)/u);
});

test("model identity, limitations, and acceptable-use boundaries remain visible", () => {
  assert.match(resumeProjectsSource, /Model-assisted result: Qwen drafts and Llama 3\.2 checks through the configured external service/u);
  assert.match(resumeProjectsSource, /The service may apply its own processing terms/u);
  assert.match(resumeProjectsSource, /Review every result before relying on it/u);
  assert.match(resumeProjectsSource, />Built with Llama<\/a>/u);
  assert.match(resumeProjectsSource, /from "\.\/lattice\/publicTerms\.js"/u);
  assert.doesNotMatch(resumeProjectsSource, /\.\/lattice\/modelContract\.js/u);
  assert.match(publicTermsSource, /https:\/\/developer\.meta\.com\/ai\/llama3_2\/license\//u);
  assert.match(publicTermsSource, /https:\/\/developer\.meta\.com\/ai\/llama3_2\/use-policy\//u);

  assert.match(promptSource, /Safety is purpose- and consequence-aware/u);
  assert.match(promptSource, /materially further prohibited conduct/u);
  assert.match(promptSource, /lack necessary authority, consent, or license/u);
  assert.match(promptSource, /never keyword-ban/u);
});

test("submission is one explicit cancelable same-origin remote operation", () => {
  const executeStart = resumeProjectsSource.indexOf("const executeLattice = async () => {");
  const executeEnd = resumeProjectsSource.indexOf("const runLattice =", executeStart);
  const executeSource = resumeProjectsSource.slice(executeStart, executeEnd);
  assert.ok(executeStart >= 0 && executeEnd > executeStart);

  assert.match(resumeProjectsSource, /from "\.\/lattice\/remoteRequest\.js"/u);
  assert.equal((resumeProjectsSource.match(/await requestRemoteLattice\(/gu) ?? []).length, 1);
  assert.match(executeSource, /requestedMode: "auto"/u);
  assert.match(executeSource, /signal: controller\.signal/u);
  assert.match(executeSource, /onState:/u);
  for (const phase of ["validating", "submitting", "processing", "success", "error", "canceling"]) {
    assert.ok(resumeProjectsSource.includes(`"${phase}"`), `missing lifecycle phase: ${phase}`);
  }
  assert.match(resumeProjectsSource, /<form className="lattice-form" onSubmit=\{runLattice\}/u);
  assert.match(resumeProjectsSource, /event\.preventDefault\(\);\s*void executeLattice\(\);/u);
  assert.equal((resumeProjectsSource.match(/void executeLattice\(\)/gu) ?? []).length, 1);
  assert.match(resumeProjectsSource, /controller\.abort\(new DOMException\([^)]*"AbortError"\)\)/u);
  assert.match(resumeProjectsSource, />\s*\{latticePhase === "canceling" \? "Canceling…" : "Cancel"\}\s*</u);
  assert.match(resumeProjectsSource, /a failed request is not retried automatically/u);

  for (const retiredBrowserPath of [
    "createLocalLatticeAdapter",
    "acquireLatticeLease",
    "obtainLatticeAttestation",
    "probeLocalLatticeCapability",
    "runTextToLattice",
  ]) {
    assert.equal(resumeProjectsSource.includes(retiredBrowserPath), false, `${retiredBrowserPath} is retired from the browser UI`);
  }
});

test("focus remains contained and favors the active cancellation or returned result", () => {
  for (const selector of [
    '"button:not([disabled])"',
    '"input:not([disabled])"',
    '"summary"',
    '"textarea:not([disabled])"',
    '"[tabindex]:not([tabindex=\'\-1\'])"',
  ]) {
    assert.ok(resumeProjectsSource.includes(selector), `missing focusable selector: ${selector}`);
  }
  assert.match(resumeProjectsSource, /const focusObserver = new MutationObserver\(scheduleFocusContainment\)/u);
  assert.match(resumeProjectsSource, /attributeFilter: \["aria-hidden", "disabled", "hidden", "tabindex"\]/u);
  assert.match(resumeProjectsSource, /latticeCancelButtonRef\.current/u);
  assert.match(resumeProjectsSource, /if \(result && latticeOutputRef\.current\) return latticeOutputRef\.current/u);
  assert.match(resumeProjectsSource, /if \(input && !input\.disabled\) return input/u);
  assert.match(resumeProjectsSource, /event\.key === "Escape"[\s\S]*?latticeCloseRef\.current\(\)/u);
  assert.match(resumeProjectsSource, /trigger\?\.isConnected[\s\S]*?trigger\.focus/u);
  assert.match(resumeProjectsSource, /focusObserver\.disconnect\(\)/u);
});

test("backdrop dismissal and reopening preserve the same active session", () => {
  assert.match(resumeProjectsSource, /onClick=\{\(event\) => \{[\s\S]*?event\.target === event\.currentTarget[\s\S]*?closeLattice\(\)/u);
  assert.doesNotMatch(resumeProjectsSource, /onPointerDown=\{closeLattice\}/u);

  const closeStart = resumeProjectsSource.indexOf("const closeLattice = useCallback");
  const closeEnd = resumeProjectsSource.indexOf("useEffect(() => {\n    latticeCloseRef.current", closeStart);
  const closeSource = resumeProjectsSource.slice(closeStart, closeEnd);
  assert.match(closeSource, /setLatticeOpen\(false\)/u);
  assert.doesNotMatch(closeSource, /abort\(|setLatticeInput|setLatticeResult|setLatticeUseConfirmed/u);
  assert.match(resumeProjectsSource, /taskContinuesWhileClosed \? "Close; current task continues"/u);
});

test("the source field enforces the public boundary without silent truncation", () => {
  const sourceInput = resumeProjectsSource.match(/<textarea[\s\S]*?\/>/u)?.[0] ?? "";
  assert.match(sourceInput, /className="form-control shelf-search-entry lattice-input"/u);
  assert.match(sourceInput, /id="lattice-demo-input"/u);
  assert.match(sourceInput, /rows=\{9\}/u);
  assert.match(sourceInput, /disabled=\{busy\}/u);
  assert.match(sourceInput, /onChange=\{\(event\) => updateLatticeInput\(event\.currentTarget\.value\)\}/u);
  assert.doesNotMatch(sourceInput, /maxLength=/u);
  assert.match(resumeProjectsSource, /if \(value\.length > LATTICE_INPUT_SAFETY_LIMIT\)[\s\S]*?setLatticeInputInvalid\(true\)[\s\S]*?return;/u);
  assert.match(resumeProjectsSource, /\{wordCount\} of \{LATTICE_WORD_LIMIT\} words/u);
  assert.match(resumeProjectsSource, /validateLatticeInput\(latticeInput\)/u);
});

test("returned layered output is protected, announced once, and brought into view", () => {
  assert.match(resumeProjectsSource, /setLatticeResult\(result\)[\s\S]*?setLatticePhase\("success"\)/u);
  assert.match(resumeProjectsSource, /output\.scrollIntoView\(\{ block: "nearest" \}\)/u);
  assert.match(resumeProjectsSource, /output\.focus\(\{ preventScroll: true \}\)/u);
  assert.match(resumeProjectsSource, /latticeResult\.layerLabel/u);
  assert.match(resumeProjectsSource, /<pre[\s\S]*?className="lattice-output-text"[\s\S]*?>\{latticeResult\.text\}<\/pre>/u);
  assert.match(
    resumeProjectsSource,
    /<p className="lattice-result-announcement" role="status" aria-live="polite">[\s\S]*?latticeResultAnnouncement\(latticeResult\)/u,
  );
  assert.doesNotMatch(resumeProjectsSource, /className="lattice-output-register" role="status"/u);
});

test("remote failures use bounded interface copy and never expose raw diagnostics", () => {
  const failureStart = resumeProjectsSource.indexOf("function latticeFailureMessage");
  const failureEnd = resumeProjectsSource.indexOf("function latticeProgressText", failureStart);
  const failureSource = resumeProjectsSource.slice(failureStart, failureEnd);
  assert.ok(failureStart >= 0 && failureEnd > failureStart);
  assert.doesNotMatch(failureSource, /return error\.message|return message \|\|/u);
  for (const code of ["rate_limited", "client_timeout", "upstream_timeout", "network_failure", "invalid_response"]) {
    assert.ok(failureSource.includes(`"${code}"`), `missing fixed copy for ${code}`);
  }
  assert.match(failureSource, /hah\.dev does not retain your sample or result/u);
  assert.match(resumeProjectsSource, /setLatticeInputInvalid\(isLatticeInputFailure\(error\)\)/u);
});

test("the modal retains its established visual and forced-colors treatment", () => {
  assert.match(resumeProjectsSource, /className="modal resume-modal lattice-modal"/u);
  assert.match(globalsCss, /\.modal\.resume-modal\.lattice-modal \{\s*isolation: isolate;\s*\}/u);
  assert.match(resumeProjectsSource, /document\.body\.classList\.add\("resume-modal-open"\)/u);
  assert.match(
    globalsCss,
    /\.form-control\.resume-search-input,\s*\.form-control\.resume-search-input:focus,\s*\.form-control\.lattice-input,\s*\.form-control\.lattice-input:focus \{\s*box-shadow: 0 6px 6px -7px rgb\(0 0 0 \/ 58%\);/u,
  );
  const forcedColorsStart = globalsCss.indexOf("@media (forced-colors: active)");
  const printStart = globalsCss.indexOf("@media print", forcedColorsStart);
  const forcedColors = globalsCss.slice(forcedColorsStart, printStart);
  assert.ok(forcedColorsStart >= 0 && printStart > forcedColorsStart);
  assert.match(forcedColors, /\.form-control\.lattice-input:focus-visible[\s\S]*?outline: 2px solid Highlight !important;/u);
});
