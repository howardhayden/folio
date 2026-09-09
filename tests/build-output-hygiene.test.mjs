import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.[cm]?[jt]sx?$/u.test(entry.name) ? [path] : [];
  }));
  return files.flat();
}

test("production builds clear only the resolved bundle directory before emitting assets", async () => {
  const [packageSource, cleaner, exporter] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/clean-build-output.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-pages.mjs", import.meta.url), "utf8"),
  ]);
  const packageJson = JSON.parse(packageSource);

  assert.match(packageJson.scripts.build, /^node scripts\/clean-build-output\.mjs && /u);
  assert.match(cleaner, /const output = resolve\(root, "dist"\)/u);
  assert.match(cleaner, /dirname\(output\) !== root \|\| output === root/u);
  assert.match(cleaner, /await rm\(output, \{ recursive: true, force: true \}\)/u);
  assert.match(exporter, /const clientAssets = resolve\(root, "dist\/client"\)/u);
  assert.match(exporter, /await cp\(clientAssets, output, \{ recursive: true \}\)/u);
});

test("the HTML-only Pages artifact uses native anchors for application navigation", async () => {
  const files = await sourceFiles(new URL("../app/", import.meta.url));
  const sources = await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")]));

  for (const [file, source] of sources) {
    assert.doesNotMatch(source, /["']next\/link["']/u, file.pathname);
  }

  const chrome = await readFile(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  const lattice = await readFile(new URL("../app/resume/ResumeProjects.tsx", import.meta.url), "utf8");
  assert.match(chrome, /<a className="navbar-brand" href="\/"/u);
  assert.match(chrome, /<a[\s\S]*?className="nav-link"[\s\S]*?href=\{route\.href\}/u);
  assert.match(lattice, /<a[\s\S]*?href="\/projects\/lattice\/text-to-lattice\/"[\s\S]*?aria-haspopup="dialog"/u);
});

test("Pages CI verifies pinned tokenizer fixtures before capacity tests", async () => {
  const [workflow, fetcher, contract] = await Promise.all([
    readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/fetch-lattice-tokenizers.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/resume/lattice/modelContract.js", import.meta.url), "utf8"),
  ]);
  const fetchStep = workflow.indexOf("node scripts/fetch-lattice-tokenizers.mjs");
  const testStep = workflow.indexOf("npm test");
  assert.ok(fetchStep >= 0 && testStep > fetchStep);
  assert.match(fetcher, /new URL\("tokenizer\.json", LATTICE_MODEL_ROLES\[role\]\.model\)/u);
  assert.match(fetcher, /createHash\("sha256"\)[\s\S]*?LATTICE_TOKENIZER_SHA256\[role\]/u);
  assert.match(contract, /LATTICE_TOKENIZER_SHA256/u);
});

test("the worker consumes the public generator sampling contract", async () => {
  const [worker, { LATTICE_MODEL_ROLES }] = await Promise.all([
    readFile(new URL("../app/resume/lattice/latticeWebllm.worker.ts", import.meta.url), "utf8"),
    import("../app/resume/lattice/modelContract.js"),
  ]);

  assert.deepEqual(LATTICE_MODEL_ROLES.generator.inference.stages, {
    analysis: { temperature: 0.1, topP: 0.9 },
    reanalysis: { temperature: 0.1, topP: 0.9 },
    candidate: { temperature: 0.45, topP: 0.9 },
  });
  assert.doesNotMatch(worker, /GENERATOR_INFERENCE_BY_SCHEMA/u);
  assert.match(worker, /LATTICE_MODEL_ROLES\.generator\.inference/u);
  assert.match(worker, /generatorInference\.stages\[schema/u);
});

test("the documented Bootstrap version matches the exact installed dependency", async () => {
  const [packageSource, lockSource, readme] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);
  const packageJson = JSON.parse(packageSource);
  const packageLock = JSON.parse(lockSource);
  const installedVersion = packageLock.packages["node_modules/bootstrap"].version;

  assert.equal(packageJson.dependencies.bootstrap, installedVersion);
  assert.equal(packageLock.packages[""].dependencies.bootstrap, installedVersion);
  assert.ok(readme.includes(`Bootstrap ${installedVersion} styling`));
});
