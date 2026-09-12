import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { LATTICE_COMPATIBILITY_WASM, LATTICE_MODEL_ROLES } from "../app/resume/lattice/modelContract.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const register = JSON.parse(await readFile(
  resolve(root, "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json"),
  "utf8",
));
const destinations = Object.freeze({
  generator: process.env.LATTICE_QWEN_WASM ?? "/tmp/qwen3-lattice-model-lib.wasm",
  verifier: process.env.LATTICE_LLAMA_WASM ?? "/tmp/llama32-lattice-model-lib.wasm",
  compatibilityGenerator: process.env.LATTICE_QWEN_COMPATIBILITY_WASM ?? "/tmp/qwen3-lattice-compatibility-model-lib.wasm",
  compatibilityVerifier: process.env.LATTICE_LLAMA_COMPATIBILITY_WASM ?? "/tmp/llama32-lattice-compatibility-model-lib.wasm",
});

const modelLibraries = Object.freeze({
  generator: LATTICE_MODEL_ROLES.generator.modelLib,
  verifier: LATTICE_MODEL_ROLES.verifier.modelLib,
  compatibilityGenerator: LATTICE_COMPATIBILITY_WASM.generator.modelLib,
  compatibilityVerifier: LATTICE_COMPATIBILITY_WASM.verifier.modelLib,
});

async function fetchPinnedWasm(role) {
  const record = register.artifactSet.wasm.files[role];
  const url = new URL(modelLibraries[role]);
  if (!url.pathname.endsWith(`/${record.name}`)) throw new Error(`${role} WASM filename drifted from the release register.`);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        credentials: "omit",
        redirect: "follow",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength !== record.bytes) throw new Error(`expected ${record.bytes} bytes, received ${bytes.byteLength}`);
      const digest = createHash("sha256").update(bytes).digest("hex");
      if (digest !== record.sha256) throw new Error(`expected SHA-256 ${record.sha256}, received ${digest}`);
      const gitBlob = createHash("sha1")
        .update(`blob ${bytes.byteLength}\0`)
        .update(bytes)
        .digest("hex");
      if (gitBlob !== record.gitBlob) throw new Error(`expected Git blob ${record.gitBlob}, received ${gitBlob}`);
      return bytes;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Could not verify the pinned ${role} WASM: ${lastError?.message ?? "request failed"}`);
}

for (const role of ["generator", "verifier", "compatibilityGenerator", "compatibilityVerifier"]) {
  const bytes = await fetchPinnedWasm(role);
  const destination = destinations[role];
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.partial`;
  await writeFile(temporary, bytes, { mode: 0o600 });
  await rename(temporary, destination);
  process.stdout.write(`Verified ${role} WASM at ${destination}.\n`);
}

process.stdout.write("Identity verification does not establish source reproducibility or artifact licensing.\n");
