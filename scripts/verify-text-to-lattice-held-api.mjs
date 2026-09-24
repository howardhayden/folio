import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { exactRecord } from "../app/resume/lattice/remoteProtocol.js";
import { sanitizeTextToLatticeDeploymentStatus } from "./build-text-to-lattice-deployment-evidence.mjs";

const ORIGIN = "https://hah.dev";
const API_PATH = "/api/lattice";
const WORKER = "hahdev-text-to-lattice-api";
const MAXIMUM_BODY_BYTES = 4_096;
export const LATTICE_HELD_API_READINESS_CONTRACT = Object.freeze({
  attemptLimit: 18,
  deadlineMs: 45_000,
  intervalMs: 2_000,
  requestTimeoutMs: 7_000,
  requiredConsecutiveHeldSamples: 3,
});
const EXPECTED_COMMON_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
});
const EXPECTED_HELD_CSP = "default-src 'none'; frame-ancestors 'none'";

function fail(message) {
  throw new Error(`Text to Lattice held-API verification failed: ${message}`);
}

function waitMilliseconds(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

function workflowIdentity(environment) {
  const repository = environment.GITHUB_REPOSITORY;
  const commit = environment.GITHUB_SHA;
  const runId = environment.GITHUB_RUN_ID;
  const runAttempt = environment.GITHUB_RUN_ATTEMPT;
  const serverUrl = environment.GITHUB_SERVER_URL;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository ?? "")
    || !/^[a-f0-9]{40}$/u.test(commit ?? "")
    || !/^[1-9]\d*$/u.test(runId ?? "")
    || !/^[1-9]\d*$/u.test(runAttempt ?? "")
    || !/^https:\/\/[A-Za-z0-9.-]+$/u.test(serverUrl ?? "")) {
    fail("workflow identity is incomplete or malformed");
  }
  return Object.freeze({
    repository,
    commit,
    runId,
    runAttempt,
    runUrl: `${serverUrl}/${repository}/actions/runs/${runId}`,
  });
}

async function boundedJson(response) {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null
    && (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > MAXIMUM_BODY_BYTES)) {
    await response.body?.cancel().catch(() => {});
    fail("held response exceeded its size boundary");
  }
  const chunks = [];
  let total = 0;
  if (response.body) {
    const reader = response.body.getReader();
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        total += part.value.byteLength;
        if (total > MAXIMUM_BODY_BYTES) {
          await reader.cancel().catch(() => {});
          fail("held response exceeded its size boundary");
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
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("held response was not bounded UTF-8 JSON");
  }
}

function isHeldVerificationFailure(error) {
  return error instanceof Error
    && error.message.startsWith("Text to Lattice held-API verification failed:");
}

function monotonicMilliseconds(monotonicNow, previousValue = 0) {
  const value = monotonicNow();
  if (!Number.isFinite(value) || value < previousValue) {
    fail("the readiness clock was invalid or moved backwards");
  }
  return value;
}

