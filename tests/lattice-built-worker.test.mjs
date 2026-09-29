import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, relative, resolve } from "node:path";
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
    // rsync's partial-transfer directory is transient, not a built artifact.
    if (entry.isDirectory() && entry.name === ".rsync-tmp") continue;
    const pathname = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(pathname));
    else files.push(pathname);
  }
  return files;
}

test("artifact scanning excludes only rsync partial-transfer directories at any depth", async (context) => {
  const fixtureDirectory = await mkdtemp(join(tmpdir(), "lattice-built-worker-"));
  context.after(() => rm(fixtureDirectory, { recursive: true, force: true }));

  const normalDirectory = join(fixtureDirectory, "normal", "deep");
  const rootPartialDirectory = join(fixtureDirectory, ".rsync-tmp");
  const nestedPartialDirectory = join(fixtureDirectory, "normal", ".rsync-tmp");
  const similarDirectory = join(fixtureDirectory, ".rsync-tmp-kept");
  await Promise.all([
    mkdir(normalDirectory, { recursive: true }),
    mkdir(rootPartialDirectory, { recursive: true }),
    mkdir(nestedPartialDirectory, { recursive: true }),
    mkdir(similarDirectory, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(normalDirectory, "visible.js"), "normal"),
    writeFile(join(rootPartialDirectory, "ignored.js"), "partial"),
    writeFile(join(nestedPartialDirectory, "ignored.js"), "partial"),
    writeFile(join(similarDirectory, "visible.js"), "similar"),
  ]);

  const observed = (await filesBelow(fixtureDirectory))
    .map((pathname) => relative(fixtureDirectory, pathname).split("\\").join("/"))
    .sort();
  assert.deepEqual(observed, [".rsync-tmp-kept/visible.js", "normal/deep/visible.js"]);
});

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
