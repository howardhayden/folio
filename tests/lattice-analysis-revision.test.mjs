import assert from "node:assert/strict";
import test from "node:test";

import {
  preflightLatticeInput,
  runTextToLattice,
} from "../app/resume/latticeDemo.js";
import { LATTICE_DOCUMENT_CERTIFICATION_CHECKS } from "../app/resume/lattice/promptContract.js";

const source = Array.from({ length: 80 }, (_, index) => `u${index}`).join(" ");
const collisionSource = Array.from({ length: 73 }, (_, index) => `u${index}`).join(" ");
const clarificationSource = ["person", ...Array.from({ length: 5 }, (_, index) => `u${index + 1}`), "person", "u7", "u8"].join(" ");

function chunked(value, size) {
  const result = [];
  for (let index = 0; index < value.length; index += size) result.push(value.slice(index, index + size));
  return result;
}

function analysisResponse(request, { reanalysis = false } = {}) {
  const externalAnchor = request.documentLedger.find(({ id }) => /:anchor$/u.test(id));
  return {
    documentKind: "informational",
    passages: request.batch.passages.map((passage, passageIndex) => {
      const sourceGroup = request.sourceSpans.find(({ passageId }) => passageId === passage.id);
      const evidenceGroups = chunked(sourceGroup.spans, 3);
      const atoms = evidenceGroups.map((evidence, atomIndex) => {
        const firstAnchor = request.batch.id === "b001" && passageIndex === 0 && atomIndex === 0;
        const laterAtom = request.batch.id === "b002" && passageIndex === 0 && atomIndex === 0;
        const selectedEvidence = reanalysis && request.batch.id === "b001" && passageIndex === 0
          ? evidenceGroups[1 - atomIndex] ?? evidence
          : evidence;
        return {
          id: firstAnchor ? "anchor" : laterAtom ? "later" : `a${passageIndex}_${atomIndex}`,
          kind: firstAnchor ? reanalysis ? "causality" : "actor" : laterAtom ? "relationship" : "state",
          value: firstAnchor
            ? reanalysis ? "replacement semantic content" : "initial semantic content"
            : laterAtom ? "later content related to the initial anchor" : `content ${passageIndex}:${atomIndex}`,
          priority: firstAnchor || laterAtom ? "hard" : "semantic",
          preservation: "equivalent",
          evidenceSpanIds: selectedEvidence.map(({ id }) => id),
          links: laterAtom ? [{ relation: "related-to", targetAtomId: externalAnchor.id }] : [],
        };
      });
      return {
        passageId: passage.id,
        discourseFunction: "states bounded source content",
        layer: "interpretive",
        disposition: "rewrite",
        rationale: "make the source relation explicit",
        atoms,
        ambiguityAtomIds: [],
        conformanceCriteria: [],
        conformanceEvidenceSpanIds: [],
        conformanceAssertions: [],
      };
    }),
    questions: [],
  };
}

function candidateResponse(request) {
  return {
    passages: request.batch.passages.map((passage, passageIndex) => ({
      passageId: passage.id,
      layer: request.analysis.passages[passageIndex].layer,
      text: passage.text.replaceAll("u", "v"),
      preservedAtomIds: request.analysis.passages[passageIndex].atoms.map(({ id }) => id),
    })),
  };
}

function verificationResponse(request, { missingCoverage = false } = {}) {
  return {
    decision: missingCoverage ? "repair" : "accept",
    failedGates: missingCoverage ? ["sourceCoverage"] : [],
    passages: request.analysis.passages.map((passage) => ({
      passageId: passage.passageId,
      checkedAtomIds: passage.atoms.map(({ id }) => id),
      missingAtomIds: [],
      unsupportedClaims: [],
      unmodeledSpanIds: missingCoverage
        ? request.sourceSpans.find(({ passageId }) => passageId === passage.passageId).spans.map(({ id }) => id)
        : [],
      failedChecks: [],
      conformanceConfirmed: false,
      conformanceEvidenceSpanIds: [],
      independentLayer: passage.layer,
      layerEvidenceAtomIds: passage.atoms.map(({ id }) => id),
      layerEvidenceSpanIds: [...new Set(passage.atoms.flatMap(({ evidenceSpanIds }) => evidenceSpanIds))],
      criterionChecks: [],
    })),
    issues: [],
    questions: [],
  };
}

