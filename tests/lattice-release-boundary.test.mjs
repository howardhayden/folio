import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { projectBySlug } from "../app/resume/projects.js";
import {
  qualifiedFilesBelow,
  verifyLifecycleGateContract,
  verifyReleaseStatusState,
} from "../scripts/verify-text-to-lattice-release.mjs";

const execute = promisify(execFile);
const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const validator = join(root, "scripts/verify-text-to-lattice-release.mjs");
const registerPath = join(root, "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json");
const expectedGateIds = ["GATE-01", "GATE-02", "GATE-03", "GATE-04A", "GATE-04B", "GATE-04C", "GATE-05", "GATE-06"];

async function withCopiedSiteFixture(mutate, expectedFailure) {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "lattice-held-site-test-"));
  const fixtureSite = join(temporaryDirectory, "site");
  try {
    await cp(join(root, "site"), fixtureSite, { recursive: true });
    await mutate(fixtureSite);
    await assert.rejects(
      execute(process.execPath, [validator, "--source", "--site", `--site-root=${fixtureSite}`], { cwd: root }),
      (error) => expectedFailure.test(`${error.stderr ?? ""}${error.message ?? ""}`),
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function appendToHtml(path, markup) {
  const source = await readFile(path, "utf8");
  assert.match(source, /<\/body>/u);
  await writeFile(path, source.replace("</body>", `${markup}</body>`));
}

test("qualified source trees ignore only Wrangler's reserved local residue", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "lattice-qualified-tree-test-"));
  try {
    await mkdir(join(temporaryDirectory, ".wrangler", "tmp"), { recursive: true });
    await writeFile(join(temporaryDirectory, ".wrangler", "tmp", "bundle.js"), "generated");
    await writeFile(join(temporaryDirectory, "worker.js"), "tracked source");
    await writeFile(join(temporaryDirectory, "meaningful-untracked.js"), "meaningful drift");

    const qualified = (await qualifiedFilesBelow(temporaryDirectory, "test fixture"))
      .map((path) => relative(temporaryDirectory, path).split("\\").join("/"))
      .sort();

    assert.deepEqual(qualified, ["meaningful-untracked.js", "worker.js"]);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("the release register holds only the consequential live-service blocker", async () => {
  const [registerSource, atlasSource, evaluationSource, view, held, projectsSource, packageSource, workflow, validatorSource, documentationBuilder, operatorReadme, wasmFetcher] = await Promise.all([
    readFile(registerPath, "utf8"),
    readFile(join(root, "docs/text-to-lattice/LATTICE-DOCUMENTATION-ATLAS.json"), "utf8"),
    readFile(join(root, "docs/text-to-lattice/LLAMA-USE-EVALUATION-CASES.json"), "utf8"),
    readFile(join(root, "app/resume/ResumeView.tsx"), "utf8"),
    readFile(join(root, "app/resume/ResumeProjectsHeld.tsx"), "utf8"),
    readFile(join(root, "app/resume/projects.js"), "utf8"),
    readFile(join(root, "package.json"), "utf8"),
    readFile(join(root, ".github/workflows/pages.yml"), "utf8"),
    readFile(validator, "utf8"),
    readFile(join(root, "scripts/docs/build-text-to-lattice-documentation.mjs"), "utf8"),
    readFile(join(root, "workers/text-to-lattice-lease/README.md"), "utf8"),
    readFile(join(root, "scripts/fetch-lattice-wasm.mjs"), "utf8"),
  ]);
  const register = JSON.parse(registerSource);
  const atlas = JSON.parse(atlasSource);
  const evaluation = JSON.parse(evaluationSource);
  const packageJson = JSON.parse(packageSource);
  const lattice = projectBySlug("lattice");

  assert.equal(register.overallStatus, "held");
  assert.equal(register.publicClient.status, "held");
  assert.equal(register.publicClient.publicationMode, "documentation-only");
  assert.deepEqual(register.statusVocabulary, [
    "satisfied-in-source",
    "satisfied-in-production",
    "release-workflow-enforced",
    "accepted-residual-risk",
    "post-deployment-verification",
    "open-release-blocker",
  ]);
  assert.equal(register.ownerDisposition.status, "release-directed");
  assert.equal(register.ownerDisposition.qualifiedSourceSetSha256, register.authority.qualifiedSourceSet.sha256);
  assert.match(register.authority.qualifiedSourceSet.sha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(register.authority.qualifiedSourceSet.files, [
    ".github/workflows/pages.yml",
    "CNAME",
    "LICENSE-MAP.json",
    "NOTICE",
    "THIRD_PARTY_LICENSES.txt",
    "THIRD_PARTY_NOTICES.md",
    "eslint.config.mjs",
    "next-env.d.ts",
    "next.config.ts",
    "package-lock.json",
    "package.json",
    "postcss.config.mjs",
    "tsconfig.json",
    "vite.config.ts",
    "workers/package-lock.json",
    "workers/package.json",
  ], "the qualified source set binds the exact reviewed file inventory");
  assert.deepEqual(register.authority.qualifiedSourceSet.trees, [
    "LICENSES",
    "app",
    "scripts",
    "tests",
    "workers/text-to-lattice-attestation-frame",
    "workers/text-to-lattice-lease",
    "workers/text-to-lattice-response-policy",
  ], "the qualified source set binds the exact reviewed tree inventory");
  assert.deepEqual(register.gates.map(({ id }) => id), expectedGateIds);
  assert.deepEqual(register.gates.map(({ id, status, marginalValue }) => [id, status, marginalValue]), [
    ["GATE-01", "release-workflow-enforced", "high"],
    ["GATE-02", "open-release-blocker", "high"],
    ["GATE-03", "post-deployment-verification", "moderate"],
    ["GATE-04A", "accepted-residual-risk", "moderate"],
    ["GATE-04B", "accepted-residual-risk", "moderate"],
    ["GATE-04C", "accepted-residual-risk", "moderate"],
    ["GATE-05", "accepted-residual-risk", "moderate"],
    ["GATE-06", "post-deployment-verification", "high"],
  ]);
  const gateProjectionFields = ["id", "label", "status", "marginalValue", "requirement", "currentEvidence", "evidenceNeeded", "rationale", "evidence", "safeguards", "followUp", "rollbackCondition", "acceptanceBasis"];
  assert.deepEqual(atlas.securityModel.prePublicationGates, register.gates.map((gate) => Object.fromEntries(gateProjectionFields.map((field) => [field, gate[field]]))));
  assert.ok(register.gates.every(({ rationale, evidence, safeguards, followUp }) => rationale && evidence.length && safeguards.length && followUp));
  assert.ok(register.gates.filter(({ status }) => ["satisfied-in-production", "post-deployment-verification"].includes(status)).every(({ rollbackCondition }) => rollbackCondition));
  assert.ok(register.gates.filter(({ status }) => status === "accepted-residual-risk").every(({ acceptanceBasis }) => acceptanceBasis));
  const gate02 = register.gates.find(({ id }) => id === "GATE-02");
  const gate06 = register.gates.find(({ id }) => id === "GATE-06");
  assert.match(`${gate02.requirement} ${gate02.evidenceNeeded}`, /noninteractive/iu);
  assert.match(`${gate02.requirement} ${gate02.evidenceNeeded}`, /invalid-(?:token|attestation)/iu);
  assert.match(gate02.evidenceNeeded, /intentionally invalid-attestation/iu);
  assert.match(gate02.evidenceNeeded, /exact official demonstration-site-key, and exact official dummy-token acquisition-and-release probes/iu);
  assert.match(gate02.evidenceNeeded, /direct dummy-token lifecycle establishes only the deployed Siteverify, lease, and release path/iu);
  assert.match(gate02.evidenceNeeded, /not evidence that the frame or widget participated or that canonical-browser GATE-06 passed/iu);
  assert.equal(gate02.label, "Deployed origin, secret, and demonstration boundary");
  assert.match(gate02.requirement, /four exact response-policy routes/iu);
  for (const exactRoute of ["hah.dev/", "hah.dev/index.html", "hah.dev/resume/", "hah.dev/resume/index.html"]) {
    assert.match(`${gate02.requirement} ${gate02.evidenceNeeded}`, new RegExp(exactRoute.replaceAll("/", "\\/"), "u"));
  }
  assert.ok(gate02.safeguards.some((safeguard) => /unrelated portfolio (?:paths|traffic).*bypass/iu.test(safeguard)));
  assert.match(gate02.requirement, /bounded demonstrable release.*official testing pair.*does not count as production anti-bot evidence/iu);
  assert.match(gate02.evidenceNeeded, /preserve a complete existing Turnstile pair without reading or replacing its values, or install Cloudflare's official testing pair.*independent generated signing secrets/iu);
  assert.ok(gate02.safeguards.some((safeguard) => /official testing pair.*exact published secret.*never described as anti-bot assurance/iu.test(safeguard)));
  assert.match(gate02.followUp, /Before describing the release as operationally anti-bot protected, intentionally change the declared profile, workflow verifier, and register to a hostname-restricted real widget pair/iu);
  assert.match(gate02.followUp, /do not add a bespoke bypass route or unsigned token mode/iu);
  assert.doesNotMatch(`${gate02.requirement} ${gate02.evidenceNeeded} ${gate02.followUp}`, /complete one real official-page lifecycle|wait through (?:at least )?the five-minute server renewal minimum/iu);
  assert.equal(gate06.label, "Production lifecycle and privacy trace");
  assert.equal(gate06.status, "post-deployment-verification");
  assert.match(gate06.requirement, /activated canonical page.*200 acquisition and 204 release/iu);
  assert.match(gate06.requirement, /declared deployed credential profile/iu);
  assert.match(gate06.requirement, /Testing-profile success establishes demonstrator integration, not production anti-bot assurance/iu);
  assert.match(gate06.evidenceNeeded, /first activation session/iu);
  assert.match(gate06.evidenceNeeded, /supported browser engines/iu);
  assert.match(gate06.evidenceNeeded, /both origins/iu);
  assert.match(`${gate06.evidenceNeeded} ${gate06.followUp}`, /naturally reaches the renewal interval/iu);
  assert.match(gate06.evidenceNeeded, /do not deliberately wait/iu);
  assert.doesNotMatch(`${gate06.requirement} ${gate06.evidenceNeeded} ${gate06.followUp}`, /wait .*five-minute|record a 200 renewal/iu);
  assert.match(gate06.evidenceNeeded, /Do not create a public or operator bypass harness/iu);
  assert.match(gate06.rollbackCondition, /held documentation-only artifact/iu);
  assert.match(gate06.rollbackCondition, /GATE-06 to open-release-blocker/iu);
  for (const contentClass of ["source", "clarification", "candidate", "verifier finding", "output"]) {
    assert.match(gate06.requirement, new RegExp(contentClass, "iu"));
    assert.match(gate06.rollbackCondition, new RegExp(contentClass, "iu"));
  }
  for (const failure of [/acquisition fails/iu, /observed real renewal attempt fails/iu, /release fails/iu]) {
    assert.match(gate06.rollbackCondition, failure);
  }
  const renewalDecision = register.marginalValueDecisions.find(({ finding }) => finding === "Deliberately timed real-browser renewal trace");
  assert.equal(renewalDecision?.classification, "moderate");
  assert.equal(renewalDecision?.disposition, "observe-naturally-and-defer-as-release-gate");
  assert.match(renewalDecision?.rationale ?? "", /source and adversarial tests.*bodyless PATCH.*bounded lease expiry.*eventual cleanup/iu);
  const demonstrationProfileDecision = register.marginalValueDecisions.find(({ finding }) => finding === "Cloudflare official testing credentials for the demonstrable release");
  assert.equal(demonstrationProfileDecision?.classification, "moderate");
  assert.equal(demonstrationProfileDecision?.disposition, "bounded-demonstration-only");
  assert.match(demonstrationProfileDecision?.rationale ?? "", /documented testing pair.*explicit disclosure.*exact-origin and bodyless boundaries.*independent signing domains.*global daily admission.*bounded expiry.*must not be represented as production anti-bot assurance/iu);
  const bypassDecision = register.marginalValueDecisions.find(({ finding }) => finding === "Bespoke attestation bypass route or unsigned token mode");
  assert.equal(bypassDecision?.classification, "negative");
  assert.equal(bypassDecision?.disposition, "do-not-implement");
  assert.match(bypassDecision?.rationale ?? "", /undocumented public protocol.*attack surface.*exact published test profile.*existing Siteverify and signed-lease contract.*without proving widget participation/iu);
  const broadResponsePolicyDecision = register.marginalValueDecisions.find(({ finding }) => finding === "Portfolio-wide response-policy Worker route");
  assert.equal(broadResponsePolicyDecision?.classification, "negative");
  assert.equal(broadResponsePolicyDecision?.disposition, "do-not-implement");
  assert.match(broadResponsePolicyDecision?.rationale ?? "", /unrelated portfolio (?:pages|traffic).*allowance.*failure blast radius.*four exact document routes/iu);
  const publicTokenStarvationDecision = register.marginalValueDecisions.find(({ finding }) => finding === "Public testing-token slot starvation and the 48-per-10-second edge rule");
  assert.equal(publicTokenStarvationDecision?.classification, "moderate");
  assert.equal(publicTokenStarvationDecision?.disposition, "accepted-residual-with-operational-hardening");
  assert.match(publicTokenStarvationDecision?.rationale ?? "", /16-request acquisition sequence.*all eight slots.*48-per-10-second per-IP rule does not prevent.*limit consequence to demonstrator availability.*observed abuse triggers requalification/iu);
  assert.match(validatorSource, /GATE-02 cannot require a real canonical-page lifecycle while the public client is held/u);
  assert.match(documentationBuilder, /GATE-06 must retain first-session canonical-page acquisition, release, and two-origin privacy verification or a machine-representable open blocker/u);
  assert.match(operatorReadme, /GATE-06 begins only after the canonical public client is activated/u);
  assert.match(operatorReadme, /Do not add a public route, operator-only page, unsigned token mode, or test-key\s+behavior beyond Cloudflare's exact published pair/u);
  assert.equal(evaluation.cases.length, 10);
  assert.equal(evaluation.cases.filter(({ expectedSafety }) => expectedSafety).length, 5);
  assert.equal(register.artifactSet.llamaBehaviorEvaluation.exactModelExecutionStatus, "accepted-residual-risk");
  assert.equal(register.artifactSet.llamaBehaviorEvaluation.exactModelExecutionPerformed, false);
  assert.equal(register.artifactSet.models.verifier.artifactProvenanceEstablished, false);
  assert.equal(register.artifactSet.wasm.reproducibility.established, false);
  assert.equal(lattice.interactiveRelease, "held");
  assert.equal(lattice.interaction, null);
  assert.match(view, /from "\.\/ResumeProjectsHeld"/u);
  assert.doesNotMatch(view, /from "\.\/ResumeProjects"/u);
  assert.doesNotMatch(held, /<form\b|<textarea\b|role="dialog"|aria-haspopup=/iu);
  assert.doesNotMatch(held, /from\s+["'].+\/(?:lattice|latticeDemo)/u);
  assert.doesNotMatch(projectsSource, /from\s+["'][^"']*(?:siteContent|\/lattice(?:\/|["']))/u);
  assert.match(packageJson.scripts.build, /release:lattice:verify/u);
  assert.match(packageJson.scripts.build, /typecheck/u);
  assert.equal(packageJson.scripts.typecheck, "tsc --noEmit");
  assert.match(packageJson.scripts["build:pages"], /release:lattice:verify:site/u);
  assert.match(packageJson.scripts["release:lattice:verify:wasm"], /fetch-lattice-wasm/u);
  assert.match(wasmFetcher, /bytes\.byteLength !== record\.bytes/u);
  assert.match(wasmFetcher, /digest !== record\.sha256/u);
  assert.match(wasmFetcher, /createHash\("sha1"\)[\s\S]*?blob \$\{bytes\.byteLength\}\\0/u);
  assert.match(wasmFetcher, /gitBlob !== record\.gitBlob/u);
  assert.match(wasmFetcher, /does not establish source reproducibility or artifact licensing/u);
  assert.match(workflow, /Fetch and verify pinned Text to Lattice WASM identities[\s\S]*?release:lattice:verify:wasm/u);
  assert.match(workflow, /Verify Text to Lattice release boundary[\s\S]*?release:lattice:verify:site/u);
  assert.match(workflow, /actions\/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5\.0\.0[\s\S]*?include-hidden-files: true/u);
  assert.ok((workflow.match(/if: github\.ref == 'refs\/heads\/main'/gu) ?? []).length >= 2);
  assert.match(workflow, /npm run typecheck[\s\S]*?npm test/u);
  assert.doesNotMatch(validatorSource, /register and activation edits alone cannot publish inference/u);
  assert.match(validatorSource, /public client must be enabled if and only if no open release blocker remains/u);
  assert.match(validatorSource, /qualified source set must contain the exact reviewed activation, runtime, validator, test, license-routing, legal-notice, response-policy, secret-bootstrap, and workflow path inventory/u);
  assert.match(validatorSource, /enabled publication must declare interactive-client mode/u);
  assert.match(validatorSource, /verifyEnabledBuiltBoundary/u);
  assert.match(validatorSource, /enabled project surface must expose exactly one Text to Lattice modal launcher/u);
  assert.match(validatorSource, /enabled résumé artifact must expose exactly one Text to Lattice modal launcher/u);
  assert.match(validatorSource, /staleEnabledPublicationPattern/u);
  assert.match(validatorSource, /sole open \(\?:release \)\?blocker/u);
  assert.match(validatorSource, /enabled release artifact contains stale held-gate copy/u);
  assert.match(validatorSource, /artifacts\.models\[role\]\.artifactUrl !== LATTICE_MODEL_ROLES\[role\]\.revisionUrl/u);
  assert.match(validatorSource, /artifacts\.models\[role\]\.baseModelUrl !== LATTICE_MODEL_ROLES\[role\]\.baseModelRepository/u);
  assert.match(validatorSource, /artifacts\.wasm\.repository !== LATTICE_WASM_REPOSITORY/u);
  assert.match(validatorSource, /artifacts\.wasm\.directory !== LATTICE_WASM_BUILD_LINEAGE\.releaseDirectory/u);
  assert.match(validatorSource, /heldRuntimeAssetPatterns/u);
  for (const runtimeAssetName of [".wasm", "safetensors", "tokenizer(?:_config)?", "tokenizer\\.model", "mlc-chat-config", "ndarray-cache"]) {
    assert.ok(validatorSource.includes(runtimeAssetName), `held validator must reject ${runtimeAssetName} assets`);
  }
  assert.match(validatorSource, /heldExecutableExtensions = new Set\(\["\.js", "\.mjs", "\.cjs", "\.map"\]\)/u);
  assert.match(validatorSource, /scanHtmlStartTags/u);
  assert.match(validatorSource, /heldArtifactDigests\.has\(digest\(bytes\)\)/u);
  assert.match(validatorSource, /--site-root requires --site/u);
  await execute(process.execPath, [validator, "--source"], { cwd: root });
});

test("a failed GATE-06 can become the machine-enforced blocker after GATE-02 closes", async () => {
  const register = JSON.parse(await readFile(registerPath, "utf8"));
  const gate02 = register.gates.find(({ id }) => id === "GATE-02");
  const gate06 = register.gates.find(({ id }) => id === "GATE-06");
  gate02.status = "satisfied-in-production";
  gate02.rollbackCondition = "Reopen GATE-02 and return to held publication if the deployed boundary drifts.";
  gate06.status = "open-release-blocker";

  assert.doesNotThrow(() => verifyLifecycleGateContract(gate02, gate06));
  assert.deepEqual(verifyReleaseStatusState(register), {
    hasOpenBlocker: true,
    enabled: false,
    held: true,
  });
});

test("the bounded official testing profile cannot become an anti-bot claim or unsigned bypass", async () => {
  const register = JSON.parse(await readFile(registerPath, "utf8"));
  const gate02 = register.gates.find(({ id }) => id === "GATE-02");
  const gate06 = register.gates.find(({ id }) => id === "GATE-06");
  assert.doesNotThrow(() => verifyLifecycleGateContract(gate02, gate06));

  const antiBotClaim = structuredClone(gate02);
  antiBotClaim.requirement = antiBotClaim.requirement.replace(
    "does not count as production anti-bot evidence",
    "counts as production anti-bot evidence",
  );
  assert.throws(
    () => verifyLifecycleGateContract(antiBotClaim, gate06),
    /must disclose the bounded Cloudflare official-testing profile/u,
  );

  const unsignedAlternative = structuredClone(gate02);
  unsignedAlternative.followUp = unsignedAlternative.followUp.replace(
    "do not add a bespoke bypass route or unsigned token mode",
    "an unsigned token mode is permitted",
  );
  assert.throws(
    () => verifyLifecycleGateContract(unsignedAlternative, gate06),
    /must disclose the bounded Cloudflare official-testing profile/u,
  );

  const contradictoryClaim = structuredClone(gate02);
  contradictoryClaim.followUp += " The official testing pair provides production anti-bot assurance, and an unsigned mode is permitted.";
  assert.throws(
    () => verifyLifecycleGateContract(contradictoryClaim, gate06),
    /must disclose the bounded Cloudflare official-testing profile/u,
  );
});

test("the validator rejects a nominally enabled client while any gate is open", async () => {
  const register = JSON.parse(await readFile(registerPath, "utf8"));
  register.overallStatus = "qualified";
  register.publicClient.status = "enabled";
  register.publicClient.publicationMode = "interactive-client";
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "lattice-release-test-"));
  const fixture = join(temporaryDirectory, "register.json");
  await writeFile(fixture, `${JSON.stringify(register, null, 2)}\n`);
  try {
    await assert.rejects(
      execute(process.execPath, [validator, "--source", `--register=${fixture}`], { cwd: root }),
      (error) => /public client must be enabled if and only if no open release blocker remains/u.test(`${error.stderr ?? ""}${error.message ?? ""}`),
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("qualification statuses retain their evidence, safeguard, acceptance, rollback, and source bindings", async () => {
  const baseline = JSON.parse(await readFile(registerPath, "utf8"));
  const mutations = [
    [(record) => { record.authority.qualifiedSourceSet.sha256 = "0".repeat(64); }, /qualified source-set digest does not match/u],
    [(record) => { record.authority.qualifiedSourceSet.files = record.authority.qualifiedSourceSet.files.filter((path) => path !== "LICENSE-MAP.json"); }, /exact reviewed activation, runtime, validator, test, license-routing, legal-notice, response-policy, secret-bootstrap, and workflow path inventory/u],
    [(record) => { record.authority.qualifiedSourceSet.files = record.authority.qualifiedSourceSet.files.filter((path) => path !== "NOTICE"); }, /exact reviewed activation, runtime, validator, test, license-routing, legal-notice, response-policy, secret-bootstrap, and workflow path inventory/u],
    [(record) => { record.authority.qualifiedSourceSet.trees = record.authority.qualifiedSourceSet.trees.filter((path) => path !== "tests"); }, /exact reviewed activation, runtime, validator, test, license-routing, legal-notice, response-policy, secret-bootstrap, and workflow path inventory/u],
    [(record) => { record.authority.qualifiedSourceSet.trees = record.authority.qualifiedSourceSet.trees.filter((path) => path !== "workers\/text-to-lattice-response-policy"); }, /exact reviewed activation, runtime, validator, test, license-routing, legal-notice, response-policy, secret-bootstrap, and workflow path inventory/u],
    [(record) => { record.statusVocabulary = record.statusVocabulary.filter((status) => status !== "satisfied-in-production"); }, /statusVocabulary does not match/u],
    [(record) => { record.gates.find(({ id }) => id === "GATE-02").evidence = []; }, /GATE-02 evidence must be a nonempty array/u],
    [(record) => { record.gates.find(({ id }) => id === "GATE-02").status = "satisfied-in-production"; }, /GATE-02 rollbackCondition must be a nonempty string/u],
    [(record) => { record.gates.find(({ id }) => id === "GATE-02").status = "satisfied-in-source"; }, /GATE-02 must remain an open release blocker until it is satisfied in production/u],
    [(record) => { record.gates.find(({ id }) => id === "GATE-02").evidenceNeeded = "Complete one real official-page lifecycle and wait through the five-minute server renewal minimum."; }, /GATE-02 must bind live noninteractive, invalid-token, and direct official dummy-token probes/u],
    [(record) => { record.gates.find(({ id }) => id === "GATE-02").followUp += " Complete a real official-page lifecycle before activation."; }, /GATE-02 cannot require a real canonical-page lifecycle while the public client is held/u],
    [(record) => {
      const gate = record.gates.find(({ id }) => id === "GATE-02");
      gate.requirement = gate.requirement.replace("hah.dev/resume/index.html", "hah.dev/*");
      gate.evidenceNeeded = gate.evidenceNeeded.replace("hah.dev/resume/index.html", "hah.dev/*");
    }, /GATE-02 must bind the exact response-policy route hah\.dev\/resume\/index\.html/u],
    [(record) => { record.qualificationScope = record.qualificationScope.replace("not represented as production anti-bot assurance", "production anti-bot assurance"); }, /qualificationScope must disclose the bounded official-testing fallback/u],
    [(record) => { record.gates.find(({ id }) => id === "GATE-02").requirement = record.gates.find(({ id }) => id === "GATE-02").requirement.replace("does not count as production anti-bot evidence", "counts as production anti-bot evidence"); }, /GATE-02 must disclose the bounded Cloudflare official-testing profile/u],
    [(record) => { record.gates.find(({ id }) => id === "GATE-02").followUp = record.gates.find(({ id }) => id === "GATE-02").followUp.replace("do not add a bespoke bypass route or unsigned token mode", "an unsigned token mode is permitted"); }, /GATE-02 must disclose the bounded Cloudflare official-testing profile/u],
    [(record) => { record.gates.find(({ id }) => id === "GATE-04A").status = "satisfied-in-production"; }, /GATE-04A cannot use satisfied-in-production status/u],
    [(record) => { record.artifactSet.llamaBehaviorEvaluation.exactModelExecutionStatus = "satisfied-in-production"; }, /Llama exact-model execution has an unsupported qualification status/u],
    [(record) => { record.gates.find(({ id }) => id === "GATE-04A").acceptanceBasis = null; }, /GATE-04A acceptanceBasis must be a nonempty string/u],
    [(record) => { record.gates.find(({ id }) => id === "GATE-06").rollbackCondition = null; }, /GATE-06 rollbackCondition must be a nonempty string/u],
    [(record) => {
      const gate = record.gates.find(({ id }) => id === "GATE-06");
      gate.status = "satisfied-in-source";
      gate.rollbackCondition = null;
    }, /GATE-06 must retain first-session canonical-page acquisition, release, and two-origin privacy verification/u],
    [(record) => {
      const gate = record.gates.find(({ id }) => id === "GATE-06");
      gate.evidenceNeeded = gate.evidenceNeeded.replace("first activation session", "later session").replace("supported browser engine", "browser");
      gate.followUp = gate.followUp.replace("first activation session", "later session");
    }, /GATE-06 must retain first-session canonical-page acquisition, release, and two-origin privacy verification/u],
    [(record) => {
      const gate = record.gates.find(({ id }) => id === "GATE-06");
      gate.requirement = gate.requirement.replace("clarification, ", "");
    }, /GATE-06 must retain first-session canonical-page acquisition, release, and two-origin privacy verification/u],
    [(record) => {
      const gate = record.gates.find(({ id }) => id === "GATE-06");
      gate.requirement = gate.requirement.replace("declared deployed credential profile", "production widget");
    }, /GATE-06 must retain first-session canonical-page acquisition, release, and two-origin privacy verification/u],
    [(record) => { record.gates.find(({ id }) => id === "GATE-06").evidenceNeeded = "Create an operator bypass harness before activation."; }, /GATE-06 must retain first-session canonical-page acquisition, release, and two-origin privacy verification/u],
    [(record) => { record.gates.find(({ id }) => id === "GATE-06").followUp += " Wait through the five-minute interval before completion."; }, /GATE-06 must retain first-session canonical-page acquisition, release, and two-origin privacy verification/u],
    [(record) => { record.marginalValueDecisions[0].classification = "novelty-only"; }, /marginal-value decision 0 has an unsupported classification/u],
    [(record) => { record.marginalValueDecisions[1].rationale = ""; }, /marginal-value decision 1 rationale must be a nonempty string/u],
    [(record) => { record.marginalValueDecisions.find(({ finding }) => finding === "Deliberately timed real-browser renewal trace").classification = "low"; }, /deliberately timed real-browser renewal trace must remain a moderate/u],
    [(record) => { record.marginalValueDecisions.find(({ finding }) => finding === "Cloudflare official testing credentials for the demonstrable release").classification = "high"; }, /Cloudflare official-testing profile must remain a moderate/u],
    [(record) => { record.marginalValueDecisions.find(({ finding }) => finding === "Bespoke attestation bypass route or unsigned token mode").disposition = "implement"; }, /bespoke attestation bypass route or unsigned token mode must remain a negative-marginal-value/u],
    [(record) => { record.marginalValueDecisions.find(({ finding }) => finding === "Portfolio-wide response-policy Worker route").classification = "moderate"; }, /portfolio-wide response-policy Worker route must remain a negative-marginal-value/u],
    [(record) => { record.marginalValueDecisions.find(({ finding }) => finding === "Public testing-token slot starvation and the 48-per-10-second edge rule").classification = "low"; }, /public testing-token slot starvation must remain a moderate accepted availability residual/u],
  ];
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "lattice-qualification-schema-test-"));
  const fixture = join(temporaryDirectory, "register.json");
  try {
    for (const [mutate, expectedFailure] of mutations) {
      const record = structuredClone(baseline);
      mutate(record);
      await writeFile(fixture, `${JSON.stringify(record, null, 2)}\n`);
      await assert.rejects(
        execute(process.execPath, [validator, "--source", `--register=${fixture}`], { cwd: root }),
        (error) => expectedFailure.test(`${error.stderr ?? ""}${error.message ?? ""}`),
      );
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("the release register cannot redirect or relabel pinned runtime artifacts", async () => {
  const baseline = JSON.parse(await readFile(registerPath, "utf8"));
  const mutations = [
    [(record) => { record.artifactSet.models.generator.artifactUrl = "https://example.invalid/model"; }, /generator model artifact URL drifted/u],
    [(record) => { record.artifactSet.models.verifier.baseModelUrl = "https://example.invalid/base"; }, /verifier base-model URL drifted/u],
    [(record) => { record.artifactSet.wasm.repository = "https://example.invalid/wasm"; }, /WASM repository URL drifted/u],
    [(record) => { record.artifactSet.wasm.directory = "other-release"; }, /WASM release directory drifted/u],
    [(record) => { record.artifactSet.runtime.name = "Other runtime"; }, /WebLLM name drifted/u],
    [(record) => { record.artifactSet.runtime.url = "https://example.invalid/runtime"; }, /WebLLM repository URL drifted/u],
    [(record) => { record.artifactSet.tokenizerRuntime.name = "Other tokenizer"; }, /tokenizer runtime name drifted/u],
    [(record) => { record.artifactSet.tokenizerRuntime.url = "https://example.invalid/tokenizer"; }, /tokenizer runtime repository URL drifted/u],
    [(record) => { record.artifactSet.structuredOutputRuntime.name = "Other grammar runtime"; }, /structured-output runtime name drifted/u],
    [(record) => { record.artifactSet.structuredOutputRuntime.url = "https://example.invalid/grammar"; }, /structured-output runtime repository URL drifted/u],
    [(record) => { record.artifactSet.tokenizers.generator.path = "other-tokenizer.json"; }, /generator tokenizer path drifted/u],
    [(record) => { record.artifactSet.tokenizers.verifier.sri = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; }, /verifier tokenizer SRI drifted/u],
  ];
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "lattice-artifact-register-test-"));
  const fixture = join(temporaryDirectory, "register.json");
  try {
    for (const [mutate, expectedFailure] of mutations) {
      const record = structuredClone(baseline);
      mutate(record);
      await writeFile(fixture, `${JSON.stringify(record, null, 2)}\n`);
      await assert.rejects(
        execute(process.execPath, [validator, "--source", `--register=${fixture}`], { cwd: root }),
        (error) => expectedFailure.test(`${error.stderr ?? ""}${error.message ?? ""}`),
      );
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("the held Pages artifact contains evidence but no Text to Lattice execution surface", async () => {
  const [resume, project, qualification, exportedRegister, exportedEvaluation, sourceRegister, sourceEvaluation] = await Promise.all([
    readFile(join(root, "site/resume/index.html"), "utf8"),
    readFile(join(root, "site/projects/lattice/text-to-lattice/index.html"), "utf8"),
    readFile(join(root, "site/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md"), "utf8"),
    readFile(join(root, "site/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json"), "utf8"),
    readFile(join(root, "site/documentation/text-to-lattice/LLAMA-USE-EVALUATION-CASES.json"), "utf8"),
    readFile(registerPath, "utf8"),
    readFile(join(root, "docs/text-to-lattice/LLAMA-USE-EVALUATION-CASES.json"), "utf8"),
  ]);

  assert.match(resume, /href="\/projects\/lattice\/"[^>]*>Lattice<\/a>/u);
  assert.match(
    resume,
    /<a(?=[^>]*class="tool-icon project-modal-trigger signal-fuzz")(?=[^>]*href="\/projects\/lattice\/text-to-lattice\/")(?=[^>]*aria-label="Read Text to Lattice release status")[^>]*>\s*<svg\b[\s\S]*?<\/svg>\s*<\/a>/u,
  );
  assert.doesNotMatch(resume, /lattice-demo-dialog|lattice-demo-input|data-lattice-launch="text-to-lattice"/u);
  assert.match(project, /Release status:\s*(?:<!-- -->)?held/u);
  assert.match(project, /TEXT-TO-LATTICE-RELEASE-QUALIFICATION\.md/u);
  assert.match(qualification, /consequence × plausibility × lifecycle value/u);
  assert.match(qualification, /GATE-02 can and must establish the deployed response policy.*frame.*live noninteractive or intentionally invalid-token result.*direct exact-dummy-token.*before activation/u);
  assert.match(qualification, /GATE-06 therefore requires a real `200` acquisition.*rapid return to the held artifact on failure/u);
  assert.match(qualification, /deliberately waiting five minutes.*moderate incremental value.*not a condition of operational completion/u);
  assert.match(qualification, /A separate public or operator bypass harness.*outside the authorized boundary/u);
  assert.match(qualification, /Cloudflare(?:'s|\u2019s) official testing pair[\s\S]{0,500}(?:rather than|does not (?:provide|establish)|provides? no)[^.]{0,160}production anti-bot (?:assurance|protection)/iu);
  assert.match(qualification, /exact published dummy token[\s\S]{0,500}reusable/iu);
  assert.match(qualification, /Public testing-token slot starvation and the 48-per-10-second edge rule/iu);
  assert.match(qualification, /Cloudflare official testing credentials for the demonstrable release/iu);
  assert.match(qualification, /Bespoke attestation bypass route or unsigned token mode/iu);
  assert.match(qualification, /Portfolio-wide response-policy Worker route/iu);
  assert.equal(JSON.parse(exportedRegister).overallStatus, "held");
  assert.equal(exportedRegister, sourceRegister);
  assert.equal(exportedEvaluation, sourceEvaluation);
  await execute(process.execPath, [validator, "--source", "--site"], { cwd: root });
});

test("the held-site validator rejects executable bypasses outside the résumé", async () => {
  const route = (site) => join(site, "projects/medium/index.html");

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<script type="text/&#106;avascript">fetch("/api/text-to-lattice/lease")</script>'),
    /held inline executable script in projects\/medium\/index\.html contains \/api\/text-to-lattice\/lease/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<script data-type="application/ld+json">fetch("/api/text-to-lattice/lease")</script>'),
    /held inline executable script in projects\/medium\/index\.html contains \/api\/text-to-lattice\/lease/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<script data-src="/runtime-entry">fetch("/api/text-to-lattice/lease")</script>'),
    /held inline executable script in projects\/medium\/index\.html contains \/api\/text-to-lattice\/lease/u,
  );

  await withCopiedSiteFixture(async (site) => {
    await writeFile(join(site, "runtime-entry"), 'fetch("https://verify.hah.dev")');
    await appendToHtml(route(site), '<script src="/runtime-entry"></script>');
  }, /held referenced script asset runtime-entry contains https:\/\/verify\.hah\.dev/u);

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<div id="lattice-demo-dialog"></div>'),
    /held HTML route projects\/medium\/index\.html contains a Lattice interactive marker/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<script src="https://attacker.example/inference.js"></script>'),
    /references a cross-origin executable script/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<script/src="https://attacker.example/inference.js"></script>'),
    /references a cross-origin executable script/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<script data-description=">" src="https://attacker.example/inference.js"></script>'),
    /references a cross-origin executable script/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<iframe src="HTTPS://VERIFY.HAH.DEV/challenge"></iframe>'),
    /exposes the verification or lease boundary through iframe src/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<iframe srcdoc="&lt;script&gt;fetch(\'/api/text-to-lattice/lease\')&lt;/script&gt;"></iframe>'),
    /contains an executable iframe srcdoc/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<form action="&#47;api&#47;text-to-lattice&#47;lease"></form>'),
    /exposes the verification or lease boundary through form action/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<button onclick="fetch(\'/api/text-\' + \'to-lattice/lease\')">Run</button>'),
    /contains an inline event handler/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<svg/onload="fetch(\'/api/text-to-lattice/lease\')"></svg>'),
    /contains an inline event handler/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<button data-description=">" onclick="fetch(\'/api/text-to-lattice/lease\')">Run</button>'),
    /contains an inline event handler/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<base/href="https://attacker.example/"><script src="/_next/static/chunks/index-CtFJ3rYh.js"></script>'),
    /contains a base element/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<a/href="java&#x09script:fetch(\'/api/text-to-lattice/lease\')">Run</a>'),
    /contains a javascript: URL/u,
  );

  await withCopiedSiteFixture(
    (site) => writeFile(join(site, "runtime.data"), Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])),
    /contains WebAssembly bytes regardless of filename: runtime\.data/u,
  );

  await withCopiedSiteFixture(
    (site) => symlink(join(site, "_next"), join(site, "linked-assets"), "dir"),
    /release site contains a symbolic link/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<link rel="preload" as="fetch" href="https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Qwen3-4B-q4f16_1-ctx4k_cs1k-webgpu.wasm">'),
    /held network-active link href in projects\/medium\/index\.html contains raw\.githubusercontent\.com\/mlc-ai\/binary-mlc-llm-libs/u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<style>.preview { background: url("https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/resolve/model.safetensors"); }</style>'),
    /held inline style block in projects\/medium\/index\.html contains huggingface\.co\/mlc-ai\/Llama-3\.2-3B-Instruct-q4f16_1-MLC\/resolve\//u,
  );

  await withCopiedSiteFixture(
    (site) => appendToHtml(route(site), '<script type="application/json">{"endpoint":"/api/text-to-lattice/lease"}</script>'),
    /held inline JSON data in projects\/medium\/index\.html contains \/api\/text-to-lattice\/lease/u,
  );
});
