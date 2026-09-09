import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  LATTICE_MODEL_ROLES,
  LATTICE_TOKENIZER_FILENAME,
  LATTICE_TOKENIZER_SHA256,
} from "../app/resume/lattice/modelContract.js";

const fixtures = Object.freeze([
  {
    role: "generator",
    destination: process.env.LATTICE_QWEN_TOKENIZER_JSON ?? "/tmp/qwen3-lattice-tokenizer.json",
  },
  {
    role: "verifier",
    destination: process.env.LATTICE_LLAMA_TOKENIZER_JSON ?? "/tmp/llama32-lattice-tokenizer.json",
  },
]);

async function fetchPinnedTokenizer(role) {
  const url = new URL(LATTICE_TOKENIZER_FILENAME, LATTICE_MODEL_ROLES[role].model);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Could not fetch the pinned ${role} tokenizer: ${lastError?.message ?? "request failed"}`);
}

for (const { role, destination } of fixtures) {
  const bytes = await fetchPinnedTokenizer(role);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== LATTICE_TOKENIZER_SHA256[role]) {
    throw new Error(`The pinned ${role} tokenizer digest did not match its contract.`);
  }
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.partial`;
  await writeFile(temporary, bytes, { mode: 0o600 });
  await rename(temporary, destination);
  console.log(`Verified ${role} tokenizer fixture at ${destination}.`);
}
