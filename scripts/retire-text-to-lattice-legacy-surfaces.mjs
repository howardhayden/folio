import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { RETIRED_TEXT_TO_LATTICE_SURFACES } from "./verify-text-to-lattice-route-inventory.mjs";

const API_ORIGIN = "https://api.cloudflare.com/client/v4";
const ZONE_NAME = "hah.dev";
const LEASE_SCRIPT = "hahdev-text-to-lattice-lease";
const FRAME_SCRIPT = "hahdev-text-to-lattice-attestation-frame";
const LEASE_ROUTE = RETIRED_TEXT_TO_LATTICE_SURFACES[LEASE_SCRIPT].routes[0];
const FRAME_DOMAIN = RETIRED_TEXT_TO_LATTICE_SURFACES[FRAME_SCRIPT].customDomains[0];
const MAXIMUM_API_RESPONSE_BYTES = 256 * 1024;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{8,128}$/u;

function fail(message) {
  throw new Error(`Text to Lattice legacy-surface retirement failed: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function boundedApiJson(response, label, { requireArray = true } = {}) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAXIMUM_API_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => {});
    fail(`${label} exceeded the response-size boundary`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAXIMUM_API_RESPONSE_BYTES) fail(`${label} exceeded the response-size boundary`);
  let envelope;
  try {
    envelope = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(`${label} did not return bounded UTF-8 JSON`);
  }
  if (!response.ok || envelope?.success !== true
    || (requireArray && !Array.isArray(envelope.result))) {
    fail(`${label} failed closed`);
  }
  return envelope.result;
}

async function cloudflareRequest(fetchImpl, apiToken, pathname, label, method = "GET") {
  let response;
  try {
    response = await fetchImpl(`${API_ORIGIN}${pathname}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    fail(`${label} could not be reached`);
  }
  return boundedApiJson(response, label, { requireArray: method === "GET" });
}

function domainService(domain) {
  if (typeof domain.service === "string") return domain.service;
  if (isRecord(domain.service) && typeof domain.service.name === "string") return domain.service.name;
  return null;
}

function validateRoute(route) {
  if (!isRecord(route) || !IDENTIFIER_PATTERN.test(route.id ?? "")
    || typeof route.pattern !== "string" || route.pattern.length === 0
    || (route.script !== null && route.script !== undefined
      && (typeof route.script !== "string" || route.script.length === 0))) {
    fail("the route inventory contains a malformed entry");
  }
}

function validateDomain(domain) {
  if (!isRecord(domain) || !IDENTIFIER_PATTERN.test(domain.id ?? "")
    || typeof domain.hostname !== "string" || domain.hostname.length === 0) {
    fail("the custom-domain inventory contains a malformed entry");
  }
}

function selectExactTarget(records, {
  expectedOwner,
  expectedValue,
  ownerFor,
  valueFor,
  label,
}) {
  const owned = records.filter((record) => ownerFor(record) === expectedOwner);
  const addressed = records.filter((record) => valueFor(record) === expectedValue);
  if (owned.some((record) => valueFor(record) !== expectedValue)) {
    fail(`${expectedOwner} owns an extra ${label}; refusing retirement`);
  }
  if (addressed.some((record) => ownerFor(record) !== expectedOwner)) {
    fail(`${expectedValue} is not owned by ${expectedOwner}; refusing retirement`);
  }
  if (owned.length > 1 || addressed.length > 1) {
    fail(`${expectedValue} has a duplicate ${label}; refusing retirement`);
  }
  return addressed[0] ?? null;
}

