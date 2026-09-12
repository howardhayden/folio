export const LATTICE_MODEL_RPC_CHANNEL = "text-to-lattice:model:v1";
export const LATTICE_MODEL_RPC_MAX_PENDING = 8;
export const LATTICE_MODEL_RPC_MAX_SERIALIZED_TEXT = 512_000;
export const LATTICE_MODEL_RPC_MAX_MESSAGE_TEXT = 256_000;
export const LATTICE_MODEL_RPC_MAX_RESPONSE_TEXT = 128_000;
export const LATTICE_MODEL_RPC_MAX_OUTPUT_TOKENS = 2_000;

const OPERATIONS = new Set(["probe", "cached", "prepare", "token-count", "complete", "interrupt", "unload"]);
const ROLES = new Set(["generator", "verifier"]);
const SCHEMAS = new Set(["analysis", "reanalysis", "candidate", "verification", "certification"]);
const MESSAGE_ROLES = new Set(["system", "user", "assistant"]);

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, required) {
  if (!record(value)) return false;
  const keys = Object.keys(value);
  return keys.length === required.length
    && required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function validId(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647;
}

function validText(value, maximum) {
  if (typeof value !== "string" || value.length > maximum) return false;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xD800 && unit <= 0xDBFF) {
      if (index + 1 >= value.length) return false;
      const next = value.charCodeAt(index + 1);
      if (next < 0xDC00 || next > 0xDFFF) return false;
      index += 1;
    } else if (unit >= 0xDC00 && unit <= 0xDFFF) {
      return false;
    }
  }
  return true;
}

function validRole(value) {
  return typeof value === "string" && ROLES.has(value);
}

function validEmptyPayload(payload) {
  return exactKeys(payload, []);
}

function validMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 8) return false;
  let total = 0;
  for (const message of messages) {
    if (!exactKeys(message, ["role", "content"])) return false;
    if (!MESSAGE_ROLES.has(message.role) || !validText(message.content, LATTICE_MODEL_RPC_MAX_MESSAGE_TEXT)) return false;
    total += message.content.length;
    if (total > LATTICE_MODEL_RPC_MAX_SERIALIZED_TEXT) return false;
  }
  return true;
}

function validRequestPayload(operation, payload) {
  switch (operation) {
    case "probe":
    case "cached":
    case "interrupt":
    case "unload":
      return validEmptyPayload(payload);
    case "prepare":
      return exactKeys(payload, ["role"]) && validRole(payload.role);
    case "token-count":
      return exactKeys(payload, ["role", "serialized"])
        && validRole(payload.role)
        && validText(payload.serialized, LATTICE_MODEL_RPC_MAX_SERIALIZED_TEXT);
    case "complete":
      return exactKeys(payload, ["role", "messages", "schema", "maxTokens"])
        && validRole(payload.role)
        && validMessages(payload.messages)
        && typeof payload.schema === "string"
        && SCHEMAS.has(payload.schema)
        && Number.isSafeInteger(payload.maxTokens)
        && payload.maxTokens > 0
        && payload.maxTokens <= LATTICE_MODEL_RPC_MAX_OUTPUT_TOKENS;
    default:
      return false;
  }
}

export function createLatticeModelRpcRequest(id, operation, payload) {
  const request = { channel: LATTICE_MODEL_RPC_CHANNEL, kind: "request", id, operation, payload };
  if (!parseLatticeModelRpcRequest(request)) {
    throw new TypeError("Text to Lattice rejected an invalid model-worker request.");
  }
  return request;
}

export function parseLatticeModelRpcRequest(value) {
  if (!exactKeys(value, ["channel", "kind", "id", "operation", "payload"])) return null;
  if (value.channel !== LATTICE_MODEL_RPC_CHANNEL || value.kind !== "request" || !validId(value.id)) return null;
  if (typeof value.operation !== "string" || !OPERATIONS.has(value.operation)) return null;
  return validRequestPayload(value.operation, value.payload) ? value : null;
}

function validError(value) {
  if (!record(value)) return false;
  const keys = Object.keys(value);
  if (!keys.every((key) => key === "name" || key === "message" || key === "code")) return false;
  if (!Object.prototype.hasOwnProperty.call(value, "name") || !Object.prototype.hasOwnProperty.call(value, "message")) return false;
  return validText(value.name, 80)
    && validText(value.message, 2_000)
    && (value.code === undefined || validText(value.code, 120));
}

