import { LATTICE_VISITOR_SESSION_ACCEPT } from "../resume/lattice/remoteProtocol.js";

const TEXT_TO_LATTICE_CAPABILITY = Object.freeze({
  id: "text-to-lattice",
  allowedOrigin: "https://hah.dev",
  route: "/api/lattice",
  method: "POST",
  trigger: "explicit-user-submit",
  sameOriginOnly: true,
  transmitsUserContent: true,
  transmittedFields: Object.freeze(["text", "requested_mode", "schema_version"]),
  retainedByApplication: false,
  credentialMode: "same-origin",
  browserOwnedCookie: Object.freeze({
    name: "__Secure-hah-lattice-api-visitor",
    path: "/api/lattice",
    purpose: "per-browser-utc-day-request-limit",
    httpOnly: true,
    containsUserContent: false,
    expiresAtNextUtcDay: true,
  }),
  visitorSessionSetup: Object.freeze({
    accept: LATTICE_VISITOR_SESSION_ACCEPT,
    sameRoute: true,
    transmitsUserContent: false,
    hasBody: false,
    hasContentType: false,
  }),
  automaticRetry: false,
  alternateProviderFallback: false,
});

export const REMOTE_CAPABILITIES = Object.freeze({
  textToLattice: TEXT_TO_LATTICE_CAPABILITY,
});

const CAPABILITY_POLICY = new Map([
  [TEXT_TO_LATTICE_CAPABILITY.id, TEXT_TO_LATTICE_CAPABILITY],
]);

export class NetworkPolicyError extends Error {
  constructor(reason) {
    super(`Network policy denied text-to-lattice: ${reason}`);
    this.name = "NetworkPolicyError";
    this.code = "network_policy_denied";
  }
}

function requiredOrigin(policy, baseOrigin) {
  let browserOrigin;
  if (typeof window !== "undefined") {
    browserOrigin = window.location?.origin;
    if (typeof browserOrigin !== "string" || !browserOrigin) {
      throw new NetworkPolicyError("a trusted browser origin is required");
    }
    if (baseOrigin !== undefined && baseOrigin !== browserOrigin) {
      throw new NetworkPolicyError("the browser origin cannot be overridden");
    }
  }
  const value = browserOrigin ?? baseOrigin;
  if (typeof value !== "string" || !value) {
    throw new NetworkPolicyError("a trusted browser origin is required");
  }
  let origin;
  try {
    origin = new URL(value).origin;
  } catch {
    throw new NetworkPolicyError("the trusted browser origin is invalid");
  }
  if (origin !== value) {
    throw new NetworkPolicyError("the trusted browser origin is not canonical");
  }
  if (origin !== policy.allowedOrigin) {
    throw new NetworkPolicyError("the canonical hah.dev origin is required");
  }
  return origin;
}

function exactObjectFields(value, fields) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === fields.length
    && fields.every((field) => Object.prototype.hasOwnProperty.call(value, field));
}

function validateTextToLatticeRequest(policy, headerInit, body) {
  let headers;
  try {
    headers = new Headers(headerInit);
  } catch {
    throw new NetworkPolicyError("invalid headers");
  }
  const headerNames = [...headers.keys()];
  if (headerNames.length === 1
    && headerNames[0] === "accept"
    && headers.get("accept")?.toLowerCase() === policy.visitorSessionSetup.accept
    && body === undefined) {
    return "visitor-session-setup";
  }

  const allowedContentHeaders = new Set(["accept", "content-type"]);
  if (headerNames.length !== allowedContentHeaders.size
    || headerNames.some((name) => !allowedContentHeaders.has(name))) {
    throw new NetworkPolicyError("undeclared header");
  }
  if (headers.get("content-type")?.toLowerCase() !== "application/json") {
    throw new NetworkPolicyError("content type must be application/json");
  }
  if (headers.get("accept")?.toLowerCase() !== "application/json") {
    throw new NetworkPolicyError("response type must be application/json");
  }
  if (typeof body !== "string"
    || body.length > 65_536
    || new TextEncoder().encode(body).byteLength > 65_536) {
    throw new NetworkPolicyError("invalid request body");
  }
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new NetworkPolicyError("request body must be JSON");
  }
  if (!exactObjectFields(payload, policy.transmittedFields)
    || typeof payload.text !== "string"
    || !["auto", "operative", "experiential"].includes(payload.requested_mode)
    || payload.schema_version !== 1) {
    throw new NetworkPolicyError("undeclared payload");
  }
  return "content";
}

