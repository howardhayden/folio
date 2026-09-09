import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LATTICE_USAGE_POLICY,
  admitUsageRequest,
  acquireDemoLease,
  copyUsageState,
  createUsageState,
  inspectUsageState,
  nextUsageExpiry,
  releaseDemoLease,
  renewDemoLease,
  usageStateIsEmpty,
} from "../workers/text-to-lattice-lease/policy.js";
import { LATTICE_USAGE_POLICY as PUBLISHED_LATTICE_USAGE_POLICY } from "../app/resume/lattice/usagePolicy.js";
import {
  LatticeLeaseError,
  MAX_TRACKED_LATTICE_RELEASE_OPERATIONS,
  acquireLatticeLease,
  boundedLatticeLeaseResponseBody,
  releaseLatticeLease,
  renewLatticeLease as renewBrowserLease,
} from "../app/resume/lattice/usageLease.js";
import {
  createLeaseCredential,
  createOpaqueLeaseId,
  verifyLeaseCredential,
} from "../workers/text-to-lattice-lease/leaseCredential.js";
import {
  LATTICE_LEASE_LOCATION_SHAPERS,
  LATTICE_LOCATION_SHAPERS,
  LATTICE_PATH_LOCATION_SHAPER,
  shapeLatticeIngressRequest,
  shapeLatticeUsageRequest,
} from "../workers/text-to-lattice-lease/shaping.js";
import { rejectUnsafeRequest } from "../workers/text-to-lattice-lease/requestSafety.js";
import { requiredSigningSecrets } from "../workers/text-to-lattice-lease/secretConfig.js";
import {
  LATTICE_ATTESTATION_ACTION,
  LATTICE_ATTESTATION_HOSTNAME,
  isLatticeAttestationToken as isWorkerAttestationToken,
  verifyLatticeAttestation,
} from "../workers/text-to-lattice-lease/attestation.js";
import {
  CLOUDFLARE_DEMONSTRATION_SECRET_KEY,
  CLOUDFLARE_DEMONSTRATION_SITE_KEY,
  CLOUDFLARE_DEMONSTRATION_TOKEN,
} from "../workers/text-to-lattice-lease/demonstrationProfile.js";
import {
  isLatticeAttestationToken as isBrowserAttestationToken,
} from "../app/resume/lattice/attestation.js";
import {
  LATTICE_USAGE_ALARM_BUCKET_MILLISECONDS,
  coalescedUsageAlarmTime,
  commitUsageMutation,
} from "../workers/text-to-lattice-lease/usageStorage.js";
import {
  LATTICE_MAX_PUBLIC_RETRY_AFTER_SECONDS,
  boundedInternalRetryAfterSeconds,
} from "../workers/text-to-lattice-lease/retryPolicy.js";
import {
  LATTICE_VISITOR_COOKIE_MAX_AGE_SECONDS,
  signedVisitorValue,
  verifiedVisitorId,
} from "../workers/text-to-lattice-lease/visitorCookie.js";

const visitor = (index) => `visitor_${String(index).padStart(24, "0")}`;
const lease = (index) => `lease_${String(index).padStart(24, "0")}`;

