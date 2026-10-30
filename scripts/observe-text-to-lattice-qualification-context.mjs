/** Metadata-only point observer. It never authenticates supplied artifact custody. */
import { createHash } from "node:crypto";
import { linkSync, unlinkSync } from "node:fs";
import { lstat, readFile, mkdir, writeFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LatticeMetadataError, LATTICE_CLOUDFLARE_METADATA_LIMITS } from "./text-to-lattice-cloudflare-metadata.mjs";
import { parseTextToLatticeDeploymentEvidenceIndexText, sanitizeTextToLatticeDeploymentStatus } from "./build-text-to-lattice-deployment-evidence.mjs";
import { verifyTextToLatticeRouteInventory } from "./verify-text-to-lattice-route-inventory.mjs";
import { verifyCurrentMainSha } from "./verify-current-main-sha.mjs";
import { verifyQualifiedSourceSet, verifyReleaseStatusState } from "./verify-text-to-lattice-release.mjs";
import { TEXT_TO_LATTICE_DOCUMENT_POLICY } from "../workers/text-to-lattice-response-policy/worker.js";
import { TEXT_TO_LATTICE_QUALIFICATION_CLEANUP_LEAD_MS } from "./plan-text-to-lattice-qualification-window.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registerPath = resolve(root, "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json");
const REPO = "howardhayden/folio";
const PAGE = "https://hah.dev/resume/";
const GH = "https://api.github.com";
const CF = "https://api.cloudflare.com/client/v4";
const OPERATION_MS = 90_000;
const GH_LIMIT = 4_000_000;
const PAGE_LIMIT = 2 * 1024 * 1024;
const ROUTE_LIMIT = 256 * 1024;
const SERVICE = "Qualify or verify Text to Lattice services";
const WAIT = "Wait for bounded Text to Lattice qualification cleanup";
const WAIT_STEP = "Wait without holding a deployment environment or concurrency lock";
const REQUIRED_STEPS = Object.freeze([
  "Require one fully verified candidate source identity",
  "Verify deployed admission environment before live probes",
  "Verify deployed Text to Lattice API boundary and response policy",
  "Inspect API deployment after live verification",
  "Verify exact active and retired Text to Lattice routes",
  "Assemble sanitized Text to Lattice deployment evidence",
  "Require current main after service verification",
  "Retain sanitized Text to Lattice deployment evidence",
]);
const STOP_JOBS = new Set(["Immediately restore the qualification API to held", "Fail closed the bounded Text to Lattice qualification API", "Restore held Pages at the bounded qualification cleanup point", "Enforce held API after held or failed publication"]);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const record = v => v !== null && typeof v === "object" && !Array.isArray(v);
const fail = code => { throw new LatticeMetadataError(code); };
const need = (v, code) => { if (!v) fail(code); };
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const exact = (v, keys, code) => need(record(v) && equal(Object.keys(v).sort(), [...keys].sort()), code);
const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/u.test(v) && !/^0{64}$/u.test(v);
const decimal = v => typeof v === "string" && /^[1-9][0-9]{0,19}$/u.test(v);
const jsonBytes = v => Buffer.from(JSON.stringify(v, null, 2) + "\n");
const date = value => { const d = new Date(value); need(typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/u.test(value) && Number.isFinite(d.valueOf()), "time"); return d; };

// Literal bounded reader copied from the unchanged historical metadata module.
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
      reject(new LatticeMetadataError("deadline"));
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
      || String(Number(length)) !== length || Number(length) > LATTICE_CLOUDFLARE_METADATA_LIMITS.responseBytes)) {
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
        if (bytes > LATTICE_CLOUDFLARE_METADATA_LIMITS.responseBytes) fail("body-limit");
        hash.update(part.value);
        chunks.push(Buffer.from(part.value));
      }
    } catch (error) {
      try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* No blocking cleanup. */ }
      if (error instanceof LatticeMetadataError) throw error;
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



