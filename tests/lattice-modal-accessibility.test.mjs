import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { latticeAttestationSize } from "../app/resume/lattice/attestation.js";

const resumeProjectsSource = await readFile(new URL("../app/resume/ResumeProjects.tsx", import.meta.url), "utf8");
const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const attestationSource = await readFile(new URL("../app/resume/lattice/attestation.js", import.meta.url), "utf8");

test("the modal focus trap includes an interactive attestation iframe", () => {
  assert.match(resumeProjectsSource, /"iframe:not\(\[tabindex='-1'\]\)"/u);
  assert.match(resumeProjectsSource, /"summary"/u);
});

test("focus remains contained when controls disable or the attestation frame is removed", () => {
  assert.match(resumeProjectsSource, /const focusObserver = new MutationObserver\(scheduleFocusContainment\)/u);
  assert.match(resumeProjectsSource, /attributeFilter: \["aria-hidden", "disabled", "hidden", "tabindex"\]/u);
  assert.match(resumeProjectsSource, /childList: true,[\s\S]*?subtree: true/u);
  assert.match(resumeProjectsSource, /latticeCancelButtonRef\.current[\s\S]*?cancel\?\.isConnected[\s\S]*?cancel\.focus/u);
  assert.match(resumeProjectsSource, /focusObserver\.disconnect\(\)/u);
  assert.match(resumeProjectsSource, /latticeCloseRef\.current\(\)/u);
  assert.match(resumeProjectsSource, /\}, \[latticeOpen\]\);/u);
});

test("backdrop dismissal waits for a completed same-target click", () => {
  assert.match(resumeProjectsSource, /onClick=\{\(event\) => \{[\s\S]*?event\.target === event\.currentTarget[\s\S]*?closeLattice\(\)/u);
  assert.doesNotMatch(resumeProjectsSource, /onPointerDown=\{closeLattice\}/u);
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
  assert.match(attestationSource, /frame\.title = "Human verification for Text to Lattice"/u);
  assert.match(attestationSource, /frame\.setAttribute\("aria-label", "Human verification for Text to Lattice"\)/u);
  assert.match(attestationSource, /frame\.tabIndex = -1/u);
  assert.match(attestationSource, /message\.type === "interactive"[\s\S]*?frame\.tabIndex = 0[\s\S]*?frame\.focus/u);
  assert.match(globalsCss, /\.lattice-attestation \{[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: auto;[\s\S]*?width: 100%;[\s\S]*?\}/u);
  assert.match(globalsCss, /\.lattice-attestation iframe \{[\s\S]*?max-width: 100%;/u);
  assert.match(globalsCss, /\.lattice-attestation-frame \{[\s\S]*?border: 0;[\s\S]*?width: 100%;/u);
});
