import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { verifyTextToLatticeSecretBindings } from "../scripts/verify-text-to-lattice-secret-bindings.mjs";
import {
  TEXT_TO_LATTICE_ROUTE_INVENTORY,
  verifyTextToLatticeRouteInventory,
} from "../scripts/verify-text-to-lattice-route-inventory.mjs";
import { verifyTextToLatticeServices } from "../scripts/verify-text-to-lattice-services.mjs";
import {
  installSecretPlan,
  secretBootstrapPlan,
} from "../scripts/bootstrap-text-to-lattice-secrets.mjs";
import {
  TEXT_TO_LATTICE_DOCUMENT_POLICY,
  applyTextToLatticeDocumentPolicy,
} from "../workers/text-to-lattice-response-policy/worker.js";
import {
  CLOUDFLARE_DEMONSTRATION_SITE_KEY,
  CLOUDFLARE_DEMONSTRATION_TOKEN,
} from "../workers/text-to-lattice-lease/demonstrationProfile.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = resolve(root, ".github/workflows/pages.yml");
const mainConnectSources = [
  "'self'",
  "https://huggingface.co",
  "https://*.huggingface.co",
  "https://*.hf.co",
  "https://raw.githubusercontent.com",
];
const mainResourceDirectives = [
  ["connect-src", mainConnectSources],
  ["style-src", ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]],
  ["font-src", ["'self'", "https://fonts.gstatic.com"]],
  ["img-src", ["'self'", "data:"]],
  ["worker-src", ["'self'"]],
  ["object-src", ["'none'"]],
  ["base-uri", ["'self'"]],
  ["form-action", ["'self'"]],
];
const mainPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "frame-src https://verify.hah.dev",
  ...mainResourceDirectives.map(([name, values]) => `${name} ${values.join(" ")}`),
].join("; ");
const mainPageUrls = new Set([
  "https://hah.dev/",
  "https://hah.dev/index.html",
  "https://hah.dev/resume/",
  "https://hah.dev/resume/index.html",
]);

const frameHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src data: https://challenges.cloudflare.com; frame-ancestors https://hah.dev; base-uri 'none'; form-action 'none'; object-src 'none'",
  "Cross-Origin-Resource-Policy": "same-site",
  "Origin-Agent-Cluster": "?1",
  "Permissions-Policy": "camera=(), document-domain=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, nosnippet",
};

const leaseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const fixtureLeaseToken = `l1.${"A".repeat(32)}.1893456000000.${"B".repeat(43)}`;

const frameSources = new Map([
  ["https://verify.hah.dev/turnstile/", {
    path: "workers/text-to-lattice-attestation-frame/public/turnstile/index.html",
    contentType: "text/html; charset=utf-8",
  }],
  ["https://verify.hah.dev/turnstile/bridge.js", {
    path: "workers/text-to-lattice-attestation-frame/public/turnstile/bridge.js",
    contentType: "application/javascript; charset=utf-8",
  }],
  ["https://verify.hah.dev/turnstile/styles.css", {
    path: "workers/text-to-lattice-attestation-frame/public/turnstile/styles.css",
    contentType: "text/css; charset=utf-8",
  }],
]);