export function parseExpectedQualificationContext(encoded) {
  need(typeof encoded === "string" && encoded.length > 0 && encoded.length <= 60_000 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded), "input");
  const raw = Buffer.from(encoded, "base64");
  need(raw.length > 0 && raw.length < 65_536 && raw.toString("base64") === encoded, "input");
  let text, value;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(raw); value = JSON.parse(text); } catch { fail("input"); }
  need(jsonBytes(value).equals(raw), "input"); // Also rejects duplicate keys/BOM/noncanonical JSON.
  exact(value, ["format", "schemaVersion", "index", "indexSha256", "resumeMember"], "input");
  need(value.format === "TEXT_TO_LATTICE_EXPECTED_QUALIFICATION_CONTEXT" && value.schemaVersion === 1 && digest(value.indexSha256), "input");
  let index;
  try { index = parseTextToLatticeDeploymentEvidenceIndexText(jsonBytes(value.index).toString("utf8")); } catch { fail("index"); }
  need(hash(jsonBytes(index)) === value.indexSha256 && index.workflow.repository === REPO && index.workflow.runAttempt === "1" && index.qualificationExpiresAt !== null && record(index.admissionEnvironment), "index");
  exact(value.resumeMember, ["path", "bytes", "sha256"], "input");
  need(value.resumeMember.path === "resume/index.html" && Number.isSafeInteger(value.resumeMember.bytes) && value.resumeMember.bytes > 0 && value.resumeMember.bytes <= PAGE_LIMIT && digest(value.resumeMember.sha256), "input");
  return { payloadSha256: hash(raw), index, indexSha256: value.indexSha256, resumeMember: value.resumeMember };
}

function identity(index) {
  return { deployed_commit: index.workflow.commit, workflow_run_id: index.workflow.runId, workflow_run_attempt: index.workflow.runAttempt,
    service_job_id: index.serviceJobId, site_artifact_sha256: index.siteArtifactSha256, qualified_source_set_sha256: index.qualifiedSourceSetSha256,
    api_worker_deployment_id: index.workers.api.deploymentId, api_worker_version: index.workers.api.versionId,
    response_policy_worker_deployment_id: index.workers.responsePolicy.deploymentId, response_policy_worker_version: index.workers.responsePolicy.versionId };
}

function checkRun(run, index) {
  need(record(run) && run.id === Number(index.workflow.runId) && run.run_attempt === 1 && run.head_sha === index.workflow.commit && run.path === ".github/workflows/pages.yml" && run.repository?.full_name === REPO && run.head_branch === "main" && run.event === "workflow_dispatch" && run.html_url === index.workflow.runUrl && run.status === "in_progress" && run.conclusion === null, "activation");
}
function checkJobs(value, index) {
  need(record(value), "activation");
  need(Number.isSafeInteger(value.total_count) && Array.isArray(value.jobs) && value.total_count === value.jobs.length && value.jobs.length <= 100, "activation");
  const jobs = value.jobs;
  need(jobs.every(j => record(j) && Number.isSafeInteger(j.id) && j.run_id === Number(index.workflow.runId) && j.run_attempt === 1 && j.head_sha === index.workflow.commit && j.head_branch === "main") && new Set(jobs.map(j => j.id)).size === jobs.length, "activation");
  const named = name => { const a = jobs.filter(j => j.name === name); need(a.length === 1, "activation"); return a[0]; };
  const service = named(SERVICE), pages = named("deploy"), wait = named(WAIT);
  need(service.id === Number(index.serviceJobId), "activation");
  for (const j of [service, pages]) need(j.status === "completed" && j.conclusion === "success" && Array.isArray(j.steps) && j.steps.every(s => s.status === "completed" && ["success", "skipped"].includes(s.conclusion)), "activation");
  for (const name of REQUIRED_STEPS) { const s = service.steps.filter(s => s.name === name); need(s.length === 1 && s[0].conclusion === "success", "activation"); }
  need(pages.steps.some(s => s.name === "Deploy interactive Pages" && s.conclusion === "success") && wait.status === "in_progress" && wait.conclusion === null && Array.isArray(wait.steps), "activation");
  const waiting = wait.steps.filter(s => s.name === WAIT_STEP);
  need(waiting.length === 1 && waiting[0].status === "in_progress" && waiting[0].conclusion === null, "activation");
  for (const j of jobs) if (STOP_JOBS.has(j.name)) need((j.status === "completed" && j.conclusion === "skipped") || (j.started_at === null && ["queued", "waiting", "pending"].includes(j.status)), "restoration");
  need(date(service.completed_at) <= date(pages.completed_at) && date(pages.completed_at) <= date(wait.started_at), "activation");
  return { service_job_id: String(service.id), pages_job_id: String(pages.id), wait_job_id: String(wait.id) };
}

