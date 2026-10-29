import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { observeQualificationContext, parseExpectedQualificationContext, publishQualificationContextObservation, readRegister } from "../scripts/observe-text-to-lattice-qualification-context.mjs";
import { TEXT_TO_LATTICE_DOCUMENT_POLICY } from "../workers/text-to-lattice-response-policy/worker.js";
import { verifyReleaseStatusState } from "../scripts/verify-text-to-lattice-release.mjs";
const historicalShapeOnly = {
  "format": "TEXT_TO_LATTICE_DEPLOYMENT_EVIDENCE_INDEX",
  "schemaVersion": 1,
  "generatedAt": "2026-10-24T09:01:32.303Z",
  "deployedAt": "2026-10-24T09:01:32.303Z",
  "deployedAtBasis": "post-live-verification-service-evidence-index-generation",
  "canonicalUrl": "https://hah.dev/resume/#text-to-lattice",
  "qualificationExpiresAt": "2026-10-24T09:30:48.247Z",
  "workflow": {
    "repository": "howardhayden/folio",
    "commit": "65efbd37e3275db13a289dbe6a4e5198aa616af1",
    "ref": "refs/heads/main",
    "runId": "40080045604",
    "runAttempt": "1",
    "runUrl": "https://github.com/howardhayden/folio/actions/runs/40080045604"
  },
  "serviceJobId": "120832076495",
  "pagesArtifactId": "12554264974",
  "siteArtifactSha256": "096ee57d6f2e855d4ee5c68351cb2d875581574adddb0d4690dc65f9ef127184",
  "qualifiedSourceSetSha256": "a57d0a270006f84d005e591da154714d2c852adc2868efe2c1b609b8811dc38f",
  "workers": {
    "api": {
      "worker": "hahdev-text-to-lattice-api",
      "deploymentId": "2e50af04-6028-467a-b137-732f3575424b",
      "versionId": "0a46c083-fae9-4334-a8b4-334eee40ae3d",
      "percentage": 100,
      "createdAt": "2026-10-24T09:00:51.772Z",
      "activeVersionBindings": [
        {
          "name": "HF_TOKEN",
          "type": "secret_text"
        },
        {
          "name": "VISITOR_COOKIE_SECRET",
          "type": "secret_text"
        },
        {
          "name": "LATTICE_API_RATE_LIMITER",
          "type": "ratelimit",
          "namespaceId": "857321",
          "simple": {
            "limit": 30,
            "period": 60
          }
        },
        {
          "name": "LATTICE_TRANSFORMATION_BUDGET",
          "type": "durable_object_namespace",
          "className": "LatticeTransformationBudget"
        },
        {
          "name": "LATTICE_QUALIFICATION_EXPIRES_AT",
          "type": "plain_text",
          "expiresAt": "2026-10-24T09:30:48.247Z"
        }
      ],
      "bindingSetExact": true
    },
    "responsePolicy": {
      "worker": "hahdev-text-to-lattice-response-policy",
      "deploymentId": "5b0d8c8e-b978-4c58-9877-980167fa1d2f",
      "versionId": "2147a98b-fdf2-499d-8363-277e5e65322d",
      "percentage": 100,
      "createdAt": "2026-10-24T09:00:56.836Z"
    }
  },
  "evidenceFiles": {
    "secretBindings": {
      "basename": "secret-bindings.json",
      "sha256": "1259f337060c605925e086c4314d5e9add26ff71d94afdf94dee4488adee53aa"
    },
    "routeInventory": {
      "basename": "route-inventory.json",
      "sha256": "6dff9f4d0356a4916fe3533f06306f992144b1724e8f775f25c864ca5245bac9"
    },
    "liveBoundary": {
      "basename": "live-boundary.json",
      "sha256": "32a79c6647a5eae4e4b0d11ef90fd0fcf8185a4019c9c1fc470d2d2ee949be57"
    }
  },
  "admissionEnvironment": {
    "validatedBeforeAt": "2026-10-24T09:01:03.387Z",
    "validatedAfterAt": "2026-10-24T09:01:32.303Z",
    "liveCompletedAt": "2026-10-24T09:01:28.058Z",
    "deploymentId": "2e50af04-6028-467a-b137-732f3575424b",
    "versionId": "0a46c083-fae9-4334-a8b4-334eee40ae3d",
    "matchingBeforeAfterSnapshots": true,
    "runtime": {
      "namespaceId": "1427646ecd3a43a6aa4fdf21a419675b",
      "className": "LatticeTransformationBudget",
      "storageBackend": "sqlite",
      "migrationTag": "v1",
      "compatibilityDate": "2026-09-14",
      "compatibilityFlags": [
        "enable_request_signal"
      ],
      "declaredObjectName": "text-to-lattice-transformation-budget-v1",
      "namespaceIdentityBasis": "active-version-local-binding",
      "storageBackendBasis": "active-version-local-class-and-observed-namespace-sqlite"
    }
  },
  "rawWranglerStatusRetained": false,
  "rawWranglerVersionRetained": false,
  "contentBodiesRetained": false,
  "secretValuesRead": false
};
// Synthetic metadata fixtures only. No historical result is claimed current.
const M = "1".repeat(40), S = "a".repeat(64), CF = "f".repeat(32), ZONE = "e".repeat(32);
const start = "2026-10-24T12:00:00.000Z", nowTime = "2026-10-24T12:02:00.000Z";
const hash = b => createHash("sha256").update(b).digest("hex");
const json = v => Buffer.from(JSON.stringify(v, null, 2) + "\n");
const encode = v => json(v).toString("base64");
const originalRegister = JSON.parse(readFileSync(new URL("../docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json", import.meta.url)));
const requiredSteps = ["Require one fully verified candidate source identity", "Verify deployed admission environment before live probes", "Verify deployed Text to Lattice API boundary and response policy", "Inspect API deployment after live verification", "Verify exact active and retired Text to Lattice routes", "Assemble sanitized Text to Lattice deployment evidence", "Require current main after service verification", "Retain sanitized Text to Lattice deployment evidence"];
const response = x => new Response(JSON.stringify(x), { headers: { "content-type": "application/json" } });
function fixture() {
  const index = structuredClone(historicalShapeOnly);
  index.workflow = { repository: "howardhayden/folio", commit: M, ref: "refs/heads/main", runId: "12345", runAttempt: "1", runUrl: "https://github.com/howardhayden/folio/actions/runs/12345" };
  index.serviceJobId = "23456"; index.qualifiedSourceSetSha256 = S;
  index.generatedAt = index.deployedAt = "2026-10-24T12:01:00.000Z";
  index.qualificationExpiresAt = "2026-10-24T12:30:00.000Z";
  index.workers.api.createdAt = index.workers.responsePolicy.createdAt = start;
  index.workers.api.activeVersionBindings.at(-1).expiresAt = index.qualificationExpiresAt;
  index.admissionEnvironment.validatedBeforeAt = "2026-10-24T12:00:20.000Z";
  index.admissionEnvironment.liveCompletedAt = "2026-10-24T12:00:30.000Z";
  index.admissionEnvironment.validatedAfterAt = index.deployedAt;
  const body = Buffer.from("<!doctype html><p>Exact synthetic public document fixture</p>");
  const payload = { format: "TEXT_TO_LATTICE_EXPECTED_QUALIFICATION_CONTEXT", schemaVersion: 1, index, indexSha256: hash(json(index)), resumeMember: { path: "resume/index.html", bytes: body.length, sha256: hash(body) } };
  const env = { GITHUB_REPOSITORY: "howardhayden/folio", GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_SHA: M, GITHUB_RUN_ATTEMPT: "1", GITHUB_RUN_ID: "67890", GITHUB_TOKEN: "SYNTHETIC_GH_TOKEN", CLOUDFLARE_ACCOUNT_ID: CF, CLOUDFLARE_API_TOKEN: "SYNTHETIC_CLOUDFLARE_TOKEN" };
  const run = { id: 12345, run_attempt: 1, head_sha: M, path: ".github/workflows/pages.yml", repository: { full_name: "howardhayden/folio" }, head_branch: "main", event: "workflow_dispatch", html_url: index.workflow.runUrl, status: "in_progress", conclusion: null };
  const common = { run_id: 12345, run_attempt: 1, head_sha: M, head_branch: "main" };
  const complete = name => ({ name, status: "completed", conclusion: "success" });
  const jobs = { total_count: 4, jobs: [
    { ...common, id: 23456, name: "Qualify or verify Text to Lattice services", status: "completed", conclusion: "success", completed_at: "2026-10-24T12:01:10Z", steps: requiredSteps.map(complete) },
    { ...common, id: 23457, name: "deploy", status: "completed", conclusion: "success", completed_at: "2026-10-24T12:01:20Z", steps: [complete("Deploy interactive Pages")] },
    { ...common, id: 23458, name: "Wait for bounded Text to Lattice qualification cleanup", status: "in_progress", conclusion: null, started_at: "2026-10-24T12:01:21Z", steps: [{ name: "Wait without holding a deployment environment or concurrency lock", status: "in_progress", conclusion: null }] },
    { ...common, id: 23459, name: "Fail closed the bounded Text to Lattice qualification API", status: "queued", conclusion: null, started_at: null, steps: [] },
  ] };
  const deployments = Object.fromEntries(Object.entries(index.workers).map(([key, v]) => [key, { id: v.deploymentId, created_on: v.createdAt, versions: [{ version_id: v.versionId, percentage: 100 }] }]));
  const routes = [{ pattern: "hah.dev/api/lattice", script: "hahdev-text-to-lattice-api" }, ...["hah.dev/", "hah.dev/index.html", "hah.dev/resume/", "hah.dev/resume/index.html"].map(pattern => ({ pattern, script: "hahdev-text-to-lattice-response-policy" }))];
  const register = structuredClone(originalRegister); register.authority.qualifiedSourceSet.sha256 = S;
  // This fixture models an active qualification, independently of the actual held source phase.
  register.overallStatus = "qualification-pending";
  register.publicClient.status = "enabled"; register.publicClient.publicationMode = "interactive-client";
  delete register.publicClient.heldBoundary;
  register.ownerDisposition.status = "release-directed";
  for (const gate of register.gates) if (["GATE-02", "GATE-03", "GATE-06"].includes(gate.id)) {
    gate.status = gate.id === "GATE-06" ? "post-deployment-verification" : "satisfied-in-production";
    gate.acceptanceBasis = null;
  }
  assert.equal(verifyReleaseStatusState(register).releasePhase, "qualification-pending");
  return { index, payload, env, body, run, jobs, deployments, routes, register };
}
function harness(f = fixture(), change = null) {
  const calls = []; let sourceChecks = 0;
  const fetchImpl = async (u, options) => {
    const url = String(u); calls.push({ url, options });
    if (change) { const value = await change(url, options, calls); if (value !== undefined) return value; }
    assert.equal(options.method, "GET"); assert.equal(options.redirect, "error"); assert.equal(options.credentials, "omit");
    if (url.startsWith("https://api.github.com/")) {
      assert.equal(options.headers.Authorization, `Bearer ${f.env.GITHUB_TOKEN}`);
      if (url.endsWith("/git/ref/heads/main")) return response({ ref: "refs/heads/main", object: { sha: M, type: "commit" } });
      if (url.endsWith("/attempts/1/jobs?per_page=100")) return response(f.jobs);
      if (url.includes("/actions/workflows/pages.yml/")) return response({ total_count: 1, workflow_runs: [f.run] });
      if (url.endsWith("/actions/runs/12345")) return response(f.run);
    }
    if (url.startsWith("https://api.cloudflare.com/")) {
      assert.equal(options.headers.Authorization, `Bearer ${f.env.CLOUDFLARE_API_TOKEN}`);
      if (url.includes("/hahdev-text-to-lattice-api/deployments")) return response({ success: true, result: { deployments: [f.deployments.api] } });
      if (url.includes("/hahdev-text-to-lattice-response-policy/deployments")) return response({ success: true, result: { deployments: [f.deployments.responsePolicy] } });
      if (url.includes("/zones?")) return response({ success: true, result: [{ id: ZONE, name: "hah.dev", status: "active" }] });
      if (url.includes("/workers/routes")) return response({ success: true, result: f.routes });
      if (url.endsWith("/workers/domains")) return response({ success: true, result: [] });
    }
    if (url === "https://hah.dev/resume/") {
      assert.equal(options.headers.Authorization, undefined); assert.equal(options.headers.Cookie, undefined);
      return new Response(f.body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, no-transform", ...TEXT_TO_LATTICE_DOCUMENT_POLICY } });
    }
    assert.fail("unexpected endpoint");
  };
  const options = { expectedContextBase64: encode(f.payload), checkpoint: "before", environment: f.env, fetchImpl, now: () => new Date(nowTime),
    registerReader: async () => json(f.register), sourceVerifier: async () => { sourceChecks++; return S; } };
  return { f, calls, options, run: () => observeQualificationContext(options), checks: () => sourceChecks };
}

test("synthetic point matches14 application GETs and never authenticates supplied artifact custody", async () => {
  const h = harness(); const r = await h.run(); assert.equal(h.calls.length, 14); assert.equal(r.GETs, 14); assert.equal(h.checks(), 2);
  assert.equal(r.matches_expected_context, true); assert.equal(r.expected_artifact_custody_verified_by_observer, false); assert.equal(r.gate_closing, false);
  assert.equal(r.providerCalls, 0); assert.equal(r.transformationRequests, 0); assert.equal(r.activationPerformed, false);
  assert.equal(r.pages.sha256, h.f.payload.resumeMember.sha256); assert.equal(r.cleanupAt, "2026-10-24T12:24:00.000Z");
  const retained = JSON.stringify(r); assert.equal(retained.includes(h.f.env.GITHUB_TOKEN), false); assert.equal(retained.includes(h.f.env.CLOUDFLARE_API_TOKEN), false); assert.equal(retained.includes(h.f.body.toString()), false);
});
for (const [name, mutate] of [
  ["extra field", p => p.extra = true], ["path traversal", p => p.resumeMember.path = "../resume/index.html"],
  ["wrong index digest", p => p.indexSha256 = "0".repeat(64)], ["wrong repository", p => p.index.workflow.repository = "other/repo"],
  ["wrong schema", p => p.schemaVersion = 2], ["member oversize", p => p.resumeMember.bytes = 2 ** 24],
]) test(`payload refuses ${name} before network`, async () => { const h = harness(); mutate(h.f.payload); h.options.expectedContextBase64 = encode(h.f.payload); await assert.rejects(h.run); assert.equal(h.calls.length, 0); });
for (const [name, text] of [["whitespace", s => s+"\n"], ["BOM", s => Buffer.concat([Buffer.from([239,187,191]),Buffer.from(s,"base64")]).toString("base64")], ["duplicate", s => Buffer.from(Buffer.from(s,"base64").toString().replace('"schemaVersion": 1,','"schemaVersion": 1, "schemaVersion": 1,')).toString("base64")], ["oversize", () => "A".repeat(60004)]])
  test(`payload transport refuses ${name}`, () => { const f = fixture(); assert.throws(() => parseExpectedQualificationContext(text(encode(f.payload)))); });
for (const [name, mutate] of [
 ["held phase", f => { f.register.overallStatus = "held"; f.register.publicClient.status = "held"; f.register.publicClient.publicationMode = "documentation-only"; f.register.ownerDisposition.status = "hold-directed"; f.register.gates.find(g => g.id === "GATE-06").status = "open-release-blocker"; assert.equal(verifyReleaseStatusState(f.register).releasePhase, "held"); }],
 ["qualified phase", f => { f.register.overallStatus = "qualified"; f.register.gates.find(g => g.id === "GATE-06").status = "satisfied-in-production"; assert.equal(verifyReleaseStatusState(f.register).releasePhase, "qualified"); }], ["openG06 while enabled", f => f.register.gates.find(g => g.id === "GATE-06").status = "open-release-blocker"],
 ["G02 not production", f => f.register.gates.find(g => g.id === "GATE-02").status = "open-release-blocker"],
 ["acceptance basis fabricated", f => f.register.gates.find(g => g.id === "GATE-03").acceptanceBasis = "invented"],
 ["observer attempt2", f => f.env.GITHUB_RUN_ATTEMPT = "2"], ["wrong source", f => f.payload.index.qualifiedSourceSetSha256 = "b".repeat(64)],
]) test(`local source refuses ${name}`, async () => { const h = harness(); mutate(h.f); h.f.payload.indexSha256 = hash(json(h.f.index)); h.options.expectedContextBase64 = encode(h.f.payload); await assert.rejects(h.run); assert.equal(h.calls.length, 0); });
for (const [name, mutate] of [
 ["wrong originalattempt", f => f.run.run_attempt = 2], ["wrong main", f => f.run.head_sha = "2".repeat(40)],
 ["service not done", f => f.jobs.jobs[0].status = "in_progress"], ["Pages failed", f => f.jobs.jobs[1].conclusion = "failure"],
 ["wait complete", f => f.jobs.jobs[2].status = "completed"], ["restore started", f => { f.jobs.jobs[3].status = "in_progress"; f.jobs.jobs[3].started_at = nowTime; }],
 ["truncated jobs", f => f.jobs.total_count = 5], ["duplicate job", f => f.jobs.jobs[1].id = f.jobs.jobs[0].id],
]) test(`original activation refuses ${name}`, async () => { const h = harness(); mutate(h.f); await assert.rejects(h.run); assert.ok(h.calls.length <= 4); });
test("current-main failure is attempted once, not its helper default retry3", async () => { const h = harness(fixture(), url => url.includes("/git/ref/") ? new Response("unavailable", {status:503}) : undefined); await assert.rejects(h.run); assert.equal(h.calls.length,1); });
test("extra current-head activation or restore refuses", async () => { const h = harness(fixture(), url => url.includes("/workflows/pages.yml/") ? response({ total_count:2, workflow_runs:[] }) : undefined); await assert.rejects(h.run); assert.equal(h.calls.length,4); });
for (const [name, mutate] of [
 ["splittraffic", f => f.deployments.api.versions[0].percentage = 50], ["two versions", f => f.deployments.api.versions.push({...f.deployments.api.versions[0]})],
 ["wrong policy ID", f => f.deployments.responsePolicy.id = "0".repeat(36)], ["wrong activeversion", f => f.deployments.api.versions[0].version_id = "2".repeat(36)],
 ["wrong createdAt", f => f.deployments.api.created_on = "2026-10-24T12:00:01.000Z"], ["wrong route owner", f => f.routes[0].script = "unknown"],
]) test(`current context refuses ${name}`, async () => { const h = harness(); mutate(h.f); await assert.rejects(h.run); assert.ok(h.calls.length <= 9); });
test("matching historical deployment behind differing current deployment cannot pass", async () => { const f = fixture(); const h = harness(f, url => url.includes("/hahdev-text-to-lattice-api/deployments") ? response({success:true,result:{deployments:[{...f.deployments.api,id:"other-current"},f.deployments.api]}}) : undefined); await assert.rejects(h.run); });
test("unrelated route count change is not global-purity rejection", async () => { const h = harness(); h.f.routes.push({pattern:"unrelated.example/",script:"other-worker"}); const r=await h.run(); assert.equal(r.routeInventory.unrelatedRouteCount,1); });
for (const [name, pageResponse] of [
 ["403", () => new Response("forbidden",{status:403})], ["redirect", () => new Response(null,{status:302,headers:{location:"https://other.invalid"}})],
 ["wrong type", f => new Response(f.body,{headers:{"content-type":"text/plain"}})],
 ["hash drift", () => new Response("changed",{headers:{"content-type":"text/html"}})],
 ["policy drift", f => new Response(f.body,{headers:{"content-type":"text/html","cache-control":"no-transform"}})],
]) test(`Pages refuses ${name} without retry`, async () => { const f=fixture();const h=harness(f,url=>url==="https://hah.dev/resume/"?pageResponse(f):undefined); await assert.rejects(h.run);assert.equal(h.calls.filter(c=>c.url==="https://hah.dev/resume/").length,1); });
test("route response without declared length is streamed/capped/cancelled before replay", async () => { let cancelled=false;const h=harness(fixture(),url=>url.includes("/workers/routes")?new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(256*1024+1));},cancel(){cancelled=true;}}),{headers:{"content-type":"application/json"}}):undefined);await assert.rejects(h.run);assert.equal(cancelled,true);assert.ok(h.calls.length<=9); });
test("stalled route stream times out without a retry or blocking cleanup", async () => {let cancelled=false;const h=harness(fixture(),url=>url.includes("/workers/routes")?new Response(new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled=true;}}),{headers:{"content-type":"application/json"}}):undefined);h.options.requestTimeoutMs=5;await assert.rejects(h.run);assert.equal(cancelled,true);assert.ok(h.calls.length<=9);});
test("cleanup cutoff refuses before first request",async()=>{const h=harness();h.options.now=()=>new Date("2026-10-24T12:24:00.000Z");await assert.rejects(h.run);assert.equal(h.calls.length,0);});
test("cleanup starting during read cancels/rejects",async()=>{let past=false;const h=harness(fixture(),url=>{if(url.includes("/workers/routes"))past=true;});h.options.now=()=>new Date(past?"2026-10-24T12:24:00.000Z":nowTime);await assert.rejects(h.run);assert.ok(h.calls.length<=9);});
test("source drift after observation refuses",async()=>{const h=harness();let reads=0;h.options.registerReader=async()=>reads++?Buffer.from("changed"):json(h.f.register);await assert.rejects(h.run);assert.equal(h.calls.length,14);});
test("second original read detects restoration",async()=>{const h=harness(fixture(),(url,o,calls)=>url.includes("/attempts/1/jobs")&&calls.length>10?response({...h.f.jobs,jobs:h.f.jobs.jobs.map(j=>j.id===23459?{...j,status:"in_progress",started_at:nowTime}:j)}):undefined);await assert.rejects(h.run);});
test("literal metadata reader and old diagnostic remain exact",()=>{const old=readFileSync(new URL("../scripts/text-to-lattice-cloudflare-metadata.mjs",import.meta.url),"utf8"),current=readFileSync(new URL("../scripts/observe-text-to-lattice-qualification-context.mjs",import.meta.url),"utf8");const copy=old.slice(old.indexOf("function discard("),old.indexOf("// Only this Worker version"));assert.ok(current.includes(copy));assert.equal(hash(Buffer.from(old)),"49d95914d4b0ac448c4d2e2526a5d0f89bd6227c23273f2974291ff9d69fc35a");});
function workflowChecks(w){assert.match(w,/contents: read/u);assert.match(w,/actions: read/u);assert.match(w,/github.run_attempt == 1/u);assert.match(w,/persist-credentials: false/u);assert.match(w,/name: text-to-lattice-production/u);assert.match(w,/LATTICE_CONTEXT_BASE64: \$\{\{ inputs.expected_context_base64 \}\}/u);assert.doesNotMatch(w,/^\s*(?:concurrency|needs):/mu);assert.doesNotMatch(w,/permissions:[\s\S]*?contents: write/u);assert.doesNotMatch(w,/HUGGING_FACE|HF_TOKEN|npm ci|wrangler deploy/u);}
test("workflow uses only existing role/pinned actions/read permissions and cannot block cleanup",()=>{const w=readFileSync(new URL("../.github/workflows/text-to-lattice-qualification-context.yml",import.meta.url),"utf8");workflowChecks(w);assert.throws(()=>workflowChecks(w.replace("github.run_attempt == 1","true")));assert.throws(()=>workflowChecks(w+"\nconcurrency: text-to-lattice-services\n"));assert.throws(()=>workflowChecks(w.replace("contents: read","contents: write")));});

