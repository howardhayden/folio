import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { projectDocuments } from "../app/content/projectDocuments.js";

const rootUrl = new URL("../", import.meta.url);
const publicRoot = new URL("../public/documentation/text-to-lattice/", import.meta.url);
const sourceRoot = new URL("../docs/text-to-lattice/", import.meta.url);
const siteRoot = new URL("../site/documentation/text-to-lattice/", import.meta.url);
const readBytes = (base, path) => readFile(new URL(path, base));
const readText = async (base, path) => (await readBytes(base, path)).toString("utf8");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const canonicalJson = (value) => Array.isArray(value)
  ? value.map(canonicalJson)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]))
    : value;
const occurrences = (value, expression) => [...value.matchAll(expression)].length;

const [atlas, manifest, releaseRegister] = await Promise.all([
  readText(sourceRoot, "LATTICE-DOCUMENTATION-ATLAS.json").then(JSON.parse),
  readText(publicRoot, "artifact-manifest.json").then(JSON.parse),
  readText(sourceRoot, "TEXT-TO-LATTICE-RELEASE-REGISTER.json").then(JSON.parse),
]);

test("the documentation generator binds current remote evidence and preserves inactive browser-local evidence", async () => {
  const [builder, releaseVerifier] = await Promise.all([
    readText(rootUrl, "scripts/docs/build-text-to-lattice-documentation.mjs"),
    readText(rootUrl, "scripts/verify-text-to-lattice-release.mjs"),
  ]);
  assert.match(builder, /productionSatisfiedGateIds = new Set\(\["GATE-02", "GATE-03", "GATE-06"\]\)/u);
  assert.match(builder, /"historical-inactive"/u);
  assert.match(builder, /"historicalInactiveRecord",[\s\S]{0,100}"activeCurrentEvidence",[\s\S]{0,100}"activeEvidence"/u);
  assert.match(builder, /GATE-02 must bind the exact same-origin request, server-only secret, fixed Hugging Face router with Nscale and DeepInfra targets/u);
  assert.match(builder, /GATE-03 must keep the provider call, stage, response, limiter, cost, generic-proxy, retry, fallback/u);
  assert.match(builder, /GATE-06 must require one explicit canonical-browser setup-plus-content lifecycle/u);
  assert.match(builder, /verifyReleaseStatusState\(releaseRegister\)/u);
  assert.match(builder, /"qualification-pending": "deployed-for-qualification"/u);
  assert.match(builder, /post-deployment verification only after GATE-02 and GATE-03 are satisfied in production/u);
  assert.match(builder, /deployed only for immediate canonical-browser qualification and is not qualified/u);
  assert.match(builder, /Current active evidence:[\s\S]{0,240}Historical inactive classification:/u);
  assert.match(builder, /Required production qualification remains incomplete; current bounded evidence is recorded in the release register/u);
  assert.match(releaseVerifier, /import \{ verifyBrowserEvidenceBundle \} from "\.\/verify-text-to-lattice-browser-evidence\.mjs"/u);
  assert.match(releaseVerifier, /await verifyBrowserEvidenceAuthority\(register, releaseState\)/u);
  assert.match(releaseVerifier, /bundle = await verifyBundle\(resolvedPath\.absolute\)/u);
});

