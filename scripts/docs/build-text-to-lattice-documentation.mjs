#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), "../..");
const canonicalPath = join(
  projectRoot,
  "docs/text-to-lattice/LATTICE-DOCUMENTATION-ATLAS.json",
);
const releaseRegisterPath = join(
  projectRoot,
  "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json",
);
const sourceOutputRoot = join(projectRoot, "docs/text-to-lattice");
const publicOutputRoot = join(projectRoot, "public/documentation/text-to-lattice");
const publicBaseUrl = "https://hah.dev/documentation/text-to-lattice/";
const releaseEvidenceFilenames = Object.freeze([
  "LLAMA-USE-EVALUATION-CASES.json",
  "TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md",
  "TEXT-TO-LATTICE-RELEASE-REGISTER.json",
]);
const checkOnly = process.argv.slice(2).includes("--check");
const releaseGateStatuses = new Set([
  "satisfied-in-source",
  "satisfied-in-production",
  "release-workflow-enforced",
  "accepted-residual-risk",
  "post-deployment-verification",
  "open-release-blocker",
]);
const productionSatisfiedGateIds = new Set(["GATE-02"]);
const rollbackRequiredStatuses = new Set([
  "satisfied-in-production",
  "post-deployment-verification",
]);
const releaseGateProjectionFields = Object.freeze([
  "id",
  "label",
  "status",
  "marginalValue",
  "requirement",
  "currentEvidence",
  "evidenceNeeded",
  "rationale",
  "evidence",
  "safeguards",
  "followUp",
  "rollbackCondition",
  "acceptanceBasis",
]);

if (process.argv.length > 3 || process.argv.slice(2).some((argument) => argument !== "--check")) {
  throw new Error("Usage: node scripts/docs/build-text-to-lattice-documentation.mjs [--check]");
}

function fail(message) {
  throw new Error(`Text to Lattice documentation: ${message}`);
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(`${label} must be non-empty text.`);
  return value;
}

function requireArray(value, label, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) fail(`${label} must contain at least ${minimum} item(s).`);
  return value;
}

function uniqueById(values, label) {
  const observed = new Set();
  for (const value of requireArray(values, label)) {
    requireString(value?.id, `${label} ID`);
    if (observed.has(value.id)) fail(`${label} repeats ID ${value.id}.`);
    observed.add(value.id);
  }
  return observed;
}

function assertReferences(ids, available, label) {
  for (const id of requireArray(ids, label)) {
    if (!available.has(id)) fail(`${label} references unknown ID ${id}.`);
  }
}

function validateAtlas(data) {
  if (data?.format !== "TEXT_TO_LATTICE_DOCUMENTATION_ATLAS") fail("format is unsupported.");
  if (data?.schemaVersion !== 1) fail("schemaVersion must be 1.");
  requireString(data.revision, "revision");
  requireString(data.title, "title");
  if (data.authority?.canonicalSource !== "docs/text-to-lattice/LATTICE-DOCUMENTATION-ATLAS.json") {
    fail("authority.canonicalSource does not name the stable register path.");
  }
  if (data.authority?.builder !== "scripts/docs/build-text-to-lattice-documentation.mjs") {
    fail("authority.builder does not name this builder.");
  }
  for (const field of ["claimBoundary", "changePolicy", "marginalValuePolicy", "exportPolicy"]) {
    requireString(data.authority?.[field], `authority.${field}`);
  }

  const expectedArtifacts = new Map([
    ["DOC-CONCEPT", ["Lattice concept and ecosystem map", "lattice-concept-map.html", "LATTICE-CONCEPT-MAP.md", "method-and-ecosystem"]],
    ["DOC-SKILL", ["Lattice system skill map", "lattice-skill-map.html", "LATTICE-SKILL-MAP.md", "method"]],
    ["DOC-BLUEPRINT", ["Text to Lattice service blueprint", "text-to-lattice-service-blueprint.html", "TEXT-TO-LATTICE-SERVICE-BLUEPRINT.md", "wrapper"]],
    ["DOC-SECURITY", ["Text to Lattice security model", "text-to-lattice-security-model.html", "TEXT-TO-LATTICE-SECURITY-MODEL.md", "wrapper"]],
  ]);
  const artifactIds = uniqueById(data.artifacts, "artifacts");
  if (artifactIds.size !== expectedArtifacts.size) fail("artifacts must contain exactly the four published documents.");
  for (const artifact of data.artifacts) {
    const expected = expectedArtifacts.get(artifact.id);
    if (!expected) fail(`artifact ${artifact.id} is not published by this builder.`);
    const observed = [artifact.title, artifact.html, artifact.markdown, artifact.scope];
    if (observed.some((value, index) => value !== expected[index])) {
      fail(`artifact ${artifact.id} does not match its stable title, filenames, or scope.`);
    }
  }

  const sourceIds = uniqueById(data.sources, "sources");
  for (const source of data.sources) {
    const hasPath = typeof source.path === "string";
    const hasUrl = typeof source.url === "string";
    if (hasPath === hasUrl) fail(`source ${source.id} must provide exactly one path or URL.`);
    requireString(source.label, `source ${source.id} label`);
    if (hasPath) {
      const absolute = resolve(projectRoot, source.path);
      if (absolute !== projectRoot && !absolute.startsWith(`${projectRoot}${sep}`)) {
        fail(`source ${source.id} escapes the project root.`);
      }
      if (!existsSync(absolute)) fail(`source ${source.id} path does not exist: ${source.path}.`);
    } else {
      let url;
      try {
        url = new URL(source.url);
      } catch {
        fail(`source ${source.id} URL is invalid.`);
      }
      if (url.protocol !== "https:" || url.username || url.password) {
        fail(`source ${source.id} must use credential-free HTTPS.`);
      }
    }
  }

  const groupIds = uniqueById(data.conceptMap?.groups, "concept groups");
  const perspectiveIds = uniqueById(data.conceptMap?.perspectives, "concept perspectives");
  const relationKindIds = uniqueById(data.conceptMap?.relationKinds, "relation kinds");
  const nodeIds = uniqueById(data.conceptMap?.nodes, "concept nodes");
  uniqueById(data.conceptMap?.edges, "concept edges");
  for (const node of data.conceptMap.nodes) {
    if (!groupIds.has(node.group)) fail(`concept node ${node.id} has unknown group ${node.group}.`);
    assertReferences(node.perspectives, perspectiveIds, `concept node ${node.id} perspectives`);
    assertReferences(node.sourceIds, sourceIds, `concept node ${node.id} sources`);
    for (const field of ["label", "caption", "definition", "authority"]) {
      requireString(node[field], `concept node ${node.id} ${field}`);
    }
  }
  for (const edge of data.conceptMap.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) fail(`concept edge ${edge.id} has an unknown endpoint.`);
    if (edge.source === edge.target) fail(`concept edge ${edge.id} cannot relate a node to itself.`);
    if (!relationKindIds.has(edge.kind)) fail(`concept edge ${edge.id} has unknown kind ${edge.kind}.`);
    requireString(edge.label, `concept edge ${edge.id} label`);
  }

  const scale = requireArray(data.skillMap?.scale, "skill scale", 6);
  const scoreStatus = new Map(scale.map((entry) => [entry.score, entry.status]));
  if ([0, 1, 2, 3, 4, 5].some((score) => !scoreStatus.has(score))) {
    fail("skill scale must define every score from 0 through 5.");
  }
  if (new Set(scale.map((entry) => entry.status)).size !== scale.length) fail("skill scale statuses must be unique.");
  requireString(data.skillMap.methodNote, "skill map method note");
  if (!/never rates a person/iu.test(data.skillMap.methodNote)) fail("skill map must reject human proficiency scoring explicitly.");
  uniqueById(data.skillMap.capabilities, "skill capabilities");
  for (const capability of data.skillMap.capabilities) {
    if (!Number.isInteger(capability.score) || capability.score < 0 || capability.score > 5) {
      fail(`capability ${capability.id} has an invalid score.`);
    }
    if (scoreStatus.get(capability.score) !== capability.status) {
      fail(`capability ${capability.id} status does not match its evidence score.`);
    }
    if (capability.score === 5) fail(`capability ${capability.id} claims external validation without external evidence.`);
    for (const field of ["label", "group", "definition", "evidence", "openBoundary"]) {
      requireString(capability[field], `capability ${capability.id} ${field}`);
    }
    assertReferences(capability.sourceIds, sourceIds, `capability ${capability.id} sources`);
    if (capability.sourceIds.some((id) => !id.startsWith("SRC-LAT-"))) {
      fail(`capability ${capability.id} must be evidenced only by the reviewed upstream Lattice revision.`);
    }
  }

  for (const field of ["scenario", "actor", "goal", "methodNote"]) {
    requireString(data.serviceBlueprint?.[field], `serviceBlueprint.${field}`);
  }
  uniqueById(data.serviceBlueprint.lines, "blueprint lines");
  if (data.serviceBlueprint.lines.length !== 4) fail("service blueprint must define four accountability lines.");
  const layerIds = uniqueById(data.serviceBlueprint.layers, "blueprint layers");
  const stageIds = uniqueById(data.serviceBlueprint.stages, "blueprint stages");
  if (stageIds.size !== 8) fail("service blueprint must contain exactly eight lifecycle stages.");
  for (const stage of data.serviceBlueprint.stages) {
    requireString(stage.phase, `blueprint stage ${stage.id} phase`);
    for (const layerId of layerIds) requireString(stage[layerId], `blueprint stage ${stage.id} ${layerId}`);
    requireString(stage.failure, `blueprint stage ${stage.id} failure`);
    requireString(stage.recovery, `blueprint stage ${stage.id} recovery`);
  }
  uniqueById(data.serviceBlueprint.lifecycleOwners, "lifecycle owners");
  if (data.serviceBlueprint.lifecycleOwners.length !== 8) fail("service blueprint must contain eight accountable ownership surfaces.");
  for (const owner of data.serviceBlueprint.lifecycleOwners) {
    for (const field of ["surface", "accountableOwner", "responsibility", "handoffEvidence"]) {
      requireString(owner[field], `lifecycle owner ${owner.id} ${field}`);
    }
    if (/^(?:Cloudflare|Hugging Face|GitHub)$/iu.test(owner.accountableOwner)) {
      fail(`lifecycle owner ${owner.id} makes an external provider accountable.`);
    }
    assertReferences(owner.sourceIds, sourceIds, `lifecycle owner ${owner.id} sources`);
  }

  requireString(data.securityModel?.scope, "security model scope");
  requireString(data.securityModel?.method, "security model method");
  const assetIds = uniqueById(data.securityModel.assets, "security assets");
  const boundaryIds = uniqueById(data.securityModel.trustBoundaries, "trust boundaries");
  const threatIds = uniqueById(data.securityModel.threats, "security threats");
  const expectedThreatIds = Array.from({ length: 12 }, (_, index) => `SEC-${String(index + 1).padStart(2, "0")}`);
  if (expectedThreatIds.some((id) => !threatIds.has(id)) || threatIds.size !== expectedThreatIds.length) {
    fail("security model must contain SEC-01 through SEC-12 exactly once.");
  }
  const marginalValues = new Set(["high", "moderate", "low", "negative"]);
  for (const threat of data.securityModel.threats) {
    assertReferences(threat.boundaryIds, boundaryIds, `threat ${threat.id} boundaries`);
    assertReferences(threat.assetIds, assetIds, `threat ${threat.id} assets`);
    assertReferences(threat.sourceIds, sourceIds, `threat ${threat.id} sources`);
    if (!marginalValues.has(threat.marginalValue)) fail(`threat ${threat.id} has unknown marginal value.`);
    for (const field of ["title", "vector", "consequence", "plausibility", "lifecycleValue", "classificationRationale"]) {
      requireString(threat[field], `threat ${threat.id} ${field}`);
    }
    for (const field of ["asBuilt", "requiredBeforePublication", "residualBoundary"]) {
      requireArray(threat[field], `threat ${threat.id} ${field}`).forEach((item, index) => {
        requireString(item, `threat ${threat.id} ${field}[${index}]`);
      });
    }
  }
  uniqueById(data.securityModel.prePublicationGates, "release qualification gates");
  for (const gate of data.securityModel.prePublicationGates) {
    if (!releaseGateStatuses.has(gate.status)) {
      fail(`release gate ${gate.id} has an unsupported status.`);
    }
    if (gate.status === "satisfied-in-production" && !productionSatisfiedGateIds.has(gate.id)) {
      fail(`release gate ${gate.id} cannot use satisfied-in-production status.`);
    }
    if (gate.id === "GATE-02" && !["open-release-blocker", "satisfied-in-production"].includes(gate.status)) {
      fail("release gate GATE-02 must remain an open release blocker until it is satisfied in production.");
    }
    if (!marginalValues.has(gate.marginalValue)) {
      fail(`release gate ${gate.id} has unknown marginal value.`);
    }
    for (const field of ["label", "requirement", "currentEvidence", "evidenceNeeded", "rationale", "followUp"]) {
      requireString(gate[field], `release gate ${gate.id} ${field}`);
    }
    requireArray(gate.evidence, `release gate ${gate.id} evidence`).forEach((item, index) => {
      requireString(item, `release gate ${gate.id} evidence[${index}]`);
    });
    requireArray(gate.safeguards, `release gate ${gate.id} safeguards`).forEach((item, index) => {
      requireString(item, `release gate ${gate.id} safeguards[${index}]`);
    });
    if (rollbackRequiredStatuses.has(gate.status)) {
      requireString(gate.rollbackCondition, `release gate ${gate.id} rollbackCondition`);
    } else if (gate.rollbackCondition !== null) {
      fail(`release gate ${gate.id} rollbackCondition must be null outside rollback-bearing statuses.`);
    }
    if (gate.status === "accepted-residual-risk") {
      requireString(gate.acceptanceBasis, `release gate ${gate.id} acceptanceBasis`);
    } else if (gate.acceptanceBasis !== null) {
      fail(`release gate ${gate.id} acceptanceBasis must be null outside accepted residual risk.`);
    }
  }
  requireArray(data.securityModel.honestResidualBoundary, "honest residual boundary");
}

