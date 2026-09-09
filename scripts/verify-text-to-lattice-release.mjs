import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LLAMA_3_2_TERMS_PROVENANCE,
  LATTICE_MODEL_ROLES,
  LATTICE_RUNTIME,
  LATTICE_STRUCTURED_OUTPUT_RUNTIME,
  LATTICE_TOKENIZER_FILENAME,
  LATTICE_TOKENIZER_RUNTIME,
  LATTICE_TOKENIZER_SHA256,
  LATTICE_WASM_BUILD_LINEAGE,
  LATTICE_WASM_REPOSITORY,
  LATTICE_WASM_REVISION,
  LATTICE_WASM_SHA256,
} from "../app/resume/lattice/modelContract.js";
import { projectBySlug } from "../app/resume/projects.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registerPath = join(root, "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json");
const atlasPath = join(root, "docs/text-to-lattice/LATTICE-DOCUMENTATION-ATLAS.json");
const qualificationPath = join(root, "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md");
const llamaEvaluationPath = join(root, "docs/text-to-lattice/LLAMA-USE-EVALUATION-CASES.json");
const canonicalRegisterSource = "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json";
const canonicalQualificationSource = "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md";
const expectedGateIds = Object.freeze([
  "GATE-01",
  "GATE-02",
  "GATE-03",
  "GATE-04A",
  "GATE-04B",
  "GATE-04C",
  "GATE-05",
  "GATE-06",
]);
const gateStatuses = new Set(["satisfied-in-source", "open-before-publication"]);
const marginalValues = new Set(["high", "moderate", "low", "negative"]);
const sha256Pattern = /^[a-f0-9]{64}$/u;
const gitRevisionPattern = /^[a-f0-9]{40}$/u;
const dateRevisionPattern = /^\d{4}-\d{2}-\d{2}$/u;
const heldRuntimeAssetPatterns = Object.freeze([
  /\.wasm$/iu,
  /\.(?:bin|safetensors|params|ndarray|gguf)$/iu,
  /(?:^|\/)tokenizer(?:_config)?\.json$/iu,
  /(?:^|\/)tokenizer\.model$/iu,
  /(?:^|\/)mlc-chat-config\.json$/iu,
  /(?:^|\/)ndarray-cache(?:-[^/]*)?\.json$/iu,
]);
const heldExecutableExtensions = new Set([".js", ".mjs", ".cjs", ".map"]);
const heldArtifactDigests = new Set([
  ...Object.values(LATTICE_WASM_SHA256),
  ...Object.values(LATTICE_TOKENIZER_SHA256),
]);
const heldForbiddenNetworkStrings = Object.freeze([
  "/api/text-to-lattice/lease",
  "https://verify.hah.dev",
  "huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC/resolve/",
  "huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/resolve/",
  "raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs",
  "Qwen3-4B-q4f16_1-ctx4k_cs1k-webgpu.wasm",
  "Llama-3.2-3B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
]);
const heldForbiddenExecutableStrings = Object.freeze([
  ...heldForbiddenNetworkStrings,
  "@mlc-ai/web-llm",
  "CreateMLCEngine",
  "CreateWebWorkerMLCEngine",
  "WebWorkerMLCEngine",
  "text-to-lattice:model:v1",
  "lattice-demo-dialog",
  "lattice-demo-input",
]);
const serializedVinextRscScript = /^\s*\(\(self\[Symbol\.for\("vinext\.navigationRuntime"\)\]\?\?=\{bootstrap:\{routeManifest:null\},functions:\{\}\}\)\.bootstrap\.rsc\?\?=\{rsc:\[\]\}\)\.rsc\.push\(("(?:\\[\s\S]|[^"\\])*")\)\s*;?\s*$/u;
const expectedLlamaUseCases = new Map([
  ["AUP-DENY-01", ["operational-harm", false]],
  ["AUP-DENY-02", ["malware-improvement", false]],
  ["AUP-DENY-03", ["deliberate-deception", false]],
  ["AUP-DENY-04", ["unauthorized-professional-practice", false]],
  ["AUP-DENY-05", ["sensitive-person-inference", false]],
  ["AUP-ALLOW-01", ["journalism", true]],
  ["AUP-ALLOW-02", ["history-and-criticism", true]],
  ["AUP-ALLOW-03", ["fiction", true]],
  ["AUP-ALLOW-04", ["prevention-and-defense", true]],
  ["AUP-ALLOW-05", ["rights-analysis", true]],
]);

function fail(message) {
  throw new Error(`Text to Lattice release verification failed: ${message}`);
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(`${label} must be a nonempty string.`);
  return value;
}

function exactIds(records, expected, label) {
  if (!Array.isArray(records)) fail(`${label} must be an array.`);
  const ids = records.map((record) => record?.id);
  if (new Set(ids).size !== ids.length || ids.length !== expected.length || expected.some((id) => !ids.includes(id))) {
    fail(`${label} must contain ${expected.join(", ")} exactly once.`);
  }
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

function machineValueLabel(value) {
  const words = value.replaceAll("-", " ");
  return `${words[0].toUpperCase()}${words.slice(1)}`;
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail(`${label} is not readable JSON: ${error.message}`);
  }
}

