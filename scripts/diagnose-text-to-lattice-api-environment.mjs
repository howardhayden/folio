import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createLatticeCloudflareMetadataReader, LatticeMetadataError,
  LATTICE_CLOUDFLARE_METADATA_LIMITS, isLatticeCloudflareNamespaceId } from "./text-to-lattice-cloudflare-metadata.mjs";

export const LATTICE_ENVIRONMENT_DIAGNOSTIC_VERSION = "80573274-1ae7-4ff1-97fb-c7351ab35508";
export const LATTICE_ENVIRONMENT_DIAGNOSTIC_LIMITS = LATTICE_CLOUDFLARE_METADATA_LIMITS;
const worker = "hahdev-text-to-lattice-api";
const className = "LatticeTransformationBudget";
const bindingName = "LATTICE_TRANSFORMATION_BUDGET";
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const owns = (value, key) => record(value) && Object.hasOwn(value, key);
const exactId = isLatticeCloudflareNamespaceId;
const shape = (value) => value === undefined ? "absent" : value === null ? "null"
  : Array.isArray(value) ? "array" : typeof value === "object" ? "object" : "other";
const choice = (value, values) => value === undefined ? "absent" : value === null ? "null"
  : values.includes(value) ? value : "other";
const codes = new Set([
  "configuration", "deadline", "transport", "http", "media-type", "content-encoding", "body-limit", "body-length", "body-read",
  "invalid-json", "api-result", "version-identity", "namespace-identity", "observation-clock", "unexpected",
]);
const fail = (code) => { throw new LatticeMetadataError(code); };

function versionProjection(value) {
  if (!record(value) || value.id !== LATTICE_ENVIRONMENT_DIAGNOSTIC_VERSION) fail("version-identity");
  const bindings = value.resources?.bindings;
  const candidates = Array.isArray(bindings) ? bindings.filter((item) => item?.name === bindingName) : [];
  const binding = candidates.length === 1 && record(candidates[0]) ? candidates[0] : null;
  const script = value.resources?.script;
  const namedHandlers = script?.named_handlers;
  const namedClasses = Array.isArray(namedHandlers) ? namedHandlers.filter((item) => item?.name === className) : [];
  const namedClass = namedClasses.length === 1 ? namedClasses[0] : null;
  const runtime = value.resources?.script_runtime;
  const exports = runtime?.exports;
  const exported = exports?.[className];
  const namespaceId = binding?.namespace_id;
  return {
    namespaceId: exactId(namespaceId) ? namespaceId : null,
    observation: {
      versionId: LATTICE_ENVIRONMENT_DIAGNOSTIC_VERSION,
      resourcesShape: shape(value.resources), bindingsShape: shape(bindings),
      scriptShape: shape(script), namedHandlersShape: shape(namedHandlers),
      namedClassEntries: namedClasses.length === 0 ? "absent" : namedClasses.length === 1 ? "one" : "multiple",
      namedClassHandlersShape: shape(namedClass?.handlers),
      namedClassFetchHandler: Array.isArray(namedClass?.handlers) && namedClass.handlers.includes("fetch"),
      targetBinding: candidates.length === 0 ? "absent" : candidates.length === 1 ? "one" : "multiple",
      bindingType: choice(binding?.type, ["durable_object_namespace"]),
      classMatches: binding?.class_name === className,
      scriptName: binding?.script_name === worker ? "expected-worker"
        : choice(binding?.script_name, [""]) === "" ? "empty" : choice(binding?.script_name, []),
      namespaceIdValid: exactId(namespaceId),
      bindingAuxiliaryPresence: Object.fromEntries(["preview", "dispatch_namespace", "environment"].map((key) => [key, owns(binding, key)])),
      runtimeShape: shape(runtime), exportsShape: shape(exports), classExportShape: shape(exported),
      exportType: choice(exported?.type, ["durable-object"]),
      exportStorage: choice(exported?.storage, ["sqlite", "legacy-kv"]),
      exportState: choice(exported?.state, ["created", "expecting-transfer", "deleted", "renamed", "transferred"]),
      exportAuxiliaryPresence: Object.fromEntries(["container", "transfer_from", "transferred_to", "renamed_to"].map((key) => [key, owns(exported, key)])),
      migrationTagMatches: runtime?.migration_tag === "v1",
      compatibilityDateMatches: runtime?.compatibility_date === "2026-09-14",
      compatibilityFlagsMatch: JSON.stringify(runtime?.compatibility_flags) === JSON.stringify(["enable_request_signal"]),
    },
  };
}

