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
    expectedBytes: 9_085_657,
  },
]);

const TOKENIZER_FETCH_TIMEOUT_MS = 30_000;
const TOKENIZER_FETCH_BYTE_LIMIT = 12_000_000;
const argumentsList = process.argv.slice(2);
if (argumentsList.some((value) => value !== "--verifier-only")
  || new Set(argumentsList).size !== argumentsList.length) {
  throw new Error("Usage: node scripts/fetch-lattice-tokenizers.mjs [--verifier-only]");
}
const selectedFixtures = argumentsList.includes("--verifier-only")
  ? fixtures.filter(({ role }) => role === "verifier")
  : fixtures;

async function boundedResponseBytes(response, controller) {
  const declaredLength = response.headers.get("Content-Length");
  if (declaredLength !== null
    && (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > TOKENIZER_FETCH_BYTE_LIMIT)) {
    controller.abort();
    throw new Error("response exceeded the tokenizer fixture byte limit");
  }
  if (response.body === null) throw new Error("response had no body");
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > TOKENIZER_FETCH_BYTE_LIMIT) {
      controller.abort();
      throw new Error("response exceeded the tokenizer fixture byte limit");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, length);
}

async function fetchPinnedTokenizer(role) {
  const url = new URL(LATTICE_TOKENIZER_FILENAME, LATTICE_MODEL_ROLES[role].model);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TOKENIZER_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        credentials: "omit",
        redirect: "follow",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await boundedResponseBytes(response, controller);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Could not fetch the pinned ${role} tokenizer: ${lastError?.message ?? "request failed"}`);
}

for (const { role, destination, expectedBytes } of selectedFixtures) {
  const bytes = await fetchPinnedTokenizer(role);
  if (expectedBytes !== undefined && bytes.byteLength !== expectedBytes) {
    throw new Error(`The pinned ${role} tokenizer byte length did not match its contract.`);
  }
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