test("the atlas models the held remote capability without promoting historical evidence", async () => {
  assert.equal(atlas.revision, "2026-10-04");
  assert.equal(atlas.historicalBoundary.status, "inactive");
  assert.match(atlas.historicalBoundary.currentArchitecture, /same-origin \/api\/lattice[\s\S]*bodyless visitor-session setup[\s\S]*exactly one content-bearing POST/iu);
  assert.match(atlas.historicalBoundary.evidencePolicy, /do not satisfy the current remote-service release gates/iu);

  const sources = new Map(atlas.sources.map((source) => [source.id, source]));
  assert.equal(sources.get("SRC-NETWORK-CAPABILITY").path, "app/privacy/networkCapabilities.js");
  assert.equal(sources.get("SRC-REMOTE-PROTOCOL").path, "app/resume/lattice/remoteProtocol.js");
  assert.equal(sources.get("SRC-REMOTE-CLIENT").path, "app/resume/lattice/remoteRequest.js");
  assert.equal(sources.get("SRC-API-WORKER").path, "workers/text-to-lattice-api/worker.js");
  assert.equal(sources.get("SRC-HF-ADAPTER").path, "workers/text-to-lattice-api/huggingFaceAdapter.js");
  assert.equal(
    sources.get("SRC-LLAMA-3-1-LICENSE").url,
    "https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct/blob/0e9e39f249a16976918f6564b8830bc894c89659/LICENSE",
  );
  assert.equal(
    sources.get("SRC-LLAMA-3-1-AUP").url,
    "https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct/blob/0e9e39f249a16976918f6564b8830bc894c89659/USE_POLICY.md",
  );
  assert.match(sources.get("SRC-LLAMA-LICENSE").label, /^Historical Llama 3\.2/u);
  assert.match(sources.get("SRC-LLAMA-AUP").label, /^Historical Llama 3\.2/u);
  for (const id of ["SRC-LOCAL-MODEL", "SRC-MODEL-WORKER", "SRC-ATTESTATION", "SRC-USAGE-LEASE", "SRC-LEASE-WORKER", "SRC-FRAME"]) {
    assert.match(sources.get(id).label, /^Historical inactive /u, `${id} remains available but inactive`);
  }

  const activeBlueprint = JSON.stringify(atlas.serviceBlueprint);
  for (const value of [
    "/api/lattice",
    "HF_TOKEN",
    "VISITOR_COOKIE_SECRET",
    "__Secure-hah-lattice-api-visitor",
    "30 accepted transformations globally per UTC day",
    "3 per cooperating canonical client with an ordinary persistent browser cookie jar per UTC day",
    "application/vnd.hah.text-to-lattice-visitor-session.v1+json",
    "428 visitor_session_required",
    "intentional cookie clearing",
    "Qwen/Qwen3-4B-Instruct-2507:nscale",
    "meta-llama/Llama-3.1-8B-Instruct:deepinfra",
    "no automatic retry",
    "provider or model fallback",
    "questions required to be empty",
    "no application database, object storage, cache, queue, raw-content log, or analytics event",
  ]) assert.ok(activeBlueprint.includes(value), `active blueprint includes ${value}`);
  assert.doesNotMatch(activeBlueprint, /WebLLM|Turnstile|text-to-lattice\/lease|Backstage browser-local/iu);
  assert.equal(atlas.serviceBlueprint.stages.length, 8);
  assert.equal(atlas.serviceBlueprint.lifecycleOwners.length, 8);
  assert.equal(atlas.historicalBrowserLocalServiceBlueprint.stages.length, 8);
  assert.match(JSON.stringify(atlas.historicalBrowserLocalServiceBlueprint), /WebGPU/iu);

  assert.equal(atlas.securityModel.assets.length, 6);
  assert.equal(atlas.securityModel.trustBoundaries.length, 6);
  assert.deepEqual(atlas.securityModel.threats.map(({ id }) => id), Array.from({ length: 12 }, (_, index) => `SEC-${String(index + 1).padStart(2, "0")}`));
  assert.deepEqual(atlas.securityModel.prePublicationGates, releaseRegister.gates);
  const activeUseThreat = atlas.securityModel.threats.find(({ id }) => id === "SEC-11");
  assert.ok(activeUseThreat.sourceIds.includes("SRC-LLAMA-3-1-LICENSE"));
  assert.ok(activeUseThreat.sourceIds.includes("SRC-LLAMA-3-1-AUP"));
  assert.ok(!activeUseThreat.sourceIds.includes("SRC-LLAMA-LICENSE"));
  assert.ok(!activeUseThreat.sourceIds.includes("SRC-LLAMA-AUP"));
  const historicalUseThreat = atlas.historicalBrowserLocalSecurityModel.threats.find(({ id }) => id === "SEC-11");
  assert.ok(historicalUseThreat.sourceIds.includes("SRC-LLAMA-AUP"));
  assert.ok(!historicalUseThreat.sourceIds.includes("SRC-LLAMA-3-1-LICENSE"));
  assert.ok(!historicalUseThreat.sourceIds.includes("SRC-LLAMA-3-1-AUP"));
  const historicalDisclosureThreat = atlas.historicalBrowserLocalSecurityModel.threats.find(({ id }) => id === "SEC-12");
  assert.ok(historicalDisclosureThreat.sourceIds.includes("SRC-LLAMA-LICENSE"));
  assert.ok(historicalDisclosureThreat.sourceIds.includes("SRC-LLAMA-AUP"));
  assert.deepEqual(
    releaseRegister.gates.map(({ id, status }) => [id, status]),
    [
      ["GATE-01", "release-workflow-enforced"],
      ["GATE-02", "open-release-blocker"],
      ["GATE-03", "open-release-blocker"],
      ["GATE-04A", "accepted-residual-risk"],
      ["GATE-04B", "historical-inactive"],
      ["GATE-04C", "historical-inactive"],
      ["GATE-05", "accepted-residual-risk"],
      ["GATE-06", "open-release-blocker"],
    ],
  );
  assert.deepEqual(Object.keys(releaseRegister.authority.browserEvidence), [
    "status",
    "path",
    "sha256",
    "evidenceId",
    "recordedAt",
    "deployedCommit",
    "workflowRunId",
    "workflowRunAttempt",
    "workflowRunUrl",
    "serviceJobId",
    "canonicalUrl",
    "apiWorkerDeploymentId",
    "apiWorkerVersion",
    "responsePolicyWorkerDeploymentId",
    "responsePolicyWorkerVersion",
    "deploymentEvidenceIndexSha256",
    "deploymentEvidenceBeforeCapturesSha256",
    "deploymentEvidenceAfterCapturesSha256",
    "siteArtifactSha256",
    "qualifiedSourceSetSha256",
    "deployedAt",
    "qualificationExpiresAt",
    "deploymentEvidenceCheckedBeforeCapturesAt",
    "deploymentEvidenceCheckedAfterCapturesAt",
    "deploymentEvidenceUnchangedAcrossCaptures",
  ]);
  assert.equal(releaseRegister.authority.browserEvidence.status, "not-collected");
  assert.ok(Object.values(releaseRegister.authority.browserEvidence).slice(1).every((value) => value === null));
  assert.ok(releaseRegister.authority.qualifiedSourceSet.files.includes(
    "docs/text-to-lattice/TEXT-TO-LATTICE-BROWSER-EVIDENCE.schema.json",
  ));
  assert.ok(releaseRegister.authority.qualifiedSourceSet.files.includes(
    "docs/text-to-lattice/TEXT-TO-LATTICE-BROWSER-EVIDENCE.template.json",
  ));
  for (const id of ["GATE-02", "GATE-03", "GATE-06"]) {
    const gate = releaseRegister.gates.find((candidate) => candidate.id === id);
    assert.equal(gate.historicalInactiveRecord.status, "historical-inactive");
    assert.deepEqual(gate.historicalInactiveRecord.appliesToFields, ["currentEvidence", "evidence"]);
    assert.match(gate.activeCurrentEvidence, /No retained production|have not been observed|remain unobserved|No canonical production/iu);
    assert.ok(gate.activeEvidence.length > 0);
    assert.doesNotMatch(`${gate.label} ${gate.requirement} ${gate.activeCurrentEvidence} ${gate.evidenceNeeded} ${gate.activeEvidence.join(" ")} ${gate.safeguards.join(" ")} ${gate.followUp} ${gate.rollbackCondition}`, /Turnstile|Siteverify|verify\.hah\.dev|WebGPU|WebLLM|\/api\/text-to-lattice\/lease|\blease\b|\battestation\b/iu);
  }
  assert.equal(atlas.historicalBrowserLocalSecurityModel.threats.length, 12);
  assert.equal(atlas.historicalBrowserLocalSecurityModel.prePublicationGates.length, 8);
});