function validateReleaseGateProjection(data, releaseRegister) {
  if (releaseRegister?.format !== "TEXT_TO_LATTICE_RELEASE_REGISTER" || releaseRegister?.schemaVersion !== 1) {
    fail("release register format is unsupported.");
  }
  const projection = releaseRegister.gates?.map((gate) => Object.fromEntries(releaseGateProjectionFields.map((field) => [field, gate[field]])));
  if (JSON.stringify(data.securityModel.prePublicationGates) !== JSON.stringify(projection)) {
    fail("release qualification gates must be the exact ordered projection of the machine release register.");
  }
  if (!Array.isArray(releaseRegister.statusVocabulary)
    || releaseRegister.statusVocabulary.length !== releaseGateStatuses.size
    || [...releaseGateStatuses].some((status) => !releaseRegister.statusVocabulary.includes(status))) {
    fail("release register statusVocabulary does not match the documentation gate vocabulary.");
  }
  const hasOpenBlocker = releaseRegister.gates.some(({ status }) => status === "open-release-blocker");
  const enabled = releaseRegister.overallStatus === "qualified"
    && releaseRegister.publicClient?.status === "enabled"
    && releaseRegister.publicClient?.publicationMode === "interactive-client";
  const held = releaseRegister.overallStatus === "held"
    && releaseRegister.publicClient?.status === "held"
    && releaseRegister.publicClient?.publicationMode === "documentation-only";
  if ((hasOpenBlocker && !held) || (!hasOpenBlocker && !enabled)) {
    fail("release register must be held exactly while an open release blocker remains.");
  }
}

