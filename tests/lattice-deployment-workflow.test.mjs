import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { verifyTextToLatticeSecretBindings } from "../scripts/verify-text-to-lattice-secret-bindings.mjs";
import {
  RETIRED_TEXT_TO_LATTICE_SURFACES,
  TEXT_TO_LATTICE_ROUTE_INVENTORY,
  verifyTextToLatticeRouteInventory,
} from "../scripts/verify-text-to-lattice-route-inventory.mjs";
import { verifyTextToLatticeServices } from "../scripts/verify-text-to-lattice-services.mjs";
import {
  installSecretPlan,
  secretBootstrapPlan,
} from "../scripts/bootstrap-text-to-lattice-secrets.mjs";
import {
  installTextToLatticeApiSecretPlan,
  textToLatticeApiSecretBootstrapPlan,
} from "../scripts/bootstrap-text-to-lattice-api-secrets.mjs";
import {
  verifyTextToLatticeHeldPages,
} from "../scripts/verify-text-to-lattice-held-pages.mjs";
import {
  TEXT_TO_LATTICE_QUALIFICATION_CLEANUP_LEAD_MS,
  TEXT_TO_LATTICE_QUALIFICATION_WINDOW_MS,
  planTextToLatticeQualificationWindow,
  waitForTextToLatticeQualificationCleanup,
} from "../scripts/plan-text-to-lattice-qualification-window.mjs";
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
  "Cache-Control": "no-store, max-age=0, no-transform",
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
const typedLeaseAccept = "application/vnd.hah.text-to-lattice-lease.v1+json, application/json";
const typedChallenge = Object.freeze({
  protocol: "hah-text-to-lattice-lease",
  version: 1,
  type: "attestation-challenge",
  allowed: false,
});
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
          "Cache-Control": "public, max-age=60, no-transform",
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
      return jsonResponse(requestHeaders.get("Accept") === typedLeaseAccept ? 200 : 428, {
        ...typedChallenge,
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
    return jsonResponse(requestHeaders.get("Accept") === typedLeaseAccept ? 200 : 428, {
      ...typedChallenge,
      code: "attestation-required",
      attestationSiteKey: CLOUDFLARE_DEMONSTRATION_SITE_KEY,
    }, leaseHeaders);
  };
}

