import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const expectedNames = [
  "LEASE_CREDENTIAL_SECRET",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_SITE_KEY",
  "VISITOR_COOKIE_SECRET",
];

export function verifyTextToLatticeSecretBindings(inventory) {
  if (!Array.isArray(inventory)) {
    throw new Error("Wrangler returned an invalid secret-name inventory.");
  }

  const actualNames = inventory
    .map((binding) => binding?.name)
    .filter((name) => typeof name === "string")
    .sort();

  if (
    actualNames.length !== expectedNames.length
    || actualNames.some((name, index) => name !== expectedNames[index])
  ) {
    throw new Error(
      "The lease Worker must have exactly the four documented encrypted bindings.",
    );
  }
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Pass the path to Wrangler's JSON secret-name inventory.");
  }
  const inventory = JSON.parse(await readFile(inputPath, "utf8"));
  verifyTextToLatticeSecretBindings(inventory);
  console.log("Text to Lattice encrypted binding names are complete and exact.");
}