async function validateProjectDocumentRegistry(data) {
  const registryPath = join(projectRoot, "app/content/projectDocuments.js");
  if (!existsSync(registryPath)) return;
  const moduleUrl = `${pathToFileURL(registryPath).href}?documentation-revision=${encodeURIComponent(data.revision)}`;
  const { projectDocuments } = await import(moduleUrl);
  if (!Array.isArray(projectDocuments)) fail("project document registry does not export projectDocuments.");
  const latticeDocuments = projectDocuments.filter((document) => document.projectId === "lattice");
  if (latticeDocuments.length !== data.artifacts.length) fail("project document registry must expose the four Lattice artifacts exactly once.");
  for (const artifact of data.artifacts) {
    const document = latticeDocuments.find((entry) => entry.artifactId === artifact.id);
    if (!document) fail(`project document registry omits ${artifact.id}.`);
    const htmlName = new URL(document.htmlUrl).pathname.split("/").at(-1);
    const markdownName = new URL(document.markdownUrl).pathname.split("/").at(-1);
    if (document.title !== artifact.title || document.scope !== artifact.scope || htmlName !== artifact.html || markdownName !== artifact.markdown) {
      fail(`project document registry entry ${artifact.id} disagrees with the authoritative atlas.`);
    }
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function markdownCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function humanLabel(value) {
  return value.replaceAll("-", " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function sourceMapFor(data) {
  return new Map(data.sources.map((source) => [source.id, source]));
}

function markdownSourceRegister(data) {
  return [
    "## Source register",
    "",
    ...data.sources.flatMap((source) => [
      `- **${source.id} — ${source.label}:** ${source.url ? `[Reviewed source](${source.url})` : `\`${source.path}\``}`,
    ]),
    "",
  ];
}

function markdownFrontmatter(data, title) {
  return [
    "---",
    `title: ${title}`,
    `revision: ${data.revision}`,
    `authority: ${data.authority.canonicalSource}`,
    `generator: ${data.authority.builder}`,
    "---",
    "",
    "<!-- Generated file. Edit the authoritative JSON register, then run the builder. -->",
    "",
  ];
}

function markdownAuthority(data) {
  return [
    "## Authority and claim boundary",
    "",
    data.authority.claimBoundary,
    "",
    data.authority.changePolicy,
    "",
    data.authority.exportPolicy,
    "",
  ];
}

const commonCss = `
:root {
  color-scheme: light;
  --ink: #20231f;
  --muted: #5f655f;
  --paper: #ffffff;
  --field: #f7faf5;
  --green: #0b4705;
  --green-soft: #e8f1e5;
  --red: #950f22;
  --red-soft: #f8e9ec;
  --amber: #7a4f00;
  --blue: #075b78;
  --line: #cfd6cd;
  --focus: #077995;
  font-family: "Jost", "Avenir Next", Avenir, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
html { background: var(--paper); color: var(--ink); scroll-behavior: smooth; }
body { margin: 0; min-width: 280px; background: linear-gradient(180deg, var(--field), var(--paper) 22rem); line-height: 1.62; }
a { color: var(--green); text-underline-offset: .18em; }
a:hover { color: var(--red); text-decoration-thickness: .14em; }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible, [tabindex]:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}
.skip-link { position: absolute; z-index: 20; left: 1rem; top: -6rem; padding: .75rem 1rem; background: var(--ink); color: white; border-radius: .25rem; }
.skip-link:focus { top: 1rem; }
.site-header { padding: clamp(2.4rem, 7vw, 5.6rem) max(1rem, calc((100vw - 76rem) / 2)); border-bottom: 1px solid var(--line); background: rgba(255, 255, 255, .92); }
.eyebrow, .identifier { color: var(--red); font: 700 .76rem/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .11em; text-transform: uppercase; }
h1, h2, h3 { line-height: 1.16; text-wrap: balance; }
h1 { max-width: 20ch; margin: 0; color: var(--green); font-size: clamp(2.25rem, 6vw, 5.4rem); font-weight: 500; letter-spacing: -.04em; }
h2 { color: var(--green); font-size: clamp(1.5rem, 3vw, 2.15rem); }
h3 { color: var(--ink); }
.lede { max-width: 75ch; margin: 1.25rem 0 0; color: var(--muted); font-size: clamp(1rem, 2vw, 1.22rem); }
.doc-nav, .link-row, .button-row { display: flex; flex-wrap: wrap; gap: .65rem; margin-top: 1.4rem; }
.doc-nav a, .button-link, .link-row a { display: inline-flex; align-items: center; min-height: 44px; padding: .55rem .85rem; border: 1px solid var(--line); border-radius: 999px; background: white; text-decoration: none; }
.doc-nav a[aria-current="page"] { border-color: var(--red); color: var(--red); }
main { width: min(76rem, calc(100% - 2rem)); margin: 0 auto; padding: 2.2rem 0 5rem; }
.panel { margin: 0 0 1.35rem; padding: clamp(1rem, 3vw, 1.65rem); border: 1px solid var(--line); border-radius: .2rem; background: rgba(255, 255, 255, .96); }
.panel > :first-child { margin-top: 0; }
.boundary { border-left: .25rem solid var(--red); }
.method-note { border-left: .25rem solid var(--green); background: var(--green-soft); }
.method-note strong { color: var(--green); }
.toolbar { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)); gap: .8rem; align-items: end; margin: 1rem 0; padding: 1rem; border: 1px solid var(--line); background: var(--field); }
.toolbar label { display: block; color: var(--green); font-weight: 650; }
.toolbar input, .toolbar select, .toolbar button { min-height: 44px; width: 100%; margin-top: .3rem; border: 1px solid var(--line); border-radius: .2rem; background: white; color: var(--ink); font: inherit; }
.toolbar input, .toolbar select { padding: .55rem .65rem; }
.toolbar button { padding: .55rem .75rem; cursor: pointer; }
.toolbar button:hover { border-color: var(--red); color: var(--red); }
.status-line { min-height: 1.55em; margin: .5rem 0; color: var(--green); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.record-grid, .index-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 21rem), 1fr)); gap: 1rem; }
.record, .index-card { min-width: 0; border: 1px solid var(--line); border-top: .2rem solid var(--green); background: white; }
.record[hidden] { display: none !important; }
.record details { height: 100%; }
.record summary { min-height: 44px; padding: 1rem; cursor: pointer; }
.record summary::marker { color: var(--red); }
.record-title { display: inline; font-weight: 700; }
.record-body { padding: 0 1rem 1rem; border-top: 1px solid var(--line); }
.record-body dl { margin: .75rem 0 0; }
.record-body dt { margin-top: .65rem; color: var(--green); font-weight: 700; }
.record-body dd { margin: .1rem 0 0; }
.tag { display: inline-block; margin: .15rem .2rem .15rem 0; padding: .12rem .45rem; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font: 650 .73rem/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; }
.table-wrap, .radar-wrap { max-width: 100%; overflow: auto; border: 1px solid var(--line); background: white; overscroll-behavior: contain; }
table { width: 100%; min-width: 48rem; border-collapse: collapse; }
caption { padding: .9rem; color: var(--red); font-weight: 700; text-align: left; }
th, td { padding: .72rem; border-top: 1px solid var(--line); vertical-align: top; text-align: left; }
thead th { background: var(--green-soft); color: var(--green); }
tbody th { color: var(--red); }
.relation-table { min-width: 60rem; }
.blueprint-table { min-width: 94rem; }
.source-list { padding-left: 1.25rem; }
.source-list code { overflow-wrap: anywhere; }
.index-card { padding: 1rem; border-top-color: var(--red); }
.index-card h2 { margin: .25rem 0 .6rem; font-size: 1.45rem; }
.radar-wrap svg { display: block; width: min(100%, 46rem); min-width: 40rem; height: auto; margin: auto; }
.radar-ring, .radar-axis { fill: none; stroke: var(--line); stroke-width: 1; }
.radar-shape { fill: rgba(11, 71, 5, .14); stroke: var(--green); stroke-width: 3; }
.radar-point { fill: var(--red); stroke: white; stroke-width: 2; }
.radar-label { fill: var(--ink); font: 700 12px ui-monospace, SFMono-Regular, Consolas, monospace; }
.score { color: var(--red); font-weight: 750; }
.overview-wrap { max-width: 100%; overflow: auto; border: 1px solid var(--line); background: var(--field); }
.overview-wrap svg { display: block; width: min(100%, 52rem); min-width: 38rem; height: auto; margin: auto; }
.overview-line { fill: none; stroke: var(--green); stroke-width: 2; marker-end: url(#overview-arrow); }
.overview-branch { stroke: var(--red); stroke-dasharray: 6 5; }
.overview-node { fill: white; stroke: var(--green); stroke-width: 2; rx: 4; }
.overview-node-branch { stroke: var(--red); }
.overview-title { fill: var(--green); font: 700 16px "Jost", "Avenir Next", sans-serif; }
.overview-caption { fill: var(--ink); font: 12px "Jost", "Avenir Next", sans-serif; }
.boundary-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: .7rem; padding: 0; list-style: none; }
.boundary-list li { padding: 1rem; border: 1px solid var(--line); border-left: .25rem solid var(--red); background: var(--field); }
.classification-high { border-top-color: var(--red); }
.classification-moderate { border-top-color: #9a6500; }
.gate-open-release-blocker { border-left: .25rem solid var(--red); }
.gate-post-deployment-verification { border-left: .25rem solid var(--amber); }
.gate-accepted-residual-risk { border-left: .25rem solid var(--blue); }
.gate-release-workflow-enforced,
.gate-satisfied-in-production,
.gate-satisfied-in-source { border-left: .25rem solid var(--green); }
.no-script { color: var(--muted); }
.js .no-script { display: none; }
.site-footer { padding: 1.5rem max(1rem, calc((100vw - 76rem) / 2)); border-top: 1px solid var(--line); color: var(--muted); }
.sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }
@media (max-width: 42rem) { main { width: min(100% - 1rem, 76rem); } .toolbar { grid-template-columns: 1fr; } .panel { padding: 1rem; } }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { animation: none !important; transition: none !important; } }
@media (forced-colors: active) { * { box-shadow: none !important; } .panel, .record, .index-card, .toolbar, .table-wrap, .radar-wrap, .overview-wrap, .boundary-list li { border-color: CanvasText; } .radar-ring, .radar-axis, .radar-shape, .overview-line, .overview-node { stroke: CanvasText; } .radar-shape, .overview-node { fill: Canvas; } .radar-point { fill: CanvasText; stroke: Canvas; } .overview-title, .overview-caption { fill: CanvasText; } }
@media print { html, body, .site-header, .panel, .record, .index-card { background: white; color: #111; } .doc-nav, .toolbar, .skip-link, .button-row, .no-script { display: none !important; } main { width: 100%; } .record-grid, .index-grid { display: block; } .record, .index-card { break-inside: avoid; margin-bottom: .8rem; } details, details:not([open]) > :not(summary) { display: block !important; } .table-wrap, .radar-wrap, .overview-wrap { overflow: visible; } table { min-width: 0; font-size: 8pt; } a { color: #111; } }
`;

const interactionScript = `
(function () {
  document.documentElement.classList.add("js");
  var root = document.querySelector("[data-interactive-register]");
  if (!root) return;
  var records = Array.from(root.querySelectorAll("[data-record]"));
  var search = root.querySelector("[data-doc-search]");
  var filters = Array.from(root.querySelectorAll("[data-filter-key]"));
  var status = root.querySelector("[data-doc-status]");
  var normalize = function (value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase("und");
  };
  var apply = function () {
    var query = normalize(search && search.value).trim();
    var count = 0;
    records.forEach(function (record) {
      var matchesSearch = !query || normalize(record.textContent).indexOf(query) !== -1;
      var matchesFilters = filters.every(function (filter) {
        var selected = filter.value;
        if (!selected) return true;
        var values = String(record.dataset[filter.dataset.filterKey] || "").split(" ");
        return values.indexOf(selected) !== -1;
      });
      record.hidden = !(matchesSearch && matchesFilters);
      if (!record.hidden) count += 1;
    });
    if (status) status.textContent = count + " of " + records.length + " records visible.";
  };
  if (search) search.addEventListener("input", apply);
  filters.forEach(function (filter) { filter.addEventListener("change", apply); });
  var reset = root.querySelector("[data-reset]");
  if (reset) reset.addEventListener("click", function () {
    if (search) search.value = "";
    filters.forEach(function (filter) { filter.value = ""; });
    apply();
    if (search) search.focus();
  });
  var setExpanded = function (expanded) {
    records.forEach(function (record) {
      if (record.hidden) return;
      record.querySelectorAll("details").forEach(function (detail) { detail.open = expanded; });
    });
  };
  var expand = root.querySelector("[data-expand]");
  var collapse = root.querySelector("[data-collapse]");
  if (expand) expand.addEventListener("click", function () { setExpanded(true); });
  if (collapse) collapse.addEventListener("click", function () { setExpanded(false); });
  var download = root.querySelector("[data-download-visible]");
  if (download) download.addEventListener("click", function () {
    var lines = ["# " + root.dataset.exportTitle + " — visible view", "", "> Non-authoritative filtered projection. The complete Markdown and JSON register govern.", ""];
    records.forEach(function (record) {
      if (record.hidden) return;
      var title = record.querySelector("[data-record-title]");
      var body = record.querySelector("[data-record-body]");
      lines.push("## " + (title ? title.textContent.trim() : "Record"), "");
      if (body) lines.push(body.textContent.replace(/\\s+/g, " ").trim(), "");
    });
    var objectUrl = URL.createObjectURL(new Blob([lines.join("\\n")], { type: "text/markdown;charset=utf-8" }));
    var link = document.createElement("a");
    link.href = objectUrl;
    link.download = root.dataset.exportFilename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 0);
    if (status) status.textContent = "Downloaded " + lines.length + " lines from the visible, non-authoritative view.";
  });
  apply();
}());
`;

function navigation(current) {
  const items = [
    ["index", "index.html", "Documentation"],
    ["concept", "lattice-concept-map.html", "Concept map"],
    ["skill", "lattice-skill-map.html", "System skill map"],
    ["blueprint", "text-to-lattice-service-blueprint.html", "Service blueprint"],
    ["security", "text-to-lattice-security-model.html", "Security model"],
  ];
  return items.map(([id, href, label]) => `<a href="${href}"${id === current ? ' aria-current="page"' : ""}>${label}</a>`).join("");
}

function htmlPage(data, { title, description, current, content, interactive = true }) {
  const pageFiles = new Map([
    ["index", ["index.html", null]],
    ["concept", ["lattice-concept-map.html", "LATTICE-CONCEPT-MAP.md"]],
    ["skill", ["lattice-skill-map.html", "LATTICE-SKILL-MAP.md"]],
    ["blueprint", ["text-to-lattice-service-blueprint.html", "TEXT-TO-LATTICE-SERVICE-BLUEPRINT.md"]],
    ["security", ["text-to-lattice-security-model.html", "TEXT-TO-LATTICE-SECURITY-MODEL.md"]],
  ]);
  const [htmlFilename, markdownFilename] = pageFiles.get(current) ?? fail(`unknown HTML page kind ${current}.`);
  const alternate = markdownFilename
    ? `<link rel="alternate" type="text/markdown" href="${publicBaseUrl}${markdownFilename}">\n`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${escapeHtml(description)}">
<meta name="theme-color" content="#ffffff">
<meta name="generator" content="${escapeHtml(data.authority.builder)}">
<link rel="canonical" href="${publicBaseUrl}${htmlFilename}">
${alternate}<title>${escapeHtml(title)} · Lattice documentation</title>
<style>${commonCss}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to documentation</a>
<header class="site-header">
  <p class="eyebrow">Lattice technical record · revision ${escapeHtml(data.revision)}</p>
  <h1>${escapeHtml(title)}</h1>
  <p class="lede">${escapeHtml(description)}</p>
  <nav class="doc-nav" aria-label="Lattice documentation navigation">${navigation(current)}</nav>
</header>
<main id="main">${content}</main>
<footer class="site-footer"><p>One authoritative register · deterministic Markdown and HTML · authored documentation follows hah.dev portfolio-content terms · executable shell retains source-component terms · the separately licensed RSR profile is not reproduced</p></footer>
${interactive ? `<script>${interactionScript}</script>` : ""}
</body>
</html>
`;
}

function htmlSources(data, sourceIds = data.sources.map((source) => source.id)) {
  const sources = sourceMapFor(data);
  const items = sourceIds.map((id) => sources.get(id)).filter(Boolean).map((source) => (
    source.url
      ? `<li><strong>${escapeHtml(source.id)} — ${escapeHtml(source.label)}:</strong> <a href="${escapeHtml(source.url)}">Reviewed source</a></li>`
      : `<li><strong>${escapeHtml(source.id)} — ${escapeHtml(source.label)}:</strong> <code>${escapeHtml(source.path)}</code></li>`
  )).join("");
  return `<section class="panel" aria-labelledby="sources-heading"><h2 id="sources-heading">Source register</h2><ul class="source-list">${items}</ul></section>`;
}

function htmlAuthority(data) {
  return `<section class="panel boundary" aria-labelledby="authority-heading">
  <p class="eyebrow">Claim boundary</p>
  <h2 id="authority-heading">Authority stays typed</h2>
  <p>${escapeHtml(data.authority.claimBoundary)}</p>
  <p>${escapeHtml(data.authority.changePolicy)}</p>
  <p>${escapeHtml(data.authority.exportPolicy)}</p>
</section>`;
}

function htmlToolbar({ searchLabel, filters = [], statusLabel, exportTitle, exportFilename }) {
  const filterHtml = filters.map((filter) => `<label>${escapeHtml(filter.label)}
    <select data-filter-key="${escapeHtml(filter.key)}">
      <option value="">${escapeHtml(filter.allLabel)}</option>
      ${filter.options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("")}
    </select>
  </label>`).join("");
  return `<section class="panel" data-interactive-register data-export-title="${escapeHtml(exportTitle)}" data-export-filename="${escapeHtml(exportFilename)}" aria-labelledby="explore-heading">
  <h2 id="explore-heading">Explore this register</h2>
  <p class="no-script">The complete register follows. Search, filters, expansion controls, and local Markdown export require JavaScript; no content does.</p>
  <div class="toolbar">
    <label>${escapeHtml(searchLabel)}<input type="search" data-doc-search autocomplete="off"></label>
    ${filterHtml}
    <label>View controls<span class="sr-only"> for visible records</span><button type="button" data-reset>Reset filters</button></label>
    <label>Disclosure controls<button type="button" data-expand>Expand visible</button></label>
    <label>Disclosure controls<button type="button" data-collapse>Collapse visible</button></label>
    <label>Local export<button type="button" data-download-visible>Download visible Markdown</button></label>
  </div>
  <p class="status-line" data-doc-status role="status" aria-live="polite" aria-label="${escapeHtml(statusLabel)}"></p>`;
}

function markdownTerms() {
  return [
    "## Terms and provenance",
    "",
    "Authored documentation follows the hah.dev portfolio-content terms. The generator and executable documentation shell retain the applicable source-component terms. The separately licensed Relational Systems Register profile is not reproduced.",
    "",
  ];
}

function htmlTerms() {
  return `<section class="panel" aria-labelledby="terms-heading"><h2 id="terms-heading">Terms and provenance</h2><p>Authored documentation follows the hah.dev portfolio-content terms. The generator and executable documentation shell retain the applicable source-component terms. The separately licensed Relational Systems Register profile is not reproduced.</p></section>`;
}

function htmlTags(values) {
  return values.map((value) => `<span class="tag">${escapeHtml(value)}</span>`).join("");
}

function conceptMarkdown(data) {
  const map = data.conceptMap;
  const groups = new Map(map.groups.map((group) => [group.id, group]));
  const incoming = new Map(map.nodes.map((node) => [node.id, []]));
  const outgoing = new Map(map.nodes.map((node) => [node.id, []]));
  for (const edge of map.edges) {
    outgoing.get(edge.source).push(edge);
    incoming.get(edge.target).push(edge);
  }
  const mermaidId = (id) => id.replaceAll("-", "");
  const mermaidLines = ["```mermaid", "flowchart TB"];
  for (const group of map.groups) {
    mermaidLines.push(`  subgraph ${group.id}["${group.label.replaceAll('"', "'")}"]`, "    direction TB");
    for (const node of map.nodes.filter((entry) => entry.group === group.id)) {
      mermaidLines.push(`    ${mermaidId(node.id)}["${node.label.replaceAll('"', "'")}<br/>${node.caption.replaceAll('"', "'")}"]`);
    }
    mermaidLines.push("  end");
  }
  for (const edge of map.edges) {
    mermaidLines.push(`  ${mermaidId(edge.source)} -->|"${edge.label.replaceAll('"', "'")}"| ${mermaidId(edge.target)}`);
  }
  mermaidLines.push("```", "");

  const lines = [
    ...markdownFrontmatter(data, "Lattice concept and ecosystem map"),
    "# Lattice concept and ecosystem map",
    "",
    map.description,
    "",
    `[Open the interactive HTML edition](${publicBaseUrl}lattice-concept-map.html) · [Download complete Markdown](${publicBaseUrl}LATTICE-CONCEPT-MAP.md) · [Download the machine-readable register](${publicBaseUrl}documentation-atlas.json) · [Inspect the artifact manifest](${publicBaseUrl}artifact-manifest.json)`,
    "",
    ...markdownAuthority(data),
    "## Typed map",
    "",
    "The diagram is a reading surface. The concept register and complete relation table below are the canonical text equivalent; visual proximity carries no authority.",
    "",
    ...mermaidLines,
    "## Concept register",
    "",
  ];
  for (const group of map.groups) {
    lines.push(`### ${group.label}`, "", group.description, "");
    for (const node of map.nodes.filter((entry) => entry.group === group.id)) {
      const relations = [
        ...incoming.get(node.id).map((edge) => `${edge.source} → ${edge.label} → ${node.id} (${edge.id})`),
        ...outgoing.get(node.id).map((edge) => `${node.id} → ${edge.label} → ${edge.target} (${edge.id})`),
      ];
      lines.push(
        `<details id="${node.id.toLowerCase()}">`,
        `<summary><strong>${node.id}</strong> · ${node.label} — ${node.caption}</summary>`,
        "",
        node.definition,
        "",
        `- **Group:** ${groups.get(node.group).label}`,
        `- **Authority:** ${node.authority}`,
        `- **Perspectives:** ${node.perspectives.join(", ")}`,
        `- **Sources:** ${node.sourceIds.join(", ")}`,
        `- **Typed relations:** ${relations.length ? relations.join("; ") : "None"}`,
        "",
        "</details>",
        "",
      );
    }
  }
  lines.push(
    "## Complete relation register",
    "",
    "| ID | Source | Relation | Target | Kind |",
    "| --- | --- | --- | --- | --- |",
    ...map.edges.map((edge) => `| ${edge.id} | ${edge.source} | ${markdownCell(edge.label)} | ${edge.target} | ${edge.kind} |`),
    "",
    "## Reading and maintenance rules",
    "",
    "- Caller and domain authority precede expression; a fluent candidate cannot manufacture authority.",
    "- Hard gates exclude a candidate before profile preference or ornament is considered.",
    "- A receipt proves structural self-consistency under recorded versions, not truth or authenticity.",
    "- Text to Lattice is an ecosystem wrapper with a probabilistic authority boundary; it does not inherit typed caller-authority guarantees.",
    "- Host applications retain presentation, privacy, storage, domain review, and interface-accessibility duties.",
    "",
    ...markdownSourceRegister(data),
    ...markdownTerms(),
  );
  return `${lines.join("\n").trimEnd()}\n`;
}

function conceptHtml(data) {
  const map = data.conceptMap;
  const nodeMap = new Map(map.nodes.map((node) => [node.id, node]));
  const cards = map.groups.map((group) => {
    const groupCards = map.nodes.filter((node) => node.group === group.id).map((node) => {
      const relations = map.edges.filter((edge) => edge.source === node.id || edge.target === node.id);
      const relationItems = relations.map((edge) => `<li><code>${escapeHtml(edge.id)}</code> · ${escapeHtml(edge.source)} → ${escapeHtml(edge.label)} → ${escapeHtml(edge.target)}</li>`).join("");
      return `<article class="record" data-record data-group="${escapeHtml(node.group)}" data-perspective="${escapeHtml(node.perspectives.join(" "))}">
        <details id="${escapeHtml(node.id.toLowerCase())}">
          <summary><span class="identifier">${escapeHtml(node.id)}</span><br><span class="record-title" data-record-title>${escapeHtml(node.label)}</span> · ${escapeHtml(node.caption)}</summary>
          <div class="record-body" data-record-body><p>${escapeHtml(node.definition)}</p><dl><dt>Authority</dt><dd>${escapeHtml(node.authority)}</dd><dt>Perspectives</dt><dd>${htmlTags(node.perspectives)}</dd><dt>Sources</dt><dd>${htmlTags(node.sourceIds)}</dd><dt>Typed relations</dt><dd><ul>${relationItems}</ul></dd></dl></div>
        </details>
      </article>`;
    }).join("");
    return `<section aria-labelledby="group-${escapeHtml(group.id)}"><h2 id="group-${escapeHtml(group.id)}">${escapeHtml(group.label)}</h2><p>${escapeHtml(group.description)}</p><div class="record-grid">${groupCards}</div></section>`;
  }).join("");

  const relationRows = map.edges.map((edge) => `<tr><th scope="row">${escapeHtml(edge.id)}</th><td>${escapeHtml(nodeMap.get(edge.source).label)} <code>${escapeHtml(edge.source)}</code></td><td>${escapeHtml(edge.label)}</td><td>${escapeHtml(nodeMap.get(edge.target).label)} <code>${escapeHtml(edge.target)}</code></td><td>${escapeHtml(edge.kind)}</td></tr>`).join("");
  const toolbar = htmlToolbar({
    searchLabel: "Search concepts, authority, relations, or evidence",
    filters: [
      { key: "group", label: "Concept group", allLabel: "All groups", options: map.groups.map((group) => ({ value: group.id, label: group.label })) },
      { key: "perspective", label: "Reading perspective", allLabel: "All perspectives", options: map.perspectives.filter((item) => item.id !== "all").map((item) => ({ value: item.id, label: item.label })) },
    ],
    statusLabel: "Visible concept count",
    exportTitle: "Lattice concept and ecosystem map",
    exportFilename: "lattice-concept-map-visible.md",
  });
  const overview = `<div class="overview-wrap" tabindex="0" aria-label="Scrollable supplementary Lattice reading path"><svg viewBox="0 0 820 760" role="img" aria-labelledby="overview-title overview-desc"><title id="overview-title">Lattice derivation and host reading path</title><desc id="overview-desc">Caller and domain authority supplies a meaning contract. Explicit context creates an output plan. Candidates clear hard gates and profile evaluation before lexicographic selection. Output and receipt return to the host for human and assistive-technology review. Four ecosystem applications branch from the host. This is a reading path; the relation table is complete.</desc><defs><marker id="overview-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"></path></marker></defs>
    <path class="overview-line" d="M 300 92 L 300 126"></path><path class="overview-line" d="M 300 198 L 300 232"></path><path class="overview-line" d="M 300 304 L 300 338"></path><path class="overview-line" d="M 300 410 L 300 444"></path><path class="overview-line" d="M 300 516 L 300 550"></path><path class="overview-line" d="M 300 622 L 300 656"></path><path class="overview-line overview-branch" d="M 480 586 C 570 586 570 680 610 680"></path>
    <g><rect class="overview-node" x="120" y="20" width="360" height="72"></rect><text class="overview-title" x="300" y="48" text-anchor="middle">Caller and domain authority</text><text class="overview-caption" x="300" y="70" text-anchor="middle">Truth, terminology, context, candidate provenance</text></g>
    <g><rect class="overview-node" x="120" y="126" width="360" height="72"></rect><text class="overview-title" x="300" y="154" text-anchor="middle">Meaning contract</text><text class="overview-caption" x="300" y="176" text-anchor="middle">Typed atoms · relations · protected fields</text></g>
    <g><rect class="overview-node" x="120" y="232" width="360" height="72"></rect><text class="overview-title" x="300" y="260" text-anchor="middle">Context and output plan</text><text class="overview-caption" x="300" y="282" text-anchor="middle">Layer × representation under protected priority</text></g>
    <g><rect class="overview-node" x="120" y="338" width="360" height="72"></rect><text class="overview-title" x="300" y="366" text-anchor="middle">Candidate or literal baseline</text><text class="overview-caption" x="300" y="388" text-anchor="middle">Both enter the same hard-gate path</text></g>
    <g><rect class="overview-node" x="120" y="444" width="360" height="72"></rect><text class="overview-title" x="300" y="472" text-anchor="middle">Hard gates → profile → selection</text><text class="overview-caption" x="300" y="494" text-anchor="middle">Failure cannot be averaged away by style</text></g>
    <g><rect class="overview-node" x="120" y="550" width="360" height="72"></rect><text class="overview-title" x="300" y="578" text-anchor="middle">Output and derivation receipt</text><text class="overview-caption" x="300" y="600" text-anchor="middle">Bounded conformance · self-consistent evidence</text></g>
    <g><rect class="overview-node" x="120" y="656" width="360" height="72"></rect><text class="overview-title" x="300" y="684" text-anchor="middle">Host and human review</text><text class="overview-caption" x="300" y="706" text-anchor="middle">Presentation · privacy · truth · accessibility</text></g>
    <g><rect class="overview-node overview-node-branch" x="610" y="630" width="190" height="100"></rect><text class="overview-title" x="705" y="656" text-anchor="middle">Ecosystem branch</text><text class="overview-caption" x="705" y="678" text-anchor="middle">Text to Lattice</text><text class="overview-caption" x="705" y="696" text-anchor="middle">FOG OF SEA · CHORUS</text><text class="overview-caption" x="705" y="714" text-anchor="middle">Evenward</text></g>
  </svg></div>`;
  const content = `${htmlAuthority(data)}
  <section class="panel method-note"><p class="eyebrow">Relation before recital</p><h2>Meaning enters before style</h2><p>${escapeHtml(map.description)}</p><p><strong>Wrapper distinction:</strong> Text to Lattice infers a bounded contract from prose. It does not inherit the upstream engine's guarantee that a domain-authoritative caller supplied typed meaning.</p></section>
  <section class="panel" aria-labelledby="overview-heading"><h2 id="overview-heading">Derivation and ecosystem reading path</h2><p>This supplementary overview follows one primary route. The complete relation table below remains the edge authority.</p>${overview}</section>
  ${toolbar}<div>${cards}</div></section>
  <section class="panel" aria-labelledby="relations-heading"><h2 id="relations-heading">Complete relation register</h2><p>Filtering never changes this canonical relation table.</p><div class="table-wrap" tabindex="0" aria-label="Scrollable complete Lattice relation table"><table class="relation-table"><caption>All typed concept relations</caption><thead><tr><th scope="col">ID</th><th scope="col">Source</th><th scope="col">Relation</th><th scope="col">Target</th><th scope="col">Kind</th></tr></thead><tbody>${relationRows}</tbody></table></div></section>
  <section class="panel"><h2>Sources and exports</h2><p><a class="button-link" href="LATTICE-CONCEPT-MAP.md" download>Download complete Markdown</a> <a class="button-link" href="documentation-atlas.json" download>Download authoritative JSON</a> <a class="button-link" href="artifact-manifest.json">Inspect integrity manifest</a></p></section>
  ${htmlSources(data)}${htmlTerms()}`;
  return htmlPage(data, {
    title: "Lattice concept and ecosystem map",
    description: map.description,
    current: "concept",
    content,
  });
}

function skillMarkdown(data) {
  const skillMap = data.skillMap;
  const scale = new Map(skillMap.scale.map((entry) => [entry.score, entry]));
  const lines = [
    ...markdownFrontmatter(data, "Lattice system skill map"),
    "# Lattice system skill map",
    "",
    `> **System evidence, never human proficiency.** ${skillMap.methodNote}`,
    "",
    `[Open the interactive HTML edition](${publicBaseUrl}lattice-skill-map.html) · [Download complete Markdown](${publicBaseUrl}LATTICE-SKILL-MAP.md) · [Download the machine-readable register](${publicBaseUrl}documentation-atlas.json) · [Inspect the artifact manifest](${publicBaseUrl}artifact-manifest.json)`,
    "",
    ...markdownAuthority(data),
    "## Evidence scale",
    "",
    "| Score | Status | Meaning |",
    "| ---: | --- | --- |",
    ...skillMap.scale.map((entry) => `| ${entry.score} | ${entry.label} | ${markdownCell(entry.definition)} |`),
    "",
    "Score five requires independent, production, longitudinal, or representative user evidence. No capability receives five at this revision.",
    "",
    "## Capability shape",
    "",
    "| Capability | Group | Evidence score | Evidence class | Open boundary |",
    "| --- | --- | ---: | --- | --- |",
    ...skillMap.capabilities.map((item) => `| ${item.id} · ${markdownCell(item.label)} | ${item.group} | ${item.score}/5 | ${scale.get(item.score).label} | ${markdownCell(item.openBoundary)} |`),
    "",
    "## Capability register",
    "",
  ];
  for (const item of skillMap.capabilities) {
    lines.push(
      `<details id="${item.id.toLowerCase()}">`,
      `<summary><strong>${item.id}</strong> · ${item.label} — ${item.score}/5 ${scale.get(item.score).label}</summary>`,
      "",
      item.definition,
      "",
      `- **Evidence:** ${item.evidence}`,
      `- **Open boundary:** ${item.openBoundary}`,
      `- **Sources:** ${item.sourceIds.join(", ")}`,
      "",
      "</details>",
      "",
    );
  }
  lines.push(
    "## Interpretation rules",
    "",
    "- The shape belongs to the upstream Lattice engine at the reviewed revision, not to the hah.dev wrapper.",
    "- Score records evidence maturity, not feature importance, effort, market value, or aesthetic quality.",
    "- One strong axis cannot compensate for a hard failure on another axis.",
    "- Score four is self-authored adversarial repository evidence. It is deliberately below external validation.",
    "- A score moves only when new evidence changes the strongest supported class.",
    "",
    ...markdownSourceRegister(data),
    ...markdownTerms(),
  );
  return `${lines.join("\n").trimEnd()}\n`;
}

function radarSvg(skillMap) {
  const capabilities = skillMap.capabilities;
  const center = 320;
  const radius = 210;
  const pointAt = (index, valueRadius) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / capabilities.length;
    return [
      Math.round((center + Math.cos(angle) * valueRadius) * 100) / 100,
      Math.round((center + Math.sin(angle) * valueRadius) * 100) / 100,
    ];
  };
  const rings = Array.from({ length: 5 }, (_, index) => {
    const value = index + 1;
    const points = capabilities.map((_, axis) => pointAt(axis, radius * value / 5).join(",")).join(" ");
    return `<polygon class="radar-ring" points="${points}"><title>Evidence score ${value}</title></polygon>`;
  }).join("");
  const axes = capabilities.map((capability, index) => {
    const [x, y] = pointAt(index, radius);
    const [labelX, labelY] = pointAt(index, radius + 45);
    const anchor = labelX < center - 10 ? "end" : labelX > center + 10 ? "start" : "middle";
    return `<line class="radar-axis" x1="${center}" y1="${center}" x2="${x}" y2="${y}"><title>${escapeHtml(capability.label)}</title></line><text class="radar-label" x="${labelX}" y="${labelY}" text-anchor="${anchor}">${escapeHtml(capability.id)} · ${capability.score}</text>`;
  }).join("");
  const shapePoints = capabilities.map((capability, index) => pointAt(index, radius * capability.score / 5).join(",")).join(" ");
  const points = capabilities.map((capability, index) => {
    const [x, y] = pointAt(index, radius * capability.score / 5);
    return `<circle class="radar-point" cx="${x}" cy="${y}" r="6"><title>${escapeHtml(capability.label)}: ${capability.score} of 5</title></circle>`;
  }).join("");
  const description = capabilities.map((item) => `${item.label}, ${item.score} of 5`).join("; ");
  return `<svg viewBox="0 0 640 640" role="img" aria-labelledby="skill-radar-title skill-radar-desc"><title id="skill-radar-title">Lattice system evidence shape</title><desc id="skill-radar-desc">${escapeHtml(description)}. The capability cards provide the canonical detail.</desc>${rings}${axes}<polygon class="radar-shape" points="${shapePoints}"></polygon>${points}</svg>`;
}