function inspectRetiredTargets(routes, domains) {
  routes.forEach(validateRoute);
  domains.forEach(validateDomain);
  const lease = selectExactTarget(routes, {
    expectedOwner: LEASE_SCRIPT,
    expectedValue: LEASE_ROUTE,
    ownerFor: (route) => route.script ?? null,
    valueFor: (route) => route.pattern,
    label: "zone route",
  });
  const frame = selectExactTarget(domains, {
    expectedOwner: FRAME_SCRIPT,
    expectedValue: FRAME_DOMAIN,
    ownerFor: domainService,
    valueFor: (domain) => domain.hostname,
    label: "custom domain",
  });

  const leaseDomains = domains.filter((domain) => domainService(domain) === LEASE_SCRIPT);
  const frameRoutes = routes.filter((route) => route.script === FRAME_SCRIPT);
  if (leaseDomains.length > 0 || frameRoutes.length > 0) {
    fail("a retired Worker owns an undeclared surface; refusing retirement");
  }
  return Object.freeze({ lease, frame });
}

async function inventory(fetchImpl, apiToken, accountId, zoneId) {
  const [routes, domains] = await Promise.all([
    cloudflareRequest(
      fetchImpl,
      apiToken,
      `/zones/${zoneId}/workers/routes`,
      "Cloudflare Worker route inventory",
    ),
    cloudflareRequest(
      fetchImpl,
      apiToken,
      `/accounts/${accountId}/workers/domains`,
      "Cloudflare Worker custom-domain inventory",
    ),
  ]);
  return inspectRetiredTargets(routes, domains);
}

function targetEvidence(targets) {
  return Object.freeze({
    leaseRoute: Object.freeze({
      script: LEASE_SCRIPT,
      route: LEASE_ROUTE,
      status: targets.lease ? "attached" : "detached",
    }),
    verificationDomain: Object.freeze({
      script: FRAME_SCRIPT,
      hostname: FRAME_DOMAIN,
      status: targets.frame ? "attached" : "detached",
    }),
  });
}

function requireSameTargets(expected, observed, label) {
  for (const key of ["lease", "frame"]) {
    if ((expected[key]?.id ?? null) !== (observed[key]?.id ?? null)) {
      fail(`the ${label} inventory changed after planning; refusing retirement`);
    }
  }
}

export async function retireTextToLatticeLegacySurfaces({
  accountId = process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken = process.env.CLOUDFLARE_API_TOKEN,
  apply = false,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
} = {}) {
  if (typeof apiToken !== "string" || apiToken.length < 20 || /\s/u.test(apiToken)) {
    fail("a valid protected Cloudflare API token is required");
  }
  if (typeof accountId !== "string" || !/^[a-f0-9]{32}$/iu.test(accountId)) {
    fail("a valid Cloudflare account identifier is required");
  }
  if (typeof apply !== "boolean" || typeof fetchImpl !== "function" || typeof now !== "function") {
    throw new TypeError("The retirement operation received an invalid dependency.");
  }
  const observedAt = now();
  if (!(observedAt instanceof Date) || Number.isNaN(observedAt.valueOf())) {
    fail("the evidence timestamp is invalid");
  }

  const zones = await cloudflareRequest(
    fetchImpl,
    apiToken,
    `/zones?name=${encodeURIComponent(ZONE_NAME)}&status=active&per_page=50`,
    "Cloudflare zone inventory",
  );
  if (zones.length !== 1 || !/^[a-f0-9]{32}$/iu.test(zones[0]?.id ?? "")
    || zones[0].name !== ZONE_NAME || zones[0].status !== "active") {
    fail("Cloudflare did not return exactly one active hah.dev zone");
  }
  const zoneId = zones[0].id;
  const before = await inventory(fetchImpl, apiToken, accountId, zoneId);
  const plannedMutations = Object.freeze([
    ...(before.lease ? [Object.freeze({ kind: "detach-zone-route", target: LEASE_ROUTE })] : []),
    ...(before.frame ? [Object.freeze({ kind: "detach-custom-domain", target: FRAME_DOMAIN })] : []),
  ]);

  if (apply) {
    let current = await inventory(fetchImpl, apiToken, accountId, zoneId);
    requireSameTargets(before, current, "preflight");
    if (current.lease) {
      await cloudflareRequest(
        fetchImpl,
        apiToken,
        `/zones/${zoneId}/workers/routes/${current.lease.id}`,
        "legacy lease-route detachment",
        "DELETE",
      );
    }
    if (current.frame && current.lease) {
      const afterLease = await inventory(fetchImpl, apiToken, accountId, zoneId);
      if (afterLease.lease || afterLease.frame?.id !== current.frame.id) {
        fail("the retirement inventory changed after lease-route detachment; refusing further mutation");
      }
      current = afterLease;
    }
    if (current.frame) {
      await cloudflareRequest(
        fetchImpl,
        apiToken,
        `/accounts/${accountId}/workers/domains/${current.frame.id}`,
        "legacy verification-domain detachment",
        "DELETE",
      );
    }
  }

  const after = apply
    ? await inventory(fetchImpl, apiToken, accountId, zoneId)
    : before;
  if (apply && (after.lease || after.frame)) {
    fail("a retired entry surface remained attached after the apply operation");
  }

  return Object.freeze({
    format: "TEXT_TO_LATTICE_RETIREMENT_EVIDENCE",
    schemaVersion: 1,
    observedAt: observedAt.toISOString(),
    mode: apply ? "apply" : "plan",
    outcome: apply ? "applied-and-verified" : "planned",
    zone: ZONE_NAME,
    before: targetEvidence(before),
    plannedMutations,
    preflightVerified: apply,
    appliedMutationCount: apply ? plannedMutations.length : 0,
    after: apply ? targetEvidence(after) : null,
    activationReady: apply && !after.lease && !after.frame,
    workerScriptsDeleted: false,
    durableObjectStorageDeleted: false,
    secretValuesRead: false,
  });
}

