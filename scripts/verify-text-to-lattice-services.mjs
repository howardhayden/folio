import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  CLOUDFLARE_DEMONSTRATION_SITE_KEY,
  CLOUDFLARE_DEMONSTRATION_TOKEN,
} from "../workers/text-to-lattice-lease/demonstrationProfile.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mainOrigin = "https://hah.dev";
const frameOrigin = "https://verify.hah.dev";
const leaseUrl = `${mainOrigin}/api/text-to-lattice/lease`;
const sameOriginLeaseHeaders = Object.freeze({
  Origin: mainOrigin,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
});
const mainPages = Object.freeze([
  Object.freeze({ label: "hah.dev root résumé", url: `${mainOrigin}/` }),
  Object.freeze({ label: "hah.dev root index alias", url: `${mainOrigin}/index.html` }),
  Object.freeze({ label: "hah.dev résumé", url: `${mainOrigin}/resume/` }),
  Object.freeze({ label: "hah.dev résumé index alias", url: `${mainOrigin}/resume/index.html` }),
]);
const requiredMainResourceDirectives = Object.freeze([
  Object.freeze(["connect-src", Object.freeze([
    "'self'",
    "https://huggingface.co",
    "https://*.huggingface.co",
    "https://*.hf.co",
    "https://raw.githubusercontent.com",
  ])]),
  Object.freeze(["style-src", Object.freeze([
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
  ])]),
  Object.freeze(["font-src", Object.freeze([
    "'self'",
    "https://fonts.gstatic.com",
  ])]),
  Object.freeze(["img-src", Object.freeze(["'self'", "data:"])]),
  Object.freeze(["worker-src", Object.freeze(["'self'"])]),
  Object.freeze(["object-src", Object.freeze(["'none'"])]),
  Object.freeze(["base-uri", Object.freeze(["'self'"])]),
  Object.freeze(["form-action", Object.freeze(["'self'"])]),
]);
const transientDeploymentStatuses = new Set([404, 500, 502, 503, 522, 523, 524, 525, 526, 530]);
const frameFiles = [
  {
    label: "verification frame document",
    pathname: "/turnstile/",
    source: "workers/text-to-lattice-attestation-frame/public/turnstile/index.html",
    contentType: "text/html",
  },
  {
    label: "verification frame bridge",
    pathname: "/turnstile/bridge.js",
    source: "workers/text-to-lattice-attestation-frame/public/turnstile/bridge.js",
    contentType: "javascript",
  },
  {
    label: "verification frame stylesheet",
    pathname: "/turnstile/styles.css",
    source: "workers/text-to-lattice-attestation-frame/public/turnstile/styles.css",
    contentType: "text/css",
  },
];

function fail(message) {
  throw new Error(message);
}

function header(response, name, label) {
  const value = response.headers.get(name);
  if (!value) fail(`${label} omits ${name}.`);
  return value;
}

function directiveMap(policy) {
  const entries = policy
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((directive) => {
      const [name, ...values] = directive.split(/\s+/u);
      return [name.toLowerCase(), values];
    });
  const directives = new Map();
  for (const [name, values] of entries) {
    if (directives.has(name)) {
      fail(`Content-Security-Policy repeats the ${name} directive.`);
    }
    directives.set(name, values);
  }
  return directives;
}

function requireExactDirective(policy, name, expectedValues, label) {
  const values = directiveMap(policy).get(name);
  const actual = values ? [...values].sort() : [];
  const expected = [...expectedValues].sort();
  if (
    actual.length !== expected.length
    || actual.some((value, index) => value !== expected[index])
  ) {
    fail(`${label} does not match the release ${name} directive.`);
  }
}

function requireToken(value, required, headerName, label) {
  const tokens = value.toLowerCase().split(/\s*,\s*|\s+/u);
  if (!tokens.includes(required.toLowerCase())) {
    fail(`${label} has an incomplete ${headerName}.`);
  }
}

function verifyNoStore(response, label) {
  const value = header(response, "cache-control", label);
  requireToken(value, "no-store", "Cache-Control", label);
  requireToken(value, "max-age=0", "Cache-Control", label);
}

