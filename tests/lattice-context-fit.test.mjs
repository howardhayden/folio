import assert from "node:assert/strict";
import test from "node:test";

import { fitLatticeDocumentLedger } from "../app/resume/lattice/localModel.js";

const opaqueToken = (index, prefix = "u") => `${prefix}${index.toString(36).padStart(4, "0")}`;

function opaqueLedger(length) {
  return Object.freeze(Array.from({ length }, (_, index) => Object.freeze({
    id: opaqueToken(index, "a"),
    value: opaqueToken(index),
  })));
}

test("selects the maximal fitting ledger prefix", async () => {
  const documentLedger = opaqueLedger(9);
  const probedLengths = [];
  const request = Object.freeze({
    requestId: opaqueToken(0, "r"),
    documentLedger,
  });

  const fitted = await fitLatticeDocumentLedger(request, async (candidate) => {
    probedLengths.push(candidate.documentLedger.length);
    return candidate.documentLedger.length <= 5;
  });

  assert.ok(fitted);
  assert.equal(fitted.documentLedger.length, 5);
  assert.deepEqual(fitted.documentLedger, documentLedger.slice(0, 5));
  assert.ok(probedLengths.includes(5));
  assert.ok(probedLengths.includes(6));
  assert.equal(documentLedger.length, 9);
});

test("represents a fitting zero-entry ledger as complete", async () => {
  const fitted = await fitLatticeDocumentLedger(
    Object.freeze({ documentLedger: opaqueLedger(0) }),
    async () => true,
  );

  assert.ok(fitted);
  assert.deepEqual(fitted.documentLedger, []);
  assert.deepEqual(fitted.documentLedgerCoverage, {
    availableAtomCount: 0,
    includedAtomCount: 0,
    complete: true,
    selection: "linked-hard-relational-nearest",
  });
  assert.ok(Object.isFrozen(fitted.documentLedger));
  assert.ok(Object.isFrozen(fitted.documentLedgerCoverage));
});

test("returns null when even the zero-entry ledger does not fit", async () => {
  let calls = 0;
  const fitted = await fitLatticeDocumentLedger(
    Object.freeze({ documentLedger: opaqueLedger(0) }),
    async () => {
      calls += 1;
      return false;
    },
  );

  assert.equal(fitted, null);
  assert.equal(calls, 1);
});

test("preserves the full ledger and reports complete coverage when it fits", async () => {
  const documentLedger = opaqueLedger(6);
  const fitted = await fitLatticeDocumentLedger(
    Object.freeze({ requestId: opaqueToken(1, "r"), documentLedger }),
    async () => true,
  );

  assert.ok(fitted);
  assert.deepEqual(fitted.documentLedger, documentLedger);
  assert.notEqual(fitted.documentLedger, documentLedger);
  assert.deepEqual(fitted.documentLedgerCoverage, {
    availableAtomCount: 6,
    includedAtomCount: 6,
    complete: true,
    selection: "linked-hard-relational-nearest",
  });
});

test("coverage metadata describes the selected prefix and replaces stale coverage", async () => {
  const documentLedger = opaqueLedger(7);
  const request = Object.freeze({
    requestId: opaqueToken(2, "r"),
    documentLedger,
    documentLedgerCoverage: Object.freeze({
      availableAtomCount: 1,
      includedAtomCount: 1,
      complete: true,
      selection: opaqueToken(3, "s"),
    }),
  });

  const fitted = await fitLatticeDocumentLedger(
    request,
    async (candidate) => candidate.documentLedger.length <= 3,
  );

  assert.ok(fitted);
  assert.equal(fitted.requestId, request.requestId);
  assert.deepEqual(fitted.documentLedger, documentLedger.slice(0, 3));
  assert.deepEqual(fitted.documentLedgerCoverage, {
    availableAtomCount: 7,
    includedAtomCount: 3,
    complete: false,
    selection: "linked-hard-relational-nearest",
  });
});

test("the binary search requires a prefix-monotonic fit predicate", async () => {
  const documentLedger = opaqueLedger(8);
  const globallyFittingLengths = new Set([0, 1, 8]);

  const fitted = await fitLatticeDocumentLedger(
    Object.freeze({ documentLedger }),
    async (candidate) => globallyFittingLengths.has(candidate.documentLedger.length),
  );

  // A false midpoint excludes every longer prefix. This intentionally records
  // the pure helper's precondition; arbitrary non-monotonic predicates cannot
  // rely on it to find the globally largest fitting prefix.
  assert.ok(fitted);
  assert.equal(fitted.documentLedger.length, 1);
  assert.ok(globallyFittingLengths.has(documentLedger.length));
});

test("required certification atoms cannot be trimmed from a fitting ledger prefix", async () => {
  const documentLedger = opaqueLedger(8);
  const fitted = await fitLatticeDocumentLedger(Object.freeze({
    documentLedger,
    requiredDocumentLedgerAtomIds: Object.freeze([documentLedger[1].id, documentLedger[4].id]),
  }), async (candidate) => candidate.documentLedger.length <= 6);
  assert.ok(fitted);
  assert.equal(fitted.documentLedger.length, 6);
  assert.ok(fitted.documentLedger.some(({ id }) => id === documentLedger[1].id));
  assert.ok(fitted.documentLedger.some(({ id }) => id === documentLedger[4].id));
});

test("a mixed present and missing required certification set fails closed", async () => {
  let probes = 0;
  const documentLedger = opaqueLedger(4);
  const fitted = await fitLatticeDocumentLedger(Object.freeze({
    documentLedger,
    requiredDocumentLedgerAtomIds: Object.freeze([documentLedger[1].id, "a_missing"]),
  }), async () => {
    probes += 1;
    return true;
  });
  assert.equal(fitted, null);
  assert.equal(probes, 0);
});

test("complete certification-ledger requests never accept a fitting partial prefix", async () => {
  const documentLedger = opaqueLedger(7);
  const fitted = await fitLatticeDocumentLedger(Object.freeze({
    documentLedger,
    requireCompleteDocumentLedger: true,
  }), async (candidate) => candidate.documentLedger.length <= 6);
  assert.equal(fitted, null);
});
