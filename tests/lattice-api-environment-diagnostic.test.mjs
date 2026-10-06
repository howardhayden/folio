import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  diagnoseTextToLatticeApiEnvironment,
  LATTICE_ENVIRONMENT_DIAGNOSTIC_VERSION,
  LATTICE_ENVIRONMENT_DIAGNOSTIC_LIMITS,
} from "../scripts/diagnose-text-to-lattice-api-environment.mjs";
import { sanitizeTextToLatticeAdmissionEnvironment } from "../scripts/build-text-to-lattice-deployment-evidence.mjs";

const namespaceId = "0123456789abcdef0123456789abcdef";
const otherId = "1123456789abcdef0123456789abcdef";
const sentinel = "private-response-sentinel-must-not-escape";
const workflow = { repository: "howardhayden/folio", ref: "refs/heads/main", event: "workflow_dispatch",
  commit: "a".repeat(40), runId: "123456789", runAttempt: 1 };
const options = { accountId: "b".repeat(32), token: "synthetic-token", workflow,
  now: () => new Date("2026-10-06T02:00:00.000Z") };
function version() {
  return { success: true, result: { id: LATTICE_ENVIRONMENT_DIAGNOSTIC_VERSION,
    metadata: { author_email: sentinel }, resources: {
      bindings: [{ type: "plain_text", name: "LATTICE_QUALIFICATION_EXPIRES_AT", text: sentinel },
        { name: "LATTICE_TRANSFORMATION_BUDGET", type: "durable_object_namespace",
          class_name: "LatticeTransformationBudget", namespace_id: namespaceId }],
      script: { named_handlers: [{ name: "LatticeTransformationBudget", handlers: ["fetch", "alarm"] }, { name: sentinel, handlers: [sentinel] }] },
      script_runtime: { compatibility_date: "2026-09-14", compatibility_flags: ["enable_request_signal"], migration_tag: "v1" },
    } } };
}
function page(items = [{ id: namespaceId, script: "hahdev-text-to-lattice-api", class: "LatticeTransformationBudget", name: sentinel, use_sqlite: true }], number = 1, total = 1) {
  return { success: true, result: items, result_info: { page: number, per_page: 1000, total_pages: total } };
}
const json = (payload) => new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
async function observe(responses, extra = {}) {
  const calls = [];
  const report = await diagnoseTextToLatticeApiEnvironment({ ...options,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      const response = responses.shift();
      return typeof response === "function" ? response() : response;
    }, ...extra });
  assert.doesNotMatch(JSON.stringify(report), new RegExp(sentinel, "u"));
  return { report, calls };
}

test("historical-version diagnostic records missing exports and explicit current namespace facts without accepting D15", async () => {
  const raw = version();
  assert.throws(() => sanitizeTextToLatticeAdmissionEnvironment(raw.result), /exact local SQLite/u);
  const { report, calls } = await observe([json(raw), json(page())]);
  assert.equal(report.diagnosticStatus, "observed");
  assert.equal(report.failure, null);
  assert.equal(report.version.exportsShape, "absent");
  assert.equal(report.version.namedHandlersShape, "array");
  assert.equal(report.version.namedClassEntries, "one");
  assert.equal(report.version.namedClassFetchHandler, true);
  assert.equal(report.version.exportStorage, "absent");
  assert.equal(report.version.migrationTagMatches, true);
  assert.equal(report.namespace.useSqlite, true);
  assert.equal(report.namespace.id, namespaceId);
  assert.equal(report.statusSelectedVersionInRun252Proven, false);
  assert.equal(report.acceptedAdmissionEnvironmentProof, false);
  assert.equal(report.gateClosing, false);
  assert.equal(report.namespaceObservationBasis, "current-control-plane-query-not-run252-snapshot");
  assert.deepEqual(report.workflow, workflow);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, new RegExp(`/workers/scripts/hahdev-text-to-lattice-api/versions/${LATTICE_ENVIRONMENT_DIAGNOSTIC_VERSION}$`, "u"));
  assert.match(calls[1].url, /\/workers\/durable_objects\/namespaces\?page=1&per_page=1000$/u);
  for (const { url, init } of calls) {
    assert.equal(new URL(url).origin, "https://api.cloudflare.com");
    assert.equal(init.method, "GET"); assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store"); assert.equal(init.body, undefined);
    assert.equal(init.headers.Authorization, "Bearer synthetic-token");
    assert.equal(init.headers["Accept-Encoding"], "identity");
    assert.doesNotMatch(url, /objects\/[^/]+\/objects|api\/lattice|secret|huggingface/u);
  }
  assert.deepEqual(report.responses[0], { request: "historical-version",
    responseBodyBytes: Buffer.byteLength(JSON.stringify(raw)),
    responseBodySha256: createHash("sha256").update(JSON.stringify(raw)).digest("hex") });
});

