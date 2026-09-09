const encoder = new TextEncoder();

export const LATTICE_VISITOR_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

const COOKIE_VERSION = "v2";
const SIGNATURE_CONTEXT = "hah.dev/text-to-lattice/visitor-cookie/value/v2";
const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{24}$/u;
const VISITOR_SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const VISITOR_EXPIRY_PATTERN = /^[1-9][0-9]{0,12}$/u;
let cachedSecret = null;
let cachedKeyPromise = null;

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

async function visitorHmacKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("Visitor-cookie secret is not configured.");
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

function currentSignatureInput(unsignedValue) {
  return encoder.encode(`${SIGNATURE_CONTEXT}\0${unsignedValue}`);
}

export async function signedVisitorValue(id, secret) {
  if (!VISITOR_ID_PATTERN.test(id ?? "")) {
    throw new TypeError("Visitor-cookie id is invalid.");
  }
  const unsignedValue = `${COOKIE_VERSION}.${id}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await visitorHmacKey(secret),
    currentSignatureInput(unsignedValue),
  );
  return `${unsignedValue}.${base64Url(new Uint8Array(signature))}`;
}

export async function verifiedVisitorId(value, secret) {
  if (typeof value !== "string") return null;
  const [first, second, signatureText, extra] = value.split(".");
  if (extra !== undefined || !VISITOR_SIGNATURE_PATTERN.test(signatureText ?? "")) return null;

  let id;
  let signaturePayload;
  if (first === COOKIE_VERSION && VISITOR_ID_PATTERN.test(second ?? "")) {
    id = second;
    signaturePayload = currentSignatureInput(`${COOKIE_VERSION}.${id}`);
  } else {
    // Continue recognizing the original expiry-bearing value. Its signed time
    // is canonicalized but deliberately does not rotate a pseudonym: browser
    // Max-Age controls ordinary retention, while replay retains the same id.
    const expiresAtSeconds = Number(second);
    if (
      !VISITOR_ID_PATTERN.test(first ?? "")
      || !VISITOR_EXPIRY_PATTERN.test(second ?? "")
      || !Number.isSafeInteger(expiresAtSeconds)
      || String(expiresAtSeconds) !== second
    ) return null;
    id = first;
    signaturePayload = encoder.encode(`${id}.${second}`);
  }
  try {
    const signatureBytes = decodeBase64Url(signatureText ?? "");
    if (base64Url(signatureBytes) !== signatureText) return null;
    const valid = await crypto.subtle.verify(
      "HMAC",
      await visitorHmacKey(secret),
      signatureBytes,
      signaturePayload,
    );
    return valid ? id : null;
  } catch {
    return null;
  }
}