function skillHtml(data) {
  const skillMap = data.skillMap;
  const scale = new Map(skillMap.scale.map((entry) => [entry.score, entry]));
  const groups = [...new Set(skillMap.capabilities.map((item) => item.group))].sort();
  const statuses = [...new Set(skillMap.capabilities.map((item) => item.status))].sort();
  const cards = skillMap.capabilities.map((item) => `<article class="record classification-${escapeHtml(item.status)}" data-record data-group="${escapeHtml(item.group)}" data-status="${escapeHtml(item.status)}">
    <details id="${escapeHtml(item.id.toLowerCase())}">
      <summary><span class="identifier">${escapeHtml(item.id)}</span><br><span class="record-title" data-record-title>${escapeHtml(item.label)}</span> · <span class="score">${item.score}/5</span> ${escapeHtml(scale.get(item.score).label)}</summary>
      <div class="record-body" data-record-body><p>${escapeHtml(item.definition)}</p><dl><dt>Evidence</dt><dd>${escapeHtml(item.evidence)}</dd><dt>Open boundary</dt><dd>${escapeHtml(item.openBoundary)}</dd><dt>Sources</dt><dd>${htmlTags(item.sourceIds)}</dd></dl></div>
    </details>
  </article>`).join("");
  const scaleRows = skillMap.scale.map((entry) => `<tr><th scope="row">${entry.score}</th><td>${escapeHtml(entry.label)}</td><td>${escapeHtml(entry.definition)}</td></tr>`).join("");
  const toolbar = htmlToolbar({
    searchLabel: "Search capabilities, evidence, or open boundaries",
    filters: [
      { key: "group", label: "Capability domain", allLabel: "All domains", options: groups.map((group) => ({ value: group, label: humanLabel(group) })) },
      { key: "status", label: "Evidence class", allLabel: "All evidence classes", options: statuses.map((status) => ({ value: status, label: humanLabel(status) })) },
    ],
    statusLabel: "Visible capability count",
    exportTitle: "Lattice system skill map",
    exportFilename: "lattice-system-skill-map-visible.md",
  });
  const content = `${htmlAuthority(data)}
  <section class="panel method-note"><p class="eyebrow">NN/g form · system evidence adaptation</p><h2>System evidence, never human proficiency</h2><p><strong>${escapeHtml(skillMap.methodNote)}</strong></p><p>The radar shape is supplementary. Score five requires external or production evidence; no axis receives five.</p></section>
  <section class="panel" aria-labelledby="shape-heading"><h2 id="shape-heading">Evidence shape</h2><div class="radar-wrap" tabindex="0" aria-label="Scrollable system evidence radar">${radarSvg(skillMap)}</div></section>
  <section class="panel" aria-labelledby="scale-heading"><h2 id="scale-heading">Evidence scale</h2><div class="table-wrap" tabindex="0" aria-label="Scrollable evidence scale"><table><caption>System capability evidence scale</caption><thead><tr><th scope="col">Score</th><th scope="col">Class</th><th scope="col">Meaning</th></tr></thead><tbody>${scaleRows}</tbody></table></div></section>
  ${toolbar}<div class="record-grid">${cards}</div></section>
  <section class="panel"><h2>Sources and exports</h2><p><a class="button-link" href="LATTICE-SKILL-MAP.md" download>Download complete Markdown</a> <a class="button-link" href="documentation-atlas.json" download>Download authoritative JSON</a> <a class="button-link" href="artifact-manifest.json">Inspect integrity manifest</a></p><p><a href="https://www.nngroup.com/articles/skill-mapping/">Read NN/g's skill-mapping method</a>. This adaptation changes the measured subject from people to system evidence.</p></section>
  ${htmlSources(data, ["SRC-LAT-README", "SRC-LAT-ARCH", "SRC-LAT-REQ", "SRC-LAT-SEMANTIC", "SRC-LAT-CONTEXT", "SRC-LAT-PROFILE", "SRC-LAT-ENGINE", "SRC-LAT-ADVERSARIAL", "SRC-NNG-SKILL"])}${htmlTerms()}`;
  return htmlPage(data, {
    title: "Lattice system skill map",
    description: "An NN/g-derived radar and evidence inventory for the upstream Lattice engine—never a rating of a person or team.",
    current: "skill",
    content,
  });
}

