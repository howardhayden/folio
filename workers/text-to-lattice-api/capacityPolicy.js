export const LATTICE_TRANSFORMATION_CAPACITY_SCHEMA_VERSION = 1;
export const LATTICE_TRANSFORMATIONS_PER_UTC_DAY = 30;
export const LATTICE_TRANSFORMATIONS_PER_VISITOR_UTC_DAY = 3;
export const LATTICE_TRANSFORMATION_CAPACITY_DAY_MS = 24 * 60 * 60 * 1_000;

const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{24}$/u;
const STATE_FIELDS = Object.freeze([
  "version",
  "dayStartedAt",
  "acceptedTransformations",
  "visitorTransformations",
]);

function exactRecord(value, fields) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === fields.length
    && fields.every((field) => Object.prototype.hasOwnProperty.call(value, field));
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function utcDayStart(now) {
  return Math.floor(now / LATTICE_TRANSFORMATION_CAPACITY_DAY_MS)
    * LATTICE_TRANSFORMATION_CAPACITY_DAY_MS;
}

export function isLatticeCapacityVisitorId(value) {
  return typeof value === "string" && VISITOR_ID_PATTERN.test(value);
}

function freshState(dayStartedAt) {
  return {
    version: LATTICE_TRANSFORMATION_CAPACITY_SCHEMA_VERSION,
    dayStartedAt,
    acceptedTransformations: 0,
    visitorTransformations: {},
  };
}

function copyStoredState(value) {
  if (!exactRecord(value, STATE_FIELDS)
    || value.version !== LATTICE_TRANSFORMATION_CAPACITY_SCHEMA_VERSION
    || !nonNegativeInteger(value.dayStartedAt)
    || value.dayStartedAt % LATTICE_TRANSFORMATION_CAPACITY_DAY_MS !== 0
    || !nonNegativeInteger(value.acceptedTransformations)
    || value.acceptedTransformations > LATTICE_TRANSFORMATIONS_PER_UTC_DAY
    || value.visitorTransformations === null
    || typeof value.visitorTransformations !== "object"
    || Array.isArray(value.visitorTransformations)) {
    throw new TypeError("The transformation-capacity state is invalid.");
  }

  const visitorTransformations = {};
  let visitorTotal = 0;
  for (const [visitorId, count] of Object.entries(value.visitorTransformations)) {
    if (!isLatticeCapacityVisitorId(visitorId)
      || !Number.isSafeInteger(count)
      || count < 1
      || count > LATTICE_TRANSFORMATIONS_PER_VISITOR_UTC_DAY) {
      throw new TypeError("The transformation-capacity visitor state is invalid.");
    }
    visitorTransformations[visitorId] = count;
    visitorTotal += count;
  }
  if (visitorTotal !== value.acceptedTransformations
    || Object.keys(visitorTransformations).length > LATTICE_TRANSFORMATIONS_PER_UTC_DAY) {
    throw new TypeError("The transformation-capacity totals are inconsistent.");
  }

  return {
    ...value,
    visitorTransformations,
  };
}

export function latticeTransformationStateExpiresAt(storedState) {
  if (storedState === undefined) return null;
  const state = copyStoredState(storedState);
  return state.dayStartedAt + LATTICE_TRANSFORMATION_CAPACITY_DAY_MS;
}

function retryAfterSeconds(now, dayStartedAt) {
  return Math.max(1, Math.ceil(
    (dayStartedAt + LATTICE_TRANSFORMATION_CAPACITY_DAY_MS - now) / 1_000,
  ));
}

function frozenState(state) {
  return Object.freeze({
    ...state,
    visitorTransformations: Object.freeze({ ...state.visitorTransformations }),
  });
}

function denied(state, stateChanged, scope, now) {
  return Object.freeze({
    state: frozenState(state),
    stateChanged,
    result: Object.freeze({
      allowed: false,
      scope,
      retryAfterSeconds: retryAfterSeconds(now, state.dayStartedAt),
    }),
  });
}

export function claimLatticeTransformation(storedState, { now, visitorId }) {
  if (!nonNegativeInteger(now) || !isLatticeCapacityVisitorId(visitorId)) {
    throw new TypeError("The transformation-capacity claim is invalid.");
  }

  const dayStartedAt = utcDayStart(now);
  let state = storedState === undefined
    ? freshState(dayStartedAt)
    : copyStoredState(storedState);
  let stateChanged = false;

  if (state.dayStartedAt > dayStartedAt) {
    throw new TypeError("The transformation-capacity clock moved backwards.");
  }
  if (state.dayStartedAt < dayStartedAt) {
    state = freshState(dayStartedAt);
    stateChanged = true;
  }

  if (state.acceptedTransformations >= LATTICE_TRANSFORMATIONS_PER_UTC_DAY) {
    return denied(state, stateChanged, "global-day", now);
  }
  const visitorCount = state.visitorTransformations[visitorId] ?? 0;
  if (visitorCount >= LATTICE_TRANSFORMATIONS_PER_VISITOR_UTC_DAY) {
    return denied(state, stateChanged, "visitor-day", now);
  }

  state.acceptedTransformations += 1;
  state.visitorTransformations[visitorId] = visitorCount + 1;
  return Object.freeze({
    state: frozenState(state),
    stateChanged: true,
    result: Object.freeze({
      allowed: true,
      scope: null,
      retryAfterSeconds: null,
    }),
  });
}
