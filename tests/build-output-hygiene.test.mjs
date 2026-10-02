import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import { stripBootstrapSourceMapReference } from "../postcss.config.mjs";

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.[cm]?[jt]sx?$/u.test(entry.name) ? [path] : [];
  }));
  return files.flat();
}

test("production builds clear only the resolved bundle directory before emitting assets", async () => {
  const [packageSource, cleaner, exporter] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/clean-build-output.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-pages.mjs", import.meta.url), "utf8"),
  ]);
  const packageJson = JSON.parse(packageSource);

  assert.match(packageJson.scripts.build, /^node scripts\/clean-build-output\.mjs && /u);
  assert.match(cleaner, /const output = resolve\(root, "dist"\)/u);
  assert.match(cleaner, /dirname\(output\) !== root \|\| output === root/u);
  assert.match(cleaner, /await rm\(output, \{ recursive: true, force: true \}\)/u);
  assert.match(exporter, /const clientAssets = resolve\(root, "dist\/client"\)/u);
  assert.match(exporter, /const output = resolve\(root, "site"\)/u);
  assert.match(exporter, /await rm\(output, \{ recursive: true, force: true \}\)/u);
  assert.match(exporter, /await cp\(clientAssets, output, \{ recursive: true \}\)/u);
});

test("the HTML-only Pages artifact uses native anchors for application navigation", async () => {
  const files = await sourceFiles(new URL("../app/", import.meta.url));
  const sources = await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")]));

  for (const [file, source] of sources) {
    assert.doesNotMatch(source, /["']next\/link["']/u, file.pathname);
  }

  const chrome = await readFile(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  const [resumeView, projects, heldProjects, resumeSearch] = await Promise.all([
    readFile(new URL("../app/resume/ResumeView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/resume/ResumeProjects.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/resume/ResumeProjectsHeld.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/resume/ResumeSearch.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(chrome, /<a className="navbar-brand" href="\/"/u);
  assert.match(chrome, /<a[\s\S]*?className="nav-link"[\s\S]*?href=\{route\.href\}/u);
  assert.match(resumeView, /from "\.\/ResumeProjectsHeld"/u);
  assert.doesNotMatch(resumeView, /from "\.\/ResumeProjects"/u);
  assert.match(resumeSearch, /from "\.\/ResumeProjectsHeld"/u);
  assert.doesNotMatch(resumeSearch, /from "\.\/ResumeProjects"/u);
  assert.match(
    projects,
    /"interaction" in project && project\.interaction === "lattice-demo"[\s\S]*?className="tool-icon project-modal-trigger signal-fuzz"[\s\S]*?data-lattice-launch="text-to-lattice"[\s\S]*?href="\/projects\/lattice\/text-to-lattice\/"[\s\S]*?aria-label="Use Text to Lattice"/u,
  );
  assert.match(
    heldProjects,
    /project\.id === "lattice"[\s\S]*?className="tool-icon project-modal-trigger signal-fuzz"[\s\S]*?href="\/projects\/lattice\/text-to-lattice\/"[\s\S]*?aria-label="Read Text to Lattice release status"/u,
  );
  assert.match(heldProjects, /const cardHref = linksToAuthoritativeSource \? project\.url : project\.canonicalPath/u);
  assert.match(heldProjects, /className="signal-fuzz"[\s\S]*?href=\{cardHref\}/u);
  assert.doesNotMatch(heldProjects, /aria-haspopup=|role="dialog"|data-lattice-launch=/u);
  assert.doesNotMatch(resumeSearch, /onLatticeLaunch|data-lattice-launch|requestRemoteLattice/u);
});

test("the held Resume client bundle excludes the interactive Lattice executable path", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../dist/client/.vite/manifest.json", import.meta.url),
    "utf8",
  ));
  const portfolioEntry = manifest["app/components/PortfolioShell.tsx"];
  assert.ok(portfolioEntry, "the production client manifest includes the portfolio entry");

  const reachable = new Set();
  const visit = (key) => {
    if (reachable.has(key)) return;
    const record = manifest[key];
    assert.ok(record, `${key} resolves in the production client manifest`);
    reachable.add(key);
    for (const dependency of [...(record.imports ?? []), ...(record.dynamicImports ?? [])]) {
      visit(dependency);
    }
  };
  visit("app/components/PortfolioShell.tsx");

  const names = [...reachable].map((key) => manifest[key].name);
  assert.ok(names.includes("ResumeProjectsHeld"));
  assert.ok(names.includes("ResumeSearch"));
  assert.equal(names.includes("ResumeProjects"), false);

  const sources = await Promise.all([...reachable].map((key) => (
    readFile(new URL(`../dist/client/${manifest[key].file}`, import.meta.url), "utf8")
  )));
  const client = sources.join("\n");
  for (const marker of [
    "requestRemoteLattice",
    "LatticeRemoteError",
    "capabilityFetch(",
    "data-lattice-launch",
    "lattice-demo-dialog",
  ]) assert.equal(client.includes(marker), false, `${marker} is absent from the held client graph`);
});

test("Pages CI verifies the remote privacy boundary before the held build", async () => {
  const [workflow, tokenizerFetcher] = await Promise.all([
    readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/fetch-lattice-tokenizers.mjs", import.meta.url), "utf8"),
  ]);
  const boundarySteps = [
    "tests/lattice-network-capability.test.mjs",
    "tests/lattice-network-governance.test.mjs",
    "tests/lattice-api-worker.test.mjs",
  ].map((marker) => workflow.indexOf(marker));
  const testStep = workflow.indexOf("npm test");
  assert.ok(boundarySteps.every((step) => step >= 0 && step < testStep));
  const tokenizerFetchSteps = [...workflow.matchAll(
    /node scripts\/fetch-lattice-tokenizers\.mjs --verifier-only/gu,
  )].map(({ index }) => index);
  const mandatoryCapacityFlags = [...workflow.matchAll(
    /LATTICE_REQUIRE_ACTIVE_VERIFIER_CAPACITY: "1"/gu,
  )].map(({ index }) => index);
  const measuredCapacitySteps = [...workflow.matchAll(
    /node --test tests\/lattice-protocol-capacity\.test\.mjs/gu,
  )].map(({ index }) => index);
  const fullTestSteps = [...workflow.matchAll(/- run: npm test/gu)].map(({ index }) => index);
  assert.equal(tokenizerFetchSteps.length, 2);
  assert.equal(mandatoryCapacityFlags.length, 2);
  assert.equal(measuredCapacitySteps.length, 2);
  assert.equal(fullTestSteps.length, 2);
  for (let index = 0; index < fullTestSteps.length; index += 1) {
    assert.ok(mandatoryCapacityFlags[index] < tokenizerFetchSteps[index]);
    assert.ok(tokenizerFetchSteps[index] < measuredCapacitySteps[index]);
    assert.ok(measuredCapacitySteps[index] < fullTestSteps[index]);
  }
  assert.doesNotMatch(workflow, /fetch-lattice-wasm/u);
  assert.match(tokenizerFetcher, /TOKENIZER_FETCH_TIMEOUT_MS = 30_000/u);
  assert.match(tokenizerFetcher, /TOKENIZER_FETCH_BYTE_LIMIT = 12_000_000/u);
  assert.match(tokenizerFetcher, /attempt <= 3/u);
  assert.match(tokenizerFetcher, /credentials: "omit"/u);
  assert.match(tokenizerFetcher, /referrerPolicy: "no-referrer"/u);
  assert.match(tokenizerFetcher, /expectedBytes: 9_085_657/u);
  assert.match(tokenizerFetcher, /"\/tmp\/llama32-lattice-tokenizer\.json"/u);
  assert.doesNotMatch(tokenizerFetcher, /(?:public|site)\/.*tokenizer/iu);
});

test("the public model contract retains bounded stages without publishing private inference settings", async () => {
  const [adapter, { textToLatticeContract }] = await Promise.all([
    readFile(new URL("../workers/text-to-lattice-api/huggingFaceAdapter.js", import.meta.url), "utf8"),
    import("../app/content/textToLatticeContent.js"),
  ]);

  assert.deepEqual(textToLatticeContract.implementation.generator.inference.stages, {
    analysis: { maximumOutputTokens: 2_048 },
    candidate: { maximumOutputTokens: 800 },
    repair: { maximumOutputTokens: 800 },
  });
  assert.match(adapter, /const ANALYSIS_MAX_OUTPUT_TOKENS = 2_048;/u);
  assert.match(adapter, /const ANALYSIS_MIN_OUTPUT_TOKENS = 768;/u);
  assert.match(adapter, /const ANALYSIS_OUTPUT_TOKEN_STEP = 256;/u);
  assert.match(adapter, /const CANDIDATE_MAX_OUTPUT_TOKENS = 800;/u);
  assert.match(adapter, /const VERIFICATION_MAX_OUTPUT_TOKENS = 2_048;/u);
  assert.match(adapter, /const CERTIFICATION_MAX_OUTPUT_TOKENS = 520;/u);
  assert.match(adapter, /const REPAIR_MAX_OUTPUT_TOKENS = 800;/u);
  assert.deepEqual(textToLatticeContract.implementation.verifier.inference.stages, {
    verification: {
      maximumOutputTokens: 2_048,
    },
    certification: {
      maximumOutputTokens: 520,
    },
  });
  const publicContract = JSON.stringify(textToLatticeContract);
  for (const privateMarker of [
    "lattice_verification_wire_v1",
    "lattice_verification_wire_v2",
    "lattice_certification_wire_v1",
    "lattice_certification_wire_v2",
    "forced_named_tool",
    "responseTransport",
    "toolName",
    "stoppedContentCompatibility",
    "only_when_tool_calls_and_function_call_are_absent",
  ]) assert.equal(publicContract.includes(privateMarker), false, `${privateMarker} is not public contract data`);
  for (const privateProperty of [
    "seed",
    "thinking",
    "temperature",
    "topP",
    "responseFormat",
    "strict",
  ]) {
    assert.doesNotMatch(
      publicContract,
      new RegExp(`"${privateProperty}":`, "u"),
      `${privateProperty} is not public contract data`,
    );
  }
  for (const privateDetail of [
    /71903/u,
    /request-fitted analysis output limits/iu,
    /768 through 2048/u,
    /256-token steps/iu,
    /non-thinking/iu,
  ]) assert.doesNotMatch(publicContract, privateDetail);
  assert.match(
    textToLatticeContract.securityAndPrivacy.huggingFace.protections.join(" "),
    /deterministically validates every returned object[\s\S]*invalid, incomplete, or unknown data fails closed/iu,
  );
  for (const [stage, maximumOutputTokens, temperature, topP] of [
    ["analysis", "ANALYSIS_MAX_OUTPUT_TOKENS", "0.7", "0.8"],
    ["candidate", "CANDIDATE_MAX_OUTPUT_TOKENS", "0.45", "0.9"],
    ["repair", "REPAIR_MAX_OUTPUT_TOKENS", "0.45", "0.9"],
    ["verification", "VERIFICATION_MAX_OUTPUT_TOKENS", "0", "1"],
    ["certification", "CERTIFICATION_MAX_OUTPUT_TOKENS", "0", "1"],
  ]) {
    assert.match(
      adapter,
      new RegExp(`${stage}:[\\s\\S]*?maxTokens: ${maximumOutputTokens},[\\s\\S]*?temperature: ${temperature},[\\s\\S]*?topP: ${topP},`, "u"),
    );
  }
  const analysisStageSource = adapter.slice(
    adapter.indexOf("analysis: Object.freeze({"),
    adapter.indexOf("candidate: Object.freeze({"),
  );
  assert.match(analysisStageSource, /responseFormat: "json_schema"/u);
  assert.doesNotMatch(analysisStageSource, /toolChoice|toolName/u);
  assert.doesNotMatch(analysisStageSource, /topK|minP/u);
  assert.doesNotMatch(analysisStageSource, /presencePenalty/u);
  const verificationStageSource = adapter.slice(
    adapter.indexOf("verification: Object.freeze({"),
    adapter.indexOf("certification: Object.freeze({"),
  );
  const certificationStageSource = adapter.slice(
    adapter.indexOf("certification: Object.freeze({"),
    adapter.indexOf("repair: Object.freeze({"),
  );
  assert.match(verificationStageSource, /responseFormat: "json_object"/u);
  assert.match(verificationStageSource, /requireMinimalVerificationContent: true/u);
  assert.match(verificationStageSource, /allowEmptyStoppedToolCalls: true/u);
  assert.match(verificationStageSource, /allowNullStoppedVerificationMetadata: true/u);
  assert.doesNotMatch(verificationStageSource, /toolName|toolChoice|allowStoppedToolContent/u);
  assert.match(certificationStageSource, /toolName: CERTIFICATION_TOOL_NAME/u);
  assert.match(certificationStageSource, /toolChoice: "named"/u);
  assert.match(certificationStageSource, /allowStoppedToolContent: true/u);
  assert.doesNotMatch(certificationStageSource, /responseFormat/u);
  assert.match(adapter, /model: LATTICE_REMOTE_MODELS\[role\]/u);
  assert.doesNotMatch(adapter, /CreateMLCEngine|latticeWebllm\.worker/u);
});

test("the documented Bootstrap version matches the exact installed dependency", async () => {
  const [packageSource, lockSource, readme] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);
  const packageJson = JSON.parse(packageSource);
  const packageLock = JSON.parse(lockSource);
  const installedVersion = packageLock.packages["node_modules/bootstrap"].version;

  assert.equal(packageJson.dependencies.bootstrap, installedVersion);
  assert.equal(packageLock.packages[""].dependencies.bootstrap, installedVersion);
  assert.ok(readme.includes(`Bootstrap ${installedVersion} styling`));
});

test("development CSS removes only Bootstrap's stale source-map reference", () => {
  const comments = [
    { text: "# sourceMappingURL=bootstrap.min.css.map", removed: false, remove() { this.removed = true; } },
    { text: "# sourceMappingURL=application.css.map", removed: false, remove() { this.removed = true; } },
    { text: "preserve this comment", removed: false, remove() { this.removed = true; } },
  ];
  const plugin = stripBootstrapSourceMapReference();
  plugin.Once({ walkComments(callback) { comments.forEach(callback); } });
  assert.deepEqual(comments.map(({ removed }) => removed), [true, false, false]);
});
