import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");

if (dirname(output) !== root || output === root) {
  throw new Error("Refusing to clean an unresolved build-output path.");
}

await rm(output, { recursive: true, force: true });
