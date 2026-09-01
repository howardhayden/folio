import assert from "node:assert/strict";
import test from "node:test";

import {
  countLatticeCharacters,
  latticeize,
  LATTICE_INPUT_LIMIT,
  selectLatticeLayer,
} from "../app/resume/latticeDemo.js";

function words(value) {
  return (value.match(/[\p{L}\p{M}\p{N}]+(?:[’'][\p{L}\p{M}\p{N}]+)*/gu) ?? [])
    .map((word) => word.toLocaleLowerCase("en-US"));
}

test("counts user-perceived characters and enforces the 250-character boundary", () => {
  assert.equal(countLatticeCharacters("👨‍👩‍👧‍👦👍🏽🇺🇳e\u0301"), 4);
  assert.equal(latticeize("a".repeat(LATTICE_INPUT_LIMIT)).text.length, LATTICE_INPUT_LIMIT);
  assert.throws(
    () => latticeize("a".repeat(LATTICE_INPUT_LIMIT + 1)),
    /cannot exceed 250 characters/,
  );
  assert.throws(() => latticeize("  \n  "), /Enter text/);
});

test("protected instructions remain literal and take precedence over style", () => {
  const medication = "Take 5 mL every 6 hours; do not exceed 20 mL/day.";
  const movement = "Let your shoulders soften; stop immediately if you feel dizzy.";

  for (const source of [medication, movement]) {
    const result = latticeize(source);
    assert.equal(result.layerId, "operative");
    assert.equal(result.conformance, "literal");
    assert.equal(result.text, source);
  }
});

test("ordinary hyphenated color language does not create a false safety match", () => {
  const source = "Her safety-orange coat stood out in the photograph.";
  assert.notEqual(selectLatticeLayer(source).id, "operative");
});

test("selects experiential and interpretive layers deterministically", () => {
  const experiential = "The rail feels cool beneath your palm, but the room has begun to warm.";
  const interpretive = "The archive failed because the policy separated custody from access; therefore, recovery depended on an unverified copy.";

  const experientialResult = latticeize(experiential);
  assert.equal(experientialResult.layerId, "experiential");
  assert.equal(experientialResult.text, "The rail feels cool beneath your palm. But the room has begun to warm.");

  const interpretiveResult = latticeize(interpretive);
  assert.equal(interpretiveResult.layerId, "interpretive");
  assert.equal(interpretiveResult.text, "The archive failed because the policy separated custody from access. Therefore, recovery depended on an unverified copy.");

  for (let index = 0; index < 100; index += 1) {
    assert.deepEqual(latticeize(interpretive), interpretiveResult);
  }
});

test("cadence shaping preserves word inventory, order, uncertainty, and negation", () => {
  const samples = [
    "The outage map may be outdated; current service is unknown.",
    "The policy does not prove intent, but it may change who can appeal.",
    "The floor feels stable, yet the rail may not hold under load.",
  ];

  for (const source of samples) {
    const result = latticeize(source);
    assert.deepEqual(words(result.text), words(source));
    for (const protectedWord of ["may", "not", "unknown"]) {
      if (words(source).includes(protectedWord)) {
        assert.ok(words(result.text).includes(protectedWord));
      }
    }
  }
});

test("untrusted markup remains inert text for React rendering", () => {
  const source = "Please open <script>alert('x')</script>, but keep the note.";
  const result = latticeize(source);
  assert.equal(result.layerId, "operative");
  assert.equal(result.text, source);
  assert.ok(result.text.includes("<script>"));
});
