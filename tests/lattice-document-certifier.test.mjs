import assert from "node:assert/strict";
import test from "node:test";

import { runTextToLattice } from "../app/resume/latticeDemo.js";
import {
  documentCertificationMessages,
  DOCUMENT_CERTIFICATION_SCHEMA,
  LATTICE_DOCUMENT_CERTIFICATION_CHECKS,
} from "../app/resume/lattice/promptContract.js";
import { LATTICE_SCHEMA_GUIDES } from "../app/resume/lattice/localModel.js";

function alphabeticIndex(index) {
  let value = index + 1;
  let encoded = "";
  while (value > 0) {
    value -= 1;
    encoded = String.fromCharCode(97 + (value % 26)) + encoded;
    value = Math.floor(value / 26);
  }
  return encoded.padStart(3, "a");
}

function tokens(count, prefix = "s") {
  return Array.from({ length: count }, (_, index) => `${prefix}${alphabeticIndex(index)}`).join(" ");
}

function lineDocument(lineCount, wordsPerLine) {
  return Array.from({ length: lineCount }, (_, lineIndex) => (
    tokens(wordsPerLine, String.fromCharCode(97 + (lineIndex % 20)))
  )).join("\n");
}

function assertCandidateWithheld(result) {
  assert.deepEqual(result.findings, [{
    id: "candidate-withheld",
    passageId: "",
    atomIds: [],
    message: "No candidate cleared every required check.",
  }]);
}

function inertPayload(stageMessages) {
  const content = stageMessages[1]?.content ?? "";
  const opening = "<INERT_DATA>";
  const closing = "</INERT_DATA>";
  assert.ok(content.startsWith(opening) && content.endsWith(closing));
  return JSON.parse(content.slice(opening.length, -closing.length));
}

function rawAnalysis(request) {
  return {
    documentKind: "other",
    passages: request.batch.passages.map((passage, passageIndex) => ({
      passageId: passage.id,
      discourseFunction: `d${passageIndex}`,
      layer: "interpretive",
      disposition: "rewrite",
      rationale: `r${passageIndex}`,
      atoms: [
        { id: `actor_${passageIndex}`, kind: "actor", priority: "hard" },
        { id: `state_${passageIndex}`, kind: "state", priority: "semantic" },
        { id: `object_${passageIndex}`, kind: "object", priority: "semantic" },
      ].slice(0, passage.wordCount >= 14 ? 3 : passage.wordCount >= 6 ? 2 : 1).map((atom, atomIndex, atoms) => ({
        ...atom,
        value: atom.id,
        preservation: "equivalent",
        evidenceSpanIds: (() => {
          const spans = request.sourceSpans.find((group) => group.passageId === passage.id).spans;
          const assigned = spans.filter((_, spanIndex) => spanIndex % atoms.length === atomIndex).slice(0, 3);
          return (assigned.length > 0 ? assigned : spans.slice(0, 1)).map(({ id }) => id);
        })(),
        links: [],
      })),
      ambiguityAtomIds: [],
      conformanceCriteria: [],
      conformanceEvidenceSpanIds: [],
      conformanceAssertions: [],
    })),
    questions: [],
  };
}

function revised(source) {
  return source.split(/(\s+)/u).map((part) => (/^\p{L}+$/u.test(part) ? `z${part.slice(1)}` : part)).join("");
}

function rawCandidate(request) {
  const sourceById = new Map(request.batch.passages.map((passage) => [passage.id, passage.text]));
  return {
    passages: request.analysis.passages.map((plan) => ({
      passageId: plan.passageId,
      layer: plan.layer,
      text: revised(sourceById.get(plan.passageId)),
      preservedAtomIds: plan.atoms.map(({ id }) => id),
    })),
  };
}