function clarificationAnalysisResponse(request, {
  evidenceIndex = 0,
  firstEvidenceIndex = 0,
  firstValue = "the first possible person",
  secondValue = "the second possible person",
  targetId = "first",
  prompt = "Which person is meant?",
  firstLabel = "The first person",
} = {}) {
  const passage = request.batch.passages[0];
  const spans = request.sourceSpans[0].spans;
  const selectedEvidence = spans[Math.min(evidenceIndex, spans.length - 1)];
  return {
    documentKind: "informational",
    passages: [{
      passageId: passage.id,
      discourseFunction: "states an unresolved relationship",
      layer: "interpretive",
      disposition: "rewrite",
      rationale: "make the supported relationship explicit",
      atoms: [
        {
          id: "choice",
          kind: "ambiguity",
          value: "which person the relationship concerns",
          priority: "hard",
          preservation: "equivalent",
          evidenceSpanIds: [selectedEvidence.id],
          links: [{ relation: "related-to", targetAtomId: targetId }],
        },
        {
          id: "first",
          kind: "actor",
          value: firstValue,
          priority: "semantic",
          preservation: "equivalent",
          evidenceSpanIds: [spans[Math.min(firstEvidenceIndex, spans.length - 1)].id],
          links: [],
        },
        {
          id: "second",
          kind: "actor",
          value: secondValue,
          priority: "semantic",
          preservation: "equivalent",
          evidenceSpanIds: [spans.at(-1).id],
          links: [],
        },
      ],
      ambiguityAtomIds: ["choice"],
      conformanceCriteria: [],
      conformanceEvidenceSpanIds: [],
      conformanceAssertions: [],
    }],
    questions: [{
      id: "person",
      passageId: passage.id,
      prompt,
      affectedAtomIds: ["choice"],
      options: [
        { id: "first", label: firstLabel },
        { id: "second", label: "The second person" },
      ],
    }],
  };
}

function clarificationAnswerFor(question, answer = question.options[0].label) {
  return {
    questionId: question.id,
    questionFingerprint: question.fingerprint,
    sourceFingerprint: question.sourceFingerprint,
    analysisRevisionId: question.analysisRevisionId,
    questionStage: question.questionStage,
    ...(question.candidateFingerprint ? { candidateFingerprint: question.candidateFingerprint } : {}),
    passageId: question.passageId,
    prompt: question.prompt,
    answer,
  };
}

function crossBatchClarificationResponse(request, anchorValue) {
  if (request.batch.id === "b001") {
    const response = analysisResponse(request);
    const anchor = response.passages[0].atoms.find(({ id }) => id === "anchor");
    anchor.value = anchorValue;
    return response;
  }
  const passage = request.batch.passages[0];
  const evidenceSpanIds = request.sourceSpans[0].spans.map(({ id }) => id);
  const externalAnchor = request.documentLedger.find(({ id }) => /:anchor$/u.test(id));
  return {
    documentKind: "informational",
    passages: [{
      passageId: passage.id,
      discourseFunction: "asks which prior identity the final statement concerns",
      layer: "interpretive",
      disposition: "rewrite",
      rationale: "preserve the unresolved reference to the prior identity",
      atoms: [{
        id: "choice",
        kind: "ambiguity",
        value: "which prior identity is meant",
        priority: "hard",
        preservation: "equivalent",
        evidenceSpanIds,
        links: [{ relation: "related-to", targetAtomId: externalAnchor.id }],
      }],
      ambiguityAtomIds: ["choice"],
      conformanceCriteria: [],
      conformanceEvidenceSpanIds: [],
      conformanceAssertions: [],
    }],
    questions: [{
      id: "prior-identity",
      passageId: passage.id,
      prompt: "Which reading applies?",
      affectedAtomIds: ["choice"],
      options: [
        { id: "first", label: "The first reading" },
        { id: "second", label: "The second reading" },
      ],
    }],
  };
}