test("whole-operation deadline covers never-settling initial register read",async()=>{const h=harness();h.options.operationTimeoutMs=5;h.options.registerReader=()=>new Promise(()=>{});await assert.rejects(h.run,e=>e.code==="deadline");assert.equal(h.calls.length,0);});
test("whole-operation deadline covers never-settling initial source verification",async()=>{const h=harness();h.options.operationTimeoutMs=10;h.options.sourceVerifier=()=>new Promise(()=>{});await assert.rejects(h.run,e=>e.code==="deadline");assert.equal(h.calls.length,0);});
test("whole-operation deadline covers final source verification with no success",async()=>{const h=harness();h.options.operationTimeoutMs=500;let n=0;h.options.sourceVerifier=()=>++n===1?Promise.resolve(S):new Promise(()=>{});await assert.rejects(h.run,e=>e.code==="deadline");assert.equal(h.calls.length,14);});
test("late source resolution after operation deadline cannot issue later GET",async()=>{const h=harness();h.options.operationTimeoutMs=5;let release;h.options.sourceVerifier=()=>new Promise(resolve=>{release=resolve;});await assert.rejects(h.run,e=>e.code==="deadline");release?.(S);await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls.length,0);});

for (const [name, stopAt] of [["before staging",1],["after async staging",2],["immediately after exclusive publication",3]])
  test(`success publication refuses deadline drift ${name}`,async()=>{const dir=await mkdtemp(join(tmpdir(),"lattice-context-synthetic-"));const output=join(dir,"observation.json");let checks=0;try{await assert.rejects(()=>publishQualificationContextObservation(output,{synthetic:true},()=>{if(++checks===stopAt)throw new Error("synthetic deadline");}));assert.equal(existsSync(output),false);}finally{await rm(dir,{recursive:true,force:true});}});
