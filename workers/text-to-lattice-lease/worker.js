import { DurableObject } from "cloudflare:workers";
import {
  admitUsageRequest,
  acquireDemoLease,
  inspectUsageState,
  LATTICE_USAGE_POLICY,
  releaseDemoLease,
  renewDemoLease,
} from "./policy.js";
import {
  createLeaseCredential,
  createOpaqueLeaseId,
  isOpaqueLeaseId,
  verifyLeaseCredential,
} from "./leaseCredential.js";
import { rejectUnsafeRequest } from "./requestSafety.js";
import { requiredSigningSecrets } from "./secretConfig.js";
import {
  shapeLatticeIngressRequest,
  shapeLatticeUsageRequest,
} from "./shaping.js";
import { commitUsageMutation } from "./usageStorage.js";
import {
  boundedInternalRetryAfterSeconds,
  LATTICE_MAX_PUBLIC_RETRY_AFTER_SECONDS,
} from "./retryPolicy.js";
import {
  LATTICE_VISITOR_COOKIE_MAX_AGE_SECONDS,
  signedVisitorValue,
  verifiedVisitorId,
} from "./visitorCookie.js";
import {
  LATTICE_ATTESTATION_HEADER,
  verifyLatticeAttestation,
} from "./attestation.js";

const PUBLIC_ORIGIN = "https://hah.dev";
const API_PATH = "/api/text-to-lattice/lease";
const COOKIE_NAME = "__Secure-hah-lattice-visitor";
const INTERNAL_VISITOR_COOKIE_HEADER = "X-Lattice-Visitor-Cookie";
const INTERNAL_LEASE_CREDENTIAL_HEADER = "X-Lattice-Lease-Credential";
const STATE_KEY = "usage-policy-v1";
const GLOBAL_OBJECT_NAME = "text-to-lattice-global-v1";
const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{24}$/u;
const TYPED_LEASE_ACCEPT = "application/vnd.hah.text-to-lattice-lease.v1+json";
const LEASE_PROTOCOL = "hah-text-to-lattice-lease";
const LEASE_PROTOCOL_VERSION = 1;
const LEASE_CHALLENGE_TYPE = "attestation-challenge";

const responseHeaders = Object.freeze({
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
});