function verifierClarificationResponse(request) {
  const response = verificationResponse(request);
  const ambiguityAtomId = request.analysis.passages[0].ambiguityAtomIds[0];
  response.decision = "clarify";
  response.questions = [{
    id: "referent",
    passageId: request.batch.passages[0].id,
    prompt: "Which person is meant?",
    affectedAtomIds: [ambiguityAtomId],
    options: [
      { id: "first", label: "The first person" },
      { id: "second", label: "The second person" },
    ],
  }];
  return response;
}

test("re-atomization cannot silently retarget a later batch link through a reused raw atom ID", async () => {
  assert.equal(preflightLatticeInput(source).batches.length, 2);

  const analysisCalls = new Map();
  const verificationCalls = new Map();
  const firstBatchGenerations = [];
  let laterTargetId = null;
  let certificationCalls = 0;
  const adapter = {
    async analyze(request) {
      const call = (analysisCalls.get(request.batch.id) ?? 0) + 1;
      analysisCalls.set(request.batch.id, call);
      return analysisResponse(request, { reanalysis: request.batch.id === "b001" && call === 2 });
    },
    async generate(request) {
      if (request.batch.id === "b001") {
        const anchor = request.analysis.passages[0].atoms.find(({ id }) => /:anchor$/u.test(id));
        firstBatchGenerations.push({
          id: anchor.id,
          kind: anchor.kind,
          value: anchor.value,
          evidenceSpanIds: [...anchor.evidenceSpanIds],
        });
      } else {
        laterTargetId = request.analysis.passages[0].atoms[0].links[0].targetAtomId;
      }
      return candidateResponse(request);
    },
    async verify(request) {
      const call = (verificationCalls.get(request.batch.id) ?? 0) + 1;
      verificationCalls.set(request.batch.id, call);
      return verificationResponse(request, {
        missingCoverage: request.batch.id === "b001" && call === 1,
      });
    },
    async repair(request) {
      return candidateResponse(request);
    },
    async certify(request) {
      certificationCalls += 1;
      return {
        certificateId: request.certificateId,
        obligationIds: request.obligationIds,
        decision: "accept",
        checks: Object.fromEntries(LATTICE_DOCUMENT_CERTIFICATION_CHECKS.map((name) => [name, true])),
        issues: [],
      };
    },
  };

  const result = await runTextToLattice(source, { adapter });
  assert.equal(firstBatchGenerations.length, 2);
  assert.notDeepEqual(
    firstBatchGenerations[0],
    firstBatchGenerations[1],
    "the regression fixture must materially change the anchor's analyzed semantics",
  );
  assert.equal(laterTargetId, firstBatchGenerations[0].id);
  assert.notEqual(
    firstBatchGenerations[0].id,
    firstBatchGenerations[1].id,
    "each logical analysis request must receive a distinct host-qualified atom revision",
  );
  assert.notEqual(laterTargetId, firstBatchGenerations[1].id);
  assert.equal(certificationCalls, 0, "a dangling prior-revision link must fail closed before certification");
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
});

test("raw local atom IDs cannot enter or shadow the host-qualified revision namespace", async (context) => {
  assert.equal(preflightLatticeInput(collisionSource).batches.length, 2);

  const cases = [
    ["visible external ID", (externalId) => externalId],
    ["future-width host ID", () => "r1000:forged"],
  ];
  for (const [name, localRawId] of cases) {
    await context.test(name, async () => {
      let certificationCalls = 0;
      let attemptedLocalRawId = null;
      const adapter = {
        async analyze(request) {
          const response = analysisResponse(request);
          if (request.batch.id !== "b002") return response;
          const externalAnchor = request.documentLedger.find(({ id }) => /:anchor$/u.test(id));
          const evidenceSpanIds = request.sourceSpans[0].spans.map(({ id }) => id);
          attemptedLocalRawId = localRawId(externalAnchor.id);
          response.passages[0].atoms = [
            {
              id: attemptedLocalRawId,
              kind: "state",
              value: "local content using a host-shaped identity",
              priority: "hard",
              preservation: "equivalent",
              evidenceSpanIds,
              links: [],
            },
            {
              id: "sender",
              kind: "relationship",
              value: "later content related to the external anchor",
              priority: "semantic",
              preservation: "equivalent",
              evidenceSpanIds,
              links: [{ relation: "related-to", targetAtomId: externalAnchor.id }],
            },
          ];
          return response;
        },
        async generate(request) {
          return candidateResponse(request);
        },
        async verify(request) {
          return verificationResponse(request);
        },
        async repair(request) {
          return candidateResponse(request);
        },
        async certify(request) {
          certificationCalls += 1;
          return {
            certificateId: request.certificateId,
            obligationIds: request.obligationIds,
            decision: "accept",
            checks: Object.fromEntries(LATTICE_DOCUMENT_CERTIFICATION_CHECKS.map((check) => [check, true])),
            issues: [],
          };
        },
      };

      const result = await runTextToLattice(collisionSource, { adapter });
      assert.match(attemptedLocalRawId, /^r\d+:/u);
      assert.equal(certificationCalls, 0);
      assert.equal(result.status, "unable-to-attempt");
      assert.equal(result.text, null);
    });
  }
});

