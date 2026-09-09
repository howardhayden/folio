import { LATTICE_USAGE_POLICY } from "./usagePolicy.js";
import { isLatticeAttestationToken } from "./attestation.js";

const LEASE_PATH = "/api/text-to-lattice/lease";
const MAX_LEASE_RESPONSE_BYTES = 16_384;
const MAX_RETRY_SECONDS = LATTICE_USAGE_POLICY.visitor.windowSeconds + 60;
const MAX_RELEASE_RETRY_SECONDS = Math.max(
  LATTICE_USAGE_POLICY.globalRequests.windowSeconds,
  LATTICE_USAGE_POLICY.enforcement.releaseLocationShaper.windowSeconds,
  LATTICE_USAGE_POLICY.enforcement.releaseLeaseLocationShaper.windowSeconds,
);
const MAX_RELEASE_ATTEMPTS = Math.max(
  1,
  LATTICE_USAGE_POLICY.enforcement.releaseLeaseLocationShaper.limit - 1,
);
const RELEASE_OPERATION_RETENTION_SECONDS = MAX_RELEASE_RETRY_SECONDS
  + LATTICE_USAGE_POLICY.enforcement.releaseLeaseLocationShaper.windowSeconds;
const RELEASE_OPERATION_RETENTION_WINDOWS = Math.ceil(
  RELEASE_OPERATION_RETENTION_SECONDS
    / LATTICE_USAGE_POLICY.enforcement.releaseLocationShaper.windowSeconds,
);
export const MAX_TRACKED_LATTICE_RELEASE_OPERATIONS =
  LATTICE_USAGE_POLICY.enforcement.legitimateBurstBasis.maximumReleaseCalls
  * RELEASE_OPERATION_RETENTION_WINDOWS;
const ATTESTATION_HEADER = "X-Lattice-Attestation";
const ATTESTATION_SITE_KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;
const LEASE_TOKEN_PATTERN = /^[A-Za-z0-9._-]{1,512}$/u;
const releaseOperations = new Map();

export class LatticeLeaseError extends Error {
  constructor(message, {
    code = "usage-gate-unavailable",
    retryAfterSeconds = 60,
    limited = false,
  } = {}) {
    super(message);
    this.name = "LatticeLeaseError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.limited = limited;
  }
}

function boundedRetrySeconds(value) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) return null;
  if (!Number.isFinite(value)) return value > 0 ? MAX_RETRY_SECONDS : null;
  return Math.min(MAX_RETRY_SECONDS, Math.max(0, Math.ceil(value)));
}

