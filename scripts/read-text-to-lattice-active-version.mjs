import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { sanitizeTextToLatticeDeploymentStatus } from "./build-text-to-lattice-deployment-evidence.mjs";
import { publishedHeldVersion as publishedApiVersion } from "./bootstrap-text-to-lattice-api-secrets.mjs";

const API_WORKER = "hahdev-text-to-lattice-api";
const MAXIMUM_STATUS_BYTES = 64 * 1024;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const MAXIMUM_SELECTION_MS = 30_000;
const PRECEDING_REREAD_DELAYS_MS = Object.freeze([1000, 3000, 6000]);

function fail(message) {
  throw new Error(`Text to Lattice active-version extraction failed: ${message}`);
}

async function boundedText(pathname) {
  if (typeof pathname !== "string" || pathname.length === 0) fail("a metadata path is required");
  const bytes = await readFile(resolve(pathname));
  if (bytes.byteLength > MAXIMUM_STATUS_BYTES) fail("the metadata is too large");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function readTextToLatticeActiveVersion(pathname) {
  if (typeof pathname !== "string" || pathname.length === 0) {
    fail("pass exactly one deployment-status JSON path");
  }
  const bytes = await readFile(resolve(pathname));
  if (bytes.byteLength > MAXIMUM_STATUS_BYTES) fail("the deployment status is too large");
  let raw;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("the deployment status is not bounded UTF-8 JSON");
  }
  return sanitizeTextToLatticeDeploymentStatus(raw, API_WORKER).versionId;
}

// The existing JSONL parser identifies one API deploy regardless of held/active entry point.
export function intendedTextToLatticeApiVersion(text) {
  if (typeof text !== "string" || Buffer.byteLength(text) > MAXIMUM_STATUS_BYTES) fail("invalid deploy record");
  let id;
  try { id = publishedApiVersion(text); } catch { fail("invalid deploy record"); }
  if (!UUID_PATTERN.test(id)) fail("invalid deploy version");
  return id;
}

export async function selectTextToLatticeApiDeployment(expectedVersionId, {
  readDeployment,
  precedingVersionId = null,
  preBootstrapVersionId = null,
  wait = delay,
  monotonicNow = () => performance.now(),
} = {}) {
  if (!UUID_PATTERN.test(expectedVersionId ?? "") || typeof readDeployment !== "function"
    || typeof wait !== "function" || typeof monotonicNow !== "function"
    || (precedingVersionId !== null && (!UUID_PATTERN.test(precedingVersionId)
      || precedingVersionId === expectedVersionId))) fail("invalid selection inputs");
  if (preBootstrapVersionId !== null && (precedingVersionId === null
    || !UUID_PATTERN.test(preBootstrapVersionId) || preBootstrapVersionId === expectedVersionId)) {
    fail("invalid pre-bootstrap incumbent");
  }
  const start = monotonicNow();
  let last = start;
  let precedingObserved = false;
  const observations = [];
  const report = (status, boundary = null) => Object.freeze({
    format: "TEXT_TO_LATTICE_API_DEPLOYMENT_SELECTION", schemaVersion: 1,
    status, boundary, expectedVersionId, precedingVersionId,
    ...(preBootstrapVersionId === null ? {} : { preBootstrapVersionId }),
    observations: Object.freeze([...observations]), rawMetadataLogged: false,
  });
  function refuse(boundary) {
    const error = new Error(`Text to Lattice deployment selection refused: ${boundary}`);
    error.selectionEvidence = report("refused", boundary);
    throw error;
  }
  function remaining() {
    const now = monotonicNow();
    if (!Number.isFinite(start) || !Number.isFinite(now) || now < last) refuse("clock");
    last = now;
    const budget = MAXIMUM_SELECTION_MS - (now - start);
    if (budget <= 0) refuse("deadline");
    return budget;
  }
  for (let attempt = 0; attempt <= PRECEDING_REREAD_DELAYS_MS.length; attempt += 1) {
    let raw;
    const timeout = Math.max(1, Math.floor(Math.min(8000, remaining())));
    try { raw = await readDeployment(timeout); } catch { refuse("metadata-read"); }
    remaining();
    let selected;
    try { selected = sanitizeTextToLatticeDeploymentStatus(raw, API_WORKER); }
    catch { refuse("invalid-selection"); }
    observations.push(selected);
    if (selected.versionId === expectedVersionId) {
      return Object.freeze({ raw, selected, evidence: report("matched") });
    }
    // The G06 rollout publishes the held bootstrap and then the active version.
    // Wait only on versions witnessed in this run, in deployment order.
    if (selected.versionId === precedingVersionId) precedingObserved = true;
    else if (precedingObserved || selected.versionId !== preBootstrapVersionId) refuse("unexpected-version");
    if (attempt === PRECEDING_REREAD_DELAYS_MS.length) refuse("preceding-selection-did-not-converge");
    const milliseconds = PRECEDING_REREAD_DELAYS_MS[attempt];
    if (remaining() <= milliseconds) refuse("deadline");
    await wait(milliseconds);
    remaining();
  }
  return undefined;
}