test("clarification answers bind to stable evidence and link provenance", async (context) => {
  const pendingQuestion = async (analysisOptions, {
    correctionRetry = false,
    sourceText = clarificationSource,
  } = {}) => {
    let analyzeCalls = 0;
    const result = await runTextToLattice(sourceText, {
      adapter: {
        async analyze(request) {
          analyzeCalls += 1;
          const response = clarificationAnalysisResponse(request, analysisOptions);
          return correctionRetry && analyzeCalls === 1 ? { ...response, extra: true } : response;
        },
        async generate(request) { return candidateResponse(request); },
        async verify(request) { return verificationResponse(request); },
        async repair(request) { return candidateResponse(request); },
      },
    });
    assert.equal(result.status, "needs-clarification");
    assert.equal(result.questions.length, 1);
    return { analyzeCalls, question: result.questions[0] };
  };

  await context.test("correction retry preserves the same provenance fingerprint", async () => {
    const baseline = await pendingQuestion({ targetId: "first", evidenceIndex: 0 });
    const corrected = await pendingQuestion(
      { targetId: "first", evidenceIndex: 0 },
      { correctionRetry: true },
    );
    assert.equal(corrected.analyzeCalls, 2);
    assert.equal(corrected.question.fingerprint, baseline.question.fingerprint);
  });

  const driftCases = [
    ["link topology", { targetId: "second", evidenceIndex: 0 }],
    ["source evidence", { targetId: "first", evidenceIndex: 1 }],
    ["linked endpoint provenance", {
      targetId: "first",
      evidenceIndex: 0,
      firstEvidenceIndex: 1,
      firstValue: "changed meaning behind the same linked identity",
    }],
    ["disconnected same-passage graph", {
      targetId: "first",
      evidenceIndex: 0,
      secondValue: "changed context elsewhere in the containing passage",
    }],
    ["option", {
      targetId: "first",
      evidenceIndex: 0,
      firstLabel: "The initially named person",
    }],
  ];
  for (const [name, changedAnalysis] of driftCases) {
    await context.test(`${name} drift invalidates an old answer`, async () => {
      const prior = await pendingQuestion({ targetId: "first", evidenceIndex: 0 });
      let generationCalls = 0;
      const result = await runTextToLattice(clarificationSource, {
        clarificationAnswers: [clarificationAnswerFor(prior.question, "The first person")],
        adapter: {
          async analyze(request) {
            return clarificationAnalysisResponse(request, changedAnalysis);
          },
          async generate(request) {
            generationCalls += 1;
            return candidateResponse(request);
          },
          async verify(request) { return verificationResponse(request); },
          async repair(request) { return candidateResponse(request); },
        },
      });
      assert.equal(result.status, "needs-clarification");
      assert.equal(result.text, null);
      assert.equal(generationCalls, 0);
      assert.equal(result.questions[0].id, prior.question.id);
      assert.notEqual(result.questions[0].fingerprint, prior.question.fingerprint);
    });
  }

  await context.test("source drift invalidates an old answer", async () => {
    const prior = await pendingQuestion({ targetId: "first", evidenceIndex: 0 });
    const changedSource = `${clarificationSource.slice(0, -2)}z8`;
    const current = await pendingQuestion(
      { targetId: "first", evidenceIndex: 0 },
      { sourceText: changedSource },
    );
    assert.notEqual(current.question.sourceFingerprint, prior.question.sourceFingerprint);
    assert.notEqual(current.question.fingerprint, prior.question.fingerprint);
  });
});

