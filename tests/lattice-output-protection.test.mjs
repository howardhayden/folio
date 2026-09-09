import assert from "node:assert/strict";
import test from "node:test";

import {
  isLatticeClarificationTarget,
  mayRevealLatticeOutput,
} from "../app/resume/lattice/outputProtection.js";
import { isLatticeRetryPending, latticeRetryEta } from "../app/resume/lattice/retryEta.js";

test("output stays shielded across hidden, unfocused, printing, and capture-deadline states", () => {
  const visibleFocused = {
    documentHidden: false,
    windowFocused: true,
    printing: false,
    now: 10_000,
    shieldUntil: 9_999,
  };

  assert.equal(mayRevealLatticeOutput(visibleFocused), true);
  assert.equal(mayRevealLatticeOutput({ ...visibleFocused, documentHidden: true }), false);
  assert.equal(mayRevealLatticeOutput({ ...visibleFocused, windowFocused: false }), false);
  assert.equal(mayRevealLatticeOutput({ ...visibleFocused, printing: true }), false);
  assert.equal(mayRevealLatticeOutput({ ...visibleFocused, shieldUntil: 10_001 }), false);
  assert.equal(mayRevealLatticeOutput({ ...visibleFocused, now: 10_001, shieldUntil: 10_001 }), true);
});

test("the visual veil identifies the result without assigning a review state", async () => {
  const css = await import("node:fs/promises").then(({ readFile }) => (
    readFile(new URL("../app/globals.css", import.meta.url), "utf8")
  ));
  assert.match(css, /content: "HAH\.DEV  TEXT TO LATTICE  RESULT/u);
  assert.doesNotMatch(css, /TEXT TO LATTICE  REVIEW/u);
});

test("only the editable clarification input bypasses output transfer blocking", () => {
  const clarification = { closest: () => null, nodeType: 1 };
  const clarificationInput = { closest: (selector) => selector === ".lattice-clarification-input" ? clarificationInput : null, nodeType: 1 };
  const result = { closest: () => null, nodeType: 1 };
  const clarificationText = { nodeType: 3, parentElement: clarification };
  const clarificationInputText = { nodeType: 3, parentElement: clarificationInput };
  const resultText = { nodeType: 3, parentElement: result };

  assert.equal(isLatticeClarificationTarget(clarification), false);
  assert.equal(isLatticeClarificationTarget(clarificationText), false);
  assert.equal(isLatticeClarificationTarget(clarificationInput), true);
  assert.equal(isLatticeClarificationTarget(clarificationInputText), true);
  assert.equal(isLatticeClarificationTarget(result), false);
  assert.equal(isLatticeClarificationTarget(resultText), false);
  assert.equal(isLatticeClarificationTarget(null), false);
});

test("quota retry timing is an estimate with stable boundary formatting", () => {
  const now = Date.UTC(2026, 8, 8, 12, 0, 0);
  assert.equal(isLatticeRetryPending(now + 1, now), true);
  assert.equal(isLatticeRetryPending(now, now), false);
  assert.equal(isLatticeRetryPending(now - 1, now), false);
  assert.match(latticeRetryEta(now + 30_000, now, "en-US"), /Try again in 30 seconds/u);
  assert.match(latticeRetryEta(now + 60_000, now, "en-US"), /Try again in 1 minute/u);
  assert.match(latticeRetryEta(now + 3_599_000, now, "en-US"), /Try again in 1 hour/u);
  assert.doesNotMatch(latticeRetryEta(now + 3_599_000, now, "en-US"), /60 minutes/u);
  assert.match(latticeRetryEta(now + 30_000, now, "en-US", "automatic"), /The run will retry in 30 seconds\. Estimated local time:/u);
  assert.equal(latticeRetryEta(now, now, "en-US"), "You can try again now.");
  assert.equal(latticeRetryEta(now, now, "en-US", "automatic"), "The run is retrying now.");
});