function rawVerification(request, overrides = {}) {
  const gates = {
    languageSupported: true,
    safety: true,
    semanticFidelity: true,
    sourceCoverage: true,
    atomCoverage: true,
    accessibility: true,
    clarity: true,
    domainCorrectness: true,
    registerFit: true,
    ornament: true,
    documentConsistency: true,
    ...(overrides.gates ?? {}),
  };
  return {
    decision: overrides.decision ?? (Object.values(gates).every(Boolean) ? "accept" : "repair"),
    failedGates: Object.entries(gates).filter(([, passed]) => !passed).map(([name]) => name),
    passages: request.analysis.passages.map((plan) => ({
      passageId: plan.passageId,
      checkedAtomIds: plan.atoms.map(({ id }) => id),
      missingAtomIds: [],
      unsupportedClaims: [],
      unmodeledSpanIds: [],
      failedChecks: [],
      conformanceConfirmed: false,
      conformanceEvidenceSpanIds: [],
      independentLayer: plan.layer,
      layerEvidenceAtomIds: plan.atoms.map(({ id }) => id),
      layerEvidenceSpanIds: [...new Set(plan.atoms.flatMap(({ evidenceSpanIds }) => evidenceSpanIds))],
      criterionChecks: [],
    })),
    issues: [],
    questions: [],
  };
}

function rawCertification(request, overrides = {}) {
  const checks = Object.fromEntries(LATTICE_DOCUMENT_CERTIFICATION_CHECKS.map((name) => [name, true]));
  Object.assign(checks, overrides.checks);
  return {
    certificateId: request.certificateId,
    obligationIds: request.obligationIds,
    decision: overrides.decision ?? (Object.values(checks).every(Boolean) ? "accept" : "reject"),
    checks,
    issues: overrides.issues ?? [],
  };
}

function adapterFor(behavior = {}) {
  const calls = { analyze: 0, generate: 0, verify: 0, repair: 0, certify: 0 };
  return {
    calls,
    ...(behavior.completionCapacity ? {
      completionCapacity() { return behavior.completionCapacity(); },
    } : {}),
    ...(behavior.certificationFits ? {
      certificationFits(request) { return behavior.certificationFits(request); },
    } : {}),
    async analyze(request) {
      calls.analyze += 1;
      return behavior.analyze?.(request, calls.analyze) ?? rawAnalysis(request);
    },
    async generate(request) {
      calls.generate += 1;
      return behavior.generate?.(request, calls.generate) ?? rawCandidate(request);
    },
    async verify(request) {
      calls.verify += 1;
      return behavior.verify?.(request, calls.verify) ?? rawVerification(request);
    },
    async repair(request) {
      calls.repair += 1;
      return behavior.repair?.(request, calls.repair) ?? rawCandidate(request);
    },
    async certify(request) {
      calls.certify += 1;
      return behavior.certify?.(request, calls.certify) ?? rawCertification(request);
    },
  };
}

test("the document-certification contract is strict and model-visible", () => {
  assert.equal(DOCUMENT_CERTIFICATION_SCHEMA.additionalProperties, false);
  assert.deepEqual(DOCUMENT_CERTIFICATION_SCHEMA.required, [
    "certificateId", "obligationIds", "decision", "checks", "issues",
  ]);
  const guide = LATTICE_SCHEMA_GUIDES.get(DOCUMENT_CERTIFICATION_SCHEMA);
  assert.equal(typeof guide, "string");
  for (const name of LATTICE_DOCUMENT_CERTIFICATION_CHECKS) assert.match(guide, new RegExp(name, "u"));
});

test("a passing multi-batch candidate receives one whole-document certification", async () => {
  const source = tokens(90);
  const reports = [];
  let supplied;
  const adapter = adapterFor({
    certify(request) {
      supplied = request;
      return rawCertification(request);
    },
  });
  const result = await runTextToLattice(source, {
    adapter,
    onProgress(report) { reports.push(report); },
  });
  assert.equal(result.status, "translated");
  assert.equal(adapter.calls.certify, 1);
  assert.equal(supplied.source, source);
  assert.equal(supplied.candidate, result.text);
  assert.equal(reports.filter(({ phase }) => phase === "certifying-document").length, 1);
});

test("whole-document certification runs after a repaired batch passes re-verification", async () => {
  const adapter = adapterFor({
    verify(request, count) {
      return count === 1
        ? rawVerification(request, { gates: { semanticFidelity: false } })
        : rawVerification(request);
    },
  });
  const result = await runTextToLattice(tokens(90), { adapter });
  assert.equal(result.status, "translated");
  assert.equal(adapter.calls.repair, 1);
  assert.equal(adapter.calls.certify, 1);
  assert.equal(result.verificationPasses, 2);
});