test("finite projection distinguishes every current admission rejection branch without reflecting unknown values", async (t) => {
  const cases = [
    ["missing named handlers", (v) => { delete v.result.resources.script.named_handlers; }, "namedHandlersShape", "absent"],
    ["duplicate named class", (v) => { v.result.resources.script.named_handlers.push({ name: "LatticeTransformationBudget", handlers: [] }); }, "namedClassEntries", "multiple"],
    ["unknown named class", (v) => { v.result.resources.script.named_handlers = [{ name: sentinel }]; }, "namedClassEntries", "absent"],
    ["null exports", (v) => { v.result.resources.script_runtime.exports = null; }, "exportsShape", "null"],
    ["array exports", (v) => { v.result.resources.script_runtime.exports = []; }, "exportsShape", "array"],
    ["missing runtime", (v) => { delete v.result.resources.script_runtime; }, "runtimeShape", "absent"],
    ["foreign script", (v) => { v.result.resources.bindings[1].script_name = sentinel; }, "scriptName", "other"],
    ["same script", (v) => { v.result.resources.bindings[1].script_name = "hahdev-text-to-lattice-api"; }, "scriptName", "expected-worker"],
    ["empty script", (v) => { v.result.resources.bindings[1].script_name = ""; }, "scriptName", "empty"],
    ["null script", (v) => { v.result.resources.bindings[1].script_name = null; }, "scriptName", "null"],
    ["legacy storage", (v) => { v.result.resources.script_runtime.exports = { LatticeTransformationBudget: { type: "durable-object", storage: "legacy-kv" } }; }, "exportStorage", "legacy-kv"],
    ["unknown storage", (v) => { v.result.resources.script_runtime.exports = { LatticeTransformationBudget: { type: sentinel, storage: sentinel } }; }, "exportStorage", "other"],
    ["transfer state", (v) => { v.result.resources.script_runtime.exports = { LatticeTransformationBudget: { type: "durable-object", storage: "sqlite", state: "expecting-transfer" } }; }, "exportState", "expecting-transfer"],
    ["wrong migration", (v) => { v.result.resources.script_runtime.migration_tag = sentinel; }, "migrationTagMatches", false],
  ];
  for (const [label, change, key, expected] of cases) await t.test(label, async () => {
    const raw = version(); change(raw);
    const { report } = await observe([json(raw), json(page())]);
    assert.equal(report.diagnosticStatus, "observed");
    assert.equal(report.version[key], expected);
    assert.equal(report.acceptedAdmissionEnvironmentProof, false);
  });
  const raw = version();
  raw.result.resources.bindings[1].preview = sentinel;
  raw.result.resources.script_runtime.exports = { LatticeTransformationBudget: { type: "durable-object", storage: "sqlite", container: sentinel } };
  const { report } = await observe([json(raw), json(page())]);
  assert.equal(report.version.bindingAuxiliaryPresence.preview, true);
  assert.equal(report.version.exportAuxiliaryPresence.container, true);
});

test("missing, ambiguous or malformed namespace binding never guesses an account namespace", async (t) => {
  for (const [label, change] of [
    ["absent", (v) => { v.result.resources.bindings.pop(); }],
    ["multiple", (v) => { v.result.resources.bindings.push({ ...v.result.resources.bindings[1] }); }],
    ["malformed", (v) => { v.result.resources.bindings[1].namespace_id = `${namespaceId}\n`; }],
  ]) await t.test(label, async () => {
    const raw = version(); change(raw);
    const { report, calls } = await observe([json(raw)]);
    assert.equal(report.namespaceLookup, "invalid-version-binding");
    assert.equal(report.namespace, null); assert.equal(calls.length, 1);
  });
});

test("namespace selection traverses complete bounded pages, preserves explicit false and exposes no unrelated records", async () => {
  const { report, calls } = await observe([json(version()),
    json(page([{ id: otherId, class: sentinel, script: sentinel, use_sqlite: true }], 1, 2)),
    json(page([{ id: namespaceId, script: sentinel, class: sentinel, use_sqlite: false }], 2, 2))]);
  assert.equal(calls.length, 3); assert.equal(report.namespaceLookup, "one");
  assert.equal(report.namespace.useSqlite, false); assert.equal(report.namespace.script, null);
  assert.equal(report.namespace.class, null); assert.equal(report.namespace.scriptMatches, false);
  assert.doesNotMatch(JSON.stringify(report), new RegExp(otherId, "u"));
  const missing = await observe([json(version()), json(page([]))]);
  assert.equal(missing.report.namespaceLookup, "absent"); assert.equal(missing.report.namespace, null);
  const untyped = await observe([json(version()), json(page([{ id: namespaceId, use_sqlite: "true" }]))]);
  assert.equal(untyped.report.namespace.useSqlite, null); assert.equal(untyped.report.namespace.useSqliteTypeValid, false);
});

