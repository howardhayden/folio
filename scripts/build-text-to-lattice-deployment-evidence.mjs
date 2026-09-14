import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  LATTICE_TRANSFORMATION_CAPACITY_BINDING,
} from "../workers/text-to-lattice-api/capacityClient.js";
import {
  LATTICE_API_VISITOR_COOKIE_SECRET_BINDING,
} from "../workers/text-to-lattice-api/visitorCookie.js";

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const POSITIVE_DECIMAL_PATTERN = /^[1-9][0-9]{0,19}$/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const CANONICAL_URL = "https://hah.dev/resume/#text-to-lattice";
const DEPLOYED_AT_BASIS = "post-live-verification-service-evidence-index-generation";
const SAFE_EVIDENCE_FORMATS = new Set([
  "TEXT_TO_LATTICE_ROUTE_INVENTORY_EVIDENCE",
  "TEXT_TO_LATTICE_SECRET_BINDING_EVIDENCE",
  "TEXT_TO_LATTICE_REMOTE_DEPLOYMENT_EVIDENCE",
]);
const PROHIBITED_CONTENT_KEYS = new Set([
  "authorization",
  "body",
  "candidate",
  "cookie",
  "credential",
  "output",
  "prompt",
  "providerbody",
  "requestbody",
  "secret",
  "source",
  "text",
  "token",
]);
const MAXIMUM_EVIDENCE_BYTES = 64 * 1024;
const API_WORKER = "hahdev-text-to-lattice-api";
const POLICY_WORKER = "hahdev-text-to-lattice-response-policy";
export const LATTICE_QUALIFICATION_EXPIRY_BINDING = "LATTICE_QUALIFICATION_EXPIRES_AT";
const API_VERSION_BINDINGS = Object.freeze([
  Object.freeze({ name: "HF_TOKEN", type: "secret_text" }),
  Object.freeze({ name: LATTICE_API_VISITOR_COOKIE_SECRET_BINDING, type: "secret_text" }),
  Object.freeze({
    name: "LATTICE_API_RATE_LIMITER",
    type: "ratelimit",
    namespaceId: "857321",
    simple: Object.freeze({ limit: 30, period: 60 }),
  }),
  Object.freeze({
    name: LATTICE_TRANSFORMATION_CAPACITY_BINDING,
    type: "durable_object_namespace",
    className: "LatticeTransformationBudget",
  }),
]);

function expectedApiVersionBindings(qualificationExpiresAt = null) {
  if (qualificationExpiresAt === null) return API_VERSION_BINDINGS;
  return Object.freeze([
    ...API_VERSION_BINDINGS,
    Object.freeze({
      name: LATTICE_QUALIFICATION_EXPIRY_BINDING,
      type: "plain_text",
      expiresAt: qualificationExpiresAt,
    }),
  ]);
}

function fail(message) {
  throw new Error(message);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactTimestamp(value, label) {
  if (typeof value !== "string" || value.length > 64) fail(`${label} is invalid.`);
  const date = new Date(value);
  if (Number.isNaN(date.valueOf()) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value)) {
    fail(`${label} is invalid.`);
  }
  return date.toISOString();
}

function positiveDecimal(value, label) {
  const normalized = typeof value === "number" && Number.isSafeInteger(value)
    ? String(value)
    : value;
  if (typeof normalized !== "string" || !POSITIVE_DECIMAL_PATTERN.test(normalized)) {
    fail(`${label} must be a positive decimal identifier.`);
  }
  return normalized;
}

function nonzeroSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value) || /^0{64}$/u.test(value)) {
    fail(`${label} must be a nonzero lowercase SHA-256 digest.`);
  }
  return value;
}

export function sanitizeTextToLatticeDeploymentStatus(raw, worker) {
  if (!isRecord(raw)) fail(`${worker} deployment status is invalid.`);
  if (typeof worker !== "string" || !/^hahdev-text-to-lattice-(?:api|response-policy)$/u.test(worker)) {
    fail("The deployment evidence worker name is invalid.");
  }
  if (typeof raw.id !== "string" || !/^[A-Za-z0-9-]{8,128}$/u.test(raw.id)) {
    fail(`${worker} deployment identifier is invalid.`);
  }
  if (!Array.isArray(raw.versions) || raw.versions.length !== 1) {
    fail(`${worker} must have exactly one production version.`);
  }
  const [traffic] = raw.versions;
  if (!isRecord(traffic) || !UUID_PATTERN.test(traffic.version_id ?? "") || traffic.percentage !== 100) {
    fail(`${worker} must route 100 percent of production traffic to one valid version.`);
  }
  return Object.freeze({
    worker,
    deploymentId: raw.id,
    versionId: traffic.version_id,
    percentage: 100,
    createdAt: exactTimestamp(raw.created_on, `${worker} deployment timestamp`),
  });
}