async function legacyVisitorCookie(visitorId, expiresAtSeconds, secret) {
  const encoder = new TextEncoder();
  const payload = `${visitorId}.${expiresAtSeconds}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  let binary = "";
  for (const byte of signature) binary += String.fromCharCode(byte);
  return `${payload}.${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")}`;
}

class InjectedFailureStorage {
  constructor(state, alarm = null) {
    this.values = new Map();
    if (state !== undefined) this.values.set("usage-policy-v1", structuredClone(state));
    this.alarm = alarm;
    this.failNextSetAlarm = false;
    this.setAlarmAttempts = 0;
    this.putAttempts = 0;
    this.deleteAttempts = 0;
    this.deleteAlarmAttempts = 0;
  }

  async transaction(callback) {
    const valuesBefore = new Map(
      [...this.values].map(([key, value]) => [key, structuredClone(value)]),
    );
    const alarmBefore = this.alarm;
    try {
      return await callback();
    } catch (error) {
      this.values = valuesBefore;
      this.alarm = alarmBefore;
      throw error;
    }
  }

  async get(key) {
    return structuredClone(this.values.get(key));
  }

  async put(key, value) {
    this.putAttempts += 1;
    this.values.set(key, structuredClone(value));
  }

  async delete(key) {
    this.deleteAttempts += 1;
    return this.values.delete(key);
  }

  async setAlarm(timestamp) {
    this.setAlarmAttempts += 1;
    if (this.failNextSetAlarm) {
      this.failNextSetAlarm = false;
      throw new Error("injected setAlarm failure");
    }
    this.alarm = timestamp;
  }

  async deleteAlarm() {
    this.deleteAlarmAttempts += 1;
    this.alarm = null;
  }
}

test("lease credentials are unforgeable, expiry-bearing, and domain-specific", async () => {
  const secret = "credential-test-secret-material-000000000000";
  const otherSecret = "credential-test-secret-material-111111111111";
  const leaseId = createOpaqueLeaseId();
  const expiresAt = 10_000;
  const credential = await createLeaseCredential({ leaseId, expiresAt, secret });

  assert.match(leaseId, /^[A-Za-z0-9_-]{32}$/u);
  assert.match(credential, /^l1\.[A-Za-z0-9_-]{32}\.[0-9]+\.[A-Za-z0-9_-]{43}$/u);
  assert.deepEqual(
    await verifyLeaseCredential(credential, { now: expiresAt - 1, secret }),
    { leaseId, expiresAt },
  );
  assert.equal(await verifyLeaseCredential(credential, { now: expiresAt, secret }), null);
  assert.equal(await verifyLeaseCredential(credential, { now: 0, secret: otherSecret }), null);
  const rootKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const unsignedCredential = `l1.${leaseId}.${expiresAt}`;
  const wrongDomainSignature = Buffer.from(await crypto.subtle.sign(
    "HMAC",
    rootKey,
    new TextEncoder().encode(unsignedCredential),
  )).toString("base64url");
  assert.equal(
    await verifyLeaseCredential(`${unsignedCredential}.${wrongDomainSignature}`, { now: 0, secret }),
    null,
  );
  assert.equal(
    await verifyLeaseCredential(`${credential.slice(0, -1)}${credential.endsWith("A") ? "B" : "A"}`, {
      now: 0,
      secret,
    }),
    null,
  );
  assert.equal(await verifyLeaseCredential(lease(999), { now: 0, secret }), null);
});

test("a failed lease-key derivation is evicted so the same secret can recover", async () => {
  const subtle = crypto.subtle;
  const originalImportKey = subtle.importKey;
  const secret = "credential-retry-test-secret-material-333333333";
  const leaseId = createOpaqueLeaseId();
  let rejectNextImport = true;
  subtle.importKey = async function importKeyWithInjectedFailure(...args) {
    if (rejectNextImport) {
      rejectNextImport = false;
      throw new Error("injected importKey failure");
    }
    return originalImportKey.apply(this, args);
  };
  try {
    await assert.rejects(
      createLeaseCredential({ leaseId, expiresAt: 10_000, secret }),
      /injected importKey failure/u,
    );
    const credential = await createLeaseCredential({ leaseId, expiresAt: 10_000, secret });
    assert.match(credential, /^l1\.[A-Za-z0-9_-]{32}\.10000\.[A-Za-z0-9_-]{43}$/u);
  } finally {
    subtle.importKey = originalImportKey;
  }
});

test("a failed visitor-key import is evicted so the same secret can recover", async () => {
  const subtle = crypto.subtle;
  const originalImportKey = subtle.importKey;
  const secret = "visitor-retry-test-secret-material-4444444444";
  const visitorId = visitor(83).slice(-24);
  let rejectNextImport = true;
  subtle.importKey = async function importKeyWithInjectedFailure(...args) {
    if (rejectNextImport) {
      rejectNextImport = false;
      throw new Error("injected visitor importKey failure");
    }
    return originalImportKey.apply(this, args);
  };
  try {
    await assert.rejects(
      signedVisitorValue(visitorId, secret),
      /injected visitor importKey failure/u,
    );
    const cookie = await signedVisitorValue(visitorId, secret);
    assert.equal(await verifiedVisitorId(cookie, secret), visitorId);
  } finally {
    subtle.importKey = originalImportKey;
  }
});

test("production signing domains require distinct secret bindings", () => {
  const visitorCookieSecret = "visitor-cookie-test-secret-material-000000";
  const leaseCredentialSecret = "lease-credential-test-secret-material-11111";
  const turnstileSecretKey = "turnstile-test-secret-material-2222222222";
  const turnstileSiteKey = "0x4AAAA-test-site-key";
  const configured = {
    VISITOR_COOKIE_SECRET: visitorCookieSecret,
    LEASE_CREDENTIAL_SECRET: leaseCredentialSecret,
    TURNSTILE_SECRET_KEY: turnstileSecretKey,
    TURNSTILE_SITE_KEY: turnstileSiteKey,
  };
  assert.deepEqual(
    requiredSigningSecrets(configured),
    { visitorCookieSecret, leaseCredentialSecret, turnstileSecretKey, turnstileSiteKey },
  );
  for (const env of [
    undefined,
    {},
    { VISITOR_COOKIE_SECRET: visitorCookieSecret },
    { LEASE_CREDENTIAL_SECRET: leaseCredentialSecret },
    { VISITOR_COOKIE_SECRET: "short", LEASE_CREDENTIAL_SECRET: leaseCredentialSecret },
    { VISITOR_COOKIE_SECRET: visitorCookieSecret, LEASE_CREDENTIAL_SECRET: "short" },
    { VISITOR_COOKIE_SECRET: visitorCookieSecret, LEASE_CREDENTIAL_SECRET: visitorCookieSecret },
    { ...configured, TURNSTILE_SECRET_KEY: "short" },
    { ...configured, TURNSTILE_SECRET_KEY: visitorCookieSecret },
    { ...configured, TURNSTILE_SECRET_KEY: leaseCredentialSecret },
    { ...configured, TURNSTILE_SITE_KEY: "spaces are invalid" },
    { ...configured, TURNSTILE_SITE_KEY: visitorCookieSecret },
    { ...configured, TURNSTILE_SITE_KEY: leaseCredentialSecret },
    { ...configured, TURNSTILE_SITE_KEY: turnstileSecretKey },
    { ...configured, TURNSTILE_SECRET_KEY: CLOUDFLARE_DEMONSTRATION_SECRET_KEY },
    { ...configured, TURNSTILE_SITE_KEY: CLOUDFLARE_DEMONSTRATION_SITE_KEY },
  ]) {
    assert.throws(() => requiredSigningSecrets(env), /Independent Worker secrets and attestation configuration are not configured/u);
  }

  assert.deepEqual(requiredSigningSecrets({
    ...configured,
    TURNSTILE_SECRET_KEY: CLOUDFLARE_DEMONSTRATION_SECRET_KEY,
    TURNSTILE_SITE_KEY: CLOUDFLARE_DEMONSTRATION_SITE_KEY,
  }), {
    visitorCookieSecret,
    leaseCredentialSecret,
    turnstileSecretKey: CLOUDFLARE_DEMONSTRATION_SECRET_KEY,
    turnstileSiteKey: CLOUDFLARE_DEMONSTRATION_SITE_KEY,
  });
});

test("out-of-order visitor refreshes retain one stable pseudonym", async () => {
  const secret = "visitor-cookie-test-secret-material-000000";
  const visitorId = visitor(81).slice(-24);
  const firstDecisionAt = Date.UTC(2026, 8, 8, 12, 0, 0);
  const secondDecisionAt = firstDecisionAt + 61_000;
  const firstGrant = acquireDemoLease(undefined, {
    now: firstDecisionAt,
    visitorId,
    leaseToken: lease(81),
  });
  const released = releaseDemoLease(firstGrant.state, {
    now: secondDecisionAt,
    leaseToken: lease(81),
  });
  const secondGrant = acquireDemoLease(released.state, {
    now: secondDecisionAt,
    visitorId,
    leaseToken: lease(82),
  });
  assert.equal(secondGrant.result.allowed, true);

  const olderResponseCookie = await signedVisitorValue(visitorId, secret);
  const newerResponseCookie = await signedVisitorValue(visitorId, secret);
  assert.equal(olderResponseCookie, newerResponseCookie,
    "refresh responses for one id are order-independent");

  for (const arrivedCookie of [newerResponseCookie, olderResponseCookie]) {
    assert.equal(await verifiedVisitorId(arrivedCookie, secret), visitorId);
  }
  const oldFormatWithElapsedMarker = await legacyVisitorCookie(visitorId, 1, secret);
  assert.equal(await verifiedVisitorId(oldFormatWithElapsedMarker, secret), visitorId,
    "an old signed value resumes the same id rather than creating capacity under a new one");
  assert.equal(await verifiedVisitorId(undefined, secret), null,
    "absence still creates a new pseudonym through the Worker challenge path");
  assert.equal(
    secondGrant.state.visitors[visitorId].at(-1) + LATTICE_VISITOR_COOKIE_MAX_AGE_SECONDS * 1_000,
    secondDecisionAt + LATTICE_VISITOR_COOKIE_MAX_AGE_SECONDS * 1_000,
  );
});

test("lease credential expiry follows a delayed Durable Object decision", async () => {
  const secret = "credential-test-secret-material-000000000000";
  const outerWorkerTime = Date.UTC(2026, 8, 8, 12, 0, 0);
  const durableObjectTime = outerWorkerTime + 61_000;
  const leaseId = createOpaqueLeaseId();
  const grant = acquireDemoLease(undefined, {
    now: durableObjectTime,
    visitorId: visitor(82),
    leaseToken: leaseId,
  });
  const oldOuterAnchoredExpiry = outerWorkerTime
    + LATTICE_USAGE_POLICY.activeLeases.maximumLifetimeSeconds * 1_000;
  assert.ok(oldOuterAnchoredExpiry < grant.result.maximumExpiresAt,
    "pre-signing outside the gate would shorten the granted bearer");

  const credential = await createLeaseCredential({
    leaseId,
    expiresAt: grant.result.maximumExpiresAt,
    secret,
  });
  assert.deepEqual(
    await verifyLeaseCredential(credential, { now: durableObjectTime, secret }),
    { leaseId, expiresAt: grant.result.maximumExpiresAt },
  );
});

test("Turnstile attestation validates success, hostname, action, age, and header-safe token bounds", async () => {
  const now = Date.UTC(2026, 8, 8, 12, 0, 0);
  const secret = "turnstile-test-secret-material-2222222222";
  let submitted;
  const validFetch = async (_url, options) => {
    submitted = options.body;
    return new Response(JSON.stringify({
      success: true,
      hostname: LATTICE_ATTESTATION_HOSTNAME,
      action: LATTICE_ATTESTATION_ACTION,
      challenge_ts: new Date(now - 1_000).toISOString(),
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  assert.equal(await verifyLatticeAttestation("0.valid_test-token", {
    secret,
    remoteIp: "192.0.2.1",
    now,
    fetchImpl: validFetch,
  }), true);
  assert.equal(submitted.get("response"), "0.valid_test-token");
  assert.equal(submitted.get("secret"), secret);
  assert.equal(submitted.get("remoteip"), "192.0.2.1");
  assert.match(submitted.get("idempotency_key"), /^[0-9a-f-]{36}$/u);

  for (const patch of [
    { success: false },
    { hostname: "example.com" },
    { action: "different_action" },
    { challenge_ts: new Date(now - 301_000).toISOString() },
  ]) {
    const fetchImpl = async () => new Response(JSON.stringify({
      success: true,
      hostname: LATTICE_ATTESTATION_HOSTNAME,
      action: LATTICE_ATTESTATION_ACTION,
      challenge_ts: new Date(now - 1_000).toISOString(),
      ...patch,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    assert.equal(await verifyLatticeAttestation("0.valid_test-token", { secret, now, fetchImpl }), false);
  }
  assert.equal(await verifyLatticeAttestation("source text must not be a token", { secret, now, fetchImpl: validFetch }), false);

  const providerTokenWithPunctuation = "0.provider+/token=:~";
  for (const validate of [isWorkerAttestationToken, isBrowserAttestationToken]) {
    assert.equal(validate(providerTokenWithPunctuation), true);
    assert.equal(validate("x".repeat(2_048)), true);
    assert.equal(validate(""), false);
    assert.equal(validate("x".repeat(2_049)), false);
    assert.equal(validate("token with whitespace"), false);
    assert.equal(validate("token\u0000control"), false);
    assert.equal(validate("token\u007Fcontrol"), false);
  }
  assert.equal(await verifyLatticeAttestation(providerTokenWithPunctuation, {
    secret,
    now,
    fetchImpl: validFetch,
  }), true);
  assert.equal(submitted.get("response"), providerTokenWithPunctuation);
});

test("the official testing profile admits only the exact dummy token without claiming identity assurance", async () => {
  const now = Date.UTC(2026, 8, 9, 12, 0, 0);
  const result = {
    success: true,
    hostname: "localhost",
    action: "test",
    challenge_ts: new Date(now - 1_000).toISOString(),
  };
  let verificationCalls = 0;
  const fetchImpl = async () => {
    verificationCalls += 1;
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  for (let replay = 0; replay < 2; replay += 1) {
    assert.equal(await verifyLatticeAttestation(CLOUDFLARE_DEMONSTRATION_TOKEN, {
      secret: CLOUDFLARE_DEMONSTRATION_SECRET_KEY,
      now,
      fetchImpl,
    }), true);
  }
  assert.equal(verificationCalls, 2, "the declared demo profile remains replayable by design");
  assert.equal(await verifyLatticeAttestation("qualification-intentionally-invalid", {
    secret: CLOUDFLARE_DEMONSTRATION_SECRET_KEY,
    now,
    fetchImpl: async () => { throw new Error("a non-dummy token must be rejected before Siteverify"); },
  }), false);
  assert.equal(await verifyLatticeAttestation(CLOUDFLARE_DEMONSTRATION_TOKEN, {
    secret: "turnstile-production-secret-material-000000",
    now,
    fetchImpl,
  }), false);
  assert.equal(await verifyLatticeAttestation(CLOUDFLARE_DEMONSTRATION_TOKEN, {
    secret: CLOUDFLARE_DEMONSTRATION_SECRET_KEY,
    now,
    fetchImpl: async () => new Response(JSON.stringify({
      ...result,
      challenge_ts: new Date(now - 301_000).toISOString(),
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  }), false);

  const profile = PUBLISHED_LATTICE_USAGE_POLICY.enforcement.humanAttestation;
  assert.equal(profile.activeProfile, "Cloudflare official testing profile");
  assert.equal(profile.demonstrationProfile.exactAcceptedToken, CLOUDFLARE_DEMONSTRATION_TOKEN);
  assert.equal(profile.demonstrationProfile.workerRequiresExactAcceptedToken, true);
  assert.equal(profile.demonstrationProfile.workerRequiresProviderSuccess, true);
  for (const assurance of [
    "humanOrBotAssurance",
    "hostnameAssurance",
    "actionAssurance",
    "freshnessAssurance",
    "singleUseAssurance",
  ]) assert.equal(profile.demonstrationProfile[assurance], false, assurance);
  assert.match(profile.demonstrationProfile.limitation, /public dummy credential and token are reusable[\s\S]*does not make the token fresh or single-use[\s\S]*must not be represented as anti-bot evidence/iu);
  assert.deepEqual(profile.realProfile, {
    status: "supported when a hostname-restricted real widget pair is configured; not claimed by the active demonstrable release",
    action: LATTICE_ATTESTATION_ACTION,
    hostname: LATTICE_ATTESTATION_HOSTNAME,
    validitySeconds: 300,
    providerEnforcesSingleUse: true,
    workerRequiresProviderSuccess: true,
    workerRequiresHostname: true,
    workerRequiresAction: true,
    workerBoundsChallengeAge: true,
  });
});

test("Turnstile Siteverify bodies are canceled at declared and streamed byte ceilings", async () => {
  const now = Date.UTC(2026, 8, 8, 12, 0, 0);
  const secret = "turnstile-test-secret-material-2222222222";
  let declaredCanceled = false;
  const declaredBody = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([123]));
    },
    cancel() {
      declaredCanceled = true;
    },
  });
  assert.equal(await verifyLatticeAttestation("0.valid-token", {
    secret,
    now,
    fetchImpl: async () => new Response(declaredBody, {
      status: 200,
      headers: { "Content-Type": "application/json", "Content-Length": "8193" },
    }),
  }), false);
  assert.equal(declaredCanceled, true);

  let streamedCanceled = false;
  const streamedBody = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(5_000));
      controller.enqueue(new Uint8Array(5_000));
    },
    cancel() {
      streamedCanceled = true;
    },
  });
  assert.equal(await verifyLatticeAttestation("0.valid-token", {
    secret,
    now,
    fetchImpl: async () => new Response(streamedBody, {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }),
  }), false);
  assert.equal(streamedCanceled, true);
});

test("only empty requests pass, including provider-created closed streams", async () => {
  const url = "https://hah.dev/api/text-to-lattice/lease";
  const implicitlyTypedEmptyRequest = new Request(url, {
    method: "POST",
    headers: {
      Origin: "https://hah.dev",
      "Content-Length": "0",
    },
    body: "",
    duplex: "half",
  });
  assert.equal(implicitlyTypedEmptyRequest.body === null, false);
  assert.equal(
    await rejectUnsafeRequest(implicitlyTypedEmptyRequest, "https://hah.dev"),
    "body",
    "an automatically added Content-Type still violates the bodyless protocol",
  );

  const providerEmptyStreamRequest = new Request(url, {
    method: "POST",
    headers: { Origin: "https://hah.dev" },
    body: new Uint8Array(),
    duplex: "half",
  });
  assert.equal(providerEmptyStreamRequest.body === null, false);
  assert.equal(await rejectUnsafeRequest(providerEmptyStreamRequest, "https://hah.dev"), null);

  const zeroChunkThenCloseRequest = new Request(url, {
    method: "POST",
    headers: { Origin: "https://hah.dev" },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array());
        controller.close();
      },
    }),
    duplex: "half",
  });
  assert.equal(await rejectUnsafeRequest(zeroChunkThenCloseRequest, "https://hah.dev"), null);

  const providerPayloadStreamRequest = new Request(url, {
    method: "POST",
    headers: { Origin: "https://hah.dev" },
    body: new Uint8Array([1]),
    duplex: "half",
  });
  assert.equal(await rejectUnsafeRequest(providerPayloadStreamRequest, "https://hah.dev"), "body");

  const erroredStreamRequest = new Request(url, {
    method: "POST",
    headers: { Origin: "https://hah.dev" },
    body: new ReadableStream({
      start(controller) {
        controller.error(new Error("injected stream failure"));
      },
    }),
    duplex: "half",
  });
  assert.equal(await rejectUnsafeRequest(erroredStreamRequest, "https://hah.dev"), "body");

  const request = ({
    body = null,
    contentLength,
    transferEncoding,
    requestUrl = url,
    origin = "https://hah.dev",
    fetchSite,
    fetchMode,
    fetchDestination,
    cookie,
    contentType,
    contentEncoding,
    authorization,
    attestation,
    method = "POST",
  } = {}) => {
    const headers = new Headers();
    if (origin !== null) headers.set("Origin", origin);
    if (contentLength !== undefined) headers.set("Content-Length", contentLength);
    if (transferEncoding !== undefined) headers.set("Transfer-Encoding", transferEncoding);
    if (fetchSite !== undefined) headers.set("Sec-Fetch-Site", fetchSite);
    if (fetchMode !== undefined) headers.set("Sec-Fetch-Mode", fetchMode);
    if (fetchDestination !== undefined) headers.set("Sec-Fetch-Dest", fetchDestination);
    if (cookie !== undefined) headers.set("Cookie", cookie);
    if (contentType !== undefined) headers.set("Content-Type", contentType);
    if (contentEncoding !== undefined) headers.set("Content-Encoding", contentEncoding);
    if (authorization !== undefined) headers.set("Authorization", authorization);
    if (attestation !== undefined) headers.set("X-Lattice-Attestation", attestation);
    return { url: requestUrl, headers, body, method };
  };
  assert.equal(await rejectUnsafeRequest(request(), "https://hah.dev"), null);
  assert.equal(await rejectUnsafeRequest(request({ contentLength: "0" }), "https://hah.dev"), null);
  assert.equal(await rejectUnsafeRequest(request({ body: {}, contentLength: "0" }), "https://hah.dev"), "body");
  assert.equal(await rejectUnsafeRequest(request({ body: {} }), "https://hah.dev"), "body");
  assert.equal(await rejectUnsafeRequest(request({ body: {}, contentLength: "1" }), "https://hah.dev"), "body");
  assert.equal(await rejectUnsafeRequest(request({ body: {}, contentLength: "00" }), "https://hah.dev"), "body");
  assert.equal(
    await rejectUnsafeRequest(request({ body: {}, contentLength: "0", transferEncoding: "chunked" }), "https://hah.dev"),
    "body",
  );
  assert.equal(await rejectUnsafeRequest(request({ origin: null }), "https://hah.dev"), "origin");
  assert.equal(await rejectUnsafeRequest(request({ origin: "https://example.invalid" }), "https://hah.dev"), "origin");
  assert.equal(await rejectUnsafeRequest(request({ fetchSite: "cross-site" }), "https://hah.dev"), "fetch-site");
  assert.equal(await rejectUnsafeRequest(request({ fetchSite: "same-site" }), "https://hah.dev"), "fetch-site");
  assert.equal(await rejectUnsafeRequest(request({ fetchMode: "navigate" }), "https://hah.dev"), "fetch-mode");
  assert.equal(await rejectUnsafeRequest(request({ fetchDestination: "document" }), "https://hah.dev"), "fetch-destination");
  assert.equal(await rejectUnsafeRequest(request({ requestUrl: `${url}?source=never` }), "https://hah.dev"), "query");
  assert.equal(await rejectUnsafeRequest(request({ cookie: "x".repeat(4_097) }), "https://hah.dev"), "cookie");
  assert.equal(await rejectUnsafeRequest(request({ contentType: "text/plain" }), "https://hah.dev"), "body");
  assert.equal(await rejectUnsafeRequest(request({ contentEncoding: "gzip" }), "https://hah.dev"), "body");
  assert.equal(await rejectUnsafeRequest(request({ authorization: "Bearer x" }), "https://hah.dev"), "authorization");
  assert.equal(await rejectUnsafeRequest(request({ attestation: "0.valid_test-token" }), "https://hah.dev"), null);
  assert.equal(await rejectUnsafeRequest(request({ attestation: "source text" }), "https://hah.dev"), "attestation");
  assert.equal(await rejectUnsafeRequest(request({ method: "PATCH", authorization: "Bearer x" }), "https://hah.dev"), null);
  assert.equal(await rejectUnsafeRequest(request({ method: "PATCH", authorization: "Bearer x", attestation: "0.valid_test-token" }), "https://hah.dev"), "attestation");
});

test("an acquisition and its alarm roll back together when setAlarm fails", async () => {
  const storage = new InjectedFailureStorage(undefined);
  storage.failNextSetAlarm = true;
  const mutate = (storedState) => acquireDemoLease(storedState, {
    now: 0,
    visitorId: visitor(1),
    leaseToken: lease(1),
  });
  await assert.rejects(
    commitUsageMutation(storage, "usage-policy-v1", mutate),
    /injected setAlarm failure/u,
  );
  assert.equal(await storage.get("usage-policy-v1"), undefined);
  assert.equal(storage.alarm, null);

  const retried = await commitUsageMutation(storage, "usage-policy-v1", mutate);
  assert.equal(retried.result.allowed, true);
  assert.equal(retried.state.attemptTimes.length, 1);
  assert.equal(retried.state.grantTimes.length, 1);
  assert.equal(Object.keys(retried.state.leases).length, 1);
  assert.equal(storage.alarm, coalescedUsageAlarmTime(nextUsageExpiry(retried.state)));
});

test("exact request admission and its alarm roll back together", async () => {
  const storage = new InjectedFailureStorage(undefined);
  storage.failNextSetAlarm = true;
  const mutate = (storedState) => admitUsageRequest(storedState, { now: 0 });
  await assert.rejects(
    commitUsageMutation(storage, "usage-policy-v1", mutate),
    /injected setAlarm failure/u,
  );
  assert.equal(await storage.get("usage-policy-v1"), undefined);
  assert.equal(storage.alarm, null);

  const retried = await commitUsageMutation(storage, "usage-policy-v1", mutate);
  assert.equal(retried.result.allowed, true);
  assert.deepEqual(retried.state.requestTimes, [0]);
  assert.equal(storage.alarm, LATTICE_USAGE_POLICY.globalRequests.windowSeconds * 1_000);
});

