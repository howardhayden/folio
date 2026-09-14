import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const API_ORIGIN = "https://api.cloudflare.com/client/v4";
const ZONE_NAME = "hah.dev";
const MAXIMUM_API_RESPONSE_BYTES = 256 * 1024;
const RELEASE_PHASES = new Set(["held", "qualification-pending", "qualified"]);

export const TEXT_TO_LATTICE_ROUTE_INVENTORY = Object.freeze({
  "hahdev-text-to-lattice-api": Object.freeze([
    "hah.dev/api/lattice",
  ]),
  "hahdev-text-to-lattice-response-policy": Object.freeze([
    "hah.dev/",
    "hah.dev/index.html",
    "hah.dev/resume/",
    "hah.dev/resume/index.html",
  ]),
});

export const RETIRED_TEXT_TO_LATTICE_SURFACES = Object.freeze({
  "hahdev-text-to-lattice-lease": Object.freeze({
    kind: "workers-route",
    routes: Object.freeze(["hah.dev/api/text-to-lattice/lease"]),
    customDomains: Object.freeze([]),
    requiredDisposition: "remove-only-after-successful-qualification",
  }),
  "hahdev-text-to-lattice-attestation-frame": Object.freeze({
    kind: "workers-custom-domain",
    routes: Object.freeze([]),
    customDomains: Object.freeze(["verify.hah.dev"]),
    requiredDisposition: "remove-only-after-successful-qualification",
  }),
});

function fail(message) {
  throw new Error(message);
}

async function boundedJson(response, label) {
  const declaredLength = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAXIMUM_API_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => {});
    fail(`${label} exceeded the response-size boundary.`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAXIMUM_API_RESPONSE_BYTES) {
    fail(`${label} exceeded the response-size boundary.`);
  }
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(`${label} did not return bounded UTF-8 JSON.`);
  }
  if (!response.ok || value?.success !== true || !Array.isArray(value.result)) {
    fail(`${label} failed closed.`);
  }
  return value;
}