// The generated companion is outside the qualified set, avoiding a raw-register
// hash cycle. This exception applies only to the one fixed register, never HTTP
// responses or another JSON input. The companion is read and checked, not rebuilt.
export async function readRegister() {
  const s = await lstat(registerPath);
  need(s.isFile() && !s.isSymbolicLink() && Number.isSafeInteger(s.size) && s.size > 0, "source");
  if (s.size <= 4 * 1024 * 1024) {
    const bytes = await readFile(registerPath);
    need(bytes.length === s.size && bytes.length <= 4 * 1024 * 1024, "source");
    return bytes;
  }
  need(s.size <= 32 * 1024 * 1024, "source");
  const companionPath = resolve(root, "public/documentation/text-to-lattice/artifact-manifest.json");
  const ms = await lstat(companionPath);
  need(ms.isFile() && !ms.isSymbolicLink() && Number.isSafeInteger(ms.size) && ms.size > 0 && ms.size <= 4 * 1024 * 1024, "source");
  const companionBytes = await readFile(companionPath);
  need(companionBytes.length === ms.size && companionBytes.length <= 4 * 1024 * 1024, "source");
  let companion;
  try { companion = JSON.parse(companionBytes.toString("utf8")); } catch { fail("source"); }
  need(record(companion) && companion.format === "TEXT_TO_LATTICE_DOCUMENTATION_ARTIFACT_MANIFEST" && companion.schemaVersion === 1 && companion.algorithm === "SHA-256" && jsonBytes(companion).equals(companionBytes), "source");
  need(Array.isArray(companion.releaseEvidence) && companion.releaseEvidence.every(record) && Array.isArray(companion.artifacts) && companion.artifacts.every(record), "source");
  need(companion.releaseEvidence.every(v => typeof v.filename === "string") && new Set(companion.releaseEvidence.map(v => v.filename)).size === companion.releaseEvidence.length, "source");
  need(companion.artifacts.every(v => typeof v.path === "string") && new Set(companion.artifacts.map(v => v.path)).size === companion.artifacts.length, "source");
  const evidence = companion.releaseEvidence.filter(v => v.filename === "TEXT-TO-LATTICE-RELEASE-REGISTER.json");
  const copies = companion.artifacts.filter(v => v.path === "public/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json");
  need(evidence.length === 1 && copies.length === 1, "source");
  exact(evidence[0], ["filename", "bytes", "sha256"], "source");
  exact(copies[0], ["path", "bytes", "sha256"], "source");
  const expected = evidence[0];
  need(Number.isSafeInteger(expected.bytes) && expected.bytes === s.size && expected.bytes <= 32 * 1024 * 1024 && digest(expected.sha256) && copies[0].bytes === expected.bytes && copies[0].sha256 === expected.sha256, "source");
  const bytes = await readFile(registerPath);
  need(bytes.length === s.size && bytes.length === expected.bytes && hash(bytes) === expected.sha256, "source");
  return bytes;
}

