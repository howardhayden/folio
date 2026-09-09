import assert from "node:assert/strict";
import test from "node:test";

import {
  analysisMessages,
  verificationMessages,
} from "../app/resume/lattice/promptContract.js";
import {
  deterministicDocumentReview,
  deterministicPassageReview,
} from "../app/resume/lattice/validators.js";

const opaque = (index, prefix = "t") => `${prefix}${index.toString(36).padStart(4, "0")}`;
const opaqueRun = (count, prefix = "t") => Array.from({ length: count }, (_, index) => opaque(index, prefix));

function sourcePassage(text) {
  return { id: "p001", text, wordCount: text.split(/\s+/u).length };
}

function semanticPlan(text, atoms) {
  return {
    passageId: "p001",
    layer: "interpretive",
    disposition: "rewrite",
    atoms: atoms.map((atom, index) => ({
      id: `a${index.toString(36).padStart(3, "0")}`,
      priority: "hard",
      preservation: "equivalent",
      evidence: [{ passageId: "p001", startUtf16: 0, endUtf16: text.length, text }],
      links: [],
      ...atom,
    })),
  };
}

function candidate(text, plan) {
  return {
    passageId: "p001",
    layer: plan.layer,
    text,
    preservedAtomIds: plan.atoms.map(({ id }) => id),
  };
}

test("generated lexical distributions are advisory rather than deterministic semantic failures", () => {
  const operators = ["cannot", "may", "must", "unless", "because", "before", "after", "only"];
  for (const [index, operator] of operators.entries()) {
    const identifiers = [`ZX${index}`, `QY${index}`];
    const sourceTokens = [identifiers[0], operator, identifiers[1], identifiers[0], ...opaqueRun(18, `s${index}`)];
    const candidateTokens = [identifiers[0], identifiers[0], identifiers[1], ...opaqueRun(18, `c${index}`)];
    const source = sourceTokens.join(" ");
    const rewritten = candidateTokens.join(" ");
    const plan = semanticPlan(source, [
      { kind: "actor", value: opaque(index, "r") },
      { kind: "modality", value: opaque(index, "m") },
    ]);
    const passageFindings = deterministicPassageReview(sourcePassage(source), plan, candidate(rewritten, plan));
    const documentFindings = deterministicDocumentReview(source, rewritten);
    assert.equal(passageFindings.some(({ id }) => id === "deterministic-entity"), false);
    assert.equal(passageFindings.some(({ id }) => id.startsWith("deterministic-")), false);
    assert.equal(documentFindings.some(({ id }) => id === "deterministic-entity"), false);
    assert.equal(documentFindings.some(({ id }) => /deterministic-(?:negation|can|could|may|might|must|should|would|uncertainty|condition|exception|cause|before|after|until|only)/u.test(id)), false);
  }
});

test("generated exact atoms remain binding without lexical entity heuristics", () => {
  for (let index = 0; index < 16; index += 1) {
    const identifier = `ZX${index.toString(36).padStart(3, "0")}`;
    const replacement = `QY${index.toString(36).padStart(3, "0")}`;
    const source = [identifier, ...opaqueRun(18, `s${index}`)].join(" ");
    const rewritten = [replacement, ...opaqueRun(18, `c${index}`)].join(" ");
    const plan = semanticPlan(source, [{
      kind: "actor",
      value: identifier,
      preservation: "exact",
      evidence: [{ passageId: "p001", startUtf16: 0, endUtf16: identifier.length, text: identifier }],
    }]);
    const findings = deterministicPassageReview(sourcePassage(source), plan, candidate(rewritten, plan));
    assert.ok(findings.some(({ id, atomIds }) => id === "candidate-exact-atom" && atomIds.includes("a000")));
    assert.equal(findings.some(({ id }) => id === "deterministic-entity"), false);
  }
});

test("generated role permutations are assigned to relational atomization and independent verification", () => {
  for (let index = 0; index < 16; index += 1) {
    const left = `ZX${index.toString(36).padStart(3, "0")}`;
    const right = `QY${index.toString(36).padStart(3, "0")}`;
    const source = [left, right, ...opaqueRun(18, `s${index}`)].join(" ");
    const rewritten = [right, left, ...opaqueRun(18, `c${index}`)].join(" ");
    const plan = semanticPlan(source, [
      { kind: "actor", value: left, links: [{ relation: "agent", targetAtomId: "a001" }] },
      { kind: "object", value: right, links: [{ relation: "patient", targetAtomId: "a000" }] },
    ]);
    const findings = deterministicPassageReview(sourcePassage(source), plan, candidate(rewritten, plan));
    assert.equal(findings.some(({ id }) => id === "deterministic-entity"), false);
  }

  const request = {
    batch: { id: "b001", passages: [{ id: "p001", text: opaqueRun(20).join(" ") }] },
    context: null,
    documentLedger: [],
    documentLedgerCoverage: {
      availableAtomCount: 0,
      includedAtomCount: 0,
      complete: true,
      selection: "linked-hard-relational-nearest",
    },
    analysis: { passages: [] },
    candidate: { passages: [] },
    deterministicFindings: [],
  };
  const analysisContract = analysisMessages(request).map(({ content }) => content).join("\n");
  const verificationContract = verificationMessages(request).map(({ content }) => content).join("\n");
  assert.match(analysisContract, /proper names? (?:is|are) hard identity atoms? preserved equivalently by default/iu);
  assert.match(analysisContract, /Exact atoms cite only literal spans/iu);
  assert.match(analysisContract, /Atomize each distinct explicit commitment, identity, role, coreference/iu);
  assert.match(analysisContract, /Add typed links only for relations the source supports; independent atoms need no invented link/iu);
  assert.match(verificationContract, /Verify relations, not word overlap/iu);
  assert.match(verificationContract, /Check identity, roles, coreference, attribution, order, cause/iu);
});