test("the Pages graph branches explicitly across held, qualification, and qualified phases", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /workflow_dispatch:[\s\S]*?deploy_text_to_lattice_services:[\s\S]*?type: boolean/u);
  assert.match(workflow, /activate_text_to_lattice_qualification:[\s\S]*?type: boolean/u);
  assert.match(
    workflow,
    /release_phase: \$\{\{ steps\.release-state\.outputs\.release_phase \}\}/u,
  );
  assert.match(
    workflow,
    /qualified_source_set_sha256: \$\{\{ steps\.release-state\.outputs\.qualified_source_set_sha256 \}\}/u,
  );
  assert.match(
    workflow,
    /release_phase == 'held' &&[\s\S]*?needs\.deploy_held\.result == 'success'[\s\S]*?github\.event_name == 'push' &&[\s\S]*?contains\(github\.event\.head_commit\.message, '\[deploy-text-to-lattice-services\]'\)[\s\S]*?github\.event_name == 'workflow_dispatch' &&[\s\S]*?inputs\.deploy_text_to_lattice_services == true[\s\S]*?release_phase == 'qualification-pending' &&[\s\S]*?github\.event_name == 'workflow_dispatch' &&[\s\S]*?inputs\.activate_text_to_lattice_qualification == true[\s\S]*?release_phase == 'qualified'/u,
  );
  assert.equal(
    [...workflow.matchAll(/github\.event_name == 'push'/gu)].length,
    1,
  );
  assert.match(workflow, /workers\/text-to-lattice-api\/wrangler\.jsonc/u);
  assert.match(
    workflow,
    /verify-text-to-lattice-secret-bindings\.mjs[\s\S]*?secret-bindings\.json/u,
  );
  assert.doesNotMatch(workflow, /--require-official-test-profile|--allow-official-test-keys/u);
  assert.doesNotMatch(workflow, /Deploy isolated verification frame|Deploy lease Worker|bootstrap-text-to-lattice-secrets|verify-text-to-lattice-services/u);
  assert.match(workflow, /\n  deploy_held:\n[\s\S]*?Deploy held Pages[\s\S]*?verify-text-to-lattice-held-pages\.mjs/u);
  assert.match(workflow, /\n  deploy:\n[\s\S]*?release_phase == 'qualified'[\s\S]*?activate_text_to_lattice_qualification == true/u);
  assert.match(workflow, /\n  enforce_text_to_lattice_held_api:\n[\s\S]*?Deploy held Text to Lattice API disposition/u);
  assert.match(
    workflow,
    /needs: \[publication-boundary, build, build_qualification_rollback, deploy_text_to_lattice_services\]/u,
  );
  assert.doesNotMatch(workflow, /^concurrency:/mu);
  assert.match(
    workflow,
    /deploy_text_to_lattice_services:[\s\S]*?concurrency:\s*\n\s*group: text-to-lattice-services\s*\n\s*cancel-in-progress: false/u,
  );
  assert.match(
    workflow,
    /deploy_held:[\s\S]*?concurrency:\s*\n\s*group: pages\s*\n\s*cancel-in-progress: false/u,
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

test("the service graph proves held publication, qualifies reversibly, and restores held on every failure boundary", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const heldPagesDeploy = workflow.indexOf("Deploy held Pages");
  const heldPagesVerify = workflow.indexOf("Verify the live public Pages artifact is held");
  const heldPreflight = workflow.indexOf("Verify live Pages is held before preactivation service mutation");
  const heldBootstrap = workflow.indexOf("Bootstrap held Text to Lattice API surface");
  const bindingInspect = workflow.indexOf("Inspect Text to Lattice API encrypted binding names before bootstrap");
  const secretBootstrap = workflow.indexOf("Preserve provider credential and bootstrap only a missing visitor-cookie secret");
  const bindingFinal = workflow.indexOf("Inspect final Text to Lattice API encrypted binding names");
  const bindingRequire = workflow.indexOf("Require the exact provider and visitor-cookie encrypted bindings");
  const apiDeploy = workflow.indexOf("Deploy bounded Text to Lattice API");
  const policyDeploy = workflow.indexOf("Deploy résumé response policy");
  const deploymentInspect = workflow.indexOf("Inspect deployed Worker versions");
  const preactivationRoutes = workflow.indexOf("Verify reversible preactivation route ownership");
  const activeVersionRead = workflow.indexOf("read-text-to-lattice-active-version.mjs");
  const activeVersionInspect = workflow.indexOf("wrangler versions view");
  const liveProbe = workflow.indexOf("Verify deployed Text to Lattice API boundary");
  const retirement = workflow.indexOf("Retire exact legacy entry surfaces only after qualification");
  const finalRoutes = workflow.indexOf("Verify exact active and retired Text to Lattice routes");
  const evidenceAssembly = workflow.indexOf("Assemble sanitized Text to Lattice deployment evidence");
  const postServiceGuard = workflow.indexOf("Require current main after service verification");
  const successfulRestoration = workflow.indexOf("Return successfully qualified held API to held mode");
  const rollback = workflow.indexOf("Roll back Text to Lattice API to held mode");
  const artifactUpload = workflow.indexOf("Retain sanitized Text to Lattice deployment evidence");
  const pagesDeploy = workflow.indexOf("Deploy interactive Pages");
  const heldEnforcementStart = workflow.indexOf("\n  enforce_text_to_lattice_held_api:\n");
  const heldEnforcement = workflow.slice(heldEnforcementStart);
  const apiDeployStep = workflow.slice(apiDeploy, policyDeploy);
  const policyDeployStep = workflow.slice(policyDeploy, deploymentInspect);
  const retirementStep = workflow.slice(retirement, finalRoutes);
  assert.ok(heldPagesDeploy > 0 && heldPagesDeploy < heldPagesVerify);
  assert.ok(heldPagesVerify < heldPreflight && heldPreflight < heldBootstrap);
  assert.ok(heldBootstrap < bindingInspect);
  assert.ok(bindingInspect < secretBootstrap);
  assert.ok(secretBootstrap < bindingFinal && bindingFinal < bindingRequire);
  assert.ok(bindingRequire < apiDeploy);
  assert.ok(apiDeploy < policyDeploy);
  assert.ok(policyDeploy < deploymentInspect);
  assert.ok(deploymentInspect < activeVersionRead);
  assert.ok(activeVersionRead < activeVersionInspect);
  assert.ok(activeVersionInspect < preactivationRoutes);
  assert.ok(preactivationRoutes < liveProbe);
  assert.ok(policyDeploy < liveProbe);
  assert.ok(liveProbe < retirement, "legacy surfaces stay intact through reversible live verification");
  assert.ok(retirement < finalRoutes && finalRoutes < evidenceAssembly);
  assert.ok(evidenceAssembly < postServiceGuard);
  assert.ok(postServiceGuard < successfulRestoration && successfulRestoration < rollback);
  assert.ok(rollback < artifactUpload);
  assert.ok(policyDeploy < pagesDeploy);
  assert.match(workflow, /needs\.deploy_held\.result == 'success'/u);
  assert.match(
    workflow,
    /needs: \[publication-boundary, build, build_qualification_rollback, deploy_held\]/u,
  );
  assert.match(workflow, /verify-text-to-lattice-held-pages\.mjs/u);
  assert.match(workflow, /bootstrap-text-to-lattice-api-secrets\.mjs/u);
  assert.match(workflow, /node scripts\/verify-text-to-lattice-api-production\.mjs/u);
  assert.match(
    apiDeployStep,
    /if \[\[ "\$RELEASE_PHASE" != "qualified" \]\]; then[\s\S]*?--var "LATTICE_QUALIFICATION_EXPIRES_AT:\$QUALIFICATION_EXPIRES_AT"[\s\S]*?else[\s\S]*?wrangler deploy \\\n\s+--config workers\/text-to-lattice-api\/wrangler\.jsonc/u,
  );
  assert.equal(
    (apiDeployStep.match(/LATTICE_QUALIFICATION_EXPIRES_AT:/gu) ?? []).length,
    1,
    "qualified deployment must omit the expiring qualification binding",
  );
  assert.match(
    policyDeployStep,
    /if: \$\{\{ needs\.publication-boundary\.outputs\.release_phase != 'qualified' \}\}[\s\S]*?wrangler deploy/u,
  );
  assert.match(
    retirementStep,
    /if: \$\{\{ needs\.publication-boundary\.outputs\.release_phase == 'qualified' \}\}[\s\S]*?retire-text-to-lattice-legacy-surfaces\.mjs[\s\S]*?--apply[\s\S]*?retirement\.json/u,
  );
  assert.equal(workflow.match(/--apply/gu)?.length, 1);
  assert.match(workflow, /wrangler versions view "\$API_VERSION_ID" --json/u);
  assert.match(workflow, /--api-version[\s\S]*?text-to-lattice-api-version\.raw\.json/u);
  assert.match(workflow, /node scripts\/build-text-to-lattice-deployment-evidence\.mjs/u);
  assert.match(workflow, /pages_artifact_id: \$\{\{ steps\.pages-artifact\.outputs\.artifact_id \}\}/u);
  assert.match(workflow, /site_artifact_sha256: \$\{\{ steps\.site-artifact\.outputs\.sha256 \}\}/u);
  assert.match(
    workflow,
    /qualified_source_set_sha256: \$\{\{ steps\.verified-source-state\.outputs\.qualified_source_set_sha256 \}\}/u,
  );
  assert.match(workflow, /hash-regular-file-sha256\.mjs[\s\S]*?"\$RUNNER_TEMP\/artifact\.tar"[\s\S]*?--github-output/u);
  assert.match(workflow, /actions: read[\s\S]*?resolve-github-actions-job-id\.mjs[\s\S]*?--job-name[\s\S]*?"Qualify or verify Text to Lattice services"/u);
  assert.match(workflow, /--service-job-id[\s\S]*?"\$\{\{ steps\.service-job\.outputs\.service_job_id \}\}"/u);
  assert.match(workflow, /--pages-artifact-id[\s\S]*?"\$\{\{ needs\.build\.outputs\.pages_artifact_id \}\}"/u);
  assert.match(workflow, /--site-artifact-sha256[\s\S]*?"\$\{\{ needs\.build\.outputs\.site_artifact_sha256 \}\}"/u);
  assert.match(workflow, /--qualified-source-set-sha256[\s\S]*?"\$\{\{ needs\.build\.outputs\.qualified_source_set_sha256 \}\}"/u);
  assert.match(workflow, /workers\/text-to-lattice-api\/held\.js/u);
  assert.match(workflow, /node scripts\/verify-text-to-lattice-held-api\.mjs/u);
  assert.match(
    workflow,
    /Return successfully qualified held API to held mode[\s\S]*?if: \$\{\{ success\(\) && needs\.publication-boundary\.outputs\.release_phase == 'held' \}\}[\s\S]*?workers\/text-to-lattice-api\/held\.js/u,
  );
  assert.match(
    workflow,
    /Require current main before failure rollback[\s\S]*?id: current-main-before-failure-rollback[\s\S]*?if: \$\{\{ failure\(\) \|\| cancelled\(\) \}\}[\s\S]*?run: node scripts\/verify-current-main-sha\.mjs[\s\S]*?Roll back Text to Lattice API to held mode[\s\S]*?\(failure\(\) \|\| cancelled\(\)\) &&[\s\S]*?steps\.current-main-before-failure-rollback\.outcome == 'success'/u,
  );
  assert.match(
    workflow,
    /if: \$\{\{ \(failure\(\) \|\| cancelled\(\)\) && steps\.held-api-rollback\.outcome == 'success' \}\}/u,
  );
  assert.doesNotMatch(workflow, /steps\.deploy-lattice-api\.outputs\.attempted == 'true'/u);
  assert.match(workflow, /enforce_text_to_lattice_held_api:[\s\S]*?needs\.deploy\.result != 'success'[\s\S]*?Require current main immediately before held API enforcement[\s\S]*?Deploy held Text to Lattice API disposition/u);
  assert.match(
    heldEnforcement,
    /Verify live held Pages before routine API enforcement[\s\S]*?continue-on-error: true[\s\S]*?needs\.deploy_held\.result == 'success'[\s\S]*?release_phase == 'qualification-pending' &&[\s\S]*?needs\.deploy_text_to_lattice_services\.result == 'skipped'[\s\S]*?verify-text-to-lattice-held-pages\.mjs/u,
  );
  assert.match(
    heldEnforcement,
    /sole Cloudflare mutation below is the emergency fail-closed API shutdown/u,
  );
  assert.equal((heldEnforcement.match(/wrangler deploy(?:\s|$)/gmu) ?? []).length, 1,
    "publication failure cleanup may only shut down the API");
  assert.match(heldEnforcement, /wrangler deploy[\s\S]*?workers\/text-to-lattice-api\/held\.js/u);
  assert.doesNotMatch(heldEnforcement, /secret bulk|retire-text-to-lattice-legacy-surfaces\.mjs|--apply/u);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}[\s\S]*?actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/u);
  assert.doesNotMatch(workflow, /text-to-lattice-attestation-frame\/wrangler\.jsonc|text-to-lattice-lease\/wrangler\.jsonc/u);
});