function requireDisabledPermission(value, feature, label) {
  const assignments = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => /^([a-z0-9-]+)\s*=/iu.exec(entry)?.[1].toLowerCase() === feature.toLowerCase());
  if (assignments.length !== 1 || !new RegExp(`^${feature}\\s*=\\s*\\(\\)$`, "iu").test(assignments[0])) {
    fail(`${label} does not disable ${feature} exactly once.`);
  }
}

function verifyDisabledPermissions(response, features, label) {
  const value = header(response, "permissions-policy", label);
  for (const feature of features) {
    requireDisabledPermission(value, feature, label);
  }
}

function verifyFrameHeaders(response, label) {
  verifyNoStore(response, label);
  const policy = header(response, "content-security-policy", label);
  const expectedDirectives = new Map([
    ["default-src", ["'none'"]],
    ["script-src", ["'self'", "https://challenges.cloudflare.com"]],
    ["frame-src", ["https://challenges.cloudflare.com"]],
    ["connect-src", ["https://challenges.cloudflare.com"]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["data:", "https://challenges.cloudflare.com"]],
    ["frame-ancestors", [mainOrigin]],
    ["base-uri", ["'none'"]],
    ["form-action", ["'none'"]],
    ["object-src", ["'none'"]],
  ]);
  if (directiveMap(policy).size !== expectedDirectives.size) {
    fail(`${label} has an unexpected Content-Security-Policy boundary.`);
  }
  for (const [name, values] of expectedDirectives) {
    requireExactDirective(policy, name, values, label);
  }
  requireToken(
    header(response, "cross-origin-resource-policy", label),
    "same-site",
    "Cross-Origin-Resource-Policy",
    label,
  );
  requireToken(
    header(response, "x-content-type-options", label),
    "nosniff",
    "X-Content-Type-Options",
    label,
  );
  requireToken(
    header(response, "referrer-policy", label),
    "no-referrer",
    "Referrer-Policy",
    label,
  );
  requireToken(
    header(response, "origin-agent-cluster", label),
    "?1",
    "Origin-Agent-Cluster",
    label,
  );
  verifyDisabledPermissions(response, [
    "camera",
    "document-domain",
    "geolocation",
    "microphone",
    "payment",
    "usb",
  ], label);
  const robots = header(response, "x-robots-tag", label);
  for (const token of ["noindex", "nofollow", "nosnippet"]) {
    requireToken(robots, token, "X-Robots-Tag", label);
  }
}

function verifyLeaseHeaders(response, label) {
  verifyNoStore(response, label);
  const policy = header(response, "content-security-policy", label);
  if (directiveMap(policy).size !== 2) {
    fail(`${label} has an unexpected Content-Security-Policy boundary.`);
  }
  requireExactDirective(policy, "default-src", ["'none'"], label);
  requireExactDirective(policy, "frame-ancestors", ["'none'"], label);
  requireToken(
    header(response, "cross-origin-resource-policy", label),
    "same-origin",
    "Cross-Origin-Resource-Policy",
    label,
  );
  requireToken(
    header(response, "x-content-type-options", label),
    "nosniff",
    "X-Content-Type-Options",
    label,
  );
  requireToken(
    header(response, "referrer-policy", label),
    "no-referrer",
    "Referrer-Policy",
    label,
  );
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function request(fetchImpl, url, init, label, {
  attempts = 4,
  timeoutMilliseconds = 7_000,
} = {}) {
  const deadline = Date.now() + 45_000;
  let lastStatus = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response = null;
    try {
      response = await fetchImpl(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(Math.min(
          timeoutMilliseconds,
          Math.max(1, deadline - Date.now()),
        )),
      });
    } catch {
      // A just-bound custom domain can fail DNS or TLS while it propagates.
    }
    if (response && !transientDeploymentStatuses.has(response.status)) return response;
    lastStatus = response?.status ?? null;
    if (response?.body) await response.body.cancel().catch(() => {});
    if (attempt === attempts || Date.now() >= deadline) break;
    await delay(Math.min(attempt * 1_500, Math.max(0, deadline - Date.now())));
  }
  const status = lastStatus === null ? "a network error" : `HTTP ${lastStatus}`;
  fail(`${label} did not settle after deployment; the final result was ${status}.`);
}