test("retention alarms coalesce to the next UTC minute without weakening exact expiry", async () => {
  const admittedAt = 1_001;
  const outcome = admitUsageRequest(createUsageState(), { now: admittedAt });
  const exactExpiry = admittedAt
    + LATTICE_USAGE_POLICY.globalRequests.windowSeconds * 1_000;
  assert.equal(nextUsageExpiry(outcome.state), exactExpiry);
  assert.equal(LATTICE_USAGE_ALARM_BUCKET_MILLISECONDS, 60_000);
  assert.equal(coalescedUsageAlarmTime(exactExpiry), 120_000);
  assert.equal(coalescedUsageAlarmTime(120_000), 120_000);
  assert.throws(() => coalescedUsageAlarmTime(-1), /non-negative integer/u);

  const storage = new InjectedFailureStorage(undefined);
  await commitUsageMutation(
    storage,
    "usage-policy-v1",
    () => outcome,
  );
  assert.equal(storage.alarm, 120_000);

  const boundary = admitUsageRequest(outcome.state, { now: exactExpiry });
  assert.equal(boundary.result.allowed, true,
    "request-time pruning stays exact even though background cleanup is rounded");
});

test("server retry estimates reject ambiguity and remain within the UI horizon", () => {
  assert.equal(boundedInternalRetryAfterSeconds(), 60);
  assert.equal(boundedInternalRetryAfterSeconds("61"), 61);
  assert.equal(boundedInternalRetryAfterSeconds(7, "61"), 61);
  assert.equal(
    boundedInternalRetryAfterSeconds("999999999999999"),
    LATTICE_MAX_PUBLIC_RETRY_AFTER_SECONDS,
  );
  for (const invalid of [0, -1, 1.5, NaN, Infinity, "", "00", "01", "+1", " 1", "1 ", "1e2", "tomorrow"]) {
    assert.equal(boundedInternalRetryAfterSeconds(invalid), 60, String(invalid));
  }
});

test("an asynchronous pre-decision signing failure leaves usage state untouched", async () => {
  const granted = acquireDemoLease(undefined, {
    now: 0,
    visitorId: visitor(80),
    leaseToken: lease(80),
  });
  const alarmBefore = nextUsageExpiry(granted.state);
  const storage = new InjectedFailureStorage(granted.state, alarmBefore);
  await assert.rejects(
    commitUsageMutation(storage, "usage-policy-v1", async () => {
      await Promise.resolve();
      throw new Error("injected visitor-signing failure");
    }),
    /injected visitor-signing failure/u,
  );
  assert.deepEqual(await storage.get("usage-policy-v1"), granted.state);
  assert.equal(storage.alarm, alarmBefore);
  assert.equal(storage.putAttempts, 0);
  assert.equal(storage.deleteAttempts, 0);
  assert.equal(storage.setAlarmAttempts, 0);
  assert.equal(storage.deleteAlarmAttempts, 0);
});

test("a renewal and its replacement alarm roll back together when setAlarm fails", async () => {
  const granted = acquireDemoLease(undefined, {
    now: 0,
    visitorId: visitor(1),
    leaseToken: lease(1),
  });
  const renewalAt = LATTICE_USAGE_POLICY.activeLeases.minimumRenewalIntervalSeconds * 1_000;
  const stateBefore = inspectUsageState(granted.state, renewalAt);
  const alarmBefore = nextUsageExpiry(stateBefore);
  const storage = new InjectedFailureStorage(stateBefore, alarmBefore);
  storage.failNextSetAlarm = true;
  const mutate = (storedState) => renewDemoLease(storedState, {
    now: renewalAt,
    leaseToken: lease(1),
  });
  await assert.rejects(
    commitUsageMutation(storage, "usage-policy-v1", mutate),
    /injected setAlarm failure/u,
  );
  assert.deepEqual(await storage.get("usage-policy-v1"), stateBefore);
  assert.equal(storage.alarm, alarmBefore);

  const retried = await commitUsageMutation(storage, "usage-policy-v1", mutate);
  assert.equal(retried.result.allowed, true);
  assert.equal(retried.state.grantTimes.length, stateBefore.grantTimes.length);
  assert.equal(retried.state.leases[lease(1)].lastRenewedAt, renewalAt);
  assert.equal(storage.alarm, coalescedUsageAlarmTime(nextUsageExpiry(retried.state)));
});

test("a release and its replacement alarm roll back together when setAlarm fails", async () => {
  const granted = acquireDemoLease(undefined, {
    now: 0,
    visitorId: visitor(1),
    leaseToken: lease(1),
  });
  const alarmBefore = nextUsageExpiry(granted.state);
  const storage = new InjectedFailureStorage(granted.state, alarmBefore);
  storage.failNextSetAlarm = true;
  const mutate = (storedState) => releaseDemoLease(storedState, {
    now: 1_000,
    leaseToken: lease(1),
  });
  await assert.rejects(
    commitUsageMutation(storage, "usage-policy-v1", mutate),
    /injected setAlarm failure/u,
  );
  assert.deepEqual(await storage.get("usage-policy-v1"), granted.state);
  assert.equal(storage.alarm, alarmBefore);

  const retried = await commitUsageMutation(storage, "usage-policy-v1", mutate);
  assert.equal(retried.released, true);
  assert.equal(Object.hasOwn(retried.state.leases, lease(1)), false);
  assert.equal(storage.alarm, coalescedUsageAlarmTime(nextUsageExpiry(retried.state)));
});

test("an anonymous browser receives three grants per rolling day", () => {
  let state = createUsageState();
  for (let index = 0; index < 3; index += 1) {
    const outcome = acquireDemoLease(state, {
      now: index * 1_000,
      visitorId: visitor(1),
      leaseToken: lease(index),
    });
    assert.equal(outcome.result.allowed, true);
    state = releaseDemoLease(outcome.state, {
      now: index * 1_000,
      leaseToken: lease(index),
    }).state;
  }
  const denied = acquireDemoLease(state, {
    now: 3_000,
    visitorId: visitor(1),
    leaseToken: lease(3),
  });
  assert.equal(denied.result.allowed, false);
  assert.equal(denied.result.code, "visitor-day-limit");
  assert.equal(denied.result.retryAfterSeconds, 24 * 60 * 60 - 3);

  const reset = acquireDemoLease(denied.state, {
    now: 24 * 60 * 60 * 1_000,
    visitorId: visitor(1),
    leaseToken: lease(4),
  });
  assert.equal(reset.result.allowed, true);
});

test("the singleton enforces the exact rolling-minute request limit", () => {
  const requestPolicy = LATTICE_USAGE_POLICY.globalRequests;
  let state = createUsageState();
  for (let index = 0; index < requestPolicy.limit; index += 1) {
    const admitted = admitUsageRequest(state, { now: index });
    assert.equal(admitted.result.allowed, true, `request ${index + 1}`);
    state = admitted.state;
  }

  const denied = admitUsageRequest(state, { now: requestPolicy.limit });
  assert.equal(denied.result.allowed, false);
  assert.equal(denied.result.code, "global-request-minute-limit");
  assert.equal(denied.result.retryAfterSeconds, requestPolicy.windowSeconds);
  assert.equal(denied.stateChanged, false, "an unchanged denial is write-free");
  assert.equal(denied.state.requestTimes.length, requestPolicy.limit);

  const boundary = admitUsageRequest(denied.state, {
    now: requestPolicy.windowSeconds * 1_000,
  });
  assert.equal(boundary.result.allowed, true);
  assert.equal(boundary.state.requestTimes.length, requestPolicy.limit);
  assert.equal(boundary.state.requestTimes[0], 1,
    "the timestamp exactly outside the rolling window is replaced atomically");
});

test("the singleton enforces the exact UTC-day admission budget and rollover ETA", () => {
  const dailyPolicy = LATTICE_USAGE_POLICY.globalDailyRequests;
  const minutePolicy = LATTICE_USAGE_POLICY.globalRequests;
  let state = createUsageState();
  let lastAdmissionAt = 0;
  for (let index = 0; index < dailyPolicy.limit; index += 1) {
    lastAdmissionAt = Math.floor(index / minutePolicy.limit)
      * minutePolicy.windowSeconds * 1_000
      + index % minutePolicy.limit;
    const admitted = admitUsageRequest(state, { now: lastAdmissionAt });
    assert.equal(admitted.result.allowed, true, `daily request ${index + 1}`);
    state = admitted.state;
  }
  assert.deepEqual(state.admissionDay, { startedAt: 0, count: dailyPolicy.limit });

  const denied = admitUsageRequest(state, { now: lastAdmissionAt });
  assert.equal(denied.result.allowed, false);
  assert.equal(denied.result.code, "global-request-day-limit");
  assert.equal(
    denied.result.retryAfterSeconds,
    Math.ceil((dailyPolicy.windowSeconds * 1_000 - lastAdmissionAt) / 1_000),
  );
  assert.equal(denied.stateChanged, false, "an unchanged UTC-day denial is write-free");
  assert.deepEqual(denied.state.admissionDay, state.admissionDay);

  const pruningAt = denied.state.requestTimes[0]
    + minutePolicy.windowSeconds * 1_000;
  const pruningDenial = admitUsageRequest(denied.state, { now: pruningAt });
  assert.equal(pruningDenial.result.code, "global-request-day-limit");
  assert.equal(pruningDenial.stateChanged, true,
    "a daily denial persists newly expired rolling-minute history");
  const repeatedPruningDenial = admitUsageRequest(pruningDenial.state, {
    now: pruningAt,
  });
  assert.equal(repeatedPruningDenial.stateChanged, false,
    "the same daily denial does not rewrite already-pruned state");

  const finalMillisecond = admitUsageRequest(repeatedPruningDenial.state, {
    now: dailyPolicy.windowSeconds * 1_000 - 1,
  });
  assert.equal(finalMillisecond.result.allowed, false);
  assert.equal(finalMillisecond.result.retryAfterSeconds, 1);
  assert.deepEqual(finalMillisecond.state.admissionDay, state.admissionDay);
  assert.equal(nextUsageExpiry(finalMillisecond.state), dailyPolicy.windowSeconds * 1_000);

  const rollover = admitUsageRequest(finalMillisecond.state, {
    now: dailyPolicy.windowSeconds * 1_000,
  });
  assert.equal(rollover.result.allowed, true);
  assert.deepEqual(rollover.state.admissionDay, {
    startedAt: dailyPolicy.windowSeconds * 1_000,
    count: 1,
  });
  assert.deepEqual(rollover.state.requestTimes, [dailyPolicy.windowSeconds * 1_000]);
});

test("one browser cannot occupy more than one of the eight active leases", () => {
  const visitorId = visitor(31);
  const first = acquireDemoLease(createUsageState(), {
    now: 0,
    visitorId,
    leaseToken: lease(31),
  });
  const denied = acquireDemoLease(first.state, {
    now: 1_000,
    visitorId,
    leaseToken: lease(32),
  });
  assert.equal(denied.result.allowed, false);
  assert.equal(denied.result.code, "visitor-active-lease-limit");
  assert.equal(
    denied.result.retryAfterSeconds,
    LATTICE_USAGE_POLICY.activeLeases.ttlSeconds - 1,
  );
  assert.equal(denied.state.attemptTimes.length, 1,
    "an already-active visitor cannot consume another shared grant attempt");

  const released = releaseDemoLease(denied.state, {
    now: 2_000,
    leaseToken: lease(31),
  });
  const replacement = acquireDemoLease(released.state, {
    now: 2_001,
    visitorId,
    leaseToken: lease(32),
  });
  assert.equal(replacement.result.allowed, true);
  assert.equal(replacement.state.leases[lease(32)].visitorId, visitorId);
});

test("the singleton gate enforces the active lease cap exactly", () => {
  let state = createUsageState();
  for (let index = 0; index < LATTICE_USAGE_POLICY.activeLeases.limit; index += 1) {
    const outcome = acquireDemoLease(state, {
      now: index,
      visitorId: visitor(index),
      leaseToken: lease(index),
    });
    assert.equal(outcome.result.allowed, true);
    state = outcome.state;
  }
  const denied = acquireDemoLease(state, {
    now: 100,
    visitorId: visitor(9),
    leaseToken: lease(9),
  });
  assert.equal(denied.result.code, "active-lease-limit");

  state = releaseDemoLease(denied.state, { now: 101, leaseToken: lease(0) }).state;
  const replacement = acquireDemoLease(state, {
    now: LATTICE_USAGE_POLICY.globalAttempts.windowSeconds * 1_000 + 1,
    visitorId: visitor(10),
    leaseToken: lease(10),
  });
  assert.equal(replacement.result.allowed, true);
});

test("the global rolling minute enforces the exact acquisition-attempt limit", () => {
  let state = createUsageState();
  for (let index = 0; index < LATTICE_USAGE_POLICY.globalAttempts.limit; index += 1) {
    const outcome = acquireDemoLease(state, {
      now: index,
      visitorId: visitor(index),
      leaseToken: lease(index),
    });
    state = outcome.state;
    if (outcome.result.allowed) {
      state = releaseDemoLease(state, { now: index, leaseToken: lease(index) }).state;
    }
  }
  const denied = acquireDemoLease(state, {
    now: LATTICE_USAGE_POLICY.globalAttempts.limit,
    visitorId: visitor(20),
    leaseToken: lease(20),
  });
  assert.equal(denied.result.code, "global-minute-limit");
  assert.equal(denied.result.retryAfterSeconds, 60);
});

test("a visitor already at its daily limit cannot consume the shared attempt window", () => {
  let state = createUsageState();
  for (let index = 0; index < LATTICE_USAGE_POLICY.visitor.limit; index += 1) {
    const granted = acquireDemoLease(state, {
      now: index * 1_000,
      visitorId: visitor(1),
      leaseToken: lease(index),
    });
    state = releaseDemoLease(granted.state, { now: index * 1_000, leaseToken: lease(index) }).state;
  }
  for (let index = 0; index < LATTICE_USAGE_POLICY.globalAttempts.limit; index += 1) {
    const denied = acquireDemoLease(state, {
      now: 5_000 + index * 5_000,
      visitorId: visitor(1),
      leaseToken: lease(100 + index),
    });
    assert.equal(denied.result.code, "visitor-day-limit");
    state = denied.state;
  }
  assert.ok(state.attemptTimes.every((timestamp) => timestamp < 5_000));
  const otherVisitor = acquireDemoLease(state, {
    now: 59_999,
    visitorId: visitor(2),
    leaseToken: lease(200),
  });
  assert.equal(otherVisitor.result.allowed, true);
});