function blueprintMarkdown(data) {
  const blueprint = data.serviceBlueprint;
  const lines = [
    ...markdownFrontmatter(data, "Text to Lattice service blueprint"),
    "# Text to Lattice service blueprint",
    "",
    blueprint.scenario,
    "",
    `[Open the interactive HTML edition](${publicBaseUrl}text-to-lattice-service-blueprint.html) · [Download complete Markdown](${publicBaseUrl}TEXT-TO-LATTICE-SERVICE-BLUEPRINT.md) · [Download the machine-readable register](${publicBaseUrl}documentation-atlas.json) · [Inspect the artifact manifest](${publicBaseUrl}artifact-manifest.json)`,
    "",
    ...markdownAuthority(data),
    "## Scenario contract",
    "",
    `- **Actor:** ${blueprint.actor}`,
    `- **Goal:** ${blueprint.goal}`,
    `- **Method:** ${blueprint.methodNote}`,
    "",
    "## Lines",
    "",
    "| ID | Line | Between | Accountability meaning |",
    "| --- | --- | --- | --- |",
    ...blueprint.lines.map((line) => `| ${line.id} | ${markdownCell(line.label)} | ${markdownCell(line.between)} | ${markdownCell(line.meaning)} |`),
    "",
    "## Complete blueprint",
    "",
    "| Stage | Visitor action | Frontstage | Backstage browser-local | Support/network | Evidence/recovery | Data crossing boundary |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...blueprint.stages.map((stage) => `| **${stage.id} · ${markdownCell(stage.phase)}** | ${markdownCell(stage.visitorAction)} | ${markdownCell(stage.frontstage)} | ${markdownCell(stage.backstage)} | ${markdownCell(stage.supportNetwork)} | ${markdownCell(stage.evidenceRecovery)} | ${markdownCell(stage.dataCrossing)} |`),
    "",
    "## Failure and recovery register",
    "",
  ];
  for (const stage of blueprint.stages) {
    lines.push(
      `<details id="${stage.id.toLowerCase()}">`,
      `<summary><strong>${stage.id}</strong> · ${stage.phase}</summary>`,
      "",
      `- **Failure:** ${stage.failure}`,
      `- **Recovery:** ${stage.recovery}`,
      `- **Network boundary:** ${stage.dataCrossing}`,
      "",
      "</details>",
      "",
    );
  }
  lines.push(
    "## Lifecycle ownership",
    "",
    "External providers are dependencies, not assumed accountable owners. Accountability remains assigned to a Lattice or hah.dev maintainer, the site owner, or the visitor at each handoff.",
    "",
    "| ID | Surface | Accountable owner | Responsibility | Handoff evidence |",
    "| --- | --- | --- | --- | --- |",
    ...blueprint.lifecycleOwners.map((owner) => `| ${owner.id} | ${markdownCell(owner.surface)} | ${markdownCell(owner.accountableOwner)} | ${markdownCell(owner.responsibility)} | ${markdownCell(owner.handoffEvidence)} |`),
    "",
    "## Binding data-flow rule",
    "",
    "Source, clarification, candidate, verifier findings, and result text cross only between the résumé document and the same-device model worker in the official client. Model hosts receive public asset requests. The attestation and lease services receive closed tokens, opaque credentials, request metadata, and lifecycle state—never prose.",
    "",
    "Repository tests support the as-built rows. They do not establish that independent origins, provider rules, secrets, headers, or production traces match the source tree.",
    "",
    ...markdownSourceRegister(data),
    ...markdownTerms(),
  );
  return `${lines.join("\n").trimEnd()}\n`;
}