test("success publication is exclusive and preserves an existing receipt",async()=>{const dir=await mkdtemp(join(tmpdir(),"lattice-context-synthetic-"));const output=join(dir,"observation.json");try{await publishQualificationContextObservation(output,{synthetic:"first"},()=>{});await assert.rejects(()=>publishQualificationContextObservation(output,{synthetic:"second"},()=>{}));assert.deepEqual(JSON.parse(readFileSync(output,"utf8")),{synthetic:"first"});}finally{await rm(dir,{recursive:true,force:true});}});
test("whole-operation timeout prevents late source resolution from publishing output",async()=>{const dir=await mkdtemp(join(tmpdir(),"lattice-context-synthetic-"));const output=join(dir,"observation.json");const h=harness();h.options.outputPath=output;h.options.operationTimeoutMs=5;let release;h.options.sourceVerifier=()=>new Promise(resolve=>{release=resolve;});try{await assert.rejects(h.run,e=>e.code==="deadline");release?.(S);await new Promise(resolve=>setImmediate(resolve));assert.equal(existsSync(output),false);assert.equal(h.calls.length,0);}finally{await rm(dir,{recursive:true,force:true});}});

// This is the production default reader, not an injected small-register fixture.
// Running the full suite on each actual held/Q tree is the resource preflight:
// stale generated size/hash data or a future register above the finite ceiling fail.
test("default register reader admits the actual canonical register under its exact resource bound", async () => {
  const actual = readFileSync(new URL("../docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json", import.meta.url));
  assert.deepEqual(await readRegister(), actual);
});
test("default register reader preserves the actual qualification-phase source gate", async () => {
  const h = harness();
  delete h.options.registerReader;
  if (verifyReleaseStatusState(originalRegister).qualificationPending) {
    const result = await h.run();
    assert.equal(result.matches_expected_context, true);
    assert.equal(h.calls.length, 14);
    assert.equal(h.checks(), 2);
  } else {
    await assert.rejects(h.run, error => error.code === "source");
    assert.equal(h.calls.length, 0);
  }
});