const HTTP_MONTHS = Object.freeze(new Map([
  ["Jan", 0], ["Feb", 1], ["Mar", 2], ["Apr", 3], ["May", 4], ["Jun", 5],
  ["Jul", 6], ["Aug", 7], ["Sep", 8], ["Oct", 9], ["Nov", 10], ["Dec", 11],
]));
const HTTP_WEEKDAYS = Object.freeze(new Map([
  ["Sun", 0], ["Mon", 1], ["Tue", 2], ["Wed", 3], ["Thu", 4], ["Fri", 5], ["Sat", 6],
  ["Sunday", 0], ["Monday", 1], ["Tuesday", 2], ["Wednesday", 3],
  ["Thursday", 4], ["Friday", 5], ["Saturday", 6],
]));
const IMF_FIXDATE = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), ([0-9]{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ([0-9]{4}) ([0-9]{2}):([0-9]{2}):([0-9]{2}) GMT$/u;
const RFC850_DATE = /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), ([0-9]{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-([0-9]{2}) ([0-9]{2}):([0-9]{2}):([0-9]{2}) GMT$/u;
const ASCTIME_DATE = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (?: ([0-9])|([0-9]{2})) ([0-9]{2}):([0-9]{2}):([0-9]{2}) ([0-9]{4})$/u;

function exactUtcTimestamp({ weekday, day, month, year, hour, minute, second }) {
  if (![day, month, year, hour, minute, second].every(Number.isSafeInteger)) return null;
  // HTTP-date inherits RFC 5322's date semantics: years before 1900 are not
  // valid dates, even though JavaScript's proleptic Date implementation can
  // represent them. Reject them before calendar validation so an obsolete
  // Date header cannot manufacture an excessive conservative retry window.
  if (year < 1900) return null;
  if (second < 0 || second > 60) return null;
  const validationSecond = second === 60 ? 59 : second;
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(hour, minute, validationSecond, 0);
  const parsed = date.getTime();
  if (
    !Number.isFinite(parsed)
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month
    || date.getUTCDate() !== day
    || date.getUTCHours() !== hour
    || date.getUTCMinutes() !== minute
    || date.getUTCSeconds() !== validationSecond
    || date.getUTCDay() !== HTTP_WEEKDAYS.get(weekday)
  ) return null;
  return parsed + (second === 60 ? 1_000 : 0);
}

function utcCalendarYearsAfter(timestamp, years) {
  const source = new Date(timestamp);
  if (!Number.isFinite(source.getTime()) || !Number.isSafeInteger(years)) return null;
  const targetYear = source.getUTCFullYear() + years;
  const month = source.getUTCMonth();
  const lastDay = new Date(0);
  lastDay.setUTCFullYear(targetYear, month + 1, 0);
  lastDay.setUTCHours(0, 0, 0, 0);
  const target = new Date(0);
  target.setUTCFullYear(targetYear, month, Math.min(source.getUTCDate(), lastDay.getUTCDate()));
  target.setUTCHours(
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  );
  return Number.isFinite(target.getTime()) ? target : null;
}

function rfc850Year(twoDigitYear, fields, referenceTime) {
  const boundary = utcCalendarYearsAfter(referenceTime, 50);
  if (!boundary) return null;
  let year = Math.floor(boundary.getUTCFullYear() / 100) * 100 + twoDigitYear;
  const candidateFields = [
    fields.month,
    fields.day,
    fields.hour,
    fields.minute,
    fields.second,
  ];
  const boundaryFields = [
    boundary.getUTCMonth(),
    boundary.getUTCDate(),
    boundary.getUTCHours(),
    boundary.getUTCMinutes(),
    boundary.getUTCSeconds(),
  ];
  let afterBoundary = year > boundary.getUTCFullYear();
  if (year === boundary.getUTCFullYear()) {
    for (let index = 0; index < candidateFields.length; index += 1) {
      if (candidateFields[index] === boundaryFields[index]) continue;
      afterBoundary = candidateFields[index] > boundaryFields[index];
      break;
    }
  }
  if (afterBoundary) year -= 100;
  return year;
}

function parsedHttpDate(value, referenceTime) {
  if (typeof value !== "string" || !value || !Number.isFinite(referenceTime)) return null;
  let match = value.match(IMF_FIXDATE);
  if (match) {
    return exactUtcTimestamp({
      weekday: match[1],
      day: Number(match[2]),
      month: HTTP_MONTHS.get(match[3]),
      year: Number(match[4]),
      hour: Number(match[5]),
      minute: Number(match[6]),
      second: Number(match[7]),
    });
  }

  match = value.match(RFC850_DATE);
  if (match) {
    const fields = {
      day: Number(match[2]),
      month: HTTP_MONTHS.get(match[3]),
      hour: Number(match[5]),
      minute: Number(match[6]),
      second: Number(match[7]),
    };
    const year = rfc850Year(Number(match[4]), fields, referenceTime);
    if (year === null) return null;
    return exactUtcTimestamp({
      weekday: match[1],
      day: fields.day,
      month: fields.month,
      year,
      hour: fields.hour,
      minute: fields.minute,
      second: fields.second,
    });
  }

  match = value.match(ASCTIME_DATE);
  if (!match) return null;
  return exactUtcTimestamp({
    weekday: match[1],
    day: Number(match[3] ?? match[4]),
    month: HTTP_MONTHS.get(match[2]),
    year: Number(match[8]),
    hour: Number(match[5]),
    minute: Number(match[6]),
    second: Number(match[7]),
  });
}

function retryHeaderSeconds(response, now) {
  const value = response.headers.get("Retry-After");
  if (typeof value !== "string" || !value) return null;
  if (/^[0-9]+$/u.test(value)) {
    // delay-seconds is an unbounded 1*DIGIT field. Canonicalize leading
    // zeroes before the safe numeric-length guard so a valid value such as
    // 0000000000000001 remains one second instead of becoming the maximum.
    const canonicalValue = value.replace(/^0+(?=[0-9])/u, "");
    if (canonicalValue.length > 15) return MAX_RETRY_SECONDS;
    return boundedRetrySeconds(Number(canonicalValue));
  }
  const retryAt = parsedHttpDate(value, now);
  if (retryAt === null) return null;
  const responseDate = parsedHttpDate(response.headers.get("Date"), now);
  const bases = responseDate === null ? [now] : [now, responseDate];
  return Math.max(...bases.map((base) => Math.min(
    MAX_RETRY_SECONDS,
    Math.max(0, Math.ceil((retryAt - base) / 1_000)),
  )));
}

function retrySeconds(response, body, now = Date.now()) {
  const candidates = [
    boundedRetrySeconds(body?.retryAfterSeconds),
    retryHeaderSeconds(response, now),
  ].filter((value) => value !== null);
  return candidates.length > 0 ? Math.max(...candidates) : 60;
}

function messageForCode(code, limited = false) {
  if (code === "visitor-day-limit") {
    return "This browser has reached its Text to Lattice demonstration limit.";
  }
  if (
    code === "global-minute-limit"
    || code === "global-request-minute-limit"
    || code === "global-request-day-limit"
    || code === "global-day-limit"
    || code === "active-lease-limit"
    || code === "active-lease-migration"
    || code === "visitor-active-lease-limit"
    || code === "edge-rate-limit"
    || code.startsWith("location-") && code.endsWith("-minute-limit")
  ) {
    return "Text to Lattice is busy right now.";
  }
  if (code === "attestation-rejected") {
    return "Verification did not finish. Please try again.";
  }
  if (limited) return "Text to Lattice is busy right now.";
  return "Text to Lattice is unavailable right now.";
}

export async function boundedLatticeLeaseResponseBody(response) {
  const mediaType = (response.headers.get("Content-Type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    await response.body?.cancel().catch(() => {});
    return null;
  }
  const declaredLength = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_LEASE_RESPONSE_BYTES) {
    void response.body?.cancel();
    return null;
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_LEASE_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
      if (text.length > MAX_LEASE_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch {
    await reader.cancel().catch(() => {});
    return null;
  }
}

function matchesPublishedPolicy(policy) {
  if (policy?.version !== LATTICE_USAGE_POLICY.version) return false;
  for (const field of [
    "visitor",
    "globalRequests",
    "globalDailyRequests",
    "globalAttempts",
    "globalGrants",
  ]) {
    if (
      policy?.[field]?.limit !== LATTICE_USAGE_POLICY[field].limit
      || policy?.[field]?.windowSeconds !== LATTICE_USAGE_POLICY[field].windowSeconds
    ) return false;
  }
  return policy?.activeLeases?.limit === LATTICE_USAGE_POLICY.activeLeases.limit
    && policy?.activeLeases?.perVisitorLimit === LATTICE_USAGE_POLICY.activeLeases.perVisitorLimit
    && policy?.activeLeases?.ttlSeconds === LATTICE_USAGE_POLICY.activeLeases.ttlSeconds
    && policy?.activeLeases?.renewalIntervalSeconds === LATTICE_USAGE_POLICY.activeLeases.renewalIntervalSeconds
    && policy?.activeLeases?.minimumRenewalIntervalSeconds === LATTICE_USAGE_POLICY.activeLeases.minimumRenewalIntervalSeconds
    && policy?.activeLeases?.maximumLifetimeSeconds === LATTICE_USAGE_POLICY.activeLeases.maximumLifetimeSeconds;
}

export async function acquireLatticeLease(signal, obtainAttestation) {
  // Start the browser deadline before either empty request. This makes the
  // browser's permitted run no longer than the server lease even when the
  // initial cookie-establishment round trip adds latency.
  const acquisitionStartedAt = Date.now();
  let attestationToken = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await fetch(LEASE_PATH, {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(attestationToken ? { [ATTESTATION_HEADER]: attestationToken } : {}),
        },
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new LatticeLeaseError(
        "Text to Lattice is unavailable right now. Your text stayed here.",
      );
    }
    const body = await boundedLatticeLeaseResponseBody(response);
    if (
      response.status === 428
      && ["visitor-cookie-required", "attestation-required"].includes(body?.code)
      && attempt === 0
      && ATTESTATION_SITE_KEY_PATTERN.test(body?.attestationSiteKey ?? "")
      && typeof obtainAttestation === "function"
    ) {
      attestationToken = await obtainAttestation(body.attestationSiteKey, signal);
      if (!isLatticeAttestationToken(attestationToken)) {
        throw new LatticeLeaseError("Verification did not finish. Please try again. Your text stayed here.", {
          code: "attestation-rejected",
        });
      }
      continue;
    }
    const policyMatches = matchesPublishedPolicy(body?.policy);
    const ttlSeconds = Number(body?.policy?.activeLeases?.ttlSeconds);
    const maximumLifetimeSeconds = Number(body?.policy?.activeLeases?.maximumLifetimeSeconds);
    const serverExpiresAt = Number(body?.expiresAt);
    const serverMaximumExpiresAt = Number(body?.maximumExpiresAt);
    const leaseSecondsRemaining = Number(body?.leaseSecondsRemaining);
    if (
      !response.ok
      || body?.allowed !== true
      || typeof body.leaseToken !== "string"
      || !LEASE_TOKEN_PATTERN.test(body.leaseToken)
      || !policyMatches
      || !Number.isSafeInteger(ttlSeconds)
      || ttlSeconds <= 0
      || !Number.isSafeInteger(maximumLifetimeSeconds)
      || maximumLifetimeSeconds < ttlSeconds
      || !Number.isSafeInteger(serverExpiresAt)
      || serverExpiresAt <= 0
      || !Number.isSafeInteger(serverMaximumExpiresAt)
      || serverMaximumExpiresAt < serverExpiresAt
      || !Number.isSafeInteger(leaseSecondsRemaining)
      || leaseSecondsRemaining !== ttlSeconds
    ) {
      if (body?.allowed === true && typeof body.leaseToken === "string") {
        void releaseLatticeLease(body.leaseToken);
      }
      const responseLimited = response.status === 429;
      const code = typeof body?.code === "string"
        ? body.code
        : responseLimited ? "edge-rate-limit" : "usage-gate-unavailable";
      const wait = retrySeconds(response, body);
      const message = code === "visitor-cookie-required"
        ? "This browser did not retain the usage-limit cookie. Your text stayed here."
        : `${messageForCode(code, responseLimited)} Your text stayed here.`;
      throw new LatticeLeaseError(message, {
        code,
        retryAfterSeconds: wait,
        limited: responseLimited,
      });
    }
    return {
      token: body.leaseToken,
      // This is a conservative browser-clock deadline. `serverExpiresAt` is
      // retained only as protocol evidence; it is not compared with the
      // browser clock, which may be skewed.
      expiresAt: acquisitionStartedAt + ttlSeconds * 1_000,
      maximumExpiresAt: acquisitionStartedAt + maximumLifetimeSeconds * 1_000,
      serverExpiresAt,
      serverMaximumExpiresAt,
      policy: body.policy,
    };
  }
  throw new LatticeLeaseError(
    "This browser could not verify its usage limit. Your text stayed here.",
  );
}

export async function renewLatticeLease(lease, signal) {
  if (typeof lease?.token !== "string" || !lease.token) {
    throw new LatticeLeaseError("The portfolio demonstration has no active slot to renew.", {
      code: "lease-not-active",
    });
  }
  const renewalStartedAt = Date.now();
  let response;
  try {
    response = await fetch(LEASE_PATH, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${lease.token}`,
      },
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new LatticeLeaseError(
      "The run could not continue. Your text stayed here.",
    );
  }
  const body = await boundedLatticeLeaseResponseBody(response);
  const code = typeof body?.code === "string" ? body.code : "usage-gate-unavailable";
  const responseLimited = response.status === 429;
  const wait = retrySeconds(response, body);
  const ttlSeconds = Number(body?.policy?.activeLeases?.ttlSeconds);
  const leaseSecondsRemaining = Number(body?.leaseSecondsRemaining);
  const serverExpiresAt = Number(body?.expiresAt);
  const serverMaximumExpiresAt = Number(body?.maximumExpiresAt);
  const valid = response.ok
    && body?.allowed === true
    && body.leaseToken === lease.token
    && matchesPublishedPolicy(body.policy)
    && Number.isSafeInteger(ttlSeconds)
    && Number.isSafeInteger(leaseSecondsRemaining)
    && leaseSecondsRemaining > 0
    && leaseSecondsRemaining <= ttlSeconds
    && Number.isSafeInteger(serverExpiresAt)
    && Number.isSafeInteger(serverMaximumExpiresAt)
    && serverExpiresAt > 0
    && serverMaximumExpiresAt >= serverExpiresAt
    && Number.isSafeInteger(lease.maximumExpiresAt);
  if (!valid) {
    const message = responseLimited
      ? `${messageForCode(code, true)} The run remains active.`
      : `The run could not continue.${response.ok ? "" : ` ${messageForCode(code)}`} Your text stayed here.`;
    throw new LatticeLeaseError(
      message,
      { code, retryAfterSeconds: wait, limited: responseLimited },
    );
  }
  const expiresAt = Math.min(
    renewalStartedAt + leaseSecondsRemaining * 1_000,
    lease.maximumExpiresAt,
  );
  if (expiresAt <= Date.now()) {
    throw new LatticeLeaseError("The portfolio-demonstration slot reached its maximum lifetime.", {
      code: "lease-maximum-lifetime",
    });
  }
  return Object.freeze({
    ...lease,
    expiresAt,
    serverExpiresAt,
    serverMaximumExpiresAt,
    policy: body.policy,
  });
}

function waitForReleaseRetry(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function performLatticeLeaseRelease(token, wait) {
  for (let attempt = 0; attempt < MAX_RELEASE_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(LEASE_PATH, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        keepalive: true,
      });
      if (response.ok) return true;
      if (response.status !== 429 || attempt + 1 >= MAX_RELEASE_ATTEMPTS) return false;
      const body = await boundedLatticeLeaseResponseBody(response);
      const retryAfterSeconds = retrySeconds(response, body);
      if (retryAfterSeconds > MAX_RELEASE_RETRY_SECONDS) return false;
      await wait(retryAfterSeconds * 1_000);
    } catch {
      return false;
    }
  }
  return false;
}

export async function releaseLatticeLease(token, {
  wait = waitForReleaseRetry,
} = {}) {
  if (typeof token !== "string" || !LEASE_TOKEN_PATTERN.test(token)) return false;
  const now = Date.now();
  for (const [trackedToken, operation] of releaseOperations) {
    if (operation.retainUntil <= now) releaseOperations.delete(trackedToken);
  }
  const existing = releaseOperations.get(token);
  if (existing) return existing.promise;
  if (releaseOperations.size >= MAX_TRACKED_LATTICE_RELEASE_OPERATIONS) return false;

  const promise = performLatticeLeaseRelease(token, wait);
  releaseOperations.set(token, {
    promise,
    retainUntil: now + RELEASE_OPERATION_RETENTION_SECONDS * 1_000,
  });
  return promise;
}