function blueprintHtml(data) {
  const blueprint = data.serviceBlueprint;
  const lineItems = blueprint.lines.map((line) => `<li><p class="identifier">${escapeHtml(line.id)}</p><strong>${escapeHtml(line.label)}</strong><br>${escapeHtml(line.between)}<p>${escapeHtml(line.meaning)}</p></li>`).join("");
  const cards = blueprint.stages.map((stage) => `<article class="record" data-record data-stage="${escapeHtml(stage.id)}">
    <details id="${escapeHtml(stage.id.toLowerCase())}">
      <summary><span class="identifier">${escapeHtml(stage.id)}</span><br><span class="record-title" data-record-title>${escapeHtml(stage.phase)}</span></summary>
      <div class="record-body" data-record-body><dl>
        <dt>Visitor action</dt><dd>${escapeHtml(stage.visitorAction)}</dd>
        <dt>Frontstage</dt><dd>${escapeHtml(stage.frontstage)}</dd>
        <dt>Backstage browser-local</dt><dd>${escapeHtml(stage.backstage)}</dd>
        <dt>Support/network</dt><dd>${escapeHtml(stage.supportNetwork)}</dd>
        <dt>Evidence/recovery</dt><dd>${escapeHtml(stage.evidenceRecovery)}</dd>
        <dt>Data crossing boundary</dt><dd>${escapeHtml(stage.dataCrossing)}</dd>
        <dt>Failure</dt><dd>${escapeHtml(stage.failure)}</dd>
        <dt>Recovery</dt><dd>${escapeHtml(stage.recovery)}</dd>
      </dl></div>
    </details>
  </article>`).join("");
  const stageRows = blueprint.stages.map((stage) => `<tr><th scope="row">${escapeHtml(stage.id)}<br>${escapeHtml(stage.phase)}</th><td>${escapeHtml(stage.visitorAction)}</td><td>${escapeHtml(stage.frontstage)}</td><td>${escapeHtml(stage.backstage)}</td><td>${escapeHtml(stage.supportNetwork)}</td><td>${escapeHtml(stage.evidenceRecovery)}</td><td>${escapeHtml(stage.dataCrossing)}</td></tr>`).join("");
  const ownerRows = blueprint.lifecycleOwners.map((owner) => `<tr><th scope="row">${escapeHtml(owner.id)}</th><td>${escapeHtml(owner.surface)}</td><td>${escapeHtml(owner.accountableOwner)}</td><td>${escapeHtml(owner.responsibility)}</td><td>${escapeHtml(owner.handoffEvidence)}</td></tr>`).join("");
  const toolbar = htmlToolbar({
    searchLabel: "Search actions, systems, crossings, failures, or recovery",
    filters: [{
      key: "stage",
      label: "Lifecycle stage",
      allLabel: "All stages",
      options: blueprint.stages.map((stage) => ({ value: stage.id, label: `${stage.id} · ${stage.phase}` })),
    }],
    statusLabel: "Visible service-stage count",
    exportTitle: "Text to Lattice service blueprint",
    exportFilename: "text-to-lattice-service-blueprint-visible.md",
  });
  const content = `${htmlAuthority(data)}
  <section class="panel method-note"><p class="eyebrow">Specific actor · specific goal · exact crossings</p><h2>Scenario contract</h2><p><strong>Scenario:</strong> ${escapeHtml(blueprint.scenario)}</p><p><strong>Actor:</strong> ${escapeHtml(blueprint.actor)}</p><p><strong>Goal:</strong> ${escapeHtml(blueprint.goal)}</p><p>${escapeHtml(blueprint.methodNote)} <a href="https://www.nngroup.com/articles/service-blueprints-definition/">Read NN/g's definition</a>.</p></section>
  <section class="panel" aria-labelledby="lines-heading"><h2 id="lines-heading">Four lines of accountability</h2><ul class="boundary-list">${lineItems}</ul></section>
  ${toolbar}<div class="record-grid">${cards}</div></section>
  <section class="panel" aria-labelledby="blueprint-heading"><h2 id="blueprint-heading">Complete six-layer blueprint</h2><p>This canonical table remains complete when the interactive cards are filtered.</p><div class="table-wrap" tabindex="0" aria-label="Scrollable complete Text to Lattice service blueprint"><table class="blueprint-table"><caption>Eight lifecycle stages across six service layers</caption><thead><tr><th scope="col">Stage</th><th scope="col">Visitor action</th><th scope="col">Frontstage</th><th scope="col">Backstage browser-local</th><th scope="col">Support/network</th><th scope="col">Evidence/recovery</th><th scope="col">Data crossing boundary</th></tr></thead><tbody>${stageRows}</tbody></table></div></section>
  <section class="panel" aria-labelledby="owners-heading"><h2 id="owners-heading">Lifecycle ownership</h2><p>External providers are dependencies, not assumed accountable owners. Each handoff names retained accountability and required evidence.</p><div class="table-wrap" tabindex="0" aria-label="Scrollable lifecycle ownership matrix"><table><caption>Accountable owner and handoff evidence</caption><thead><tr><th scope="col">ID</th><th scope="col">Surface</th><th scope="col">Accountable owner</th><th scope="col">Responsibility</th><th scope="col">Handoff evidence</th></tr></thead><tbody>${ownerRows}</tbody></table></div></section>
  <section class="panel boundary"><h2>Binding data-flow rule</h2><p>Source, clarification, candidate, verifier findings, and result text cross only between the résumé document and the same-device model worker in the official client. Model hosts receive public asset requests. Attestation and lease services receive closed tokens, opaque credentials, request metadata, and lifecycle state—never prose.</p></section>
  <section class="panel"><h2>Sources and exports</h2><p><a class="button-link" href="TEXT-TO-LATTICE-SERVICE-BLUEPRINT.md" download>Download complete Markdown</a> <a class="button-link" href="documentation-atlas.json" download>Download authoritative JSON</a> <a class="button-link" href="artifact-manifest.json">Inspect integrity manifest</a></p></section>
  ${htmlSources(data)}${htmlTerms()}`;
  return htmlPage(data, {
    title: "Text to Lattice service blueprint",
    description: "Eight stages expose visitor action, frontstage, browser-local work, support systems, recovery evidence, and every data crossing.",
    current: "blueprint",
    content,
  });
}