function jsonResponse(status, value, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

function fixtureFetch({
  mainPolicy: responseMainPolicy = mainPolicy,
  mutateMainHeaders = (headers) => headers,
  mutateFrameHeaders = (headers) => headers,
  mutateFrameSource = (source) => source,
  observeRequest = () => {},
} = {}) {
  return async (input, init = {}) => {
    const url = `${input}`;
    observeRequest(url, init);
    const frame = frameSources.get(url);
    if (frame) {
      const source = mutateFrameSource(await readFile(resolve(root, frame.path)), url);
      return new Response(source, {
        status: 200,
        headers: {
          ...mutateFrameHeaders({ ...frameHeaders }),
          "Content-Type": frame.contentType,
        },
      });
    }
    if (mainPageUrls.has(url)) {
      return new Response("resume", {
        status: 200,
        headers: mutateMainHeaders({
          "Content-Security-Policy": responseMainPolicy,
          "Permissions-Policy": "camera=(), document-domain=()",
        }, url),
      });
    }
    if (url !== "https://hah.dev/api/text-to-lattice/lease") {
      throw new Error("Unexpected fixture URL.");
    }

    const requestHeaders = new Headers(init.headers);
    if ((init.method ?? "GET") === "GET") {
      return new Response(null, {
        status: 405,
        headers: { ...leaseHeaders, Allow: "POST, PATCH, DELETE" },
      });
    }
    if (requestHeaders.get("Origin") !== "https://hah.dev") {
      return jsonResponse(403, {
        allowed: false,
        code: "same-origin-empty-request-required",
      }, leaseHeaders);
    }
    if (!requestHeaders.has("Cookie")) {
      return jsonResponse(428, {
        allowed: false,
        code: "visitor-cookie-required",
        attestationSiteKey: CLOUDFLARE_DEMONSTRATION_SITE_KEY,
      }, {
        ...leaseHeaders,
        "Set-Cookie": "__Secure-hah-lattice-visitor=v1.fixture.signature; Max-Age=86400; Path=/api/text-to-lattice; Secure; HttpOnly; SameSite=Strict",
      });
    }
    if (
      init.method === "DELETE"
      && requestHeaders.get("Authorization") === `Bearer ${fixtureLeaseToken}`
    ) {
      return new Response(null, { status: 204, headers: leaseHeaders });
    }
    if (requestHeaders.get("X-Lattice-Attestation") === CLOUDFLARE_DEMONSTRATION_TOKEN) {
      return jsonResponse(200, {
        allowed: true,
        leaseToken: fixtureLeaseToken,
        expiresAt: 1893456000000,
        maximumExpiresAt: 1893456300000,
      }, leaseHeaders);
    }
    if (requestHeaders.has("X-Lattice-Attestation")) {
      return jsonResponse(403, {
        allowed: false,
        code: "attestation-rejected",
      }, leaseHeaders);
    }
    return jsonResponse(428, {
      allowed: false,
      code: "attestation-required",
      attestationSiteKey: CLOUDFLARE_DEMONSTRATION_SITE_KEY,
    }, leaseHeaders);
  };
}

test("the Pages graph bootstraps held infrastructure only when requested and requires it when enabled", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /workflow_dispatch:[\s\S]*?deploy_text_to_lattice_services:[\s\S]*?type: boolean/u);
  assert.match(
    workflow,
    /needs\.publication-boundary\.outputs\.public_client_status == 'enabled' \|\|[\s\S]*?github\.event_name == 'push' &&[\s\S]*?contains\(github\.event\.head_commit\.message, '\[deploy-text-to-lattice-services\]'\)[\s\S]*?github\.event_name == 'workflow_dispatch' && inputs\.deploy_text_to_lattice_services == true/u,
  );
  assert.equal(
    [...workflow.matchAll(/github\.event_name == 'push'/gu)].length,
    1,
  );
  assert.match(workflow, /--require-official-test-profile/u);
  assert.doesNotMatch(workflow, /--allow-official-test-keys/u);
  assert.match(
    workflow,
    /public_client_status == 'held' &&[\s\S]*?\["skipped", "success"\][\s\S]*?deploy_text_to_lattice_services\.result/u,
  );
  assert.match(
    workflow,
    /public_client_status == 'enabled' &&[\s\S]*?deploy_text_to_lattice_services\.result == 'success'/u,
  );
  assert.match(workflow, /needs: \[publication-boundary, build, deploy_text_to_lattice_services\]/u);
  assert.doesNotMatch(workflow, /^concurrency:/mu);
  assert.match(
    workflow,
    /deploy_text_to_lattice_services:[\s\S]*?concurrency:\s*\n\s*group: text-to-lattice-services\s*\n\s*cancel-in-progress: false/u,
  );
  assert.match(
    workflow,
    /\n  deploy:\n[\s\S]*?concurrency:\s*\n\s*group: pages\s*\n\s*cancel-in-progress: false/u,
  );
});

test("deployment tooling and every action reference are immutable", async () => {
  const [workflow, packageSource, lockSource] = await Promise.all([
    readFile(workflowPath, "utf8"),
    readFile(resolve(root, "workers/package.json"), "utf8"),
    readFile(resolve(root, "workers/package-lock.json"), "utf8"),
  ]);
  const workerPackage = JSON.parse(packageSource);
  const workerLock = JSON.parse(lockSource);
  assert.equal(workerPackage.type, "module");
  assert.equal(workerPackage.devDependencies.wrangler, "4.129.1");
  assert.equal(workerLock.packages[""].devDependencies.wrangler, "4.129.1");
  assert.equal(workerLock.packages["node_modules/wrangler"].version, "4.129.1");
  assert.doesNotMatch(workflow, /\bnpx\b|cloudflare\/wrangler-action/iu);
  const actionReferences = [...workflow.matchAll(/^\s*- uses:\s*(\S+)/gmu)].map((match) => match[1]);
  assert.ok(actionReferences.length > 0);
  for (const reference of actionReferences) {
    assert.match(reference, /^[^@\s]+@[0-9a-f]{40}$/u);
  }
});