function exactKeys(value, expected) {
  return Object.keys(value).sort().join("\0") === [...expected].sort().join("\0");
}

export function sanitizeTextToLatticeApiVersion(raw, expectedVersionId, {
  qualificationExpiresAt = null,
} = {}) {
  if (!UUID_PATTERN.test(expectedVersionId ?? "")) {
    fail("The expected Text to Lattice API version identifier is invalid.");
  }
  if (!isRecord(raw) || raw.id !== expectedVersionId || !isRecord(raw.resources)
    || !Array.isArray(raw.resources.bindings)) {
    fail("The active Text to Lattice API version does not match its deployment status.");
  }
  const normalizedQualificationExpiresAt = qualificationExpiresAt === null
    ? null
    : exactTimestamp(qualificationExpiresAt, "qualification expiry timestamp");
  const expectedBindings = expectedApiVersionBindings(normalizedQualificationExpiresAt);
  if (raw.resources.bindings.length !== expectedBindings.length) {
    fail(`The active Text to Lattice API version must have exactly ${expectedBindings.length} reviewed bindings.`);
  }

  const observed = new Map();
  for (const binding of raw.resources.bindings) {
    if (!isRecord(binding) || typeof binding.name !== "string" || typeof binding.type !== "string"
      || observed.has(binding.name)) {
      fail("The active Text to Lattice API version contains a malformed or duplicate binding.");
    }
    if (["HF_TOKEN", LATTICE_API_VISITOR_COOKIE_SECRET_BINDING].includes(binding.name)
      && binding.type === "secret_text") {
      if (["text", "value", "secret", "token"].some((key) => Object.hasOwn(binding, key))) {
        fail("The active Text to Lattice API version exposed secret material in binding metadata.");
      }
      observed.set(binding.name, Object.freeze({ name: binding.name, type: binding.type }));
      continue;
    }
    if (binding.name === "LATTICE_API_RATE_LIMITER" && binding.type === "ratelimit") {
      if (binding.namespace_id !== "857321" || !isRecord(binding.simple)
        || !exactKeys(binding.simple, ["limit", "period"])
        || binding.simple.limit !== 30 || binding.simple.period !== 60) {
        fail("The active Text to Lattice API rate-limit binding is not the reviewed 30-per-60-second policy.");
      }
      observed.set(binding.name, Object.freeze({
        name: binding.name,
        type: binding.type,
        namespaceId: binding.namespace_id,
        simple: Object.freeze({ limit: 30, period: 60 }),
      }));
      continue;
    }
    if (binding.name === LATTICE_TRANSFORMATION_CAPACITY_BINDING
      && binding.type === "durable_object_namespace") {
      if (binding.class_name !== "LatticeTransformationBudget"
        || (binding.script_name !== undefined && binding.script_name !== null)) {
        fail("The active Text to Lattice API Durable Object binding is not the reviewed local class.");
      }
      observed.set(binding.name, Object.freeze({
        name: binding.name,
        type: binding.type,
        className: binding.class_name,
      }));
      continue;
    }
    if (binding.name === LATTICE_QUALIFICATION_EXPIRY_BINDING && binding.type === "plain_text") {
      if (normalizedQualificationExpiresAt === null
        || !exactKeys(binding, ["name", "type", "text"])
        || exactTimestamp(binding.text, "active qualification expiry binding")
          !== normalizedQualificationExpiresAt) {
        fail("The active Text to Lattice API qualification-expiry binding is not the reviewed timestamp.");
      }
      observed.set(binding.name, Object.freeze({
        name: binding.name,
        type: binding.type,
        expiresAt: normalizedQualificationExpiresAt,
      }));
      continue;
    }
    fail(`The active Text to Lattice API version contains unreviewed binding ${binding.name}.`);
  }

  for (const expected of expectedBindings) {
    if (!observed.has(expected.name)) {
      fail(`The active Text to Lattice API version is missing binding ${expected.name}.`);
    }
  }
  return Object.freeze({
    worker: API_WORKER,
    versionId: expectedVersionId,
    bindings: expectedBindings,
    bindingSetExact: true,
    secretValuesRead: false,
  });
}