function securityMarkdown(data) {
  const security = data.securityModel;
  const classes = [
    ["High", "Realistic failure, meaningful consequence, or reusable architectural benefit", "Fix now"],
    ["Moderate", "Lower probability but cheap and bounded to fix or test", "Fix when bounded"],
    ["Low", "Exotic, nonconsequential, or provider-impossible with little lifecycle value", "Document or defer"],
    ["Negative", "Bespoke complexity or new failure surface exceeds risk removed", "Do not implement"],
  ];
  const lines = [
    ...markdownFrontmatter(data, "Text to Lattice security model"),
    "# Text to Lattice security model",
    "",
    "This is an as-built source model, not a penetration test, formal semantic proof, privacy guarantee, or deployed-control attestation.",
    "",
    `[Open the interactive HTML edition](${publicBaseUrl}text-to-lattice-security-model.html) · [Download complete Markdown](${publicBaseUrl}TEXT-TO-LATTICE-SECURITY-MODEL.md) · [Download the machine-readable register](${publicBaseUrl}documentation-atlas.json) · [Inspect the artifact manifest](${publicBaseUrl}artifact-manifest.json)`,
    "",
    ...markdownAuthority(data),
    "## Scope and decision rule",
    "",
    security.scope,
    "",
    security.method,
    "",
    "The decision boundary is:",
    "",
    "$$\\text{marginal value} \\propto \\text{consequence} \\times \\text{plausibility} \\times \\text{lifecycle value}$$",
    "",
    "An unusual finding remains eligible. Novelty alone neither promotes nor dismisses it.",
    "",
    "| Classification | Test | Disposition |",
    "| --- | --- | --- |",
    ...classes.map(([classification, test, disposition]) => `| ${classification} marginal value | ${test} | ${disposition} |`),
    "",
    "## Protected assets",
    "",
    "| ID | Asset | Objective |",
    "| --- | --- | --- |",
    ...security.assets.map((asset) => `| ${asset.id} | ${markdownCell(asset.label)} | ${markdownCell(asset.objective)} |`),
    "",
    "## Trust boundaries",
    "",
    "| ID | Boundary | Crossing |",
    "| --- | --- | --- |",
    ...security.trustBoundaries.map((boundary) => `| ${boundary.id} | ${markdownCell(boundary.label)} | ${markdownCell(boundary.crossing)} |`),
    "",
    "## Threat register",
    "",
    "| ID | Threat | Marginal value | As-built posture | Pre-publication work | Residual boundary |",
    "| --- | --- | --- | --- | --- | --- |",
    ...security.threats.map((threat) => `| ${threat.id} | ${markdownCell(threat.title)} | ${humanLabel(threat.marginalValue)} | ${markdownCell(threat.asBuilt.join(" "))} | ${markdownCell(threat.requiredBeforePublication.join(" "))} | ${markdownCell(threat.residualBoundary.join(" "))} |`),
    "",
    "## Detailed treatment records",
    "",
  ];
  for (const threat of security.threats) {
    lines.push(
      `<details id="${threat.id.toLowerCase()}">`,
      `<summary><strong>${threat.id}</strong> · ${threat.title} — ${humanLabel(threat.marginalValue)} marginal value</summary>`,
      "",
      `- **Vector:** ${threat.vector}`,
      `- **Consequence:** ${threat.consequence}`,
      `- **Plausibility:** ${threat.plausibility}`,
      `- **Lifecycle value:** ${threat.lifecycleValue}`,
      `- **Classification:** ${threat.classificationRationale}`,
      `- **Assets:** ${threat.assetIds.join(", ")}`,
      `- **Boundaries:** ${threat.boundaryIds.join(", ")}`,
      "- **As built:**",
      ...threat.asBuilt.map((item) => `  - ${item}`),
      "- **Required before publication:**",
      ...threat.requiredBeforePublication.map((item) => `  - ${item}`),
      "- **Residual boundary:**",
      ...threat.residualBoundary.map((item) => `  - ${item}`),
      `- **Sources:** ${threat.sourceIds.join(", ")}`,
      "",
      "</details>",
      "",
    );
  }
  lines.push(
    "## Release qualification gates",
    "",
    "Only `open-release-blocker` prevents activation. `satisfied-in-source` records repository evidence; `satisfied-in-production` records observed live evidence for the permitted production gate. Every other status preserves its distinct evidence boundary, safeguards, and follow-up, while production satisfaction and post-deployment verification require an explicit rollback condition.",
    "",
    "| ID | Gate | Status | Marginal value | Requirement | Current evidence | Evidence needed |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...security.prePublicationGates.map((gate) => `| ${gate.id} | ${markdownCell(gate.label)} | ${humanLabel(gate.status)} | ${humanLabel(gate.marginalValue)} | ${markdownCell(gate.requirement)} | ${markdownCell(gate.currentEvidence)} | ${markdownCell(gate.evidenceNeeded)} |`),
    "",
  );
  for (const gate of security.prePublicationGates) {
    lines.push(
      `### ${gate.id} · ${gate.label}`,
      "",
      `- **Rationale:** ${gate.rationale}`,
      `- **Evidence:** ${gate.evidence.join("; ")}`,
      `- **Safeguards:** ${gate.safeguards.join("; ")}`,
      `- **Follow-up:** ${gate.followUp}`,
      ...(gate.acceptanceBasis ? [`- **Acceptance basis:** ${gate.acceptanceBasis}`] : []),
      ...(gate.rollbackCondition ? [`- **Rollback condition:** ${gate.rollbackCondition}`] : []),
      "",
    );
  }
  lines.push(
    "## Honest residual boundary",
    "",
    ...security.honestResidualBoundary.map((item) => `- ${item}`),
    "",
    ...markdownSourceRegister(data),
    ...markdownTerms(),
  );
  return `${lines.join("\n").trimEnd()}\n`;
}