async function verifyTerms(register) {
  for (const [key, label] of [["license", "Llama license"], ["acceptableUsePolicy", "Llama acceptable-use policy"]]) {
    const record = register.artifactSet.llamaTerms[key];
    requireString(record.path, `${label} path`);
    if (!sha256Pattern.test(record.sha256)) fail(`${label} must carry a lowercase SHA-256 digest.`);
    const bytes = await readFile(join(root, record.path));
    if (digest(bytes) !== record.sha256) fail(`${label} digest does not match ${record.path}.`);
    if (!new URL(record.canonicalUrl).hostname.endsWith("meta.com")) fail(`${label} canonical URL must be a Meta origin.`);
  }
}

async function verifyLlamaUseEvaluation(register) {
  const evaluation = await readJson(llamaEvaluationPath, "Llama-use evaluation fixture");
  const record = register.artifactSet.llamaBehaviorEvaluation;
  if (evaluation.format !== "TEXT_TO_LATTICE_LLAMA_USE_EVALUATION_CASES" || evaluation.schemaVersion !== 1) {
    fail("Llama-use evaluation fixture format is unsupported.");
  }
  requireString(evaluation.claimBoundary, "Llama-use evaluation claim boundary");
  requireString(evaluation.decisionRule, "Llama-use evaluation decision rule");
  exactIds(evaluation.cases, [...expectedLlamaUseCases.keys()], "Llama-use evaluation cases");
  for (const item of evaluation.cases) {
    const [expectedClass, expectedSafety] = expectedLlamaUseCases.get(item.id);
    if (item.class !== expectedClass || item.expectedSafety !== expectedSafety) {
      fail(`${item.id} changed its reviewed class or expected safety disposition.`);
    }
    for (const field of ["source", "rationale"]) requireString(item[field], `${item.id} ${field}`);
    if (item.source.includes("\n") || item.source.length > 260 || /https?:\/\/|```/iu.test(item.source)) {
      fail(`${item.id} must remain a short, non-operational text fixture.`);
    }
  }
  const allowCount = evaluation.cases.filter(({ expectedSafety }) => expectedSafety).length;
  const denyCount = evaluation.cases.length - allowCount;
  if (record.path !== "docs/text-to-lattice/LLAMA-USE-EVALUATION-CASES.json"
    || record.caseCount !== evaluation.cases.length
    || record.expectedAllowCount !== allowCount
    || record.expectedDenyCount !== denyCount
    || record.fixtureStatus !== "defined-and-machine-checked"
    || record.exactModelExecutionStatus !== "open-before-publication") {
    fail("Llama-use evaluation evidence drifted from the release register.");
  }
  const bytes = await readFile(llamaEvaluationPath);
  if (!sha256Pattern.test(record.sha256) || digest(bytes) !== record.sha256) {
    fail("Llama-use evaluation fixture digest drifted from the release register.");
  }
}

async function verifyQualificationDossier(register) {
  const bytes = await readFile(qualificationPath);
  if (!sha256Pattern.test(register.authority.qualificationDossierSha256)
    || digest(bytes) !== register.authority.qualificationDossierSha256) {
    fail("release qualification dossier digest drifted from the release register.");
  }
  const source = bytes.toString("utf8");
  const artifactSetDigest = digest(Buffer.from(JSON.stringify(canonicalJson(register.artifactSet))));
  const artifacts = register.artifactSet;
  const artifactClaims = [
    ...[artifacts.runtime, artifacts.tokenizerRuntime, artifacts.structuredOutputRuntime]
      .flatMap(({ name, version, url }) => [name, version, url]),
    ...["generator", "verifier"].flatMap((role) => [
      artifacts.models[role].id,
      artifacts.models[role].revision,
      artifacts.models[role].artifactUrl,
      artifacts.tokenizers[role].path,
      artifacts.tokenizers[role].sha256,
      artifacts.wasm.files[role].name,
      artifacts.wasm.files[role].bytes.toLocaleString("en-US"),
      artifacts.wasm.files[role].sha256,
      artifacts.wasm.files[role].sri,
      artifacts.wasm.files[role].gitBlob,
    ]),
    artifacts.wasm.repository,
    artifacts.wasm.repositoryRevision,
    artifacts.wasm.directory,
    ...["initialArtifactCommit", "finalArtifactCommit", "introducingMergeCommit", "pullRequest", "recordedTvmSourceRevision", "earlyTimePlausibleTvmPrHeadRevision", "mlcLlmSourceRevision", "historicalBuildScript", "tokenizersCppRevision"]
      .map((field) => artifacts.wasm.lineage[field]),
    artifacts.llamaTerms.officialSourceCommit,
    artifacts.llamaTerms.license.sha256,
    artifacts.llamaTerms.license.canonicalUrl,
    artifacts.llamaTerms.acceptableUsePolicy.sha256,
    artifacts.llamaTerms.acceptableUsePolicy.canonicalUrl,
    artifacts.llamaBehaviorEvaluation.sha256,
  ];
  const gateRows = register.gates.map((gate) => `| ${gate.id} · ${gate.label} | ${machineValueLabel(gate.status)} | ${machineValueLabel(gate.marginalValue)} |`);
  for (const required of [
    register.implementationRevision,
    artifactSetDigest,
    `**Qualification date:** ${register.revision}`,
    ...artifactClaims,
    ...(register.overallStatus === "held" && register.publicClient?.status === "held"
      ? ["**Decision:** hold the interactive client; publish the method, implementation record, and documentation only."]
      : []),
    ...(register.ownerDisposition?.status === "pending" ? ["No owner approval is recorded."] : []),
    ...gateRows,
    "consequence × plausibility × lifecycle value",
    ...expectedGateIds,
  ]) {
    if (!source.includes(required)) fail(`release qualification dossier omits ${required}.`);
  }
}

function verifyArtifactSet(register) {
  const artifacts = register.artifactSet;
  for (const [record, contract, label] of [
    [artifacts.runtime, LATTICE_RUNTIME, "WebLLM"],
    [artifacts.tokenizerRuntime, LATTICE_TOKENIZER_RUNTIME, "tokenizer runtime"],
    [artifacts.structuredOutputRuntime, LATTICE_STRUCTURED_OUTPUT_RUNTIME, "structured-output runtime"],
  ]) {
    if (record.name !== contract.name) fail(`${label} name drifted from the release register.`);
    if (record.version !== contract.version) fail(`${label} version drifted from the release register.`);
    if (record.url !== contract.repository) fail(`${label} repository URL drifted from the release register.`);
  }

  for (const role of ["generator", "verifier"]) {
    if (artifacts.models[role].id !== LATTICE_MODEL_ROLES[role].id) fail(`${role} model identifier drifted from the release register.`);
    if (artifacts.models[role].revision !== LATTICE_MODEL_ROLES[role].revision) fail(`${role} model revision drifted from the release register.`);
    if (artifacts.models[role].artifactUrl !== LATTICE_MODEL_ROLES[role].revisionUrl) fail(`${role} model artifact URL drifted from the release register.`);
    if (artifacts.models[role].baseModelUrl !== LATTICE_MODEL_ROLES[role].baseModelRepository) fail(`${role} base-model URL drifted from the release register.`);
    if (artifacts.tokenizers[role].path !== LATTICE_TOKENIZER_FILENAME) fail(`${role} tokenizer path drifted from the release register.`);
    if (artifacts.tokenizers[role].sha256 !== LATTICE_TOKENIZER_SHA256[role]) fail(`${role} tokenizer digest drifted from the release register.`);
    const wasm = artifacts.wasm.files[role];
    if (!Number.isSafeInteger(wasm.bytes) || wasm.bytes <= 0) fail(`${role} WASM byte count is invalid.`);
    if (!sha256Pattern.test(wasm.sha256)) fail(`${role} WASM digest is invalid.`);
    if (wasm.sha256 !== LATTICE_WASM_SHA256[role]) fail(`${role} WASM digest drifted from the model contract.`);
    if (wasm.sri !== `sha256-${Buffer.from(wasm.sha256, "hex").toString("base64")}`) fail(`${role} WASM SRI does not encode its SHA-256 digest.`);
    if (!gitRevisionPattern.test(wasm.gitBlob)) fail(`${role} WASM git blob is invalid.`);
    if (!LATTICE_MODEL_ROLES[role].modelLib.endsWith(`/${wasm.name}`)) fail(`${role} WASM filename drifted from the model contract.`);
  }
  if (artifacts.wasm.repository !== LATTICE_WASM_REPOSITORY) fail("WASM repository URL drifted from the release register.");
  if (artifacts.wasm.repositoryRevision !== LATTICE_WASM_REVISION) fail("WASM repository revision drifted from the release register.");
  if (artifacts.wasm.directory !== LATTICE_WASM_BUILD_LINEAGE.releaseDirectory) fail("WASM release directory drifted from the release register.");
  for (const field of ["initialArtifactCommit", "finalArtifactCommit", "introducingMergeCommit", "recordedTvmSourceRevision", "earlyTimePlausibleTvmPrHeadRevision", "mlcLlmSourceRevision", "tokenizersCppRevision"]) {
    if (!gitRevisionPattern.test(artifacts.wasm.lineage[field])) fail(`WASM lineage ${field} is invalid.`);
  }
  if (artifacts.wasm.lineage.initialArtifactCommit !== LATTICE_WASM_BUILD_LINEAGE.initialArtifactCommit
    || artifacts.wasm.lineage.finalArtifactCommit !== LATTICE_WASM_BUILD_LINEAGE.finalArtifactCommit
    || artifacts.wasm.lineage.introducingMergeCommit !== LATTICE_WASM_BUILD_LINEAGE.pullRequestMergeCommit
    || artifacts.wasm.lineage.recordedTvmSourceRevision !== LATTICE_WASM_BUILD_LINEAGE.tvmCommit
    || artifacts.wasm.lineage.earlyTimePlausibleTvmPrHeadRevision !== LATTICE_WASM_BUILD_LINEAGE.earlyTimePlausibleTvmPrHeadRevision
    || artifacts.wasm.lineage.mlcLlmSourceRevision !== LATTICE_WASM_BUILD_LINEAGE.mlcLlmCommit
    || artifacts.wasm.lineage.pullRequest !== LATTICE_WASM_BUILD_LINEAGE.pullRequestUrl) {
    fail("WASM source lineage drifted from the model contract.");
  }
  if (artifacts.wasm.lineage.status !== "partial-source-lineage-recorded") fail("WASM lineage must not be overstated beyond its partial recorded source claim.");
  if (artifacts.wasm.lineage.pinnedRevisionContainsBuildScript !== false) fail("the pinned binary revision must not be represented as containing the deleted build helper.");
  if (artifacts.wasm.lineage.historicalQwenPresetResolvableAtRecordedMlcRevision !== false
    || artifacts.wasm.lineage.tokenizersCppHasCargoLock !== false) {
    fail("historical WASM recipe gaps must remain explicit until separately requalified.");
  }
  if (artifacts.wasm.abiInspection.importCountPerFile !== 13 || artifacts.wasm.abiInspection.exportCountPerFile !== 93
    || artifacts.wasm.abiInspection.allocEmbeddingTensorBytes.generator !== 5242880
    || artifacts.wasm.abiInspection.allocEmbeddingTensorBytes.verifier !== 6291456
    || artifacts.wasm.abiInspection.customSections.length !== 0) fail("WASM ABI inspection record is incomplete or drifted.");
  if (artifacts.wasm.reproducibility.status !== "open-before-publication") fail("WASM reproducibility may close only with a separately reviewed register revision.");
  if (artifacts.models.verifier.artifactProvenanceStatus !== "open-before-publication") fail("Llama MLC artifact provenance is not presently closed.");
  if (artifacts.llamaTerms.officialSourceCommit !== LLAMA_3_2_TERMS_PROVENANCE.upstreamCommit
    || artifacts.llamaTerms.license.sha256 !== LLAMA_3_2_TERMS_PROVENANCE.sha256.license
    || artifacts.llamaTerms.acceptableUsePolicy.sha256 !== LLAMA_3_2_TERMS_PROVENANCE.sha256.acceptableUsePolicy
    || artifacts.llamaTerms.license.canonicalUrl !== LLAMA_3_2_TERMS_PROVENANCE.licenseUrl
    || artifacts.llamaTerms.acceptableUsePolicy.canonicalUrl !== LLAMA_3_2_TERMS_PROVENANCE.acceptableUseUrl) {
    fail("Llama terms provenance drifted from the model contract.");
  }
}

async function verifySourceBoundary(register) {
  if (register.format !== "TEXT_TO_LATTICE_RELEASE_REGISTER" || register.schemaVersion !== 1) fail("release-register format is unsupported.");
  const revisionDate = new Date(`${register.revision}T00:00:00Z`);
  if (!dateRevisionPattern.test(register.revision)
    || Number.isNaN(revisionDate.valueOf())
    || revisionDate.toISOString().slice(0, 10) !== register.revision) {
    fail("release-register revision must be a valid YYYY-MM-DD date.");
  }
  if (register.authority?.canonicalSource !== canonicalRegisterSource) fail("release-register canonical source declaration drifted.");
  if (register.authority?.qualificationDossier !== canonicalQualificationSource) fail("release qualification dossier declaration drifted.");
  if (!gitRevisionPattern.test(register.implementationRevision)) fail("implementationRevision must identify the reviewed baseline commit.");
  if (!Array.isArray(register.statusVocabulary) || register.statusVocabulary.length !== gateStatuses.size
    || [...gateStatuses].some((status) => !register.statusVocabulary.includes(status))) {
    fail("statusVocabulary does not match the enforced gate vocabulary.");
  }
  requireString(register.authority?.decisionRule, "release decision rule");
  requireString(register.authority?.marginalValueRule, "marginal-value rule");
  exactIds(register.gates, expectedGateIds, "release gates");
  for (const gate of register.gates) {
    if (!gateStatuses.has(gate.status)) fail(`${gate.id} has an unsupported status.`);
    if (!marginalValues.has(gate.marginalValue)) fail(`${gate.id} has an unsupported marginal-value classification.`);
    for (const field of ["label", "requirement", "currentEvidence", "evidenceNeeded"]) requireString(gate[field], `${gate.id} ${field}`);
  }

  const atlas = await readJson(atlasPath, "documentation atlas");
  if (atlas.revision !== register.revision) fail("release register and documentation atlas revisions diverge.");
  exactIds(atlas.securityModel?.prePublicationGates, expectedGateIds, "documentation-atlas gates");
  for (const gate of register.gates) {
    const atlasGate = atlas.securityModel.prePublicationGates.find(({ id }) => id === gate.id);
    for (const field of ["label", "status", "marginalValue", "requirement", "currentEvidence", "evidenceNeeded"]) {
      if (atlasGate[field] !== gate[field]) fail(`${gate.id} ${field} diverges between release register and documentation atlas.`);
    }
  }

  verifyArtifactSet(register);
  await verifyTerms(register);
  await verifyLlamaUseEvaluation(register);
  await verifyQualificationDossier(register);

  const [viewSource, heldSource, projectsSource, routesSource] = await Promise.all([
    readFile(join(root, "app/resume/ResumeView.tsx"), "utf8"),
    readFile(join(root, "app/resume/ResumeProjectsHeld.tsx"), "utf8"),
    readFile(join(root, "app/resume/projects.js"), "utf8"),
    readFile(join(root, "app/semantic/routes.js"), "utf8"),
  ]);
  const lattice = projectBySlug("lattice");
  if (!lattice) fail("Lattice project record is absent.");

  const hasOpenGate = register.gates.some(({ status }) => status !== "satisfied-in-source");
  const enabled = register.overallStatus === "eligible" && register.publicClient?.status === "enabled";
  if (enabled) {
    if (hasOpenGate) fail("an enabled public client cannot carry an open gate.");
    if (register.ownerDisposition?.status !== "approved") fail("an enabled public client requires exact-revision owner approval.");
    if (!gitRevisionPattern.test(register.ownerDisposition.revision ?? "")) fail("enabled owner approval requires an exact revision.");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(register.ownerDisposition.decidedAt ?? "")) fail("enabled owner approval requires an ISO UTC decision time.");
    requireString(register.ownerDisposition.record, "enabled owner approval record");
    for (const gate of register.gates) {
      if (!Array.isArray(gate.evidence) || gate.evidence.length === 0) fail(`${gate.id} requires evidence before enablement.`);
      requireString(gate.satisfiedAt, `${gate.id} satisfiedAt`);
    }
    if (!viewSource.includes('from "./ResumeProjects"') || viewSource.includes('from "./ResumeProjectsHeld"')) fail("eligible mode must deliberately import the interactive project surface.");
    if (lattice.interactiveRelease !== "enabled") fail("eligible mode requires the Lattice project record to say enabled.");
    if (lattice.interaction !== "lattice-demo") fail("eligible mode requires the explicit Lattice interaction activation marker.");
    fail("public-client enablement requires a separately reviewed validator revision; register and activation edits alone cannot publish inference.");
  } else {
    if (register.overallStatus !== "held" || register.publicClient?.status !== "held") fail("any noneligible state must be held consistently.");
    if (register.publicClient.publicationMode !== "documentation-only") fail("held publication must be documentation-only.");
    if (register.ownerDisposition?.status === "approved") fail("held publication cannot carry an active owner approval.");
    if (!viewSource.includes('from "./ResumeProjectsHeld"') || viewSource.includes('from "./ResumeProjects"')) fail("held mode must import only the held project surface.");
    if (lattice.interactiveRelease !== "held") fail("held mode requires the Lattice project record to say held.");
    if (lattice.interaction !== null) fail("held mode must remove the public interaction activation marker.");
    const heldImports = [...projectsSource.matchAll(/^import\s+.+?from\s+["']([^"']+)["'];?$/gmu)].map((match) => match[1]);
    if (heldImports.some((specifier) => specifier.includes("siteContent") || /(?:^|\/)lattice(?:\/|$)/u.test(specifier))) {
      fail("held project metadata must not import the model, usage policy, or monolithic site-content graph.");
    }
    for (const pattern of [/<form\b/iu, /<textarea\b/iu, /role="dialog"/u, /aria-haspopup=/u, /from\s+["'].+\/(?:lattice|latticeDemo)/u]) {
      if (pattern.test(heldSource)) fail(`held project surface contains prohibited interactive code: ${pattern}.`);
    }
  }

  for (const filename of ["LLAMA-USE-EVALUATION-CASES.json", "TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md", "TEXT-TO-LATTICE-RELEASE-REGISTER.json"]) {
    if (!routesSource.includes(filename)) fail(`${filename} is not exported with the static documentation.`);
  }
  for (const label of ["Concept Map", "Skill Map", "Service Blueprint", "Security Model", "Release Qualification"]) {
    if (!lattice.resources.some((resource) => resource.label === label && resource.icon === "backpack4")) fail(`Lattice resource ${label} is missing its documentation icon.`);
  }

  return { register, enabled };
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) fail(`held site contains a symbolic link: ${relative(root, path).split("\\").join("/")}.`);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }))).flat();
}

function htmlTagEnd(source, start) {
  let quote = null;
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return cursor;
    }
  }
  return -1;
}

function scanHtmlStartTags(source) {
  const tags = [];
  const rawTextElements = new Set(["script", "style", "textarea", "title"]);
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf("<", cursor);
    if (start < 0) break;
    if (source.startsWith("<!--", start)) {
      const commentEnd = source.indexOf("-->", start + 4);
      cursor = commentEnd < 0 ? source.length : commentEnd + 3;
      continue;
    }
    if (["!", "?", "/"].includes(source[start + 1])) {
      const end = htmlTagEnd(source, start + 2);
      cursor = end < 0 ? source.length : end + 1;
      continue;
    }
    if (!/[a-z]/iu.test(source[start + 1] ?? "")) {
      cursor = start + 1;
      continue;
    }

    let nameEnd = start + 2;
    while (/[\w:-]/u.test(source[nameEnd] ?? "")) nameEnd += 1;
    const name = source.slice(start + 1, nameEnd).toLowerCase();
    const end = htmlTagEnd(source, nameEnd);
    if (end < 0) {
      tags.push({ name, attributes: source.slice(nameEnd), content: "", closed: false });
      break;
    }
    const tag = { name, attributes: source.slice(nameEnd, end), content: null, closed: true };
    tags.push(tag);
    cursor = end + 1;

    if (rawTextElements.has(name)) {
      const closing = new RegExp(`</${name}\\s*>`, "giu");
      closing.lastIndex = cursor;
      const match = closing.exec(source);
      tag.content = match ? source.slice(cursor, match.index) : source.slice(cursor);
      tag.closed = Boolean(match);
      cursor = match ? closing.lastIndex : source.length;
    }
  }
  return tags;
}

function tokenizeHtmlAttributes(source) {
  const attributes = new Map();
  const isSpace = (character) => character !== undefined && " \t\n\f\r".includes(character);
  let cursor = 0;
  while (cursor < source.length) {
    while (isSpace(source[cursor]) || source[cursor] === "/") cursor += 1;
    if (cursor >= source.length || source[cursor] === ">") break;

    const nameStart = cursor;
    while (cursor < source.length
      && !isSpace(source[cursor])
      && !["/", "=", ">"].includes(source[cursor])) cursor += 1;
    const name = source.slice(nameStart, cursor).toLowerCase();
    if (!name) {
      cursor += 1;
      continue;
    }

    while (isSpace(source[cursor])) cursor += 1;
    let value = "";
    if (source[cursor] === "=") {
      cursor += 1;
      while (isSpace(source[cursor])) cursor += 1;
      const quote = source[cursor] === '"' || source[cursor] === "'" ? source[cursor] : null;
      if (quote) {
        cursor += 1;
        const valueStart = cursor;
        while (cursor < source.length && source[cursor] !== quote) cursor += 1;
        value = source.slice(valueStart, cursor);
        if (source[cursor] === quote) cursor += 1;
      } else {
        const valueStart = cursor;
        while (cursor < source.length && !isSpace(source[cursor]) && source[cursor] !== ">") cursor += 1;
        value = source.slice(valueStart, cursor);
      }
    }
    if (!attributes.has(name)) attributes.set(name, value);
  }
  return attributes;
}

function htmlAttribute(attributes, name) {
  const parsed = tokenizeHtmlAttributes(attributes);
  return parsed.has(name.toLowerCase()) ? parsed.get(name.toLowerCase()) : null;
}

function decodeHtmlAttribute(value) {
  const decoded = value.replace(/&(?:#(\d+);?|#x([a-f\d]+);?|(amp|apos|gt|lt|quot);)/giu, (entity, decimal, hexadecimal, named) => {
    if (decimal || hexadecimal) {
      const codePoint = Number.parseInt(decimal ?? hexadecimal, hexadecimal ? 16 : 10);
      return Number.isSafeInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    return { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' }[named.toLowerCase()];
  });
  if (/&(?:#(?:\d+|x[a-f\d]+);?|[a-z][a-z\d]+;)/iu.test(decoded)) {
    fail(`HTML attribute contains an unsupported character reference: ${value}.`);
  }
  return decoded;
}

function executableInlineSource(source) {
  const serializedPayload = serializedVinextRscScript.exec(source);
  // Vinext's exact, closed wrapper executes only a push of serialized RSC data.
  // Remove that inert payload so visible documentation is not mistaken for code.
  return serializedPayload ? source.replace(serializedPayload[1], '""') : source;
}

function verifyForbiddenStrings(source, label, forbiddenStrings) {
  const decodedSource = source.replace(/(?:%[a-f\d]{2})+/giu, (sequence) => {
    try {
      return decodeURIComponent(sequence);
    } catch {
      return sequence;
    }
  });
  for (const forbidden of forbiddenStrings) {
    const urlLike = /^(?:https?:\/\/|huggingface\.co\/|raw\.githubusercontent\.com\/)/u.test(forbidden);
    if (source.includes(forbidden)
      || decodedSource.includes(forbidden)
      || (urlLike && (source.toLowerCase().includes(forbidden.toLowerCase())
        || decodedSource.toLowerCase().includes(forbidden.toLowerCase())))) {
      fail(`${label} contains ${forbidden}.`);
    }
  }
}

function verifyExecutableSource(source, label) {
  verifyForbiddenStrings(source, label, heldForbiddenExecutableStrings);
}

function verifyNetworkReference(source, label) {
  verifyForbiddenStrings(source, label, heldForbiddenNetworkStrings);
}

function htmlRouteUrl(site, htmlPath) {
  return `https://hah.dev/${relative(site, htmlPath).split("\\").join("/")}`;
}

function localScriptTarget(site, htmlPath, rawSource) {
  const source = decodeHtmlAttribute(rawSource.trim());
  if (!source) fail(`held HTML route ${relative(site, htmlPath)} contains an empty script source.`);
  let url;
  try {
    url = new URL(source, htmlRouteUrl(site, htmlPath));
  } catch (error) {
    fail(`held HTML route ${relative(site, htmlPath)} contains an invalid script source ${rawSource}: ${error.message}`);
  }
  if (url.origin !== "https://hah.dev") {
    fail(`held HTML route ${relative(site, htmlPath)} references a cross-origin executable script: ${rawSource}.`);
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch (error) {
    fail(`local script source has invalid percent encoding ${rawSource}: ${error.message}`);
  }
  const target = resolve(site, `.${pathname}`);
  const targetRelative = relative(site, target);
  if (targetRelative === ".." || targetRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(targetRelative)) {
    fail(`local script source escapes the held site root: ${rawSource}.`);
  }
  return target;
}

async function verifyReferencedScript(site, htmlPath, rawSource, inspectedScripts) {
  const target = localScriptTarget(site, htmlPath, rawSource);
  if (!target || inspectedScripts.has(target)) return;
  inspectedScripts.add(target);
  let bytes;
  try {
    bytes = await readFile(target);
  } catch (error) {
    fail(`local script source ${rawSource} from ${relative(site, htmlPath)} is unreadable: ${error.message}`);
  }
  const rel = relative(site, target).split("\\").join("/");
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) {
    fail(`held referenced script asset ${rel} is WebAssembly.`);
  }
  verifyExecutableSource(bytes.toString("utf8"), `held referenced script asset ${rel}`);
}

function verifyHeldNavigationBoundary(site, htmlPath, tags) {
  const rel = relative(site, htmlPath).split("\\").join("/");
  for (const [element, attribute] of [["iframe", "src"], ["form", "action"], ["button", "formaction"], ["input", "formaction"]]) {
    for (const tag of tags.filter(({ name }) => name === element)) {
      const rawTarget = htmlAttribute(tag.attributes, attribute);
      if (rawTarget === null || rawTarget.trim() === "") continue;
      const target = decodeHtmlAttribute(rawTarget.trim());
      let url;
      try {
        url = new URL(target, htmlRouteUrl(site, htmlPath));
      } catch (error) {
        fail(`held HTML route ${rel} contains an invalid ${element} ${attribute}: ${error.message}`);
      }
      if (url.hostname === "verify.hah.dev" || (url.origin === "https://hah.dev" && url.pathname.startsWith("/api/text-to-lattice/lease"))) {
        fail(`held HTML route ${rel} exposes the verification or lease boundary through ${element} ${attribute}.`);
      }
    }
  }
}

function verifyAutomaticFetchContexts(site, htmlPath, tags) {
  const rel = relative(site, htmlPath).split("\\").join("/");
  const verifyAttribute = (element, attributes, attribute) => {
    const rawValue = htmlAttribute(attributes, attribute);
    if (rawValue === null || rawValue.trim() === "") return;
    verifyNetworkReference(
      decodeHtmlAttribute(rawValue),
      `held network-active ${element} ${attribute} in ${rel}`,
    );
  };

  for (const tag of tags.filter(({ name }) => name === "link")) {
    const rawRel = htmlAttribute(tag.attributes, "rel");
    const relationships = new Set((rawRel === null ? "" : decodeHtmlAttribute(rawRel).toLowerCase()).split(/\s+/u));
    if (["icon", "modulepreload", "prefetch", "preload", "stylesheet"].some((value) => relationships.has(value))) {
      verifyAttribute("link", tag.attributes, "href");
    }
  }

  for (const [element, attributes] of [
    ["audio", ["src"]],
    ["embed", ["src"]],
    ["iframe", ["src"]],
    ["image", ["href", "xlink:href"]],
    ["img", ["src", "srcset"]],
    ["input", ["src"]],
    ["object", ["data"]],
    ["source", ["src", "srcset"]],
    ["track", ["src"]],
    ["video", ["poster", "src"]],
  ]) {
    for (const tag of tags.filter(({ name }) => name === element)) {
      for (const attribute of attributes) verifyAttribute(element, tag.attributes, attribute);
    }
  }

  for (const tag of tags) {
    verifyAttribute("element", tag.attributes, "style");
  }
  for (const tag of tags.filter(({ name }) => name === "style")) {
    verifyNetworkReference(tag.content ?? "", `held inline style block in ${rel}`);
  }
}

async function verifyHtmlRoute(site, htmlPath, inspectedScripts) {
  const source = await readFile(htmlPath, "utf8");
  const rel = relative(site, htmlPath).split("\\").join("/");
  const tags = scanHtmlStartTags(source);
  const interactiveIds = new Set(["lattice-demo-dialog", "lattice-demo-input", "lattice-use-confirmation"]);
  for (const tag of tags) {
    const attributes = tokenizeHtmlAttributes(tag.attributes);
    if (tag.name === "base") fail(`held HTML route ${rel} contains a base element.`);
    if (tag.name === "iframe" && attributes.has("srcdoc")) {
      fail(`held HTML route ${rel} contains an executable iframe srcdoc.`);
    }
    const id = attributes.has("id") ? decodeHtmlAttribute(attributes.get("id")) : "";
    const controls = attributes.has("aria-controls")
      ? decodeHtmlAttribute(attributes.get("aria-controls")).split(/\s+/u)
      : [];
    const classes = attributes.has("class")
      ? decodeHtmlAttribute(attributes.get("class")).split(/\s+/u)
      : [];
    if (interactiveIds.has(id) || controls.some((value) => interactiveIds.has(value)) || classes.includes("lattice-modal")) {
      fail(`held HTML route ${rel} contains a Lattice interactive marker.`);
    }
    if ([...attributes.keys()].some((name) => /^on[a-z]/u.test(name))) {
      fail(`held HTML route ${rel} contains an inline event handler.`);
    }
    for (const name of ["href", "src", "action", "formaction"]) {
      if (!attributes.has(name)) continue;
      const value = decodeHtmlAttribute(attributes.get(name)).trim();
      let protocol = null;
      try {
        protocol = new URL(value, htmlRouteUrl(site, htmlPath)).protocol;
      } catch {
        // Other malformed navigation values are inert for this held-boundary check.
      }
      if (protocol === "javascript:") fail(`held HTML route ${rel} contains a javascript: URL.`);
    }
  }
  verifyHeldNavigationBoundary(site, htmlPath, tags);
  verifyAutomaticFetchContexts(site, htmlPath, tags);

  for (const tag of tags.filter(({ name }) => name === "script")) {
    if (!tag.closed) fail(`held HTML route ${rel} contains an unmatched script element.`);
    const scriptSource = htmlAttribute(tag.attributes, "src");
    if (scriptSource !== null) {
      await verifyReferencedScript(site, htmlPath, scriptSource, inspectedScripts);
      continue;
    }
    const rawType = htmlAttribute(tag.attributes, "type");
    const type = rawType === null ? "" : decodeHtmlAttribute(rawType).trim().toLowerCase().split(";", 1)[0];
    if (type === "application/ld+json") continue;
    if (type === "application/json") {
      verifyNetworkReference(tag.content ?? "", `held inline JSON data in ${rel}`);
      continue;
    }
    verifyExecutableSource(executableInlineSource(tag.content ?? ""), `held inline executable script in ${rel}`);
  }
}

async function verifyBuiltBoundary(register, site) {
  if (!(await stat(site)).isDirectory()) fail("--site requires a built site directory.");
  const files = await filesBelow(site);
  if (register.publicClient.status !== "held") fail("site verification supports only the deliberately held public client until a separately reviewed validator revision.");

  const resume = await readFile(join(site, "resume/index.html"), "utf8");
  if (!/href="\/projects\/lattice\/text-to-lattice\/"[^>]*>Lattice<\/a>/u.test(resume)) fail("held résumé lacks the native Text to Lattice contract link.");

  const inspectedScripts = new Set();
  for (const path of files.filter((candidate) => extname(candidate).toLowerCase() === ".html")) {
    await verifyHtmlRoute(site, path, inspectedScripts);
  }

  for (const path of files) {
    const rel = relative(site, path).split("\\").join("/");
    if (/latticeWebllm|text-to-lattice[^/]*worker/iu.test(rel)) fail(`held site contains a Lattice model worker: ${rel}.`);
    if (heldRuntimeAssetPatterns.some((pattern) => pattern.test(rel))) {
      fail(`held site contains a model or inference-runtime asset: ${rel}.`);
    }
    const bytes = await readFile(path);
    if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) {
      fail(`held site contains WebAssembly bytes regardless of filename: ${rel}.`);
    }
    if (heldArtifactDigests.has(digest(bytes))) {
      fail(`held site contains a registered WASM or tokenizer artifact regardless of filename: ${rel}.`);
    }
    const extension = extname(path).toLowerCase();
    if (extension === ".css") {
      verifyNetworkReference(bytes.toString("utf8"), `held stylesheet ${rel}`);
      continue;
    }
    if (!heldExecutableExtensions.has(extension)) continue;
    verifyExecutableSource(bytes.toString("utf8"), `held executable asset ${rel}`);
  }

  for (const filename of ["LLAMA-USE-EVALUATION-CASES.json", "TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md", "TEXT-TO-LATTICE-RELEASE-REGISTER.json"]) {
    const exportedPath = files.find((path) => relative(site, path).split("\\").join("/") === `documentation/text-to-lattice/${filename}`);
    if (!exportedPath) {
      fail(`held site omits exported release evidence ${filename}.`);
    }
    const sourcePath = join(root, "docs/text-to-lattice", filename);
    const [sourceBytes, exportedBytes] = await Promise.all([readFile(sourcePath), readFile(exportedPath)]);
    if (!sourceBytes.equals(exportedBytes)) fail(`held site release evidence ${filename} is not byte-identical to its canonical source.`);
  }
}

const args = process.argv.slice(2);
const requested = new Set(args.filter((value) => !value.startsWith("--register=") && !value.startsWith("--site-root=")));
const registerArguments = args.filter((value) => value.startsWith("--register="));
const siteRootArguments = args.filter((value) => value.startsWith("--site-root="));
if ([...requested].some((value) => !["--source", "--site"].includes(value)) || registerArguments.length > 1 || siteRootArguments.length > 1) {
  fail("supported options are --source, --site, one --register=<path> test fixture, and one --site-root=<path> fixture.");
}
if (siteRootArguments.length && !requested.has("--site")) fail("--site-root requires --site.");
if (siteRootArguments[0] === "--site-root=") fail("--site-root requires a nonempty path.");
const selectedRegisterPath = registerArguments.length
  ? resolve(root, registerArguments[0].slice("--register=".length))
  : registerPath;
const selectedSiteRoot = siteRootArguments.length
  ? resolve(root, siteRootArguments[0].slice("--site-root=".length))
  : join(root, "site");
const { register } = await verifySourceBoundary(await readJson(selectedRegisterPath, "release register"));
if (requested.has("--site")) await verifyBuiltBoundary(register, selectedSiteRoot);
process.stdout.write(`Text to Lattice release boundary verified (${register.publicClient.status}${requested.has("--site") ? ", source and site" : ", source"}).\n`);
