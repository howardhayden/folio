import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  boundedLatticeLeaseResponseBody,
} from "../app/resume/lattice/usageLease.js";
import {
  LATTICE_MODEL_ROLES,
  LATTICE_WASM_BASE,
  LATTICE_WASM_REVISION,
} from "../app/resume/lattice/modelContract.js";
import { isLatticeRetryPending, latticeRetryEta } from "../app/resume/lattice/retryEta.js";
import { rejectUnsafeRequest } from "../workers/text-to-lattice-lease/requestSafety.js";

const APPROVED_MODEL_PINS = Object.freeze({
  generator: Object.freeze({
    repository: "https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC",
    revision: "a5c9fab855e3ccbdfed2e7e69683d75f30332161",
  }),
  verifier: Object.freeze({
    repository: "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC",
    revision: "1e80abf71e3d17cd564e2d2b63caa15cb226018e",
  }),
});

test("each Hugging Face role stays on its independently approved immutable revision", () => {
  assert.equal(LATTICE_WASM_REVISION, "025bcaf3780fa8254f5e5efd3bfea0a5397248f4");
  assert.equal(
    LATTICE_WASM_BASE,
    `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/${LATTICE_WASM_REVISION}/web-llm-models/v0_2_80`,
  );

  for (const [roleName, approved] of Object.entries(APPROVED_MODEL_PINS)) {
    const role = LATTICE_MODEL_ROLES[roleName];
    assert.equal(role.role, roleName);
    assert.equal(role.repository, approved.repository);
    assert.equal(role.revision, approved.revision);
    assert.equal(role.model, `${approved.repository}/resolve/${approved.revision}/`);
    assert.equal(role.revisionUrl, `${approved.repository}/tree/${approved.revision}`);
    assert.equal(new URL(role.model).hostname, "huggingface.co");
    assert.ok(role.modelLib.startsWith(`${LATTICE_WASM_BASE}/`));
    assert.doesNotMatch(role.model, /\/resolve\/(?:main|master)\//u);
  }

  assert.equal(
    new Set(Object.values(LATTICE_MODEL_ROLES).map(({ revision }) => revision)).size,
    Object.keys(APPROVED_MODEL_PINS).length,
    "generator and verifier revisions remain independent",
  );
});

test("the bodyless lease boundary accepts exact safe request-header limits", async () => {
  const headers = new Headers({
    Origin: "https://hah.dev",
    "Content-Length": "0",
    Cookie: "x".repeat(4_096),
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
  });
  const request = {
    url: "https://hah.dev/api/text-to-lattice/lease",
    method: "POST",
    headers,
    body: null,
  };

  assert.equal(await rejectUnsafeRequest(request, "https://hah.dev"), null);
  headers.set("Cookie", "x".repeat(4_097));
  assert.equal(await rejectUnsafeRequest(request, "https://hah.dev"), "cookie");
});

test("the lease response parser accepts valid JSON at exactly its byte ceiling", async () => {
  const encoder = new TextEncoder();
  const emptyEnvelope = JSON.stringify({ padding: "" });
  const paddingLength = 16_384 - encoder.encode(emptyEnvelope).byteLength;
  const body = JSON.stringify({ padding: "x".repeat(paddingLength) });
  assert.equal(encoder.encode(body).byteLength, 16_384);

  const parsed = await boundedLatticeLeaseResponseBody(new Response(body, {
    headers: {
      "Content-Length": "16384",
      "Content-Type": "Application/JSON; Charset=UTF-8",
    },
  }));
  assert.equal(parsed?.padding.length, paddingLength);
});

test("quota ETA rounds upward at second, minute, and hour boundaries", () => {
  const now = Date.UTC(2026, 8, 8, 12, 0, 0);
  assert.equal(isLatticeRetryPending(now + 1, now), true);
  assert.match(latticeRetryEta(now + 1, now, "en-US"), /Try again in 1 second\b/u);
  assert.match(latticeRetryEta(now + 60_001, now, "en-US"), /Try again in 2 minutes\b/u);
  assert.match(latticeRetryEta(now + 3_600_000, now, "en-US"), /Try again in 1 hour\b/u);
  assert.match(latticeRetryEta(now + 3_660_001, now, "en-US"), /Try again in 1 hour 2 minutes\b/u);
});

test("the Lattice project SVG alone intercepts unmodified primary activations", async () => {
  const source = await readFile(new URL("../app/resume/ResumeProjects.tsx", import.meta.url), "utf8");
  const handlerStart = source.indexOf("const launchLattice = useCallback");
  const handlerEnd = source.indexOf("}, [openLattice]);", handlerStart);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, "the shared Lattice launch handler is present");

  const handler = source.slice(handlerStart, handlerEnd);
  const preventAt = handler.indexOf("event.preventDefault()");
  const openAt = handler.indexOf("openLattice(event.currentTarget)");

  for (const guard of [
    "event.defaultPrevented",
    "event.button !== 0",
    "event.metaKey",
    "event.ctrlKey",
    "event.shiftKey",
    "event.altKey",
  ]) {
    const guardAt = handler.indexOf(guard);
    assert.ok(guardAt >= 0 && guardAt < preventAt, `${guard} is checked before interception`);
  }
  assert.ok(
    preventAt >= 0 && openAt > preventAt,
    "the modal opens only after native navigation is intentionally intercepted",
  );
  assert.equal(
    (source.match(/onClick=\{launchLattice\}/gu) ?? []).length,
    1,
    "only the project SVG link launches the modal",
  );
  assert.match(source, /className="tool-icon project-modal-trigger signal-fuzz"[\s\S]*?<ProjectIcon/u);
  assert.match(source, /<a className="signal-fuzz" href=\{project\.canonicalPath\}>\{project\.name\}<\/a>/u);
  assert.doesNotMatch(source, /project-title-button|lattice-project-launch/u);
});

