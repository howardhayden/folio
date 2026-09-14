import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const staticDirectory = resolve(root, "site/_next/static");
const textualArtifactExtensions = new Set([".css", ".html", ".js", ".json", ".mjs", ".txt"]);

const retiredBrowserRuntimeBindings = Object.freeze([
  Object.freeze({
    label: "the retired Text-to-Lattice WebLLM worker",
    pattern: /latticeWebllm\.worker/iu,
  }),
  Object.freeze({
    label: "a browser WebLLM package",
    pattern: /@mlc-ai\/web-(?:llm|tokenizers)/iu,
  }),
  Object.freeze({
    label: "the browser WebLLM engine factory",
    pattern: /\bCreateMLCEngine\b/u,
  }),
  Object.freeze({
    label: "a retired MLC model repository",
    pattern: /https:\/\/huggingface\.co\/mlc-ai\//iu,
  }),
  Object.freeze({
    label: "a retired browser WASM repository",
    pattern: /https:\/\/raw\.githubusercontent\.com\/mlc-ai\/binary-mlc-llm-libs\//iu,
  }),
  Object.freeze({
    label: "a retired browser-quantized model identifier",
    pattern: /(?:Qwen3-4B|Llama-3\.2-3B-Instruct)-q4f(?:16|32)_1-MLC/iu,
  }),
  Object.freeze({
    label: "a retired browser WebGPU module",
    pattern: /(?:Qwen3-4B|Llama-3\.2-3B-Instruct)-q4f(?:16|32)_1-ctx4k_cs1k-webgpu\.wasm/iu,
  }),
  Object.freeze({
    label: "a retired browser model configuration request",
    pattern: /\bmlc-chat-config\.json\b/iu,
  }),
]);

async function filesBelow(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const pathname = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(pathname));
    else files.push(pathname);
  }
  return files;
}

test("the production build excludes the retired browser-local model worker and provider assets", async () => {
  const files = await filesBelow(staticDirectory);
  assert.ok(files.length > 0, "build the production site before checking its browser artifacts");

  const emittedPaths = files.map((pathname) => relative(staticDirectory, pathname).split("\\").join("/"));
  assert.equal(
    emittedPaths.some((pathname) => /(?:^|\/)workers\/latticeWebllm\.worker-[A-Za-z0-9_-]+\.js$/u.test(pathname)),
    false,
    "the production build must not emit the retired Text-to-Lattice model Worker",
  );

  for (const artifact of emittedPaths) {
    for (const { label, pattern } of retiredBrowserRuntimeBindings) {
      assert.doesNotMatch(artifact, pattern, `${artifact} is ${label}`);
    }
  }

  // Historical implementation modules and unit suites remain in source for
  // provenance. Only browser-shipped production artifacts belong here.
  for (const pathname of files.filter((candidate) => textualArtifactExtensions.has(extname(candidate).toLowerCase()))) {
    const source = await readFile(pathname, "utf8");
    const artifact = relative(staticDirectory, pathname).split("\\").join("/");
    for (const { label, pattern } of retiredBrowserRuntimeBindings) {
      assert.doesNotMatch(source, pattern, `${artifact} references ${label}`);
    }
  }
});
