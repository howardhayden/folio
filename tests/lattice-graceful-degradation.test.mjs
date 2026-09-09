import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { textToLatticeContract } from "../app/content/siteContent.js";
import { knowledgeGraph } from "../app/semantic/portfolio.js";

const staticFile = (path) => new URL(`../site/${path}`, import.meta.url);

test("Text to Lattice exposes a no-JavaScript and unavailable-runtime fallback", async () => {
  const [resumeHtml, toolHtml, interfaceSource] = await Promise.all([
    readFile(staticFile("resume/index.html"), "utf8"),
    readFile(staticFile("projects/lattice/text-to-lattice/index.html"), "utf8"),
    readFile(new URL("../app/resume/ResumeProjects.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(resumeHtml, /<noscript><p class="lattice-noscript-note">/u);
  assert.match(resumeHtml, /href="\/projects\/lattice\/text-to-lattice\/">Read the tool details<\/a>/u);
  assert.match(interfaceSource, /latticeSupported === false \? \([\s\S]*?aria-label="Availability"/u);
  assert.match(interfaceSource, /disabled=\{busy \|\| latticeSupported === false\}/u);
  assert.match(interfaceSource, /latticeFailureMessage\(error\)/u);
  assert.match(interfaceSource, /navigator\.onLine === false/u);
  assert.match(interfaceSource, /!latticeInputInvalid \? <> <a href="\/projects\/lattice\/text-to-lattice\/#text-to-lattice-availability">Tool details<\/a>\.<\/> : null/u);
  assert.match(toolHtml, /data-tool-availability="progressive-enhancement"/u);
  assert.match(toolHtml, /Without JavaScript/u);
  assert.match(toolHtml, /Without secure-context WebGPU support/u);
  assert.match(toolHtml, /Without access to uncached pinned model assets/u);
  assert.match(toolHtml, /href="\/projects\.json"/u);
  assert.match(toolHtml, /href="\/knowledge-graph\.jsonld"/u);
});

test("fallback availability is part of the public semantic tool contract", async () => {
  const fallbackConstraints = textToLatticeContract.constraints.filter((constraint) => (
    constraint.includes("network access") || constraint.includes("remain readable without JavaScript")
  ));
  assert.equal(fallbackConstraints.length, 2);

  const applicationId = "https://hah.dev/projects/lattice/text-to-lattice/#application";
  const application = knowledgeGraph["@graph"].find((node) => node["@id"] === applicationId);
  assert.ok(application);
  for (const constraint of fallbackConstraints) {
    assert.ok(application["hah:constraint"].includes(constraint));
  }

  const [projectMarkdown, completeText] = await Promise.all([
    readFile(staticFile("content/projects/lattice.md"), "utf8"),
    readFile(staticFile("llms-full.txt"), "utf8"),
  ]);
  for (const constraint of fallbackConstraints) {
    assert.ok(projectMarkdown.includes(constraint));
    assert.ok(completeText.includes(constraint));
  }
});