test("unchanged acquisition-cap denials do not rewrite state or reset its alarm", async () => {
  let visitorCapped = createUsageState();
  for (let index = 0; index < LATTICE_USAGE_POLICY.visitor.limit; index += 1) {
    const now = index * 1_000;
    const granted = acquireDemoLease(visitorCapped, {
      now,
      visitorId: visitor(1),
      leaseToken: lease(index),
    });
    visitorCapped = releaseDemoLease(granted.state, { now, leaseToken: lease(index) }).state;
  }

  let globalCapped = createUsageState();
  for (let index = 0; index < LATTICE_USAGE_POLICY.globalGrants.limit; index += 1) {
    const now = index * 61_000;
    const granted = acquireDemoLease(globalCapped, {
      now,
      visitorId: visitor(100 + index),
      leaseToken: lease(100 + index),
    });
    globalCapped = releaseDemoLease(granted.state, {
      now,
      leaseToken: lease(100 + index),
    }).state;
  }

  let activeCapped = createUsageState();
  for (let index = 0; index < LATTICE_USAGE_POLICY.activeLeases.limit; index += 1) {
    activeCapped = acquireDemoLease(activeCapped, {
      now: index,
      visitorId: visitor(300 + index),
      leaseToken: lease(300 + index),
    }).state;
  }

  const scenarios = [
    {
      code: "visitor-day-limit",
      state: visitorCapped,
      now: 3_000,
      visitorId: visitor(1),
      leaseToken: lease(500),
    },
    {
      code: "global-day-limit",
      state: globalCapped,
      now: (LATTICE_USAGE_POLICY.globalGrants.limit - 1) * 61_000 + 1,
      visitorId: visitor(500),
      leaseToken: lease(501),
    },
    {
      code: "active-lease-limit",
      state: activeCapped,
      now: 100,
      visitorId: visitor(600),
      leaseToken: lease(600),
    },
  ];

  for (const scenario of scenarios) {
    const alarm = nextUsageExpiry(scenario.state);
    const storage = new InjectedFailureStorage(scenario.state, alarm);
    const outcome = await commitUsageMutation(
      storage,
      "usage-policy-v1",
      (storedState) => acquireDemoLease(storedState, scenario),
    );
    assert.equal(outcome.result.code, scenario.code);
    assert.equal(outcome.stateChanged, false);
    assert.deepEqual(await storage.get("usage-policy-v1"), scenario.state);
    assert.equal(storage.putAttempts, 0);
    assert.equal(storage.deleteAttempts, 0);
    assert.equal(storage.setAlarmAttempts, 0);
    assert.equal(storage.deleteAlarmAttempts, 0);
    assert.equal(storage.alarm, alarm);
  }
});

test("the global rolling day admits one hundred grants and denies the next", () => {
  let state = createUsageState();
  for (let index = 0; index < 100; index += 1) {
    const now = index * 61_000;
    const outcome = acquireDemoLease(state, {
      now,
      visitorId: visitor(index),
      leaseToken: lease(index),
    });
    assert.equal(outcome.result.allowed, true);
    state = releaseDemoLease(outcome.state, { now, leaseToken: lease(index) }).state;
  }
  const denied = acquireDemoLease(state, {
    now: 100 * 61_000,
    visitorId: visitor(101),
    leaseToken: lease(101),
  });
  assert.equal(denied.result.code, "global-day-limit");
});

test("usage state schedules and prunes every application-visible identifier", () => {
  const admitted = admitUsageRequest(createUsageState(), { now: 0 });
  const granted = acquireDemoLease(admitted.state, {
    now: 0,
    visitorId: visitor(1),
    leaseToken: lease(1),
  });
  assert.equal(nextUsageExpiry(granted.state), 60_000);

  const pruned = inspectUsageState(granted.state, 24 * 60 * 60 * 1_000);
  assert.deepEqual(pruned.requestTimes, []);
  assert.deepEqual(pruned.attemptTimes, []);
  assert.deepEqual(pruned.grantTimes, []);
  assert.deepEqual(pruned.visitors, {});
  assert.deepEqual(pruned.leases, {});
  assert.equal(usageStateIsEmpty(pruned), true);
  assert.equal(nextUsageExpiry(pruned), null);
});

test("unknown lease controls are write-free unless they persist real pruning", async () => {
  const granted = acquireDemoLease(createUsageState(), {
    now: 0,
    visitorId: visitor(40),
    leaseToken: lease(40),
  });
  const storage = new InjectedFailureStorage(granted.state, nextUsageExpiry(granted.state));
  const unknown = lease(41);

  const renewal = await commitUsageMutation(
    storage,
    "usage-policy-v1",
    (storedState) => renewDemoLease(storedState, { now: 1_000, leaseToken: unknown }),
  );
  const release = await commitUsageMutation(
    storage,
    "usage-policy-v1",
    (storedState) => releaseDemoLease(storedState, { now: 1_001, leaseToken: unknown }),
  );
  assert.equal(renewal.stateChanged, false);
  assert.equal(release.stateChanged, false);
  assert.equal(storage.putAttempts, 0);
  assert.equal(storage.deleteAttempts, 0);
  assert.equal(storage.setAlarmAttempts, 0);
  assert.equal(storage.deleteAlarmAttempts, 0);

  const pruningRenewal = await commitUsageMutation(
    storage,
    "usage-policy-v1",
    (storedState) => renewDemoLease(storedState, { now: 60_000, leaseToken: unknown }),
  );
  assert.equal(pruningRenewal.stateChanged, true);
  assert.deepEqual(pruningRenewal.state.attemptTimes, []);
  assert.equal(storage.putAttempts, 1);
  assert.equal(storage.setAlarmAttempts, 1);
});

test("an active lease renews without another grant and stops at its absolute lifetime", () => {
  const token = lease(50);
  const granted = acquireDemoLease(createUsageState(), {
    now: 0,
    visitorId: visitor(50),
    leaseToken: token,
  });
  const originalCounts = {
    grants: granted.state.grantTimes.length,
    visitorGrants: granted.state.visitors[visitor(50)].length,
  };
  const active = LATTICE_USAGE_POLICY.activeLeases;
  const immediateRetry = renewDemoLease(granted.state, {
    now: 1_000,
    leaseToken: token,
  });
  assert.equal(immediateRetry.result.code, "lease-renewal-too-soon");
  assert.equal(immediateRetry.stateChanged, false, "a no-op without pruning stays write-free");
  const tooSoon = renewDemoLease(granted.state, {
    now: active.minimumRenewalIntervalSeconds * 1_000 - 1,
    leaseToken: token,
  });
  assert.equal(tooSoon.result.allowed, false);
  assert.equal(tooSoon.result.code, "lease-renewal-too-soon");
  assert.equal(tooSoon.stateChanged, true, "expired attempt history is persisted while renewal is denied");

  let state = granted.state;
  let renewed;
  const maximumRenewals = active.maximumLifetimeSeconds / active.minimumRenewalIntervalSeconds - 1;
  for (let index = 1; index <= maximumRenewals; index += 1) {
    renewed = renewDemoLease(state, {
      now: index * active.minimumRenewalIntervalSeconds * 1_000,
      leaseToken: token,
    });
    assert.equal(renewed.result.allowed, true, `renewal ${index}`);
    assert.ok(renewed.result.expiresAt <= renewed.result.maximumExpiresAt);
    state = renewed.state;
  }
  assert.equal(maximumRenewals, PUBLISHED_LATTICE_USAGE_POLICY.freeTierBasis.maximumRenewalsPerLease);
  assert.equal(renewed.result.expiresAt, active.maximumLifetimeSeconds * 1_000);
  assert.deepEqual({
    grants: state.grantTimes.length,
    visitorGrants: state.visitors[visitor(50)].length,
  }, originalCounts);
  assert.deepEqual(state.attemptTimes, [], "renewal does not create acquisition attempts");

  const expired = renewDemoLease(state, {
    now: active.maximumLifetimeSeconds * 1_000,
    leaseToken: token,
  });
  assert.equal(expired.result.allowed, false);
  assert.equal(expired.result.code, "lease-not-active");
  assert.equal(Object.hasOwn(expired.state.leases, token), false);
});

test("legacy timestamp leases migrate without gaining renewable lifetime", () => {
  const expiresAt = 10_000;
  const migrated = copyUsageState({
    version: 1,
    attemptTimes: [],
    grantTimes: [],
    visitors: {},
    leases: { [lease(60)]: expiresAt },
  }, 1_000);
  assert.equal(migrated.version, 4);
  assert.deepEqual(migrated.requestTimes, []);
  assert.deepEqual(migrated.admissionDay, {
    startedAt: 0,
    count: LATTICE_USAGE_POLICY.globalDailyRequests.limit,
  });
  assert.equal(migrated.leases[lease(60)].visitorId, null);
  assert.equal(migrated.leases[lease(60)].expiresAt, expiresAt);
  assert.equal(migrated.leases[lease(60)].maximumExpiresAt, expiresAt);
});

test("version-two lease records migrate as safely ownerless", () => {
  const migrated = copyUsageState({
    version: 2,
    attemptTimes: [1],
    grantTimes: [1],
    visitors: { [visitor(61)]: [1] },
    leases: {
      [lease(61)]: {
        startedAt: 1,
        lastRenewedAt: 1,
        expiresAt: 10_000,
        maximumExpiresAt: 20_000,
      },
    },
  }, 2);
  assert.equal(migrated.version, 4);
  assert.deepEqual(migrated.requestTimes, []);
  assert.deepEqual(migrated.admissionDay, {
    startedAt: 0,
    count: LATTICE_USAGE_POLICY.globalDailyRequests.limit,
  });
  assert.equal(migrated.leases[lease(61)].visitorId, null);
  assert.equal(migrated.leases[lease(61)].maximumExpiresAt, 20_000);

  const blocked = acquireDemoLease(migrated, {
    now: 2,
    visitorId: visitor(62),
    leaseToken: lease(62),
  });
  assert.equal(blocked.result.allowed, false);
  assert.equal(blocked.result.code, "active-lease-migration");
  assert.equal(blocked.result.retryAfterSeconds, 10);
  assert.equal(blocked.state.attemptTimes.length, 1,
    "ownerless legacy leases cannot make a new visitor consume grant pace");

  const released = releaseDemoLease(blocked.state, {
    now: 3,
    leaseToken: lease(61),
  });
  const replacement = acquireDemoLease(released.state, {
    now: 4,
    visitorId: visitor(62),
    leaseToken: lease(62),
  });
  assert.equal(replacement.result.allowed, true);
});

test("version-three state migrates without losing request or lease ownership state", () => {
  const legacyState = {
    version: 3,
    requestTimes: [1, 2],
    attemptTimes: [2],
    grantTimes: [2],
    visitors: { [visitor(63)]: [2] },
    leases: {
      [lease(63)]: {
        visitorId: visitor(63),
        startedAt: 2,
        lastRenewedAt: 2,
        expiresAt: 10_000,
        maximumExpiresAt: 20_000,
      },
    },
  };
  const migrated = copyUsageState(legacyState, 2);
  assert.equal(migrated.version, 4);
  assert.deepEqual(migrated.requestTimes, [1, 2]);
  assert.deepEqual(migrated.admissionDay, {
    startedAt: 0,
    count: LATTICE_USAGE_POLICY.globalDailyRequests.limit,
  }, "unknown prior-day use fails closed until the next UTC boundary");
  assert.equal(migrated.leases[lease(63)].visitorId, visitor(63));

  const denied = admitUsageRequest(legacyState, { now: 2 });
  assert.equal(denied.result.code, "global-request-day-limit");
  assert.equal(denied.stateChanged, true,
    "the saturated migration marker is persisted instead of resetting on replay");
  const rollover = admitUsageRequest(denied.state, {
    now: LATTICE_USAGE_POLICY.globalDailyRequests.windowSeconds * 1_000,
  });
  assert.equal(rollover.result.allowed, true);
  assert.throws(
    () => copyUsageState(legacyState),
    /migrationNow/u,
    "legacy use cannot be migrated without an authoritative day boundary",
  );
});

test("version-four copying preserves the UTC-day counter and rejects reset-shaped state", () => {
  const state = {
    version: 4,
    requestTimes: [1, 2],
    admissionDay: { startedAt: 0, count: 2_345 },
    attemptTimes: [],
    grantTimes: [],
    visitors: {},
    leases: {},
  };
  assert.deepEqual(copyUsageState(state).admissionDay, state.admissionDay);
  assert.deepEqual(inspectUsageState(state, 1_000).admissionDay, state.admissionDay);

  for (const admissionDay of [
    undefined,
    {},
    { startedAt: 1, count: 1 },
    { startedAt: 0, count: 0 },
    { startedAt: 0, count: -1 },
    { startedAt: 0, count: 1.5 },
  ]) {
    const candidate = { ...state };
    if (admissionDay === undefined) delete candidate.admissionDay;
    else candidate.admissionDay = admissionDay;
    assert.throws(() => copyUsageState(candidate), /admissionDay/u);
  }

  assert.throws(
    () => inspectUsageState({
      ...state,
      admissionDay: { startedAt: 24 * 60 * 60 * 1_000, count: 1 },
    }, 1_000),
    /cannot begin after the current UTC day/u,
    "a clock rollback cannot silently clear a future-day counter",
  );

  const rollbackCases = [
    { requestTimes: [1_001] },
    { attemptTimes: [1_001] },
    { grantTimes: [1_001] },
    { visitors: { [visitor(64)]: [1_001] } },
    {
      leases: {
        [lease(64)]: {
          visitorId: visitor(64),
          startedAt: 1_001,
          lastRenewedAt: 1_001,
          expiresAt: 10_000,
          maximumExpiresAt: 20_000,
        },
      },
    },
  ];
  for (const rollback of rollbackCases) {
    assert.throws(
      () => inspectUsageState({ ...state, ...rollback }, 1_000),
      /future/u,
      "same-day clock rollback cannot silently erase quota or ownership history",
    );
  }
});