function inspectEvidenceValue(value, path = "evidence") {
  if (typeof value === "string") {
    if (value.length > 2_048) fail(`${path} contains an unexpectedly long string.`);
    if (/\bBearer\s+\S+|\bhf_[A-Za-z0-9]{8,}/u.test(value)) {
      fail(`${path} contains credential-shaped material.`);
    }
    return;
  }
  if (value === null || typeof value === "boolean" || typeof value === "number") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectEvidenceValue(entry, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) fail(`${path} contains an unsupported value.`);
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.replaceAll(/[^A-Za-z]/gu, "").toLowerCase();
    if (PROHIBITED_CONTENT_KEYS.has(normalizedKey)) {
      fail(`${path}.${key} is not permitted in retained deployment evidence.`);
    }
    inspectEvidenceValue(entry, `${path}.${key}`);
  }
}

async function readSanitizedEvidence(pathname, expectedFormat) {
  const bytes = await readFile(resolve(pathname));
  if (bytes.byteLength > MAXIMUM_EVIDENCE_BYTES) {
    fail(`${expectedFormat} exceeds the retained evidence-size boundary.`);
  }
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(`${expectedFormat} is not UTF-8 JSON.`);
  }
  if (!isRecord(value) || value.format !== expectedFormat || value.schemaVersion !== 1
    || !SAFE_EVIDENCE_FORMATS.has(value.format)) {
    fail(`${expectedFormat} has an invalid format or schema version.`);
  }
  inspectEvidenceValue(value);
  return Object.freeze({
    basename: basename(pathname),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

async function readJson(pathname, label) {
  const bytes = await readFile(resolve(pathname));
  if (bytes.byteLength > MAXIMUM_EVIDENCE_BYTES) fail(`${label} exceeds the input-size boundary.`);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(`${label} is not UTF-8 JSON.`);
  }
}

function workflowIdentity(environment) {
  const repository = environment.GITHUB_REPOSITORY;
  const commit = environment.GITHUB_SHA;
  const ref = environment.GITHUB_REF;
  const runId = environment.GITHUB_RUN_ID;
  const runAttempt = environment.GITHUB_RUN_ATTEMPT;
  const serverUrl = environment.GITHUB_SERVER_URL;
  if (!REPOSITORY_PATTERN.test(repository ?? "") || repository.includes("..")) {
    fail("GITHUB_REPOSITORY is invalid.");
  }
  if (!SHA_PATTERN.test(commit ?? "")) fail("GITHUB_SHA is invalid.");
  if (ref !== "refs/heads/main") fail("Deployment evidence may bind only refs/heads/main.");
  if (!/^[1-9]\d*$/u.test(runId ?? "") || !/^[1-9]\d*$/u.test(runAttempt ?? "")) {
    fail("GitHub workflow run identity is invalid.");
  }
  let parsedServer;
  try {
    parsedServer = new URL(serverUrl);
  } catch {
    fail("GITHUB_SERVER_URL is invalid.");
  }
  if (parsedServer.protocol !== "https:" || parsedServer.username || parsedServer.password
    || parsedServer.search || parsedServer.hash) {
    fail("GITHUB_SERVER_URL must be an HTTPS URL without credentials, query, or fragment.");
  }
  const canonicalServer = parsedServer.href.replace(/\/$/u, "");
  return Object.freeze({
    repository,
    commit,
    ref,
    runId,
    runAttempt,
    runUrl: `${canonicalServer}/${repository}/actions/runs/${runId}`,
  });
}

function exactObjectFields(value, fields, label) {
  if (!isRecord(value) || JSON.stringify(Object.keys(value)) !== JSON.stringify(fields)) {
    fail(`${label} must contain only the exact canonical fields.`);
  }
  return value;
}

function verifyRetainedEvidenceFile(value, expectedBasename, label) {
  const file = exactObjectFields(value, ["basename", "sha256"], label);
  if (file.basename !== expectedBasename) fail(`${label} has an unexpected basename.`);
  nonzeroSha256(file.sha256, `${label} SHA-256`);
}

function verifyDeploymentWorker(value, {
  worker,
  includeBindings,
  deployedAt,
  qualificationExpiresAt = null,
} = {}) {
  const fields = includeBindings
    ? ["worker", "deploymentId", "versionId", "percentage", "createdAt", "activeVersionBindings", "bindingSetExact"]
    : ["worker", "deploymentId", "versionId", "percentage", "createdAt"];
  const record = exactObjectFields(value, fields, `${worker} deployment evidence`);
  if (record.worker !== worker || !UUID_PATTERN.test(record.deploymentId ?? "")
    || !UUID_PATTERN.test(record.versionId ?? "") || record.percentage !== 100) {
    fail(`${worker} deployment evidence has an invalid immutable deployment identity.`);
  }
  const createdAt = exactTimestamp(record.createdAt, `${worker} deployment timestamp`);
  if (new Date(createdAt).valueOf() > new Date(deployedAt).valueOf()) {
    fail(`${worker} deployment timestamp is later than the service-deployment evidence time.`);
  }
  if (includeBindings) {
    if (record.bindingSetExact !== true
      || JSON.stringify(record.activeVersionBindings)
        !== JSON.stringify(expectedApiVersionBindings(qualificationExpiresAt))) {
      fail(`${worker} deployment evidence does not contain the exact reviewed binding set.`);
    }
  }
}

/** Validate the closed, sanitized deployment-index object retained by the workflow. */
export function verifyTextToLatticeDeploymentEvidenceIndex(value) {
  const index = exactObjectFields(value, [
    "format",
    "schemaVersion",
    "generatedAt",
    "deployedAt",
    "deployedAtBasis",
    "canonicalUrl",
    "qualificationExpiresAt",
    "workflow",
    "serviceJobId",
    "pagesArtifactId",
    "siteArtifactSha256",
    "qualifiedSourceSetSha256",
    "workers",
    "evidenceFiles",
    "rawWranglerStatusRetained",
    "rawWranglerVersionRetained",
    "contentBodiesRetained",
    "secretValuesRead",
  ], "deployment evidence index");
  if (index.format !== "TEXT_TO_LATTICE_DEPLOYMENT_EVIDENCE_INDEX" || index.schemaVersion !== 1) {
    fail("deployment evidence index has an invalid format or schema version.");
  }
  const generatedAt = exactTimestamp(index.generatedAt, "deployment evidence generation timestamp");
  const deployedAt = exactTimestamp(index.deployedAt, "service-deployment evidence timestamp");
  if (generatedAt !== deployedAt || index.deployedAtBasis !== DEPLOYED_AT_BASIS) {
    fail("deployedAt must be the post-live-verification deployment-index generation timestamp.");
  }
  if (index.canonicalUrl !== CANONICAL_URL) fail("deployment evidence canonical URL is invalid.");
  if (index.qualificationExpiresAt !== null) {
    const qualificationExpiresAt = exactTimestamp(
      index.qualificationExpiresAt,
      "qualification expiry timestamp",
    );
    if (new Date(qualificationExpiresAt).valueOf() <= new Date(deployedAt).valueOf()) {
      fail("qualification expiry must follow the service-deployment evidence time.");
    }
  }

  const workflow = exactObjectFields(
    index.workflow,
    ["repository", "commit", "ref", "runId", "runAttempt", "runUrl"],
    "deployment evidence workflow identity",
  );
  if (!REPOSITORY_PATTERN.test(workflow.repository ?? "") || workflow.repository.includes("..")
    || !SHA_PATTERN.test(workflow.commit ?? "") || /^0{40}$/u.test(workflow.commit)
    || workflow.ref !== "refs/heads/main") {
    fail("deployment evidence workflow identity is invalid.");
  }
  const runId = positiveDecimal(workflow.runId, "workflow run id");
  positiveDecimal(workflow.runAttempt, "workflow run attempt");
  if (workflow.runUrl !== `https://github.com/${workflow.repository}/actions/runs/${runId}`) {
    fail("deployment evidence workflow run URL is invalid.");
  }
  positiveDecimal(index.serviceJobId, "service job id");
  positiveDecimal(index.pagesArtifactId, "Pages artifact id");
  nonzeroSha256(index.siteArtifactSha256, "Pages site artifact SHA-256");
  nonzeroSha256(index.qualifiedSourceSetSha256, "qualified source-set SHA-256");

  const workers = exactObjectFields(index.workers, ["api", "responsePolicy"], "deployment evidence workers");
  verifyDeploymentWorker(workers.api, {
    worker: API_WORKER,
    includeBindings: true,
    deployedAt,
    qualificationExpiresAt: index.qualificationExpiresAt,
  });
  verifyDeploymentWorker(workers.responsePolicy, {
    worker: POLICY_WORKER,
    includeBindings: false,
    deployedAt,
  });
  if (workers.api.deploymentId === workers.responsePolicy.deploymentId
    || workers.api.versionId === workers.responsePolicy.versionId) {
    fail("API and response-policy Worker deployment identities must be distinct.");
  }

  const evidenceFiles = exactObjectFields(
    index.evidenceFiles,
    ["secretBindings", "routeInventory", "liveBoundary"],
    "deployment evidence file index",
  );
  verifyRetainedEvidenceFile(evidenceFiles.secretBindings, "secret-bindings.json", "secret-binding evidence");
  verifyRetainedEvidenceFile(evidenceFiles.routeInventory, "route-inventory.json", "route-inventory evidence");
  verifyRetainedEvidenceFile(evidenceFiles.liveBoundary, "live-boundary.json", "live-boundary evidence");
  for (const field of [
    "rawWranglerStatusRetained",
    "rawWranglerVersionRetained",
    "contentBodiesRetained",
    "secretValuesRead",
  ]) {
    if (index[field] !== false) fail(`deployment evidence ${field} must remain false.`);
  }
  return index;
}

/** Parse the canonical two-space JSON bytes used for browser-evidence custody. */
export function parseTextToLatticeDeploymentEvidenceIndexText(source) {
  if (typeof source !== "string") fail("deployment evidence index must be UTF-8 text.");
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    fail("deployment evidence index is not JSON.");
  }
  if (source !== `${JSON.stringify(value, null, 2)}\n`) {
    fail("deployment evidence index must use canonical two-space JSON with one final newline.");
  }
  return verifyTextToLatticeDeploymentEvidenceIndex(value);
}