test("Cloudflare credentials remain protected and narrowly exposed", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /environment:\s*\n\s*name: text-to-lattice-production/u);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ vars\.CLOUDFLARE_ACCOUNT_ID \}\}/u);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_TEXT_TO_LATTICE_DEPLOY_TOKEN \}\}/u);
  assert.deepEqual(
    [...workflow.matchAll(/secrets\.([A-Z0-9_]+)/gu)].map((match) => match[1]).filter((value, index, all) => all.indexOf(value) === index),
    ["CLOUDFLARE_TEXT_TO_LATTICE_DEPLOY_TOKEN"],
  );
  for (const runtimeSecret of [
    "LEASE_CREDENTIAL_SECRET",
    "TURNSTILE_SECRET_KEY",
    "TURNSTILE_SITE_KEY",
    "VISITOR_COOKIE_SECRET",
  ]) {
    assert.doesNotMatch(workflow, new RegExp(runtimeSecret, "u"));
  }
});

test("the pinned Wrangler secret inventory uses its supported JSON flag", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /wrangler secret list --format json/u);
  assert.doesNotMatch(workflow, /wrangler secret list --json/u);
});

test("the service job deploys and proves the frame before the lease and Pages", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const policyDeploy = workflow.indexOf("Deploy résumé response policy");
  const frameDeploy = workflow.indexOf("Deploy isolated verification frame");
  const frameProbe = workflow.indexOf("Verify deployed frame bytes and isolation headers");
  const leaseDeploy = workflow.indexOf("Deploy lease Worker");
  const bindingBootstrap = workflow.indexOf("Preserve complete bindings or bootstrap the bounded demonstration profile");
  const bindingProbe = workflow.indexOf("Verify encrypted Worker binding names");
  const routeProbe = workflow.indexOf("Verify exact Worker route inventory");
  const liveProbe = workflow.indexOf("Verify live Text to Lattice boundaries");
  const pagesDeploy = workflow.lastIndexOf("uses: actions/deploy-pages@");
  assert.ok(policyDeploy > 0);
  assert.ok(policyDeploy < frameDeploy);
  assert.ok(frameDeploy > 0);
  assert.ok(frameDeploy < frameProbe);
  assert.ok(frameProbe < leaseDeploy);
  assert.ok(leaseDeploy < bindingBootstrap);
  assert.ok(bindingBootstrap < bindingProbe);
  assert.ok(leaseDeploy < bindingProbe);
  assert.ok(bindingProbe < routeProbe);
  assert.ok(routeProbe < liveProbe);
  assert.ok(bindingProbe < liveProbe);
  assert.ok(liveProbe < pagesDeploy);
});

test("the exact-route edge policy and in-document fallback avoid a portfolio-wide Worker route", async () => {
  const original = new Response("resume", {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Origin": "github-pages" },
  });
  const protectedResponse = applyTextToLatticeDocumentPolicy(original, "/resume/");
  assert.notEqual(protectedResponse, original);
  assert.equal(protectedResponse.status, 200);
  assert.equal(protectedResponse.headers.get("X-Origin"), "github-pages");
  assert.equal(
    protectedResponse.headers.get("Content-Security-Policy"),
    TEXT_TO_LATTICE_DOCUMENT_POLICY["Content-Security-Policy"],
  );
  assert.equal(protectedResponse.headers.get("Permissions-Policy"), "document-domain=()");
  assert.equal(await protectedResponse.text(), "resume");

  const asset = new Response("asset", { headers: { "Content-Type": "text/css" } });
  assert.equal(applyTextToLatticeDocumentPolicy(asset, "/assets/site.css"), asset);

  const [config, workflow, layout] = await Promise.all([
    readFile(resolve(root, "workers/text-to-lattice-response-policy/wrangler.jsonc"), "utf8"),
    readFile(workflowPath, "utf8"),
    readFile(resolve(root, "app/layout.tsx"), "utf8"),
  ]);
  const parsed = JSON.parse(config);
  assert.equal(parsed.workers_dev, false);
  assert.equal(parsed.preview_urls, false);
  assert.equal(parsed.send_metrics, false);
  assert.deepEqual(parsed.routes, [
    { pattern: "hah.dev/", zone_name: "hah.dev" },
    { pattern: "hah.dev/index.html", zone_name: "hah.dev" },
    { pattern: "hah.dev/resume/", zone_name: "hah.dev" },
    { pattern: "hah.dev/resume/index.html", zone_name: "hah.dev" },
  ]);
  assert.ok(parsed.routes.every(({ pattern }) => !pattern.endsWith("*")));
  assert.match(layout, /project\.id === "lattice" && String\(project\.interactiveRelease\) === "enabled"/u);
  assert.match(layout, /httpEquiv="Content-Security-Policy"/u);
  assert.match(layout, /TEXT_TO_LATTICE_DOCUMENT_POLICY\["Content-Security-Policy"\]/u);
  assert.match(workflow, /wrangler deploy[\s\S]*?workers\/text-to-lattice-response-policy\/wrangler\.jsonc/u);
});