test("document rejection hides a material candidate", async () => {
  const candidateOnlyMarker = "documentcandonlymkrqxjvz";
  const adapter = adapterFor({
    certify(request) {
      return rawCertification(request, {
        decision: "reject",
        checks: { identityRolesAttribution: false },
        issues: [{ id: candidateOnlyMarker, check: "identityRolesAttribution", message: candidateOnlyMarker }],
      });
    },
  });
  const result = await runTextToLattice(tokens(80), { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.equal(result.revisedPassageCount, 0);
  assert.equal(result.retainedPassageCount, 0);
  assert.equal(result.verificationPasses, 0);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(candidateOnlyMarker, "u"));
  assertCandidateWithheld(result);
});

test("invalid and context-unfit document checks fail closed", async (context) => {
  await context.test("invalid bounded output", async () => {
    const adapter = adapterFor({ certify() { return {}; } });
    const result = await runTextToLattice(tokens(80), { adapter });
    assert.equal(result.status, "unable-to-attempt");
    assert.equal(result.text, null);
    assert.equal(adapter.calls.certify, 2);
    assertCandidateWithheld(result);
  });

  await context.test("context envelope failure", async () => {
    const adapter = adapterFor({
      certify() {
        const error = new Error("context_token");
        error.code = "lattice-context";
        throw error;
      },
    });
    const result = await runTextToLattice(tokens(80), { adapter });
    assert.equal(result.status, "unable-to-attempt");
    assert.equal(result.text, null);
    assert.ok(adapter.calls.certify > 1);
    assertCandidateWithheld(result);
  });
});

test("a maximum document remains hidden when flat and window certification cannot fit", async () => {
  const source = tokens(700);
  const adapter = adapterFor({
    certify() {
      const error = new Error("bounded_context");
      error.code = "lattice-context";
      throw error;
    },
  });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.equal(result.revisedPassageCount, 0);
  assert.equal(result.retainedPassageCount, 0);
  assert.ok(adapter.calls.certify > 1);
  assertCandidateWithheld(result);
});

test("an exact seven-hundred-word document falls back to lossless verified windows", async () => {
  const source = tokens(700);
  const windows = [];
  const adapter = adapterFor({
    certify(request) {
      if (request.scope !== "window") {
        const error = new Error("flat_context");
        error.code = "lattice-context";
        throw error;
      }
      windows.push(request);
      return rawCertification(request);
    },
  });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.wordCount, 700);
  assert.equal(result.status, "translated");
  assert.ok(result.text);
  assert.equal(windows.length, result.passageCount);
  assert.ok(windows.every((request) => request.source.length > 0 && request.candidate.length > 0));
  assert.ok(windows.every((request) => (
    request.certificateId === `certificate:passage:${request.window.passageId}`
    && request.obligationIds.length === 1 + request.window.boundaryIds.length
    && request.obligationIds[0] === `passage:${request.window.passageId}`
    && request.window.boundaryIds.every((boundaryId) => request.obligationIds.includes(boundaryId))
    && request.analysis.passages.length === 1
      && request.analysis.passages[0].passageId === request.window.passageId
  )));
  const expectedBoundaryIds = windows.slice(0, -1).map((request, index) => (
    `boundary:${request.window.passageId}:${windows[index + 1].window.passageId}`
  ));
  assert.equal(new Set(windows.flatMap(({ window }) => window.boundaryIds)).size, expectedBoundaryIds.length);
  for (const boundaryId of expectedBoundaryIds) {
    assert.equal(windows.filter(({ window }) => window.boundaryIds.includes(boundaryId)).length, 2);
  }
  for (const request of windows) {
    const payload = inertPayload(documentCertificationMessages(request));
    assert.deepEqual(payload.obligationIds, request.obligationIds);
    assert.deepEqual(payload.window.boundaryIds, request.window.boundaryIds);
  }
});

