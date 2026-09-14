export const TEXT_TO_LATTICE_DOCUMENT_POLICY = Object.freeze({
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; frame-src 'none'; connect-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Permissions-Policy": "document-domain=()",
});

const POLICY_DOCUMENT_PATHS = new Set([
  "/",
  "/index.html",
  "/resume/",
  "/resume/index.html",
]);

export function applyTextToLatticeDocumentPolicy(response, pathname) {
  if (!POLICY_DOCUMENT_PATHS.has(pathname)) return response;

  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(TEXT_TO_LATTICE_DOCUMENT_POLICY)) {
    headers.set(name, value);
  }
  const cacheControl = headers.get("Cache-Control");
  if (!cacheControl) headers.set("Cache-Control", "no-transform");
  else if (!cacheControl.toLowerCase().split(/\s*,\s*/u).includes("no-transform")) {
    headers.set("Cache-Control", `${cacheControl}, no-transform`);
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

const responsePolicyWorker = {
  async fetch(request) {
    const response = await fetch(request);
    return applyTextToLatticeDocumentPolicy(response, new URL(request.url).pathname);
  },
};

export default responsePolicyWorker;
