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
const occurrences = (value, expression) => [...value.matchAll(expression)].length;

const [atlas, manifest, releaseRegister] = await Promise.all([
  readText(sourceRoot, "LATTICE-DOCUMENTATION-ATLAS.json").then(JSON.parse),
  readText(publicRoot, "artifact-manifest.json").then(JSON.parse),
  readText(sourceRoot, "TEXT-TO-LATTICE-RELEASE-REGISTER.json").then(JSON.parse),
]);

test("the documentation generator binds current remote evidence and preserves inactive browser-local evidence", async () => {
  const builder = await readText(rootUrl, "scripts/docs/build-text-to-lattice-documentation.mjs");
  assert.match(builder, /productionSatisfiedGateIds = new Set\(\["GATE-02", "GATE-03", "GATE-06"\]\)/u);
  assert.match(builder, /"historical-inactive"/u);
  assert.match(builder, /"historicalInactiveRecord",[\s\S]{0,100}"activeCurrentEvidence",[\s\S]{0,100}"activeEvidence"/u);
  assert.match(builder, /GATE-02 must bind the exact same-origin request, server-only secret, fixed Hugging Face and Featherless targets/u);
  assert.match(builder, /GATE-03 must keep the provider call, stage, response, limiter, cost, generic-proxy, retry, fallback/u);
  assert.match(builder, /GATE-06 must require one explicit canonical-browser remote lifecycle/u);
  assert.match(builder, /Current active evidence:[\s\S]{0,240}Historical inactive classification:/u);
  assert.match(builder, /no remote production evidence/u);
});

test("the atlas models the held remote capability without promoting historical evidence", async () => {
  assert.equal(atlas.revision, "2026-09-14");
  assert.equal(atlas.historicalBoundary.status, "inactive");
  assert.match(atlas.historicalBoundary.currentArchitecture, /same-origin POST to \/api\/lattice/iu);
  assert.match(atlas.historicalBoundary.evidencePolicy, /do not satisfy the current remote-service release gates/iu);

  const sources = new Map(atlas.sources.map((source) => [source.id, source]));
  assert.equal(sources.get("SRC-NETWORK-CAPABILITY").path, "app/privacy/networkCapabilities.js");
  assert.equal(sources.get("SRC-REMOTE-PROTOCOL").path, "app/resume/lattice/remoteProtocol.js");
  assert.equal(sources.get("SRC-REMOTE-CLIENT").path, "app/resume/lattice/remoteRequest.js");
  assert.equal(sources.get("SRC-API-WORKER").path, "workers/text-to-lattice-api/worker.js");
  assert.equal(sources.get("SRC-HF-ADAPTER").path, "workers/text-to-lattice-api/huggingFaceAdapter.js");
  for (const id of ["SRC-LOCAL-MODEL", "SRC-MODEL-WORKER", "SRC-ATTESTATION", "SRC-USAGE-LEASE", "SRC-LEASE-WORKER", "SRC-FRAME"]) {
    assert.match(sources.get(id).label, /^Historical inactive /u, `${id} remains available but inactive`);
  }

  const activeBlueprint = JSON.stringify(atlas.serviceBlueprint);
  for (const value of [
    "/api/lattice",
    "HF_TOKEN",
    "Qwen/Qwen3-4B:featherless-ai",
    "meta-llama/Llama-3.2-3B-Instruct:featherless-ai",
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
  for (const id of ["GATE-02", "GATE-03", "GATE-06"]) {
    const gate = releaseRegister.gates.find((candidate) => candidate.id === id);
    assert.equal(gate.historicalInactiveRecord.status, "historical-inactive");
    assert.deepEqual(gate.historicalInactiveRecord.appliesToFields, ["currentEvidence", "evidence"]);
    assert.match(gate.activeCurrentEvidence, /No retained production|have not been observed|No canonical production/iu);
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
  assert.match(dossier, /no remote production evidence/iu);
  assert.match(dossier, /same-origin `POST \/api\/lattice`/u);
  assert.match(dossier, /HF_TOKEN/u);
  assert.match(dossier, /Hugging Face[\s\S]{0,300}Featherless/iu);
  assert.match(dossier, /no automatic retry/iu);
  assert.match(dossier, /no alternate provider or model fallback/iu);
  assert.match(dossier, /provider-managed[\s\S]{0,240}not byte/iu);
  assert.match(dossier, /Historical inactive WebLLM and lease appendix/u);
  assert.match(dossier, /cb108f97625050ed64bdaf26767c1c9aaa947c21061c6603a9e6f83fbf97ee5f/u);
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
  assert.match(index, /no remote production evidence/iu);
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
    assert.match(artifact, /Hugging Face and Featherless/u);
    assert.match(artifact, /no automatic retry/iu);
    assert.match(artifact, /no alternate provider or model fallback/iu);
    assert.doesNotMatch(artifact, /Backstage browser-local/u);
  }
  for (const artifact of [securityHtml, securityMarkdown]) {
    const activeIndex = artifact.indexOf("Current active evidence");
    const historicalIndex = artifact.indexOf("Historical inactive evidence");
    assert.ok(activeIndex >= 0 && historicalIndex > activeIndex, "active remote evidence renders before historical inactive evidence");
    assert.match(artifact, /same-origin POST \/api\/lattice/iu);
    assert.match(artifact, /no remote production evidence/iu);
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