async function verifyFrameFile(fetchImpl, file, retryDelay, deadline) {
  const source = await readFile(resolve(root, file.source));
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    let response = null;
    try {
      response = await fetchImpl(`${frameOrigin}${file.pathname}`, {
        redirect: "error",
        signal: AbortSignal.timeout(Math.min(7_000, Math.max(1, deadline - Date.now()))),
      });
      requireStatus(response, 200, file.label);
      verifyFrameHeaders(response, file.label);
      const contentType = header(response, "content-type", file.label).toLowerCase();
      if (!contentType.includes(file.contentType)) {
        fail(`${file.label} has the wrong Content-Type.`);
      }
      const deployed = Buffer.from(await response.arrayBuffer());
      if (digest(deployed) !== digest(source)) {
        fail(`${file.label} bytes differ from the checked-out release.`);
      }
      return;
    } catch (error) {
      lastError = error;
      if (response?.body) await response.body.cancel().catch(() => {});
    }
    if (attempt === 4 || Date.now() >= deadline) break;
    await retryDelay(Math.min(attempt * 1_500, Math.max(0, deadline - Date.now())));
  }
  fail(`${file.label} did not settle after deployment: ${lastError?.message ?? "unknown failure"}`);
}

async function responseJson(response, label) {
  try {
    return await response.json();
  } catch {
    fail(`${label} did not return JSON.`);
  }
}

