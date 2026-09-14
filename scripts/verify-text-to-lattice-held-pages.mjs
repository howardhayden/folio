import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const HELD_URL = "https://hah.dev/resume/";
const MAXIMUM_DOCUMENT_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_ATTEMPTS = 8;
const DEFAULT_INTERVAL_MS = 2_000;
const HELD_COPY =
  "Text to Lattice remains held while deployment and end-to-end privacy evidence for the remote-provider candidate are incomplete.";
const HELD_CHUNK_PATTERN = /\/_next\/static\/chunks\/ResumeProjectsHeld-[A-Za-z0-9_-]+\.js/u;
const ACTIVE_CHUNK_PATTERN = /\/_next\/static\/chunks\/ResumeProjects-(?!Held-)[A-Za-z0-9_-]+\.js/u;
const ACTIVE_SURFACE_PATTERNS = Object.freeze([
  /aria-label=["']Use Text to Lattice["']/u,
  /id=["']lattice-demo-dialog["']/u,
  /class=["'][^"']*lattice-run-button/u,
]);

function fail(message) {
  throw new Error(`Text to Lattice held-Pages verification failed: ${message}`);
}

function waitMilliseconds(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function boundedDocument(response) {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null
    && (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > MAXIMUM_DOCUMENT_BYTES)) {
    await response.body?.cancel().catch(() => {});
    fail("the résumé document exceeded its response-size boundary");
  }
  const reader = response.body?.getReader();
  const chunks = [];
  let byteLength = 0;
  if (reader) {
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        byteLength += part.value.byteLength;
        if (byteLength > MAXIMUM_DOCUMENT_BYTES) {
          await reader.cancel().catch(() => {});
          fail("the résumé document exceeded its response-size boundary");
        }
        chunks.push(part.value);
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // The bounded read has already settled.
      }
    }
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("the résumé document was not UTF-8");
  }
  return Object.freeze({ source, byteLength });
}

async function inspectHeldPages(fetchImpl) {
  let response;
  try {
    response = await fetchImpl(HELD_URL, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
      },
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    fail("the public résumé document could not be reached");
  }
  if (!(response instanceof Response) || response.status !== 200) {
    await response?.body?.cancel().catch(() => {});
    fail(`the public résumé document returned HTTP ${response?.status ?? "invalid"}`);
  }
  if (!/^text\/html(?:\s*;\s*charset=utf-8)?$/iu.test(response.headers.get("content-type") ?? "")) {
    await response.body?.cancel().catch(() => {});
    fail("the public résumé document returned an invalid media type");
  }
  const { source, byteLength } = await boundedDocument(response);
  if (!source.includes(HELD_COPY)) fail("the public held disposition is absent");
  if (!HELD_CHUNK_PATTERN.test(source)) fail("the held résumé project module is absent");
  if (ACTIVE_CHUNK_PATTERN.test(source)
    || ACTIVE_SURFACE_PATTERNS.some((pattern) => pattern.test(source))) {
    fail("an interactive Text to Lattice surface remains in the public Pages document");
  }
  return Object.freeze({ status: response.status, byteLength });
}

export async function verifyTextToLatticeHeldPages({
  fetchImpl = globalThis.fetch,
  attempts = DEFAULT_ATTEMPTS,
  intervalMs = DEFAULT_INTERVAL_MS,
  wait = waitMilliseconds,
  now = () => new Date(),
} = {}) {
  if (typeof fetchImpl !== "function" || typeof wait !== "function" || typeof now !== "function"
    || !Number.isSafeInteger(attempts) || attempts < 1 || attempts > 30
    || !Number.isSafeInteger(intervalMs) || intervalMs < 0 || intervalMs > 10_000) {
    throw new TypeError("The held-Pages verifier received an invalid dependency or retry boundary.");
  }

  let latestError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await inspectHeldPages(fetchImpl);
      const verifiedAt = now();
      if (!(verifiedAt instanceof Date) || Number.isNaN(verifiedAt.valueOf())) {
        fail("the verification timestamp is invalid");
      }
      return Object.freeze({
        format: "TEXT_TO_LATTICE_HELD_PAGES_EVIDENCE",
        schemaVersion: 1,
        verifiedAt: verifiedAt.toISOString(),
        url: HELD_URL,
        httpStatus: result.status,
        responseBytes: result.byteLength,
        attemptCount: attempt,
        heldCopyPresent: true,
        heldModulePresent: true,
        interactiveSurfaceAbsent: true,
        responseBodyRetained: false,
      });
    } catch (error) {
      latestError = error;
      if (attempt < attempts) await wait(intervalMs);
    }
  }
  throw latestError instanceof Error ? latestError : fail("the public held disposition was not verified");
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  const outputFlag = process.argv.indexOf("--output");
  const outputPath = outputFlag >= 0 ? process.argv[outputFlag + 1] : null;
  if (process.argv.length !== 4 || outputFlag !== 2 || !outputPath || !isAbsolute(outputPath)) {
    fail("pass --output with one absolute sanitized evidence path");
  }
  const evidence = await verifyTextToLatticeHeldPages();
  const resolvedOutput = resolve(outputPath);
  await mkdir(dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  process.stdout.write("The live hah.dev résumé is held and contains no interactive Text to Lattice surface.\n");
}
