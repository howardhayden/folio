import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const PROVIDER_SECRET = "HF_TOKEN";
const VISITOR_SECRET = "VISITOR_COOKIE_SECRET";
const ALLOWED_SECRET_NAMES = new Set([PROVIDER_SECRET, VISITOR_SECRET]);

function fail(message) {
  throw new Error(`Text to Lattice API secret bootstrap failed: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function textToLatticeApiSecretBootstrapPlan(
  inventory,
  { randomBytesImpl = randomBytes } = {},
) {
  if (!Array.isArray(inventory)) fail("Wrangler returned an invalid secret-name inventory.");
  if (typeof randomBytesImpl !== "function") {
    throw new TypeError("A cryptographically secure random-byte implementation is required.");
  }

  const existing = new Set();
  for (const binding of inventory) {
    if (!isRecord(binding)
      || typeof binding.name !== "string"
      || binding.type !== "secret_text") {
      fail("Wrangler returned a malformed encrypted-binding inventory entry.");
    }
    if (!ALLOWED_SECRET_NAMES.has(binding.name)) {
      fail(`Unexpected encrypted binding ${binding.name}; refusing to mutate the secret boundary.`);
    }
    if (existing.has(binding.name)) {
      fail(`Wrangler returned duplicate encrypted binding ${binding.name}.`);
    }
    existing.add(binding.name);
  }

  // The provider credential is owner-provisioned. It is never generated,
  // copied from another Worker, read, or accepted through this workflow.
  if (!existing.has(PROVIDER_SECRET)) {
    fail("HF_TOKEN must be provisioned on the exact API Worker before qualification.");
  }
  if (existing.has(VISITOR_SECRET)) return Object.freeze([]);

  const bytes = randomBytesImpl(48);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 48) {
    fail("The visitor-cookie signing secret generator returned an invalid result.");
  }
  return Object.freeze([
    Object.freeze({
      name: VISITOR_SECRET,
      source: "generated-private",
      value: Buffer.from(bytes).toString("base64url"),
    }),
  ]);
}

export function installTextToLatticeApiSecretPlan(plan, {
  wranglerPath,
  configPath,
  env = process.env,
  spawn = spawnSync,
} = {}) {
  if (!Array.isArray(plan) || typeof wranglerPath !== "string" || wranglerPath.length === 0
    || typeof configPath !== "string" || configPath.length === 0 || typeof spawn !== "function") {
    fail("A secret plan, Wrangler path, config path, and process launcher are required.");
  }
  if (plan.length === 0) return;
  if (plan.length !== 1
    || !isRecord(plan[0])
    || plan[0].name !== VISITOR_SECRET
    || plan[0].source !== "generated-private"
    || typeof plan[0].value !== "string"
    || plan[0].value.length < 64) {
    fail("The secret plan may contain only one generated visitor-cookie signing binding.");
  }

  const result = spawn(
    wranglerPath,
    ["secret", "put", VISITOR_SECRET, "--config", configPath],
    {
      cwd: resolve("."),
      encoding: "utf8",
      env,
      input: `${plan[0].value}\n`,
      stdio: ["pipe", "inherit", "inherit"],
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail("Wrangler could not install the missing visitor-cookie signing binding.");
  }
  console.log("Installed the missing Text to Lattice visitor-cookie signing binding.");
}

function cliArguments(argumentsList) {
  const values = {};
  const optionMap = new Map([
    ["--inventory", "inventoryPath"],
    ["--wrangler", "wranglerPath"],
    ["--config", "configPath"],
  ]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const option = argumentsList[index];
    const key = optionMap.get(option);
    if (!key) fail(`Unsupported option ${option}.`);
    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) fail(`${option} requires a value.`);
    if (Object.hasOwn(values, key)) fail(`${option} may be passed only once.`);
    values[key] = value;
    index += 1;
  }
  for (const key of optionMap.values()) {
    if (!values[key]) fail(`${key} is required.`);
  }
  return values;
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  const { inventoryPath, wranglerPath, configPath } = cliArguments(process.argv.slice(2));
  const inventory = JSON.parse(await readFile(resolve(inventoryPath), "utf8"));
  const plan = textToLatticeApiSecretBootstrapPlan(inventory);
  installTextToLatticeApiSecretPlan(plan, { wranglerPath, configPath });
  if (plan.length === 0) {
    console.log("Text to Lattice API encrypted bindings already exist; none were changed.");
  }
}
