import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  CLOUDFLARE_DEMONSTRATION_SECRET_KEY,
  CLOUDFLARE_DEMONSTRATION_SITE_KEY,
} from "../workers/text-to-lattice-lease/demonstrationProfile.js";

const PRIVATE_SECRET_NAMES = Object.freeze([
  "VISITOR_COOKIE_SECRET",
  "LEASE_CREDENTIAL_SECRET",
]);
const TURNSTILE_SECRET_NAMES = Object.freeze([
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_SITE_KEY",
]);
const REQUIRED_SECRET_NAMES = new Set([
  ...PRIVATE_SECRET_NAMES,
  ...TURNSTILE_SECRET_NAMES,
]);

// Cloudflare publishes this pair specifically for deterministic integration
// testing. It is not an anti-bot credential and must remain classified as a
// demonstration boundary in the release register.
const CLOUDFLARE_TEST_VALUES = Object.freeze({
  TURNSTILE_SECRET_KEY: CLOUDFLARE_DEMONSTRATION_SECRET_KEY,
  TURNSTILE_SITE_KEY: CLOUDFLARE_DEMONSTRATION_SITE_KEY,
});

function fail(message) {
  throw new Error(message);
}

export function secretBootstrapPlan(inventory, { requireOfficialTestProfile = false } = {}) {
  if (!Array.isArray(inventory)) fail("Wrangler returned an invalid secret-name inventory.");
  const existing = new Set();
  for (const binding of inventory) {
    const name = binding !== null && typeof binding === "object" && !Array.isArray(binding)
      ? binding.name
      : null;
    if (typeof name !== "string" || name.length === 0) {
      fail("Wrangler returned a malformed secret-name inventory entry.");
    }
    if (existing.has(name)) {
      fail(`Wrangler returned duplicate encrypted binding ${name}.`);
    }
    if (!REQUIRED_SECRET_NAMES.has(name)) {
      fail(`Unexpected encrypted binding ${name}; refusing to mutate the secret boundary.`);
    }
    existing.add(name);
  }

  const turnstilePresent = TURNSTILE_SECRET_NAMES.filter((name) => existing.has(name));
  if (turnstilePresent.length === 1) {
    fail("Turnstile bindings are incomplete; refusing to install a mixed credential pair.");
  }
  if (turnstilePresent.length === 0 && !requireOfficialTestProfile) {
    fail("Turnstile bindings are absent and the official testing profile was not explicitly required.");
  }

  return Object.freeze([
    ...PRIVATE_SECRET_NAMES
      .filter((name) => !existing.has(name))
      .map((name) => Object.freeze({
        name,
        source: "generated-private",
        value: randomBytes(48).toString("base64url"),
      })),
    ...(requireOfficialTestProfile && turnstilePresent.length === 0
      ? TURNSTILE_SECRET_NAMES.map((name) => Object.freeze({
        name,
        source: "cloudflare-official-test",
        value: CLOUDFLARE_TEST_VALUES[name],
      }))
      : []),
  ]);
}

export function installSecretPlan(plan, {
  wranglerPath,
  configPath,
  env = process.env,
  spawn = spawnSync,
} = {}) {
  if (!Array.isArray(plan) || !wranglerPath || !configPath) {
    fail("A secret plan, Wrangler path, and config path are required.");
  }
  if (plan.length === 0) return;

  const payload = {};
  for (const item of plan) {
    if (!item || !REQUIRED_SECRET_NAMES.has(item.name)) {
      fail("The secret plan contains an unexpected encrypted binding.");
    }
    if (Object.hasOwn(payload, item.name)) {
      fail(`The secret plan contains duplicate binding ${item.name}.`);
    }
    if (typeof item.value !== "string" || item.value.length === 0) {
      fail(`The secret plan contains no value for ${item.name}.`);
    }
    payload[item.name] = item.value;
  }

  // Wrangler sends `secret bulk` as one API request. Supplying the complete
  // missing set on stdin avoids the partially installed state possible when
  // issuing one `secret put` command per binding.
  const result = spawn(
    wranglerPath,
    ["secret", "bulk", "--config", configPath],
    {
      cwd: resolve("."),
      encoding: "utf8",
      env,
      input: `${JSON.stringify(payload)}\n`,
      stdio: ["pipe", "inherit", "inherit"],
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) fail("Wrangler could not atomically install the encrypted binding set.");
  console.log(`Installed ${plan.length} encrypted bindings in one bulk operation.`);
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  const argumentsSet = new Set(process.argv.slice(2));
  const inventoryFlag = process.argv.indexOf("--inventory");
  const wranglerFlag = process.argv.indexOf("--wrangler");
  const configFlag = process.argv.indexOf("--config");
  const allowed = new Set([
    "--require-official-test-profile",
    "--inventory",
    "--wrangler",
    "--config",
  ]);
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (!argument.startsWith("--")) continue;
    if (!allowed.has(argument)) fail(`Unsupported option ${argument}.`);
    if (argument !== "--require-official-test-profile") index += 1;
  }
  const inventoryPath = process.argv[inventoryFlag + 1];
  const wranglerPath = process.argv[wranglerFlag + 1];
  const configPath = process.argv[configFlag + 1];
  if (inventoryFlag < 0 || wranglerFlag < 0 || configFlag < 0) {
    fail("Pass --inventory, --wrangler, and --config.");
  }
  const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
  const plan = secretBootstrapPlan(inventory, {
    requireOfficialTestProfile: argumentsSet.has("--require-official-test-profile"),
  });
  installSecretPlan(plan, { wranglerPath, configPath });
  if (plan.length === 0) console.log("Text to Lattice encrypted bindings already exist; none were changed.");
}
