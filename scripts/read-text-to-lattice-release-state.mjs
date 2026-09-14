import { appendFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  verifyQualifiedSourceSet,
  verifyReleaseStatusState,
} from "./verify-text-to-lattice-release.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registerPath = resolve(
  root,
  "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json",
);

const register = JSON.parse(await readFile(registerPath, "utf8"));
const publicClientStatus = register?.publicClient?.status;
const { releasePhase } = verifyReleaseStatusState(register);
const qualifiedSourceSetSha256 = await verifyQualifiedSourceSet(register);

if (!new Set(["held", "enabled"]).has(publicClientStatus)) {
  throw new Error("Text to Lattice public-client status must be held or enabled.");
}

const outputPath = process.env.GITHUB_OUTPUT;
if (outputPath) {
  await appendFile(outputPath, [
    `public_client_status=${publicClientStatus}`,
    `release_phase=${releasePhase}`,
    `qualified_source_set_sha256=${qualifiedSourceSetSha256}`,
    "",
  ].join("\n"), "utf8");
}

console.log(`Text to Lattice release phase: ${releasePhase}; public-client status: ${publicClientStatus}`);