function requireStatus(response, expected, label) {
  if (response.status !== expected) {
    fail(`${label} returned HTTP ${response.status}; expected ${expected}.`);
  }
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function verifyFrame(fetchImpl, retryDelay) {
  for (const file of frameFiles) {
    await verifyFrameFile(fetchImpl, file, retryDelay, Date.now() + 45_000);
  }
  console.log("Verification frame bytes and isolation headers match the release.");
}

async function verifyMainPageResponse(fetchImpl, { label, url }) {
  const response = await request(fetchImpl, url, {}, label);
  requireStatus(response, 200, label);
  const policy = header(response, "content-security-policy", label);
  const directives = directiveMap(policy);
  requireExactDirective(policy, "default-src", ["'self'"], label);
  requireExactDirective(policy, "frame-src", [frameOrigin], label);
  requireExactDirective(policy, "script-src", [
    "'self'",
    "'unsafe-inline'",
    "'wasm-unsafe-eval'",
  ], label);
  if (directives.has("script-src-elem")) {
    fail(`${label} must not override the exact script-src boundary with script-src-elem.`);
  }
  if (directives.has("style-src-elem") || directives.has("style-src-attr")) {
    fail(`${label} must not override the exact style-src boundary.`);
  }
  for (const [name, values] of requiredMainResourceDirectives) {
    requireExactDirective(policy, name, values, label);
  }
  requireDisabledPermission(header(response, "permissions-policy", label), "document-domain", label);
  await response.arrayBuffer();
}

async function verifyMainPageHeaders(fetchImpl) {
  for (const page of mainPages) {
    await verifyMainPageResponse(fetchImpl, page);
  }
  console.log("All hah.dev résumé document aliases permit the dedicated verification frame and exact local runtime dependencies without loading Turnstile on the main page.");
}

async function verifyLease(fetchImpl) {
  const methodResponse = await request(fetchImpl, leaseUrl, {}, "lease route method probe");
  requireStatus(methodResponse, 405, "lease route method probe");
  verifyLeaseHeaders(methodResponse, "lease route method probe");
  const allowedMethods = header(methodResponse, "allow", "lease route method probe")
    .split(",")
    .map((method) => method.trim())
    .sort();
  if (allowedMethods.join(",") !== "DELETE,PATCH,POST") {
    fail("lease route exposes the wrong method boundary.");
  }
  await methodResponse.arrayBuffer();

  const crossOriginResponse = await request(fetchImpl, leaseUrl, {
    method: "POST",
    headers: {
      Origin: "https://qualification.invalid",
      "Sec-Fetch-Site": "cross-site",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
    },
  }, "lease cross-origin probe");
  requireStatus(crossOriginResponse, 403, "lease cross-origin probe");
  verifyLeaseHeaders(crossOriginResponse, "lease cross-origin probe");
  if (crossOriginResponse.headers.has("set-cookie")) {
    fail("lease cross-origin rejection set a browser identity cookie.");
  }
  const crossOriginResult = await responseJson(crossOriginResponse, "lease cross-origin probe");
  if (
    crossOriginResult?.allowed !== false
    || crossOriginResult?.code !== "same-origin-empty-request-required"
  ) {
    fail("lease cross-origin rejection returned the wrong public result.");
  }

  const firstPartyResponse = await request(fetchImpl, leaseUrl, {
    method: "POST",
    headers: sameOriginLeaseHeaders,
  }, "lease first-party challenge probe");
  requireStatus(firstPartyResponse, 428, "lease first-party challenge probe");
  verifyLeaseHeaders(firstPartyResponse, "lease first-party challenge probe");
  const firstPartyResult = await responseJson(firstPartyResponse, "lease first-party challenge probe");
  if (
    firstPartyResult?.allowed !== false
    || firstPartyResult?.code !== "visitor-cookie-required"
    || firstPartyResult?.attestationSiteKey !== CLOUDFLARE_DEMONSTRATION_SITE_KEY
  ) {
    fail("lease first-party challenge does not expose the declared demonstration profile.");
  }
  const setCookie = header(firstPartyResponse, "set-cookie", "lease first-party challenge probe");
  const cookiePair = setCookie.split(";", 1)[0];
  if (
    !cookiePair.startsWith("__Secure-hah-lattice-visitor=")
    || !/;\s*Max-Age=86400\b/iu.test(setCookie)
    || !/;\s*Path=\/api\/text-to-lattice\b/iu.test(setCookie)
    || !/;\s*Secure\b/iu.test(setCookie)
    || !/;\s*HttpOnly\b/iu.test(setCookie)
    || !/;\s*SameSite=Strict\b/iu.test(setCookie)
  ) {
    fail("lease browser identity cookie has the wrong scope or protections.");
  }

  const returningResponse = await request(fetchImpl, leaseUrl, {
    method: "POST",
    headers: {
      ...sameOriginLeaseHeaders,
      Cookie: cookiePair,
    },
  }, "lease returning-browser challenge probe");
  requireStatus(returningResponse, 428, "lease returning-browser challenge probe");
  verifyLeaseHeaders(returningResponse, "lease returning-browser challenge probe");
  const returningResult = await responseJson(returningResponse, "lease returning-browser challenge probe");
  if (
    returningResult?.allowed !== false
    || returningResult?.code !== "attestation-required"
    || returningResult?.attestationSiteKey !== firstPartyResult.attestationSiteKey
  ) {
    fail("lease returning-browser challenge returned the wrong public result.");
  }

  const invalidAttestationResponse = await request(fetchImpl, leaseUrl, {
    method: "POST",
    headers: {
      ...sameOriginLeaseHeaders,
      Cookie: cookiePair,
      "X-Lattice-Attestation": "qualification-intentionally-invalid",
    },
  }, "lease invalid-attestation probe");
  requireStatus(invalidAttestationResponse, 403, "lease invalid-attestation probe");
  verifyLeaseHeaders(invalidAttestationResponse, "lease invalid-attestation probe");
  if (invalidAttestationResponse.headers.has("set-cookie")) {
    fail("lease invalid-attestation rejection refreshed the browser identity cookie.");
  }
  const invalidAttestationResult = await responseJson(
    invalidAttestationResponse,
    "lease invalid-attestation probe",
  );
  if (
    invalidAttestationResult?.allowed !== false
    || invalidAttestationResult?.code !== "attestation-rejected"
  ) {
    fail("lease invalid-attestation probe returned the wrong fail-closed result.");
  }

  const demonstrationAcquisitionResponse = await request(fetchImpl, leaseUrl, {
    method: "POST",
    headers: {
      ...sameOriginLeaseHeaders,
      Cookie: cookiePair,
      "X-Lattice-Attestation": CLOUDFLARE_DEMONSTRATION_TOKEN,
    },
  }, "lease demonstration-profile acquisition probe", {
    // Siteverify has its own bounded 8-second deadline. Give the Worker time
    // to return that decision, but do not replay this non-idempotent grant.
    attempts: 1,
    timeoutMilliseconds: 20_000,
  });
  requireStatus(
    demonstrationAcquisitionResponse,
    200,
    "lease demonstration-profile acquisition probe",
  );
  const demonstrationAcquisition = await responseJson(
    demonstrationAcquisitionResponse,
    "lease demonstration-profile acquisition probe",
  );
  const demonstrationLeaseToken = demonstrationAcquisition?.leaseToken;
  const validDemonstrationLeaseToken = typeof demonstrationLeaseToken === "string"
    && /^l1\.[A-Za-z0-9_-]{32}\.[0-9]+\.[A-Za-z0-9_-]{43}$/u.test(demonstrationLeaseToken);
  const validDemonstrationLifecycle = demonstrationAcquisition?.allowed === true
    && validDemonstrationLeaseToken
    && Number.isSafeInteger(demonstrationAcquisition?.expiresAt)
    && Number.isSafeInteger(demonstrationAcquisition?.maximumExpiresAt)
    && demonstrationAcquisition.expiresAt > 0
    && demonstrationAcquisition.maximumExpiresAt >= demonstrationAcquisition.expiresAt;

  let acquisitionFailure = null;
  try {
    verifyLeaseHeaders(
      demonstrationAcquisitionResponse,
      "lease demonstration-profile acquisition probe",
    );
    if (!validDemonstrationLifecycle) {
      fail("lease demonstration-profile acquisition returned an invalid lifecycle.");
    }
  } catch (error) {
    acquisitionFailure = error;
  }

  let releaseFailure = null;
  if (validDemonstrationLeaseToken) {
    try {
      const demonstrationReleaseResponse = await request(fetchImpl, leaseUrl, {
        method: "DELETE",
        headers: {
          ...sameOriginLeaseHeaders,
          Authorization: `Bearer ${demonstrationLeaseToken}`,
          Cookie: cookiePair,
        },
      }, "lease demonstration-profile release probe");
      requireStatus(demonstrationReleaseResponse, 204, "lease demonstration-profile release probe");
      verifyLeaseHeaders(demonstrationReleaseResponse, "lease demonstration-profile release probe");
      if ((await demonstrationReleaseResponse.arrayBuffer()).byteLength !== 0) {
        fail("lease demonstration-profile release returned a response body.");
      }
    } catch (error) {
      releaseFailure = error;
    }
  }
  if (acquisitionFailure) throw acquisitionFailure;
  if (releaseFailure) throw releaseFailure;

  console.log("Lease routing, declared demonstration-profile acquisition and release, attestation rejection, configuration, and cookie boundaries are live.");
}

export async function verifyTextToLatticeServices({
  fetchImpl = fetch,
  frameOnly = false,
  retryDelay = delay,
} = {}) {
  if (typeof retryDelay !== "function") fail("A frame retry delay implementation is required.");
  await verifyFrame(fetchImpl, retryDelay);
  if (frameOnly) return;
  await verifyMainPageHeaders(fetchImpl);
  await verifyLease(fetchImpl);
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  const argumentsSet = new Set(process.argv.slice(2));
  if ([...argumentsSet].some((argument) => argument !== "--frame-only")) {
    throw new Error("The only supported option is --frame-only.");
  }
  await verifyTextToLatticeServices({ frameOnly: argumentsSet.has("--frame-only") });
}