test("secret bootstrap preserves complete bindings and atomically supplies an absent testing profile", () => {
  const exact = [
    { name: "VISITOR_COOKIE_SECRET", type: "secret_text" },
    { name: "LEASE_CREDENTIAL_SECRET", type: "secret_text" },
    { name: "TURNSTILE_SECRET_KEY", type: "secret_text" },
    { name: "TURNSTILE_SITE_KEY", type: "secret_text" },
  ];
  assert.deepEqual(
    secretBootstrapPlan(exact, { requireOfficialTestProfile: false }),
    [],
  );
  assert.throws(
    () => secretBootstrapPlan([], { requireOfficialTestProfile: false }),
    /official testing profile was not explicitly required/u,
  );
  assert.throws(
    () => secretBootstrapPlan([{ name: "TURNSTILE_SITE_KEY" }], { requireOfficialTestProfile: false }),
    /Turnstile bindings are incomplete/u,
  );
  assert.throws(
    () => secretBootstrapPlan([{ name: "UNREVIEWED_SECRET" }], { requireOfficialTestProfile: true }),
    /Unexpected encrypted binding/u,
  );
  for (const malformed of [null, {}, [], { name: "" }]) {
    assert.throws(
      () => secretBootstrapPlan([malformed], { requireOfficialTestProfile: true }),
      /malformed secret-name inventory entry/u,
    );
  }
  assert.throws(
    () => secretBootstrapPlan([
      { name: "VISITOR_COOKIE_SECRET" },
      { name: "VISITOR_COOKIE_SECRET" },
    ], { requireOfficialTestProfile: true }),
    /duplicate encrypted binding VISITOR_COOKIE_SECRET/u,
  );

  const plan = secretBootstrapPlan([], { requireOfficialTestProfile: true });
  assert.deepEqual(plan.map(({ name }) => name).sort(), exact.map(({ name }) => name).sort());
  assert.equal(plan.filter(({ source }) => source === "generated-private").length, 2);
  assert.equal(plan.filter(({ source }) => source === "cloudflare-official-test").length, 2);
  assert.ok(plan.every(({ value }) => value.length >= 22));
  assert.equal(new Set(plan.map(({ value }) => value)).size, plan.length);

  const preservedCompletePair = secretBootstrapPlan(exact, {
    requireOfficialTestProfile: true,
  });
  assert.deepEqual(preservedCompletePair, []);

  assert.throws(
    () => secretBootstrapPlan([
      { name: "VISITOR_COOKIE_SECRET" },
      { name: "LEASE_CREDENTIAL_SECRET" },
      { name: "TURNSTILE_SITE_KEY" },
    ], { requireOfficialTestProfile: true }),
    /Turnstile bindings are incomplete/u,
  );
});

test("secret bootstrap installs the complete missing set in one Wrangler bulk request", () => {
  const plan = [
    { name: "VISITOR_COOKIE_SECRET", source: "generated-private", value: "visitor-value" },
    { name: "LEASE_CREDENTIAL_SECRET", source: "generated-private", value: "lease-value" },
    { name: "TURNSTILE_SECRET_KEY", source: "cloudflare-official-test", value: "turnstile-secret" },
    { name: "TURNSTILE_SITE_KEY", source: "cloudflare-official-test", value: "turnstile-site" },
  ];
  const calls = [];
  installSecretPlan(plan, {
    wranglerPath: "/pinned/wrangler",
    configPath: "workers/text-to-lattice-lease/wrangler.jsonc",
    env: { CLOUDFLARE_ACCOUNT_ID: "account" },
    spawn: (...argumentsList) => {
      calls.push(argumentsList);
      return { status: 0 };
    },
  });

  assert.equal(calls.length, 1);
  const [command, argumentsList, options] = calls[0];
  assert.equal(command, "/pinned/wrangler");
  assert.deepEqual(argumentsList, [
    "secret",
    "bulk",
    "--config",
    "workers/text-to-lattice-lease/wrangler.jsonc",
  ]);
  assert.deepEqual(JSON.parse(options.input), Object.fromEntries(
    plan.map(({ name, value }) => [name, value]),
  ));
  assert.deepEqual(options.env, { CLOUDFLARE_ACCOUNT_ID: "account" });
  assert.deepEqual(options.stdio, ["pipe", "inherit", "inherit"]);
  assert.doesNotMatch(argumentsList.join(" "), /visitor-value|lease-value|turnstile/u);
});

