const encoder = new TextEncoder();

const CREDENTIAL_VERSION = "l1";
const LEASE_ID_BYTES = 24;
const LEASE_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/u;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const CREDENTIAL_PATTERN = /^l1\.([A-Za-z0-9_-]{32})\.([1-9][0-9]{0,15})\.([A-Za-z0-9_-]{43})$/u;
const KEY_DERIVATION_CONTEXT = "hah.dev/text-to-lattice/lease-credential/key/v1";
const SIGNATURE_CONTEXT = "hah.dev/text-to-lattice/lease-credential/value/v1";
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

function assertSecret(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("Lease-credential secret is not configured.");
  }
  return secret;
}

function assertExpiry(expiresAt) {
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    throw new TypeError("Lease-credential expiry is invalid.");
  }
  return expiresAt;
}

async function leaseCredentialKey(secret) {
  const validSecret = assertSecret(secret);
  if (cachedSecret !== validSecret || cachedKeyPromise === null) {
    cachedSecret = validSecret;
    cachedKeyPromise = (async () => {
      const rootKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(validSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const derivedKeyBytes = await crypto.subtle.sign(
        "HMAC",
        rootKey,
        encoder.encode(KEY_DERIVATION_CONTEXT),
      );
      return crypto.subtle.importKey(
        "raw",
        derivedKeyBytes,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
      );
    })();
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

function signatureInput(unsignedCredential) {
  return encoder.encode(`${SIGNATURE_CONTEXT}\0${unsignedCredential}`);
}

export function isOpaqueLeaseId(value) {
  return typeof value === "string" && LEASE_ID_PATTERN.test(value);
}

export function createOpaqueLeaseId() {
  const bytes = new Uint8Array(LEASE_ID_BYTES);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function createLeaseCredential({ leaseId, expiresAt, secret }) {
  if (!isOpaqueLeaseId(leaseId)) throw new TypeError("Opaque lease id is invalid.");
  const canonicalExpiry = String(assertExpiry(expiresAt));
  const unsignedCredential = `${CREDENTIAL_VERSION}.${leaseId}.${canonicalExpiry}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await leaseCredentialKey(secret),
    signatureInput(unsignedCredential),
  );
  return `${unsignedCredential}.${base64Url(new Uint8Array(signature))}`;
}

export async function verifyLeaseCredential(value, { now, secret }) {
  if (typeof value !== "string") return null;
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new TypeError("Lease-credential verification time is invalid.");
  }
  const match = value.match(CREDENTIAL_PATTERN);
  if (!match || !SIGNATURE_PATTERN.test(match[3])) return null;

  const [, leaseId, expiryText, signatureText] = match;
  const expiresAt = Number(expiryText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return null;
  const signatureBytes = decodeBase64Url(signatureText);
  if (base64Url(signatureBytes) !== signatureText) return null;

  const unsignedCredential = `${CREDENTIAL_VERSION}.${leaseId}.${expiryText}`;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await leaseCredentialKey(secret),
    signatureBytes,
    signatureInput(unsignedCredential),
  );
  if (!valid) return null;
  return Object.freeze({ leaseId, expiresAt });
}
