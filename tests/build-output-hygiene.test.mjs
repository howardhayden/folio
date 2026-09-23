import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import { stripBootstrapSourceMapReference } from "../postcss.config.mjs";

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
  assert.match(exporter, /const output = resolve\(root, "site"\)/u);
  assert.match(exporter, /await rm\(output, \{ recursive: true, force: true \}\)/u);
  assert.match(exporter, /await cp\(clientAssets, output, \{ recursive: true \}\)/u);
});

test("the HTML-only Pages artifact uses native anchors for application navigation", async () => {
  const files = await sourceFiles(new URL("../app/", import.meta.url));
  const sources = await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")]));

  for (const [file, source] of sources) {
    assert.doesNotMatch(source, /["']next\/link["']/u, file.pathname);
  }

  const chrome = await readFile(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  const [resumeView, projects, heldProjects, resumeSearch] = await Promise.all([
    readFile(new URL("../app/resume/ResumeView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/resume/ResumeProjects.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/resume/ResumeProjectsHeld.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/resume/ResumeSearch.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(chrome, /<a className="navbar-brand" href="\/"/u);
  assert.match(chrome, /<a[\s\S]*?className="nav-link"[\s\S]*?href=\{route\.href\}/u);
  assert.match(resumeView, /from "\.\/ResumeProjectsHeld"/u);
  assert.doesNotMatch(resumeView, /from "\.\/ResumeProjects"/u);
  assert.match(resumeSearch, /from "\.\/ResumeProjectsHeld"/u);
  assert.doesNotMatch(resumeSearch, /from "\.\/ResumeProjects"/u);
  assert.match(
    projects,
    /"interaction" in project && project\.interaction === "lattice-demo"[\s\S]*?className="tool-icon project-modal-trigger signal-fuzz"[\s\S]*?data-lattice-launch="text-to-lattice"[\s\S]*?href="\/projects\/lattice\/text-to-lattice\/"[\s\S]*?aria-label="Use Text to Lattice"/u,
  );
  assert.match(
    heldProjects,
    /project\.id === "lattice"[\s\S]*?className="tool-icon project-modal-trigger signal-fuzz"[\s\S]*?href="\/projects\/lattice\/text-to-lattice\/"[\s\S]*?aria-label="Read Text to Lattice release status"/u,
  );
  assert.match(heldProjects, /const cardHref = linksToAuthoritativeSource \? project\.url : project\.canonicalPath/u);
  assert.match(heldProjects, /className="signal-fuzz"[\s\S]*?href=\{cardHref\}/u);
  assert.doesNotMatch(heldProjects, /aria-haspopup=|role="dialog"|data-lattice-launch=/u);
  assert.doesNotMatch(resumeSearch, /onLatticeLaunch|data-lattice-launch|requestRemoteLattice/u);
});

test("the held Resume client bundle excludes the interactive Lattice executable path", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../dist/client/.vite/manifest.json", import.meta.url),
    "utf8",
  ));
  const portfolioEntry = manifest["app/components/PortfolioShell.tsx"];
  assert.ok(portfolioEntry, "the production client manifest includes the portfolio entry");

  const reachable = new Set();
  const visit = (key) => {
    if (reachable.has(key)) return;
    const record = manifest[key];
    assert.ok(record, `${key} resolves in the production client manifest`);
    reachable.add(key);
    for (const dependency of [...(record.imports ?? []), ...(record.dynamicImports ?? [])]) {
      visit(dependency);
    }
  };
  visit("app/components/PortfolioShell.tsx");

  const names = [...reachable].map((key) => manifest[key].name);
  assert.ok(names.includes("ResumeProjectsHeld"));
  assert.ok(names.includes("ResumeSearch"));
  assert.equal(names.includes("ResumeProjects"), false);

  const sources = await Promise.all([...reachable].map((key) => (
    readFile(new URL(`../dist/client/${manifest[key].file}`, import.meta.url), "utf8")
  )));
  const client = sources.join("\n");
  for (const marker of [
    "requestRemoteLattice",
    "LatticeRemoteError",
    "capabilityFetch(",
    "data-lattice-launch",
    "lattice-demo-dialog",
  ]) assert.equal(client.includes(marker), false, `${marker} is absent from the held client graph`);
});

test("Pages CI verifies the remote privacy boundary before the held build", async () => {
  const workflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  const boundarySteps = [
    "tests/lattice-network-capability.test.mjs",
    "tests/lattice-network-governance.test.mjs",
    "tests/lattice-api-worker.test.mjs",
  ].map((marker) => workflow.indexOf(marker));
  const testStep = workflow.indexOf("npm test");
  assert.ok(boundarySteps.every((step) => step >= 0 && step < testStep));
  assert.doesNotMatch(workflow, /fetch-lattice-tokenizers|fetch-lattice-wasm/u);
});

test("the remote adapter consumes the public server-side sampling contract", async () => {
  const [adapter, { textToLatticeContract }] = await Promise.all([
    readFile(new URL("../workers/text-to-lattice-api/huggingFaceAdapter.js", import.meta.url), "utf8"),
    import("../app/content/textToLatticeContent.js"),
  ]);

  assert.deepEqual(textToLatticeContract.implementation.generator.inference.stages, {
    analysis: {
      temperature: 0.7,
      topP: 0.8,
      topK: 20,
      minP: 0,
      maximumOutputTokens: 3_072,
    },
    candidate: { temperature: 0.45, topP: 0.9, maximumOutputTokens: 800 },
    repair: { temperature: 0.45, topP: 0.9, maximumOutputTokens: 800 },
  });
  assert.deepEqual(textToLatticeContract.implementation.verifier.inference.stages, {
    verification: { temperature: 0, topP: 1, maximumOutputTokens: 1_200 },
    certification: { temperature: 0, topP: 1, maximumOutputTokens: 520 },
  });
  for (const [stage, maximumOutputTokens, temperature, topP] of [
    ["analysis", "3_072", "0.7", "0.8"],
    ["candidate", "800", "0.45", "0.9"],
    ["repair", "800", "0.45", "0.9"],
    ["verification", "1_200", "0", "1"],
    ["certification", "520", "0", "1"],
  ]) {
    assert.match(
      adapter,
      new RegExp(`${stage}:[\\s\\S]*?maxTokens: ${maximumOutputTokens},[\\s\\S]*?temperature: ${temperature},[\\s\\S]*?topP: ${topP},`, "u"),
    );
  }
  assert.match(adapter, /analysis:[\s\S]*?topK: 20,[\s\S]*?minP: 0,/u);
  assert.match(adapter, /model: LATTICE_REMOTE_MODELS\[role\]/u);
  assert.doesNotMatch(adapter, /CreateMLCEngine|latticeWebllm\.worker/u);
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

test("development CSS removes only Bootstrap's stale source-map reference", () => {
  const comments = [
    { text: "# sourceMappingURL=bootstrap.min.css.map", removed: false, remove() { this.removed = true; } },
    { text: "# sourceMappingURL=application.css.map", removed: false, remove() { this.removed = true; } },
    { text: "preserve this comment", removed: false, remove() { this.removed = true; } },
  ];
  const plugin = stripBootstrapSourceMapReference();
  plugin.Once({ walkComments(callback) { comments.forEach(callback); } });
  assert.deepEqual(comments.map(({ removed }) => removed), [true, false, false]);
});