test("secret bootstrap refuses an ambiguous bulk plan before invoking Wrangler", () => {
  let calls = 0;
  const options = {
    wranglerPath: "/pinned/wrangler",
    configPath: "workers/text-to-lattice-lease/wrangler.jsonc",
    spawn: () => {
      calls += 1;
      return { status: 0 };
    },
  };

  assert.throws(
    () => installSecretPlan([
      { name: "VISITOR_COOKIE_SECRET", value: "first" },
      { name: "VISITOR_COOKIE_SECRET", value: "second" },
    ], options),
    /duplicate binding VISITOR_COOKIE_SECRET/u,
  );
  assert.throws(
    () => installSecretPlan([{ name: "UNREVIEWED_SECRET", value: "value" }], options),
    /unexpected encrypted binding/u,
  );
  assert.equal(calls, 0);
});

test("encrypted binding inspection accepts only the four separated runtime values", () => {
  const exact = [
    { name: "VISITOR_COOKIE_SECRET", type: "secret_text" },
    { name: "LEASE_CREDENTIAL_SECRET", type: "secret_text" },
    { name: "TURNSTILE_SECRET_KEY", type: "secret_text" },
    { name: "TURNSTILE_SITE_KEY", type: "secret_text" },
  ];
  assert.doesNotThrow(() => verifyTextToLatticeSecretBindings(exact));
  assert.throws(
    () => verifyTextToLatticeSecretBindings(exact.slice(1)),
    /exactly the four documented encrypted bindings/u,
  );
  assert.throws(
    () => verifyTextToLatticeSecretBindings([...exact, { name: "UNREVIEWED_SECRET" }]),
    /exactly the four documented encrypted bindings/u,
  );
});

test("protected route inspection accepts only each Text to Lattice Worker's exact inventory", async () => {
  const zoneId = "a".repeat(32);
  const requested = [];
  await verifyTextToLatticeRouteInventory({
    apiToken: "protected-route-read-token",
    async fetchImpl(url, init) {
      requested.push({ url, init });
      if (url.includes("/zones?")) {
        return jsonResponse(200, { success: true, result: [{ id: zoneId, name: "hah.dev" }] });
      }
      const result = Object.entries(TEXT_TO_LATTICE_ROUTE_INVENTORY).flatMap(
        ([script, patterns]) => patterns.map((pattern) => ({ pattern, script })),
      );
      result.push({ pattern: "hah.dev/unrelated-exclusion*" });
      return jsonResponse(200, {
        success: true,
        result,
      });
    },
  });
  assert.equal(requested.length, 2);
  assert.match(requested[0].url, /\/zones\?name=hah\.dev&status=active&per_page=50$/u);
  assert.equal(requested[1].url, `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`);
  assert.ok(requested.every(({ init }) => init.headers.Authorization === "Bearer protected-route-read-token"));
  assert.ok(requested.every(({ init }) => init.credentials === "omit" && init.redirect === "error"));
});

test("protected route inspection rejects a stale portfolio-wide response-policy route", async () => {
  const zoneId = "b".repeat(32);
  await assert.rejects(
    verifyTextToLatticeRouteInventory({
      apiToken: "protected-route-read-token",
      async fetchImpl(url) {
        if (url.includes("/zones?")) {
          return jsonResponse(200, { success: true, result: [{ id: zoneId, name: "hah.dev" }] });
        }
        const result = Object.entries(TEXT_TO_LATTICE_ROUTE_INVENTORY).flatMap(
          ([script, patterns]) => patterns.map((pattern) => ({ pattern, script })),
        );
        result.push({
          pattern: "hah.dev/*",
          script: "hahdev-text-to-lattice-response-policy",
        });
        return jsonResponse(200, {
          success: true,
          result,
        });
      },
    }),
    /response-policy does not own exactly its declared Cloudflare route inventory/u,
  );
});

test("protected route inspection rejects malformed route records", async () => {
  const zoneId = "c".repeat(32);
  const exact = Object.entries(TEXT_TO_LATTICE_ROUTE_INVENTORY).flatMap(
    ([script, patterns]) => patterns.map((pattern) => ({ pattern, script })),
  );
  await assert.rejects(verifyTextToLatticeRouteInventory({
    apiToken: "protected-route-read-token",
    async fetchImpl(url) {
      if (url.includes("/zones?")) {
        return jsonResponse(200, { success: true, result: [{ id: zoneId, name: "hah.dev" }] });
      }
      return jsonResponse(200, {
        success: true,
        result: [...exact, { pattern: null, script: "unrelated-worker" }],
      });
    },
  }), /malformed entry/u);
});