test("deployment evidence receives one source identity recomputed after full release verification", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const publicationStart = workflow.indexOf("\n  publication-boundary:\n");
  const buildStart = workflow.indexOf("\n  build:\n", publicationStart);
  const serviceStart = workflow.indexOf("\n  deploy_text_to_lattice_services:\n", buildStart);
  const deployStart = workflow.indexOf("\n  deploy:\n", serviceStart);
  const publication = workflow.slice(publicationStart, buildStart);
  const build = workflow.slice(buildStart, serviceStart);
  const service = workflow.slice(serviceStart, deployStart);

  assert.match(
    publication,
    /qualified_source_set_sha256: \$\{\{ steps\.release-state\.outputs\.qualified_source_set_sha256 \}\}[\s\S]*?id: release-state[\s\S]*?read-text-to-lattice-release-state\.mjs/u,
  );
  assert.match(
    build,
    /qualified_source_set_sha256: \$\{\{ steps\.verified-source-state\.outputs\.qualified_source_set_sha256 \}\}/u,
  );
  const fullReleaseVerification = build.indexOf("run: npm run release:lattice:verify:site");
  const verifiedSourceExport = build.indexOf("id: verified-source-state");
  const artifactUpload = build.indexOf("- name: Upload Pages artifact");
  assert.ok(
    fullReleaseVerification >= 0
      && verifiedSourceExport > fullReleaseVerification
      && artifactUpload > verifiedSourceExport,
    "the build may export its digest only after full source/site verification and before artifact upload",
  );
  assert.match(
    service,
    /Require one fully verified candidate source identity[\s\S]*?BUILD_SOURCE_SHA256: \$\{\{ needs\.build\.outputs\.qualified_source_set_sha256 \}\}[\s\S]*?PUBLICATION_SOURCE_SHA256: \$\{\{ needs\.publication-boundary\.outputs\.qualified_source_set_sha256 \}\}[\s\S]*?BUILD_SOURCE_SHA256 !== process\.env\.PUBLICATION_SOURCE_SHA256/u,
  );
  assert.ok(
    service.indexOf("Require one fully verified candidate source identity")
      < service.indexOf("Install pinned Worker deployment tooling"),
    "source-identity disagreement must stop before any deployment tooling or Cloudflare mutation",
  );
  assert.match(
    service,
    /--qualified-source-set-sha256 "\$\{\{ needs\.build\.outputs\.qualified_source_set_sha256 \}\}"/u,
  );
});