test("the qualification dossier leads with the held remote decision and retains an inactive appendix", async () => {
  const dossier = await readText(sourceRoot, "TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md");
  assert.match(dossier, /^# Text to Lattice release qualification — held remote candidate/u);
  assert.match(dossier, /\*\*Decision:\*\* hold the interactive client; publish the method, implementation record, and documentation only\./u);
  assert.match(dossier, /Owner direction keeps the public client held until the active production blockers close; it is not deployment or runtime evidence\./u);
  assert.match(dossier, /Neither closes GATE-02, GATE-03, or GATE-06/u);
  assert.match(dossier, /same-origin `\/api\/lattice`[\s\S]{0,240}bodyless `POST \/api\/lattice`/u);
  assert.match(dossier, /application\/vnd\.hah\.text-to-lattice-visitor-session\.v1\+json/u);
  assert.match(dossier, /bodyless/u);
  assert.match(dossier, /same (?:origin-wide )?(?:browser )?Web Lock/iu);
  assert.match(dossier, /exactly one content-bearing/u);
  assert.match(dossier, /428 visitor_session_required[^.]*before (?:Durable Object )?admission or provider work/iu);
  assert.match(dossier, /HF_TOKEN/u);
  assert.match(dossier, /VISITOR_COOKIE_SECRET/u);
  assert.match(dossier, /__Secure-hah-lattice-api-visitor/u);
  assert.match(dossier, /30[^.]*globally per UTC day/iu);
  assert.match(dossier, /3[^.]*browser cookie jar per UTC day/iu);
  assert.match(dossier, /Hugging Face[\s\S]{0,300}Nscale[\s\S]{0,300}DeepInfra/iu);
  assert.match(dossier, /no automatic retry/iu);
  assert.match(dossier, /no alternate provider or model fallback/iu);
  assert.match(dossier, /provider-managed[\s\S]{0,240}not byte/iu);
  assert.match(dossier, /Historical inactive WebLLM and lease appendix/u);
  assert.match(dossier, /\*\*Qualification date:\*\* 2026-10-04/u);
  assert.match(dossier, /bounded qualification,[\s\S]{0,120}run #162[\s\S]{0,240}`be20fab7dbf312deef5ccc77997932f077b21f6e`/iu);
  assert.match(dossier, /exact tree `2a7130b71189bb790f84ff8809b51542b6baf056`[\s\S]{0,100}deployed source-set digest `7419de535c9d3b35b74a7455e11dad52073618403c874d33631759d04f119ca2`/u);
  assert.match(dossier, /deployed qualification-dossier digest `d642e6f1bd47b5cdd92a139ea1653f7fe931fc84f9558f5f427626b53ebb5663`/u);
  assert.match(dossier, /Run #162's bounded synthetic canary[\s\S]{0,160}2026-09-30T13:58:37\.984Z[\s\S]{0,260}terminal_failure=host-validation, stage=verification, attempt=2, validation=response-shape, prior_validation=response-shape, calls_used=5, batch_count=1, verification_passes=0, and finding_count=1/u);
  assert.match(dossier, /calls_used=5 is aggregate provider-call usage, not a failure-call ordinal or proof of unretained call outcomes/u);
  assert.match(dossier, /exact invalid private structure and whether rejection originated in decoding or host normalization were not retained/iu);
  assert.match(dossier, /69c38fbd-1cd0-4d72-911d-3bcd5b087962[\s\S]{0,100}7496d68f-29dd-4373-b078-0ab9b09942fa[\s\S]{0,80}2026-09-30T13:59:14\.894Z[\s\S]{0,30}3\/3 held samples/u);
  assert.match(dossier, /Run #162 closes none of GATE-02, GATE-03, or GATE-06/u);
  assert.match(dossier, /diagnostic extension, revision 7/iu);
  assert.match(dossier, /Qualification run #166[\s\S]{0,250}diagnostic revision 7 merged by PR #53/iu);
  assert.match(dossier, /provider-envelope rejection at initial verification before private-wire decoding/iu);
  assert.match(dossier, /retained no revision-7 host predicate code or first deterministic finding/iu);
  assert.match(dossier, /diagnostic extension, revision 8/iu);
  assert.match(dossier, /Qualification run #168[\s\S]{0,250}diagnostic revision 8 merged by PR #54/iu);
  assert.match(dossier, /rejection_rule=V01F, prior_rejection_boundary=wire-decoder, prior_rejection_category=coverage, prior_rejection_rule=V16M/u);
  assert.match(dossier, /first_deterministic_rule=D14/u);
  assert.match(dossier, /four readiness probes observed one active response followed by three consecutive held responses/iu);
  assert.match(dossier, /no retrospective exact-predicate or deterministic-finding evidence for run #164/iu);
  assert.match(dossier, /Codes permit bounded inference about static host predicates/iu);
  assert.match(dossier, /Initial verification supplied a valid semantic rejection and initiated repair/iu);
  assert.match(dossier, /Failed reverification discards the repaired candidate and restores the original candidate and review/iu);
  assert.match(dossier, /source-only until separately deployed and observed/iu);
  assert.doesNotMatch(dossier, /run #162[^\n]{0,200}(?:proves|establishes)[^\n]{0,100}(?:insufficient|budget is too small)/iu);
  assert.match(dossier, /preceding bounded qualification,[\s\S]{0,120}run #158[\s\S]{0,180}attempt 2[\s\S]{0,100}`66c34fd4775efa8de6cf35110f8d623f4418210f`/iu);
  assert.match(dossier, /bounded qualification,[\s\S]{0,120}run #160[\s\S]{0,280}`94fba0deb97748f3a91693a3bae15296b0ef3699`/iu);
  assert.match(dossier, /deployed source-set digest `d483b0124f2d7fb8c76cf028f8667b7ffb264299630b3cba7736f8cb8cac37a6`/u);
  assert.match(dossier, /881 tests: 865 passed, 16 expected tokenizer-fixture skips, and 0 failures/u);
  assert.match(dossier, /run #160 attempt 1[\s\S]{0,120}HTTP 502 upstream_unavailable[\s\S]{0,160}upstream_status=504[\s\S]{0,180}stage_attempt=initial[\s\S]{0,80}prior_validation=none/iu);
  assert.match(dossier, /run #160 attempt 2[\s\S]{0,600}post-candidate-withheld with batch_count=1, verification_passes=0, and finding_count=1/iu);
  assert.match(dossier, /retained summary does not identify the exact internal cause/iu);
  assert.match(dossier, /6118ad58-8448-4d10-b564-ecee5538e0b8[\s\S]{0,100}f24b2a69-a426-456e-99c5-cb1020f02e4a[\s\S]{0,80}2026-09-30T12:56:33\.469Z/u);
  assert.match(dossier, /The current qualification-only diagnostic extension, revision 8/iu);
  assert.match(dossier, /exact 65,536-byte boundary returned HTTP 400 invalid_request; 65,537 bytes returned HTTP 413 input_too_large/u);
  assert.match(dossier, /https:\/\/github\.com\/howardhayden\/folio\/actions\/runs\/36595292369/u);
  assert.match(dossier, /deployed source-set digest `2677c607d748582348930f1b90087e09455fff9773ce2eca203a4a7474ab7a8a`/u);
  assert.match(dossier, /run #158 attempt-2 synthetic canary[\s\S]{0,280}`call_ordinal=3`[\s\S]{0,100}`finish_reason=length`[\s\S]{0,220}`completion_tokens=2048-3071`/iu);
  assert.match(dossier, /run #158 length finish came from the predecessor private representation[\s\S]{0,160}operational failure evidence rather than a sizing input/iu);
  assert.match(dossier, /current closed representation is 1,326 tokens[\s\S]{0,200}unchanged 2,048-token verification ceiling/iu);
  assert.match(dossier, /722 tokens, or 54\.45 percent/iu);
  assert.match(dossier, /Certification remains capped at 520 tokens[\s\S]{0,160}maximum is 440 pinned-tokenizer tokens[\s\S]{0,80}80 tokens of margin/iu);
  assert.match(dossier, /correction merged by PR #50 and deployed by run #160 changes the private verifier and certifier representation/iu);
  assert.match(dossier, /output ceilings, timeouts, retries, admission, privacy, retention, and deployment topology remain unchanged/iu);
  assert.match(dossier, /source and pinned-tokenizer controls, not live evidence that the correction succeeds/iu);
  assert.match(dossier, /current correction keeps the 180-second verification ceiling and 2,048-token budget[\s\S]{0,240}closes no release gate until the required production qualification succeeds/iu);
  assert.match(dossier, /artifact ID `11046285940`[\s\S]{0,120}`3bbf85126def25c4e71436015ca1d0ffc8f5b2e0cc8f99dd50016891dfd949ae`/u);
  assert.match(dossier, /deployment-evidence artifact ID `11045708140`[\s\S]{0,120}`55c8523d0fa64ae76435c30923ff5b9dfe87520578c6ad63f96b7e211abd88a0`/u);
  assert.match(dossier, /held API version `1fce513a-1059-424e-8175-8553e3d5c88e`[\s\S]{0,100}`64231b70-01b4-4b3f-be63-a1aed0600f97`[\s\S]{0,200}artifact ID `11046432393`[\s\S]{0,120}`65983a6970b8ad8993ad4e47c3bf4b9c8b61adcaf7860655f87abedbaf0da6a2`/u);
  assert.match(dossier, /Attempt 1 did not reach the live request boundary or provider canary[\s\S]{0,180}inconclusive transport evidence/iu);
  assert.doesNotMatch(dossier, /run #158[^\n]{0,200}(?:proves|establishes)[^\n]{0,100}(?:insufficient|budget is too small)/iu);
  assert.match(dossier, /preceding bounded qualification,[\s\S]{0,120}run #156[\s\S]{0,180}predecessor-representation history/iu);
  assert.match(dossier, /0750ce7fde7d3a3d7dc5defd3a6dc23bb7367f70/u);
  assert.match(dossier, /b31ff7917d118bdc4d2dc3d7ca7364d547d4c296c0989b31cb91751b30d78577/u);
  assert.match(dossier, /1,536-token verification ceiling/iu);
  assert.match(dossier, /earlier bounded qualification,[\s\S]{0,100}run #154/iu);
  assert.match(dossier, /preceding bounded qualification,[\s\S]{0,100}run #152/iu);
  assert.match(dossier, /run #147[\s\S]{0,180}`43e70d05c1b5783ecf26f0b784541bfffa5217c1`[\s\S]{0,100}`5fca1bc272cfaf5ef16bce29f3c4d96d9ff741683aad3d6c24adf5c49a320b18`/iu);
  assert.ok(dossier.includes(`**Artifact-set projection SHA-256:** \`${digest(JSON.stringify(canonicalJson(releaseRegister.artifactSet)))}\``));
  assert.match(dossier, /workflow run 34325228788[\s\S]{0,300}9ab26b95cc1f9a94697118c0fc20a849db8f6ad2/u);
  assert.match(dossier, /266db6b8264a0aa42ac16916ddf696554c846b239960e7d19fc002917d843950/u);
});

test("Lattice documentation has one registered authority and byte-identical Markdown exports", async () => {
  assert.equal(atlas.format, "TEXT_TO_LATTICE_DOCUMENTATION_ATLAS");
  assert.equal(manifest.format, "TEXT_TO_LATTICE_DOCUMENTATION_ARTIFACT_MANIFEST");
  assert.equal(atlas.revision, manifest.revision);
  assert.equal(atlas.artifacts.length, 4);
  assert.equal(manifest.artifactPairs.length, 4);
  assert.equal(manifest.releaseEvidence.length, 3);
  assert.ok(
    atlas.conceptMap.edges.some(({ source, target }) => source === "LAT-N-000" && target === "LAT-N-002"),
    "the Lattice engine is connected to its typed-contract pipeline",
  );
  assert.ok(
    atlas.conceptMap.edges.some(({ source, target, label }) => (
      source === "LAT-N-021"
      && target === "LAT-N-000"
      && /without embedding the engine/iu.test(label)
    )),
    "the Text to Lattice relationship names its non-embedding boundary",
  );

  assert.deepEqual(
    projectDocuments.map(({ artifactId, title, scope, htmlUrl, markdownUrl }) => ({
      artifactId,
      title,
      scope,
      html: htmlUrl.split("/").at(-1),
      markdown: markdownUrl.split("/").at(-1),
    })),
    atlas.artifacts.map(({ id: artifactId, title, scope, html, markdown }) => ({
      artifactId, title, scope, html, markdown,
    })),
  );

  for (const pair of manifest.artifactPairs) {
    const [source, published] = await Promise.all([
      readBytes(rootUrl, pair.sourcePath),
      readBytes(rootUrl, pair.publicPath),
    ]);
    assert.deepEqual(published, source, `${pair.artifactId} public Markdown matches its source edition`);
    assert.equal(digest(source), pair.sha256, `${pair.artifactId} matches the artifact manifest`);
  }

  for (const evidence of manifest.releaseEvidence) {
    const [source, published] = await Promise.all([
      readBytes(sourceRoot, evidence.filename),
      readBytes(publicRoot, evidence.filename),
    ]);
    assert.deepEqual(published, source, `${evidence.filename} public evidence matches its canonical source`);
    assert.equal(digest(source), evidence.sha256);
  }

  const [canonical, publicCanonical, builder] = await Promise.all([
    readBytes(rootUrl, manifest.authority.canonicalSource),
    readBytes(publicRoot, "documentation-atlas.json"),
    readBytes(rootUrl, manifest.authority.builder),
  ]);
  assert.deepEqual(publicCanonical, canonical);
  assert.equal(digest(canonical), manifest.authority.canonicalSourceSha256);
  assert.equal(digest(builder), manifest.authority.builderSha256);
});

test("interactive editions remain complete, self-contained, accessible, and executable-free without JavaScript", async () => {
  const pages = [
    { filename: "index.html", markdown: null, ids: [] },
    { filename: atlas.artifacts[0].html, markdown: atlas.artifacts[0].markdown, ids: atlas.conceptMap.nodes.map(({ id }) => id) },
    { filename: atlas.artifacts[1].html, markdown: atlas.artifacts[1].markdown, ids: atlas.skillMap.capabilities.map(({ id }) => id) },
    {
      filename: atlas.artifacts[2].html,
      markdown: atlas.artifacts[2].markdown,
      ids: [
        ...atlas.serviceBlueprint.stages.map(({ id }) => id),
        ...atlas.serviceBlueprint.lifecycleOwners.map(({ id }) => id),
      ],
    },
    {
      filename: atlas.artifacts[3].html,
      markdown: atlas.artifacts[3].markdown,
      ids: [
        ...atlas.securityModel.threats.map(({ id }) => id),
        ...atlas.securityModel.prePublicationGates.map(({ id }) => id),
      ],
    },
  ];

  for (const { filename, markdown, ids } of pages) {
    const html = await readText(publicRoot, filename);
    assert.match(html, /^<!doctype html>\n<html lang="en">/u);
    assert.equal(occurrences(html, /<main\b/gu), 1, `${filename} has one main landmark`);
    assert.equal(occurrences(html, /<h1\b/gu), 1, `${filename} has one first-level heading`);
    assert.equal(occurrences(html, /rel="canonical"/gu), 1, `${filename} has one canonical URL`);
    assert.match(html, /<a class="skip-link" href="#main">/u);
    assert.match(html, /min-height: 44px/u);
    assert.match(html, /:focus-visible/u);
    assert.match(html, /prefers-reduced-motion/u);
    assert.match(html, /forced-colors/u);
    assert.match(html, /@media print/u);
    assert.match(html, /\.gate-satisfied-in-production/u);
    assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/iu);
    assert.doesNotMatch(html, /<link\b[^>]*rel="stylesheet"/iu);
    assert.doesNotMatch(html, /<(?:img|iframe|audio|video|source)\b[^>]*\bsrc="https?:/iu);
    assert.doesNotMatch(
      html,
      /@import|\.innerHTML|\bfetch\s*\(|\bXMLHttpRequest\b|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|\bWebSocket\b|\bEventSource\b|\bWebTransport\b/gu,
    );
    for (const id of ids) assert.ok(html.includes(id), `${filename} pre-renders ${id}`);

    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gu)].map((match) => match[1]);
    if (!markdown) {
      assert.equal(scripts.length, 0, "the index needs no script");
      assert.equal(occurrences(html, /rel="alternate" type="text\/markdown"/gu), 0);
      continue;
    }

    assert.equal(scripts.length, 1, `${filename} has one inline progressive enhancement`);
    assert.doesNotThrow(() => new vm.Script(scripts[0], { filename }));
    assert.equal(occurrences(html, /rel="alternate" type="text\/markdown"/gu), 1);
    assert.ok(html.includes(`href="https://hah.dev/documentation/text-to-lattice/${markdown}"`));
    for (const marker of [
      "data-interactive-register",
      "data-doc-search",
      "data-filter-key",
      "<details",
      'role="status"',
      'aria-live="polite"',
      "new Blob",
      "textContent",
      "document.createElement",
      "URL.revokeObjectURL",
      "non-authoritative view",
    ]) assert.ok(html.includes(marker), `${filename} includes ${marker}`);
  }

  const index = await readText(publicRoot, "index.html");
  assert.match(index, /held and documentation-only/iu);
  assert.match(index, /Required production qualification remains incomplete; current bounded evidence is recorded in the release register/u);
  assert.match(index, /Historical WebLLM, Turnstile, and lease records remain inactive/u);
  for (const { html, markdown } of atlas.artifacts) {
    assert.ok(index.includes(`href="${html}"`));
    assert.ok(index.includes(`href="${markdown}"`));
  }
  for (const filename of [
    "TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md",
    "TEXT-TO-LATTICE-RELEASE-REGISTER.json",
    "LLAMA-USE-EVALUATION-CASES.json",
  ]) assert.ok(index.includes(`href="${filename}"`));

  const [blueprintHtml, blueprintMarkdown, securityHtml, securityMarkdown] = await Promise.all([
    readText(publicRoot, "text-to-lattice-service-blueprint.html"),
    readText(sourceRoot, "TEXT-TO-LATTICE-SERVICE-BLUEPRINT.md"),
    readText(publicRoot, "text-to-lattice-security-model.html"),
    readText(sourceRoot, "TEXT-TO-LATTICE-SECURITY-MODEL.md"),
  ]);
  for (const artifact of [blueprintHtml, blueprintMarkdown]) {
    assert.match(artifact, /Backstage client\/server/u);
    assert.match(artifact, /POST \/api\/lattice/u);
    assert.match(artifact, /HF_TOKEN/u);
    assert.match(artifact, /Hugging Face, Nscale, and DeepInfra/u);
    assert.match(artifact, /no automatic retry/iu);
    assert.match(artifact, /no alternate provider or model fallback/iu);
    assert.doesNotMatch(artifact, /Backstage browser-local/u);
  }
  for (const artifact of [securityHtml, securityMarkdown]) {
    const activeIndex = artifact.indexOf("Current active evidence");
    const historicalIndex = artifact.indexOf("Historical inactive evidence");
    assert.ok(activeIndex >= 0 && historicalIndex > activeIndex, "active remote evidence renders before historical inactive evidence");
    assert.match(artifact, /same-origin POST \/api\/lattice/iu);
    assert.match(artifact, /Required production qualification remains incomplete; current bounded evidence is recorded in the release register/u);
    assert.match(artifact, /not byte-pinned/iu);
  }
});

test("the static site preserves every exported documentation byte", async () => {
  const filenames = (await readdir(publicRoot)).sort();
  assert.equal(filenames.length, 14);
  for (const filename of filenames) {
    const [published, staged] = await Promise.all([
      readBytes(publicRoot, filename),
      readBytes(siteRoot, filename),
    ]);
    assert.deepEqual(staged, published, `${filename} survives the public-to-site copy unchanged`);
  }
});
