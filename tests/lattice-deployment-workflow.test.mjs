import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { verifyTextToLatticeSecretBindings } from "../scripts/verify-text-to-lattice-secret-bindings.mjs";
import { verifyTextToLatticeServices } from "../scripts/verify-text-to-lattice-services.mjs";

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
        attestationSiteKey: "public_test_site_key",
      }, {
        ...leaseHeaders,
        "Set-Cookie": "__Secure-hah-lattice-visitor=v1.fixture.signature; Max-Age=86400; Path=/api/text-to-lattice; Secure; HttpOnly; SameSite=Strict",
      });
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
      attestationSiteKey: "public_test_site_key",
    }, leaseHeaders);
  };
}

test("the Pages graph deploys infrastructure manually while held and requires it when enabled", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /workflow_dispatch:[\s\S]*?deploy_text_to_lattice_services:[\s\S]*?type: boolean/u);
  assert.match(
    workflow,
    /needs\.publication-boundary\.outputs\.public_client_status == 'enabled' \|\|[\s\S]*?github\.event_name == 'workflow_dispatch' && inputs\.deploy_text_to_lattice_services == true/u,
  );
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
  const frameDeploy = workflow.indexOf("Deploy isolated verification frame");
  const frameProbe = workflow.indexOf("Verify deployed frame bytes and isolation headers");
  const leaseDeploy = workflow.indexOf("Deploy lease Worker");
  const bindingProbe = workflow.indexOf("Verify encrypted Worker binding names");
  const liveProbe = workflow.indexOf("Verify live Text to Lattice boundaries");
  const pagesDeploy = workflow.lastIndexOf("uses: actions/deploy-pages@");
  assert.ok(frameDeploy > 0);
  assert.ok(frameDeploy < frameProbe);
  assert.ok(frameProbe < leaseDeploy);
  assert.ok(leaseDeploy < bindingProbe);
  assert.ok(bindingProbe < liveProbe);
  assert.ok(liveProbe < pagesDeploy);
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

test("live qualification accepts the exact public route, cookie, and header contracts", async () => {
  let invalidAttestationRequest = null;
  const requestedMainPages = new Set();
  await verifyTextToLatticeServices({
    fetchImpl: fixtureFetch({
      observeRequest(url, init) {
        if (mainPageUrls.has(url)) requestedMainPages.add(url);
        const headers = new Headers(init.headers);
        if (headers.has("X-Lattice-Attestation")) {
          invalidAttestationRequest = { url, init, headers };
        }
      },
    }),
    retryDelay: async () => {},
  });
  assert.equal(invalidAttestationRequest?.url, "https://hah.dev/api/text-to-lattice/lease");
  assert.equal(invalidAttestationRequest?.init.method, "POST");
  assert.equal(invalidAttestationRequest?.init.body, undefined);
  assert.equal(invalidAttestationRequest?.headers.get("Origin"), "https://hah.dev");
  assert.match(invalidAttestationRequest?.headers.get("Cookie") ?? "", /^__Secure-hah-lattice-visitor=/u);
  assert.match(
    invalidAttestationRequest?.headers.get("X-Lattice-Attestation") ?? "",
    /^qualification-intentionally-invalid$/u,
  );
  assert.deepEqual(requestedMainPages, mainPageUrls);
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
            attestationSiteKey: "public_test_site_key",
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
