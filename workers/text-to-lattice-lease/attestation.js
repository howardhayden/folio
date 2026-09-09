export const LATTICE_ATTESTATION_ACTION = "text_to_lattice";
export const LATTICE_ATTESTATION_HOSTNAME = "verify.hah.dev";
export const LATTICE_ATTESTATION_HEADER = "X-Lattice-Attestation";
export const LATTICE_ATTESTATION_TOKEN_LIMIT = 2_048;

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SITEVERIFY_RESPONSE_LIMIT = 8_192;
const TOKEN_UNSAFE_CHARACTER_PATTERN = /[\s\u0000-\u001F\u007F-\u009F]/u;

export function isLatticeAttestationToken(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= LATTICE_ATTESTATION_TOKEN_LIMIT
    && !TOKEN_UNSAFE_CHARACTER_PATTERN.test(value);
}

async function cancelResponseBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // Cancellation is best effort after a response has already been rejected.
  }
}

async function boundedSiteverifyJson(response) {
  if (!response.ok) {
    await cancelResponseBody(response);
    return null;
  }
  const mediaType = (response.headers.get("Content-Type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    await cancelResponseBody(response);
    return null;
  }
  const declaredLength = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > SITEVERIFY_RESPONSE_LIMIT) {
    await cancelResponseBody(response);
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
      if (bytesRead > SITEVERIFY_RESPONSE_LIMIT) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const value = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    await reader.cancel().catch(() => {});
    return null;
  }
}

export async function verifyLatticeAttestation(token, {
  secret,
  remoteIp,
  now = Date.now(),
  fetchImpl = fetch,
} = {}) {
  if (!isLatticeAttestationToken(token) || typeof secret !== "string" || secret.length < 32) return false;
  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  form.set("idempotency_key", crypto.randomUUID());
  if (typeof remoteIp === "string" && /^[0-9A-Fa-f:.]{1,64}$/u.test(remoteIp)) form.set("remoteip", remoteIp);

  let response;
  try {
    response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      body: form,
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return false;
  }
  const result = await boundedSiteverifyJson(response);
  const challengedAt = Date.parse(result?.challenge_ts ?? "");
  return result?.success === true
    && result.hostname === LATTICE_ATTESTATION_HOSTNAME
    && result.action === LATTICE_ATTESTATION_ACTION
    && Number.isFinite(challengedAt)
    && challengedAt <= now + 60_000
    && challengedAt > now - 300_000;
}
