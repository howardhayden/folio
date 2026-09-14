import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { exactRecord } from "../app/resume/lattice/remoteProtocol.js";
import { sanitizeTextToLatticeDeploymentStatus } from "./build-text-to-lattice-deployment-evidence.mjs";

const ORIGIN = "https://hah.dev";
const API_PATH = "/api/lattice";
const WORKER = "hahdev-text-to-lattice-api";
const MAXIMUM_BODY_BYTES = 4_096;
const EXPECTED_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
});

function fail(message) {
  throw new Error(`Text to Lattice held-API verification failed: ${message}`);
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
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAXIMUM_BODY_BYTES) fail("held response exceeded its size boundary");
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("held response was not bounded UTF-8 JSON");
  }
}

export async function verifyTextToLatticeHeldApi({
  deploymentStatus,
  fetchImpl = globalThis.fetch,
  environment = process.env,
  now = () => new Date(),
} = {}) {
  if (typeof fetchImpl !== "function" || typeof now !== "function") {
    throw new TypeError("The held-API verifier received an invalid dependency.");
  }
  const workflow = workflowIdentity(environment);
  const worker = sanitizeTextToLatticeDeploymentStatus(deploymentStatus, WORKER);
  const verifiedAt = now();
  if (!(verifiedAt instanceof Date) || Number.isNaN(verifiedAt.valueOf())) {
    fail("verification timestamp is invalid");
  }
  let response;
  try {
    response = await fetchImpl(`${ORIGIN}${API_PATH}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    fail("held endpoint could not be reached");
  }
  if (!(response instanceof Response) || response.status !== 503) {
    await response?.body?.cancel().catch(() => {});
    fail(`held endpoint returned HTTP ${response?.status ?? "invalid"}`);
  }
  for (const [name, expected] of Object.entries(EXPECTED_HEADERS)) {
    if (response.headers.get(name)?.toLowerCase() !== expected) {
      await response.body?.cancel().catch(() => {});
      fail(`held endpoint returned an invalid ${name}`);
    }
  }
  if (response.headers.has("access-control-allow-origin") || response.headers.has("set-cookie")) {
    await response.body?.cancel().catch(() => {});
    fail("held endpoint exposed a cross-origin or cookie surface");
  }
  const body = await boundedJson(response);
  if (!exactRecord(body, ["error"]) || body.error !== "upstream_unavailable") {
    fail("held endpoint returned an invalid error envelope");
  }
  return Object.freeze({
    format: "TEXT_TO_LATTICE_HELD_ROLLBACK_EVIDENCE",
    schemaVersion: 1,
    verifiedAt: verifiedAt.toISOString(),
    workflow,
    worker,
    boundary: Object.freeze({
      origin: ORIGIN,
      path: API_PATH,
      httpStatus: 503,
      errorCode: body.error,
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