test("three namespace pages use the exact four-request ceiling and complete response-byte custody", async () => {
  const raw = version();
  const bytes = JSON.stringify(raw);
  const identity = new Response(bytes, { headers: { "Content-Type": "application/json", "Content-Encoding": "identity", "Content-Length": String(Buffer.byteLength(bytes)) } });
  const { report, calls } = await observe([identity, json(page([], 1, 3)), json(page([], 2, 3)), json(page(undefined, 3, 3))]);
  assert.equal(report.diagnosticStatus, "observed"); assert.equal(calls.length, 4);
  assert.equal(report.responses.length, 4); assert.equal(report.namespaceLookup, "one");
  assert.equal(report.responseDigestBasis, "received-response-body-bytes-with-identity-content-encoding");
});

test("namespace truncation, duplicate identity, unstable pagination and invalid version identity remain unavailable", async (t) => {
  for (const [label, responses, code] of [
    ["wrong version", [json({ success: true, result: { id: "0".repeat(36) } })], "version-identity"],
    ["missing pagination", [json(version()), json({ success: true, result: [] })], "namespace-pagination"],
    ["excess pages", [json(version()), json(page([], 1, 4))], "namespace-pagination"],
    ["wrong page", [json(version()), json(page([], 2, 2))], "namespace-pagination"],
    ["duplicate", [json(version()), json(page([{ id: namespaceId }, { id: namespaceId }]))], "namespace-duplicate"],
    ["cross-page duplicate", [json(version()), json(page([{ id: namespaceId }], 1, 2)), json(page([{ id: namespaceId }], 2, 2))], "namespace-duplicate"],
    ["changed total", [json(version()), json(page([], 1, 2)), json(page([], 2, 1))], "namespace-pagination"],
  ]) await t.test(label, async () => {
    const { report, calls } = await observe(responses);
    assert.equal(report.diagnosticStatus, "unavailable"); assert.equal(report.failure, code);
    assert.equal(report.namespace, null); assert.ok(calls.length <= 4);
  });
});

test("optional pagination totals must agree with each page and the completed unique inventory", async (t) => {
  for (const [label, change] of [
    ["wrong page count", (p) => { p.result_info.count = 2; }],
    ["wrong total", (p) => { p.result_info.total_count = 2; }],
    ["negative total", (p) => { p.result_info.total_count = -1; }],
    ["untyped total", (p) => { p.result_info.total_count = "1"; }],
  ]) await t.test(label, async () => {
    const raw = page(); change(raw);
    const { report } = await observe([json(version()), json(raw)]);
    assert.equal(report.failure, "namespace-pagination");
    assert.equal(report.namespace, null);
  });
  const exact = page(); exact.result_info.count = 1; exact.result_info.total_count = 1;
  assert.equal((await observe([json(version()), json(exact)])).report.diagnosticStatus, "observed");
});

