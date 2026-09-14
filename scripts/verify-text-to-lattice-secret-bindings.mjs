import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const TEXT_TO_LATTICE_SECRET_BINDINGS = Object.freeze([
  Object.freeze({ name: "HF_TOKEN", type: "secret_text" }),
  Object.freeze({ name: "VISITOR_COOKIE_SECRET", type: "secret_text" }),
]);

function fail(message) {
  throw new Error(message);
}

function normalizedBinding(binding) {
  if (binding === null || typeof binding !== "object" || Array.isArray(binding)) {
    fail("Wrangler returned a malformed secret-name inventory entry.");
  }
  const { name, type } = binding;
  if (typeof name !== "string" || name.length === 0 || typeof type !== "string" || type.length === 0) {
    fail("Wrangler returned a malformed secret-name inventory entry.");
  }
  return Object.freeze({ name, type });
}

export function verifyTextToLatticeSecretBindings(inventory) {
  if (!Array.isArray(inventory)) {
    fail("Wrangler returned an invalid secret-name inventory.");
  }

  const actual = inventory.map(normalizedBinding).sort((left, right) => (
    left.name.localeCompare(right.name) || left.type.localeCompare(right.type)
  ));
  const expected = [...TEXT_TO_LATTICE_SECRET_BINDINGS].sort((left, right) => (
    left.name.localeCompare(right.name) || left.type.localeCompare(right.type)
  ));

  if (
    actual.length !== expected.length
    || actual.some(({ name, type }, index) => (
      name !== expected[index].name || type !== expected[index].type
    ))
  ) {
    fail("The Text to Lattice API Worker must have exactly the HF_TOKEN and VISITOR_COOKIE_SECRET encrypted bindings.");
  }

  return Object.freeze({
    format: "TEXT_TO_LATTICE_SECRET_BINDING_EVIDENCE",
    schemaVersion: 1,
    worker: "hahdev-text-to-lattice-api",
    bindings: Object.freeze(expected.map(({ name, type }) => Object.freeze({ name, type }))),
    valuesRead: false,
  });
}

function cliArguments(argumentsList) {
  let inputPath = null;
  let outputPath = null;
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--output") {
      outputPath = argumentsList[index + 1] ?? null;
      index += 1;
    } else if (argument.startsWith("--")) {
      fail(`Unknown option ${argument}.`);
    } else if (inputPath === null) {
      inputPath = argument;
    } else {
      fail("Pass exactly one Wrangler secret-name inventory path.");
    }
  }
  if (!inputPath) fail("Pass the path to Wrangler's JSON secret-name inventory.");
  if (!outputPath) fail("Pass --output with a sanitized evidence path.");
  return { inputPath, outputPath };
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  const { inputPath, outputPath } = cliArguments(process.argv.slice(2));
  const inventory = JSON.parse(await readFile(resolve(inputPath), "utf8"));
  const evidence = verifyTextToLatticeSecretBindings(inventory);
  const resolvedOutput = resolve(outputPath);
  await mkdir(dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log("Text to Lattice encrypted binding names are complete and exact; values were not read.");
}
