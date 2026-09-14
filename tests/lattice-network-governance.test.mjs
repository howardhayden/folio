import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  REMOTE_CAPABILITIES,
} from "../app/privacy/networkCapabilities.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resumeEntry = resolve(root, "app/resume/ResumeProjects.tsx");
const apiWorkerDirectory = resolve(root, "workers/text-to-lattice-api");
const workflowPath = resolve(root, ".github/workflows/pages.yml");
const productionSourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);

async function exists(pathname) {
  try {
    await access(pathname);
    return true;
  } catch {
    return false;
  }
}

function localImportSpecifiers(source) {
  const specifiers = new Set();
  const staticImports = /\b(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["'](\.[^"']+)["']/gu;
  const dynamicImports = /\bimport\(\s*["'](\.[^"']+)["']\s*\)/gu;
  for (const pattern of [staticImports, dynamicImports]) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

async function resolveLocalImport(importer, specifier) {
  const base = resolve(dirname(importer), specifier);
  const candidates = extname(base)
    ? [base]
    : [
        base,
        ...[".js", ".jsx", ".ts", ".tsx"].map((extension) => `${base}${extension}`),
        ...[".js", ".jsx", ".ts", ".tsx"].map((extension) => resolve(base, `index${extension}`)),
      ];
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error(`Could not resolve ${specifier} from ${relative(root, importer)}.`);
}

async function productionImportGraph(entry) {
  const graph = new Map();
  const pending = [entry];
  while (pending.length > 0) {
    const pathname = pending.pop();
    if (graph.has(pathname)) continue;
    const source = await readFile(pathname, "utf8");
    graph.set(pathname, source);
    for (const specifier of localImportSpecifiers(source)) {
      const imported = await resolveLocalImport(pathname, specifier);
      if (productionSourceExtensions.has(extname(imported))) pending.push(imported);
    }
  }
  return graph;
}

function cspDirectives(policy) {
  const directives = new Map();
  for (const entry of policy.split(";").map((value) => value.trim()).filter(Boolean)) {
    const [name, ...values] = entry.split(/\s+/u);
    assert.equal(directives.has(name), false, `CSP repeats ${name}.`);
    directives.set(name, values);
  }
  return directives;
}

async function recursiveFiles(directory) {
  if (!(await exists(directory))) return [];
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const pathname = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await recursiveFiles(pathname));
    else files.push(pathname);
  }
  return files;
}