function namespaceProjection(value, namespaceId) {
  return {
    id: namespaceId,
    script: value.script === worker ? worker : null,
    class: value.class === className ? className : null,
    scriptMatches: value.script === worker,
    classMatches: value.class === className,
    useSqlite: typeof value.use_sqlite === "boolean" ? value.use_sqlite : null,
    useSqliteTypeValid: typeof value.use_sqlite === "boolean",
    auxiliaryPresence: Object.fromEntries(["preview", "dispatch_namespace", "environment"].map((key) => [key, owns(value, key)])),
  };
}

export async function diagnoseTextToLatticeApiEnvironment({
  accountId, token, workflow, fetchImpl = globalThis.fetch, now = () => new Date(),
  monotonicNow = () => performance.now(), requestTimeoutMs = LATTICE_ENVIRONMENT_DIAGNOSTIC_LIMITS.requestTimeoutMs,
} = {}) {
  let reader;
  const report = {
    format: "TEXT_TO_LATTICE_API_ENVIRONMENT_DIAGNOSTIC", schemaVersion: 1,
    sourceRunId: "37399359951", sourceRunAttempt: 1,
    sourceRunCommit: "a4eda7314f295ce8ea00a5cd2bb027fe89dd4d17", workflow: null,
    requestedVersionId: LATTICE_ENVIRONMENT_DIAGNOSTIC_VERSION,
    requestedVersionBasis: "run252-deployment-log",
    statusSelectedVersionInRun252Proven: false,
    namespaceObservationBasis: "current-control-plane-query-not-run252-snapshot",
    responseDigestBasis: "received-response-body-bytes-with-identity-content-encoding",
    diagnosticStatus: "unavailable", failure: null, observedAt: null,
    version: null, namespace: null, namespaceLookup: "not-attempted", responses: [],
    gateClosing: false, acceptedAdmissionEnvironmentProof: false,
  };
  try {
    if (typeof now !== "function") fail("configuration");
    if (!record(workflow) || workflow.repository !== "howardhayden/folio"
      || workflow.ref !== "refs/heads/main" || workflow.event !== "workflow_dispatch"
      || typeof workflow.commit !== "string" || workflow.commit.length !== 40 || !/^[a-f0-9]{40}$/u.test(workflow.commit)
      || typeof workflow.runId !== "string" || !/^[1-9][0-9]{0,19}$/u.test(workflow.runId)
      || String(BigInt(workflow.runId)) !== workflow.runId
      || !Number.isInteger(workflow.runAttempt) || workflow.runAttempt < 1 || workflow.runAttempt > 100) fail("configuration");
    report.workflow = { repository: workflow.repository, ref: workflow.ref, event: workflow.event,
      commit: workflow.commit, runId: workflow.runId, runAttempt: workflow.runAttempt };
    reader = createLatticeCloudflareMetadataReader({ accountId, token, fetchImpl, monotonicNow, requestTimeoutMs });
    const version = await reader.version(LATTICE_ENVIRONMENT_DIAGNOSTIC_VERSION);
    const projected = versionProjection(version.result);
    report.version = projected.observation;
    if (projected.namespaceId !== null) {
      report.namespaceLookup = "unavailable";
      // The pinned Wrangler uses this exact namespace metadata endpoint.
      // The path comes only from this version's validated binding ID.
      const response = await reader.namespace(projected.namespaceId);
      report.namespace = namespaceProjection(response.result, projected.namespaceId);
      report.namespaceLookup = "one";
    } else report.namespaceLookup = "invalid-version-binding";
    reader.finish();
    const instant = now();
    if (!(instant instanceof Date) || !Number.isFinite(instant.valueOf())) fail("observation-clock");
    report.observedAt = instant.toISOString();
    report.diagnosticStatus = "observed";
  } catch (error) {
    report.failure = error instanceof LatticeMetadataError && codes.has(error.code) ? error.code : "unexpected";
  }
  // Pending ignored-abort tasks cannot append to this returned custody snapshot.
  return Object.freeze({ ...report, responses: reader?.receipts() ?? Object.freeze([]) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== "--output") fail("configuration");
    const output = resolve(process.argv[3]);
    const report = await diagnoseTextToLatticeApiEnvironment({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN,
      workflow: { repository: process.env.GITHUB_REPOSITORY, ref: process.env.GITHUB_REF, event: process.env.GITHUB_EVENT_NAME,
        commit: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT) },
    });
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    console.log(`Read-only environment diagnostic: ${report.diagnosticStatus}.`);
    if (report.diagnosticStatus !== "observed") process.exitCode = 1;
  } catch {
    console.error("Read-only environment diagnostic failed without retaining raw metadata.");
    process.exitCode = 1;
  }
}