function captureArguments(args, incumbent = false) {
  const values = {};
  const names = new Map([
    ["--expected-deployment", "expectedPath"], ["--expected-upload", "uploadedPath"], ["--preceding-held-deployment", "heldPath"],
    ["--preceding-incumbent", "incumbentPath"],
    ["--pre-bootstrap-incumbent", "preBootstrapPath"],
    ["--wrangler", "wranglerPath"], ["--config", "configPath"], ["--output", "outputPath"],
  ]);
  for (let index = 0; index < args.length; index += 2) {
    const key = names.get(args[index]); const value = args[index + 1];
    if (!key || !value || value.startsWith("--") || Object.hasOwn(values, key)) fail("invalid selection arguments");
    values[key] = value;
  }
  if ((!incumbent && Boolean(values.expectedPath) === Boolean(values.uploadedPath))
    || ["wranglerPath", "configPath", "outputPath"].some(key => !values[key])) fail("missing selection arguments");
  if ((values.preBootstrapPath && !values.heldPath) || (values.heldPath && values.incumbentPath)
    || (incumbent && (values.expectedPath || values.uploadedPath || values.heldPath || values.incumbentPath))) fail("conflicting selection arguments");
  if (resolve(values.configPath) !== resolve("workers/text-to-lattice-api/wrangler.jsonc")
    || resolve(values.wranglerPath) !== resolve("workers/node_modules/.bin/wrangler")) fail("unreviewed metadata target");
  return values;
}

function readDeployment(inputs, timeout) {
  const response = spawnSync(resolve(inputs.wranglerPath), [
    "deployments", "status", "--json", "--config", inputs.configPath,
  ], { encoding: "utf8", timeout, maxBuffer: MAXIMUM_STATUS_BYTES, stdio: ["ignore", "pipe", "pipe"] });
  if (response.error || response.status !== 0) fail("bounded metadata read failed");
  return JSON.parse(response.stdout);
}

function checkedIncumbent(value) {
  const keys = ["worker", "deploymentId", "versionId", "percentage", "createdAt"];
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join("|") !== keys.sort().join("|")
    || value.worker !== API_WORKER) fail("invalid incumbent snapshot");
  return sanitizeTextToLatticeDeploymentStatus({
    id: value.deploymentId, created_on: value.createdAt,
    versions: [{ version_id: value.versionId, percentage: value.percentage }],
  }, API_WORKER);
}

