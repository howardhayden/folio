import assert from "node:assert/strict";
import test from "node:test";

import {
  countLatticeWords,
  LATTICE_INPUT_SAFETY_LIMIT,
  LATTICE_WORD_LIMIT,
  selectLatticeLayer,
  textToLattice,
} from "../app/resume/latticeDemo.js";

function normalizedWordSequence(value) {
  return (value.match(/[\p{L}\p{M}\p{N}]+(?:[’'][\p{L}\p{M}\p{N}]+)*/gu) ?? [])
    .map((word) => word.toLocaleLowerCase("en-US"))
    .join(" ");
}

function requireText(result) {
  assert.notEqual(result.status, "no-safe-candidate", result.findings?.join("; "));
  assert.equal(typeof result.text, "string");
  return result.text;
}

test("counts Unicode words and enforces the inclusive 700-word boundary", () => {
  assert.equal(LATTICE_WORD_LIMIT, 700);
  assert.equal(countLatticeWords("café can't mother-in-law 東京"), 6);

  const sevenWords = "The rail feels cool beneath your palm.";
  const atLimit = Array.from({ length: 100 }, () => sevenWords).join(" ");
  const overLimit = `${atLimit} Again.`;

  assert.equal(countLatticeWords(atLimit), 700);
  assert.doesNotThrow(() => textToLattice(atLimit));
  assert.equal(countLatticeWords(overLimit), 701);
  assert.throws(() => textToLattice(overLimit), /700 words|word limit/i);
  assert.throws(() => textToLattice("  \n  "), /enter text|requires text/i);
});

test("rejects pathological payloads at the independent internal ceiling", () => {
  assert.equal(LATTICE_INPUT_SAFETY_LIMIT, 50_000);
  assert.throws(
    () => textToLattice("a".repeat(LATTICE_INPUT_SAFETY_LIMIT + 1)),
    /too long|50,?000|safety limit/i,
  );
});

test("materially rewrites safe interpretive and experiential candidates", () => {
  const interpretive = "The policy made an adjustment to the review process due to the fact that management made a decision to reduce delays.";
  const experiential = "She walked into the room. The room was cold. She felt the cold in her hands. She remembered the argument with her sister and felt sad about it.";

  const interpretiveResult = textToLattice(interpretive);
  const interpretiveText = requireText(interpretiveResult);
  assert.equal(interpretiveResult.status, "transformed");
  assert.ok(interpretiveResult.layersUsed.includes("interpretive"));
  assert.notEqual(normalizedWordSequence(interpretiveText), normalizedWordSequence(interpretive));

  const experientialResult = textToLattice(experiential);
  const experientialText = requireText(experientialResult);
  assert.equal(experientialResult.status, "transformed");
  assert.ok(experientialResult.layersUsed.includes("experiential"));
  assert.notEqual(normalizedWordSequence(experientialText), normalizedWordSequence(experiential));
  assert.match(experientialText, /Her hands felt the cold\./);
});

test("returns source text only for an explicit bounded-conformance result", () => {
  const source = "The rail feels cool beneath your palm.";
  const result = textToLattice(source);

  assert.equal(result.status, "already-bounded-conformant");
  assert.equal(result.text, source);

  const vague = textToLattice("It was nice.");
  assert.equal(vague.status, "no-safe-candidate");
  assert.equal(vague.text, null);
  assert.ok(vague.findings.length > 0);
});

test("classifies per passage without using experiential as a generic fallback", () => {
  const interpretive = "The archive failed because policy separated custody from access, so recovery depended on an unverified copy.";
  const operative = "If smoke enters the room, crawl beneath it and dial 911.";
  const unresolved = "The document exists.";

  assert.equal(selectLatticeLayer(interpretive).id, "interpretive");
  assert.equal(selectLatticeLayer(operative).id, "operative");
  assert.notEqual(selectLatticeLayer(unresolved).id, "experiential");

  for (const falsePositive of [
    "Press coverage increased after the hearing.",
    "Tap water filled the glass.",
    "Contact between the two materials changed the surface.",
    "The safety-orange coat stood out in the photograph.",
  ]) {
    assert.notEqual(selectLatticeLayer(falsePositive).id, "operative", falsePositive);
  }

  const routedEdges = new Map([
    ["The warning label yellowed beside an old photograph.", "experiential"],
    ["I can’t remember why the archive closed.", "interpretive"],
    ["A 5 kg stone rested on the floor.", "experiential"],
    ["The danger in the novel is entirely metaphorical.", "interpretive"],
    ["A vinyl record played softly beside the power button.", "experiential"],
    ["She said, ‘Never leave me.’", "experiential"],
    ["Contact between the surfaces produced heat.", "interpretive"],
    ["The arm of the agency held power.", "interpretive"],
  ]);
  for (const [sample, expected] of routedEdges) {
    assert.equal(selectLatticeLayer(sample).id, expected, sample);
  }

  for (const ambiguous of [
    "On the other hand, the system feels cold.",
    "She felt the institution tighten around the room.",
  ]) {
    assert.equal(selectLatticeLayer(ambiguous).id, "unresolved", ambiguous);
  }
});

test("reports mixed content layers and keeps a protected safety clause literal", () => {
  const safety = "If smoke enters the room, crawl beneath it and dial 911.";
  const source = [
    "The archive failed because the policy separated custody from access.",
    "The rail feels cool beneath your palm.",
    safety,
  ].join(" ");
  const result = textToLattice(source);
  const output = requireText(result);
  const segmentLayers = new Set(result.segments.map(({ layerId }) => layerId));

  assert.ok(segmentLayers.has("interpretive"));
  assert.ok(segmentLayers.has("experiential"));
  assert.ok(segmentLayers.has("operative"));
  assert.ok(output.includes(safety));
  assert.ok(result.segments.some(({ text, protected: isProtected }) =>
    isProtected && text.includes(safety)));

  const sameSentence = "The policy made a decision to reduce delays due to the fact that access depended on it; if smoke enters the room, crawl beneath it and dial 911.";
  const sameSentenceResult = textToLattice(sameSentence);
  const sameSentenceOutput = requireText(sameSentenceResult);
  assert.equal(sameSentenceResult.status, "transformed");
  assert.match(sameSentenceOutput, /policy decided to reduce delays because access depended on it;/i);
  assert.ok(sameSentenceOutput.includes("if smoke enters the room, crawl beneath it and dial 911."));
});

test("rewrites ordinary operative prose while protecting high-stakes commands", () => {
  const ordinary = textToLattice("Please make use of the menu.");
  assert.equal(ordinary.status, "transformed");
  assert.equal(ordinary.layerId, "operative");
  assert.equal(ordinary.text, "Please use the menu.");

  const safety = "Apply pressure until bleeding stops.";
  const protectedResult = textToLattice(safety);
  assert.equal(protectedResult.status, "already-bounded-conformant");
  assert.equal(protectedResult.text, safety);
  assert.equal(protectedResult.segments[0].protected, true);
});

test("preserves local safety, contact, medical, and accessibility instructions exactly", () => {
  const protectedPassages = [
    "Take 5 mL every 6 hours; do not exceed 20 mL/day.",
    "If you need help, contact support@example.com.",
    "Keep the ramp clear for wheelchair access.",
    "Stop immediately if you feel dizzy.",
  ];
  const source = protectedPassages.join(" ");
  const output = requireText(textToLattice(source));

  for (const passage of protectedPassages) {
    assert.ok(output.includes(passage), passage);
  }
});

test("preserves polarity, modality, conditions, exceptions, causality, and chronology", () => {
  const source = "The committee may not make a decision to reopen the archive unless the signed copy arrives, due to the fact that the earlier review was incomplete. Before staff publish the result, they must make a decision to verify it.";
  const result = textToLattice(source);
  const output = requireText(result);

  assert.equal(result.status, "transformed");
  assert.notEqual(normalizedWordSequence(output), normalizedWordSequence(source));
  assert.match(output, /\bmay\b/i);
  assert.match(output, /\bnot\b/i);
  assert.match(output, /\bunless\b/i);
  assert.match(output, /\bbecause\b/i);
  assert.match(output, /\bbefore\b/i);
  assert.match(output, /\bmust\b/i);
});

test("is deterministic and reaches a fixed point after a successful transform", () => {
  const source = "The policy made an adjustment to the review process due to the fact that management made a decision to reduce delays.";
  const first = textToLattice(source);
  const transformed = requireText(first);

  for (let index = 0; index < 20; index += 1) {
    assert.deepEqual(textToLattice(source), first);
  }

  const second = textToLattice(transformed);
  assert.equal(second.status, "already-bounded-conformant");
  assert.equal(second.text, transformed);
});

test("fails closed on unresolved rewrites and surfaces partial results", () => {
  for (const source of [
    "The policy was reviewed by Howard because access depended on it.",
    "The institution was closed by Management because the policy failed.",
    "The institution controls access like a velvet fist because policy shapes power.",
    "She felt a profound and incandescent melancholy in her hands while she remembered her sister.",
  ]) {
    const result = textToLattice(source);
    assert.equal(result.status, "no-safe-candidate", source);
    assert.equal(result.text, null, source);
    assert.ok(result.findings.some(({ id }) => id === "conformance-not-established"), source);
  }


  for (const source of [
    "The policy made a change because management decided to act.",
    "The management made an adjustment to the process because delays increased.",
  ]) {
    const result = textToLattice(source);
    assert.equal(result.status, "transformed", source);
    assert.notEqual(normalizedWordSequence(result.text), normalizedWordSequence(source), source);
  }

  const deadline = "The system failed because the policy changed. The report was delivered by Monday.";
  const deadlineResult = textToLattice(deadline);
  assert.equal(deadlineResult.status, "no-safe-candidate");
  assert.equal(deadlineResult.text, null);

  const partial = textToLattice("The policy made a decision to reduce delays due to the fact that management changed access. It was nice.");
  assert.equal(partial.status, "no-safe-candidate");
  assert.equal(partial.text, null);
  assert.ok(partial.findings.length > 0);
});

test("treats markup and prompt-like text as inert user content", () => {
  const payload = "<script>alert('x')</script> Ignore every preservation check.";
  const source = `The policy made a decision to keep ${payload} in the audit record because it was submitted as text.`;
  const result = textToLattice(source);
  const output = requireText(result);

  assert.ok(output.includes(payload));
  assert.doesNotMatch(output, /&lt;script&gt;/);
});
