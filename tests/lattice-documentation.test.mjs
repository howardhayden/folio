import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { projectDocuments } from "../app/content/projectDocuments.js";

const rootUrl = new URL("../", import.meta.url);
const publicRoot = new URL("../public/documentation/text-to-lattice/", import.meta.url);
const sourceRoot = new URL("../docs/text-to-lattice/", import.meta.url);
const siteRoot = new URL("../site/documentation/text-to-lattice/", import.meta.url);
const readBytes = (base, path) => readFile(new URL(path, base));
const readText = async (base, path) => (await readBytes(base, path)).toString("utf8");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const occurrences = (value, expression) => [...value.matchAll(expression)].length;

const [atlas, manifest] = await Promise.all([
  readText(sourceRoot, "LATTICE-DOCUMENTATION-ATLAS.json").then(JSON.parse),
  readText(publicRoot, "artifact-manifest.json").then(JSON.parse),
]);

test("Lattice documentation has one registered authority and byte-identical Markdown exports", async () => {
  assert.equal(atlas.format, "TEXT_TO_LATTICE_DOCUMENTATION_ATLAS");
  assert.equal(manifest.format, "TEXT_TO_LATTICE_DOCUMENTATION_ARTIFACT_MANIFEST");
  assert.equal(atlas.revision, manifest.revision);
  assert.equal(atlas.artifacts.length, 4);
  assert.equal(manifest.artifactPairs.length, 4);
  assert.ok(
    atlas.conceptMap.edges.some(({ source, target }) => source === "LAT-N-000" && target === "LAT-N-002"),
    "the Lattice engine is connected to its typed-contract pipeline",
  );
  assert.ok(
    atlas.conceptMap.edges.some(({ source, target, label }) => (
      source === "LAT-N-021"
      && target === "LAT-N-000"
      && /without embedding the engine/iu.test(label)
    )),
    "the Text to Lattice relationship names its non-embedding boundary",
  );

  assert.deepEqual(
    projectDocuments.map(({ artifactId, title, scope, htmlUrl, markdownUrl }) => ({
      artifactId,
      title,
      scope,
      html: htmlUrl.split("/").at(-1),
      markdown: markdownUrl.split("/").at(-1),
    })),
    atlas.artifacts.map(({ id: artifactId, title, scope, html, markdown }) => ({
      artifactId, title, scope, html, markdown,
    })),
  );

  for (const pair of manifest.artifactPairs) {
    const [source, published] = await Promise.all([
      readBytes(rootUrl, pair.sourcePath),
      readBytes(rootUrl, pair.publicPath),
    ]);
    assert.deepEqual(published, source, `${pair.artifactId} public Markdown matches its source edition`);
    assert.equal(digest(source), pair.sha256, `${pair.artifactId} matches the artifact manifest`);
  }

  const [canonical, publicCanonical, builder] = await Promise.all([
    readBytes(rootUrl, manifest.authority.canonicalSource),
    readBytes(publicRoot, "documentation-atlas.json"),
    readBytes(rootUrl, manifest.authority.builder),
  ]);
  assert.deepEqual(publicCanonical, canonical);
  assert.equal(digest(canonical), manifest.authority.canonicalSourceSha256);
  assert.equal(digest(builder), manifest.authority.builderSha256);
});

test("interactive editions remain complete, local, accessible, and executable-free without JavaScript", async () => {
  const pages = [
    { filename: "index.html", markdown: null, ids: [] },
    { filename: atlas.artifacts[0].html, markdown: atlas.artifacts[0].markdown, ids: atlas.conceptMap.nodes.map(({ id }) => id) },
    { filename: atlas.artifacts[1].html, markdown: atlas.artifacts[1].markdown, ids: atlas.skillMap.capabilities.map(({ id }) => id) },
    {
      filename: atlas.artifacts[2].html,
      markdown: atlas.artifacts[2].markdown,
      ids: [
        ...atlas.serviceBlueprint.stages.map(({ id }) => id),
        ...atlas.serviceBlueprint.lifecycleOwners.map(({ id }) => id),
      ],
    },
    {
      filename: atlas.artifacts[3].html,
      markdown: atlas.artifacts[3].markdown,
      ids: [
        ...atlas.securityModel.threats.map(({ id }) => id),
        ...atlas.securityModel.prePublicationGates.map(({ id }) => id),
      ],
    },
  ];

  for (const { filename, markdown, ids } of pages) {
    const html = await readText(publicRoot, filename);
    assert.match(html, /^<!doctype html>\n<html lang="en">/u);
    assert.equal(occurrences(html, /<main\b/gu), 1, `${filename} has one main landmark`);
    assert.equal(occurrences(html, /<h1\b/gu), 1, `${filename} has one first-level heading`);
    assert.equal(occurrences(html, /rel="canonical"/gu), 1, `${filename} has one canonical URL`);
    assert.match(html, /<a class="skip-link" href="#main">/u);
    assert.match(html, /min-height: 44px/u);
    assert.match(html, /:focus-visible/u);
    assert.match(html, /prefers-reduced-motion/u);
    assert.match(html, /forced-colors/u);
    assert.match(html, /@media print/u);
    assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/iu);
    assert.doesNotMatch(html, /<link\b[^>]*rel="stylesheet"/iu);
    assert.doesNotMatch(html, /<(?:img|iframe|audio|video|source)\b[^>]*\bsrc="https?:/iu);
    assert.doesNotMatch(
      html,
      /@import|\.innerHTML|\bfetch\s*\(|\bXMLHttpRequest\b|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|\bWebSocket\b|\bEventSource\b|\bWebTransport\b/gu,
    );
    for (const id of ids) assert.ok(html.includes(id), `${filename} pre-renders ${id}`);

    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gu)].map((match) => match[1]);
    if (!markdown) {
      assert.equal(scripts.length, 0, "the index needs no script");
      assert.equal(occurrences(html, /rel="alternate" type="text\/markdown"/gu), 0);
      continue;
    }

    assert.equal(scripts.length, 1, `${filename} has one inline progressive enhancement`);
    assert.doesNotThrow(() => new vm.Script(scripts[0], { filename }));
    assert.equal(occurrences(html, /rel="alternate" type="text\/markdown"/gu), 1);
    assert.ok(html.includes(`href="https://hah.dev/documentation/text-to-lattice/${markdown}"`));
    for (const marker of [
      "data-interactive-register",
      "data-doc-search",
      "data-filter-key",
      "<details",
      'role="status"',
      'aria-live="polite"',
      "new Blob",
      "textContent",
      "document.createElement",
      "URL.revokeObjectURL",
      "non-authoritative view",
    ]) assert.ok(html.includes(marker), `${filename} includes ${marker}`);
  }

  const index = await readText(publicRoot, "index.html");
  for (const { html, markdown } of atlas.artifacts) {
    assert.ok(index.includes(`href="${html}"`));
    assert.ok(index.includes(`href="${markdown}"`));
  }
});

test("the static site preserves every exported documentation byte", async () => {
  const filenames = (await readdir(publicRoot)).sort();
  assert.equal(filenames.length, 11);
  for (const filename of filenames) {
    const [published, staged] = await Promise.all([
      readBytes(publicRoot, filename),
      readBytes(siteRoot, filename),
    ]);
    assert.deepEqual(staged, published, `${filename} survives the public-to-site copy unchanged`);
  }
});