test("a later-batch question binds to full upstream provenance beyond the fitted ledger excerpt", async () => {
  assert.equal(preflightLatticeInput(collisionSource).batches.length, 2);
  const sharedPrefix = "shared upstream identity provenance ".repeat(4);
  const baselineValue = `${sharedPrefix}Alex`;
  const changedValue = `${sharedPrefix}Jordan`;
  assert.ok(sharedPrefix.length > 96);

  const runPendingQuestion = async (anchorValue, clarificationAnswers = []) => {
    const visibleAnchorValues = [];
    let generationCalls = 0;
    let certificationCalls = 0;
    const result = await runTextToLattice(collisionSource, {
      clarificationAnswers,
      adapter: {
        async analyze(request) {
          if (request.batch.id === "b002") {
            visibleAnchorValues.push(request.documentLedger.find(({ id }) => /:anchor$/u.test(id)).value);
          }
          return crossBatchClarificationResponse(request, anchorValue);
        },
        async generate(request) {
          generationCalls += 1;
          return candidateResponse(request);
        },
        async verify(request) { return verificationResponse(request); },
        async repair(request) { return candidateResponse(request); },
        async certify(request) {
          certificationCalls += 1;
          return {
            certificateId: request.certificateId,
            obligationIds: request.obligationIds,
            decision: "accept",
            checks: Object.fromEntries(LATTICE_DOCUMENT_CERTIFICATION_CHECKS.map((name) => [name, true])),
            issues: [],
          };
        },
      },
    });
    return { certificationCalls, generationCalls, result, visibleAnchorValues };
  };

  const baseline = await runPendingQuestion(baselineValue);
  assert.equal(baseline.result.status, "needs-clarification");
  assert.equal(baseline.result.questions.length, 1);
  const priorQuestion = baseline.result.questions[0];
  const changed = await runPendingQuestion(
    changedValue,
    [clarificationAnswerFor(priorQuestion)],
  );

  assert.deepEqual(changed.visibleAnchorValues, baseline.visibleAnchorValues,
    "the model-facing ledger fixture must conceal the changed suffix");
  assert.equal(changed.result.status, "needs-clarification");
  assert.equal(changed.result.text, null);
  assert.equal(changed.generationCalls, 0);
  assert.equal(changed.certificationCalls, 0);
  assert.notEqual(changed.result.questions[0].fingerprint, priorQuestion.fingerprint);
});

test("verifier-origin clarification can never authorize or expose an assembled candidate", async () => {
  const runCandidate = async (replacement, clarificationAnswers = []) => {
    let generationCalls = 0;
    let certificationCalls = 0;
    const result = await runTextToLattice(clarificationSource, {
      clarificationAnswers,
      adapter: {
        async analyze(request) {
          const response = clarificationAnalysisResponse(request);
          response.questions = [];
          return response;
        },
        async generate(request) {
          generationCalls += 1;
          const response = candidateResponse(request);
          response.passages = response.passages.map((passage) => ({
            ...passage,
            text: request.batch.passages.find(({ id }) => id === passage.passageId).text
              .replaceAll("u", replacement),
          }));
          return response;
        },
        async verify(request) { return verifierClarificationResponse(request); },
        async repair(request) { return candidateResponse(request); },
        async certify(request) {
          certificationCalls += 1;
          return {
            certificateId: request.certificateId,
            obligationIds: request.obligationIds,
            decision: "accept",
            checks: Object.fromEntries(LATTICE_DOCUMENT_CERTIFICATION_CHECKS.map((name) => [name, true])),
            issues: [],
          };
        },
      },
    });
    return { certificationCalls, generationCalls, result };
  };

  const baseline = await runCandidate("v");
  assert.equal(baseline.result.status, "unable-to-attempt");
  assert.equal(baseline.result.text, null);
  assert.deepEqual(baseline.result.questions, []);

  const changed = await runCandidate("w", []);
  assert.equal(changed.generationCalls, 1);
  assert.equal(changed.certificationCalls, 0);
  assert.equal(changed.result.status, "unable-to-attempt");
  assert.equal(changed.result.text, null);
  assert.deepEqual(changed.result.questions, []);
});