test("live qualification accepts the exact public route, cookie, and header contracts", async () => {
  let invalidAttestationRequest = null;
  let demonstrationAcquisitionRequest = null;
  let demonstrationReleaseRequest = null;
  const requestedMainPages = new Set();
  await verifyTextToLatticeServices({
    fetchImpl: fixtureFetch({
      observeRequest(url, init) {
        if (mainPageUrls.has(url)) requestedMainPages.add(url);
        const headers = new Headers(init.headers);
        if (headers.get("X-Lattice-Attestation") === "qualification-intentionally-invalid") {
          invalidAttestationRequest = { url, init, headers };
        } else if (headers.get("X-Lattice-Attestation") === CLOUDFLARE_DEMONSTRATION_TOKEN) {
          demonstrationAcquisitionRequest = { url, init, headers };
        } else if (init.method === "DELETE") {
          demonstrationReleaseRequest = { url, init, headers };
        }
      },
    }),
    retryDelay: async () => {},
  });
  assert.equal(invalidAttestationRequest?.url, "https://hah.dev/api/text-to-lattice/lease");
  assert.equal(invalidAttestationRequest?.init.method, "POST");
  assert.equal(invalidAttestationRequest?.init.body, undefined);
  assert.equal(invalidAttestationRequest?.headers.get("Origin"), "https://hah.dev");
  assert.equal(invalidAttestationRequest?.headers.get("Sec-Fetch-Site"), "same-origin");
  assert.equal(invalidAttestationRequest?.headers.get("Sec-Fetch-Mode"), "cors");
  assert.equal(invalidAttestationRequest?.headers.get("Sec-Fetch-Dest"), "empty");
  assert.match(invalidAttestationRequest?.headers.get("Cookie") ?? "", /^__Secure-hah-lattice-visitor=/u);
  assert.match(
    invalidAttestationRequest?.headers.get("X-Lattice-Attestation") ?? "",
    /^qualification-intentionally-invalid$/u,
  );
  assert.equal(demonstrationAcquisitionRequest?.url, "https://hah.dev/api/text-to-lattice/lease");
  assert.equal(demonstrationAcquisitionRequest?.init.method, "POST");
  assert.equal(demonstrationAcquisitionRequest?.init.body, undefined);
  assert.equal(demonstrationAcquisitionRequest?.headers.get("Sec-Fetch-Site"), "same-origin");
  assert.equal(demonstrationAcquisitionRequest?.headers.get("Sec-Fetch-Mode"), "cors");
  assert.equal(demonstrationAcquisitionRequest?.headers.get("Sec-Fetch-Dest"), "empty");
  assert.equal(
    demonstrationAcquisitionRequest?.headers.get("X-Lattice-Attestation"),
    CLOUDFLARE_DEMONSTRATION_TOKEN,
  );
  assert.equal(demonstrationReleaseRequest?.url, "https://hah.dev/api/text-to-lattice/lease");
  assert.equal(demonstrationReleaseRequest?.init.method, "DELETE");
  assert.equal(demonstrationReleaseRequest?.init.body, undefined);
  assert.equal(demonstrationReleaseRequest?.headers.get("Sec-Fetch-Site"), "same-origin");
  assert.equal(demonstrationReleaseRequest?.headers.get("Sec-Fetch-Mode"), "cors");
  assert.equal(demonstrationReleaseRequest?.headers.get("Sec-Fetch-Dest"), "empty");
  assert.equal(
    demonstrationReleaseRequest?.headers.get("Authorization"),
    `Bearer ${fixtureLeaseToken}`,
  );
  assert.deepEqual(requestedMainPages, mainPageUrls);
});

test("live qualification rejects a credential profile that advertises another site key", async () => {
  const fetchImpl = fixtureFetch();
  await assert.rejects(
    verifyTextToLatticeServices({
      async fetchImpl(input, init) {
        const response = await fetchImpl(input, init);
        if (`${input}` !== "https://hah.dev/api/text-to-lattice/lease" || response.status !== 428) {
          return response;
        }
        const value = await response.json();
        return jsonResponse(428, {
          ...value,
          attestationSiteKey: "0x4AAAA-production-profile",
        }, Object.fromEntries(response.headers));
      },
      retryDelay: async () => {},
    }),
    /does not expose the declared demonstration profile/u,
  );
});

test("live qualification attempts cleanup when an acquired lease has malformed lifecycle metadata", async () => {
  const fetchFixture = fixtureFetch();
  let releaseAttempted = false;
  await assert.rejects(
    verifyTextToLatticeServices({
      async fetchImpl(input, init = {}) {
        const headers = new Headers(init.headers);
        if (init.method === "DELETE") releaseAttempted = true;
        const response = await fetchFixture(input, init);
        if (headers.get("X-Lattice-Attestation") !== CLOUDFLARE_DEMONSTRATION_TOKEN) {
          return response;
        }
        return jsonResponse(200, {
          allowed: true,
          leaseToken: fixtureLeaseToken,
          expiresAt: "malformed",
          maximumExpiresAt: 1893456300000,
        }, leaseHeaders);
      },
      retryDelay: async () => {},
    }),
    /invalid lifecycle/u,
  );
  assert.equal(releaseAttempted, true);
});

