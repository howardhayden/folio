import assert from "node:assert/strict";
import test from "node:test";

import {
  preflightLatticeInput,
  validateLatticeInput,
} from "../app/resume/latticeDemo.js";
import {
  documentCertificationMessages,
} from "../app/resume/lattice/promptContract.js";
import {
  latticeLiteralSpansForPassage,
  reassembleLatticeSource,
} from "../app/resume/lattice/segments.js";
import {
  deterministicDocumentReview,
} from "../app/resume/lattice/validators.js";

function inertPayload(messages) {
  const content = messages.find(({ role }) => role === "user").content;
  const start = content.indexOf("<INERT_DATA>") + "<INERT_DATA>".length;
  const end = content.indexOf("</INERT_DATA>", start);
  return JSON.parse(content.slice(start, end));
}

function identityReassembly(source, passages) {
  return reassembleLatticeSource(
    source,
    passages,
    passages.filter(({ protected: exact }) => exact !== true)
      .map(({ id, text }) => ({ passageId: id, text })),
  );
}

test("localized isolate text can rewrite without allowing its structure or anchored scope to move", () => {
  const source = "before \u2067alpha remains\u2069 after";
  assert.equal(
    deterministicDocumentReview(source, "before \u2067alpha changes\u2069 after")
      .some(({ id }) => id.startsWith("document-bidi")),
    false,
  );
  assert.ok(deterministicDocumentReview("A \u2066B\u2069 C", "A B \u2066C\u2069")
    .some(({ id }) => id === "document-bidi-sequence"));
  assert.ok(deterministicDocumentReview(
    "\u2066alpha\u2069 \u2066beta\u2069",
    "\u2066beta\u2069 \u2066alpha\u2069",
  ).some(({ id }) => id === "document-bidi-sequence"));
  assert.ok(deterministicDocumentReview(
    "\u2066\u2067alpha\u2069\u2069",
    "\u2066alpha\u2069 \u2067delta\u2069",
  ).some(({ id }) => id === "document-bidi-sequence"));
  assert.ok(deterministicDocumentReview("\u2066alpha\u2069", "\u2066\u2069")
    .some(({ id }) => id === "document-bidi-sequence"));
  assert.ok(deterministicDocumentReview("x\u2066alpha\u2069", "\u2066xalpha\u2069")
    .some(({ id }) => id === "document-bidi-sequence"));
  assert.ok(deterministicDocumentReview(
    "Alpha \u2066x\u2069 first; Omega x second.",
    "Start x first; Omega \u2066x\u2069 second.",
  ).some(({ id }) => id === "document-bidi-sequence"));
});

test("exact literals remain assigned to their original isolate frame", () => {
  const source = "\u2066Visit https://a.invalid/x now. \u2069Outside remains.";
  const candidate = "\u2066Visit later. \u2069Outside keeps https://a.invalid/x now.";
  assert.ok(deterministicDocumentReview(source, candidate)
    .some(({ id }) => id === "deterministic-url-boundary"));
});

test("URL extraction preserves balanced internal isolates but stops at an adjacent direction frame", () => {
  const embedded = "before https://x.invalid/al\u2067pha\u2069 after";
  const embeddedPreflight = preflightLatticeInput(embedded);
  assert.equal(identityReassembly(embedded, embeddedPreflight.passages), embedded);
  assert.ok(embeddedPreflight.passages.flatMap((passage) => latticeLiteralSpansForPassage(passage))
    .some(({ literalType, text }) => literalType === "url" && text === "https://x.invalid/al\u2067pha\u2069"));
  assert.ok(deterministicDocumentReview(embedded, "earlier https://x.invalid/al\u2067beta\u2069 later")
    .some(({ id }) => id === "deterministic-url"));

  const url = `https://x.invalid/${"a".repeat(430)}`;
  const adjacentFrame = `Visit ${url}\u2067alpha remains\u2069 after.`;
  const adjacentPreflight = preflightLatticeInput(adjacentFrame);
  assert.equal(identityReassembly(adjacentFrame, adjacentPreflight.passages), adjacentFrame);
  assert.ok(adjacentPreflight.passages.flatMap((passage) => latticeLiteralSpansForPassage(passage))
    .some(({ literalType, text }) => literalType === "url" && text === url));
  assert.equal(deterministicDocumentReview(
    adjacentFrame,
    `Visit ${url}\u2067beta changes\u2069 later.`,
  ).some(({ id }) => id === "deterministic-url"), false);
});

test("an outer isolate closer and sentence punctuation are not absorbed into a URL", () => {
  const source = `\u2067${Array.from({ length: 50 }, (_, index) => `word${index}`).join(" ")} https://x.invalid/path\u2069.`;
  const preflight = preflightLatticeInput(source);
  assert.equal(identityReassembly(source, preflight.passages), source);
  assert.ok(preflight.passages.flatMap((passage) => latticeLiteralSpansForPassage(passage))
    .some(({ literalType, text }) => literalType === "url" && text === "https://x.invalid/path"));
});