async function cloudflareGet(fetchImpl, apiToken, pathname, label) {
  let response;
  try {
    response = await fetchImpl(`${API_ORIGIN}${pathname}`, {
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
    fail(`${label} could not be read.`);
  }
  return boundedJson(response, label);
}

function validateRoute(route) {
  if (
    route === null
    || typeof route !== "object"
    || Array.isArray(route)
    || (route.script !== undefined
      && route.script !== null
      && (typeof route.script !== "string" || route.script.length === 0))
    || typeof route.pattern !== "string"
    || route.pattern.length === 0
  ) {
    fail("Cloudflare Worker route inventory contains a malformed entry.");
  }
}

function customDomainService(domain) {
  if (typeof domain.service === "string") return domain.service;
  if (domain.service !== null && typeof domain.service === "object" && !Array.isArray(domain.service)) {
    if (typeof domain.service.name === "string") return domain.service.name;
  }
  return null;
}

function validateCustomDomain(domain) {
  if (domain === null || typeof domain !== "object" || Array.isArray(domain)
    || typeof domain.hostname !== "string" || domain.hostname.length === 0) {
    fail("Cloudflare Worker custom-domain inventory contains a malformed entry.");
  }
  const service = customDomainService(domain);
  if ((domain.service !== undefined && domain.service !== null && service === null)
    || (service !== null && service.length === 0)) {
    fail("Cloudflare Worker custom-domain inventory contains a malformed service.");
  }
}

function sortedOwnedRoutes(routes, script) {
  return routes
    .filter((route) => route.script === script)
    .map(({ pattern }) => pattern)
    .sort();
}

function sortedRetiredRoutes(routes, script, knownPatterns) {
  const patterns = new Set(knownPatterns);
  return routes
    .filter((route) => route.script === script || patterns.has(route.pattern))
    .map(({ pattern }) => pattern)
    .sort();
}

function sortedOwnedDomains(domains, script) {
  return domains
    .filter((domain) => customDomainService(domain) === script)
    .map(({ hostname }) => hostname)
    .sort();
}

function sortedRetiredDomains(domains, script, knownHostnames) {
  const hostnames = new Set(knownHostnames);
  return domains
    .filter((domain) => customDomainService(domain) === script || hostnames.has(domain.hostname))
    .map(({ hostname }) => hostname)
    .sort();
}

function requireExact(actual, expectedValues, message) {
  const expected = [...expectedValues].sort();
  if (actual.length !== expected.length
    || actual.some((value, index) => value !== expected[index])) {
    fail(message);
  }
}

function retiredSurfaceEvidence(routes, customDomains, releasePhase) {
  const evidence = [];
  for (const [script, disposition] of Object.entries(RETIRED_TEXT_TO_LATTICE_SURFACES)) {
    for (const pattern of disposition.routes) {
      const addressed = routes.filter((route) => route.pattern === pattern);
      if (addressed.length > 1 || addressed.some((route) => route.script !== script)) {
        fail(`${pattern} is duplicated or is not owned by ${script}.`);
      }
    }
    for (const hostname of disposition.customDomains) {
      const addressed = customDomains.filter((domain) => domain.hostname === hostname);
      if (addressed.length > 1
        || addressed.some((domain) => customDomainService(domain) !== script)) {
        fail(`${hostname} is duplicated or is not owned by ${script}.`);
      }
    }
    const observedRoutes = sortedRetiredRoutes(routes, script, disposition.routes);
    const observedCustomDomains = sortedRetiredDomains(customDomains, script, disposition.customDomains);
    const permittedRoutes = new Set(disposition.routes);
    const permittedDomains = new Set(disposition.customDomains);
    if (observedRoutes.some((route) => !permittedRoutes.has(route))
      || observedCustomDomains.some((hostname) => !permittedDomains.has(hostname))) {
      fail(`${script} owns an undeclared retired route or custom domain.`);
    }
    const present = observedRoutes.length > 0 || observedCustomDomains.length > 0;
    if (releasePhase === "qualified" && present) {
      fail(`${script} must be detached before qualified release.`);
    }
    evidence.push(Object.freeze({
      script,
      kind: disposition.kind,
      requiredDisposition: disposition.requiredDisposition,
      status: present ? "retirement-required" : "retired-surface-absent",
      observedRoutes: Object.freeze(observedRoutes),
      observedCustomDomains: Object.freeze(observedCustomDomains),
    }));
  }
  return Object.freeze(evidence);
}

export async function verifyTextToLatticeRouteInventory({
  accountId = process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken = process.env.CLOUDFLARE_API_TOKEN,
  fetchImpl = fetch,
  releasePhase = "held",
} = {}) {
  if (typeof apiToken !== "string" || apiToken.length < 20 || /\s/u.test(apiToken)) {
    fail("A valid protected Cloudflare API token is required for route inspection.");
  }
  if (typeof accountId !== "string" || !/^[a-f0-9]{32}$/iu.test(accountId)) {
    fail("A valid Cloudflare account identifier is required for custom-domain inspection.");
  }
  if (!RELEASE_PHASES.has(releasePhase)) {
    fail("releasePhase must be held, qualification-pending, or qualified.");
  }
  if (typeof fetchImpl !== "function") fail("A fetch implementation is required.");

  const zoneInventory = await cloudflareGet(
    fetchImpl,
    apiToken,
    `/zones?name=${encodeURIComponent(ZONE_NAME)}&status=active&per_page=50`,
    "Cloudflare zone inventory",
  );
  const zones = zoneInventory.result;
  if (zones.length !== 1 || !/^[A-Fa-f0-9]{32}$/u.test(zones[0]?.id ?? "")
    || zones[0].name !== ZONE_NAME || zones[0].status !== "active") {
    fail("Cloudflare did not return exactly one active hah.dev zone.");
  }
  const [routeInventory, customDomainInventory] = await Promise.all([
    cloudflareGet(
      fetchImpl,
      apiToken,
      `/zones/${zones[0].id}/workers/routes`,
      "Cloudflare Worker route inventory",
    ),
    cloudflareGet(
      fetchImpl,
      apiToken,
      `/accounts/${accountId}/workers/domains`,
      "Cloudflare Worker custom-domain inventory",
    ),
  ]);
  const routes = routeInventory.result;
  const customDomains = customDomainInventory.result;
  routes.forEach(validateRoute);
  customDomains.forEach(validateCustomDomain);

  const active = [];
  for (const [script, expectedPatterns] of Object.entries(TEXT_TO_LATTICE_ROUTE_INVENTORY)) {
    const actualPatterns = sortedOwnedRoutes(routes, script);
    requireExact(
      actualPatterns,
      expectedPatterns,
      `${script} does not own exactly its declared Cloudflare route inventory.`,
    );
    const ownedDomains = sortedOwnedDomains(customDomains, script);
    requireExact(
      ownedDomains,
      [],
      `${script} must use only its declared zone routes, not a custom domain.`,
    );
    active.push(Object.freeze({
      script,
      routes: Object.freeze(actualPatterns),
      customDomains: Object.freeze([]),
    }));
  }

  const retired = retiredSurfaceEvidence(routes, customDomains, releasePhase);
  return Object.freeze({
    format: "TEXT_TO_LATTICE_ROUTE_INVENTORY_EVIDENCE",
    schemaVersion: 1,
    zone: ZONE_NAME,
    releasePhase,
    active: Object.freeze(active),
    retired,
    unrelatedRouteCount: routes.filter(({ script }) => (
      !Object.hasOwn(TEXT_TO_LATTICE_ROUTE_INVENTORY, script ?? "")
      && !Object.hasOwn(RETIRED_TEXT_TO_LATTICE_SURFACES, script ?? "")
    )).length,
    unrelatedCustomDomainCount: customDomains.filter((domain) => {
      const script = customDomainService(domain);
      const retiredHostname = Object.values(RETIRED_TEXT_TO_LATTICE_SURFACES)
        .some(({ customDomains: hostnames }) => hostnames.includes(domain.hostname));
      return !Object.hasOwn(TEXT_TO_LATTICE_ROUTE_INVENTORY, script ?? "")
        && !Object.hasOwn(RETIRED_TEXT_TO_LATTICE_SURFACES, script ?? "")
        && !retiredHostname;
    }).length,
  });
}

function cliArguments(argumentsList) {
  let releasePhase = process.env.TEXT_TO_LATTICE_RELEASE_PHASE ?? "held";
  let outputPath = null;
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--release-phase") {
      releasePhase = argumentsList[index + 1] ?? "";
      index += 1;
    } else if (argument === "--output") {
      outputPath = argumentsList[index + 1] ?? null;
      index += 1;
    } else {
      fail(`Unknown option ${argument}.`);
    }
  }
  if (!outputPath) fail("Pass --output with a sanitized route-evidence path.");
  return { outputPath, releasePhase };
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  const { outputPath, releasePhase } = cliArguments(process.argv.slice(2));
  const evidence = await verifyTextToLatticeRouteInventory({ releasePhase });
  const resolvedOutput = resolve(outputPath);
  await mkdir(dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log("Text to Lattice Workers own their exact active routes; retired surfaces were recorded without mutation.");
}
