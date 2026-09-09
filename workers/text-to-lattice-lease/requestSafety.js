import {
  isLatticeAttestationToken,
  LATTICE_ATTESTATION_HEADER,
} from "./attestation.js";

async function hasRequestBody(request) {
  if (request.body === null) return false;
  try {
    const reader = request.body.getReader();
    try {
      // Cloudflare can expose a bodyless POST as an already-closed stream.
      // Stop at the first real byte; zero-length chunks carry no payload, so
      // an empty provider-created stream is accepted only once it closes.
      while (true) {
        const next = await reader.read();
        if (next.done) return false;
        if ((next.value?.byteLength ?? 0) > 0) return true;
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  } catch {
    // Unknown or unreadable stream shapes fail closed.
    return true;
  }
}

export async function rejectUnsafeRequest(request, publicOrigin) {
  if (request.headers.get("Origin") !== publicOrigin) return "origin";
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (fetchSite && fetchSite !== "same-origin") return "fetch-site";
  const fetchMode = request.headers.get("Sec-Fetch-Mode");
  if (fetchMode && fetchMode !== "cors" && fetchMode !== "same-origin") return "fetch-mode";
  const fetchDestination = request.headers.get("Sec-Fetch-Dest");
  if (fetchDestination && fetchDestination !== "empty") return "fetch-destination";
  if (new URL(request.url).search) return "query";
  if ((request.headers.get("Cookie")?.length ?? 0) > 4_096) return "cookie";
  if (request.headers.has("Content-Encoding") || request.headers.has("Content-Type")) return "body";
  if (request.method === "POST" && request.headers.has("Authorization")) return "authorization";
  const attestation = request.headers.get(LATTICE_ATTESTATION_HEADER);
  if (request.method === "POST") {
    if (attestation !== null && !isLatticeAttestationToken(attestation)) return "attestation";
  } else if (attestation !== null) {
    return "attestation";
  }

  // Framing claims alone are not evidence that a supplied stream is empty.
  // Check the stream as well, without buffering user-controlled bytes.
  if (request.headers.has("Transfer-Encoding")) return "body";
  const contentLength = request.headers.get("Content-Length");
  const normalizedContentLength = contentLength?.trim() ?? null;
  if (normalizedContentLength !== null && normalizedContentLength !== "0") return "body";
  return await hasRequestBody(request) ? "body" : null;
}