test("one long nested isolate does not explode its short siblings into passages", () => {
  const framed = (value) => `\u2067${value}\u2069`;
  const source = `\u2066${[
    framed(Array.from({ length: 100 }, (_, index) => `long${index}`).join(" ")),
    ...Array.from({ length: 70 }, (_, index) => framed(`short${index}`)),
  ].join(" ")}\u2069`;
  assert.equal(validateLatticeInput(source).wordCount, 170);
  const preflight = preflightLatticeInput(source);
  assert.ok(preflight.passages.length <= 64);
  assert.ok(preflight.batches.length <= 32);
  assert.ok(preflight.passages.some(({ directionFrames }) => directionFrames?.join("/") === "LRI/RLI"));
  assert.ok(preflight.passages.some(({ text }) => /[\u2066-\u2069]/u.test(text)));
  assert.ok(preflight.passages.every(({ text }) => {
    let depth = 0;
    for (const control of text.match(/[\u2066-\u2069]/gu) ?? []) {
      depth += control === "\u2069" ? -1 : 1;
      if (depth < 0) return false;
    }
    return depth === 0;
  }));
  assert.equal(identityReassembly(source, preflight.passages), source);
});

test("the exact formatting-control ceiling remains bounded and lossless", () => {
  const siblings = Array.from({ length: 127 }, (_, index) => (
    `\u2067a${index} b${index} c${index} d${index} e${index}\u2069`
  )).join(" ");
  const source = `\u2066${siblings}\u2069`;
  assert.equal((source.match(/\p{Cf}/gu) ?? []).length, 256);
  const preflight = preflightLatticeInput(source);
  assert.equal(preflight.wordCount, 635);
  assert.ok(preflight.passages.length <= 64);
  assert.ok(preflight.batches.length <= 32);
  assert.equal(identityReassembly(source, preflight.passages), source);
});

test("oversized exact literals on both sides remain protected while prose remains processable", () => {
  const inlineCode = `\`${Array.from({ length: 280 }, (_, index) => `left${index}`).join(" ")}\``;
  const markup = `<x data="${Array.from({ length: 280 }, (_, index) => `right${index}`).join(" ")}">`;
  const source = `${inlineCode}\nCenter language needs revision.\n${markup}`;
  const preflight = preflightLatticeInput(source);
  assert.deepEqual(preflight.passages.map(({ protected: exact }) => exact === true), [true, false, true]);
  assert.deepEqual(preflight.batches.map(({ passages }) => passages.map(({ id }) => id)), [["p0002"]]);
  assert.equal(identityReassembly(source, preflight.passages), source);
});

test("relation, endpoint, evidence, window, and coverage prompt serializers are closed", () => {
  const mustNotCross = "must-not-cross";
  const atom = {
    id: "a1",
    passageId: "p1",
    kind: "actor",
    value: "actor",
    priority: "hard",
    preservation: "equivalent",
    ambiguity: false,
    evidence: [{
      passageId: "p1",
      startUtf16: 0,
      endUtf16: 5,
      text: "actor",
      semanticEvidence: mustNotCross,
    }],
    independentlyVerified: true,
    semanticEvidence: mustNotCross,
  };
  const relationPayload = inertPayload(documentCertificationMessages({
    scope: "relations",
    certificateId: "certificate:relations",
    obligationIds: ["e0001"],
    relations: [{
      id: "e0001",
      relation: "agent",
      sourceAtomId: "a1",
      targetAtomId: "a2",
      sourcePassageId: "p1",
      targetPassageId: "p2",
      sourceAtom: atom,
      targetAtom: { ...atom, id: "a2", passageId: "p2" },
      semanticEvidence: mustNotCross,
    }],
    endpointPassages: [{
      passageId: "p1",
      source: "actor",
      candidate: "the actor",
      separatorBefore: "",
      separatorAfter: "\n",
      semanticEvidence: mustNotCross,
    }],
  }));
  assert.doesNotMatch(JSON.stringify(relationPayload), /must-not-cross/u);
  assert.deepEqual(Object.keys(relationPayload.endpointPassages[0]).sort(), [
    "candidate", "passageId", "separatorAfter", "separatorBefore", "source",
  ]);
  assert.deepEqual(Object.keys(relationPayload.relations[0]).sort(), [
    "id", "relation", "sourceAtom", "sourceAtomId", "sourcePassageId",
    "targetAtom", "targetAtomId", "targetPassageId",
  ]);
  assert.deepEqual(Object.keys(relationPayload.relations[0].sourceAtom.evidence[0]).sort(), [
    "endUtf16", "passageId", "startUtf16", "text",
  ]);

  const windowPayload = inertPayload(documentCertificationMessages({
    scope: "window",
    certificateId: "certificate:window",
    obligationIds: ["passage:p1"],
    window: {
      id: "w001",
      index: 1,
      total: 1,
      passageId: "p1",
      semanticEvidence: mustNotCross,
    },
    source: "actor",
    candidate: "the actor",
    documentLedgerCoverage: {
      availableAtomCount: 1,
      includedAtomCount: 1,
      complete: true,
      selection: "linked-hard-relational-nearest",
      semanticEvidence: mustNotCross,
    },
  }));
  assert.doesNotMatch(JSON.stringify(windowPayload), /must-not-cross/u);
  assert.deepEqual(Object.keys(windowPayload.window).sort(), ["boundaryIds", "id", "index", "passageId", "total"]);
  assert.deepEqual(windowPayload.window.boundaryIds, []);
  assert.deepEqual(Object.keys(windowPayload.documentLedgerCoverage).sort(), [
    "availableAtomCount", "complete", "includedAtomCount", "selection",
  ]);
});
