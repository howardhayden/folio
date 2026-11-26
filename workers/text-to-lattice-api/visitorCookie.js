import { isLatticeCapacityVisitorId } from "./capacityPolicy.js";

const encoder = new TextEncoder();

export const LATTICE_API_VISITOR_COOKIE_NAME = "__Secure-hah-lattice-api-visitor";
export const LATTICE_API_VISITOR_COOKIE_PATH = "/api/lattice";
export const LATTICE_API_VISITOR_COOKIE_SECRET_BINDING = "VISITOR_COOKIE_SECRET";
export const LATTICE_API_VISITOR_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

const COOKIE_VERSION = "v1";
const SIGNATURE_CONTEXT = "hah.dev/api/lattice/visitor-cookie/value/v1";
const COOKIE_VALUE_PATTERN = /^v1\.([A-Za-z0-9_-]{24})\.([A-Za-z0-9_-]{43})$/u;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const MAXIMUM_VISITOR_COOKIE_CHARACTERS = 256;
const MAXIMUM_CLEARANCE_COOKIE_CHARACTERS = 4096;
const CLEARANCE_COOKIE_PREFIX = "cf_clearance=";
// RFC 6265 cookie-octet. Cloudflare validates this opaque value before the Worker.
const CLEARANCE_COOKIE_VALUE = /^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]+$/u;
const UTC_DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;
let cachedSecret = null;
let cachedKeyPromise = null;

export class LatticeApiVisitorCookieError extends Error {
  constructor(message) {
    super(message);
    this.name = "LatticeApiVisitorCookieError";
  }
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function signatureInput(unsignedValue) {
  return encoder.encode(`${SIGNATURE_CONTEXT}\0${unsignedValue}`);
}

async function visitorHmacKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("The API visitor-cookie secret is not configured.");
  }
  if (cachedSecret !== secret || cachedKeyPromise === null) {
    cachedSecret = secret;
    cachedKeyPromise = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  const keyPromise = cachedKeyPromise;
  try {
    return await keyPromise;
  } catch (error) {
    if (cachedKeyPromise === keyPromise) {
      cachedSecret = null;
      cachedKeyPromise = null;
    }
    throw error;
  }
}

function cookieHeaderValue(headers) {
  const header = headers.get("Cookie");
  if (header === null) return null;
  if (!header.length || header.length > MAXIMUM_VISITOR_COOKIE_CHARACTERS + MAXIMUM_CLEARANCE_COOKIE_CHARACTERS + 2) {
    throw new LatticeApiVisitorCookieError("The API visitor cookie is invalid.");
  }
  let visitorValue = null;
  let clearanceSeen = false;
  for (const pair of header.split(";")) {
    const field = pair.trim();
    if (field.startsWith(CLEARANCE_COOKIE_PREFIX) && !clearanceSeen
      && field.length <= MAXIMUM_CLEARANCE_COOKIE_CHARACTERS
      && CLEARANCE_COOKIE_VALUE.test(field.slice(CLEARANCE_COOKIE_PREFIX.length))) {
      clearanceSeen = true;
    } else if (field.startsWith(LATTICE_API_VISITOR_COOKIE_NAME + "=") && visitorValue === null
      && field.length <= MAXIMUM_VISITOR_COOKIE_CHARACTERS) {
      visitorValue = field.slice(LATTICE_API_VISITOR_COOKIE_NAME.length + 1);
    } else {
      throw new LatticeApiVisitorCookieError("The API request contained an undeclared or invalid cookie.");
    }
  }
  return visitorValue;
}

function createVisitorId() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const visitorId = base64Url(bytes);
  if (!isLatticeCapacityVisitorId(visitorId)) {
    throw new Error("The API visitor identifier could not be created.");
  }
  return visitorId;
}

async function signedVisitorValue(visitorId, secret) {
  if (!isLatticeCapacityVisitorId(visitorId)) {
    throw new TypeError("The API visitor identifier is invalid.");
  }
  const unsignedValue = `${COOKIE_VERSION}.${visitorId}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await visitorHmacKey(secret),
    signatureInput(unsignedValue),
  );
  return `${unsignedValue}.${base64Url(new Uint8Array(signature))}`;
}

async function verifiedVisitorId(value, secret) {
  if (typeof value !== "string") return null;
  const match = value.match(COOKIE_VALUE_PATTERN);
  if (!match) return null;
  const [, visitorId, signatureText] = match;
  if (!isLatticeCapacityVisitorId(visitorId) || !SIGNATURE_PATTERN.test(signatureText)) return null;
  try {
    const signatureBytes = decodeBase64Url(signatureText);
    if (base64Url(signatureBytes) !== signatureText) return null;
    const valid = await crypto.subtle.verify(
      "HMAC",
      await visitorHmacKey(secret),
      signatureBytes,
      signatureInput(`${COOKIE_VERSION}.${visitorId}`),
    );
    return valid ? visitorId : null;
  } catch {
    return null;
  }
}

export async function resolveLatticeApiVisitor(headers, secret) {
  const presentedValue = cookieHeaderValue(headers);
  if (presentedValue === null) return null;
  await visitorHmacKey(secret);
  const visitorId = await verifiedVisitorId(presentedValue, secret);
  if (!visitorId) {
    throw new LatticeApiVisitorCookieError("The API visitor cookie is invalid.");
  }
  return Object.freeze({
    visitorId,
    cookieValue: await signedVisitorValue(visitorId, secret),
  });
}

export async function establishLatticeApiVisitor(headers, secret) {
  // The bodyless setup operation must validate its dedicated server-only
  // binding before it creates or reissues an opaque browser identity.
  await visitorHmacKey(secret);
  const presentedValue = cookieHeaderValue(headers);
  if (presentedValue !== null) {
    const visitor = await resolveLatticeApiVisitor(headers, secret);
    if (visitor === null) {
      throw new LatticeApiVisitorCookieError("The API visitor cookie is invalid.");
    }
    return visitor;
  }
  const visitorId = createVisitorId();
  return Object.freeze({
    visitorId,
    cookieValue: await signedVisitorValue(visitorId, secret),
  });
}

export function latticeApiVisitorCookieMaxAge(now = Date.now()) {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new TypeError("The API visitor-cookie timestamp is invalid.");
  }
  const nextDay = (Math.floor(now / UTC_DAY_MILLISECONDS) + 1) * UTC_DAY_MILLISECONDS;
  return Math.max(1, Math.min(
    LATTICE_API_VISITOR_COOKIE_MAX_AGE_SECONDS,
    Math.ceil((nextDay - now) / 1_000),
  ));
}

export function withLatticeApiVisitorCookie(response, value, now = Date.now()) {
  if (!(response instanceof Response) || !COOKIE_VALUE_PATTERN.test(value ?? "")) {
    throw new TypeError("The API visitor-cookie response is invalid.");
  }
  const headers = new Headers(response.headers);
  headers.append(
    "Set-Cookie",
    `${LATTICE_API_VISITOR_COOKIE_NAME}=${value}; Max-Age=${latticeApiVisitorCookieMaxAge(now)}; Path=${LATTICE_API_VISITOR_COOKIE_PATH}; Secure; HttpOnly; SameSite=Strict`,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
