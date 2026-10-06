import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const LATTICE_ENVIRONMENT_DIAGNOSTIC_VERSION = "80573274-1ae7-4ff1-97fb-c7351ab35508";
export const LATTICE_ENVIRONMENT_DIAGNOSTIC_LIMITS = Object.freeze({
  responseBytes: 1_048_576, requestTimeoutMs: 10_000, operationTimeoutMs: 30_000,
  namespacePages: 3, namespacePageSize: 1_000, metadataRequests: 4,
});
const worker = "hahdev-text-to-lattice-api";
const className = "LatticeTransformationBudget";
const bindingName = "LATTICE_TRANSFORMATION_BUDGET";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const hexId = /^[a-f0-9]{32}$/u;
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const owns = (value, key) => record(value) && Object.hasOwn(value, key);
const exactId = (value) => typeof value === "string" && (
  (value.length === 32 && hexId.test(value)) || (value.length === 36 && uuid.test(value))
);
const shape = (value) => value === undefined ? "absent" : value === null ? "null"
  : Array.isArray(value) ? "array" : typeof value === "object" ? "object" : "other";
const choice = (value, values) => value === undefined ? "absent" : value === null ? "null"
  : values.includes(value) ? value : "other";
const codes = new Set([
  "configuration", "deadline", "transport", "http", "media-type", "content-encoding", "body-limit", "body-length", "body-read",
  "invalid-json", "api-result", "version-identity", "namespace-pagination", "namespace-limit",
  "namespace-duplicate", "observation-clock", "unexpected",
]);
class DiagnosticFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = (code) => { throw new DiagnosticFailure(code); };
function discard(body) {
  try { Promise.resolve(body?.cancel()).catch(() => {}); } catch { /* No raw errors or blocking cleanup. */ }
}