function assertNoServiceWorkerInterception(source, label) {
  const registersServiceWorker = /(?:navigator\s*\.\s*)?serviceWorker\s*\.\s*register\s*\(/u.test(source);
  const handlesFetchEvents = /(?:self\s*\.\s*)?addEventListener\s*\(\s*["']fetch["']/u.test(source);
  const usesCacheStorage = /\bcaches\s*\.\s*(?:open|match|keys|delete)\s*\(|\bcache\s*\.\s*(?:add|addAll|match|put)\s*\(/u.test(source);
  if (registersServiceWorker || handlesFetchEvents || usesCacheStorage) {
    assert.fail(`${label} introduces a service-worker or CacheStorage interception surface.`);
  }
}

test("NET-GOV-001: the browser has one explicit remote capability", () => {
  assert.deepEqual(Object.keys(REMOTE_CAPABILITIES), ["textToLattice"]);
  const capability = REMOTE_CAPABILITIES.textToLattice;
  assert.equal(capability.id, "text-to-lattice");
  assert.equal(capability.route, "/api/lattice");
  assert.equal(capability.method, "POST");
  assert.equal(capability.trigger, "explicit-user-submit");
  assert.equal(capability.sameOriginOnly, true);
  assert.equal(capability.transmitsUserContent, true);
  assert.deepEqual(capability.transmittedFields, ["text", "requested_mode", "schema_version"]);
  assert.equal(capability.retainedByApplication, false);
  assert.equal(capability.automaticRetry, false);
  assert.equal(capability.alternateProviderFallback, false);
});

test("NET-GOV-002: the production Text-to-Lattice graph reaches only the capability broker", async () => {
  const graph = await productionImportGraph(resumeEntry);
  const paths = [...graph.keys()].map((pathname) => relative(root, pathname));
  assert.ok(paths.includes("app/resume/lattice/remoteRequest.js"), "the browser entry uses the remote request boundary");
  assert.ok(paths.includes("app/resume/lattice/remoteProtocol.js"), "the request and response protocol is shared");
  assert.ok(paths.includes("app/privacy/networkCapabilities.js"), "the remote request reaches the capability broker");

  for (const prohibited of [
    "app/resume/lattice/modelContract.js",
    "app/resume/lattice/localModel.js",
    "app/resume/lattice/latticeWebllm.worker.ts",
    "app/resume/lattice/modelRpc.js",
    "app/resume/lattice/usageLease.js",
    "app/resume/lattice/attestation.js",
  ]) {
    assert.equal(paths.includes(prohibited), false, `${prohibited} is not browser-reachable`);
  }

  const rawRequestPrimitive = /(?:\bfetch|globalThis\s*\.\s*fetch|window\s*\.\s*fetch)\s*\(|new\s+(?:XMLHttpRequest|WebSocket|EventSource|WebTransport)\s*\(|navigator\s*\.\s*sendBeacon\s*\(/u;
  for (const [pathname, source] of graph) {
    const label = relative(root, pathname);
    assert.doesNotMatch(source, rawRequestPrimitive, `${label} bypasses the capability broker`);
    assert.doesNotMatch(source, /router\.huggingface\.co|api-inference\.huggingface\.co/iu, `${label} exposes the provider endpoint`);
    assert.doesNotMatch(
      source,
      /(?:from\s*|import\(\s*)["']@mlc-ai\/web-llm|\bCreateMLCEngine\s*\(/u,
      `${label} includes a browser model client`,
    );
  }

  const broker = graph.get(resolve(root, "app/privacy/networkCapabilities.js"));
  assert.match(broker, /return\s+fetchImpl\(url,/u);
  assert.doesNotMatch(broker, /(?:^|[^\w.])fetch\s*\(/mu, "the broker cannot bypass its injectable fixed transport");
  const remoteRequest = graph.get(resolve(root, "app/resume/lattice/remoteRequest.js"));
  const remoteProtocol = graph.get(resolve(root, "app/resume/lattice/remoteProtocol.js"));
  assert.match(remoteProtocol, /LATTICE_API_PATH\s*=\s*"\/api\/lattice"/u);
  assert.match(
    remoteRequest,
    /capabilityFetch\(LATTICE_REMOTE_CAPABILITY,\s*LATTICE_API_PATH,/u,
    "the only browser request uses the named capability and its fixed same-origin path",
  );
});

test("TEST-PRIV-001 through 003: loading the request boundary causes no ambient request", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    throw new Error("ambient request");
  };
  try {
    const moduleUrl = new URL(`../app/resume/lattice/remoteRequest.js?privacy=${Date.now()}`, import.meta.url);
    const remote = await import(moduleUrl.href);
    assert.equal(typeof remote.makeLatticeRequest, "function");
    assert.equal(typeof remote.requestRemoteLattice, "function");
    assert.equal(requests, 0, "module load, equivalent to idle render/reload, transmits nothing");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("TEST-PRIV-001 through 004: only the explicit form submission invokes the remote request", async () => {
  const source = await readFile(resumeEntry, "utf8");
  const executeStart = source.indexOf("const executeLattice = async () => {");
  const submitStart = source.indexOf("const runLattice = (", executeStart);
  const nextHandler = source.indexOf("const startLatticeOver =", submitStart);
  assert.ok(executeStart >= 0 && submitStart > executeStart && nextHandler > submitStart);

  const executeSource = source.slice(executeStart, submitStart);
  const submitSource = source.slice(submitStart, nextHandler);
  const inputStart = source.indexOf("const updateLatticeInput =", 0);
  assert.ok(inputStart >= 0 && inputStart < executeStart);
  const inputSource = source.slice(inputStart, executeStart);
  assert.equal((source.match(/await\s+requestRemoteLattice\s*\(/gu) ?? []).length, 1);
  assert.match(executeSource, /await\s+requestRemoteLattice\(latticeInput,/u);
  assert.doesNotMatch(inputSource, /requestRemoteLattice\s*\(/u);
  assert.match(submitSource, /event\.preventDefault\(\);\s*void executeLattice\(\);/u);
  assert.equal((source.match(/void executeLattice\(\)/gu) ?? []).length, 1);
  assert.match(source, /<form className="lattice-form" onSubmit=\{runLattice\}/u);
  assert.match(source, /<textarea[\s\S]*?onChange=\{\(event\) => updateLatticeInput\(event\.currentTarget\.value\)\}/u);
});

test("TEST-PRIV-012: no production service worker or CacheStorage can intercept the API", async () => {
  const sourceFiles = [
    ...await recursiveFiles(resolve(root, "app")),
    ...await recursiveFiles(resolve(root, "public")),
  ].filter((pathname) => productionSourceExtensions.has(extname(pathname)));
  for (const pathname of sourceFiles) {
    assertNoServiceWorkerInterception(await readFile(pathname, "utf8"), relative(root, pathname));
  }

  for (const mutation of [
    'navigator.serviceWorker.register("/sw.js")',
    'self.addEventListener("fetch", event => event.respondWith(fetch(event.request)))',
    'caches.match("/api/lattice")',
    'cache.put("/api/lattice", response)',
  ]) {
    assert.throws(
      () => assertNoServiceWorkerInterception(mutation, "mutation"),
      /interception surface/u,
    );
  }
});

test("TEST-PRIV-014: the document policy permits only same-origin connections", async () => {
  const { TEXT_TO_LATTICE_DOCUMENT_POLICY } = await import(
    "../workers/text-to-lattice-response-policy/worker.js"
  );
  const policy = TEXT_TO_LATTICE_DOCUMENT_POLICY["Content-Security-Policy"];
  const connectSources = cspDirectives(policy).get("connect-src");
  assert.deepEqual(connectSources, ["'self'"]);
  assert.equal(connectSources.some((value) => ["*", "http:", "https:"].includes(value)), false);
  assert.equal(connectSources.some((value) => /huggingface|hf\.co|workers\.dev/iu.test(value)), false);
});

test("TEST-PRIV-013 and 015: the API Worker owns the provider and no content sink", async () => {
  const [workerSource, adapterSource, configSource] = await Promise.all([
    readFile(resolve(apiWorkerDirectory, "worker.js"), "utf8"),
    readFile(resolve(apiWorkerDirectory, "huggingFaceAdapter.js"), "utf8"),
    readFile(resolve(apiWorkerDirectory, "wrangler.jsonc"), "utf8"),
  ]);
  const serverSource = `${workerSource}\n${adapterSource}`;

  assert.equal((serverSource.match(/https:\/\/router\.huggingface\.co\/v1\/chat\/completions/gu) ?? []).length, 1);
  assert.match(serverSource, /env\.HF_TOKEN/u);
  assert.doesNotMatch(serverSource, /env\.(?:PROVIDER|UPSTREAM|TARGET)_(?:URL|ORIGIN)|(?:payload|body|requestBody)\.(?:url|origin|endpoint|provider|target)/iu);
  assert.doesNotMatch(serverSource, /\bconsole\s*\./u);
  assert.doesNotMatch(serverSource, /\bcaches\s*\.|\.executionCtx\.waitUntil\s*\(|\b(?:KV|R2|D1)\b/iu);
  assert.doesNotMatch(configSource, /\[\[?(?:kv_namespaces|r2_buckets|d1_databases|durable_objects)|HF_TOKEN\s*=/iu);
  assert.match(configSource, /"pattern"\s*:\s*"hah\.dev\/api\/lattice"/u);
  assert.doesNotMatch(configSource, /hah\.dev\/api\/lattice\*/u);

  const browserFiles = (await recursiveFiles(resolve(root, "app")))
    .filter((pathname) => productionSourceExtensions.has(extname(pathname)));
  for (const pathname of browserFiles) {
    const source = await readFile(pathname, "utf8");
    assert.doesNotMatch(source, /\bHF_TOKEN\b/u, `${relative(root, pathname)} exposes the provider credential binding`);
  }
});

test("CI gates publication on privacy tests and a pre-provisioned server secret", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const privacyGate = workflow.indexOf("Enforce Text to Lattice network privacy boundary");
  const secretInventory = workflow.indexOf("Inspect Text to Lattice API encrypted binding names");
  const secretCheck = workflow.indexOf("Require the server-only provider credential binding");
  const apiDeploy = workflow.indexOf("Deploy bounded Text to Lattice API");
  const apiProbe = workflow.indexOf("Verify deployed Text to Lattice API boundary");
  const policyDeploy = workflow.indexOf("Deploy résumé response policy");
  const pagesDeploy = workflow.lastIndexOf("uses: actions/deploy-pages@");

  assert.ok(privacyGate > 0, "the build has a named privacy gate");
  assert.match(
    workflow.slice(privacyGate),
    /node --test[\s\S]*?tests\/lattice-network-capability\.test\.mjs[\s\S]*?tests\/lattice-network-governance\.test\.mjs[\s\S]*?tests\/lattice-api-worker\.test\.mjs/u,
  );
  assert.ok(secretInventory > 0 && secretInventory < secretCheck);
  assert.ok(secretCheck < apiDeploy, "deployment fails closed before installing code without its provider secret");
  assert.ok(apiDeploy < apiProbe, "the deployed API receives a bodyless boundary probe");
  assert.ok(apiProbe < policyDeploy, "the same-origin API is proven before the restrictive browser policy activates");
  assert.ok(policyDeploy < pagesDeploy, "the API and policy are ready before Pages publication");
  assert.match(workflow, /wrangler secret list --format json[\s\S]*?workers\/text-to-lattice-api\/wrangler\.jsonc/u);
  assert.match(workflow, /wrangler deploy[\s\S]*?workers\/text-to-lattice-api\/wrangler\.jsonc/u);
  assert.match(workflow, /LATTICE_API_BASE_URL: https:\/\/hah\.dev/u);
  assert.doesNotMatch(workflow, /(?:NEXT_PUBLIC|PUBLIC|VITE)[A-Z0-9_]*HF_TOKEN|secrets\.HF_TOKEN/u);
});

test("the optional deployed boundary rejects ambient methods without a sample", {
  skip: process.env.LATTICE_API_BASE_URL ? false : "set LATTICE_API_BASE_URL for a post-deploy probe",
}, async () => {
  const origin = new URL(process.env.LATTICE_API_BASE_URL).origin;
  let response = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      response = await fetch(`${origin}/api/lattice`, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      response = null;
    }
    if (response?.status === 405) break;
    await response?.body?.cancel().catch(() => {});
    if (attempt < 4) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1_000));
  }
  assert.ok(response instanceof Response, "the API boundary is reachable after deployment");
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.match(response.headers.get("cache-control") ?? "", /\bno-store\b/iu);
  const bodyText = await response.text();
  assert.ok(new TextEncoder().encode(bodyText).byteLength <= 1_024);
  const body = JSON.parse(bodyText);
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.equal(typeof body.error, "string");

  const mediaResponse = await fetch(`${origin}/api/lattice`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "text/plain" },
    body: "privacy-canary",
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(mediaResponse.status, 415);
  const mediaText = await mediaResponse.text();
  assert.doesNotMatch(mediaText, /privacy-canary/u);
  assert.deepEqual(JSON.parse(mediaText), { error: "unsupported_media_type" });

  const schemaResponse = await fetch(`${origin}/api/lattice`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ probe: "privacy-canary" }),
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(schemaResponse.status, 400);
  const schemaText = await schemaResponse.text();
  assert.doesNotMatch(schemaText, /privacy-canary/u);
  assert.deepEqual(JSON.parse(schemaText), { error: "invalid_request" });

  const wrongPath = await fetch(`${origin}/api/lattice/undeclared`, {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(wrongPath.status, 404);
  await wrongPath.body?.cancel().catch(() => {});
});