test("the browser lease adapter cannot accept or transmit source text or a body", async () => {
  const source = await readFile(
    new URL("../app/resume/lattice/usageLease.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /export async function acquireLatticeLease\(signal, obtainAttestation\)/u);
  assert.match(source, /export async function renewLatticeLease\(lease, signal\)/u);
  assert.doesNotMatch(source, /body\s*:/u);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/iu);
  assert.match(source, /referrerPolicy: "no-referrer"/u);
  assert.match(source, /matchesPublishedPolicy\(body\?\.policy\)/u);
});

test("the browser preserves bounded quota retry timing for the UI ETA", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      allowed: false,
      code: "global-day-limit",
      retryAfterSeconds: 999_999,
    }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "999999" },
    });
    await assert.rejects(
      acquireLatticeLease(new AbortController().signal),
      (error) => error instanceof LatticeLeaseError
        && error.code === "global-day-limit"
        && error.limited === true
        && error.retryAfterSeconds === PUBLISHED_LATTICE_USAGE_POLICY.visitor.windowSeconds + 60,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the UTC-day admission denial remains a limited response with its reset ETA", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      allowed: false,
      code: "global-request-day-limit",
      retryAfterSeconds: 43_200,
      policy: PUBLISHED_LATTICE_USAGE_POLICY,
    }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "43200" },
    });
    await assert.rejects(
      acquireLatticeLease(new AbortController().signal),
      (error) => error instanceof LatticeLeaseError
        && error.code === "global-request-day-limit"
        && error.limited === true
        && error.retryAfterSeconds === 43_200,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retry timing conservatively reconciles JSON, delta-seconds, and HTTP-date", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const now = Date.UTC(2026, 8, 8, 12, 0, 0);
  Date.now = () => now;
  const cases = [
    {
      body: JSON.stringify({ allowed: false, code: "rate_limited", retryAfterSeconds: 5 }),
      contentType: "application/json",
      header: "37",
      expected: 37,
    },
    {
      body: JSON.stringify({ allowed: false, code: "rate_limited", retryAfterSeconds: "999" }),
      contentType: "application/json",
      header: new Date(now + 120_000).toUTCString(),
      expected: 120,
    },
    {
      body: JSON.stringify({ allowed: false, code: "rate_limited" }),
      contentType: "application/json",
      date: new Date(now - 3_600_000).toUTCString(),
      header: new Date(now - 3_480_000).toUTCString(),
      expected: 120,
    },
    {
      body: "{not-json",
      contentType: "application/json",
      header: "11",
      expected: 11,
    },
    {
      body: "{not-json",
      contentType: "application/json",
      header: "0000000000000001",
      expected: 1,
    },
    {
      body: "{not-json",
      contentType: "application/json",
      header: "0000000000000000",
      expected: 0,
    },
    {
      body: "unstructured",
      contentType: "text/plain",
      header: "Sun, 01 Jan 1899 00:00:00 GMT",
      expected: 60,
    },
    {
      body: "unstructured",
      contentType: "text/plain",
      header: "Sun Jan  1 00:00:00 1899",
      expected: 60,
    },
    {
      body: JSON.stringify({ allowed: false, code: "rate_limited", retryAfterSeconds: 43 }),
      contentType: "application/json",
      header: "not-a-retry-time",
      expected: 43,
    },
    {
      body: JSON.stringify({ allowed: false, code: "rate_limited", retryAfterSeconds: 7 }),
      contentType: "application/json",
      header: "Mon, 31 Feb 2026 00:00:00 GMT",
      expected: 7,
    },
    {
      body: "unstructured",
      contentType: "text/plain",
      header: "invalid",
      expected: 60,
    },
  ];
  try {
    for (const scenario of cases) {
      globalThis.fetch = async () => new Response(scenario.body, {
        status: 429,
        headers: {
          "Content-Type": scenario.contentType,
          "Retry-After": scenario.header,
          ...(scenario.date ? { Date: scenario.date } : {}),
        },
      });
      await assert.rejects(
        acquireLatticeLease(new AbortController().signal),
        (error) => error instanceof LatticeLeaseError
          && error.limited === true
          && error.retryAfterSeconds === scenario.expected,
        `Retry-After ${scenario.header}`,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("Retry-After accepts each exact HTTP-date grammar and leap-second boundary", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const now = Date.UTC(2026, 8, 8, 12, 0, 0);
  const maximum = PUBLISHED_LATTICE_USAGE_POLICY.visitor.windowSeconds + 60;
  Date.now = () => now;
  const cases = [
    ["Tue, 08 Sep 2026 12:00:00 GMT", 0],
    ["Tue, 08 Sep 2026 12:02:00 GMT", 120],
    ["Tuesday, 08-Sep-26 12:02:00 GMT", 120],
    ["Tue Sep  8 12:02:00 2026", 120],
    ["Tue Sep 08 12:02:00 2026", 120],
    ["Tue, 08 Sep 2026 12:00:60 GMT", 60],
    ["Tuesday, 08-Sep-26 12:00:60 GMT", 60],
    ["Tue Sep  8 12:00:60 2026", 60],
    ["Wed, 09 Sep 2026 12:01:00 GMT", maximum],
    ["Wed, 09 Sep 2026 12:01:01 GMT", maximum],
  ];
  try {
    for (const [header, expected] of cases) {
      globalThis.fetch = async () => new Response(JSON.stringify({
        allowed: false,
        code: "rate_limited",
        retryAfterSeconds: 0,
      }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": header },
      });
      await assert.rejects(
        acquireLatticeLease(new AbortController().signal),
        (error) => error instanceof LatticeLeaseError
          && error.limited === true
          && error.retryAfterSeconds === expected,
        header,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("obsolete two-digit dates apply the 50-year rule to the full calendar timestamp", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const maximum = PUBLISHED_LATTICE_USAGE_POLICY.visitor.windowSeconds + 60;
  async function expectRetry(header, expected) {
    globalThis.fetch = async () => new Response(JSON.stringify({
      allowed: false,
      code: "rate_limited",
      retryAfterSeconds: 1,
    }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": header },
    });
    await assert.rejects(
      acquireLatticeLease(new AbortController().signal),
      (error) => error instanceof LatticeLeaseError
        && error.retryAfterSeconds === expected,
      header,
    );
  }
  try {
    Date.now = () => Date.UTC(2026, 8, 8, 12, 0, 0, 500);
    await expectRetry("Tuesday, 08-Sep-76 12:00:00 GMT", maximum);
    await expectRetry("Wednesday, 08-Sep-76 12:00:01 GMT", 1);

    Date.now = () => Date.UTC(2024, 1, 29, 12, 0, 0);
    await expectRetry("Wednesday, 28-Feb-74 12:00:00 GMT", maximum);
    await expectRetry("Friday, 01-Mar-74 00:00:00 GMT", 1);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("HTTP-date retry parsing rejects altered spacing, calendars, clocks, and weekdays", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const now = Date.UTC(2026, 8, 8, 12, 0, 0);
  Date.now = () => now;
  const malformed = [
    "Mon, 08 Sep 2026 12:02:00 GMT",
    "Monday, 08-Sep-26 12:02:00 GMT",
    "Mon Sep  8 12:02:00 2026",
    "Sun, 29 Feb 2026 12:02:00 GMT",
    "Tue, 08 Sep 2026 24:00:00 GMT",
    "Tue, 08 Sep 2026 12:60:00 GMT",
    "Tue, 08 Sep 2026 12:00:61 GMT",
    "Tue, 8 Sep 2026 12:02:00 GMT",
    "Tue,  08 Sep 2026 12:02:00 GMT",
    "Tue, 08  Sep 2026 12:02:00 GMT",
    "Tue, 08 Sep 2026 12:02:00  GMT",
    "Tuesday, 8-Sep-26 12:02:00 GMT",
    "Tue Sep 8 12:02:00 2026",
    "Tue Sep   8 12:02:00 2026",
    "Tue\tSep  8 12:02:00 2026",
    "Tue, 08 Sep 2026 12:02:00 utc",
    "Sat, 01 Jan 0000 00:00:00 GMT",
  ];
  try {
    for (const header of malformed) {
      globalThis.fetch = async () => new Response(JSON.stringify({
        allowed: false,
        code: "rate_limited",
        retryAfterSeconds: 7,
      }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": header },
      });
      await assert.rejects(
        acquireLatticeLease(new AbortController().signal),
        (error) => error instanceof LatticeLeaseError
          && error.retryAfterSeconds === 7,
        header,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("release honors bounded 429 timing without exceeding its per-lease shaper", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const waits = [];
  try {
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });
      if (requests.length < 3) {
        return new Response(JSON.stringify({
          allowed: false,
          code: "global-request-minute-limit",
          retryAfterSeconds: 1,
        }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "2" },
        });
      }
      return new Response(null, { status: 204 });
    };
    assert.equal(await releaseLatticeLease(lease(72), {
      wait: async (milliseconds) => { waits.push(milliseconds); },
    }), true);
    assert.equal(requests.length, 3);
    assert.deepEqual(waits, [2_000, 2_000]);
    assert.ok(requests.every(({ options }) => (
      options.method === "DELETE"
      && options.body === undefined
      && options.keepalive === true
    )));
    assert.ok(
      requests.length < PUBLISHED_LATTICE_USAGE_POLICY.enforcement.releaseLeaseLocationShaper.limit,
      "cleanup retries leave one per-lease shaper call in reserve",
    );
    assert.equal(await releaseLatticeLease(lease(72)), true);
    assert.equal(requests.length, 3,
      "repeated cleanup for one credential reuses the bounded operation window");

    requests.length = 0;
    waits.length = 0;
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });
      return new Response("limited", {
        status: 429,
        headers: { "Content-Type": "text/plain", "Retry-After": "61" },
      });
    };
    assert.equal(await releaseLatticeLease(lease(73), {
      wait: async (milliseconds) => { waits.push(milliseconds); },
    }), false);
    assert.equal(requests.length, 1, "cleanup does not retain work beyond one minute");
    assert.deepEqual(waits, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an unfamiliar JSON 429 remains a quota denial with a UI ETA", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      allowed: false,
      code: "rate_limited",
      retryAfterSeconds: 19,
    }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "19" },
    });
    await assert.rejects(
      acquireLatticeLease(new AbortController().signal),
      (error) => error instanceof LatticeLeaseError
        && error.code === "rate_limited"
        && error.limited === true
        && error.message === "Text to Lattice is busy right now. Your text stayed here."
        && error.retryAfterSeconds === 19,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an unfamiliar renewal 429 remains a quota denial with a bounded ETA", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      allowed: false,
      code: "renewal_rate_limited",
      retryAfterSeconds: 23,
    }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "23" },
    });
    await assert.rejects(
      renewBrowserLease({
        token: lease(71),
        maximumExpiresAt: Date.now() + PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.maximumLifetimeSeconds * 1_000,
      }, new AbortController().signal),
      (error) => error instanceof LatticeLeaseError
        && error.code === "renewal_rate_limited"
        && error.limited === true
        && error.message === "Text to Lattice is busy right now. The run remains active."
        && error.retryAfterSeconds === 23,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("lease responses stop at the declared or streamed byte ceiling", async () => {
  let declaredCanceled = false;
  const declaredOversize = {
    headers: new Headers({ "Content-Type": "application/json", "Content-Length": "16385" }),
    body: { cancel: async () => { declaredCanceled = true; } },
  };
  assert.equal(await boundedLatticeLeaseResponseBody(declaredOversize), null);
  await Promise.resolve();
  assert.equal(declaredCanceled, true);

  let streamedCanceled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(10_000));
      controller.enqueue(new Uint8Array(10_000));
    },
    cancel() {
      streamedCanceled = true;
    },
  });
  const chunkedOversize = new Response(stream, { headers: { "Content-Type": "application/json; charset=utf-8" } });
  assert.equal(await boundedLatticeLeaseResponseBody(chunkedOversize), null);
  assert.equal(streamedCanceled, true);
});