function jsonResponse(status, value, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...responseHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function emptyResponse(status, extraHeaders = {}) {
  return new Response(null, {
    status,
    headers: { ...responseHeaders, ...extraHeaders },
  });
}

function proxiedRateLimitResponse(response, result) {
  const retryAfterSeconds = boundedInternalRetryAfterSeconds(
    result?.retryAfterSeconds,
    response.headers.get("Retry-After"),
  );
  return jsonResponse(429, {
    allowed: false,
    code: "edge-rate-limit",
    retryAfterSeconds,
  }, { "Retry-After": String(retryAfterSeconds) });
}

function shapedRateLimitResponse(shaped) {
  const retryAfterSeconds = boundedInternalRetryAfterSeconds(shaped.retryAfterSeconds);
  return jsonResponse(429, {
    allowed: false,
    code: shaped.code,
    retryAfterSeconds,
  }, { "Retry-After": String(retryAfterSeconds) });
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function randomToken(byteLength = 24) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function cookieValue(request) {
  const cookies = request.headers.get("Cookie")?.split(";") ?? [];
  let found = null;
  for (const cookie of cookies) {
    const [name, ...parts] = cookie.trim().split("=");
    if (name !== COOKIE_NAME) continue;
    if (found !== null) return null;
    found = parts.join("=");
  }
  return found;
}

function bearerValue(request) {
  const match = request.headers.get("Authorization")?.match(/^Bearer ([^\s]{1,256})$/u);
  return match?.[1] ?? null;
}

function acceptsTypedLeaseChallenge(request) {
  return (request.headers.get("Accept") ?? "")
    .split(",")
    .some((value) => value.trim().toLowerCase() === TYPED_LEASE_ACCEPT);
}

function internalLeaseId(request) {
  const value = bearerValue(request);
  return isOpaqueLeaseId(value) ? value : null;
}

async function externalizeLeaseResponse(
  response,
  { leaseId, leaseCredential, leaseCredentialSecret },
) {
  let result;
  try {
    result = await response.json();
  } catch (error) {
    if (response.status === 429) return proxiedRateLimitResponse(response);
    throw error;
  }
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    if (response.status === 429) return proxiedRateLimitResponse(response);
    throw new Error("Usage gate returned an invalid result.");
  }
  const { leaseToken: internalToken, ...publicResult } = result;
  const publicHeaders = new Headers(response.headers);
  publicHeaders.delete(INTERNAL_VISITOR_COOKIE_HEADER);
  publicHeaders.delete(INTERNAL_LEASE_CREDENTIAL_HEADER);
  if (result.allowed !== true) {
    if (response.status === 429) {
      const retryAfterSeconds = boundedInternalRetryAfterSeconds(
        result.retryAfterSeconds,
        response.headers.get("Retry-After"),
      );
      publicResult.retryAfterSeconds = retryAfterSeconds;
      publicHeaders.set("Retry-After", String(retryAfterSeconds));
    } else {
      publicHeaders.delete("Retry-After");
    }
    return new Response(JSON.stringify(publicResult), {
      status: response.status,
      headers: publicHeaders,
    });
  }

  if (
    internalToken !== leaseId
    || !Number.isSafeInteger(result.expiresAt)
    || !Number.isSafeInteger(result.maximumExpiresAt)
    || result.expiresAt <= 0
    || result.maximumExpiresAt < result.expiresAt
  ) {
    throw new Error("Usage gate returned an invalid lease lifecycle.");
  }
  const publicLeaseCredential = leaseCredential
    ?? response.headers.get(INTERNAL_LEASE_CREDENTIAL_HEADER);
  const verifiedCredential = publicLeaseCredential
    ? await verifyLeaseCredential(publicLeaseCredential, {
      now: Date.now(),
      secret: leaseCredentialSecret,
    })
    : null;
  if (
    verifiedCredential?.leaseId !== leaseId
    || verifiedCredential.expiresAt !== result.maximumExpiresAt
  ) {
    throw new Error("Usage gate returned an invalid lease credential.");
  }
  const maximumExpiresAt = result.maximumExpiresAt;
  const expiresAt = Math.min(result.expiresAt, maximumExpiresAt);

  return new Response(JSON.stringify({
    ...publicResult,
    leaseToken: publicLeaseCredential,
    expiresAt,
    maximumExpiresAt,
  }), {
    status: response.status,
    headers: publicHeaders,
  });
}

async function admitGlobalRequest(gate) {
  const response = await gate.fetch(new Request("https://usage-gate.internal/admit", {
    method: "POST",
  }));
  let result;
  try {
    result = await response.json();
  } catch (error) {
    if (response.status === 429) return proxiedRateLimitResponse(response);
    throw error;
  }
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    if (response.status === 429) return proxiedRateLimitResponse(response);
    throw new Error("Usage gate returned an invalid admission result.");
  }
  const policyMatches = result.policy?.version === LATTICE_USAGE_POLICY.version
    && result.policy?.globalRequests?.limit === LATTICE_USAGE_POLICY.globalRequests.limit
    && result.policy?.globalRequests?.windowSeconds === LATTICE_USAGE_POLICY.globalRequests.windowSeconds
    && result.policy?.globalDailyRequests?.limit === LATTICE_USAGE_POLICY.globalDailyRequests.limit
    && result.policy?.globalDailyRequests?.windowSeconds
      === LATTICE_USAGE_POLICY.globalDailyRequests.windowSeconds;
  if (
    response.status === 200
    && result.allowed === true
    && policyMatches
  ) return null;
  if (
    response.status === 429
    && result.allowed === false
    && ["global-request-minute-limit", "global-request-day-limit"].includes(result.code)
    && policyMatches
    && Number.isSafeInteger(result.retryAfterSeconds)
    && result.retryAfterSeconds > 0
    && result.retryAfterSeconds <= LATTICE_MAX_PUBLIC_RETRY_AFTER_SECONDS
  ) {
    return jsonResponse(429, result, {
      "Retry-After": String(result.retryAfterSeconds),
    });
  }
  throw new Error("Usage gate returned an inconsistent admission result.");
}

