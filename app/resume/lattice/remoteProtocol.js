export const LATTICE_API_PATH = "/api/lattice";
export const LATTICE_API_SCHEMA_VERSION = 1;
export const LATTICE_REQUEST_MODES = Object.freeze(["auto", "operative", "experiential"]);
export const LATTICE_REQUEST_FIELDS = Object.freeze(["text", "requested_mode", "schema_version"]);
export const LATTICE_RESULT_VERSION = "text-to-lattice.v7";
export const LATTICE_API_ERROR_CODES = Object.freeze([
  "invalid_request",
  "input_too_large",
  "rate_limited",
  "upstream_timeout",
  "upstream_unavailable",
  "malformed_upstream_response",
  "internal_error",
  "unsupported_media_type",
]);

const RESULT_FIELDS = Object.freeze([
  "version",
  "status",
  "text",
  "wordCount",
  "primaryLayer",
  "layerId",
  "layerLabel",
  "layersUsed",
  "passageCount",
  "revisedPassageCount",
  "retainedPassageCount",
  "batchCount",
  "verificationPasses",
  "findings",
  "questions",
]);
const RESULT_STATUSES = new Set([
  "translated",
  "conformant-for-context",
  "review-required",
  "unable-to-attempt",
]);
const RESULT_LAYERS = new Set(["operative", "experiential", "interpretive", "mixed", "accessibility"]);
const FINDING_FIELDS = Object.freeze(["id", "passageId", "atomIds", "message"]);
const API_ERROR_CODES = new Set(LATTICE_API_ERROR_CODES);

export function exactRecord(value, fields) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === fields.length
    && fields.every((field) => Object.prototype.hasOwnProperty.call(value, field));
}

export function isLatticeApiRequest(value) {
  return exactRecord(value, LATTICE_REQUEST_FIELDS)
    && typeof value.text === "string"
    && LATTICE_REQUEST_MODES.includes(value.requested_mode)
    && value.schema_version === LATTICE_API_SCHEMA_VERSION;
}

export function isLatticeApiError(value) {
  if (exactRecord(value, ["error"])) return API_ERROR_CODES.has(value.error);
  return exactRecord(value, ["error", "retry_after_seconds"])
    && value.error === "rate_limited"
    && Number.isSafeInteger(value.retry_after_seconds)
    && value.retry_after_seconds >= 1
    && value.retry_after_seconds <= 300;
}

function boundedText(value, maximum, { empty = false } = {}) {
  return typeof value === "string"
    && value.length <= maximum
    && (empty || value.trim().length > 0);
}

function validFinding(value) {
  return exactRecord(value, FINDING_FIELDS)
    && boundedText(value.id, 200)
    && boundedText(value.passageId, 200, { empty: true })
    && boundedText(value.message, 1_000)
    && Array.isArray(value.atomIds)
    && value.atomIds.length === 0;
}

export function isLatticeApiResult(value) {
  if (!exactRecord(value, RESULT_FIELDS)
    || value.version !== LATTICE_RESULT_VERSION
    || !RESULT_STATUSES.has(value.status)
    || !boundedText(value.layerLabel, 120)
    || !Array.isArray(value.layersUsed)
    || value.layersUsed.length > RESULT_LAYERS.size
    || new Set(value.layersUsed).size !== value.layersUsed.length
    || !value.layersUsed.every((layer) => RESULT_LAYERS.has(layer))
    || !Array.isArray(value.findings)
    || value.findings.length > 128
    || !value.findings.every(validFinding)
    || !Array.isArray(value.questions)
    || value.questions.length !== 0) {
    return false;
  }

  const integers = [
    value.wordCount,
    value.passageCount,
    value.revisedPassageCount,
    value.retainedPassageCount,
    value.batchCount,
    value.verificationPasses,
  ];
  if (!integers.every((item) => Number.isSafeInteger(item) && item >= 0)
    || value.wordCount < 1 || value.wordCount > 700
    || value.passageCount < 1 || value.passageCount > 64
    || value.revisedPassageCount > value.passageCount
    || value.retainedPassageCount > value.passageCount
    || value.revisedPassageCount + value.retainedPassageCount > value.passageCount
    || value.batchCount > 64
    || value.verificationPasses > 2) {
    return false;
  }

  if (value.status === "unable-to-attempt") {
    return value.text === null
      && value.primaryLayer === null
      && value.layerId === null
      && value.layersUsed.length === 0;
  }
  return boundedText(value.text, 48_000)
    && RESULT_LAYERS.has(value.primaryLayer)
    && value.layerId === value.primaryLayer
    && value.layersUsed.includes(value.primaryLayer);
}