export function textToLatticeRetirementFailureEvidence({
  apply,
  now = () => new Date(),
} = {}) {
  if (typeof apply !== "boolean" || typeof now !== "function") {
    throw new TypeError("The retirement failure receipt received an invalid dependency.");
  }
  const observedAt = now();
  if (!(observedAt instanceof Date) || Number.isNaN(observedAt.valueOf())) {
    fail("the failure-evidence timestamp is invalid");
  }
  return Object.freeze({
    format: "TEXT_TO_LATTICE_RETIREMENT_EVIDENCE",
    schemaVersion: 1,
    observedAt: observedAt.toISOString(),
    mode: apply ? "apply" : "plan",
    outcome: "failed-closed",
    zone: ZONE_NAME,
    before: null,
    plannedMutations: null,
    preflightVerified: false,
    appliedMutationCount: null,
    after: null,
    activationReady: false,
    entrySurfaceDisposition: apply ? "unknown-or-partial" : "unchanged",
    workerScriptsDeleted: false,
    durableObjectStorageDeleted: false,
    secretValuesRead: false,
  });
}

function cliArguments(argumentsList) {
  let apply = false;
  let outputPath = null;
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--apply") apply = true;
    else if (argument === "--output") {
      outputPath = argumentsList[index + 1] ?? null;
      index += 1;
    } else fail(`unknown option ${argument}`);
  }
  if (!outputPath) fail("--output with a sanitized evidence path is required");
  return { apply, outputPath };
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  const { apply, outputPath } = cliArguments(process.argv.slice(2));
  const resolvedOutput = resolve(outputPath);
  let evidence;
  try {
    evidence = await retireTextToLatticeLegacySurfaces({ apply });
  } catch (error) {
    evidence = textToLatticeRetirementFailureEvidence({ apply });
    await mkdir(dirname(resolvedOutput), { recursive: true });
    await writeFile(resolvedOutput, `${JSON.stringify(evidence, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    process.stderr.write(`${error instanceof Error ? error.message : "Legacy retirement failed closed."}\n`);
    process.exitCode = 1;
  }
  if (evidence.outcome !== "failed-closed") {
    await mkdir(dirname(resolvedOutput), { recursive: true });
    await writeFile(resolvedOutput, `${JSON.stringify(evidence, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    console.log(apply
      ? "Exact legacy Text to Lattice entry surfaces are detached; Worker scripts and state were preserved."
      : "Legacy Text to Lattice retirement plan recorded; no external mutation was performed.");
  }
}