test("live qualification attempts cleanup when an acquired lease has malformed headers", async () => {
  const fetchFixture = fixtureFetch();
  let releaseAttempted = false;
  await assert.rejects(
    verifyTextToLatticeServices({
      async fetchImpl(input, init = {}) {
        const headers = new Headers(init.headers);
        if (init.method === "DELETE") releaseAttempted = true;
        const response = await fetchFixture(input, init);
        if (headers.get("X-Lattice-Attestation") !== CLOUDFLARE_DEMONSTRATION_TOKEN) {
          return response;
        }
        const malformedHeaders = { ...leaseHeaders };
        delete malformedHeaders["Content-Security-Policy"];
        return jsonResponse(200, {
          allowed: true,
          leaseToken: fixtureLeaseToken,
          expiresAt: 1893456000000,
          maximumExpiresAt: 1893456300000,
        }, malformedHeaders);
      },
      retryDelay: async () => {},
    }),
    /omits content-security-policy/u,
  );
  assert.equal(releaseAttempted, true);
});

test("live qualification never replays an ambiguous demonstration acquisition", async () => {
  const fetchFixture = fixtureFetch();
  let acquisitionAttempts = 0;
  await assert.rejects(
    verifyTextToLatticeServices({
      async fetchImpl(input, init = {}) {
        const headers = new Headers(init.headers);
        if (headers.get("X-Lattice-Attestation") === CLOUDFLARE_DEMONSTRATION_TOKEN) {
          acquisitionAttempts += 1;
          return jsonResponse(503, {
            allowed: false,
            code: "usage-gate-unavailable",
          }, leaseHeaders);
        }
        return fetchFixture(input, init);
      },
      retryDelay: async () => {},
    }),
    /demonstration-profile acquisition probe did not settle/u,
  );
  assert.equal(acquisitionAttempts, 1);
});

test("live qualification rejects a route that does not reach attestation rejection", async () => {
  const fetchImpl = fixtureFetch();
  await assert.rejects(
    verifyTextToLatticeServices({
      async fetchImpl(input, init) {
        const headers = new Headers(init?.headers);
        if (headers.has("X-Lattice-Attestation")) {
          return jsonResponse(428, {
            allowed: false,
            code: "attestation-required",
            attestationSiteKey: CLOUDFLARE_DEMONSTRATION_SITE_KEY,
          }, leaseHeaders);
        }
        return fetchImpl(input, init);
      },
      retryDelay: async () => {},
    }),
    /invalid-attestation probe returned HTTP 428; expected 403/u,
  );
});

test("frame qualification retries a stale HTTP 200 asset until exact bytes settle", async () => {
  let documentResponses = 0;
  await verifyTextToLatticeServices({
    fetchImpl: fixtureFetch({
      mutateFrameSource(source, url) {
        if (url !== "https://verify.hah.dev/turnstile/") return source;
        documentResponses += 1;
        return documentResponses === 1 ? Buffer.from("stale frame") : source;
      },
    }),
    frameOnly: true,
    retryDelay: async () => {},
  });
  assert.equal(documentResponses, 2);
});

