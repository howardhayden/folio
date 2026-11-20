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
  wait = delay,
  monotonicNow = () => performance.now(),
} = {}) {
  if (!UUID_PATTERN.test(expectedVersionId ?? "") || typeof readDeployment !== "function"
    || typeof wait !== "function" || typeof monotonicNow !== "function"
    || (precedingVersionId !== null && (!UUID_PATTERN.test(precedingVersionId)
      || precedingVersionId === expectedVersionId))) fail("invalid selection inputs");
  const start = monotonicNow();
  let last = start;
  const observations = [];
  const report = (status, boundary = null) => Object.freeze({
    format: "TEXT_TO_LATTICE_API_DEPLOYMENT_SELECTION", schemaVersion: 1,
    status, boundary, expectedVersionId, precedingVersionId,
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
    // Only the exact observed incumbent or preceding bootstrap may briefly remain selected.
    // Every post-probe check passes no predecessor and never waits.
    if (precedingVersionId === null || selected.versionId !== precedingVersionId) refuse("unexpected-version");
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
    ["--expected-deployment", "expectedPath"], ["--preceding-held-deployment", "heldPath"],
    ["--preceding-incumbent", "incumbentPath"],
    ["--wrangler", "wranglerPath"], ["--config", "configPath"], ["--output", "outputPath"],
  ]);
  for (let index = 0; index < args.length; index += 2) {
    const key = names.get(args[index]); const value = args[index + 1];
    if (!key || !value || value.startsWith("--") || Object.hasOwn(values, key)) fail("invalid selection arguments");
    values[key] = value;
  }
  if ([...(incumbent ? [] : ["expectedPath"]), "wranglerPath", "configPath", "outputPath"].some(key => !values[key])) fail("missing selection arguments");
  if ((values.heldPath && values.incumbentPath)
    || (incumbent && (values.expectedPath || values.heldPath || values.incumbentPath))) fail("conflicting selection arguments");
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
  const expectedVersionId = intendedTextToLatticeApiVersion(await boundedText(inputs.expectedPath));
  const precedingVersionId = inputs.heldPath
    ? intendedTextToLatticeApiVersion(await boundedText(inputs.heldPath))
    : inputs.incumbentPath ? checkedIncumbent(JSON.parse(await boundedText(inputs.incumbentPath))).versionId : null;
  const result = await selectTextToLatticeApiDeployment(expectedVersionId, {
    precedingVersionId, readDeployment: timeout => readDeployment(inputs, timeout),
  });
  // Raw status stays ephemeral outside the uploaded sanitized-evidence directory, as before.
  await writeFile(resolve(inputs.outputPath), `${JSON.stringify(result.raw)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  process.stderr.write(`${JSON.stringify(result.evidence)}\n`);
  process.stdout.write(`${result.selected.versionId}\n`);
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  if (["--inspect-deployed", "--capture-incumbent"].includes(process.argv[2])) {
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