async function captureIncumbent(args) {
  const inputs = captureArguments(args, true);
  const selected = sanitizeTextToLatticeDeploymentStatus(readDeployment(inputs, 8000), API_WORKER);
  await writeFile(resolve(inputs.outputPath), `${JSON.stringify(selected)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

async function captureSelectedDeployment(args) {
  const inputs = captureArguments(args);
  const expectedVersionId = inputs.uploadedPath ? uploadedApiVersion(await boundedText(inputs.uploadedPath))
    : intendedTextToLatticeApiVersion(await boundedText(inputs.expectedPath));
  const precedingVersionId = inputs.heldPath
    ? intendedTextToLatticeApiVersion(await boundedText(inputs.heldPath))
    : inputs.incumbentPath ? checkedIncumbent(JSON.parse(await boundedText(inputs.incumbentPath))).versionId : null;
  const preBootstrapVersionId = inputs.preBootstrapPath
    ? checkedIncumbent(JSON.parse(await boundedText(inputs.preBootstrapPath))).versionId : null;
  const result = await selectTextToLatticeApiDeployment(expectedVersionId, {
    precedingVersionId, preBootstrapVersionId, readDeployment: timeout => readDeployment(inputs, timeout),
  });
  // Raw status stays ephemeral outside the uploaded sanitized-evidence directory, as before.
  await writeFile(resolve(inputs.outputPath), `${JSON.stringify(result.raw)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  process.stderr.write(`${JSON.stringify(result.evidence)}\n`);
  process.stdout.write(`${result.selected.versionId}\n`);
}

export function uploadedApiVersion(text) {
  if (typeof text !== "string" || Buffer.byteLength(text) > MAXIMUM_STATUS_BYTES) fail("invalid upload record");
  const records = text.trim().split("\n").map(line => JSON.parse(line)).filter(row => row?.type === "version-upload");
  if (records.length !== 1 || records[0].version !== 1 || records[0].worker_name !== API_WORKER
    || !UUID_PATTERN.test(records[0].version_id)) fail("upload did not identify a unique API version");
  return records[0].version_id;
}

export function maintenanceTraffic(raw, incumbent, candidate) {
  if (!UUID_PATTERN.test(incumbent) || !UUID_PATTERN.test(candidate) || incumbent === candidate) fail("invalid version pair");
  const rows = raw?.versions;
  if (!Array.isArray(rows)) fail("missing deployment traffic");
  const serves = (id, percentage) => rows.some(row => row?.version_id === id && row.percentage === percentage);
  if (rows.length === 1 && serves(incumbent, 100)) return "incumbent";
  if (rows.length === 1 && serves(candidate, 100)) return "candidate";
  if (rows.length === 2 && serves(incumbent, 100) && serves(candidate, 0)) return "staged";
  fail("the current deployment is outside this update");
}

export async function transitionMaintenanceTraffic(target, incumbent, candidate, { inspect, deploy, wait = delay }) {
  const traffic = () => maintenanceTraffic(inspect(), incumbent, candidate);
  const prior = traffic();
  if (target === "incumbent" && prior === target) return;
  if (!(target === "staged" && prior === "incumbent" || target === "candidate" && prior === "staged"
    || target === "incumbent" && ["candidate", "staged"].includes(prior))) fail("unexpected traffic transition");
  const split = target === "staged" ? [`${incumbent}@100%`, `${candidate}@0%`]
    : [`${target === "candidate" ? candidate : incumbent}@100%`];
  await deploy(split);
  for (const pause of [0, 1000, 2000, 4000, 8000]) {
    if (pause) await wait(pause);
    if (traffic() === target) return;
  }
  fail("the requested traffic allocation did not converge");
}

async function changeMaintenanceTraffic(target, incumbent, candidate) {
  const wranglerPath = "workers/node_modules/.bin/wrangler";
  const configPath = "workers/text-to-lattice-api/wrangler.jsonc";
  await transitionMaintenanceTraffic(target, incumbent, candidate, {
    inspect: () => readDeployment({ wranglerPath, configPath }, 8000),
    deploy(split) {
      const result = spawnSync(resolve(wranglerPath), ["versions", "deploy", ...split, "--yes", "--config", configPath],
        { timeout: 120_000, stdio: "inherit" });
      if (result.error || result.status !== 0) fail("traffic change was not confirmed");
    },
  });
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  if (process.argv[2] === "--uploaded-version" && process.argv.length === 4) {
    console.log(uploadedApiVersion(await boundedText(process.argv[3])));
  } else if (process.argv[2] === "--maintenance-traffic" && process.argv.length === 6) {
    await changeMaintenanceTraffic(...process.argv.slice(3));
  } else if (["--inspect-deployed", "--capture-incumbent"].includes(process.argv[2])) {
    try {
      if (process.argv[2] === "--capture-incumbent") await captureIncumbent(process.argv.slice(3));
      else await captureSelectedDeployment(process.argv.slice(3));
    }
    catch (error) {
      process.stderr.write(`${JSON.stringify(error?.selectionEvidence ?? {
        format: "TEXT_TO_LATTICE_API_DEPLOYMENT_SELECTION", schemaVersion: 1,
        status: "refused", boundary: "input-or-output", rawMetadataLogged: false,
      })}\n`);
      process.exitCode = 1;
    }
  } else {
    if (process.argv.length !== 3) fail("pass exactly one deployment-status JSON path");
    process.stdout.write(`${await readTextToLatticeActiveVersion(process.argv[2])}\n`);
  }
}
