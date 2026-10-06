import { createHash } from "node:crypto";

export const LATTICE_CLOUDFLARE_METADATA_LIMITS = Object.freeze({
  responseBytes: 1_048_576, requestTimeoutMs: 10_000, operationTimeoutMs: 30_000,
  metadataRequests: 2,
});
const worker = "hahdev-text-to-lattice-api";
const hexId = /^[a-f0-9]{32}$/u;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
export const isLatticeCloudflareNamespaceId = (value) => typeof value === "string" && (
  (value.length === 32 && hexId.test(value)) || (value.length === 36 && uuid.test(value))
);
export class LatticeMetadataError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = (code) => { throw new LatticeMetadataError(code); };

function discard(body) {
  try { Promise.resolve(body?.cancel()).catch(() => {}); } catch { /* No raw errors or blocking cleanup. */ }
}

// Only fixed account-metadata GET paths are constructed here. No Worker route,
// Durable Object object-list, secret-value endpoint or provider is contacted.
async function metadataGet(url, { token, fetchImpl, timeoutMs, kind, receipts }) {
  const controller = new AbortController();
  let expired = false;
  let timer;
  let reader;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      controller.abort();
      try { Promise.resolve(reader?.cancel()).catch(() => {}); } catch { /* Bounded cleanup. */ }
      reject(new LatticeMetadataError("deadline"));
    }, timeoutMs);
  });
  const task = (async () => {
    let response;
    try {
      response = await fetchImpl(url, {
        method: "GET", redirect: "error", cache: "no-store", signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Accept-Encoding": "identity" },
      });
    } catch { fail("transport"); }
    if (expired) { discard(response?.body); fail("deadline"); }
    if (response?.status !== 200 || response.redirected === true) { discard(response?.body); fail("http"); }
    if (!/^application\/json(?:\s*;[^\r\n]*)?$/iu.test(response.headers?.get("content-type") ?? "")) {
      discard(response.body); fail("media-type");
    }
    const encoding = response.headers.get("content-encoding");
    if (encoding !== null && encoding.toLowerCase() !== "identity") {
      discard(response.body); fail("content-encoding");
    }
    const length = response.headers.get("content-length");
    if (length !== null && (!/^(?:0|[1-9][0-9]*)$/u.test(length)
      || String(Number(length)) !== length || Number(length) > LATTICE_CLOUDFLARE_METADATA_LIMITS.responseBytes)) {
      discard(response.body); fail("body-limit");
    }
    try { reader = response.body.getReader(); } catch { fail("body-read"); }
    const chunks = [];
    let bytes = 0;
    const hash = createHash("sha256");
    try {
      for (;;) {
        const part = await reader.read();
        if (expired) fail("deadline");
        if (part.done) break;
        if (!(part.value instanceof Uint8Array)) fail("body-read");
        bytes += part.value.byteLength;
        if (bytes > LATTICE_CLOUDFLARE_METADATA_LIMITS.responseBytes) fail("body-limit");
        hash.update(part.value);
        chunks.push(Buffer.from(part.value));
      }
    } catch (error) {
      try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* No blocking cleanup. */ }
      if (error instanceof LatticeMetadataError) throw error;
      fail("body-read");
    }
    if (expired) fail("deadline");
    if (length !== null && bytes !== Number(length)) fail("body-length");
    receipts.push(Object.freeze({ request: kind, responseBodyBytes: bytes, responseBodySha256: hash.digest("hex") }));
    let parsed;
    try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { fail("invalid-json"); }
    if (!record(parsed) || parsed.success !== true || !Object.hasOwn(parsed, "result")) fail("api-result");
    return parsed;
  })();
  try { return await Promise.race([task, timeout]); }
  finally { clearTimeout(timer); }
}


// Only this Worker version and exact namespace metadata routes are exposed.
// Callers cannot supply an origin, arbitrary path, verb, body or header.
export function createLatticeCloudflareMetadataReader({
  accountId, token, fetchImpl = globalThis.fetch, monotonicNow = () => performance.now(),
  requestTimeoutMs = LATTICE_CLOUDFLARE_METADATA_LIMITS.requestTimeoutMs,
} = {}) {
  if (typeof accountId !== "string" || accountId.length !== 32 || !hexId.test(accountId)
    || typeof token !== "string" || token.length < 1 || token.length > 4096 || /[\r\n]/u.test(token)
    || typeof fetchImpl !== "function" || typeof monotonicNow !== "function"
    || !Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1
    || requestTimeoutMs > LATTICE_CLOUDFLARE_METADATA_LIMITS.requestTimeoutMs) fail("configuration");
  const receipts = [];
  let used = 0;
  const started = monotonicNow();
  if (!Number.isFinite(started)) fail("observation-clock");
  let last = started;
  const clock = () => {
    const value = monotonicNow();
    if (!Number.isFinite(value) || value < last) fail("observation-clock");
    last = value;
    return value;
  };
  const get = async (suffix, kind) => {
    const remaining = LATTICE_CLOUDFLARE_METADATA_LIMITS.operationTimeoutMs - (clock() - started);
    if (remaining <= 0 || used >= LATTICE_CLOUDFLARE_METADATA_LIMITS.metadataRequests) fail("deadline");
    used += 1;
    return metadataGet(`https://api.cloudflare.com/client/v4/accounts/${accountId}/${suffix}`, {
      token, fetchImpl, timeoutMs: Math.min(requestTimeoutMs, remaining), kind, receipts,
    });
  };
  return Object.freeze({
    async version(versionId) {
      if (typeof versionId !== "string" || versionId.length !== 36 || !uuid.test(versionId)) fail("version-identity");
      return get(`workers/scripts/${worker}/versions/${versionId}`, "historical-version");
    },
    async namespace(namespaceId) {
      if (!isLatticeCloudflareNamespaceId(namespaceId)) fail("namespace-identity");
      const response = await get(`workers/durable_objects/namespaces/${namespaceId}`, "bound-namespace");
      if (!record(response.result) || response.result.id !== namespaceId) fail("namespace-identity");
      return response;
    },
    finish() {
      if (clock() - started > LATTICE_CLOUDFLARE_METADATA_LIMITS.operationTimeoutMs) fail("deadline");
    },
    receipts() { return Object.freeze([...receipts]); },
  });
}
