import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { sanitizeTextToLatticeDeploymentStatus } from "./build-text-to-lattice-deployment-evidence.mjs";

const API_WORKER = "hahdev-text-to-lattice-api";
const MAXIMUM_STATUS_BYTES = 64 * 1024;

function fail(message) {
  throw new Error(`Text to Lattice active-version extraction failed: ${message}`);
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

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  if (process.argv.length !== 3) fail("pass exactly one deployment-status JSON path");
  process.stdout.write(`${await readTextToLatticeActiveVersion(process.argv[2])}\n`);
}