test("qualification activation is evidence-bound and cleans up API before held Pages", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const rollbackStart = workflow.indexOf("\n  build_qualification_rollback:\n");
  const serviceStart = workflow.indexOf("\n  deploy_text_to_lattice_services:\n");
  const activePagesStart = workflow.indexOf("\n  deploy:\n", serviceStart);
  const waitStart = workflow.indexOf("\n  wait_for_text_to_lattice_qualification_expiry:\n", activePagesStart);
  const apiCleanupStart = workflow.indexOf("\n  expire_text_to_lattice_qualification_api:\n", waitStart);
  const pagesCleanupStart = workflow.indexOf("\n  expire_text_to_lattice_qualification_pages:\n", apiCleanupStart);
  const enforcementStart = workflow.indexOf("\n  enforce_text_to_lattice_held_api:\n", pagesCleanupStart);
  assert.ok(
    rollbackStart > 0 && serviceStart > rollbackStart && activePagesStart > serviceStart
      && waitStart > activePagesStart && apiCleanupStart > waitStart
      && pagesCleanupStart > apiCleanupStart && enforcementStart > pagesCleanupStart,
  );

  const rollback = workflow.slice(rollbackStart, serviceStart);
  const service = workflow.slice(serviceStart, activePagesStart);
  const activePages = workflow.slice(activePagesStart, waitStart);
  const waitJob = workflow.slice(waitStart, apiCleanupStart);
  const apiCleanup = workflow.slice(apiCleanupStart, pagesCleanupStart);
  const pagesCleanup = workflow.slice(pagesCleanupStart, enforcementStart);
  const enforcement = workflow.slice(enforcementStart);

  assert.match(rollback, /github\.event_name == 'workflow_dispatch'[\s\S]*?inputs\.activate_text_to_lattice_qualification == true/u);
  assert.match(rollback, /fetch-depth: 2[\s\S]*?git worktree add --detach[\s\S]*?"\$GITHUB_SHA\^"/u);
  assert.match(rollback, /ROLLBACK_RELEASE_PHASE !== "held"[\s\S]*?ROLLBACK_PUBLIC_CLIENT_STATUS !== "held"/u);
  assert.match(rollback, /working-directory: \$\{\{ runner\.temp \}\}\/text-to-lattice-held-rollback-source[\s\S]*?npm run build:pages/u);
  assert.match(rollback, /Require current main before held rollback artifact upload[\s\S]*?Upload verified held Pages rollback artifact/u);
  assert.match(rollback, /name: text-to-lattice-held-rollback-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/u);

  assert.match(service, /release_phase == 'qualification-pending'[\s\S]*?needs\.build_qualification_rollback\.result == 'success'[\s\S]*?outputs\.held_pages_artifact_id != ''[\s\S]*?outputs\.held_pages_artifact_sha256 != ''[\s\S]*?inputs\.activate_text_to_lattice_qualification == true/u);
  assert.match(service, /Establish the absolute bounded active-service expiry[\s\S]*?release_phase != 'qualified'[\s\S]*?Require current main before active API deployment[\s\S]*?Deploy bounded Text to Lattice API/u);
  assert.match(service, /if \[\[ "\$RELEASE_PHASE" != "qualified" \]\]; then[\s\S]*?--var "LATTICE_QUALIFICATION_EXPIRES_AT:\$QUALIFICATION_EXPIRES_AT"/u);
  assert.match(service, /if \[\[ "\$RELEASE_PHASE" != "qualified" \]\]; then[\s\S]*?--qualification-expires-at "\$QUALIFICATION_EXPIRES_AT"/u);
  assert.match(service, /Retire exact legacy entry surfaces only after qualification[\s\S]*?release_phase == 'qualified'/u);
  assert.match(activePages, /needs\.build_qualification_rollback\.result == 'success'[\s\S]*?outputs\.held_pages_artifact_id != ''[\s\S]*?outputs\.held_pages_artifact_sha256 != ''[\s\S]*?inputs\.activate_text_to_lattice_qualification == true/u);

  assert.doesNotMatch(waitJob, /^\s*environment:|^\s*concurrency:/mu);
  assert.match(waitJob, /plan-text-to-lattice-qualification-window\.mjs[\s\S]*?--wait-until[\s\S]*?qualification_cleanup_at/u);
  assert.match(apiCleanup, /needs\.wait_for_text_to_lattice_qualification_expiry\.result == 'success'/u);
  assert.match(apiCleanup, /Require current main before bounded qualification API shutdown[\s\S]*?Deploy held API at the bounded qualification cleanup point[\s\S]*?workers\/text-to-lattice-api\/held\.js[\s\S]*?verify-text-to-lattice-held-api\.mjs/u);
  assert.doesNotMatch(apiCleanup, /actions\/deploy-pages@|retire-text-to-lattice-legacy-surfaces\.mjs|--apply/u);
  assert.match(pagesCleanup, /outputs\.held_pages_artifact_id != ''[\s\S]*?outputs\.held_pages_artifact_sha256 != ''[\s\S]*?needs\.expire_text_to_lattice_qualification_api\.outputs\.held_api_verified == 'true'/u);
  assert.match(pagesCleanup, /Require current main before bounded qualification Pages rollback[\s\S]*?actions\/deploy-pages@[\s\S]*?artifact_name: text-to-lattice-held-rollback-[\s\S]*?verify-text-to-lattice-held-pages\.mjs/u);
  assert.doesNotMatch(pagesCleanup, /wrangler deploy|retire-text-to-lattice-legacy-surfaces\.mjs|--apply/u);
  assert.match(enforcement, /needs\.publication-boundary\.result != 'success'/u);
  assert.match(enforcement, /needs\.deploy\.result != 'success'/u);
});