test("resume detail links preserve native modified and nonprimary navigation", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/resume/ResumeExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const helperStart = source.indexOf("function shouldInterceptResumeModalLink");
  const helperEnd = source.indexOf("\n}\n", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, "the shared link guard is present");

  const helper = source.slice(helperStart, helperEnd);
  for (const condition of [
    "!event.defaultPrevented",
    "event.button === 0",
    "!event.metaKey",
    "!event.ctrlKey",
    "!event.shiftKey",
    "!event.altKey",
  ]) {
    assert.match(helper, new RegExp(condition.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
  }

  assert.equal(
    source.match(/if \(!shouldInterceptResumeModalLink\(event\)\) return;/gu)?.length,
    2,
    "timeline and progress detail links both use the native-navigation guard",
  );
  assert.match(source, /<article className=\{className\}[\s\S]*?<TimelineEntry[\s\S]*?detailLink=\{detailLink\}/u);
  assert.match(source, /className="timeline-icon-trigger signal-fuzz"[\s\S]*?aria-haspopup="dialog"/u);
  assert.doesNotMatch(source, /<a className=\{`\$\{className\} timeline-button`\}/u);
  assert.match(css, /\.progress-bar-fill \{[\s\S]*?text-align: right;/u);
  assert.match(css, /\.progress-value \{[\s\S]*?text-align: right;/u);
  assert.match(css, /\.progress-label \{[\s\S]*?text-align: right;/u);
  assert.match(source, /<a[\s\S]*?className=\{`\$\{className\} button-reset`\}[\s\S]*?onClick=/u);
  assert.match(source, /<div className=\{className\} style=\{\{ width, cursor: "auto" \}\}>/u);
  assert.doesNotMatch(css, /\.progress-bar-fill:hover\s*\{/u, "static University bars have no hover affordance");
  assert.match(css, /\.progress-bar-fill\.button-reset:focus-visible \{[\s\S]*?outline: 2px solid currentColor;/u);
  assert.match(css, /@media \(hover: hover\) \{[\s\S]*?\.progress-bar-fill\.button-reset:hover \{[\s\S]*?background-color: whitesmoke !important;/u);
  assert.match(css, /\.background-gradient-green-blue::before \{[\s\S]*?background-image: var\(--signal-grain-1\);[\s\S]*?opacity: 0\.12;[\s\S]*?pointer-events: none;/u);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\.background-gradient-green-blue::before \{[\s\S]*?signal-film-grain-frame \.48s steps\(1, end\) infinite,[\s\S]*?signal-film-weave 7\.6s/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.progress-bar-fill\.button-reset \{[\s\S]*?transition: none;[\s\S]*?\.background-gradient-green-blue::before \{[\s\S]*?animation: none;/u);
  assert.match(css, /@media \(forced-colors: active\) \{[\s\S]*?\.background-gradient-green-blue \{[\s\S]*?background: CanvasText !important;[\s\S]*?color: Canvas !important;[\s\S]*?\.background-gradient-green-blue::before \{[\s\S]*?animation: none !important;[\s\S]*?background-image: none !important;[\s\S]*?\.progress-bar-fill\.button-reset:focus-visible \{[\s\S]*?outline-color: Highlight !important;/u);
  assert.match(css, /@media print \{[\s\S]*?\.background-gradient-green-blue::before \{[\s\S]*?animation: none !important;[\s\S]*?background-image: none !important;/u);
  assert.match(css, /\.project-modal-trigger,\s*\.timeline-icon-trigger \{[\s\S]*?min-height: 24px;[\s\S]*?min-width: 24px;/u);
});

test("semantic card headings retain an h5-scale presentation", async () => {
  const [css, skillStacks, tools, shelf] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/resume/SkillStacks.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tools/ToolsView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/shelf/ShelfExplorer.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(css, /#papershelf \.card-title \{[\s\S]*?font-size: 1\.25rem;[\s\S]*?margin-top: 1\.5vh;/u);
  assert.match(css, /\.skill-stack-card \.card-title \{[\s\S]*?font-size: 1\.25rem;/u);
  assert.match(skillStacks, /<h3 className="card-title tools-card-title/u);
  assert.match(tools, /<h3 className="card-title tools-card-title/u);
  assert.match(shelf, /<h2 className="card-title"/u);
});

test("output transfer and capture shields clear payloads and clean up every listener", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/resume/ResumeProjects.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  const handlerStart = source.indexOf("const blockLatticeOutputTransfer");
  const handlerEnd = source.indexOf("\n\n  return (", handlerStart);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, "output transfer handler is present");
  const handler = source.slice(handlerStart, handlerEnd);
  const clarificationAt = handler.indexOf("isLatticeClarificationTarget(event.target)");
  const preventAt = handler.indexOf("event.preventDefault()");
  const clipboardAt = handler.indexOf("nativeEvent.clipboardData?.clearData()");
  const dragAt = handler.indexOf("nativeEvent.dataTransfer?.clearData()");
  assert.ok(
    clarificationAt >= 0 && preventAt > clarificationAt && clipboardAt > preventAt && dragAt > clipboardAt,
    "non-clarification transfers are canceled and their payload stores are cleared",
  );
  for (const eventName of ["onCopy", "onCut", "onDragStart", "onContextMenu"]) {
    assert.match(source, new RegExp(`${eventName}=\\{blockLatticeOutputTransfer\\}`, "u"));
  }

  for (const registration of [
    ["window", "blur", "shield"],
    ["window", "focus", "reveal"],
    ["window", "beforeprint", "handleBeforePrint"],
    ["window", "afterprint", "handleAfterPrint"],
    ["document", "visibilitychange", "handleVisibility"],
  ]) {
    const [target, eventName, handlerName] = registration;
    assert.match(source, new RegExp(`${target}\\.addEventListener\\("${eventName}", ${handlerName}\\)`, "u"));
    assert.match(source, new RegExp(`${target}\\.removeEventListener\\("${eventName}", ${handlerName}\\)`, "u"));
  }
  for (const eventName of ["keydown", "keyup"]) {
    assert.match(source, new RegExp(`document\\.addEventListener\\("${eventName}", handlePrintScreen, true\\)`, "u"));
    assert.match(source, new RegExp(`document\\.removeEventListener\\("${eventName}", handlePrintScreen, true\\)`, "u"));
  }
  assert.match(source, /event\.key !== "PrintScreen"/u);
  assert.match(source, /const handleBeforePrint = \(\) => \{\s*printing = true;\s*shield\(\);\s*\};/u);
  assert.match(source, /const handleAfterPrint = \(\) => \{\s*printing = false;\s*reveal\(\);\s*\};/u);
  assert.match(source, /output\?\.setAttribute\("data-shielded", "true"\)/u);
  assert.match(source, /output\?\.removeAttribute\("data-shielded"\)/u);
  assert.match(
    css,
    /\.lattice-output\[data-shielded="true"\] > :not\(\.lattice-output-privacy-curtain\) \{[\s\S]*?visibility: hidden;/u,
  );
  assert.match(
    css,
    /\.lattice-output\[data-shielded="true"\] \.lattice-output-privacy-curtain \{[\s\S]*?display: flex;[\s\S]*?position: absolute;/u,
  );
});