export async function capabilityFetch(
  capability,
  input,
  init = {},
  { baseOrigin, fetchImpl = globalThis.fetch } = {},
) {
  const policy = CAPABILITY_POLICY.get(capability);
  if (!policy) throw new NetworkPolicyError("undeclared capability");
  if (typeof fetchImpl !== "function") throw new NetworkPolicyError("fetch is unavailable");
  if (init === null || typeof init !== "object" || Array.isArray(init)) {
    throw new NetworkPolicyError("invalid request options");
  }

  const origin = requiredOrigin(policy, baseOrigin);
  if (input !== policy.route) {
    throw new NetworkPolicyError("undeclared route");
  }
  const url = new URL(policy.route, `${origin}/`);
  const allowedOptions = new Set([
    "body",
    "cache",
    "credentials",
    "headers",
    "keepalive",
    "method",
    "mode",
    "redirect",
    "referrer",
    "referrerPolicy",
    "signal",
  ]);
  if (Object.keys(init).some((name) => !allowedOptions.has(name))) {
    throw new NetworkPolicyError("undeclared request option");
  }
  const {
    body,
    cache,
    credentials,
    headers,
    keepalive,
    method: requestedMethod,
    mode,
    redirect,
    referrer,
    referrerPolicy,
    signal,
  } = init;
  if (requestedMethod !== undefined && typeof requestedMethod !== "string") {
    throw new NetworkPolicyError("invalid method");
  }
  const method = (requestedMethod ?? "GET").toUpperCase();

  if (policy.sameOriginOnly && url.origin !== origin) {
    throw new NetworkPolicyError("cross-origin destination");
  }
  if (method !== policy.method) {
    throw new NetworkPolicyError(`method ${method}`);
  }
  if (credentials !== undefined && credentials !== policy.credentialMode) {
    throw new NetworkPolicyError("undeclared credentials mode");
  }
  if (redirect !== undefined && redirect !== "error") {
    throw new NetworkPolicyError("redirect following is not permitted");
  }
  if (cache !== undefined && cache !== "no-store") {
    throw new NetworkPolicyError("caching is not permitted");
  }
  if (keepalive !== undefined && keepalive !== false) {
    throw new NetworkPolicyError("background delivery is not permitted");
  }
  if (referrer !== undefined && referrer !== "") {
    throw new NetworkPolicyError("referrer context is not permitted");
  }
  if (referrerPolicy !== undefined && referrerPolicy !== "same-origin") {
    throw new NetworkPolicyError("referrer policy is not permitted");
  }
  if (mode !== undefined && mode !== "same-origin") {
    throw new NetworkPolicyError("cross-origin request mode is not permitted");
  }

  const operation = validateTextToLatticeRequest(policy, headers, body);

  return fetchImpl(url, {
    method: policy.method,
    headers: operation === "visitor-session-setup"
      ? Object.freeze({ Accept: policy.visitorSessionSetup.accept })
      : Object.freeze({
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
    ...(operation === "content" ? { body } : {}),
    signal,
    // The browser may attach only cookies whose own scope includes this exact
    // same-origin API path. The Worker rejects every cookie except the one
    // opaque, HttpOnly daily-limit cookie declared by this capability.
    credentials: policy.credentialMode,
    redirect: "error",
    cache: "no-store",
    keepalive: false,
    mode: "same-origin",
    referrer: "",
    // An empty referrer suppresses Referer. `same-origin` keeps the browser-owned
    // Origin header at https://hah.dev; `no-referrer` would serialize it as null.
    referrerPolicy: "same-origin",
  });
}