test("the qualification window is absolute, bounded, and schedules cleanup with safety lead", async () => {
  const origin = new Date("2026-09-14T17:00:00.000Z");
  const plan = planTextToLatticeQualificationWindow({ now: () => origin });
  assert.deepEqual(plan, {
    qualificationPlannedAt: "2026-09-14T17:00:00.000Z",
    qualificationExpiresAt: "2026-09-14T17:30:00.000Z",
    qualificationCleanupAt: "2026-09-14T17:24:00.000Z",
  });
  assert.equal(
    new Date(plan.qualificationExpiresAt).valueOf() - origin.valueOf(),
    TEXT_TO_LATTICE_QUALIFICATION_WINDOW_MS,
  );
  assert.equal(
    new Date(plan.qualificationExpiresAt).valueOf()
      - new Date(plan.qualificationCleanupAt).valueOf(),
    TEXT_TO_LATTICE_QUALIFICATION_CLEANUP_LEAD_MS,
  );

  const waits = [];
  assert.equal(await waitForTextToLatticeQualificationCleanup(
    plan.qualificationCleanupAt,
    {
      now: () => new Date("2026-09-14T17:20:00.000Z"),
      wait: async (milliseconds) => { waits.push(milliseconds); },
    },
  ), 4 * 60 * 1000);
  assert.deepEqual(waits, [4 * 60 * 1000]);
  await assert.rejects(
    waitForTextToLatticeQualificationCleanup("2026-09-14T18:00:00.000Z", {
      now: () => origin,
      wait: async () => {},
    }),
    /exceeds the bounded qualification window/u,
  );
});

test("pull requests run the full validation boundary without production credentials or deployment", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /pull_request:\s*\n\s*branches: \[main\]/u);
  const start = workflow.indexOf("  pull-request-validation:");
  const end = workflow.indexOf("\n  publication-boundary:", start);
  assert.ok(start > 0 && end > start);
  const validation = workflow.slice(start, end);
  for (const command of [
    "npm ci --ignore-scripts",
    "tests/lattice-network-capability.test.mjs",
    "tests/lattice-network-governance.test.mjs",
    "tests/lattice-api-worker.test.mjs",
    "tests/lattice-production-api-verifier.test.mjs",
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "npm run release:lattice:verify:site",
  ]) assert.ok(validation.includes(command), command);
  assert.doesNotMatch(validation, /CLOUDFLARE|secrets\.|environment:|wrangler deploy|deploy-pages|upload-pages-artifact/u);
  assert.match(validation, /permissions:\s*\n\s*contents: read/u);
});