export async function buildTextToLatticeDeploymentEvidence({
  apiDeploymentPath,
  apiVersionPath,
  policyDeploymentPath,
  secretEvidencePath,
  routeEvidencePath,
  liveEvidencePath,
  serviceJobId,
  pagesArtifactId,
  siteArtifactSha256,
  qualifiedSourceSetSha256,
  qualificationExpiresAt = null,
  environment = process.env,
  now = () => new Date(),
} = {}) {
  for (const [label, pathname] of Object.entries({
    apiDeploymentPath,
    apiVersionPath,
    policyDeploymentPath,
    secretEvidencePath,
    routeEvidencePath,
    liveEvidencePath,
  })) {
    if (typeof pathname !== "string" || pathname.length === 0) fail(`${label} is required.`);
  }
  const [apiRaw, apiVersionRaw, policyRaw, secretFile, routeFile, liveFile] = await Promise.all([
    readJson(apiDeploymentPath, "API deployment status"),
    readJson(apiVersionPath, "API active version"),
    readJson(policyDeploymentPath, "response-policy deployment status"),
    readSanitizedEvidence(secretEvidencePath, "TEXT_TO_LATTICE_SECRET_BINDING_EVIDENCE"),
    readSanitizedEvidence(routeEvidencePath, "TEXT_TO_LATTICE_ROUTE_INVENTORY_EVIDENCE"),
    readSanitizedEvidence(liveEvidencePath, "TEXT_TO_LATTICE_REMOTE_DEPLOYMENT_EVIDENCE"),
  ]);
  const generatedAt = now();
  if (!(generatedAt instanceof Date) || Number.isNaN(generatedAt.valueOf())) {
    fail("The deployment evidence timestamp is invalid.");
  }
  const deployedAt = generatedAt.toISOString();
  const normalizedServiceJobId = positiveDecimal(serviceJobId, "serviceJobId");
  const normalizedPagesArtifactId = positiveDecimal(pagesArtifactId, "pagesArtifactId");
  const normalizedSiteArtifactSha256 = nonzeroSha256(
    siteArtifactSha256,
    "siteArtifactSha256",
  );
  const normalizedQualifiedSourceSetSha256 = nonzeroSha256(
    qualifiedSourceSetSha256,
    "qualifiedSourceSetSha256",
  );
  const normalizedQualificationExpiresAt = qualificationExpiresAt === null
    || qualificationExpiresAt === undefined
    ? null
    : exactTimestamp(qualificationExpiresAt, "qualificationExpiresAt");
  const apiDeployment = sanitizeTextToLatticeDeploymentStatus(apiRaw, API_WORKER);
  const apiVersion = sanitizeTextToLatticeApiVersion(apiVersionRaw, apiDeployment.versionId, {
    qualificationExpiresAt: normalizedQualificationExpiresAt,
  });
  const evidence = Object.freeze({
    format: "TEXT_TO_LATTICE_DEPLOYMENT_EVIDENCE_INDEX",
    schemaVersion: 1,
    generatedAt: deployedAt,
    deployedAt,
    deployedAtBasis: DEPLOYED_AT_BASIS,
    canonicalUrl: CANONICAL_URL,
    qualificationExpiresAt: normalizedQualificationExpiresAt,
    workflow: workflowIdentity(environment),
    serviceJobId: normalizedServiceJobId,
    pagesArtifactId: normalizedPagesArtifactId,
    siteArtifactSha256: normalizedSiteArtifactSha256,
    qualifiedSourceSetSha256: normalizedQualifiedSourceSetSha256,
    workers: Object.freeze({
      api: Object.freeze({
        ...apiDeployment,
        activeVersionBindings: apiVersion.bindings,
        bindingSetExact: apiVersion.bindingSetExact,
      }),
      responsePolicy: sanitizeTextToLatticeDeploymentStatus(
        policyRaw,
        POLICY_WORKER,
      ),
    }),
    evidenceFiles: Object.freeze({
      secretBindings: secretFile,
      routeInventory: routeFile,
      liveBoundary: liveFile,
    }),
    rawWranglerStatusRetained: false,
    rawWranglerVersionRetained: false,
    contentBodiesRetained: false,
    secretValuesRead: false,
  });
  verifyTextToLatticeDeploymentEvidenceIndex(evidence);
  return evidence;
}

