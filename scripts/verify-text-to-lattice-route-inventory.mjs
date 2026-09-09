import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const API_ORIGIN = "https://api.cloudflare.com/client/v4";
const ZONE_NAME = "hah.dev";
const MAXIMUM_API_RESPONSE_BYTES = 256 * 1024;

export const TEXT_TO_LATTICE_ROUTE_INVENTORY = Object.freeze({
  "hahdev-text-to-lattice-response-policy": Object.freeze([
    "hah.dev/",
    "hah.dev/index.html",
    "hah.dev/resume/",
    "hah.dev/resume/index.html",
  ]),
  "hahdev-text-to-lattice-lease": Object.freeze([
    "hah.dev/api/text-to-lattice/lease",
  ]),
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

export async function verifyTextToLatticeRouteInventory({
  apiToken = process.env.CLOUDFLARE_API_TOKEN,
  fetchImpl = fetch,
} = {}) {
  if (typeof apiToken !== "string" || apiToken.length < 20 || /\s/u.test(apiToken)) {
    fail("A valid protected Cloudflare API token is required for route inspection.");
  }
  const zoneInventory = await cloudflareGet(
    fetchImpl,
    apiToken,
    `/zones?name=${encodeURIComponent(ZONE_NAME)}&status=active&per_page=50`,
    "Cloudflare zone inventory",
  );
  const zones = zoneInventory.result;
  if (zones.length !== 1 || !/^[A-Fa-f0-9]{32}$/u.test(zones[0]?.id ?? "")) {
    fail("Cloudflare did not return exactly one active hah.dev zone.");
  }
  const routeInventory = await cloudflareGet(
    fetchImpl,
    apiToken,
    `/zones/${zones[0].id}/workers/routes`,
    "Cloudflare Worker route inventory",
  );
  const routes = routeInventory.result;
  for (const route of routes) {
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
  for (const [script, expectedPatterns] of Object.entries(TEXT_TO_LATTICE_ROUTE_INVENTORY)) {
    const actualPatterns = routes
      .filter((route) => route?.script === script)
      .map((route) => route?.pattern)
      .filter((pattern) => typeof pattern === "string")
      .sort();
    const expected = [...expectedPatterns].sort();
    if (
      actualPatterns.length !== expected.length
      || actualPatterns.some((pattern, index) => pattern !== expected[index])
    ) {
      fail(`${script} does not own exactly its declared Cloudflare route inventory.`);
    }
  }
  console.log("Text to Lattice Workers own exactly their declared hah.dev routes.");
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) await verifyTextToLatticeRouteInventory();