test("each verification-frame asset receives its own propagation window", async () => {
  const verifier = await readFile(
    new URL("../scripts/verify-text-to-lattice-services.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    verifier,
    /for \(const file of frameFiles\) \{\s*await verifyFrameFile\(fetchImpl, file, retryDelay, Date\.now\(\) \+ 45_000\);\s*\}/u,
  );
  assert.doesNotMatch(verifier, /const deadline = Date\.now\(\) \+ 45_000;\s*for \(const file of frameFiles\)/u);
});

test("main-page qualification rejects script policies that escape the isolated frame", async (context) => {
  const policies = [
    ["challenge origin", mainPolicy.replace("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://challenges.cloudflare.com")],
    ["HTTPS scheme", mainPolicy.replace("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https:")],
    ["wildcard", mainPolicy.replace("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' *")],
    ["script-src-elem override", `${mainPolicy}; script-src-elem https://challenges.cloudflare.com`],
    ["default-src fallback", "default-src https:; frame-src 'self' https://verify.hah.dev"],
  ];
  for (const [label, mainPolicy] of policies) {
    await context.test(label, async () => {
      await assert.rejects(verifyTextToLatticeServices({
        fetchImpl: fixtureFetch({ mainPolicy }),
        retryDelay: async () => {},
      }));
    });
  }
});

test("main-page qualification requires exact default, frame, and style override boundaries", async (context) => {
  const policies = [
    ["missing default-src", mainPolicy.replace("default-src 'self'; ", "")],
    ["expanded default-src", mainPolicy.replace("default-src 'self'", "default-src 'self' https:")],
    ["missing frame-src", mainPolicy.replace("frame-src https://verify.hah.dev; ", "")],
    ["expanded frame-src", mainPolicy.replace("frame-src https://verify.hah.dev", "frame-src https://verify.hah.dev https:")],
    ["style-src-elem override", `${mainPolicy}; style-src-elem https:`],
    ["style-src-attr override", `${mainPolicy}; style-src-attr 'none'`],
  ];
  for (const [label, policy] of policies) {
    await context.test(label, async () => {
      await assert.rejects(
        verifyTextToLatticeServices({
          fetchImpl: fixtureFetch({ mainPolicy: policy }),
          retryDelay: async () => {},
        }),
      );
    });
  }
});

test("main-page qualification requires every explicit ordinary-use resource directive and token", async (context) => {
  for (const [directive, requiredSources] of mainResourceDirectives) {
    await context.test(`${directive} directive`, async () => {
      const incompletePolicy = mainPolicy
        .split("; ")
        .filter((entry) => !entry.startsWith(`${directive} `))
        .join("; ");
      await assert.rejects(
        verifyTextToLatticeServices({
          fetchImpl: fixtureFetch({ mainPolicy: incompletePolicy }),
          retryDelay: async () => {},
        }),
        new RegExp(`does not match the release ${directive} directive`, "u"),
      );
    });
    for (const requiredSource of requiredSources) {
      await context.test(`${directive} ${requiredSource}`, async () => {
        const completeDirective = `${directive} ${requiredSources.join(" ")}`;
        const incompleteDirective = `${directive} ${requiredSources.filter((source) => source !== requiredSource).join(" ")}`.trim();
        await assert.rejects(
          verifyTextToLatticeServices({
            fetchImpl: fixtureFetch({
              mainPolicy: mainPolicy.replace(completeDirective, incompleteDirective),
            }),
            retryDelay: async () => {},
          }),
          new RegExp(`does not match the release ${directive} directive`, "u"),
        );
      });
    }
  }
});

test("both public résumé routes fail closed on missing or malformed response policies", async (context) => {
  const cases = [
    ["missing CSP", (headers) => {
      const copy = { ...headers };
      delete copy["Content-Security-Policy"];
      return copy;
    }],
    ["malformed CSP", (headers) => ({ ...headers, "Content-Security-Policy": "default-src 'self'" })],
    ["missing Permissions-Policy", (headers) => {
      const copy = { ...headers };
      delete copy["Permissions-Policy"];
      return copy;
    }],
    ["malformed Permissions-Policy", (headers) => ({ ...headers, "Permissions-Policy": "camera=()" })],
    ["duplicate Permissions-Policy directive", (headers) => ({
      ...headers,
      "Permissions-Policy": "camera=(), document-domain=(), document-domain=(self)",
    })],
  ];
  for (const url of mainPageUrls) {
    for (const [label, mutation] of cases) {
      await context.test(`${url} ${label}`, async () => {
        await assert.rejects(verifyTextToLatticeServices({
          fetchImpl: fixtureFetch({
            mutateMainHeaders(headers, requestUrl) {
              return requestUrl === url ? mutation(headers) : headers;
            },
          }),
          retryDelay: async () => {},
        }));
      });
    }
  }
});

test("frame qualification rejects drift in every critical header family", async (context) => {
  const mutations = [
    ["style-src", (headers) => ({
      ...headers,
      "Content-Security-Policy": headers["Content-Security-Policy"].replace("style-src 'self' 'unsafe-inline'", "style-src 'self'"),
    })],
    ["img-src", (headers) => ({
      ...headers,
      "Content-Security-Policy": headers["Content-Security-Policy"].replace("img-src data: https://challenges.cloudflare.com", "img-src data:"),
    })],
    ["form-action", (headers) => ({
      ...headers,
      "Content-Security-Policy": headers["Content-Security-Policy"].replace("; form-action 'none'", ""),
    })],
    ["Origin-Agent-Cluster", (headers) => ({ ...headers, "Origin-Agent-Cluster": "?0" })],
    ["Permissions-Policy", (headers) => ({
      ...headers,
      "Permissions-Policy": headers["Permissions-Policy"].replace(", usb=()", ""),
    })],
    ["X-Robots-Tag", (headers) => ({ ...headers, "X-Robots-Tag": "noindex" })],
  ];

  for (const [label, mutation] of mutations) {
    await context.test(label, async () => {
      await assert.rejects(
        verifyTextToLatticeServices({
          fetchImpl: fixtureFetch({ mutateFrameHeaders: mutation }),
          frameOnly: true,
          retryDelay: async () => {},
        }),
      );
    });
  }
});