async function observeQualificationContextImpl({ expectedContextBase64, parsedExpected, operationSignal, operationAssert, operationStartedAt, operationStartedMono, checkpoint, environment = process.env, fetchImpl = globalThis.fetch,
  now = () => new Date(), monotonicNow = () => performance.now(), requestTimeoutMs = 10_000,
  registerReader = readRegister, sourceVerifier = verifyQualifiedSourceSet } = {}) {
  need(["before", "after"].includes(checkpoint) && typeof fetchImpl === "function" && typeof now === "function" && typeof monotonicNow === "function" && Number.isInteger(requestTimeoutMs) && requestTimeoutMs > 0 && requestTimeoutMs <= 10_000, "configuration");
  const expected = parsedExpected ?? parseExpectedQualificationContext(expectedContextBase64), { index } = expected;
  const e = environment;
  need(e.GITHUB_REPOSITORY === REPO && e.GITHUB_REF === "refs/heads/main" && e.GITHUB_EVENT_NAME === "workflow_dispatch" && e.GITHUB_SHA === index.workflow.commit && e.GITHUB_RUN_ATTEMPT === "1" && decimal(e.GITHUB_RUN_ID) && e.GITHUB_RUN_ID !== index.workflow.runId, "source");
  need(typeof e.GITHUB_TOKEN === "string" && e.GITHUB_TOKEN.length > 0 && !/[\r\n]/u.test(e.GITHUB_TOKEN) && typeof e.CLOUDFLARE_ACCOUNT_ID === "string" && /^[a-f0-9]{32}$/u.test(e.CLOUDFLARE_ACCOUNT_ID) && typeof e.CLOUDFLARE_API_TOKEN === "string" && e.CLOUDFLARE_API_TOKEN.length >= 20 && !/\s/u.test(e.CLOUDFLARE_API_TOKEN), "configuration");
  const started = operationStartedAt ?? now(), mono = operationStartedMono ?? monotonicNow(), cleanup = new Date(date(index.qualificationExpiresAt).valueOf() - TEXT_TO_LATTICE_QUALIFICATION_CLEANUP_LEAD_MS);
  let lastMono = mono, lastWall = started.valueOf(), total = 0;
  const receipts = [];
  const clock = () => { operationAssert(); const m = monotonicNow(), w = now(); need(Number.isFinite(m) && m >= lastMono && w instanceof Date && Number.isFinite(w.valueOf()) && w.valueOf() >= lastWall && m - mono < OPERATION_MS && date(index.deployedAt) <= w && w < cleanup, "deadline"); lastMono = m; lastWall = w.valueOf(); return { m, w, remaining: Math.min(OPERATION_MS - (m - mono), cleanup.valueOf() - w.valueOf()) }; };
  clock();
  const initialRegister = await registerReader();
  let reg;
  try { reg = JSON.parse(initialRegister.toString("utf8")); } catch { fail("source"); }
  let state;
  try { state = verifyReleaseStatusState(reg); need(state.qualificationPending && reg.gates.filter(g => ["GATE-02", "GATE-03", "GATE-06"].includes(g.id)).every(g => g.acceptanceBasis === null), "source"); need(await sourceVerifier(reg) === index.qualifiedSourceSetSha256, "source"); } catch { fail("source"); }
  clock();

  const get = async (url, kind, headers, limit, perRequestMs = requestTimeoutMs, parentSignal = null) => {
    const current = clock(); need(++total <= 14, "request-count");
    const receiptIndex = total - 1; // Retain admitted request order across concurrent response completion.
    const controller = new AbortController(), timeoutMs = Math.min(perRequestMs, current.remaining);
    let reader, timer, response, abortParent, expired = false;
    const task = (async () => {
      try { response = await fetchImpl(url, { method: "GET", redirect: "error", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", headers, signal: controller.signal }); } catch { fail("transport"); }
      need(!expired, "deadline");
      need(response instanceof Response && !response.redirected, "http");
      const encoding = response.headers.get("content-encoding"); need(encoding === null || encoding.toLowerCase() === "identity", "content-encoding");
      const n = response.headers.get("content-length"); need(n === null || (/^(?:0|[1-9][0-9]*)$/u.test(n) && Number(n) <= limit), "body-limit");
      try { reader = response.body.getReader(); } catch { fail("body-read"); }
      const chunks = []; let count = 0;
      for (;;) { const r = await reader.read(); need(!expired, "deadline"); clock(); if (r.done) break; need(r.value instanceof Uint8Array, "body-read"); count += r.value.length; need(count <= limit, "body-limit"); chunks.push(Buffer.from(r.value)); }
      need(n === null || count === Number(n), "body-length");
      need(!expired, "deadline");
      const body = Buffer.concat(chunks); receipts[receiptIndex] = { request: kind, responseBodyBytes: body.length, responseBodySha256: hash(body) };
      return new Response(body, { status: response.status, headers: response.headers });
    })();
    const timeout = new Promise((_, reject) => { abortParent = () => { expired = true; controller.abort(); try { Promise.resolve(reader ? reader.cancel() : response?.body?.cancel()).catch(() => {}); } catch { /* Finite refusal only. */ } reject(new LatticeMetadataError("deadline")); }; timer = setTimeout(abortParent, timeoutMs); parentSignal?.addEventListener("abort", abortParent, { once: true }); operationSignal.addEventListener("abort", abortParent, { once: true }); if (parentSignal?.aborted || operationSignal.aborted) abortParent(); });
    try { const r = await Promise.race([task, timeout]); clock(); return r; } catch (error) { expired = true; controller.abort(); try { Promise.resolve(reader ? reader.cancel() : response?.body?.cancel()).catch(() => {}); } catch { /* No blocking cleanup. */ } throw error; } finally { clearTimeout(timer); parentSignal?.removeEventListener("abort", abortParent); operationSignal.removeEventListener("abort", abortParent); }
  };
  const ghHeaders = { Accept: "application/vnd.github+json", Authorization: `Bearer ${e.GITHUB_TOKEN}`, "Accept-Encoding": "identity" };
  const ghGet = async (path, kind) => { const r = await get(GH + path, kind, ghHeaders, GH_LIMIT); need(r.status === 200 && /^application\/json(?:;|$)/iu.test(r.headers.get("content-type") ?? ""), "http"); try { return JSON.parse(await r.text()); } catch { fail("invalid-json"); } };
  const runPath = `/repos/${REPO}/actions/runs/${index.workflow.runId}`;
  const mainURL = `${GH}/repos/${REPO}/git/ref/heads/main`;
  const current = async side => {
    try { await verifyCurrentMainSha({ repository: REPO, workflowSha: e.GITHUB_SHA, workflowRef: e.GITHUB_REF, token: e.GITHUB_TOKEN, attempts: 1, timeoutMs: requestTimeoutMs,
      fetchImpl: async (url, options) => { need(String(url) === mainURL, "scope"); return get(mainURL, `github-main-${side}`, ghHeaders, GH_LIMIT, requestTimeoutMs, options.signal); } }); } catch { fail("main"); }
    const run = await ghGet(runPath, `github-run-${side}`); checkRun(run, index);
    const jobs = await ghGet(runPath + "/attempts/1/jobs?per_page=100", `github-jobs-${side}`); const ids = checkJobs(jobs, index);
    const dispatch = await ghGet(`/repos/${REPO}/actions/workflows/pages.yml/runs?event=workflow_dispatch&head_sha=${index.workflow.commit}&per_page=100`, `github-dispatch-${side}`);
    need(dispatch.total_count === 1 && Array.isArray(dispatch.workflow_runs) && dispatch.workflow_runs.length === 1, "activation"); checkRun(dispatch.workflow_runs[0], index);
    return { run, jobs, ids };
  };
  const before = await current("before");
  const cfReceipts = [];
  const cfJSON = async (url, kind, limit = LATTICE_CLOUDFLARE_METADATA_LIMITS.responseBytes) => metadataGet(url, {
    token: e.CLOUDFLARE_API_TOKEN, timeoutMs: Math.min(requestTimeoutMs, clock().remaining), kind, receipts: cfReceipts,
    fetchImpl: async (actualURL, options) => { need(actualURL === url && options.method === "GET", "scope"); return get(url, kind, { Accept: "application/json", Authorization: `Bearer ${e.CLOUDFLARE_API_TOKEN}`, "Accept-Encoding": "identity" }, limit, requestTimeoutMs, options.signal); },
  });
  const workers = {};
  for (const [key, name] of [["api", "hahdev-text-to-lattice-api"], ["responsePolicy", "hahdev-text-to-lattice-response-policy"]]) {
    const raw = await cfJSON(`${CF}/accounts/${e.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${name}/deployments`, `cloudflare-${key}`);
    need(record(raw.result) && Array.isArray(raw.result.deployments) && raw.result.deployments.length > 0 && raw.result.deployments.length <= 100 && raw.result.deployments.every(d => record(d) && typeof d.id === "string") && new Set(raw.result.deployments.map(d => d.id)).size === raw.result.deployments.length, "deployment");
    try { workers[key] = sanitizeTextToLatticeDeploymentStatus(raw.result.deployments.at(0), name); } catch { fail("deployment"); }
    const i = index.workers[key]; need(equal(workers[key], { worker: i.worker, deploymentId: i.deploymentId, versionId: i.versionId, percentage: i.percentage, createdAt: i.createdAt }), "deployment");
  }
  let routeCalls = 0;
  const routeInventory = await verifyTextToLatticeRouteInventory({ accountId: e.CLOUDFLARE_ACCOUNT_ID, apiToken: e.CLOUDFLARE_API_TOKEN, releasePhase: "qualification-pending",
    fetchImpl: async (url, options) => {
      const prefix = `${CF}/zones/`, account = `${CF}/accounts/${e.CLOUDFLARE_ACCOUNT_ID}/workers/domains`;
      const allowed = url === `${CF}/zones?name=hah.dev&status=active&per_page=50` || (url.startsWith(prefix) && /^[a-f0-9]{32}\/workers\/routes$/u.test(url.slice(prefix.length))) || url === account;
      need(allowed && options.method === undefined && options.headers.Authorization === `Bearer ${e.CLOUDFLARE_API_TOKEN}` && ++routeCalls <= 3, "scope");
      const raw = await cfJSON(url, `cloudflare-route-${routeCalls}`, ROUTE_LIMIT);
      // Original response was streamed/capped/deadline checked before this replay.
      return new Response(JSON.stringify(raw), { headers: { "content-type": "application/json" } });
    } });
  need(routeCalls === 3, "request-count");
  const page = await get(PAGE, "pages-document", { Accept: "text/html", "Accept-Encoding": "identity" }, PAGE_LIMIT, Math.min(15_000, requestTimeoutMs));
  need(page.status === 200 && /^text\/html(?:\s*;\s*charset=utf-8)?$/iu.test(page.headers.get("content-type") ?? ""), "pages");
  const pageBytes = Buffer.from(await page.arrayBuffer());
  need(pageBytes.length === expected.resumeMember.bytes && hash(pageBytes) === expected.resumeMember.sha256, "pages");
  try { new TextDecoder("utf-8", { fatal: true }).decode(pageBytes); } catch { fail("pages"); }
  need(Object.entries(TEXT_TO_LATTICE_DOCUMENT_POLICY).every(([k, v]) => page.headers.get(k) === v) && (page.headers.get("cache-control") ?? "").toLowerCase().split(/\s*,\s*/u).includes("no-transform"), "pages-policy");
  const after = await current("after");
  need(equal(before.jobs, after.jobs) && equal(before.ids, after.ids), "activation");
  const endRegister = await registerReader(); need(initialRegister.equals(endRegister), "source");
  try { need(await sourceVerifier(reg) === index.qualifiedSourceSetSha256, "source"); } catch { fail("source"); }
  const completed = clock().w;
  need(total === 14, "request-count");
  return { format: "TEXT_TO_LATTICE_QUALIFICATION_CONTEXT_OBSERVATION", schemaVersion: 1, checkpoint,
    observationStartedAt: started.toISOString(), observationCompletedAt: completed.toISOString(), validatedAt: completed.toISOString(),
    observer: { repository: REPO, commit: e.GITHUB_SHA, runId: e.GITHUB_RUN_ID, runAttempt: "1", workflow: ".github/workflows/text-to-lattice-qualification-context.yml" },
    expectedContextSha256: expected.payloadSha256, indexSha256: expected.indexSha256, identity: identity(index),
    activationJobIds: before.ids, cleanupAt: cleanup.toISOString(), qualificationExpiresAt: index.qualificationExpiresAt, workers, routeInventory,
    pages: { canonicalURL: PAGE, artifactMember: expected.resumeMember.path, status: 200, bytes: pageBytes.length, sha256: hash(pageBytes), documentPolicyMatches: true, noTransform: true, contentBodyRetained: false },
    requests: receipts, GETs: total, matches_expected_context: true, expected_artifact_custody_verified_by_observer: false,
    rawResponsesRetained: false, rawBindingsRetained: false, cookieValuesRetained: false, secretValuesRead: false, providerCalls: 0,
    transformationRequests: 0, activationPerformed: false, canonical_bundle_ready: false, gate_closing: false };
}

export async function observeQualificationContext(options = {}) {
  const now = options.now ?? (() => new Date()), monotonicNow = options.monotonicNow ?? (() => performance.now());
  const operationTimeoutMs = options.operationTimeoutMs ?? OPERATION_MS;
  need(typeof now === "function" && typeof monotonicNow === "function" && Number.isSafeInteger(operationTimeoutMs) && operationTimeoutMs > 0 && operationTimeoutMs <= OPERATION_MS, "configuration");
  const started = now(), mono = monotonicNow(), expected = parseExpectedQualificationContext(options.expectedContextBase64);
  const cleanup = date(expected.index.qualificationExpiresAt).valueOf() - TEXT_TO_LATTICE_QUALIFICATION_CLEANUP_LEAD_MS;
  need(started instanceof Date && Number.isFinite(started.valueOf()) && Number.isFinite(mono) && started.valueOf() < cleanup, "deadline");
  const controller = new AbortController(); let stopped = false, timer;
  const operationAssert = () => { const w = now(), m = monotonicNow(); need(!stopped && w instanceof Date && Number.isFinite(w.valueOf()) && w.valueOf() >= started.valueOf() && w.valueOf() < cleanup && Number.isFinite(m) && m >= mono && m - mono < operationTimeoutMs, "deadline"); };
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => { stopped = true; controller.abort(); reject(new LatticeMetadataError("deadline")); }, Math.min(operationTimeoutMs, cleanup - started.valueOf())); });
  const task = (async () => {
    const result = await observeQualificationContextImpl({ ...options, parsedExpected: expected, operationStartedAt: started, operationStartedMono: mono, operationSignal: controller.signal, operationAssert });
    operationAssert();
    if (options.outputPath !== undefined) await publishQualificationContextObservation(options.outputPath, result, operationAssert);
    return result;
  })();
  try { return await Promise.race([task, deadline]); }
  finally { stopped = true; clearTimeout(timer); controller.abort(); }
}