function htmlList(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function securityHtml(data) {
  const security = data.securityModel;
  const assets = security.assets.map((asset) => `<tr><th scope="row">${escapeHtml(asset.id)}</th><td>${escapeHtml(asset.label)}</td><td>${escapeHtml(asset.objective)}</td></tr>`).join("");
  const boundaries = security.trustBoundaries.map((boundary) => `<li><p class="identifier">${escapeHtml(boundary.id)}</p><strong>${escapeHtml(boundary.label)}</strong><p>${escapeHtml(boundary.crossing)}</p></li>`).join("");
  const cards = security.threats.map((threat) => `<article class="record classification-${escapeHtml(threat.marginalValue)}" data-record data-marginal="${escapeHtml(threat.marginalValue)}" data-boundary="${escapeHtml(threat.boundaryIds.join(" "))}">
    <details id="${escapeHtml(threat.id.toLowerCase())}">
      <summary><span class="identifier">${escapeHtml(threat.id)}</span><br><span class="record-title" data-record-title>${escapeHtml(threat.title)}</span> · ${escapeHtml(humanLabel(threat.marginalValue))} marginal value</summary>
      <div class="record-body" data-record-body><dl>
        <dt>Vector</dt><dd>${escapeHtml(threat.vector)}</dd>
        <dt>Consequence</dt><dd>${escapeHtml(threat.consequence)}</dd>
        <dt>Plausibility</dt><dd>${escapeHtml(threat.plausibility)}</dd>
        <dt>Lifecycle value</dt><dd>${escapeHtml(threat.lifecycleValue)}</dd>
        <dt>Classification</dt><dd>${escapeHtml(threat.classificationRationale)}</dd>
        <dt>As built</dt><dd>${htmlList(threat.asBuilt)}</dd>
        <dt>Required before publication</dt><dd>${htmlList(threat.requiredBeforePublication)}</dd>
        <dt>Residual boundary</dt><dd>${htmlList(threat.residualBoundary)}</dd>
        <dt>Assets and boundaries</dt><dd>${htmlTags([...threat.assetIds, ...threat.boundaryIds])}</dd>
        <dt>Sources</dt><dd>${htmlTags(threat.sourceIds)}</dd>
      </dl></div>
    </details>
  </article>`).join("");
  const gateCards = security.prePublicationGates.map((gate) => `<article class="panel gate-${escapeHtml(gate.status)}"><p class="identifier">${escapeHtml(gate.id)} · ${escapeHtml(humanLabel(gate.status))} · ${escapeHtml(humanLabel(gate.marginalValue))} marginal value</p><h3>${escapeHtml(gate.label)}</h3><p>${escapeHtml(gate.requirement)}</p><p><strong>Rationale:</strong> ${escapeHtml(gate.rationale)}</p><p><strong>Current evidence:</strong> ${escapeHtml(gate.currentEvidence)}</p><p><strong>Evidence needed:</strong> ${escapeHtml(gate.evidenceNeeded)}</p><p><strong>Evidence record:</strong></p>${htmlList(gate.evidence)}<p><strong>Safeguards:</strong></p>${htmlList(gate.safeguards)}<p><strong>Follow-up:</strong> ${escapeHtml(gate.followUp)}</p>${gate.acceptanceBasis ? `<p><strong>Acceptance basis:</strong> ${escapeHtml(gate.acceptanceBasis)}</p>` : ""}${gate.rollbackCondition ? `<p><strong>Rollback condition:</strong> ${escapeHtml(gate.rollbackCondition)}</p>` : ""}</article>`).join("");
  const toolbar = htmlToolbar({
    searchLabel: "Search threats, controls, gates, or residuals",
    filters: [
      { key: "marginal", label: "Marginal value", allLabel: "All classifications", options: [...new Set(security.threats.map((threat) => threat.marginalValue))].sort().map((value) => ({ value, label: humanLabel(value) })) },
      { key: "boundary", label: "Trust boundary", allLabel: "All trust boundaries", options: security.trustBoundaries.map((boundary) => ({ value: boundary.id, label: `${boundary.id} · ${boundary.label}` })) },
    ],
    statusLabel: "Visible threat count",
    exportTitle: "Text to Lattice security model",
    exportFilename: "text-to-lattice-security-model-visible.md",
  });
  const content = `${htmlAuthority(data)}
  <section class="panel boundary"><p class="eyebrow">As-built source model</p><h2>Not a penetration test or deployed attestation</h2><p>${escapeHtml(security.scope)}</p><p>${escapeHtml(security.method)}</p><p><strong>Decision rule:</strong> marginal value is proportional to consequence × plausibility × lifecycle value. Unusual findings remain eligible; novelty alone neither promotes nor dismisses them.</p></section>
  <section class="panel" aria-labelledby="assets-heading"><h2 id="assets-heading">Protected assets</h2><div class="table-wrap" tabindex="0" aria-label="Scrollable protected asset table"><table><caption>Security and trust objectives</caption><thead><tr><th scope="col">ID</th><th scope="col">Asset</th><th scope="col">Objective</th></tr></thead><tbody>${assets}</tbody></table></div></section>
  <section class="panel" aria-labelledby="boundaries-heading"><h2 id="boundaries-heading">Trust boundaries</h2><ul class="boundary-list">${boundaries}</ul></section>
  ${toolbar}<div class="record-grid">${cards}</div></section>
  <section aria-labelledby="gates-heading"><div class="panel boundary"><p class="eyebrow">Evidence stays typed</p><h2 id="gates-heading">Release qualification gates</h2><p>Only an open release blocker prevents activation. Source-satisfied, production-satisfied, workflow-enforced, accepted-residual, and post-deployment statuses keep distinct evidence and lifecycle duties; production satisfaction records observed live evidence only for its permitted gate, and none converts missing runtime evidence into a completed claim.</p></div><div class="record-grid">${gateCards}</div></section>
  <section class="panel" aria-labelledby="residual-heading"><h2 id="residual-heading">Honest residual boundary</h2>${htmlList(security.honestResidualBoundary)}</section>
  <section class="panel"><h2>Sources and exports</h2><p><a class="button-link" href="TEXT-TO-LATTICE-SECURITY-MODEL.md" download>Download complete Markdown</a> <a class="button-link" href="documentation-atlas.json" download>Download authoritative JSON</a> <a class="button-link" href="artifact-manifest.json">Inspect integrity manifest</a></p></section>
  ${htmlSources(data)}${htmlTerms()}`;
  return htmlPage(data, {
    title: "Text to Lattice security model",
    description: "Assets, trust boundaries, twelve consequential threats, as-built controls, release qualification gates, and residuals—classified by marginal value.",
    current: "security",
    content,
  });
}

function indexHtml(data, releaseRegister) {
  const summaries = new Map([
    ["DOC-CONCEPT", "Trace caller authority through meaning contracts, protected evaluation, evidence, host duties, and four ecosystem applications."],
    ["DOC-SKILL", "Inspect the upstream engine's capability shape on a zero-to-five system-evidence scale adapted from NN/g skill mapping."],
    ["DOC-BLUEPRINT", "Follow the wrapper across eight stages, six service layers, four accountability lines, and eight lifecycle owners."],
    ["DOC-SECURITY", "Review assets, boundaries, SEC-01 through SEC-12, marginal value, release qualification gates, and honest residuals."],
  ]);
  const cards = data.artifacts.map((artifact) => `<article class="index-card"><p class="eyebrow">${escapeHtml(artifact.scope)}</p><h2>${escapeHtml(artifact.title)}</h2><p>${escapeHtml(summaries.get(artifact.id))}</p><div class="link-row"><a href="${escapeHtml(artifact.html)}">Open interactive edition</a><a href="${escapeHtml(artifact.markdown)}" download>Download Markdown</a></div></article>`).join("");
  const releaseSummary = releaseRegister.publicClient?.status === "held"
    ? "The interactive client is held because an open release blocker remains. The records distinguish that blocker from accepted residuals and evidence that can exist only after deployment."
    : "The interactive client is qualified. The records preserve accepted residuals, workflow controls, post-deployment checks, and rollback conditions without overstating runtime evidence.";
  const releaseEvidence = `<section class="panel"><p class="eyebrow">Release evidence</p><h2>Text to Lattice qualification</h2><p>${escapeHtml(releaseSummary)}</p><ul><li><a href="TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md">Release qualification</a></li><li><a href="TEXT-TO-LATTICE-RELEASE-REGISTER.json">Machine release register</a></li><li><a href="LLAMA-USE-EVALUATION-CASES.json">Llama-use evaluation cases</a></li></ul></section>`;
  const content = `<section class="panel boundary"><p class="eyebrow">Method beside implementation</p><h2>Two authorities, four coordinated views</h2><p>The concept and system skill maps describe the upstream typed Lattice engine. The service blueprint and security model describe the separate Text to Lattice wrapper. The wrapper infers bounded meaning from prose and does not inherit a caller-supplied typed authority guarantee.</p><p>Every document remains complete without JavaScript. Scripting adds read-only search, filters, disclosure controls, and local Markdown export.</p></section>
  <section class="index-grid" aria-label="Available Lattice documentation">${cards}</section>
  ${releaseEvidence}
  <section class="panel"><h2>Authority and integrity</h2><p><a class="button-link" href="documentation-atlas.json">Machine-readable authoritative register</a> <a class="button-link" href="artifact-manifest.json">SHA-256 artifact manifest</a></p><p>These pages load no remote fonts, icons, scripts, analytics, or media. Reviewed source links leave this documentation only when activated.</p></section>
  ${htmlTerms()}`;
  return htmlPage(data, {
    title: "Lattice documentation",
    description: "Interactive, downloadable maps for the upstream Lattice engine and its bounded Text to Lattice wrapper.",
    current: "index",
    content,
    interactive: false,
  });
}

function validateGeneratedMarkdown(filename, markdown, data, expectedIds) {
  if (!markdown.startsWith("---\n")) fail(`${filename} lacks deterministic frontmatter.`);
  if (!markdown.includes(`authority: ${data.authority.canonicalSource}`)) fail(`${filename} omits canonical authority.`);
  if (!markdown.includes(`${publicBaseUrl}documentation-atlas.json`)) fail(`${filename} omits the authoritative JSON link.`);
  if (!markdown.includes(`${publicBaseUrl}artifact-manifest.json`)) fail(`${filename} omits the artifact manifest link.`);
  if (!markdown.includes("## Terms and provenance")) fail(`${filename} omits terms and provenance.`);
  for (const id of expectedIds) {
    if (!markdown.includes(id)) fail(`${filename} omits record ${id}.`);
  }
}

function countMatches(value, expression) {
  return [...value.matchAll(expression)].length;
}

function validateGeneratedHtml(filename, html, {
  interactive,
  markdownFilename = null,
  expectedIds = [],
}) {
  if (!html.startsWith("<!doctype html>\n<html lang=\"en\">")) fail(`${filename} lacks its document shell.`);
  if (countMatches(html, /rel="canonical"/gu) !== 1) fail(`${filename} must contain one canonical link.`);
  const alternateCount = countMatches(html, /rel="alternate" type="text\/markdown"/gu);
  if (alternateCount !== (markdownFilename ? 1 : 0)) fail(`${filename} has an incorrect Markdown alternate count.`);
  if (markdownFilename && !html.includes(`href="${publicBaseUrl}${markdownFilename}"`)) {
    fail(`${filename} does not bind its Markdown alternate.`);
  }
  if (!html.includes("documentation-atlas.json") || !html.includes("artifact-manifest.json")) {
    fail(`${filename} must link the authoritative JSON and artifact manifest.`);
  }
  if (markdownFilename && !html.includes(`href="${markdownFilename}"`)) fail(`${filename} does not link its complete Markdown.`);
  if (/<script\b[^>]*\bsrc=/iu.test(html) || /<link\b[^>]*rel="stylesheet"/iu.test(html) || /<(?:img|iframe|audio|video|source)\b[^>]*\bsrc="https?:/iu.test(html)) {
    fail(`${filename} contains a remote runtime asset.`);
  }
  if (/@import|\.innerHTML|\bfetch\s*\(|\bXMLHttpRequest\b|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|\bWebSocket\b/gu.test(html)) {
    fail(`${filename} contains a prohibited runtime or rendering primitive.`);
  }
  for (const requirement of ["min-height: 44px", "prefers-reduced-motion", "forced-colors", "@media print", "focus-visible"]) {
    if (!html.includes(requirement)) fail(`${filename} omits accessibility treatment: ${requirement}.`);
  }
  if (!html.includes("Terms and provenance") || !html.includes("separately licensed Relational Systems Register profile is not reproduced")) {
    fail(`${filename} omits the terms and profile boundary.`);
  }
  for (const id of expectedIds) {
    if (!html.includes(id)) fail(`${filename} omits pre-rendered record ${id}.`);
  }
  if (interactive) {
    for (const requirement of ["data-interactive-register", "type=\"search\"", "data-filter-key", "<details", "role=\"status\"", "aria-live=\"polite\"", "new Blob", "textContent", "document.createElement"]) {
      if (!html.includes(requirement)) fail(`${filename} omits progressive interaction: ${requirement}.`);
    }
  } else if (/<script>/u.test(html)) {
    fail(`${filename} should not carry an unused script.`);
  }
}

function buildArtifacts(data, canonicalBytes, releaseRegister) {
  const conceptMd = conceptMarkdown(data);
  const skillMd = skillMarkdown(data);
  const blueprintMd = blueprintMarkdown(data);
  const securityMd = securityMarkdown(data);
  const documents = new Map([
    ["DOC-CONCEPT", { markdown: conceptMd, html: conceptHtml(data), ids: data.conceptMap.nodes.map((item) => item.id) }],
    ["DOC-SKILL", { markdown: skillMd, html: skillHtml(data), ids: data.skillMap.capabilities.map((item) => item.id) }],
    ["DOC-BLUEPRINT", { markdown: blueprintMd, html: blueprintHtml(data), ids: data.serviceBlueprint.stages.map((item) => item.id) }],
    ["DOC-SECURITY", { markdown: securityMd, html: securityHtml(data), ids: data.securityModel.threats.map((item) => item.id) }],
  ]);
  const artifacts = new Map();
  for (const descriptor of data.artifacts) {
    const document = documents.get(descriptor.id);
    validateGeneratedMarkdown(descriptor.markdown, document.markdown, data, document.ids);
    validateGeneratedHtml(descriptor.html, document.html, {
      interactive: true,
      markdownFilename: descriptor.markdown,
      expectedIds: document.ids,
    });
    artifacts.set(join(sourceOutputRoot, descriptor.markdown), Buffer.from(document.markdown));
    artifacts.set(join(publicOutputRoot, descriptor.markdown), Buffer.from(document.markdown));
    artifacts.set(join(publicOutputRoot, descriptor.html), Buffer.from(document.html));
  }

  const index = indexHtml(data, releaseRegister);
  validateGeneratedHtml("index.html", index, { interactive: false });
  for (const descriptor of data.artifacts) {
    if (!index.includes(`href="${descriptor.html}"`) || !index.includes(`href="${descriptor.markdown}"`)) {
      fail(`index.html omits ${descriptor.id}.`);
    }
  }
  artifacts.set(join(publicOutputRoot, "index.html"), Buffer.from(index));
  artifacts.set(join(publicOutputRoot, "documentation-atlas.json"), canonicalBytes);
  for (const filename of releaseEvidenceFilenames) {
    artifacts.set(join(publicOutputRoot, filename), readFileSync(join(sourceOutputRoot, filename)));
  }

  const listedArtifacts = [...artifacts.entries()].map(([path, bytes]) => ({
    path: relative(projectRoot, path).split(sep).join("/"),
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  })).sort((left, right) => left.path.localeCompare(right.path));
  const artifactPairs = data.artifacts.map((descriptor) => {
    const sourcePath = `docs/text-to-lattice/${descriptor.markdown}`;
    const publicPath = `public/documentation/text-to-lattice/${descriptor.markdown}`;
    const sourceArtifact = listedArtifacts.find((entry) => entry.path === sourcePath);
    const publicArtifact = listedArtifacts.find((entry) => entry.path === publicPath);
    if (!sourceArtifact || !publicArtifact || sourceArtifact.sha256 !== publicArtifact.sha256) {
      fail(`source/public Markdown parity failed for ${descriptor.id}.`);
    }
    return {
      artifactId: descriptor.id,
      title: descriptor.title,
      scope: descriptor.scope,
      html: descriptor.html,
      markdown: descriptor.markdown,
      sourcePath,
      publicPath,
      sha256: sourceArtifact.sha256,
    };
  });
  const manifest = {
    format: "TEXT_TO_LATTICE_DOCUMENTATION_ARTIFACT_MANIFEST",
    schemaVersion: 1,
    revision: data.revision,
    algorithm: "SHA-256",
    authority: {
      canonicalSource: data.authority.canonicalSource,
      canonicalSourceSha256: sha256(canonicalBytes),
      builder: data.authority.builder,
      builderSha256: sha256(readFileSync(scriptPath)),
    },
    publicRoot: "/documentation/text-to-lattice/",
    artifactPairs,
    releaseEvidence: releaseEvidenceFilenames.map((filename) => {
      const artifact = listedArtifacts.find(({ path }) => path === `public/documentation/text-to-lattice/${filename}`);
      return { filename, bytes: artifact.bytes, sha256: artifact.sha256 };
    }),
    artifacts: listedArtifacts,
    note: "The manifest does not hash itself. Source and public Markdown pairs are byte-identical. A manifest proves bytes in this tree, not deployed identity.",
  };
  artifacts.set(
    join(publicOutputRoot, "artifact-manifest.json"),
    Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
  );
  return artifacts;
}

function commitArtifacts(artifacts) {
  const drift = [];
  for (const [path, expected] of [...artifacts.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const current = existsSync(path) ? readFileSync(path) : null;
    if (current?.equals(expected)) continue;
    drift.push(relative(projectRoot, path).split(sep).join("/"));
    if (!checkOnly) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, expected);
    }
  }
  if (checkOnly && drift.length > 0) {
    process.stderr.write(`Generated documentation drift:\n${drift.map((path) => `- ${path}`).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(checkOnly
    ? `Text to Lattice documentation is current (${artifacts.size} generated files).\n`
    : `Generated ${artifacts.size} Text to Lattice documentation files.\n`);
}

const canonicalBytes = readFileSync(canonicalPath);
const releaseRegisterBytes = readFileSync(releaseRegisterPath);
let atlas;
let releaseRegister;
try {
  atlas = JSON.parse(canonicalBytes.toString("utf8"));
  releaseRegister = JSON.parse(releaseRegisterBytes.toString("utf8"));
} catch (error) {
  fail(`canonical documentation or release register is not valid JSON: ${error.message}`);
}
validateAtlas(atlas);
validateReleaseGateProjection(atlas, releaseRegister);
await validateProjectDocumentRegistry(atlas);
commitArtifacts(buildArtifacts(atlas, canonicalBytes, releaseRegister));
