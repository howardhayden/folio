import { LATTICE_USAGE_POLICY } from "../../app/resume/lattice/usagePolicy.js";

export { LATTICE_USAGE_POLICY } from "../../app/resume/lattice/usagePolicy.js";

const POLICY_VERSION = 4;
const OWNER_BOUND_POLICY_VERSION = 3;
const REQUEST_ADMISSION_POLICY_VERSION = 3;
const PREVIOUS_POLICY_VERSION = 2;
const LEGACY_POLICY_VERSION = 1;
const UTC_DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;

export function createUsageState() {
  return {
    version: POLICY_VERSION,
    requestTimes: [],
    admissionDay: null,
    attemptTimes: [],
    grantTimes: [],
    visitors: {},
    leases: {},
  };
}

function utcDayStart(now) {
  return Math.floor(now / UTC_DAY_MILLISECONDS) * UTC_DAY_MILLISECONDS;
}

function copyAdmissionDay(value, label) {
  if (!isRecord(value)) throw new TypeError(`${label} must be a daily admission record.`);
  const startedAt = assertTimestamp(value.startedAt, `${label}.startedAt`);
  const count = assertTimestamp(value.count, `${label}.count`);
  if (startedAt % UTC_DAY_MILLISECONDS !== 0 || count < 1) {
    throw new TypeError(`${label} is invalid.`);
  }
  return { startedAt, count };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertTimestamp(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer.`);
  }
  return value;
}

function assertToken(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{20,128}$/u.test(value)) {
    throw new TypeError(`${label} is invalid.`);
  }
  return value;
}

function copyTimestamps(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return value
    .map((item, index) => assertTimestamp(item, `${label}[${index}]`))
    .sort((left, right) => left - right);
}

function copyLease(value, label, version) {
  if (version === LEGACY_POLICY_VERSION) {
    const expiresAt = assertTimestamp(value, `${label}.expiresAt`);
    const startedAt = Math.max(0, expiresAt - LATTICE_USAGE_POLICY.activeLeases.ttlSeconds * 1_000);
    return {
      visitorId: null,
      startedAt,
      lastRenewedAt: startedAt,
      expiresAt,
      maximumExpiresAt: expiresAt,
    };
  }
  if (!isRecord(value)) throw new TypeError(`${label} must be a lease lifecycle record.`);
  const startedAt = assertTimestamp(value.startedAt, `${label}.startedAt`);
  const lastRenewedAt = assertTimestamp(value.lastRenewedAt, `${label}.lastRenewedAt`);
  const expiresAt = assertTimestamp(value.expiresAt, `${label}.expiresAt`);
  const maximumExpiresAt = assertTimestamp(value.maximumExpiresAt, `${label}.maximumExpiresAt`);
  const visitorId = version >= OWNER_BOUND_POLICY_VERSION && value.visitorId !== null
    ? assertToken(value.visitorId, `${label}.visitorId`)
    : null;
  if (!(startedAt <= lastRenewedAt && lastRenewedAt <= expiresAt && expiresAt <= maximumExpiresAt)) {
    throw new TypeError(`${label} has an invalid lifecycle order.`);
  }
  return { visitorId, startedAt, lastRenewedAt, expiresAt, maximumExpiresAt };
}

export function copyUsageState(value, migrationNow) {
  if (value === undefined) return createUsageState();
  if (
    !isRecord(value)
    || ![
      LEGACY_POLICY_VERSION,
      PREVIOUS_POLICY_VERSION,
      REQUEST_ADMISSION_POLICY_VERSION,
      POLICY_VERSION,
    ].includes(value.version)
  ) {
    throw new TypeError("Usage state is invalid or has an unsupported version.");
  }
  if (!isRecord(value.visitors) || !isRecord(value.leases)) {
    throw new TypeError("Usage state maps are invalid.");
  }

  const visitors = {};
  for (const [visitorId, timestamps] of Object.entries(value.visitors)) {
    assertToken(visitorId, "visitor id");
    visitors[visitorId] = copyTimestamps(timestamps, `visitors.${visitorId}`);
  }

  const leases = {};
  for (const [leaseToken, lease] of Object.entries(value.leases)) {
    assertToken(leaseToken, "lease token");
    leases[leaseToken] = copyLease(lease, `leases.${leaseToken}`, value.version);
  }

  let admissionDay = null;
  if (value.version === POLICY_VERSION) {
    admissionDay = value.admissionDay !== null
      ? copyAdmissionDay(value.admissionDay, "admissionDay")
      : null;
  } else {
    // Earlier schemas did not carry an exact UTC-day admission count. Never
    // reinterpret that unknown use as zero: saturate the current day during
    // the first mutation and allow normal rollover at the next 00:00 UTC.
    assertTimestamp(migrationNow, "migrationNow");
    admissionDay = {
      startedAt: utcDayStart(migrationNow),
      count: LATTICE_USAGE_POLICY.globalDailyRequests.limit,
    };
  }

  return {
    version: POLICY_VERSION,
    requestTimes: value.version >= REQUEST_ADMISSION_POLICY_VERSION
      ? copyTimestamps(value.requestTimes, "requestTimes")
      : [],
    admissionDay,
    attemptTimes: copyTimestamps(value.attemptTimes, "attemptTimes"),
    grantTimes: copyTimestamps(value.grantTimes, "grantTimes"),
    visitors,
    leases,
  };
}

function withinWindow(timestamps, now, windowSeconds, label) {
  if (timestamps.some((timestamp) => timestamp > now)) {
    throw new TypeError(`${label} cannot contain a future timestamp.`);
  }
  const cutoff = now - windowSeconds * 1_000;
  return timestamps.filter((timestamp) => timestamp > cutoff);
}

function retryAfterSeconds(timestamp, now, windowSeconds) {
  return Math.max(1, Math.ceil((timestamp + windowSeconds * 1_000 - now) / 1_000));
}

function deny(state, code, retryAfter, stateChanged = true) {
  return {
    state,
    stateChanged,
    result: {
      allowed: false,
      code,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfter)),
      policy: LATTICE_USAGE_POLICY,
    },
  };
}

function pruneState(state, now) {
  let stateChanged = false;

  const currentDayStart = utcDayStart(now);
  if (state.admissionDay !== null && state.admissionDay.startedAt > currentDayStart) {
    throw new TypeError("admissionDay cannot begin after the current UTC day.");
  }
  if (state.admissionDay !== null && state.admissionDay.startedAt < currentDayStart) {
    state.admissionDay = null;
    stateChanged = true;
  }

  const requestTimes = withinWindow(
    state.requestTimes,
    now,
    LATTICE_USAGE_POLICY.globalRequests.windowSeconds,
    "requestTimes",
  );
  if (requestTimes.length !== state.requestTimes.length) stateChanged = true;
  state.requestTimes = requestTimes;

  const attemptTimes = withinWindow(
    state.attemptTimes,
    now,
    LATTICE_USAGE_POLICY.globalAttempts.windowSeconds,
    "attemptTimes",
  );
  if (attemptTimes.length !== state.attemptTimes.length) stateChanged = true;
  state.attemptTimes = attemptTimes;

  const grantTimes = withinWindow(
    state.grantTimes,
    now,
    LATTICE_USAGE_POLICY.globalGrants.windowSeconds,
    "grantTimes",
  );
  if (grantTimes.length !== state.grantTimes.length) stateChanged = true;
  state.grantTimes = grantTimes;

  for (const [visitorId, timestamps] of Object.entries(state.visitors)) {
    const retained = withinWindow(
      timestamps,
      now,
      LATTICE_USAGE_POLICY.visitor.windowSeconds,
      `visitors.${visitorId}`,
    );
    if (retained.length !== timestamps.length) stateChanged = true;
    if (retained.length > 0) {
      state.visitors[visitorId] = retained;
    } else {
      delete state.visitors[visitorId];
      stateChanged = true;
    }
  }
  for (const [leaseToken, lease] of Object.entries(state.leases)) {
    if (lease.startedAt > now || lease.lastRenewedAt > now) {
      throw new TypeError(`leases.${leaseToken} cannot begin or renew in the future.`);
    }
    if (lease.expiresAt <= now || lease.maximumExpiresAt <= now) {
      delete state.leases[leaseToken];
      stateChanged = true;
    }
  }
  return { state, stateChanged };
}

export function admitUsageRequest(storedState, { now }) {
  assertTimestamp(now, "now");
  const migratedDailyAdmission = storedState !== undefined
    && storedState?.version !== POLICY_VERSION;
  const { state, stateChanged: pruned } = pruneState(copyUsageState(storedState, now), now);
  const dailyRequestPolicy = LATTICE_USAGE_POLICY.globalDailyRequests;
  const admissionDay = state.admissionDay ?? {
    startedAt: utcDayStart(now),
    count: 0,
  };
  if (admissionDay.count >= dailyRequestPolicy.limit) {
    return deny(
      state,
      "global-request-day-limit",
      Math.max(1, Math.ceil(
        (admissionDay.startedAt + dailyRequestPolicy.windowSeconds * 1_000 - now) / 1_000,
      )),
      pruned || migratedDailyAdmission,
    );
  }
  const requestPolicy = LATTICE_USAGE_POLICY.globalRequests;
  if (state.requestTimes.length >= requestPolicy.limit) {
    return deny(
      state,
      "global-request-minute-limit",
      retryAfterSeconds(state.requestTimes[0], now, requestPolicy.windowSeconds),
      pruned,
    );
  }
  state.requestTimes.push(now);
  state.admissionDay = {
    startedAt: admissionDay.startedAt,
    count: admissionDay.count + 1,
  };
  return {
    state,
    stateChanged: true,
    result: {
      allowed: true,
      policy: LATTICE_USAGE_POLICY,
    },
  };
}

export function acquireDemoLease(storedState, { now, visitorId, leaseToken }) {
  assertTimestamp(now, "now");
  assertToken(visitorId, "visitor id");
  assertToken(leaseToken, "lease token");
  const { state, stateChanged: pruned } = pruneState(copyUsageState(storedState, now), now);

  const visitorPolicy = LATTICE_USAGE_POLICY.visitor;
  const visitorTimes = state.visitors[visitorId] ?? [];
  if (visitorTimes.length >= visitorPolicy.limit) {
    return deny(
      state,
      "visitor-day-limit",
      retryAfterSeconds(visitorTimes[0], now, visitorPolicy.windowSeconds),
      pruned,
    );
  }

  const globalPolicy = LATTICE_USAGE_POLICY.globalGrants;
  if (state.grantTimes.length >= globalPolicy.limit) {
    return deny(
      state,
      "global-day-limit",
      retryAfterSeconds(state.grantTimes[0], now, globalPolicy.windowSeconds),
      pruned,
    );
  }

  const activePolicy = LATTICE_USAGE_POLICY.activeLeases;
  const ownerlessLeaseExpirations = Object.values(state.leases)
    .filter((lease) => lease.visitorId === null)
    .map(({ expiresAt }) => expiresAt)
    .sort((left, right) => left - right);
  if (ownerlessLeaseExpirations.length > 0) {
    return deny(
      state,
      "active-lease-migration",
      Math.max(1, Math.ceil((ownerlessLeaseExpirations[0] - now) / 1_000)),
      pruned,
    );
  }
  const visitorActiveExpirations = Object.values(state.leases)
    .filter((lease) => lease.visitorId === visitorId)
    .map(({ expiresAt }) => expiresAt)
    .sort((left, right) => left - right);
  if (visitorActiveExpirations.length >= activePolicy.perVisitorLimit) {
    return deny(
      state,
      "visitor-active-lease-limit",
      Math.max(1, Math.ceil((visitorActiveExpirations[0] - now) / 1_000)),
      pruned,
    );
  }
  const activeExpirations = Object.values(state.leases)
    .map(({ expiresAt }) => expiresAt)
    .sort((left, right) => left - right);
  if (activeExpirations.length >= activePolicy.limit) {
    return deny(
      state,
      "active-lease-limit",
      Math.max(1, Math.ceil((activeExpirations[0] - now) / 1_000)),
      pruned,
    );
  }

  // Only an otherwise grant-eligible visitor can consume the shared attempt
  // window. A visitor already at a personal, daily, or concurrency ceiling
  // must not be able to keep unrelated visitors out of that window.
  const attemptPolicy = LATTICE_USAGE_POLICY.globalAttempts;
  if (state.attemptTimes.length >= attemptPolicy.limit) {
    return deny(
      state,
      "global-minute-limit",
      retryAfterSeconds(state.attemptTimes[0], now, attemptPolicy.windowSeconds),
      pruned,
    );
  }
  state.attemptTimes.push(now);

  const expiresAt = now + activePolicy.ttlSeconds * 1_000;
  const maximumExpiresAt = now + activePolicy.maximumLifetimeSeconds * 1_000;
  visitorTimes.push(now);
  state.visitors[visitorId] = visitorTimes;
  state.grantTimes.push(now);
  state.leases[leaseToken] = {
    visitorId,
    startedAt: now,
    lastRenewedAt: now,
    expiresAt,
    maximumExpiresAt,
  };
  return {
    state,
    stateChanged: true,
    result: {
      allowed: true,
      leaseToken,
      expiresAt,
      maximumExpiresAt,
      leaseSecondsRemaining: activePolicy.ttlSeconds,
      policy: LATTICE_USAGE_POLICY,
    },
  };
}

export function renewDemoLease(storedState, { now, leaseToken }) {
  assertTimestamp(now, "now");
  assertToken(leaseToken, "lease token");
  const { state, stateChanged: pruned } = pruneState(copyUsageState(storedState, now), now);
  const lease = state.leases[leaseToken];
  if (!lease) return deny(state, "lease-not-active", 1, pruned);

  const activePolicy = LATTICE_USAGE_POLICY.activeLeases;
  const nextAllowedAt = lease.lastRenewedAt + activePolicy.minimumRenewalIntervalSeconds * 1_000;
  if (now < nextAllowedAt) {
    return deny(
      state,
      "lease-renewal-too-soon",
      Math.max(1, Math.ceil((nextAllowedAt - now) / 1_000)),
      pruned,
    );
  }

  const expiresAt = Math.min(
    now + activePolicy.ttlSeconds * 1_000,
    lease.maximumExpiresAt,
  );
  const leaseSecondsRemaining = Math.floor((expiresAt - now) / 1_000);
  if (leaseSecondsRemaining < 1) {
    return deny(state, "lease-maximum-lifetime", 1, pruned);
  }
  state.leases[leaseToken] = {
    ...lease,
    lastRenewedAt: now,
    expiresAt,
  };
  return {
    state,
    stateChanged: true,
    result: {
      allowed: true,
      leaseToken,
      expiresAt,
      maximumExpiresAt: lease.maximumExpiresAt,
      leaseSecondsRemaining,
      policy: LATTICE_USAGE_POLICY,
    },
  };
}

export function releaseDemoLease(storedState, { now, leaseToken }) {
  assertTimestamp(now, "now");
  assertToken(leaseToken, "lease token");
  const { state, stateChanged: pruned } = pruneState(copyUsageState(storedState, now), now);
  const released = Object.hasOwn(state.leases, leaseToken);
  delete state.leases[leaseToken];
  return { state, released, stateChanged: pruned || released };
}

export function inspectUsageState(storedState, now) {
  assertTimestamp(now, "now");
  return pruneState(copyUsageState(storedState, now), now).state;
}

export function nextUsageExpiry(storedState) {
  const state = copyUsageState(storedState);
  const expirations = [
    ...state.requestTimes.map(
      (timestamp) => timestamp + LATTICE_USAGE_POLICY.globalRequests.windowSeconds * 1_000,
    ),
    ...(state.admissionDay === null ? [] : [
      state.admissionDay.startedAt + LATTICE_USAGE_POLICY.globalDailyRequests.windowSeconds * 1_000,
    ]),
    ...state.attemptTimes.map(
      (timestamp) => timestamp + LATTICE_USAGE_POLICY.globalAttempts.windowSeconds * 1_000,
    ),
    ...state.grantTimes.map(
      (timestamp) => timestamp + LATTICE_USAGE_POLICY.globalGrants.windowSeconds * 1_000,
    ),
    ...Object.values(state.visitors).flatMap((timestamps) => timestamps.map(
      (timestamp) => timestamp + LATTICE_USAGE_POLICY.visitor.windowSeconds * 1_000,
    )),
    ...Object.values(state.leases).map(({ expiresAt }) => expiresAt),
  ];
  return expirations.length > 0 ? Math.min(...expirations) : null;
}

export function usageStateIsEmpty(storedState) {
  const state = copyUsageState(storedState);
  return state.requestTimes.length === 0
    && state.admissionDay === null
    && state.attemptTimes.length === 0
    && state.grantTimes.length === 0
    && Object.keys(state.visitors).length === 0
    && Object.keys(state.leases).length === 0;
}