// Stage privately inside the operation race. A late filesystem completion can
// never publish success after the latched operation or cleanup deadline.
export async function publishQualificationContextObservation(output, result, operationAssert) {
  need(typeof output === "string" && isAbsolute(output) && typeof operationAssert === "function", "output");
  const staged = output + ".unpublished";
  operationAssert();
  await writeFile(staged, jsonBytes(result), { flag: "wx" });
  operationAssert();
  linkSync(staged, output); // Exclusive publication; never replaces another receipt.
  try { operationAssert(); }
  catch (error) { unlinkSync(output); throw error; }
  unlinkSync(staged);
}

const FINITE_CODES = new Set(["configuration", "input", "index", "source", "time", "deadline", "request-count", "transport", "http", "content-encoding", "body-limit", "body-read", "body-length", "invalid-json", "scope", "main", "activation", "restoration", "deployment", "pages", "pages-policy", "output", "media-type", "api-result"]);
async function main() {
  need(process.argv.length === 4 && process.argv[2] === "--output" && isAbsolute(process.argv[3]), "configuration");
  const output = resolve(process.argv[3]), parent = dirname(output), temp = resolve(process.env.RUNNER_TEMP ?? "");
  need(isAbsolute(process.env.RUNNER_TEMP ?? "") && parent.startsWith(temp + "/") && dirname(parent) === temp && (await realpath(temp)) === temp, "output");
  await mkdir(parent); // Exclusive per original run/attempt, before reads.
  await writeFile(resolve(parent, "started.json"), jsonBytes({ status: "started-metadata-only", providerCalls: 0, activationPerformed: false }), { flag: "wx" });
  let result;
  try { result = await observeQualificationContext({ expectedContextBase64: process.env.LATTICE_CONTEXT_BASE64, checkpoint: process.env.LATTICE_CONTEXT_CHECKPOINT, outputPath: output }); }
  catch (error) { result = { format: "TEXT_TO_LATTICE_QUALIFICATION_CONTEXT_REFUSAL", schemaVersion: 1, status: "refused", code: error instanceof LatticeMetadataError && FINITE_CODES.has(error.code) ? error.code : "unavailable", expected_artifact_custody_verified_by_observer: false, providerCalls: 0, activationPerformed: false, canonical_bundle_ready: false, gate_closing: false }; }
  if (result.status === "refused") await writeFile(output, jsonBytes(result), { flag: "wx" });
  process.stdout.write(JSON.stringify({ receiptWritten: true, providerCalls: 0, gate_closing: false }) + "\n");
  if (result.status === "refused") process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { process.stderr.write("Qualification-context observer refused without raw output.\n"); process.exitCode = 1; });
