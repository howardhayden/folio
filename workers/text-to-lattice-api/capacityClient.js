import {
  LATTICE_TRANSFORMATION_CAPACITY_DAY_MS,
  LATTICE_TRANSFORMATION_CAPACITY_SCHEMA_VERSION,
  isLatticeCapacityVisitorId,
} from "./capacityPolicy.js";

export const LATTICE_TRANSFORMATION_CAPACITY_BINDING = "LATTICE_TRANSFORMATION_BUDGET";
export const LATTICE_TRANSFORMATION_CAPACITY_OBJECT_NAME =
  "text-to-lattice-transformation-budget-v1";
export const LATTICE_TRANSFORMATION_CAPACITY_INTERNAL_URL =
  "https://text-to-lattice-capacity.internal/admit";
export const LATTICE_TRANSFORMATION_VISITOR_HEADER = "X-Lattice-Visitor";

const CAPACITY_RESPONSE_CHARACTER_LIMIT = 256;
const CAPACITY_JSON_CONTENT_TYPE = /^application\/json(?:\s*;\s*charset=utf-8)?$/iu;

function exactRecord(value, fields) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === fields.length
    && fields.every((field) => Object.prototype.hasOwnProperty.call(value, field));
}

function unavailable() {
  return new Error("The transformation-capacity gate is unavailable.");
}

function discardBody(response) {
  try {
    const cancellation = response?.body?.cancel();
    cancellation?.catch(() => {});
  } catch {
    // A rejected internal response is never logged or reflected.
  }
}

export async function claimGlobalLatticeTransformation(namespace, visitorId, signal) {
  if (!namespace || typeof namespace.getByName !== "function"
    || !isLatticeCapacityVisitorId(visitorId)) throw unavailable();

  let gate;
  try {
    gate = namespace.getByName(LATTICE_TRANSFORMATION_CAPACITY_OBJECT_NAME);
  } catch {
    throw unavailable();
  }
  if (!gate || typeof gate.fetch !== "function") throw unavailable();

  let response;
  try {
    response = await gate.fetch(new Request(LATTICE_TRANSFORMATION_CAPACITY_INTERNAL_URL, {
      method: "POST",
      headers: { [LATTICE_TRANSFORMATION_VISITOR_HEADER]: visitorId },
      cache: "no-store",
      credentials: "omit",
      // Workerd does not implement Fetch's `error` redirect mode. Manual mode
      // keeps redirects observable so the closed 200/429 response contract
      // below rejects them without following an unreviewed destination.
      redirect: "manual",
      referrer: "",
      referrerPolicy: "no-referrer",
      signal,
    }));
  } catch {
    if (signal?.aborted) throw signal.reason;
    throw unavailable();
  }
  if (!(response instanceof Response)
    || ![200, 429].includes(response.status)
    || !CAPACITY_JSON_CONTENT_TYPE.test(response.headers.get("content-type") ?? "")) {
    discardBody(response);
    throw unavailable();
  }

  let bodyText;
  try {
    bodyText = await response.text();
  } catch {
    if (signal?.aborted) throw signal.reason;
    throw unavailable();
  }
  if (bodyText.length > CAPACITY_RESPONSE_CHARACTER_LIMIT) throw unavailable();

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw unavailable();
  }
  if (response.status === 200
    && exactRecord(body, ["allowed", "schema_version"])
    && body.allowed === true
    && body.schema_version === LATTICE_TRANSFORMATION_CAPACITY_SCHEMA_VERSION) {
    return Object.freeze({ allowed: true, retryAfterSeconds: null });
  }
  if (response.status === 429
    && exactRecord(body, ["allowed", "scope", "retry_after_seconds", "schema_version"])
    && body.allowed === false
    && ["global-day", "visitor-day"].includes(body.scope)
    && Number.isSafeInteger(body.retry_after_seconds)
    && body.retry_after_seconds >= 1
    && body.retry_after_seconds <= LATTICE_TRANSFORMATION_CAPACITY_DAY_MS / 1_000
    && body.schema_version === LATTICE_TRANSFORMATION_CAPACITY_SCHEMA_VERSION) {
    return Object.freeze({
      allowed: false,
      retryAfterSeconds: body.retry_after_seconds <= 300
        ? body.retry_after_seconds
        : null,
    });
  }
  throw unavailable();
}