function validResult(operation, value) {
  switch (operation) {
    case "probe":
      return exactKeys(value, ["supported", "reason"])
        && typeof value.supported === "boolean"
        && (value.reason === null || validText(value.reason, 120));
    case "cached":
      return typeof value === "boolean";
    case "prepare":
    case "interrupt":
    case "unload":
      return value === null;
    case "token-count":
      return Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;
    case "complete":
      return exactKeys(value, ["finishReason", "content"])
        && (value.finishReason === null || validText(value.finishReason, 80))
        && (value.content === null || validText(value.content, LATTICE_MODEL_RPC_MAX_RESPONSE_TEXT));
    default:
      return false;
  }
}

export function latticeModelRpcSuccess(id, operation, value) {
  if (!validId(id) || !OPERATIONS.has(operation) || !validResult(operation, value)) {
    throw new TypeError("Text to Lattice rejected an invalid model-worker result.");
  }
  return { channel: LATTICE_MODEL_RPC_CHANNEL, kind: "response", id, operation, ok: true, value };
}

export function latticeModelRpcFailure(id, operation, error) {
  if (!validId(id) || !OPERATIONS.has(operation) || !validError(error)) {
    throw new TypeError("Text to Lattice rejected an invalid model-worker error.");
  }
  return { channel: LATTICE_MODEL_RPC_CHANNEL, kind: "response", id, operation, ok: false, error };
}

export function latticeModelRpcStarted(id, operation) {
  if (!validId(id) || typeof operation !== "string" || !OPERATIONS.has(operation)) {
    throw new TypeError("Text to Lattice rejected an invalid model-worker start acknowledgement.");
  }
  return { channel: LATTICE_MODEL_RPC_CHANNEL, kind: "started", id, operation };
}

export function latticeModelRpcProgress(id, role, report) {
  if (!validId(id) || !validRole(role)) throw new TypeError("Text to Lattice rejected invalid model progress.");
  const progress = Number.isFinite(report?.progress) ? Math.max(0, Math.min(1, report.progress)) : null;
  const text = validText(report?.text, 500) ? report.text : "Loading local model data.";
  return { channel: LATTICE_MODEL_RPC_CHANNEL, kind: "progress", id, role, progress, text };
}

export function parseLatticeModelRpcMessage(value, expectedOperation) {
  if (!record(value) || value.channel !== LATTICE_MODEL_RPC_CHANNEL || !validId(value.id)) return null;
  if (value.kind === "started") {
    if (!exactKeys(value, ["channel", "kind", "id", "operation"])) return null;
    return value.operation === expectedOperation && OPERATIONS.has(value.operation) ? value : null;
  }
  if (value.kind === "progress") {
    if (!exactKeys(value, ["channel", "kind", "id", "role", "progress", "text"])) return null;
    if (!validRole(value.role) || (value.progress !== null && (!Number.isFinite(value.progress) || value.progress < 0 || value.progress > 1))) return null;
    return validText(value.text, 500) ? value : null;
  }
  if (value.kind !== "response") return null;
  if (value.operation !== expectedOperation || !OPERATIONS.has(value.operation)) return null;
  if (value.ok === true) {
    if (!exactKeys(value, ["channel", "kind", "id", "operation", "ok", "value"])) return null;
    return validResult(value.operation, value.value) ? value : null;
  }
  if (value.ok === false) {
    if (!exactKeys(value, ["channel", "kind", "id", "operation", "ok", "error"])) return null;
    return validError(value.error) ? value : null;
  }
  return null;
}

export function serializeLatticeModelError(error) {
  let candidateName;
  let candidateMessage;
  let candidateCode;
  try {
    candidateName = error?.name;
    candidateMessage = error?.message;
    candidateCode = error?.code;
  } catch {
    // A hostile accessor on an exception cannot break the worker protocol.
  }
  const name = validText(candidateName, 80) && candidateName ? candidateName : "Error";
  const message = validText(candidateMessage, 2_000) && candidateMessage
    ? candidateMessage
    : "The local model worker could not complete the request.";
  const serialized = { name, message };
  if (validText(candidateCode, 120) && candidateCode) serialized.code = candidateCode;
  return serialized;
}

export function deserializeLatticeModelError(value) {
  if (!validError(value)) return new Error("The local model worker returned an invalid error.");
  let error;
  if (value.name === "AbortError" && typeof DOMException === "function") {
    error = new DOMException(value.message, "AbortError");
  } else if (value.name === "RangeError") {
    error = new RangeError(value.message);
  } else if (value.name === "TypeError") {
    error = new TypeError(value.message);
  } else {
    error = new Error(value.message);
    error.name = value.name;
  }
  if (value.code) error.code = value.code;
  return error;
}