// Only fixed account-metadata GET paths are constructed here. No Worker route,
// Durable Object object-list, secret-value endpoint or provider is contacted.
async function metadataGet(url, { token, fetchImpl, timeoutMs, kind, receipts }) {
  const controller = new AbortController();
  let expired = false;
  let timer;
  let reader;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      controller.abort();
      try { Promise.resolve(reader?.cancel()).catch(() => {}); } catch { /* Bounded cleanup. */ }
      reject(new DiagnosticFailure("deadline"));
    }, timeoutMs);
  });
  const task = (async () => {
    let response;
    try {
      response = await fetchImpl(url, {
        method: "GET", redirect: "error", cache: "no-store", signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Accept-Encoding": "identity" },
      });
    } catch { fail("transport"); }
    if (expired) { discard(response?.body); fail("deadline"); }
    if (response?.status !== 200 || response.redirected === true) { discard(response?.body); fail("http"); }
    if (!/^application\/json(?:\s*;[^\r\n]*)?$/iu.test(response.headers?.get("content-type") ?? "")) {
      discard(response.body); fail("media-type");
    }
    const encoding = response.headers.get("content-encoding");
    if (encoding !== null && encoding.toLowerCase() !== "identity") {
      discard(response.body); fail("content-encoding");
    }
    const length = response.headers.get("content-length");
    if (length !== null && (!/^(?:0|[1-9][0-9]*)$/u.test(length)
      || String(Number(length)) !== length || Number(length) > LATTICE_ENVIRONMENT_DIAGNOSTIC_LIMITS.responseBytes)) {
      discard(response.body); fail("body-limit");
    }
    try { reader = response.body.getReader(); } catch { fail("body-read"); }
    const chunks = [];
    let bytes = 0;
    const hash = createHash("sha256");
    try {
      for (;;) {
        const part = await reader.read();
        if (expired) fail("deadline");
        if (part.done) break;
        if (!(part.value instanceof Uint8Array)) fail("body-read");
        bytes += part.value.byteLength;
        if (bytes > LATTICE_ENVIRONMENT_DIAGNOSTIC_LIMITS.responseBytes) fail("body-limit");
        hash.update(part.value);
        chunks.push(Buffer.from(part.value));
      }
    } catch (error) {
      try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* No blocking cleanup. */ }
      if (error instanceof DiagnosticFailure) throw error;
      fail("body-read");
    }
    if (expired) fail("deadline");
    if (length !== null && bytes !== Number(length)) fail("body-length");
    receipts.push(Object.freeze({ request: kind, responseBodyBytes: bytes, responseBodySha256: hash.digest("hex") }));
    let parsed;
    try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { fail("invalid-json"); }
    if (!record(parsed) || parsed.success !== true || !Object.hasOwn(parsed, "result")) fail("api-result");
    return parsed;
  })();
  try { return await Promise.race([task, timeout]); }
  finally { clearTimeout(timer); }
}

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
  const receipts = [];
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
    version: null, namespace: null, namespaceLookup: "not-attempted", responses: receipts,
    gateClosing: false, acceptedAdmissionEnvironmentProof: false,
  };
  try {
    if (typeof accountId !== "string" || accountId.length !== 32 || !hexId.test(accountId)
      || typeof token !== "string" || token.length < 1 || token.length > 4096 || /[\r\n]/u.test(token)
      || typeof fetchImpl !== "function" || typeof now !== "function" || typeof monotonicNow !== "function"
      || !Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1
      || requestTimeoutMs > LATTICE_ENVIRONMENT_DIAGNOSTIC_LIMITS.requestTimeoutMs) fail("configuration");
    if (!record(workflow) || workflow.repository !== "howardhayden/folio"
      || workflow.ref !== "refs/heads/main" || workflow.event !== "workflow_dispatch"
      || typeof workflow.commit !== "string" || workflow.commit.length !== 40 || !/^[a-f0-9]{40}$/u.test(workflow.commit)
      || typeof workflow.runId !== "string" || !/^[1-9][0-9]{0,19}$/u.test(workflow.runId)
      || String(BigInt(workflow.runId)) !== workflow.runId
      || !Number.isInteger(workflow.runAttempt) || workflow.runAttempt < 1 || workflow.runAttempt > 100) fail("configuration");
    report.workflow = { repository: workflow.repository, ref: workflow.ref, event: workflow.event,
      commit: workflow.commit, runId: workflow.runId, runAttempt: workflow.runAttempt };
    const started = monotonicNow();
    if (!Number.isFinite(started)) fail("observation-clock");
    let last = started;
    const get = async (suffix, kind) => {
      const clock = monotonicNow();
      if (!Number.isFinite(clock) || clock < last) fail("observation-clock");
      last = clock;
      const remaining = LATTICE_ENVIRONMENT_DIAGNOSTIC_LIMITS.operationTimeoutMs - (clock - started);
      if (remaining <= 0 || receipts.length >= LATTICE_ENVIRONMENT_DIAGNOSTIC_LIMITS.metadataRequests) fail("deadline");
      return metadataGet(`https://api.cloudflare.com/client/v4/accounts/${accountId}/${suffix}`, {
        token, fetchImpl, timeoutMs: Math.min(requestTimeoutMs, remaining), kind, receipts,
      });
    };
    const version = await get(`workers/scripts/${worker}/versions/${LATTICE_ENVIRONMENT_DIAGNOSTIC_VERSION}`, "historical-version");
    const projected = versionProjection(version.result);
    report.version = projected.observation;
    if (projected.namespaceId !== null) {
      report.namespaceLookup = "unavailable";
      const matches = [];
      const seen = new Set();
      let pages = null;
      let totalCount = null;
      for (let page = 1; ; page += 1) {
        if (page > LATTICE_ENVIRONMENT_DIAGNOSTIC_LIMITS.namespacePages) fail("namespace-limit");
        const response = await get(`workers/durable_objects/namespaces?page=${page}&per_page=1000`, `namespace-page-${page}`);
        const info = response.result_info;
        if (!Array.isArray(response.result) || response.result.length > 1000 || !record(info)
          || info.page !== page || info.per_page !== 1000 || !Number.isSafeInteger(info.total_pages)
          || info.total_pages < 1 || info.total_pages > LATTICE_ENVIRONMENT_DIAGNOSTIC_LIMITS.namespacePages
          || (pages !== null && pages !== info.total_pages)) fail("namespace-pagination");
        pages = info.total_pages;
        if (Object.hasOwn(info, "count") && info.count !== response.result.length) fail("namespace-pagination");
        if (Object.hasOwn(info, "total_count")) {
          if (!Number.isSafeInteger(info.total_count) || info.total_count < 0
            || (totalCount !== null && totalCount !== info.total_count)) fail("namespace-pagination");
          totalCount = info.total_count;
        }
        for (const item of response.result) {
          if (!record(item) || !exactId(item.id) || seen.has(item.id)) fail("namespace-duplicate");
          seen.add(item.id);
          if (item.id === projected.namespaceId) matches.push(item);
        }
        if (page === pages) break;
      }
      if (totalCount !== null && totalCount !== seen.size) fail("namespace-pagination");
      report.namespaceLookup = matches.length === 1 ? "one" : "absent";
      if (matches.length === 1) report.namespace = namespaceProjection(matches[0], projected.namespaceId);
    } else report.namespaceLookup = "invalid-version-binding";
    const finished = monotonicNow();
    if (!Number.isFinite(finished) || finished < last) fail("observation-clock");
    if (finished - started > LATTICE_ENVIRONMENT_DIAGNOSTIC_LIMITS.operationTimeoutMs) fail("deadline");
    const instant = now();
    if (!(instant instanceof Date) || !Number.isFinite(instant.valueOf())) fail("observation-clock");
    report.observedAt = instant.toISOString();
    report.diagnosticStatus = "observed";
  } catch (error) {
    report.failure = error instanceof DiagnosticFailure && codes.has(error.code) ? error.code : "unexpected";
  }
  // Pending ignored-abort tasks cannot append to this returned custody snapshot.
  return Object.freeze({ ...report, responses: Object.freeze([...receipts]) });
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
