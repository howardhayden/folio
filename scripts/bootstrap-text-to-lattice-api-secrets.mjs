import { randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { sanitizeTextToLatticeDeploymentStatus } from "./build-text-to-lattice-deployment-evidence.mjs";

const PROVIDER_SECRET = "HF_TOKEN";
const VISITOR_SECRET = "VISITOR_COOKIE_SECRET";
const ALLOWED_SECRET_NAMES = new Set([PROVIDER_SECRET, VISITOR_SECRET]);
const WORKER = "hahdev-text-to-lattice-api";
const METADATA_LIMIT = 64 * 1024;

function fail(message) {
  throw new Error(`Text to Lattice API secret bootstrap failed: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function secretNames(inventory) {
  if (!Array.isArray(inventory)) fail("Wrangler returned an invalid secret-name inventory.");
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
  return existing;
}

export function textToLatticeApiSecretBootstrapPlan(
  inventory,
  { randomBytesImpl = randomBytes } = {},
) {
  const existing = secretNames(inventory);
  if (typeof randomBytesImpl !== "function") {
    throw new TypeError("A cryptographically secure random-byte implementation is required.");
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

export function publishedHeldVersion(text) {
  const rows = text.trim().split("\n").map(line => JSON.parse(line));
  const deployments = rows.filter(row => row?.type === "deploy");
  const [deployed] = deployments;
  if (deployments.length !== 1 || deployed.version !== 1 || deployed.worker_name !== WORKER
    || typeof deployed.version_id !== "string"
    || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(deployed.version_id)) {
    fail("The held deployment did not identify exactly one version of the API Worker.");
  }
  return deployed.version_id;
}

// A valid but incomplete script-level listing can lag a new deployment.
// Only metadata is re-read. Never generate a replacement based on that first listing.
export async function confirmApiSecretInventory(initial, {
  readInventory, publishedVersion, readVersion, readActiveVersion, wait = delay,
}) {
  const first = secretNames(initial);
  if (first.size === ALLOWED_SECRET_NAMES.size) return initial;

  let expected = ALLOWED_SECRET_NAMES;
  let versionId;
  if (publishedVersion) {
    versionId = await publishedVersion();
    const version = await readVersion(versionId);
    if (version?.id !== versionId || !Array.isArray(version.resources?.bindings)
      || !version.resources.bindings.every(binding => isRecord(binding)
        && typeof binding.name === "string" && binding.name.length > 0
        && typeof binding.type === "string" && binding.type.length > 0)) {
      fail("The API Worker version did not match the held deployment.");
    }
    expected = secretNames(version.resources.bindings.filter(binding =>
      binding?.type === "secret_text" || binding?.type === "secret_key" || ALLOWED_SECRET_NAMES.has(binding?.name)));
    if (!expected.has(PROVIDER_SECRET)) {
      fail("HF_TOKEN must be provisioned on the exact API Worker before qualification.");
    }
  }

  for (const milliseconds of [1000, 3000, 6000]) {
    await wait(milliseconds);
    const inventory = await readInventory();
    const current = secretNames(inventory);
    if (current.size !== expected.size || ![...expected].every(name => current.has(name))) continue;
    if (!current.has(VISITOR_SECRET) && await readActiveVersion() !== versionId) {
      fail("The held API Worker version changed before visitor-cookie bootstrap.");
    }
    return inventory;
  }
  fail("The encrypted binding inventories did not converge within the metadata checks.");
}

function wranglerMetadata(wranglerPath, configPath, args) {
  const result = spawnSync(wranglerPath, [...args, "--config", configPath], {
    encoding: "utf8", timeout: 8000, maxBuffer: METADATA_LIMIT, stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) fail("Wrangler could not read the bounded API Worker metadata.");
  return JSON.parse(result.stdout);
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

function cliArguments(argumentsList, finalRead) {
  const values = {};
  const optionMap = new Map([
    ["--inventory", "inventoryPath"],
    ["--wrangler", "wranglerPath"],
    ["--config", "configPath"],
  ]);
  if (finalRead) optionMap.delete("--inventory");
  else optionMap.set("--held-deployment", "deploymentPath");
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
  const finalRead = process.argv[2] === "--read-final-inventory";
  const { inventoryPath, wranglerPath, configPath, deploymentPath } = cliArguments(process.argv.slice(finalRead ? 3 : 2), finalRead);
  const readMetadata = args => wranglerMetadata(wranglerPath, configPath, args);
  const readInventory = () => readMetadata(["secret", "list", "--format", "json"]);
  const initial = finalRead ? readInventory() : JSON.parse(await readFile(resolve(inventoryPath), "utf8"));
  const inventory = await confirmApiSecretInventory(initial, {
    readInventory,
    publishedVersion: finalRead ? undefined : async () => {
      if ((await stat(deploymentPath)).size > METADATA_LIMIT) fail("The held deployment record was too large.");
      return publishedHeldVersion(await readFile(deploymentPath, "utf8"));
    },
    readVersion: id => readMetadata(["versions", "view", id, "--json"]),
    readActiveVersion: () => sanitizeTextToLatticeDeploymentStatus(
      readMetadata(["deployments", "status", "--json"]), WORKER,
    ).versionId,
  });
  if (finalRead) {
    process.stdout.write(JSON.stringify(inventory.map(({ name, type }) => ({ name, type }))) + "\n");
  } else {
    const plan = textToLatticeApiSecretBootstrapPlan(inventory);
    installTextToLatticeApiSecretPlan(plan, { wranglerPath, configPath });
    if (plan.length === 0) {
      console.log("Text to Lattice API encrypted bindings already exist; none were changed.");
    }
  }
}
