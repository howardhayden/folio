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

// Separate active reference fixture; historical MLC/tokenizer fixtures above
// retain their original identities and byte limit. Public mirror bytes match
// the author's LFS payload at revision 6f6073b423013f6a7d4d9f39144961bfbfbc386b.
// This does not identify Scaleway's managed tokenizer or chat template.
const activeVerifierFixture = Object.freeze({
  role: "verifier",
  destination: process.env.LATTICE_LLAMA33_REPOSITORY_TOKENIZER_JSON ?? "/tmp/llama33-lattice-tokenizer.json",
  url: "https://huggingface.co/unsloth/Llama-3.3-70B-Instruct/resolve/99cd0d2c829e92a67c844f9144c2509632e5c87f/tokenizer.json",
  expectedBytes: 17_209_920,
  expectedSha256: "6b9e4e7fb171f92fd137b777cc2714bf87d11576700a1dcd7a399e7bbe39537b",
  maximumBytes: 17_209_920,
});

const TOKENIZER_FETCH_TIMEOUT_MS = 30_000;
const TOKENIZER_FETCH_BYTE_LIMIT = 12_000_000;
const argumentsList = process.argv.slice(2);
if (argumentsList.some((value) => !["--verifier-only", "--active-verifier-only"].includes(value))
  || argumentsList.length > 1) {
  throw new Error("Usage: node scripts/fetch-lattice-tokenizers.mjs [--verifier-only | --active-verifier-only]");
}
const selectedFixtures = argumentsList.includes("--active-verifier-only")
  ? [activeVerifierFixture]
  : argumentsList.includes("--verifier-only")
    ? fixtures.filter(({ role }) => role === "verifier")
    : fixtures;

async function boundedResponseBytes(response, controller, maximumBytes) {
  const declaredLength = response.headers.get("Content-Length");
  if (declaredLength !== null
    && (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > maximumBytes)) {
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
    if (length > maximumBytes) {
      controller.abort();
      throw new Error("response exceeded the tokenizer fixture byte limit");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, length);
}

async function fetchPinnedTokenizer({ role, url: explicitUrl, maximumBytes = TOKENIZER_FETCH_BYTE_LIMIT }) {
  const url = explicitUrl ?? new URL(LATTICE_TOKENIZER_FILENAME, LATTICE_MODEL_ROLES[role].model);
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
      return await boundedResponseBytes(response, controller, maximumBytes);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Could not fetch the pinned ${role} tokenizer: ${lastError?.message ?? "request failed"}`);
}

for (const fixture of selectedFixtures) {
  const { role, destination, expectedBytes, expectedSha256 = LATTICE_TOKENIZER_SHA256[role] } = fixture;
  const bytes = await fetchPinnedTokenizer(fixture);
  if (expectedBytes !== undefined && bytes.byteLength !== expectedBytes) {
    throw new Error(`The pinned ${role} tokenizer byte length did not match its contract.`);
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== expectedSha256) {
    throw new Error(`The pinned ${role} tokenizer digest did not match its contract.`);
  }
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.partial`;
  await writeFile(temporary, bytes, { mode: 0o600 });
  await rename(temporary, destination);
  console.log(`Verified ${role} tokenizer fixture at ${destination}.`);
}
