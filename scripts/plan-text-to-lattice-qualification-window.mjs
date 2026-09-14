import { appendFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const TEXT_TO_LATTICE_QUALIFICATION_WINDOW_MS = 30 * 60 * 1000;
export const TEXT_TO_LATTICE_QUALIFICATION_CLEANUP_LEAD_MS = 6 * 60 * 1000;

const CANONICAL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function fail(message) {
  throw new Error(`Text to Lattice qualification window failed: ${message}`);
}

function exactDate(value, label) {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) fail(`${label} is invalid.`);
  return value;
}

export function planTextToLatticeQualificationWindow({
  now = () => new Date(),
} = {}) {
  if (typeof now !== "function") throw new TypeError("A clock is required.");
  const plannedAt = exactDate(now(), "the planning timestamp");
  const expiresAt = new Date(plannedAt.valueOf() + TEXT_TO_LATTICE_QUALIFICATION_WINDOW_MS);
  const cleanupAt = new Date(expiresAt.valueOf() - TEXT_TO_LATTICE_QUALIFICATION_CLEANUP_LEAD_MS);
  return Object.freeze({
    qualificationPlannedAt: plannedAt.toISOString(),
    qualificationExpiresAt: expiresAt.toISOString(),
    qualificationCleanupAt: cleanupAt.toISOString(),
  });
}

export async function waitForTextToLatticeQualificationCleanup(cleanupAt, {
  now = () => new Date(),
  wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds)),
} = {}) {
  if (typeof cleanupAt !== "string" || !CANONICAL_TIMESTAMP.test(cleanupAt)
    || typeof now !== "function" || typeof wait !== "function") {
    fail("the cleanup timestamp or wait dependency is invalid.");
  }
  const current = exactDate(now(), "the wait timestamp");
  const target = new Date(cleanupAt);
  if (Number.isNaN(target.valueOf())) fail("the cleanup timestamp is invalid.");
  const delay = Math.max(0, target.valueOf() - current.valueOf());
  if (delay > TEXT_TO_LATTICE_QUALIFICATION_WINDOW_MS) {
    fail("the cleanup timestamp exceeds the bounded qualification window.");
  }
  if (delay > 0) await wait(delay);
  return delay;
}

function cliArguments(argumentsList) {
  if (argumentsList.length !== 2) {
    fail("pass either --github-output <absolute path> or --wait-until <timestamp>.");
  }
  const [option, value] = argumentsList;
  if (option === "--github-output") {
    if (!isAbsolute(value)) fail("--github-output requires an absolute path.");
    return { mode: "plan", value };
  }
  if (option === "--wait-until") return { mode: "wait", value };
  fail(`unsupported option ${option}.`);
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  const { mode, value } = cliArguments(process.argv.slice(2));
  if (mode === "plan") {
    const plan = planTextToLatticeQualificationWindow();
    await appendFile(resolve(value), [
      `qualification_planned_at=${plan.qualificationPlannedAt}`,
      `qualification_expires_at=${plan.qualificationExpiresAt}`,
      `qualification_cleanup_at=${plan.qualificationCleanupAt}`,
      "",
    ].join("\n"), { encoding: "utf8", mode: 0o600 });
    process.stdout.write(`Qualification cleanup is due at ${plan.qualificationCleanupAt}.\n`);
  } else {
    await waitForTextToLatticeQualificationCleanup(value);
    process.stdout.write("The bounded qualification cleanup point has arrived.\n");
  }
}