async function inspectHeldApi(fetchImpl, timeoutMs, label) {
  let response;
  try {
    response = await fetchImpl(`${ORIGIN}${API_PATH}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return "network-error";
  }
  if (!(response instanceof Response)) fail(`${label} returned an invalid response`);
  if (response.status !== 405 && response.status !== 503) {
    await response?.body?.cancel().catch(() => {});
    fail(`${label} returned HTTP ${response.status}; expected the active 405 or held 503 boundary`);
  }
  for (const [name, expected] of Object.entries(EXPECTED_COMMON_HEADERS)) {
    if (response.headers.get(name)?.toLowerCase() !== expected) {
      await response.body?.cancel().catch(() => {});
      fail(`${label} returned an invalid ${name}`);
    }
  }
  if (response.headers.has("access-control-allow-origin") || response.headers.has("set-cookie")) {
    await response.body?.cancel().catch(() => {});
    fail(`${label} exposed a cross-origin or cookie surface`);
  }
  if (response.status === 405) {
    if (response.headers.get("allow") !== "POST") {
      await response.body?.cancel().catch(() => {});
      fail(`${label} returned an invalid Allow header`);
    }
  } else {
    if (response.headers.has("allow")) {
      await response.body?.cancel().catch(() => {});
      fail(`${label} returned an undeclared Allow header`);
    }
    if (response.headers.get("content-security-policy")?.toLowerCase() !== EXPECTED_HELD_CSP) {
      await response.body?.cancel().catch(() => {});
      fail(`${label} returned an invalid content-security-policy`);
    }
  }
  const body = await boundedJson(response);
  const expectedError = response.status === 405 ? "invalid_request" : "upstream_unavailable";
  if (!exactRecord(body, ["error"]) || body.error !== expectedError) {
    fail(`${label} returned an invalid error envelope`);
  }
  return response.status === 503 ? "held" : "active";
}

export async function verifyTextToLatticeHeldApi({
  deploymentStatus,
  fetchImpl = globalThis.fetch,
  environment = process.env,
  wait = waitMilliseconds,
  now = () => new Date(),
  monotonicNow = Date.now,
} = {}) {
  if (typeof fetchImpl !== "function" || typeof wait !== "function"
    || typeof now !== "function" || typeof monotonicNow !== "function") {
    throw new TypeError("The held-API verifier received an invalid dependency.");
  }
  const workflow = workflowIdentity(environment);
  const worker = sanitizeTextToLatticeDeploymentStatus(deploymentStatus, WORKER);
  const {
    attemptLimit,
    deadlineMs,
    intervalMs,
    requestTimeoutMs,
    requiredConsecutiveHeldSamples,
  } = LATTICE_HELD_API_READINESS_CONTRACT;
  let clockValue = monotonicMilliseconds(monotonicNow);
  const deadline = clockValue + deadlineMs;
  let consecutiveHeldSamples = 0;
  let heldResponseCount = 0;
  let activeResponseCount = 0;
  let networkErrorCount = 0;

  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    clockValue = monotonicMilliseconds(monotonicNow, clockValue);
    const remainingMilliseconds = deadline - clockValue;
    if (remainingMilliseconds <= 0) break;
    const label = `content-free held-API readiness sample ${attempt}`;
    let disposition = "network-error";
    try {
      disposition = await inspectHeldApi(
        fetchImpl,
        Math.max(1, Math.floor(Math.min(requestTimeoutMs, remainingMilliseconds))),
        label,
      );
    } catch (error) {
      if (isHeldVerificationFailure(error)) throw error;
      disposition = "network-error";
    }
    clockValue = monotonicMilliseconds(monotonicNow, clockValue);
    if (clockValue >= deadline) break;

    if (disposition === "held") {
      heldResponseCount += 1;
      consecutiveHeldSamples += 1;
      if (consecutiveHeldSamples === requiredConsecutiveHeldSamples) {
        const verifiedAt = now();
        if (!(verifiedAt instanceof Date) || Number.isNaN(verifiedAt.valueOf())) {
          fail("verification timestamp is invalid");
        }
        return Object.freeze({
          format: "TEXT_TO_LATTICE_HELD_ROLLBACK_EVIDENCE",
          schemaVersion: 1,
          verifiedAt: verifiedAt.toISOString(),
          workflow,
          worker,
          attemptCount: attempt,
          readiness: Object.freeze({
            requestCount: attempt,
            requiredConsecutiveHeldSamples,
            observedConsecutiveHeldSamples: consecutiveHeldSamples,
            heldResponseCount,
            activeResponseCount,
            networkErrorCount,
          }),
          boundary: Object.freeze({
            origin: ORIGIN,
            path: API_PATH,
            httpStatus: 503,
            errorCode: "upstream_unavailable",
            noStore: true,
            noSniff: true,
            restrictiveCsp: true,
            crossOriginAllowanceAbsent: true,
            cookieMutationAbsent: true,
          }),
          contentBodiesRetained: false,
          secretValuesRead: false,
        });
      }
    } else {
      consecutiveHeldSamples = 0;
      if (disposition === "active") activeResponseCount += 1;
      else networkErrorCount += 1;
    }

    if (attempt === attemptLimit) break;
    const remainingBeforeWait = deadline - clockValue;
    if (remainingBeforeWait <= 0) break;
    await wait(Math.min(intervalMs, remainingBeforeWait));
  }
  fail("the content-free held API boundary did not settle within its fixed readiness window");
}

function cliArguments(argumentsList) {
  let deploymentPath = null;
  let outputPath = null;
  for (let index = 0; index < argumentsList.length; index += 1) {
    const option = argumentsList[index];
    const value = argumentsList[index + 1];
    if (option === "--deployment") deploymentPath = value;
    else if (option === "--output") outputPath = value;
    else fail(`unknown option ${option}`);
    if (!value || value.startsWith("--")) fail(`${option} requires a path`);
    index += 1;
  }
  if (!deploymentPath || !outputPath) fail("--deployment and --output are required");
  return { deploymentPath, outputPath };
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  const { deploymentPath, outputPath } = cliArguments(process.argv.slice(2));
  let deploymentStatus;
  try {
    deploymentStatus = JSON.parse(await readFile(resolve(deploymentPath), "utf8"));
  } catch {
    fail("held deployment status is not readable JSON");
  }
  const evidence = await verifyTextToLatticeHeldApi({ deploymentStatus });
  const resolvedOutput = resolve(outputPath);
  await mkdir(dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  process.stdout.write(`Text to Lattice API is held at Worker version ${evidence.worker.versionId}.\n`);
}