test("window certification carries lifted direction frames into the model payload", async () => {
  const source = `\u2067${tokens(90)}\u2069`;
  const windows = [];
  const adapter = adapterFor({
    certify(request) {
      if (request.scope !== "window") {
        const error = new Error("flat_context");
        error.code = "lattice-context";
        throw error;
      }
      windows.push(request);
      return rawCertification(request);
    },
  });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.ok(windows.length > 1);
  const middle = windows[Math.floor(windows.length / 2)];
  assert.deepEqual(middle.window.directionFrames, ["RLI"]);
  const payload = inertPayload(documentCertificationMessages(middle));
  assert.deepEqual(payload.window.directionFrames, ["RLI"]);
});

test("a boundary is not covered when either adjacent window rejects it", async () => {
  const source = tokens(700);
  const candidateOnlyMarker = "windowcandonlymkrqxjvz";
  const windows = [];
  const adapter = adapterFor({
    certify(request) {
      if (request.scope !== "window") {
        const error = new Error("flat_context");
        error.code = "lattice-context";
        throw error;
      }
      windows.push(request);
      if (request.window.index === 2) {
        return rawCertification(request, {
          decision: "reject",
          checks: { boundaryFidelity: false },
          issues: [{ id: candidateOnlyMarker, check: "boundaryFidelity", message: candidateOnlyMarker }],
        });
      }
      return rawCertification(request);
    },
  });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.ok(windows.length > 2);
  assert.ok(windows[1].window.boundaryIds.length > 0);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(candidateOnlyMarker, "u"));
  assertCandidateWithheld(result);
});

test("capacity fallback reports a distinct monotonic active-window sequence", async () => {
  const reports = [];
  const adapter = adapterFor({
    certify(request) {
      if (request.scope !== "window") {
        const error = new Error("flat_context");
        error.code = "lattice-context";
        throw error;
      }
      return rawCertification(request);
    },
  });
  const result = await runTextToLattice(tokens(90), {
    adapter,
    onProgress(report) { reports.push(report); },
  });
  assert.equal(result.status, "translated");
  const flat = reports.filter(({ phase }) => phase === "certifying-document");
  const planning = reports.filter(({ phase }) => phase === "planning-certification");
  const windows = reports.filter(({ phase }) => phase === "certifying-windows");
  assert.deepEqual(flat.map(({ current, total }) => [current, total]), [[0, 1]]);
  assert.ok(planning.length > 0);
  assert.ok(planning.every(({ progress }) => progress === null));
  assert.deepEqual(windows.map(({ current }) => current), [0, 1, 1, 2, 2, 3]);
  assert.ok(windows.every(({ total }) => total === 3));
  assert.deepEqual(windows.map(({ progress }) => progress), [0, 1 / 3, 1 / 3, 2 / 3, 2 / 3, 1]);
});

test("an exactly reservable production-shaped budget skips flat certification", async () => {
  const scopes = [];
  const adapter = adapterFor({
    completionCapacity() { return { used: 506, limit: 512, remaining: 6 }; },
    certify(request) {
      scopes.push(request.scope ?? "document");
      return rawCertification(request);
    },
  });
  const result = await runTextToLattice(tokens(90), { adapter });
  assert.equal(result.status, "translated");
  assert.deepEqual(scopes, ["window", "window", "window"]);
});

test("flat certification output exhaustion retries on grounded windows", async () => {
  const adapter = adapterFor({
    certify(request, count) {
      if (request.scope !== "window" && count <= 2) {
        const error = new Error("output_limit");
        error.code = "lattice-output-length";
        throw error;
      }
      return rawCertification(request);
    },
  });
  const result = await runTextToLattice(tokens(90), { adapter });
  assert.equal(result.status, "translated");
  assert.ok(result.text);
  assert.ok(adapter.calls.certify > 2);
});

