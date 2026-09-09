import {
  isLatticeAttestationToken,
  LATTICE_ATTESTATION_HEADER,
} from "./attestation.js";

export function rejectUnsafeRequest(request, publicOrigin) {
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

  // A declared zero length is not evidence that a supplied stream is empty.
  // Official calls omit `body` entirely, so reject every non-null stream
  // without consuming user-controlled bytes.
  if (request.headers.has("Transfer-Encoding")) return "body";
  const contentLength = request.headers.get("Content-Length");
  const normalizedContentLength = contentLength?.trim() ?? null;
  if (request.body !== null) return "body";
  return normalizedContentLength === null || normalizedContentLength === "0"
    ? null
    : "body";
}