function cliArguments(argumentsList) {
  const values = {};
  const optionMap = new Map([
    ["--api-deployment", "apiDeploymentPath"],
    ["--api-version", "apiVersionPath"],
    ["--policy-deployment", "policyDeploymentPath"],
    ["--secret-evidence", "secretEvidencePath"],
    ["--route-evidence", "routeEvidencePath"],
    ["--live-evidence", "liveEvidencePath"],
    ["--service-job-id", "serviceJobId"],
    ["--pages-artifact-id", "pagesArtifactId"],
    ["--site-artifact-sha256", "siteArtifactSha256"],
    ["--qualified-source-set-sha256", "qualifiedSourceSetSha256"],
    ["--qualification-expires-at", "qualificationExpiresAt"],
    ["--output", "outputPath"],
  ]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const option = argumentsList[index];
    const key = optionMap.get(option);
    if (!key) fail(`Unknown option ${option}.`);
    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) fail(`${option} requires a value.`);
    if (Object.hasOwn(values, key)) fail(`${option} may be passed only once.`);
    values[key] = value;
    index += 1;
  }
  for (const key of [...optionMap.values()].filter((value) => value !== "qualificationExpiresAt")) {
    if (!values[key]) fail(`${key} is required.`);
  }
  return values;
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  const { outputPath, ...inputs } = cliArguments(process.argv.slice(2));
  const evidence = await buildTextToLatticeDeploymentEvidence(inputs);
  const resolvedOutput = resolve(outputPath);
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  await mkdir(dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, serialized, { encoding: "utf8", mode: 0o600 });
  await writeFile(
    `${resolvedOutput}.sha256`,
    `${createHash("sha256").update(serialized).digest("hex")}  ${basename(resolvedOutput)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  console.log(`Retained sanitized Text to Lattice deployment evidence for ${evidence.workflow.commit}.`);
}