test("a contradictory flat rejection cannot be replaced by accepting windows", async () => {
  const adapter = adapterFor({
    certify(request) {
      if (request.scope === "window") return rawCertification(request);
      return {
        certificateId: request.certificateId,
        obligationIds: request.obligationIds,
        decision: "reject",
        checks: Object.fromEntries(LATTICE_DOCUMENT_CERTIFICATION_CHECKS.map((name) => [name, true])),
        issues: [],
      };
    },
  });
  const result = await runTextToLattice(tokens(90), { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.equal(adapter.calls.certify, 2);
  assertCandidateWithheld(result);
});

test("window fallback rejects a far-distance actor resolution that contradicts verified source evidence", async () => {
  const source = `Noor entered before Imani. ${tokens(100, "m")} The former signed the waiver.`;
  const candidateOnlyMarker = "relationcandonlymkrqxjvz";
  let observedProof = false;
  const adapter = adapterFor({
    analyze(request) {
      const analysis = rawAnalysis(request);
      const sourceById = new Map(request.batch.passages.map((passage) => [passage.id, passage.text]));
      const formerPlan = analysis.passages.find(({ passageId }) => /\bformer\b/iu.test(sourceById.get(passageId)));
      const antecedent = request.documentLedger.find((atom) => atom.value.startsWith("actor_"));
      if (formerPlan && antecedent) {
        formerPlan.atoms[0].links = [{ relation: "coreference", targetAtomId: antecedent.id }];
      }
      return analysis;
    },
    generate(request) {
      const sourceById = new Map(request.batch.passages.map((passage) => [passage.id, passage.text]));
      return {
        passages: request.analysis.passages.map((plan) => ({
          passageId: plan.passageId,
          layer: plan.layer,
          text: sourceById.get(plan.passageId).replace(/\p{L}+/gu, (word) => (
            word.toLocaleLowerCase("und") === "former" ? "Imani" : `z${word.slice(1)}`
          )),
          preservedAtomIds: plan.atoms.map(({ id }) => id),
        })),
      };
    },
    certify(request) {
      if (request.scope !== "window" && request.scope !== "relations") {
        const error = new Error("flat_context");
        error.code = "lattice-context";
        throw error;
      }
      if (request.scope === "relations") {
        observedProof = request.relations.some(({ sourceAtom, targetAtom }) => (
          [...sourceAtom.evidence, ...targetAtom.evidence].some(({ text }) => text.includes("Noor entered before Imani"))
        )) && request.endpointPassages.some(({ source: endpointSource }) => endpointSource.includes("Noor entered before Imani"));
        return rawCertification(request, {
          decision: "reject",
          checks: { identityRolesAttribution: false },
          issues: [{ id: candidateOnlyMarker, check: "identityRolesAttribution", message: candidateOnlyMarker }],
        });
      }
      return rawCertification(request);
    },
  });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(observedProof, true);
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.equal(result.revisedPassageCount, 0);
  assert.equal(result.retainedPassageCount, 0);
  assert.equal(result.verificationPasses, 0);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(candidateOnlyMarker, "u"));
  assertCandidateWithheld(result);
});

test("window fallback carries nonadjacent relations from other passages in the same batch", async () => {
  const source = [tokens(16, "a"), tokens(16, "b"), tokens(16, "c")]
    .map((passage) => `${passage}.`)
    .join("\n");
  const windows = [];
  const relations = [];
  const adapter = adapterFor({
    analyze(request) {
      const analysis = rawAnalysis(request);
      if (analysis.passages.length >= 3) {
        analysis.passages[0].atoms[0].links = [{
          relation: "related-to",
          targetAtomId: analysis.passages[2].atoms[0].id,
        }];
      }
      return analysis;
    },
    certify(request) {
      if (request.scope !== "window" && request.scope !== "relations") {
        const error = new Error("flat_context");
        error.code = "lattice-context";
        throw error;
      }
      if (request.scope === "window") windows.push(request);
      else relations.push(request);
      return rawCertification(request);
    },
  });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.equal(result.batchCount, 1);
  assert.equal(windows.length, 3);
  assert.equal(relations.length, 1);
  assert.deepEqual(new Set(relations[0].endpointPassages.map(({ passageId }) => passageId)), new Set(["p0001", "p0003"]));
  assert.equal(relations[0].relations.length, 1);
  assert.equal(relations[0].relations[0].relation, "related-to");
  assert.equal(relations[0].obligationIds[0], relations[0].relations[0].id);
  assert.ok(relations[0].relations.every(({ sourceAtom, targetAtom }) => (
    sourceAtom.evidence.length > 0 && targetAtom.evidence.length > 0
  )));
});

test("relation fallback binary-splits capacity failures and certifies every edge once", async () => {
  const source = [tokens(16, "a"), tokens(16, "b"), tokens(16, "c")]
    .map((passage) => `${passage}.`)
    .join("\n");
  const acceptedEdgeIds = [];
  let splitCount = 0;
  const adapter = adapterFor({
    analyze(request) {
      const analysis = rawAnalysis(request);
      if (analysis.passages.length >= 3) {
        const targetAtoms = analysis.passages[2].atoms;
        for (const plan of analysis.passages.slice(0, 2)) {
          plan.atoms.forEach((atom, index) => {
            atom.links = [{ relation: "related-to", targetAtomId: targetAtoms[index % targetAtoms.length].id }];
          });
        }
      }
      return analysis;
    },
    certify(request) {
      if (!request.scope) {
        const error = new Error("flat_context");
        error.code = "lattice-context";
        throw error;
      }
      if (request.scope === "relations" && request.obligationIds.length > 1) {
        splitCount += 1;
        const error = new Error("relation_context");
        error.code = "lattice-context";
        throw error;
      }
      if (request.scope === "relations") acceptedEdgeIds.push(...request.obligationIds);
      return rawCertification(request);
    },
  });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.ok(splitCount > 0);
  assert.equal(acceptedEdgeIds.length, 6);
  assert.equal(new Set(acceptedEdgeIds).size, 6);
});

test("production-shaped context preflight splits relation roots before reserving completions", async () => {
  const source = [tokens(16, "a"), tokens(16, "b"), tokens(16, "c")]
    .map((passage) => `${passage}.`)
    .join("\n");
  const certifiedEdgeIds = [];
  let preflightSplits = 0;
  const adapter = adapterFor({
    completionCapacity() { return { used: 494, limit: 512, remaining: 18 }; },
    certificationFits(request) {
      const fits = request.scope !== "relations" || request.obligationIds.length === 1;
      if (!fits) preflightSplits += 1;
      return fits;
    },
    analyze(request) {
      const analysis = rawAnalysis(request);
      if (analysis.passages.length >= 3) {
        const targetAtoms = analysis.passages[2].atoms;
        for (const plan of analysis.passages.slice(0, 2)) {
          plan.atoms.forEach((atom, index) => {
            atom.links = [{ relation: "related-to", targetAtomId: targetAtoms[index % targetAtoms.length].id }];
          });
        }
      }
      return analysis;
    },
    certify(request) {
      assert.ok(request.scope === "window" || request.obligationIds.length === 1);
      if (request.scope === "relations") certifiedEdgeIds.push(...request.obligationIds);
      return rawCertification(request);
    },
  });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.ok(preflightSplits > 0);
  assert.equal(certifiedEdgeIds.length, 6);
  assert.equal(new Set(certifiedEdgeIds).size, 6);
  assert.equal(adapter.calls.certify, 9);
});

test("dense valid relation graphs use packed proofs without dropping any directed edge", async () => {
  const certifiedEdgeIds = [];
  let used = 60;
  const adapter = adapterFor({
    completionCapacity() { return { used, limit: 512, remaining: 512 - used }; },
    analyze(request) {
      const analysis = rawAnalysis(request);
      const targets = request.documentLedger.slice(0, 8);
      for (const passage of analysis.passages) {
        for (const atom of passage.atoms) {
          atom.links = targets.map(({ id }) => ({ relation: "related-to", targetAtomId: id }));
        }
      }
      return analysis;
    },
    certify(request) {
      used += 1;
      if (!request.scope) {
        const error = new Error("flat_context");
        error.code = "lattice-context";
        throw error;
      }
      if (request.scope === "relations") certifiedEdgeIds.push(...request.obligationIds);
      return rawCertification(request);
    },
  });
  const result = await runTextToLattice(tokens(700), { adapter });
  assert.equal(result.status, "translated");
  assert.ok(certifiedEdgeIds.length > 256);
  assert.equal(new Set(certifiedEdgeIds).size, certifiedEdgeIds.length);
  assert.ok(adapter.calls.certify < 512 - 60);
});

test("a single batch relies on its existing verifier", async () => {
  const adapter = adapterFor();
  const result = await runTextToLattice(tokens(20), { adapter });
  assert.equal(result.status, "translated");
  assert.equal(adapter.calls.verify, 1);
  assert.equal(adapter.calls.certify, 0);
});

test("ledger prefixes cover other batches and passages before remaining atoms", async () => {
  const batchByPassage = new Map();
  const observed = [];
  const adapter = adapterFor({
    analyze(request) {
      for (const passage of request.batch.passages) batchByPassage.set(passage.id, request.batch.id);
      return rawAnalysis(request);
    },
    generate(request) {
      observed.push(request.documentLedger);
      return rawCandidate(request);
    },
  });
  const result = await runTextToLattice(lineDocument(45, 4), { adapter });
  assert.equal(result.status, "translated");
  assert.ok(observed.length >= 3);
  for (const ledger of observed) {
    const ledgerPassages = new Set(ledger.map(({ passageId }) => passageId));
    const representedBatches = new Set([...ledgerPassages].map((passageId) => batchByPassage.get(passageId)));
    const firstByBatch = ledger.slice(0, representedBatches.size);
    assert.equal(new Set(firstByBatch.map(({ passageId }) => batchByPassage.get(passageId))).size, representedBatches.size);
    const representatives = ledger.slice(0, ledgerPassages.size);
    assert.equal(new Set(representatives.map(({ passageId }) => passageId)).size, ledgerPassages.size);
    assert.ok(representatives.every(({ kind, priority }) => kind === "actor" && priority === "hard"));
  }
});

test("every downstream stage keeps externally linked ledger atoms model-visible", async () => {
  const observed = { generate: [], verify: [], repair: [] };
  let forcedRepair = false;
  const assertAndRecord = (stage, request) => {
    if (request.requiredDocumentLedgerAtomIds.length === 0) return;
    observed[stage].push(request.requiredDocumentLedgerAtomIds);
    const visible = new Set(request.documentLedger.map(({ id }) => id));
    assert.ok(request.requiredDocumentLedgerAtomIds.every((id) => visible.has(id)));
  };
  const adapter = adapterFor({
    analyze(request) {
      const analysis = rawAnalysis(request);
      if (request.documentLedger.length > 0) {
        analysis.passages[0].atoms[0].links = [{
          relation: "related-to",
          targetAtomId: request.documentLedger[0].id,
        }];
      }
      return analysis;
    },
    generate(request) {
      assertAndRecord("generate", request);
      return rawCandidate(request);
    },
    verify(request) {
      assertAndRecord("verify", request);
      if (!forcedRepair && request.requiredDocumentLedgerAtomIds.length > 0) {
        forcedRepair = true;
        return rawVerification(request, { gates: { clarity: false } });
      }
      return rawVerification(request);
    },
    repair(request) {
      assertAndRecord("repair", request);
      return rawCandidate(request);
    },
  });
  const result = await runTextToLattice(tokens(90), { adapter });
  assert.equal(result.status, "translated");
  assert.ok(observed.generate.length > 0);
  assert.ok(observed.verify.length > 1);
  assert.equal(observed.repair.length, 1);
});

test("a stale incoming link after committed re-atomization blocks flat certification", async () => {
  let forcedReanalysis = false;
  const adapter = adapterFor({
    analyze(request) {
      const analysis = rawAnalysis(request);
      if (request.reanalysisFeedback) {
        for (const passage of analysis.passages) {
          for (const atom of passage.atoms) atom.id = `new_${atom.id}`;
        }
      } else if (request.documentLedger.length > 0) {
        analysis.passages[0].atoms[0].links = [{
          relation: "related-to",
          targetAtomId: request.documentLedger[0].id,
        }];
      }
      return analysis;
    },
    verify(request) {
      if (!forcedReanalysis && request.batch.id === "b001") {
        forcedReanalysis = true;
        return rawVerification(request, { gates: { sourceCoverage: false } });
      }
      return rawVerification(request);
    },
  });
  const result = await runTextToLattice(tokens(90), { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.equal(adapter.calls.certify, 0);
  assertCandidateWithheld(result);
});