test("bounded reads discard HTTP errors, redirects, oversized bodies and malformed JSON without raw error output", async (t) => {
  for (const [label, response, code] of [
    ["HTTP error", new Response(sentinel, { status: 403 }), "http"],
    ["redirect", { status: 200, redirected: true, body: new ReadableStream() }, "http"],
    ["fetch throw", () => { throw new Error(sentinel); }, "transport"],
    ["wrong media", new Response(sentinel), "media-type"],
    ["compressed body", new Response(sentinel, { headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" } }), "content-encoding"],
    ["declared oversized", new Response(sentinel, { headers: { "Content-Type": "application/json", "Content-Length": String(LATTICE_ENVIRONMENT_DIAGNOSTIC_LIMITS.responseBytes + 1) } }), "body-limit"],
    ["streamed oversized", new Response(new Uint8Array(LATTICE_ENVIRONMENT_DIAGNOSTIC_LIMITS.responseBytes + 1), { headers: { "Content-Type": "application/json" } }), "body-limit"],
    ["wrong declared byte count", new Response(JSON.stringify(version()), { headers: { "Content-Type": "application/json", "Content-Length": "1" } }), "body-length"],
    ["invalid JSON", new Response(sentinel, { headers: { "Content-Type": "application/json" } }), "invalid-json"],
    ["invalid UTF8", new Response(new Uint8Array([255]), { headers: { "Content-Type": "application/json" } }), "invalid-json"],
    ["API failure", json({ success: false, errors: [{ message: sentinel }] }), "api-result"],
  ]) await t.test(label, async () => {
    const { report, calls } = await observe([response]);
    assert.equal(report.failure, code); assert.equal(report.diagnosticStatus, "unavailable");
    assert.equal(calls.length, 1); assert.equal(report.version, null);
  });
});

test("fetch and body deadlines do not wait for ignored abort or pending cancellation and cannot gain late custody", async () => {
  let release;
  const pendingFetch = new Promise((resolve) => { release = resolve; });
  const first = await observe([() => pendingFetch], { requestTimeoutMs: 5 });
  assert.equal(first.report.failure, "deadline");
  release(json(version()));
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.deepEqual(first.report.responses, []);
  let cancelCalls = 0;
  const body = new ReadableStream({ pull: () => new Promise(() => {}), cancel: () => {
    cancelCalls += 1; return new Promise(() => {});
  } });
  const second = await observe([new Response(body, { headers: { "Content-Type": "application/json" } })], { requestTimeoutMs: 5 });
  assert.equal(second.report.failure, "deadline"); assert.equal(cancelCalls, 1);
  assert.deepEqual(second.report.responses, []);
});

test("operation deadline, clock reversal and invalid configuration cannot issue extra metadata requests", async () => {
  let clocks = [0, 0, 30_001];
  const expired = await observe([json(version())], { monotonicNow: () => clocks.shift() });
  assert.equal(expired.report.failure, "deadline"); assert.equal(expired.calls.length, 1);
  clocks = [10, 9];
  const reversed = await observe([], { monotonicNow: () => clocks.shift() });
  assert.equal(reversed.report.failure, "observation-clock"); assert.equal(reversed.calls.length, 0);
  clocks = [0, 0, 0, 30_001];
  const lateFinal = await observe([json(version()), json(page())], { monotonicNow: () => clocks.shift() });
  assert.equal(lateFinal.report.failure, "deadline"); assert.equal(lateFinal.report.diagnosticStatus, "unavailable");
  clocks = [0, 1, 2, 1];
  const reverseFinal = await observe([json(version()), json(page())], { monotonicNow: () => clocks.shift() });
  assert.equal(reverseFinal.report.failure, "observation-clock");
  for (const extra of [{ accountId: "bad" }, { workflow: { ...workflow, ref: "refs/heads/topic" } },
    { workflow: { ...workflow, runId: "12\n" } }, { requestTimeoutMs: 10_001 }]) {
    const { report, calls } = await observe([], extra);
    assert.equal(report.failure, "configuration"); assert.equal(calls.length, 0);
  }
});

test("manual diagnostic workflow is held, current-main guarded and incapable of deployment or inference", async () => {
  const source = await readFile(new URL("../.github/workflows/text-to-lattice-environment-diagnostic.yml", import.meta.url), "utf8");
  const eventBlock = /^on:\n([\s\S]*?)\npermissions:/mu.exec(source)[1];
  assert.equal(eventBlock.trim(), "workflow_dispatch:");
  const guard = /^    if: (.+)$/mu.exec(source)[1];
  for (const event of ["workflow_dispatch", "push", "pull_request"]) for (const ref of ["refs/heads/main", "refs/heads/topic"]) {
    assert.equal(runInNewContext(guard, { github: { event_name: event, ref } }), event === "workflow_dispatch" && ref === "refs/heads/main");
  }
  assert.match(source, /environment:\n      name: text-to-lattice-production/u);
  assert.match(source, /group: text-to-lattice-services\n      cancel-in-progress: false/u);
  const readAt = source.indexOf("run: node scripts/read-text-to-lattice-release-state.mjs");
  const heldAt = source.indexOf('process.env.RELEASE_PHASE !== "held" || process.env.PUBLIC_CLIENT_STATUS !== "held"');
  const currentAt = source.indexOf("run: node scripts/verify-current-main-sha.mjs");
  const metadataAt = source.indexOf("node scripts/diagnose-text-to-lattice-api-environment.mjs");
  assert.ok(readAt > 0 && heldAt > readAt && currentAt > heldAt && metadataAt > currentAt);
  assert.match(source, /name: text-to-lattice-environment-diagnostic-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/u);
  assert.match(source, /path: \$\{\{ runner.temp \}\}\/text-to-lattice-environment-diagnostic\/diagnostic.json/u);
  assert.doesNotMatch(source, /wrangler|npm |curl |POST|deploy-text-to-lattice|verify-text-to-lattice-api-production|pages: write|id-token: write|push:|pull_request:/u);
});