test("live held-Pages preflight proves the public held module and excludes the interactive surface", async () => {
  const requests = [];
  const evidence = await verifyTextToLatticeHeldPages({
    attempts: 1,
    now: () => new Date("2026-09-14T16:30:00.000Z"),
    async fetchImpl(url, init) {
      requests.push({ url, init });
      return new Response([
        "<!doctype html><html><head>",
        '<link rel="modulepreload" href="/_next/static/chunks/ResumeProjectsHeld-Abc_123.js">',
        "</head><body>",
        "Text to Lattice remains held while deployment and end-to-end privacy evidence for the remote-provider candidate are incomplete.",
        "</body></html>",
      ].join(""), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://hah.dev/resume/");
  assert.equal(requests[0].init.credentials, "omit");
  assert.equal(requests[0].init.redirect, "error");
  assert.deepEqual(evidence, {
    format: "TEXT_TO_LATTICE_HELD_PAGES_EVIDENCE",
    schemaVersion: 1,
    verifiedAt: "2026-09-14T16:30:00.000Z",
    url: "https://hah.dev/resume/",
    httpStatus: 200,
    responseBytes: evidence.responseBytes,
    attemptCount: 1,
    heldCopyPresent: true,
    heldModulePresent: true,
    interactiveSurfaceAbsent: true,
    responseBodyRetained: false,
  });
  assert.ok(evidence.responseBytes > 0);
});

test("live held-Pages preflight settles propagation but never accepts an interactive module", async () => {
  let attempts = 0;
  let waits = 0;
  const heldDocument = [
    '<link rel="modulepreload" href="/_next/static/chunks/ResumeProjectsHeld-final.js">',
    "Text to Lattice remains held while deployment and end-to-end privacy evidence for the remote-provider candidate are incomplete.",
  ].join("");
  const evidence = await verifyTextToLatticeHeldPages({
    attempts: 2,
    intervalMs: 0,
    wait: async () => { waits += 1; },
    async fetchImpl() {
      attempts += 1;
      return new Response(attempts === 1
        ? '<link rel="modulepreload" href="/_next/static/chunks/ResumeProjects-active.js"><button aria-label="Use Text to Lattice">Use</button>'
        : heldDocument, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  });
  assert.equal(evidence.attemptCount, 2);
  assert.equal(waits, 1);

  await assert.rejects(verifyTextToLatticeHeldPages({
    attempts: 1,
    async fetchImpl() {
      return new Response(`${heldDocument}<div id="lattice-demo-dialog"></div>`, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  }), /interactive Text to Lattice surface remains/u);
});

test("live held-Pages preflight bounds an undeclared streaming response", async () => {
  const chunk = new Uint8Array(1024 * 1024 + 1);
  await assert.rejects(verifyTextToLatticeHeldPages({
    attempts: 1,
    async fetchImpl() {
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(chunk);
          controller.enqueue(chunk);
          controller.close();
        },
      }), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  }), /résumé document exceeded its response-size boundary/u);
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
  assert.equal(protectedResponse.headers.get("Cache-Control"), "no-transform");
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

test("API secret bootstrap preserves the provider credential and generates only a missing visitor secret", () => {
  let randomCalls = 0;
  const randomBytesImpl = (length) => {
    randomCalls += 1;
    assert.equal(length, 48);
    return new Uint8Array(48).fill(7);
  };
  assert.throws(
    () => textToLatticeApiSecretBootstrapPlan([], { randomBytesImpl }),
    /HF_TOKEN must be provisioned/u,
  );
  assert.equal(randomCalls, 0, "missing provider authority must fail before generating another secret");

  const plan = textToLatticeApiSecretBootstrapPlan([
    { name: "HF_TOKEN", type: "secret_text" },
  ], { randomBytesImpl });
  assert.equal(randomCalls, 1);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].name, "VISITOR_COOKIE_SECRET");
  assert.equal(plan[0].source, "generated-private");
  assert.ok(plan[0].value.length >= 64);
  assert.deepEqual(textToLatticeApiSecretBootstrapPlan([
    { name: "HF_TOKEN", type: "secret_text" },
    { name: "VISITOR_COOKIE_SECRET", type: "secret_text" },
  ], { randomBytesImpl }), []);
  assert.equal(randomCalls, 1, "complete bindings must remain byte-opaque and unchanged");
  assert.throws(
    () => textToLatticeApiSecretBootstrapPlan([
      { name: "HF_TOKEN", type: "secret_text" },
      { name: "UNREVIEWED_SECRET", type: "secret_text" },
    ], { randomBytesImpl }),
    /Unexpected encrypted binding/u,
  );
  assert.throws(
    () => textToLatticeApiSecretBootstrapPlan([
      { name: "HF_TOKEN", type: "plain_text" },
    ], { randomBytesImpl }),
    /malformed encrypted-binding inventory/u,
  );
});

test("API secret bootstrap installs one generated visitor secret without exposing or replacing HF_TOKEN", () => {
  const calls = [];
  installTextToLatticeApiSecretPlan([{
    name: "VISITOR_COOKIE_SECRET",
    source: "generated-private",
    value: "v".repeat(64),
  }], {
    wranglerPath: "/pinned/wrangler",
    configPath: "workers/text-to-lattice-api/wrangler.jsonc",
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
    "put",
    "VISITOR_COOKIE_SECRET",
    "--config",
    "workers/text-to-lattice-api/wrangler.jsonc",
  ]);
  assert.equal(options.input, `${"v".repeat(64)}\n`);
  assert.doesNotMatch(options.input, /HF_TOKEN/u);
  assert.doesNotMatch(argumentsList.join(" "), /HF_TOKEN|v{8}/u);
  let refusedCalls = 0;
  assert.throws(() => installTextToLatticeApiSecretPlan([{
    name: "HF_TOKEN",
    source: "generated-private",
    value: "x".repeat(64),
  }], {
    wranglerPath: "/pinned/wrangler",
    configPath: "workers/text-to-lattice-api/wrangler.jsonc",
    spawn: () => {
      refusedCalls += 1;
      return { status: 0 };
    },
  }), /only one generated visitor-cookie signing binding/u);
  assert.equal(refusedCalls, 0);
});

test("encrypted binding inspection accepts exactly the provider and visitor-cookie credentials", () => {
  const exact = [
    { name: "HF_TOKEN", type: "secret_text" },
    { name: "VISITOR_COOKIE_SECRET", type: "secret_text" },
  ];
  assert.deepEqual(
    verifyTextToLatticeSecretBindings(exact),
    {
      format: "TEXT_TO_LATTICE_SECRET_BINDING_EVIDENCE",
      schemaVersion: 1,
      worker: "hahdev-text-to-lattice-api",
      bindings: exact,
      valuesRead: false,
    },
  );
  assert.throws(
    () => verifyTextToLatticeSecretBindings([]),
    /exactly the HF_TOKEN and VISITOR_COOKIE_SECRET encrypted bindings/u,
  );
  assert.throws(
    () => verifyTextToLatticeSecretBindings([...exact, { name: "UNREVIEWED_SECRET", type: "secret_text" }]),
    /exactly the HF_TOKEN and VISITOR_COOKIE_SECRET encrypted bindings/u,
  );
  assert.throws(
    () => verifyTextToLatticeSecretBindings([{ name: "HF_TOKEN", type: "plain_text" }]),
    /exactly the HF_TOKEN and VISITOR_COOKIE_SECRET encrypted bindings/u,
  );
  assert.throws(
    () => verifyTextToLatticeSecretBindings([null]),
    /malformed secret-name inventory entry/u,
  );
});

test("protected route inspection records exact active and held-retirement inventories", async () => {
  const zoneId = "a".repeat(32);
  const accountId = "d".repeat(32);
  const requested = [];
  const evidence = await verifyTextToLatticeRouteInventory({
    accountId,
    apiToken: "protected-route-read-token",
    async fetchImpl(url, init) {
      requested.push({ url, init });
      if (url.includes("/zones?")) {
        return jsonResponse(200, {
          success: true,
          result: [{ id: zoneId, name: "hah.dev", status: "active" }],
        });
      }
      if (url.includes("/workers/domains")) {
        return jsonResponse(200, {
          success: true,
          result: [{
            hostname: "verify.hah.dev",
            service: "hahdev-text-to-lattice-attestation-frame",
            environment: "production",
          }],
        });
      }
      const result = Object.entries(TEXT_TO_LATTICE_ROUTE_INVENTORY).flatMap(
        ([script, patterns]) => patterns.map((pattern) => ({ pattern, script })),
      );
      result.push({
        pattern: RETIRED_TEXT_TO_LATTICE_SURFACES["hahdev-text-to-lattice-lease"].routes[0],
        script: "hahdev-text-to-lattice-lease",
      });
      result.push({ pattern: "hah.dev/unrelated-exclusion*" });
      return jsonResponse(200, {
        success: true,
        result,
      });
    },
  });
  assert.equal(requested.length, 3);
  assert.match(requested[0].url, /\/zones\?name=hah\.dev&status=active&per_page=50$/u);
  assert.ok(requested.some(({ url }) => url === `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`));
  assert.ok(requested.some(({ url }) => url === `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/domains`));
  assert.ok(requested.every(({ init }) => init.headers.Authorization === "Bearer protected-route-read-token"));
  assert.ok(requested.every(({ init }) => init.credentials === "omit" && init.redirect === "error"));
  assert.equal(evidence.releasePhase, "held");
  assert.deepEqual(evidence.active.map(({ script }) => script).sort(), Object.keys(TEXT_TO_LATTICE_ROUTE_INVENTORY).sort());
  assert.ok(evidence.retired.every(({ requiredDisposition }) => requiredDisposition === "remove-only-after-successful-qualification"));
  assert.ok(evidence.retired.every(({ status }) => status === "retirement-required"));
  assert.equal(evidence.unrelatedRouteCount, 1);
});

test("protected route inspection preserves legacy surfaces for qualification and requires retirement once qualified", async () => {
  const zoneId = "e".repeat(32);
  const fixture = async (url) => {
    if (url.includes("/zones?")) {
      return jsonResponse(200, {
        success: true,
        result: [{ id: zoneId, name: "hah.dev", status: "active" }],
      });
    }
    if (url.includes("/workers/domains")) {
      return jsonResponse(200, {
        success: true,
        result: [{
          hostname: "verify.hah.dev",
          service: "hahdev-text-to-lattice-attestation-frame",
        }],
      });
    }
    return jsonResponse(200, {
      success: true,
      result: [
        ...Object.entries(TEXT_TO_LATTICE_ROUTE_INVENTORY).flatMap(
          ([script, patterns]) => patterns.map((pattern) => ({ pattern, script })),
        ),
        {
          pattern: RETIRED_TEXT_TO_LATTICE_SURFACES["hahdev-text-to-lattice-lease"].routes[0],
          script: "hahdev-text-to-lattice-lease",
        },
      ],
    });
  };
  const pending = await verifyTextToLatticeRouteInventory({
    accountId: "f".repeat(32),
    apiToken: "protected-route-read-token",
    releasePhase: "qualification-pending",
    fetchImpl: fixture,
  });
  assert.ok(pending.retired.every(({ status }) => status === "retirement-required"));

  await assert.rejects(verifyTextToLatticeRouteInventory({
    accountId: "f".repeat(32),
    apiToken: "protected-route-read-token",
    releasePhase: "qualified",
    fetchImpl: fixture,
  }), /must be detached before qualified release/u);
});

test("protected route inspection rejects a retired target whose owner changed", async () => {
  const zoneId = "9".repeat(32);
  await assert.rejects(verifyTextToLatticeRouteInventory({
    accountId: "8".repeat(32),
    apiToken: "protected-route-read-token",
    async fetchImpl(url) {
      if (url.includes("/zones?")) {
        return jsonResponse(200, {
          success: true,
          result: [{ id: zoneId, name: "hah.dev", status: "active" }],
        });
      }
      if (url.includes("/workers/domains")) {
        return jsonResponse(200, {
          success: true,
          result: [{ hostname: "verify.hah.dev", service: "unreviewed-worker" }],
        });
      }
      return jsonResponse(200, {
        success: true,
        result: Object.entries(TEXT_TO_LATTICE_ROUTE_INVENTORY).flatMap(
          ([script, patterns]) => patterns.map((pattern) => ({ pattern, script })),
        ),
      });
    },
  }), /not owned by hahdev-text-to-lattice-attestation-frame/u);
});

test("protected route inspection rejects a stale portfolio-wide response-policy route", async () => {
  const zoneId = "b".repeat(32);
  await assert.rejects(
    verifyTextToLatticeRouteInventory({
      accountId: "1".repeat(32),
      apiToken: "protected-route-read-token",
      async fetchImpl(url) {
        if (url.includes("/zones?")) {
          return jsonResponse(200, {
            success: true,
            result: [{ id: zoneId, name: "hah.dev", status: "active" }],
          });
        }
        if (url.includes("/workers/domains")) {
          return jsonResponse(200, { success: true, result: [] });
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
    accountId: "2".repeat(32),
    apiToken: "protected-route-read-token",
    async fetchImpl(url) {
      if (url.includes("/zones?")) {
        return jsonResponse(200, {
          success: true,
          result: [{ id: zoneId, name: "hah.dev", status: "active" }],
        });
      }
      if (url.includes("/workers/domains")) {
        return jsonResponse(200, { success: true, result: [] });
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

test("live qualification uses browser-shaped requests and rejects edge analytics injection", async () => {
  const navigationHeaders = [];
  await verifyTextToLatticeServices({
    fetchImpl: fixtureFetch({
      observeRequest(url, init) {
        if (mainPageUrls.has(url) || url === "https://verify.hah.dev/turnstile/") {
          navigationHeaders.push(new Headers(init.headers));
        }
      },
    }),
    retryDelay: async () => {},
  });
  assert.ok(navigationHeaders.length >= mainPageUrls.size + 1);
  assert.ok(navigationHeaders.every((headers) => headers.get("User-Agent")?.includes("Safari")));
  assert.ok(navigationHeaders.every((headers) => headers.get("Accept")?.includes("text/html")));
  assert.equal(navigationHeaders.filter((headers) => headers.get("Sec-Fetch-Dest") === "iframe").length, 1);
  assert.equal(navigationHeaders.find((headers) => headers.get("Sec-Fetch-Dest") === "iframe")?.get("Sec-Fetch-Site"), "same-site");

  const baseFetch = fixtureFetch();
  await assert.rejects(verifyTextToLatticeServices({
    async fetchImpl(input, init) {
      const response = await baseFetch(input, init);
      if (`${input}` !== "https://hah.dev/resume/") return response;
      return new Response(`${await response.text()}<script data-cf-beacon src="https://static.cloudflareinsights.com/beacon.min.js"></script>`, {
        status: response.status,
        headers: response.headers,
      });
    },
    retryDelay: async () => {},
  }), /injected analytics beacon/u);
});

test("live qualification rejects a credential profile that advertises another site key", async () => {
  const fetchImpl = fixtureFetch();
  await assert.rejects(
    verifyTextToLatticeServices({
      async fetchImpl(input, init) {
        const response = await fetchImpl(input, init);
        if (`${input}` !== "https://hah.dev/api/text-to-lattice/lease" || response.status !== 200) {
          return response;
        }
        const value = await response.json();
        if (value?.type !== "attestation-challenge") {
          return jsonResponse(200, value, Object.fromEntries(response.headers));
        }
        return jsonResponse(200, {
          ...value,
          attestationSiteKey: "0x4AAAA-production-profile",
        }, Object.fromEntries(response.headers));
      },
      retryDelay: async () => {},
    }),
    /does not expose the declared demonstration profile/u,
  );
});

test("live qualification rejects drift in the closed typed HTTP 200 challenge", async () => {
  const scenarios = [
    ["protocol", (value) => ({ ...value, protocol: "another-protocol" })],
    ["version", (value) => ({ ...value, version: 2 })],
    ["type", (value) => ({ ...value, type: "lease-grant" })],
    ["key set", (value) => ({ ...value, unexpected: true })],
  ];
  for (const [label, mutate] of scenarios) {
    const fetchImpl = fixtureFetch();
    await assert.rejects(
      verifyTextToLatticeServices({
        async fetchImpl(input, init) {
          const response = await fetchImpl(input, init);
          const headers = new Headers(init?.headers);
          if (
            `${input}` !== "https://hah.dev/api/text-to-lattice/lease"
            || response.status !== 200
            || headers.get("Accept") !== typedLeaseAccept
          ) return response;
          const value = await response.json();
          if (value?.type !== "attestation-challenge") {
            return jsonResponse(200, value, Object.fromEntries(response.headers));
          }
          return jsonResponse(200, mutate(value), Object.fromEntries(response.headers));
        },
        retryDelay: async () => {},
      }),
      /malformed or unsupported typed challenge/u,
      label,
    );
  }
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
          return jsonResponse(200, {
            ...typedChallenge,
            code: "attestation-required",
            attestationSiteKey: CLOUDFLARE_DEMONSTRATION_SITE_KEY,
          }, leaseHeaders);
        }
        return fetchImpl(input, init);
      },
      retryDelay: async () => {},
    }),
    /invalid-attestation probe returned HTTP 200; expected 403/u,
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
