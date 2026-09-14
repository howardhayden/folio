import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { textToLatticeContract } from "../app/content/textToLatticeContent.js";
import { knowledgeGraph, namespaceGraphId } from "../app/semantic/portfolio.js";

const resumeSource = await readFile(new URL("../app/resume/ResumeProjects.tsx", import.meta.url), "utf8");
const toolPageSource = await readFile(new URL("../app/projects/lattice/text-to-lattice/page.tsx", import.meta.url), "utf8");

test("Text to Lattice keeps a useful no-JavaScript and remote-service fallback", () => {
  assert.match(
    resumeSource,
    /href="\/projects\/lattice\/text-to-lattice\/"[\s\S]*?aria-label="Use Text to Lattice"/u,
  );
  assert.match(
    resumeSource,
    /<noscript>[\s\S]*?Text to Lattice is unavailable here[\s\S]*?Read the tool details[\s\S]*?<\/noscript>/u,
  );

  assert.match(toolPageSource, /data-tool-availability="progressive-enhancement"/u);
  assert.match(toolPageSource, /Without JavaScript/u);
  assert.match(toolPageSource, /secure same-origin capability/u);
  assert.match(toolPageSource, /Provider unavailability, timeout, rate limit, or malformed output terminates explicitly/u);
  assert.match(toolPageSource, /no automatic retry or fallback presents the source as transformed text/u);
  assert.match(toolPageSource, /complete public contract remains on this page/u);
});

test("fallback and explicit external submission are part of the semantic tool contract", () => {
  const fallbackConstraint = textToLatticeContract.constraints.find((constraint) => (
    constraint.includes("remain readable without JavaScript or conversion availability")
  ));
  const submissionConstraint = textToLatticeContract.constraints.find((constraint) => (
    constraint.includes("one same-origin POST to /api/lattice")
  ));
  assert.ok(fallbackConstraint);
  assert.ok(submissionConstraint);

  const applicationId = "https://hah.dev/projects/lattice/text-to-lattice/#application";
  const application = knowledgeGraph["@graph"].find((node) => node["@id"] === applicationId);
  assert.ok(application);
  const semanticConstraints = application[namespaceGraphId("constraint")];
  assert.ok(semanticConstraints.includes(fallbackConstraint));
  assert.ok(semanticConstraints.includes(submissionConstraint));

  assert.ok(textToLatticeContract.securityAndPrivacy.api.rules.some((rule) => (
    rule.includes("modal opening, dismissal, and cancellation before submission cause no transformation request")
  )));
  assert.ok(textToLatticeContract.securityAndPrivacy.api.rules.some((rule) => (
    rule.includes("browser does not retry automatically")
  )));
});