function withVisitorCookie(response, value) {
  const headers = new Headers(response.headers);
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${value}; Max-Age=${LATTICE_VISITOR_COOKIE_MAX_AGE_SECONDS}; Path=/api/text-to-lattice; Secure; HttpOnly; SameSite=Strict`,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export class LatticeUsageGate extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.visitorCookieSecret = env?.VISITOR_COOKIE_SECRET;
    this.leaseCredentialSecret = env?.LEASE_CREDENTIAL_SECRET;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const now = Date.now();
    if (url.pathname === "/admit" && request.method === "POST") {
      const outcome = await commitUsageMutation(
        this.ctx.storage,
        STATE_KEY,
        (storedState) => admitUsageRequest(storedState, { now: Date.now() }),
      );
      return jsonResponse(outcome.result.allowed ? 200 : 429, outcome.result, outcome.result.allowed
        ? {}
        : { "Retry-After": String(outcome.result.retryAfterSeconds) });
    }
    if (url.pathname === "/acquire" && request.method === "POST") {
      const visitorId = request.headers.get("X-Lattice-Visitor");
      const leaseToken = request.headers.get("X-Lattice-Lease");
      if (!VISITOR_ID_PATTERN.test(visitorId ?? "") || !isOpaqueLeaseId(leaseToken)) {
        return emptyResponse(401);
      }
      const outcome = await commitUsageMutation(
        this.ctx.storage,
        STATE_KEY,
        async (storedState) => {
          const decisionNow = Date.now();
          // The stable browser refresh and time-bound bearer are both created
          // inside this transaction; the bearer and rolling decision share its
          // authoritative timestamp. A signing failure rolls the transaction
          // back before it can commit a counted grant.
          const refreshedCookie = await signedVisitorValue(
            visitorId,
            this.visitorCookieSecret,
          );
          const leaseCredential = await createLeaseCredential({
            leaseId: leaseToken,
            expiresAt: decisionNow
              + LATTICE_USAGE_POLICY.activeLeases.maximumLifetimeSeconds * 1_000,
            secret: this.leaseCredentialSecret,
          });
          return {
            ...acquireDemoLease(
              storedState,
              { now: decisionNow, visitorId, leaseToken },
            ),
            refreshedCookie,
            leaseCredential,
          };
        },
      );
      const headers = {
        [INTERNAL_VISITOR_COOKIE_HEADER]: outcome.refreshedCookie,
        ...(outcome.result.allowed
          ? { [INTERNAL_LEASE_CREDENTIAL_HEADER]: outcome.leaseCredential }
          : {}),
        ...(outcome.result.allowed
          ? {}
          : { "Retry-After": String(outcome.result.retryAfterSeconds) }),
      };
      return jsonResponse(outcome.result.allowed ? 200 : 429, outcome.result, headers);
    }

    if (url.pathname === "/release" && request.method === "DELETE") {
      const leaseToken = internalLeaseId(request);
      if (!leaseToken) return emptyResponse(401);
      await commitUsageMutation(
        this.ctx.storage,
        STATE_KEY,
        (storedState) => releaseDemoLease(
          storedState,
          { now, leaseToken },
        ),
      );
      return emptyResponse(204);
    }

    if (url.pathname === "/renew" && request.method === "PATCH") {
      const leaseToken = internalLeaseId(request);
      if (!leaseToken) return emptyResponse(401);
      const outcome = await commitUsageMutation(
        this.ctx.storage,
        STATE_KEY,
        (storedState) => renewDemoLease(
          storedState,
          { now, leaseToken },
        ),
      );
      const status = outcome.result.allowed
        ? 200
        : outcome.result.code === "lease-renewal-too-soon" ? 429 : 409;
      const headers = outcome.result.allowed
        ? {}
        : { "Retry-After": String(outcome.result.retryAfterSeconds) };
      return jsonResponse(status, outcome.result, headers);
    }

    return emptyResponse(404);
  }

  async alarm() {
    const now = Date.now();
    await commitUsageMutation(this.ctx.storage, STATE_KEY, (storedState) => ({
      state: inspectUsageState(storedState, now),
      stateChanged: true,
    }));
  }
}

async function publicHandler(request, env) {
  const url = new URL(request.url);
  if (url.origin !== PUBLIC_ORIGIN || url.pathname !== API_PATH) {
    return emptyResponse(404);
  }
  // Every request reaching the exact public route consumes this earliest
  // method-agnostic load shedder before query, method, body, credential, or
  // secret work. It cannot erase the Worker invocation already billed.
  const ingressShaped = await shapeLatticeIngressRequest(env);
  if (!ingressShaped.success) return shapedRateLimitResponse(ingressShaped);
  if (url.search) return emptyResponse(404);
  if (!new Set(["POST", "PATCH", "DELETE"]).has(request.method)) {
    return emptyResponse(405, { Allow: "POST, PATCH, DELETE" });
  }
  if (await rejectUnsafeRequest(request, PUBLIC_ORIGIN)) {
    return jsonResponse(403, {
      allowed: false,
      code: "same-origin-empty-request-required",
    });
  }
  const {
    visitorCookieSecret,
    leaseCredentialSecret,
    turnstileSecretKey,
    turnstileSiteKey,
  } = requiredSigningSecrets(env);

  // Validate lease-control credentials before they can consume an independent
  // control shaper. Acquisition traffic must never strand a valid lease by
  // exhausting the counters needed to renew or release it.
  const authenticatedLeaseMethod = request.method === "PATCH" || request.method === "DELETE";
  const presentedLeaseCredential = authenticatedLeaseMethod ? bearerValue(request) : null;
  const verifiedLease = presentedLeaseCredential
    ? await verifyLeaseCredential(presentedLeaseCredential, {
      now: Date.now(),
      secret: leaseCredentialSecret,
    })
    : null;
  if (authenticatedLeaseMethod && !verifiedLease) return emptyResponse(401);

  // Reduce traffic reaching the singleton. These bindings are deliberately
  // not quota authorities: Cloudflare documents them as location-scoped,
  // permissive, and eventually consistent.
  const shaped = await shapeLatticeUsageRequest(
    request.method,
    env,
    verifiedLease?.leaseId,
  );
  if (!shaped.success) return shapedRateLimitResponse(shaped);

  let visitorId = null;
  let attestationToken = null;
  if (request.method === "POST") {
    visitorId = await verifiedVisitorId(
      cookieValue(request),
      visitorCookieSecret,
    );
    attestationToken = request.headers.get(LATTICE_ATTESTATION_HEADER);
    if (!visitorId || !attestationToken) {
      // The current client opts into a typed HTTP 200 challenge so a normal
      // protocol step is not surfaced as a failed network request. The legacy
      // 428 status remains available to already-published clients while the
      // unversioned Worker and Pages deployments overlap or roll back.
      const challengeStatus = acceptsTypedLeaseChallenge(request) ? 200 : 428;
      const challengeResponse = jsonResponse(challengeStatus, {
        protocol: LEASE_PROTOCOL,
        version: LEASE_PROTOCOL_VERSION,
        type: LEASE_CHALLENGE_TYPE,
        allowed: false,
        code: visitorId ? "attestation-required" : "visitor-cookie-required",
        attestationSiteKey: turnstileSiteKey,
      });
      if (visitorId) return challengeResponse;
      const newVisitorId = randomToken(18);
      const newCookie = await signedVisitorValue(
        newVisitorId,
        visitorCookieSecret,
      );
      return withVisitorCookie(challengeResponse, newCookie);
    }
  }

  const gate = env.LATTICE_USAGE_GATE.getByName(GLOBAL_OBJECT_NAME);
  const admissionDenial = await admitGlobalRequest(gate);
  if (admissionDenial) return admissionDenial;
  if (request.method === "DELETE") {
    const response = await gate.fetch(new Request("https://usage-gate.internal/release", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${verifiedLease.leaseId}` },
    }));
    const retryAfter = response.headers.get("Retry-After");
    return emptyResponse(response.status, response.status === 429
      ? { "Retry-After": String(boundedInternalRetryAfterSeconds(retryAfter)) }
      : {});
  }
  if (request.method === "PATCH") {
    const response = await gate.fetch(new Request("https://usage-gate.internal/renew", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${verifiedLease.leaseId}` },
    }));
    return externalizeLeaseResponse(response, {
      leaseId: verifiedLease.leaseId,
      leaseCredential: presentedLeaseCredential,
      leaseCredentialSecret,
    });
  }

  const attested = await verifyLatticeAttestation(attestationToken, {
    secret: turnstileSecretKey,
    remoteIp: request.headers.get("CF-Connecting-IP"),
    now: Date.now(),
  });
  if (!attested) {
    return jsonResponse(403, {
      allowed: false,
      code: "attestation-rejected",
    });
  }

  const leaseId = createOpaqueLeaseId();
  const gateResponse = await gate.fetch(new Request("https://usage-gate.internal/acquire", {
    method: "POST",
    headers: {
      "X-Lattice-Lease": leaseId,
      "X-Lattice-Visitor": visitorId,
    },
  }));
  let response;
  let refreshedCookie;
  try {
    refreshedCookie = gateResponse.headers.get(INTERNAL_VISITOR_COOKIE_HEADER);
    if (await verifiedVisitorId(refreshedCookie, visitorCookieSecret) !== visitorId) {
      throw new Error("Usage gate returned an invalid visitor cookie.");
    }
    response = await externalizeLeaseResponse(gateResponse, {
      leaseId,
      leaseCredentialSecret,
    });
  } catch (error) {
    await gate.fetch(new Request("https://usage-gate.internal/release", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${leaseId}` },
    })).catch(() => {});
    throw error;
  }
  return withVisitorCookie(response, refreshedCookie);
}

const latticeUsageWorker = {
  async fetch(request, env) {
    try {
      return await publicHandler(request, env);
    } catch {
      return jsonResponse(503, {
        allowed: false,
        code: "usage-gate-unavailable",
        retryAfterSeconds: 60,
      }, { "Retry-After": "60" });
    }
  },
};

export default latticeUsageWorker;