test("a non-JSON edge denial still preserves its bounded retry estimate", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("slow down", {
      status: 429,
      headers: { "Content-Type": "text/plain", "Retry-After": "37" },
    });
    await assert.rejects(
      acquireLatticeLease(new AbortController().signal),
      (error) => error instanceof LatticeLeaseError
        && error.code === "edge-rate-limit"
        && error.limited === true
        && error.retryAfterSeconds === 37,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the browser obtains one bounded attestation without sending prose or a body", async () => {
  const originalFetch = globalThis.fetch;
  const now = Date.now();
  const token = "0.provider+/token=:~";
  const calls = [];
  try {
    globalThis.fetch = async (_url, options) => {
      calls.push(options);
      if (calls.length === 1) {
        return new Response(JSON.stringify({
          allowed: false,
          code: "attestation-required",
          attestationSiteKey: "0x4AAAA-test-site-key",
        }), { status: 428, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        allowed: true,
        leaseToken: lease(70),
        expiresAt: now + PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.ttlSeconds * 1_000,
        maximumExpiresAt: now + PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.maximumLifetimeSeconds * 1_000,
        leaseSecondsRemaining: PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.ttlSeconds,
        policy: PUBLISHED_LATTICE_USAGE_POLICY,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    let siteKey;
    await acquireLatticeLease(new AbortController().signal, async (value) => {
      siteKey = value;
      return token;
    });
    assert.equal(siteKey, "0x4AAAA-test-site-key");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].body, undefined);
    assert.equal(calls[1].body, undefined);
    assert.equal(calls[0].headers["X-Lattice-Attestation"], undefined);
    assert.equal(calls[1].headers["X-Lattice-Attestation"], token);
    assert.doesNotMatch(JSON.stringify(calls), /source|prompt|candidate|result/iu);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("browser heartbeat is an authenticated bodyless PATCH with a conservative deadline", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const now = 1_000_000;
  const token = lease(70);
  const maximumExpiresAt = now + PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.maximumLifetimeSeconds * 1_000;
  let request;
  try {
    Date.now = () => now;
    globalThis.fetch = async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        allowed: true,
        leaseToken: token,
        expiresAt: now + PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.ttlSeconds * 1_000,
        maximumExpiresAt,
        leaseSecondsRemaining: PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.ttlSeconds,
        policy: PUBLISHED_LATTICE_USAGE_POLICY,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const renewed = await renewBrowserLease({
      token,
      expiresAt: now + 1_000,
      maximumExpiresAt,
      serverExpiresAt: now + 1_000,
      serverMaximumExpiresAt: maximumExpiresAt,
      policy: PUBLISHED_LATTICE_USAGE_POLICY,
    }, new AbortController().signal);
    assert.equal(request.url, PUBLISHED_LATTICE_USAGE_POLICY.endpoint);
    assert.equal(request.options.method, "PATCH");
    assert.equal(request.options.body, undefined);
    assert.equal(request.options.headers.Authorization, `Bearer ${token}`);
    assert.equal(request.options.referrerPolicy, "no-referrer");
    assert.equal(renewed.expiresAt, now + PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.ttlSeconds * 1_000);
    assert.ok(renewed.expiresAt <= renewed.maximumExpiresAt);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("the published usage contract matches every enforced quota", () => {
  assert.equal(PUBLISHED_LATTICE_USAGE_POLICY.version, LATTICE_USAGE_POLICY.version);
  for (const field of [
    "visitor",
    "globalRequests",
    "globalDailyRequests",
    "globalAttempts",
    "globalGrants",
  ]) {
    assert.equal(PUBLISHED_LATTICE_USAGE_POLICY[field].limit, LATTICE_USAGE_POLICY[field].limit, `${field} limit`);
    assert.equal(PUBLISHED_LATTICE_USAGE_POLICY[field].windowSeconds, LATTICE_USAGE_POLICY[field].windowSeconds, `${field} window`);
  }
  assert.equal(
    PUBLISHED_LATTICE_USAGE_POLICY.globalRequests.applicationRetentionTargetSeconds,
    PUBLISHED_LATTICE_USAGE_POLICY.globalRequests.windowSeconds + 60,
  );
  assert.equal(
    PUBLISHED_LATTICE_USAGE_POLICY.globalAttempts.applicationRetentionTargetSeconds,
    PUBLISHED_LATTICE_USAGE_POLICY.globalAttempts.windowSeconds + 60,
  );
  assert.equal(PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.limit, LATTICE_USAGE_POLICY.activeLeases.limit);
  assert.equal(PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.perVisitorLimit, 1);
  assert.equal(PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.ttlSeconds, LATTICE_USAGE_POLICY.activeLeases.ttlSeconds);
  assert.equal(PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.renewalIntervalSeconds, LATTICE_USAGE_POLICY.activeLeases.renewalIntervalSeconds);
  assert.equal(PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.minimumRenewalIntervalSeconds, LATTICE_USAGE_POLICY.activeLeases.minimumRenewalIntervalSeconds);
  assert.equal(PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.maximumLifetimeSeconds, LATTICE_USAGE_POLICY.activeLeases.maximumLifetimeSeconds);
  assert.deepEqual(PUBLISHED_LATTICE_USAGE_POLICY.enforcement.edgeFloodProtection, {
    plan: "Cloudflare Free",
    path: "/api/text-to-lattice/lease",
    characteristic: "IP",
    limit: 48,
    windowSeconds: 10,
    mitigationSeconds: 10,
    requiredBeforeDeployment: false,
    releaseBoundary: "recommended operational hardening; deferred from the bounded demonstrable release under GATE-03",
    availabilityUrl: "https://developers.cloudflare.com/waf/rate-limiting-rules/#availability",
    role: "best-effort single-IP flood protection; not an anti-bot control, slot-starvation control, or exact global accounting authority",
  });
});

test("the UI acquires before model work and enforces the returned lease expiry", async () => {
  const source = await readFile(
    new URL("../app/resume/ResumeProjects.tsx", import.meta.url),
    "utf8",
  );
  const executeStart = source.indexOf("const executeLattice");
  const acquireAt = source.indexOf("await acquireLatticeLease(", executeStart);
  const adapterAt = source.indexOf("createLocalLatticeAdapter", acquireAt);
  assert.ok(executeStart >= 0 && acquireAt > executeStart, "lease acquisition is inside executeLattice");
  assert.ok(adapterAt > acquireAt, "lease acquisition precedes model adapter creation");
  assert.match(source, /latticeLeaseRef\.current\.expiresAt <= Date\.now\(\)/u);
  assert.match(source, /lease\.expiresAt - Date\.now\(\)/u);
  assert.match(source, /renewLatticeLease\(currentLease, controller\.signal\)/u);
  assert.match(source, /isLatticeQuotaLimit\(error\)/u);
  assert.match(source, /error\.retryAfterSeconds \* 1_000/u);
  assert.match(source, /latticeRetryPending/u);
  assert.match(source, /latticeRetryEta\(latticeRetryAt, latticeRetryClock, undefined, latticeRetryMode\)/u);
  assert.match(source, /clearInterval\(latticeLeaseHeartbeatTimerRef\.current\)/u);
  assert.match(source, /clearTimeout\(latticeLeaseRenewalRetryTimerRef\.current\)/u);
  const heartbeatAt = source.indexOf("const armLatticeLeaseHeartbeat");
  const cancelAt = source.indexOf("const cancelLattice", heartbeatAt);
  const heartbeatSource = source.slice(heartbeatAt, cancelAt);
  assert.match(heartbeatSource, /if \(isLatticeQuotaLimit\(error\)\)/u);
  assert.match(heartbeatSource, /latticeLeaseRenewalRetryTimerRef\.current !== null/u);
  assert.match(heartbeatSource, /setLatticeRetryAt\(retryAt\)/u);
  assert.match(heartbeatSource, /setTimeout\(\(\) => \{[\s\S]*?renewCurrentLease\(\)/u);
  assert.match(source, /clearLatticeLeaseHeartbeat\(\)/u);
  assert.match(source, /controller\?\.abort\(\)/u);
  assert.match(source, /expireCurrentLatticeLease\(lease\.token\)/u);
  const expiryStart = source.indexOf("const expireCurrentLatticeLease");
  const expiryEnd = source.indexOf("const armLatticeLeaseExpiry", expiryStart);
  const expirySource = source.slice(expiryStart, expiryEnd);
  assert.match(expirySource, /setLatticeRetryAt\(null\)/u);
  assert.match(expirySource, /setLatticeRetryMode\("manual"\)/u);
  const runAt = source.indexOf("await runTextToLattice", adapterAt);
  const finalLeaseAt = source.indexOf("const currentLease = latticeLeaseRef.current", runAt);
  const publishAt = source.indexOf("setLatticeResult(result)", runAt);
  assert.ok(runAt > adapterAt && finalLeaseAt > runAt && publishAt > finalLeaseAt,
    "the active lease is rechecked after inference and before result publication");
  assert.match(
    source.slice(finalLeaseAt, publishAt),
    /currentLease\.token !== leaseToken \|\| currentLease\.expiresAt <= Date\.now\(\)/u,
  );
});

test("the canonical no-JavaScript contract exposes the usage-policy section", async () => {
  const source = await readFile(
    new URL("../app/projects/lattice/text-to-lattice/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /id="text-to-lattice-usage"/u);
  assert.match(source, /policy\.globalRequests\.limit/u);
  assert.match(source, /policy\.globalDailyRequests\.limit/u);
  assert.match(source, /policy\.globalAttempts\.limit/u);
  assert.match(source, /policy\.globalGrants\.limit/u);
  assert.match(source, /policy\.activeLeases\.limit/u);
  assert.match(source, /policy\.activeLeases\.perVisitorLimit/u);
  assert.match(source, /policy\.enforcement\.exactRequestAdmission\.role/u);
  assert.match(source, /policy\.enforcement\.exactDailyRequestAdmission\.role/u);
  assert.match(source, /policy\.enforcement\.pathLocationShaper\.limit/u);
  assert.match(source, /policy\.enforcement\.leaseCredential\.format/u);
  assert.match(source, /policy\.enforcement\.leaseCredential\.keyManagement/u);
  assert.match(source, /policy\.enforcement\.renewalLeaseLocationShaper\.limit/u);
  assert.match(source, /policy\.enforcement\.releaseLeaseLocationShaper\.limit/u);
  assert.match(source, /policy\.freeTierBasis\.workerRequestsPerDay/u);
  assert.match(source, /policy\.freeTierBasis\.durableObjectGigabyteSecondsPerDay/u);
  assert.match(source, /security\.api\.rules\.map/u);
  assert.match(source, /policy\.failureMode/u);
});

test("the production route layers independent local shapers before the exact global gate", async () => {
  const [
    configText,
    workerSource,
    usageStorageSource,
    visitorCookieSource,
    gitignore,
    workerReadme,
    releaseRegisterSource,
  ] = await Promise.all([
    readFile(new URL("../workers/text-to-lattice-lease/wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../workers/text-to-lattice-lease/worker.js", import.meta.url), "utf8"),
    readFile(new URL("../workers/text-to-lattice-lease/usageStorage.js", import.meta.url), "utf8"),
    readFile(new URL("../workers/text-to-lattice-lease/visitorCookie.js", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
    readFile(new URL("../workers/text-to-lattice-lease/README.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json", import.meta.url), "utf8"),
  ]);
  const config = JSON.parse(configText);
  assert.deepEqual(config.routes, [{
    pattern: "hah.dev/api/text-to-lattice/lease",
    zone_name: "hah.dev",
  }]);
  assert.equal(config.ratelimits.length, 7);
  const ratelimits = new Map(config.ratelimits.map((item) => [item.name, item]));
  const ingressPolicy = PUBLISHED_LATTICE_USAGE_POLICY.enforcement.ingressLocationShaper;
  const pathPolicy = PUBLISHED_LATTICE_USAGE_POLICY.enforcement.pathLocationShaper;
  const acquirePolicy = PUBLISHED_LATTICE_USAGE_POLICY.enforcement.locationShaper;
  const releasePolicy = PUBLISHED_LATTICE_USAGE_POLICY.enforcement.releaseLocationShaper;
  const renewalPolicy = PUBLISHED_LATTICE_USAGE_POLICY.enforcement.renewalLocationShaper;
  const releaseLeasePolicy = PUBLISHED_LATTICE_USAGE_POLICY.enforcement.releaseLeaseLocationShaper;
  const renewalLeasePolicy = PUBLISHED_LATTICE_USAGE_POLICY.enforcement.renewalLeaseLocationShaper;
  assert.deepEqual(ratelimits.get(ingressPolicy.binding)?.simple, {
    limit: ingressPolicy.limit,
    period: ingressPolicy.windowSeconds,
  });
  assert.deepEqual(ratelimits.get(acquirePolicy.binding)?.simple, {
    limit: acquirePolicy.limit,
    period: acquirePolicy.windowSeconds,
  });
  assert.deepEqual(ratelimits.get(releasePolicy.binding)?.simple, {
    limit: releasePolicy.limit,
    period: releasePolicy.windowSeconds,
  });
  assert.deepEqual(ratelimits.get(renewalPolicy.binding)?.simple, {
    limit: renewalPolicy.limit,
    period: renewalPolicy.windowSeconds,
  });
  assert.deepEqual(ratelimits.get(releaseLeasePolicy.binding)?.simple, {
    limit: releaseLeasePolicy.limit,
    period: releaseLeasePolicy.windowSeconds,
  });
  assert.deepEqual(ratelimits.get(renewalLeasePolicy.binding)?.simple, {
    limit: renewalLeasePolicy.limit,
    period: renewalLeasePolicy.windowSeconds,
  });
  assert.deepEqual(ratelimits.get(pathPolicy.binding)?.simple, {
    limit: pathPolicy.limit,
    period: pathPolicy.windowSeconds,
  });
  assert.equal(new Set(config.ratelimits.map(({ name }) => name)).size, 7,
    "each configured shaper binding name is unique");
  assert.equal(new Set(config.ratelimits.map(({ namespace_id: namespaceId }) => namespaceId)).size, 7,
    "ingress, method, per-lease, and combined-path counters require independent namespaces");
  assert.deepEqual(config.migrations, [{
    tag: "v1",
    new_sqlite_classes: ["LatticeUsageGate"],
  }], "direct storage operations participate in transactions only because this gate is SQLite-backed");
  assert.equal(config.preview_urls, false);
  assert.equal(config.send_metrics, false);
  assert.equal(config.observability.enabled, false);
  assert.equal(config.vars, undefined, "production signing material is not stored in Wrangler vars");
  assert.doesNotMatch(
    configText,
    /"(?:VISITOR_COOKIE_SECRET|LEASE_CREDENTIAL_SECRET|TURNSTILE_SECRET_KEY)"\s*:/u,
    "Wrangler configuration contains no plaintext secret binding values",
  );
  assert.match(gitignore, /^\.dev\.vars\*$/mu);
  assert.match(gitignore, /^\.env\*$/mu);
  assert.match(workerReadme, /secret put VISITOR_COOKIE_SECRET/u);
  assert.match(workerReadme, /secret put LEASE_CREDENTIAL_SECRET/u);
  assert.match(workerReadme, /secret put TURNSTILE_SECRET_KEY/u);
  assert.match(workerReadme, /Cloudflare encrypted Worker\s+bindings/u);
  assert.match(workerReadme, /official testing profile[\s\S]*?exact reusable dummy[\s\S]*?no such assurance/iu);
  assert.doesNotMatch(workerReadme, /Every acquisition also requires a fresh Cloudflare Turnstile attestation/u);
  assert.match(workerReadme, /protected\s+`text-to-lattice-production` GitHub environment[\s\S]*?environment secret/u);
  assert.match(workerReadme, /Preserve the exact verifier-use, converted-model, and WASM evidence and\s+residual-risk dispositions/u);
  assert.match(workerReadme, /only when\s+no gate is `open-release-blocker`/u);
  assert.match(workerReadme, /accepted residual risk and bounded\s+post-deployment verification remain explicit/u);
  const releaseRegister = JSON.parse(releaseRegisterSource);
  for (const id of ["GATE-04A", "GATE-04B", "GATE-04C"]) {
    const gate = releaseRegister.gates.find((entry) => entry.id === id);
    assert.deepEqual({ status: gate?.status, marginalValue: gate?.marginalValue }, {
      status: "accepted-residual-risk",
      marginalValue: "moderate",
    });
  }

  const publicHandlerAt = workerSource.indexOf("async function publicHandler");
  const ingressAt = workerSource.indexOf("await shapeLatticeIngressRequest(env)", publicHandlerAt);
  const queryAt = workerSource.indexOf("if (url.search)", publicHandlerAt);
  const verifyAt = workerSource.indexOf("await verifyLeaseCredential(", publicHandlerAt);
  const rejectAt = workerSource.indexOf("rejectUnsafeRequest(request, PUBLIC_ORIGIN)");
  const secretsAt = workerSource.indexOf("requiredSigningSecrets(env)");
  const shapeAt = workerSource.indexOf("shapeLatticeUsageRequest(");
  const challengeAt = workerSource.indexOf("const challengeResponse = jsonResponse(428", publicHandlerAt);
  const attestAt = workerSource.indexOf("await verifyLatticeAttestation(");
  const gateAt = workerSource.indexOf("env.LATTICE_USAGE_GATE.getByName");
  const admitAt = workerSource.indexOf("const admissionDenial = await admitGlobalRequest(gate)");
  const firstControlActionAt = workerSource.indexOf('if (request.method === "DELETE")', admitAt);
  const acquireGateAt = workerSource.indexOf("const gateResponse = await gate.fetch");
  const gateAcquireBranchAt = workerSource.indexOf('if (url.pathname === "/acquire"');
  const gateCookieSignAt = workerSource.indexOf("const refreshedCookie = await signedVisitorValue");
  const gateMutationAt = workerSource.indexOf("const outcome = await commitUsageMutation", gateAcquireBranchAt);
  const gateLeaseSignAt = workerSource.indexOf("const leaseCredential = await createLeaseCredential", gateMutationAt);
  const gateDecisionAt = workerSource.indexOf("...acquireDemoLease(", gateCookieSignAt);
  const externalizeAt = workerSource.indexOf("async function externalizeLeaseResponse");
  const allowedResponseAt = workerSource.indexOf("if (result.allowed !== true)", externalizeAt);
  const internalCredentialAt = workerSource.indexOf("const publicLeaseCredential = leaseCredential", externalizeAt);
  const externalizeVerifyAt = workerSource.indexOf("await verifyLeaseCredential(", internalCredentialAt);
  assert.ok(ingressAt > publicHandlerAt && queryAt > ingressAt,
    "the exact route is shed before query, method, body, or configuration work");
  assert.ok(rejectAt >= 0 && secretsAt > rejectAt && shapeAt > secretsAt,
    "malformed actionable requests fail before configuration and downstream shaping");
  assert.ok(shapeAt >= 0 && challengeAt > shapeAt,
    "location shaping precedes the cheap acquisition challenge");
  assert.ok(
    challengeAt >= 0
      && gateAt > challengeAt
      && admitAt > gateAt
      && firstControlActionAt > admitAt
      && attestAt > admitAt,
    "the cheap challenge avoids the singleton; exact admission precedes every action and Siteverify",
  );
  assert.doesNotMatch(workerSource.slice(challengeAt, gateAt), /gate\.fetch|Siteverify/iu,
    "challenge establishment performs neither singleton nor Siteverify work");
  assert.ok(verifyAt >= 0 && verifyAt < shapeAt,
    "lease-control credentials are cryptographically validated before control shaping");
  assert.match(workerSource, /shapeLatticeUsageRequest\([\s\S]*?verifiedLease\?\.leaseId/u);
  assert.ok(attestAt > admitAt && attestAt < acquireGateAt,
    "Siteverify follows the cheap challenge and exact request admission, then precedes grant accounting");
  assert.doesNotMatch(workerSource.slice(attestAt, acquireGateAt), /createLeaseCredential/u,
    "the outer Worker does not anchor a credential before the authoritative decision");
  assert.ok(
    gateMutationAt >= 0
      && gateCookieSignAt > gateMutationAt
      && gateLeaseSignAt > gateCookieSignAt
      && gateDecisionAt > gateLeaseSignAt,
    "the Durable Object signs both credentials inside the transaction before its acquisition decision",
  );
  assert.match(
    workerSource.slice(gateLeaseSignAt, gateDecisionAt + 200),
    /expiresAt: decisionNow[\s\S]*?maximumLifetimeSeconds[\s\S]*?now: decisionNow/u,
    "the signed bearer and lease maximum use the same authoritative timestamp",
  );
  assert.ok(
    allowedResponseAt > externalizeAt
      && internalCredentialAt > allowedResponseAt
      && externalizeVerifyAt > internalCredentialAt,
    "the response externalizer verifies the private credential only for an allowed result",
  );
  assert.match(workerSource.slice(acquireGateAt), /externalizeLeaseResponse\(gateResponse,[\s\S]*?leaseCredentialSecret/u);
  assert.match(workerSource, /turnstileSecretKey,[\s\S]*?turnstileSiteKey,[\s\S]*?\} = requiredSigningSecrets\(env\)/u);
  assert.match(workerSource, /verifyLeaseCredential\([\s\S]*?secret: leaseCredentialSecret/u);
  assert.match(workerSource, /createLeaseCredential\(\{[\s\S]*?secret: leaseCredentialSecret/u);
  assert.match(workerSource, /verifyLatticeAttestation\(attestationToken,[\s\S]*?secret: turnstileSecretKey/u);
  assert.match(workerSource, /signedVisitorValue\([\s\S]*?visitorCookieSecret/u);
  assert.doesNotMatch(workerSource, /secret: env\.VISITOR_COOKIE_SECRET/u);
  assert.match(workerSource, /const leaseToken = request\.headers\.get\("X-Lattice-Lease"\)/u);
  assert.doesNotMatch(workerSource, /const leaseToken = randomToken\(\)/u);
  assert.match(visitorCookieSource, /const COOKIE_VERSION = "v2"/u);
  assert.match(visitorCookieSource, /replay retains the same id/u);
  assert.doesNotMatch(visitorCookieSource, /Date\.now\(\)|expiresAtSeconds \* 1_000 <=/u);
  assert.match(workerSource, /publicHeaders\.delete\(INTERNAL_VISITOR_COOKIE_HEADER\)/u);
  assert.match(workerSource, /publicHeaders\.delete\(INTERNAL_LEASE_CREDENTIAL_HEADER\)/u);
  assert.match(workerSource, /verifiedCredential\?\.leaseId !== leaseId[\s\S]*?verifiedCredential\.expiresAt !== result\.maximumExpiresAt/u);
  assert.match(workerSource, /code: shaped\.code[\s\S]*?"Retry-After": String\(retryAfterSeconds\)/u);
  assert.match(workerSource, /boundedInternalRetryAfterSeconds/u);
  assert.match(workerSource, /LATTICE_MAX_PUBLIC_RETRY_AFTER_SECONDS/u);
  assert.match(workerSource, /https:\/\/usage-gate\.internal\/admit/u);
  assert.match(workerSource, /global-request-minute-limit/u);
  assert.match(workerSource, /global-request-day-limit/u);
  assert.match(workerSource, /if \(admissionDenial\) return admissionDenial/u);
  assert.match(workerSource, /outcome\.result\.allowed[\s\S]*?"Retry-After": String\(outcome\.result\.retryAfterSeconds\)/u);
  assert.match(workerSource, /const GLOBAL_OBJECT_NAME = "text-to-lattice-global-v1"/u);
  assert.match(workerSource, /VISITOR_ID_PATTERN = \/\^\[A-Za-z0-9_-\]\{24\}\$\/u/u);
  assert.match(visitorCookieSource, /VISITOR_SIGNATURE_PATTERN = \/\^\[A-Za-z0-9_-\]\{43\}\$\/u/u);
  assert.match(visitorCookieSource, /String\(expiresAtSeconds\) !== second/u);
  assert.match(workerSource, /if \(found !== null\) return null/u);
  assert.match(workerSource, /__Secure-hah-lattice-visitor/u);
  assert.match(workerSource, /Path=\/api\/text-to-lattice;/u);
  assert.match(workerSource, /commitUsageMutation\(this\.ctx\.storage/u);
  assert.match(usageStorageSource, /storage\.transaction\(async \(\) =>[\s\S]*?outcome = await mutate\(storedState\)/u);
  assert.match(usageStorageSource, /await storage\.put[\s\S]*?await storage\.setAlarm/u);
  assert.doesNotMatch(usageStorageSource, /\btxn\.(?:get|put|delete|list)/u,
    "SQLite transactions include direct storage and alarm operations");
});

test("eight concurrent first-time visitors cannot crowd their releases out with acquisition shaping", async () => {
  class CounterBinding {
    constructor(limit) {
      this.limitValue = limit;
      this.calls = [];
      this.counts = new Map();
    }

    async limit({ key }) {
      this.calls.push(key);
      const count = (this.counts.get(key) ?? 0) + 1;
      this.counts.set(key, count);
      return { success: count <= this.limitValue };
    }
  }

  const acquisition = new CounterBinding(PUBLISHED_LATTICE_USAGE_POLICY.enforcement.locationShaper.limit);
  const release = new CounterBinding(PUBLISHED_LATTICE_USAGE_POLICY.enforcement.releaseLocationShaper.limit);
  const renewal = new CounterBinding(PUBLISHED_LATTICE_USAGE_POLICY.enforcement.renewalLocationShaper.limit);
  const releaseLease = new CounterBinding(PUBLISHED_LATTICE_USAGE_POLICY.enforcement.releaseLeaseLocationShaper.limit);
  const renewalLease = new CounterBinding(PUBLISHED_LATTICE_USAGE_POLICY.enforcement.renewalLeaseLocationShaper.limit);
  const path = new CounterBinding(PUBLISHED_LATTICE_USAGE_POLICY.enforcement.pathLocationShaper.limit);
  const env = {
    LATTICE_ACQUIRE_SHAPER: acquisition,
    LATTICE_RELEASE_SHAPER: release,
    LATTICE_RENEWAL_SHAPER: renewal,
    LATTICE_RELEASE_LEASE_SHAPER: releaseLease,
    LATTICE_RENEWAL_LEASE_SHAPER: renewalLease,
    LATTICE_PATH_SHAPER: path,
  };
  const outcomes = await Promise.all(Array.from({ length: 8 }, async (_, index) => [
    await shapeLatticeUsageRequest("POST", env),
    await shapeLatticeUsageRequest("POST", env),
    await shapeLatticeUsageRequest("DELETE", env, lease(index)),
    await shapeLatticeUsageRequest("DELETE", env, lease(100 + index)),
  ]));
  const heartbeats = await Promise.all(Array.from({ length: 8 }, (_, index) => (
    shapeLatticeUsageRequest("PATCH", env, lease(index))
  )));

  assert.ok(outcomes.flat().every(({ success }) => success));
  assert.ok(heartbeats.every(({ success }) => success));
  assert.equal(acquisition.calls.length, 16);
  assert.equal(release.calls.length, 16);
  assert.ok(acquisition.calls.every((key) => key === LATTICE_LOCATION_SHAPERS.POST.key));
  assert.ok(release.calls.every((key) => key === LATTICE_LOCATION_SHAPERS.DELETE.key));
  assert.equal(renewal.calls.length, 8);
  assert.ok(renewal.calls.every((key) => key === LATTICE_LOCATION_SHAPERS.PATCH.key));
  assert.equal(releaseLease.calls.length, 16);
  assert.ok(releaseLease.calls.every((key) => (
    key.startsWith(LATTICE_LEASE_LOCATION_SHAPERS.DELETE.keyPrefix)
  )));
  assert.equal(renewalLease.calls.length, 8);
  assert.ok(renewalLease.calls.every((key, index) => (
    key === `${LATTICE_LEASE_LOCATION_SHAPERS.PATCH.keyPrefix}${lease(index)}`
  )));
  assert.equal(path.calls.length, 40);
  assert.ok(path.calls.every((key) => key === LATTICE_PATH_LOCATION_SHAPER.key));
});

test("one authenticated lease cannot crowd the shared control shaper", async () => {
  class CounterBinding {
    constructor(limit) {
      this.limitValue = limit;
      this.calls = [];
    }

    async limit({ key }) {
      this.calls.push(key);
      return { success: this.calls.length <= this.limitValue };
    }
  }

  const actorLimit = PUBLISHED_LATTICE_USAGE_POLICY.enforcement.renewalLeaseLocationShaper.limit;
  const actor = new CounterBinding(actorLimit);
  const shared = new CounterBinding(PUBLISHED_LATTICE_USAGE_POLICY.enforcement.renewalLocationShaper.limit);
  const path = new CounterBinding(PUBLISHED_LATTICE_USAGE_POLICY.enforcement.pathLocationShaper.limit);
  const env = {
    LATTICE_RENEWAL_LEASE_SHAPER: actor,
    LATTICE_RENEWAL_SHAPER: shared,
    LATTICE_PATH_SHAPER: path,
  };
  const outcomes = [];
  for (let index = 0; index <= actorLimit; index += 1) {
    outcomes.push(await shapeLatticeUsageRequest("PATCH", env, lease(90)));
  }

  assert.ok(outcomes.slice(0, actorLimit).every(({ success }) => success));
  assert.equal(outcomes.at(-1).success, false);
  assert.equal(outcomes.at(-1).code, LATTICE_LEASE_LOCATION_SHAPERS.PATCH.code);
  assert.equal(shared.calls.length, actorLimit, "actor rejection occurs before shared capacity is consumed");
  assert.equal(path.calls.length, actorLimit, "actor rejection occurs before combined capacity is consumed");
  await assert.rejects(
    shapeLatticeUsageRequest("PATCH", env),
    /require an opaque credential actor key/u,
  );
});

test("method shaping rejects before the combined location counter", async () => {
  class CounterBinding {
    constructor(success) {
      this.success = success;
      this.calls = [];
    }

    async limit({ key }) {
      this.calls.push(key);
      return { success: this.success };
    }
  }

  const rejectedMethod = new CounterBinding(false);
  const untouchedPath = new CounterBinding(true);
  const methodDenied = await shapeLatticeUsageRequest("POST", {
    LATTICE_ACQUIRE_SHAPER: rejectedMethod,
    LATTICE_PATH_SHAPER: untouchedPath,
  });
  assert.equal(methodDenied.code, LATTICE_LOCATION_SHAPERS.POST.code);
  assert.equal(untouchedPath.calls.length, 0);

  const acceptedMethod = new CounterBinding(true);
  const rejectedPath = new CounterBinding(false);
  const pathDenied = await shapeLatticeUsageRequest("POST", {
    LATTICE_ACQUIRE_SHAPER: acceptedMethod,
    LATTICE_PATH_SHAPER: rejectedPath,
  });
  assert.equal(pathDenied.code, LATTICE_PATH_LOCATION_SHAPER.code);
  assert.deepEqual(rejectedPath.calls, [LATTICE_PATH_LOCATION_SHAPER.key]);
});

test("every missing limiter binding fails closed instead of bypassing shaping", async () => {
  await assert.rejects(
    shapeLatticeIngressRequest({}),
    /missing the LATTICE_INGRESS_SHAPER rate-shaper binding/u,
  );
  await assert.rejects(
    shapeLatticeUsageRequest("POST", {}),
    /missing the LATTICE_ACQUIRE_SHAPER rate-shaper binding/u,
  );
  await assert.rejects(
    shapeLatticeUsageRequest("POST", {
      LATTICE_ACQUIRE_SHAPER: { limit: async () => ({ success: true }) },
    }),
    /missing the LATTICE_PATH_SHAPER rate-shaper binding/u,
  );
  await assert.rejects(
    shapeLatticeUsageRequest("PATCH", {}, lease(1)),
    /missing the LATTICE_RENEWAL_LEASE_SHAPER rate-shaper binding/u,
  );
});

test("published shaper and edge limits cover the documented legitimate burst arithmetic", () => {
  const enforcement = PUBLISHED_LATTICE_USAGE_POLICY.enforcement;
  const burst = enforcement.legitimateBurstBasis;
  assert.equal(
    burst.maximumColdStartPosts,
    burst.validatedAcquisitions * burst.coldStartPostsPerAcquisition,
  );
  assert.equal(
    burst.maximumReleaseCalls,
    burst.maximumNewLeaseReleases + burst.maximumCarriedLeaseReleases,
  );
  assert.equal(
    burst.maximumPathCalls,
    burst.maximumColdStartPosts
      + burst.maximumNewLeaseReleases
      + burst.maximumCarriedLeaseReleases
      + burst.maximumConcurrentRenewalCalls,
  );
  assert.equal(
    burst.maximumExactAdmissionCalls,
    burst.validatedAcquisitions
      + burst.maximumReleaseCalls
      + burst.maximumConcurrentRenewalCalls,
    "the first challenge request returns before exact admission",
  );
  assert.ok(enforcement.locationShaper.limit > burst.maximumColdStartPosts);
  assert.ok(enforcement.releaseLocationShaper.limit > burst.maximumReleaseCalls);
  assert.ok(enforcement.renewalLocationShaper.limit > burst.maximumConcurrentRenewalCalls);
  assert.equal(enforcement.releaseLeaseLocationShaper.actorKeyRequired, true);
  assert.equal(enforcement.renewalLeaseLocationShaper.actorKeyRequired, true);
  assert.ok(enforcement.releaseLeaseLocationShaper.limit > 1);
  assert.ok(enforcement.renewalLeaseLocationShaper.limit > 1);
  assert.equal(enforcement.ingressLocationShaper.limit, burst.maximumPathCalls);
  assert.equal(enforcement.pathLocationShaper.limit, burst.maximumPathCalls);
  assert.ok(enforcement.edgeFloodProtection.limit > burst.maximumPathCalls);
  assert.equal(enforcement.edgeFloodProtection.limit - burst.maximumPathCalls, 8);
  assert.ok(PUBLISHED_LATTICE_USAGE_POLICY.globalRequests.limit > burst.maximumExactAdmissionCalls);
  assert.equal(
    PUBLISHED_LATTICE_USAGE_POLICY.globalRequests.limit - burst.maximumExactAdmissionCalls,
    8,
  );
  assert.equal(
    enforcement.exactRequestAdmission.limit,
    PUBLISHED_LATTICE_USAGE_POLICY.globalRequests.limit,
  );
  const freeTier = PUBLISHED_LATTICE_USAGE_POLICY.freeTierBasis;
  assert.equal(
    freeTier.maximumRenewalIntervalsPerActiveSlotPerUtcDay,
    freeTier.secondsPerUtcDay
      / PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.minimumRenewalIntervalSeconds,
  );
  assert.equal(
    freeTier.maximumAcceptedRenewalsPerUtcDayAtActiveCap,
    PUBLISHED_LATTICE_USAGE_POLICY.activeLeases.limit
      * freeTier.maximumRenewalIntervalsPerActiveSlotPerUtcDay,
  );
  assert.equal(
    freeTier.maximumNewGrantsPerRollingDay,
    PUBLISHED_LATTICE_USAGE_POLICY.globalGrants.limit,
  );
  assert.equal(
    freeTier.maximumReleaseTransitionsPerUtcDay,
    freeTier.maximumNewGrantsPerRollingDay
      + freeTier.maximumCarriedLeaseReleasesPerUtcDay,
  );
  assert.equal(
    freeTier.maximumProtocolLifecycleActionsPerUtcDay,
    freeTier.maximumAcceptedRenewalsPerUtcDayAtActiveCap
      + freeTier.maximumNewGrantsPerRollingDay
      + freeTier.maximumReleaseTransitionsPerUtcDay,
  );
  assert.equal(
    freeTier.maximumProtocolPublicWorkerCallsPerUtcDay,
    freeTier.maximumProtocolLifecycleActionsPerUtcDay
      + freeTier.maximumProtocolChallengeCallsPerUtcDay,
  );
  assert.equal(
    freeTier.maximumProtocolDirectDurableObjectRequestsPerUtcDay,
    freeTier.maximumProtocolAdmissionCallsPerUtcDay
      + freeTier.maximumProtocolLifecycleActionsPerUtcDay,
  );
  assert.equal(
    freeTier.protocolActionHeadroomUnderDailyAdmissionCap,
    PUBLISHED_LATTICE_USAGE_POLICY.globalDailyRequests.limit
      - freeTier.maximumProtocolLifecycleActionsPerUtcDay,
  );
  assert.ok(freeTier.protocolActionHeadroomUnderDailyAdmissionCap > 0);

  assert.equal(
    freeTier.maximumNominalSuccessfulIngressCallsPerLocationPerUtcDay,
    enforcement.ingressLocationShaper.limit
      * freeTier.secondsPerUtcDay / enforcement.ingressLocationShaper.windowSeconds,
  );
  assert.equal(
    freeTier.maximumNominalAdmissionCallsPerLocationPerUtcDay,
    enforcement.pathLocationShaper.limit
      * freeTier.secondsPerUtcDay / enforcement.pathLocationShaper.windowSeconds,
  );
  assert.equal(
    freeTier.maximumAdmissionMutationsPerUtcDay,
    PUBLISHED_LATTICE_USAGE_POLICY.globalDailyRequests.limit,
  );
  assert.equal(
    freeTier.maximumBudgetedPrimaryActionCallsPerUtcDay,
    freeTier.maximumAdmissionMutationsPerUtcDay
      + freeTier.budgetedPriorDayActionCarryoverCallsPerUtcDay,
  );
  assert.equal(
    freeTier.maximumBudgetedLifecycleCallsPerUtcDay,
    freeTier.maximumBudgetedPrimaryActionCallsPerUtcDay
      + freeTier.maximumCompensatingReleaseCallsPerUtcDay,
  );
  assert.equal(
    freeTier.maximumCompensatingReleaseCallsPerUtcDay,
    freeTier.maximumBudgetedPrimaryActionCallsPerUtcDay,
    "every primary action is conservatively charged one defensive release call",
  );
  assert.equal(
    freeTier.maximumUnderlyingExpiryMomentsPerUtcDay,
    freeTier.maximumCurrentDayAdmissionExpiryEvents
      + freeTier.budgetedPriorDayAdmissionExpiryCarryoverEvents
      + freeTier.maximumAttemptExpiryEventsPerUtcDay
      + freeTier.maximumPriorDayGrantAndVisitorExpiryEvents
      + freeTier.maximumLeaseExpiryEventsPerUtcDay
      + freeTier.maximumUtcRolloverEventsPerUtcDay,
  );
  assert.equal(
    freeTier.maximumAlarmBucketsPerUtcDay,
    freeTier.secondsPerUtcDay / freeTier.alarmCoalescingWindowSeconds,
  );
  assert.equal(
    freeTier.alarmCoalescingWindowSeconds * 1_000,
    LATTICE_USAGE_ALARM_BUCKET_MILLISECONDS,
  );
  assert.equal(
    freeTier.alarmMaximumAttemptsPerEvent,
    freeTier.alarmMaximumRetriesPerEvent + 1,
  );
  assert.equal(
    freeTier.maximumPriorDayAlarmRetrySpillInvocations,
    freeTier.maximumCarriedAlarmSequencesPerUtcDay
      * freeTier.alarmMaximumAttemptsPerEvent,
  );
  assert.equal(
    freeTier.maximumBudgetedAlarmInvocationsPerUtcDay,
    freeTier.maximumAlarmBucketsPerUtcDay
      * freeTier.alarmMaximumAttemptsPerEvent
      + freeTier.maximumPriorDayAlarmRetrySpillInvocations,
  );
  assert.equal(
    freeTier.maximumBudgetedDurableObjectRequestsPerDay,
    freeTier.maximumNominalAdmissionCallsPerLocationPerUtcDay
      + freeTier.maximumBudgetedLifecycleCallsPerUtcDay
      + freeTier.maximumBudgetedAlarmInvocationsPerUtcDay,
  );
  assert.equal(
    freeTier.maximumRequestTriggeredPruneMutationsPerUtcDay,
    freeTier.maximumUnderlyingExpiryMomentsPerUtcDay,
  );
  assert.equal(
    freeTier.maximumBudgetedStateChangingTransactionsPerDay,
    freeTier.maximumAdmissionMutationsPerUtcDay
      + freeTier.maximumBudgetedLifecycleCallsPerUtcDay
      + freeTier.maximumRequestTriggeredPruneMutationsPerUtcDay
      + freeTier.maximumBudgetedAlarmInvocationsPerUtcDay,
  );
  assert.equal(
    freeTier.maximumBudgetedDurableObjectRowsWrittenPerDay,
    freeTier.maximumBudgetedStateChangingTransactionsPerDay
      * freeTier.maximumRowsWrittenPerStateChangingTransaction,
  );
  assert.equal(
    freeTier.maximumBudgetedDurableObjectRowsReadPerDay,
    freeTier.maximumBudgetedDurableObjectRequestsPerDay,
  );
  assert.equal(
    freeTier.durableObjectRequestHeadroomPerDay,
    freeTier.durableObjectRequestsPerDay
      - freeTier.maximumBudgetedDurableObjectRequestsPerDay,
  );
  assert.equal(
    freeTier.durableObjectRowsReadHeadroomPerDay,
    freeTier.durableObjectRowsReadPerDay
      - freeTier.maximumBudgetedDurableObjectRowsReadPerDay,
  );
  assert.equal(
    freeTier.durableObjectRowsWrittenHeadroomPerDay,
    freeTier.durableObjectRowsWrittenPerDay
      - freeTier.maximumBudgetedDurableObjectRowsWrittenPerDay,
  );
  assert.equal(
    freeTier.maximumSingletonDurationGigabyteSecondsPerDay,
    freeTier.durableObjectMemoryGigabytes * freeTier.secondsPerUtcDay,
  );
  assert.ok(Math.abs(
    freeTier.durableObjectDurationHeadroomGigabyteSecondsPerDay
      - (freeTier.durableObjectGigabyteSecondsPerDay
        - freeTier.maximumSingletonDurationGigabyteSecondsPerDay),
  ) < Number.EPSILON * freeTier.durableObjectGigabyteSecondsPerDay);
  assert.equal(freeTier.durableObjectMemoryMegabytes, 128);
  assert.ok(freeTier.maximumNominalSuccessfulIngressCallsPerLocationPerUtcDay < freeTier.workerRequestsPerDay);
  assert.ok(freeTier.maximumBudgetedDurableObjectRequestsPerDay < freeTier.durableObjectRequestsPerDay);
  assert.ok(freeTier.maximumBudgetedDurableObjectRowsReadPerDay < freeTier.durableObjectRowsReadPerDay);
  assert.ok(freeTier.maximumBudgetedDurableObjectRowsWrittenPerDay < freeTier.durableObjectRowsWrittenPerDay);
  assert.ok(freeTier.maximumSingletonDurationGigabyteSecondsPerDay < freeTier.durableObjectGigabyteSecondsPerDay);
  assert.equal(freeTier.scopedSingleLocationNominalIngressBasis, true);
  assert.equal(freeTier.workerRequestBudgetGuarantee, false);
  assert.match(freeTier.workerRequestBudgetLimitation, /already|before an in-Worker shaper/u);
  assert.match(freeTier.adversarialTrafficIncluded, /distributed traffic[\s\S]*excluded/u);
  assert.match(freeTier.exhaustionMode, /fails closed/u);
  assert.match(freeTier.exhaustionMode, /does not incur usage overage/u);
  assert.deepEqual({
    durableObjectRequests: freeTier.maximumBudgetedDurableObjectRequestsPerDay,
    rowsRead: freeTier.maximumBudgetedDurableObjectRowsReadPerDay,
    rowsWritten: freeTier.maximumBudgetedDurableObjectRowsWrittenPerDay,
    durationGigabyteSeconds: freeTier.maximumSingletonDurationGigabyteSecondsPerDay,
  }, {
    durableObjectRequests: 73_767,
    rowsRead: 73_767,
    rowsWritten: 45_032,
    durationGigabyteSeconds: 11_059.2,
  });
});

test("release deduplication retains two full documented cleanup windows", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const maximumReleaseRetrySeconds = Math.max(
    PUBLISHED_LATTICE_USAGE_POLICY.globalRequests.windowSeconds,
    PUBLISHED_LATTICE_USAGE_POLICY.enforcement.releaseLocationShaper.windowSeconds,
    PUBLISHED_LATTICE_USAGE_POLICY.enforcement.releaseLeaseLocationShaper.windowSeconds,
  );
  const retentionWindows = Math.ceil(
    (maximumReleaseRetrySeconds
      + PUBLISHED_LATTICE_USAGE_POLICY.enforcement.releaseLeaseLocationShaper.windowSeconds)
      / PUBLISHED_LATTICE_USAGE_POLICY.enforcement.releaseLocationShaper.windowSeconds,
  );
  const expectedCapacity =
    PUBLISHED_LATTICE_USAGE_POLICY.enforcement.legitimateBurstBasis.maximumReleaseCalls
    * retentionWindows;
  assert.equal(MAX_TRACKED_LATTICE_RELEASE_OPERATIONS, expectedCapacity);
  assert.equal(expectedCapacity, 32);

  const requests = [];
  try {
    const futureNow = originalNow() + 1_000_000;
    Date.now = () => futureNow;
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });
      return new Response(null, { status: 204 });
    };
    const results = await Promise.all(Array.from(
      { length: expectedCapacity },
      (_, index) => releaseLatticeLease(lease(1_000 + index)),
    ));
    assert.ok(results.every(Boolean));
    assert.equal(requests.length, expectedCapacity);
    assert.ok(requests.every(({ options }) => (
      options.method === "DELETE"
      && options.body === undefined
      && options.keepalive === true
    )));
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
