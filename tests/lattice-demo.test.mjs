import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import {
  LATTICE_CLARIFICATION_SAFETY_LIMIT,
  LATTICE_CLARIFICATION_UTF8_LIMIT,
  LATTICE_CLARIFICATION_WORD_LIMIT,
  LATTICE_COMPLETION_CALL_LIMIT,
  LATTICE_INPUT_SAFETY_LIMIT,
  LATTICE_WORD_LIMIT,
  countLatticeWords,
  preflightLatticeInput,
  runTextToLattice,
  validateLatticeClarificationAnswer,
  validateLatticeInput,
} from "../app/resume/latticeDemo.js";
import {
  LATTICE_SCHEMA_GUIDES,
  parseLocalLatticeJsonObject,
} from "../app/resume/lattice/localModel.js";
import {
  ANALYSIS_SCHEMA,
  CANDIDATE_SCHEMA,
  LATTICE_CONFORMANCE_CRITERIA,
  LATTICE_DOCUMENT_CERTIFICATION_CHECKS,
  LATTICE_FITTED_ANALYSIS_CONTEXT,
  REANALYSIS_SCHEMA,
  VERIFICATION_SCHEMA,
  analysisMessages,
  candidateMessages,
  decodeLatticeBoundaryForModel,
  encodeLatticeBoundaryForModel,
  repairMessages,
  verificationMessages,
} from "../app/resume/lattice/promptContract.js";
import {
  BATCH_PASSAGE_LIMIT,
  LATTICE_EXECUTION_BATCH_LIMIT,
  LATTICE_PASSAGE_LIMIT,
  batchLatticePassages,
  contextPassagesForBatch,
  graphemeExcerpt,
  latticeLiteralSpansForPassage,
  latticeLiteralSpanScanForPassage,
  latticeSourceSpansForBatch,
  latticeSourceSpansForPassage,
  reassembleLatticeSource,
  segmentLatticeSource,
  splitLatticePassage,
} from "../app/resume/lattice/segments.js";
import { hasInvalidLatticeBidiIsolates } from "../app/resume/lattice/inputPolicy.js";
import { latticeProtectedLiteralMatches } from "../app/resume/lattice/protectedSpans.js";
import {
  deterministicDocumentReview,
  deterministicPassageReview,
  materiallyDifferent,
} from "../app/resume/lattice/validators.js";

const opaqueWords = (count, prefix = "u") => Array.from(
  { length: count },
  (_, index) => `${prefix}${index.toString(36).padStart(4, "0")}`,
).join(" ");

function assertCandidateWithheld(result) {
  assert.deepEqual(result.findings, [{
    id: "candidate-withheld",
    passageId: "",
    atomIds: [],
    message: "No candidate cleared every required check.",
  }]);
}

function fixedPassage(prefix) {
  const words = Array.from({ length: 36 }, (_, index) => `${prefix}${index.toString(36).padStart(8, "0")}`);
  let remaining = 420 - words.join(" ").length;
  for (let index = 0; remaining > 0; index = (index + 1) % words.length) {
    words[index] += "x";
    remaining -= 1;
  }
  return words.join(" ");
}

function seededLetters(length, seed) {
  let state = seed >>> 0;
  let value = "";
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    value += String.fromCharCode(97 + (state % 26));
  }
  return value;
}

function interleavedLiteralPassageNoSpaces(characterCount, literalCount, wordCount, seed) {
  const literals = Array.from(
    { length: literalCount },
    (_, index) => `\`${seededLetters(3, seed + 1_000 + (index * 31))}\``,
  );
  const sources = Array.from({ length: literalCount + 1 }, (_, index) => (
    index < wordCount - literalCount ? `${seededLetters(3, seed + (index * 43))}!` : "!"
  ));
  const punctuation = "!^~=+_";
  let serial = 0;
  let length = [...sources, ...literals].reduce((sum, value) => sum + value.length, 0);
  while (length < characterCount) {
    sources[serial % sources.length] += punctuation[serial % punctuation.length];
    serial += 1;
    length += 1;
  }
  const parts = [];
  for (let index = 0; index < literals.length; index += 1) parts.push(sources[index], literals[index]);
  parts.push(sources.at(-1));
  const value = parts.join("");
  assert.equal(value.length, characterCount);
  assert.equal(countLatticeWords(value), wordCount);
  assert.equal(/\s/u.test(value), false);
  return value;
}

function literalSafeCandidate(request) {
  return {
    passages: request.batch.passages.map((passage, passageIndex) => ({
      passageId: passage.id,
      layer: request.analysis.passages[passageIndex].layer,
      text: passage.text.split(/(`[^`\r\n]*`)/gu).map((part, index) => (
        index % 2 ? part : part.replace(/\p{L}+/gu, (word) => [...word].reverse().join(""))
      )).join(""),
      preservedAtomIds: request.analysis.passages[passageIndex].atoms.map(({ id }) => id),
    })),
  };
}

const requiredConformanceCriteria = (layer) => [
  ...LATTICE_CONFORMANCE_CRITERIA.universal,
  ...LATTICE_CONFORMANCE_CRITERIA[layer],
];

function evidenceSpanIdsFor(spans, atomIndex, atomCount) {
  const assigned = spans.filter((_, spanIndex) => spanIndex % atomCount === atomIndex).slice(0, 3);
  return (assigned.length > 0 ? assigned : spans.slice(0, 1)).map(({ id }) => id);
}

function rawAnalysis(request, options = {}) {
  const passages = request.batch.passages.map((passage, passageIndex) => {
    const sourceGroup = request.sourceSpans.find((group) => group.passageId === passage.id);
    const sourceSpans = [...sourceGroup.spans, ...(sourceGroup.literalAnnotations ?? [])];
    const layer = options.layer ?? ["interpretive", "operative", "experiential"][passageIndex % 3];
    const disposition = options.disposition ?? "rewrite";
    const minimumDiversity = passage.wordCount >= 14 ? 3 : passage.wordCount >= 6 ? 2 : 1;
    const kinds = options.question && passageIndex === 0
      ? ["ambiguity", "object", "state"]
      : ["state", "object", "unit"];
    const atoms = Array.from({ length: minimumDiversity }, (_, atomIndex) => ({
      id: `a${passageIndex + 1}_${atomIndex + 1}`,
      kind: kinds[atomIndex],
      value: `v${passageIndex}_${atomIndex}`,
      priority: "semantic",
      preservation: "equivalent",
      evidenceSpanIds: evidenceSpanIdsFor(sourceSpans, atomIndex, minimumDiversity),
      links: [],
    }));
    const retained = disposition === "retain-if-conformant";
    return {
      passageId: passage.id,
      discourseFunction: `d${passageIndex}`,
      layer,
      disposition,
      rationale: `r${passageIndex}`,
      atoms,
      ambiguityAtomIds: options.question && passageIndex === 0 ? [atoms[0].id] : [],
      conformanceCriteria: retained ? requiredConformanceCriteria(layer) : [],
      conformanceEvidenceSpanIds: retained ? sourceSpans.map(({ id }) => id) : [],
      conformanceAssertions: retained ? requiredConformanceCriteria(layer).map((criterion) => ({
        criterion,
        evidenceSpanIds: sourceSpans.map(({ id }) => id),
      })) : [],
    };
  });
  return {
    documentKind: "other",
    passages,
    questions: options.question ? [{
      id: "q1",
      passageId: passages[0].passageId,
      prompt: "Which reading applies?",
      affectedAtomIds: [passages[0].atoms[0].id],
      options: [],
    }] : [],
  };
}

function bindQuestionToCitedAmbiguities(analysis) {
  const passage = analysis.passages[0];
  passage.atoms.forEach((atom, index) => { atom.kind = index % 2 === 0 ? "ambiguity" : "uncertainty"; });
  passage.ambiguityAtomIds = passage.atoms.map(({ id }) => id);
  analysis.questions[0].affectedAtomIds = [...passage.ambiguityAtomIds];
  return analysis;
}

function rawAnalysisWithAtomCount(request, atomCount) {
  const base = rawAnalysis(request);
  const passageCount = base.passages.length;
  let remaining = atomCount;
  return {
    ...base,
    passages: base.passages.map((passage, passageIndex) => {
      const remainingPassages = passageCount - passageIndex;
      const count = Math.ceil(remaining / remainingPassages);
      remaining -= count;
      const spans = request.sourceSpans.find((group) => group.passageId === passage.passageId).spans;
      return {
        ...passage,
        atoms: Array.from({ length: count }, (_, atomIndex) => ({
          id: `a${passageIndex}_${atomIndex}`,
          kind: ["state", "object", "unit"][atomIndex % 3],
          value: `v${passageIndex}_${atomIndex}`,
          priority: atomIndex === 0 ? "hard" : "semantic",
          preservation: "equivalent",
          evidenceSpanIds: evidenceSpanIdsFor(spans, atomIndex, count),
          links: [],
        })),
      };
    }),
  };
}

function changedText(source) {
  const changed = source.replaceAll("u", "v");
  return changed === source ? `${source} z0000` : changed;
}

function rawCandidate(request, { identity = false } = {}) {
  const sourceById = new Map(request.batch.passages.map((passage) => [passage.id, passage]));
  return {
    passages: request.analysis.passages.map((plan) => {
      const source = sourceById.get(plan.passageId).text;
      const retain = plan.disposition === "retain-if-conformant";
      return {
        passageId: plan.passageId,
        layer: plan.layer,
        text: identity || retain ? source : changedText(source),
        preservedAtomIds: plan.atoms.map((atom) => atom.id),
      };
    }),
  };
}

function rawVerification(request, overrides = {}) {
  const sourceById = new Map(request.batch.passages.map((passage) => [passage.id, passage]));
  const candidateById = new Map(request.candidate.passages.map((passage) => [passage.passageId, passage]));
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
  const passages = request.analysis.passages.map((plan) => {
    const source = sourceById.get(plan.passageId).text;
    const candidate = candidateById.get(plan.passageId).text;
    const conformant = plan.disposition === "retain-if-conformant" && source === candidate;
    const sourceGroup = request.sourceSpans.find((group) => group.passageId === plan.passageId);
    const sourceSpanIds = [...sourceGroup.spans, ...(sourceGroup.literalAnnotations ?? [])].map(({ id }) => id);
    const passageResult = {
      passageId: plan.passageId,
      checkedAtomIds: plan.atoms.map((atom) => atom.id),
      missingAtomIds: [],
      unsupportedClaims: [],
      unmodeledSpanIds: [],
      semanticFidelity: true,
      safety: true,
      accessibility: true,
      clarity: true,
      domainCorrectness: true,
      registerFit: true,
      planFit: true,
      materiality: plan.disposition !== "rewrite" || source !== candidate,
      boundaryFidelity: true,
      conformanceConfirmed: conformant,
      conformanceEvidenceSpanIds: conformant ? sourceSpanIds : [],
      independentLayer: plan.layer,
      layerEvidenceAtomIds: plan.atoms.map(({ id }) => id),
      layerEvidenceSpanIds: [...new Set(plan.atoms.flatMap(({ evidenceSpanIds }) => evidenceSpanIds))],
      criterionChecks: conformant ? requiredConformanceCriteria(plan.layer).map((criterion) => ({
        criterion,
        passed: true,
        evidenceSpanIds: sourceSpanIds,
      })) : [],
      ...(overrides.passage ?? {}),
    };
    return {
      passageId: passageResult.passageId,
      checkedAtomIds: passageResult.checkedAtomIds,
      missingAtomIds: passageResult.missingAtomIds,
      unsupportedClaims: passageResult.unsupportedClaims,
      unmodeledSpanIds: passageResult.unmodeledSpanIds,
      failedChecks: [
        "semanticFidelity", "safety", "accessibility", "clarity", "domainCorrectness", "registerFit", "planFit", "materiality",
        "boundaryFidelity",
      ].filter((name) => passageResult[name] === false),
      conformanceConfirmed: passageResult.conformanceConfirmed,
      conformanceEvidenceSpanIds: passageResult.conformanceEvidenceSpanIds,
      independentLayer: passageResult.independentLayer,
      layerEvidenceAtomIds: passageResult.layerEvidenceAtomIds,
      layerEvidenceSpanIds: passageResult.layerEvidenceSpanIds,
      criterionChecks: passageResult.criterionChecks,
    };
  });
  const passageChecksPass = passages.every((passage) => (
    passage.missingAtomIds.length === 0
    && passage.unsupportedClaims.length === 0
    && passage.unmodeledSpanIds.length === 0
    && passage.failedChecks.length === 0
    && passage.independentLayer === request.analysis.passages.find(({ passageId }) => (
      passageId === passage.passageId
    ))?.layer
  ));
  return {
    decision: overrides.decision ?? (overrides.questions?.length
      ? "clarify"
      : Object.values(gates).every(Boolean) && passageChecksPass ? "accept" : "repair"),
    failedGates: Object.entries(gates).filter(([, passed]) => !passed).map(([name]) => name),
    passages,
    issues: overrides.issues ?? [],
    questions: overrides.questions ?? [],
  };
}

function rawVerificationQuestion(request, id = "qv") {
  const passage = request.analysis.passages[0];
  return {
    id,
    passageId: passage.passageId,
    prompt: `${id}?`,
    affectedAtomIds: [passage.atoms[0].id],
    options: [],
  };
}

function scriptedAdapter(behavior = {}) {
  const calls = { analyze: 0, generate: 0, verify: 0, repair: 0 };
  return {
    calls,
    async analyze(request) {
      calls.analyze += 1;
      return behavior.analyze?.(request, calls.analyze) ?? rawAnalysis(request, behavior.analysisOptions);
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
      return behavior.certify?.(request) ?? {
        certificateId: request.certificateId,
        obligationIds: request.obligationIds,
        decision: "accept",
        checks: Object.fromEntries(LATTICE_DOCUMENT_CERTIFICATION_CHECKS.map((name) => [name, true])),
        issues: [],
      };
    },
  };
}

function collectSchemaEnums(value, result = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectSchemaEnums(item, result);
    return result;
  }
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value.enum)) {
    for (const item of value.enum) result.add(item);
  }
  for (const item of Object.values(value)) collectSchemaEnums(item, result);
  return result;
}

function inertModelPayload(stageMessages) {
  const content = stageMessages.find(({ role }) => role === "user")?.content ?? "";
  const opening = "<INERT_DATA>";
  const start = content.indexOf(opening);
  const end = content.indexOf("</INERT_DATA>", start + opening.length);
  assert.ok(start >= 0 && end > start);
  return JSON.parse(content.slice(start + opening.length, end));
}

async function productionResumeFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directoryUrl);
    if (entry.isDirectory()) files.push(...await productionResumeFiles(child));
    else if (/\.(?:js|jsx|ts|tsx)$/u.test(entry.name)) files.push(child);
  }
  return files;
}

test("accepts one through 700 generated words and rejects 701", () => {
  assert.equal(countLatticeWords(opaqueWords(1)), 1);
  assert.equal(validateLatticeInput(opaqueWords(LATTICE_WORD_LIMIT)).wordCount, LATTICE_WORD_LIMIT);
  assert.throws(() => validateLatticeInput(opaqueWords(LATTICE_WORD_LIMIT + 1)), RangeError);
  const cjkBoundary = Array.from({ length: 700 }, () => "가".repeat(15)).join(" ");
  assert.equal(cjkBoundary.length, 11_199);
  assert.equal(validateLatticeInput(cjkBoundary).wordCount, 700);
});

test("source and clarification hardening reject pathological representations without truncation", () => {
  const exactSource = `word${" ".repeat(LATTICE_INPUT_SAFETY_LIMIT - 4)}`;
  assert.equal(validateLatticeInput(exactSource).source.length, LATTICE_INPUT_SAFETY_LIMIT);
  assert.throws(() => validateLatticeInput(`${exactSource} `), /12,000-character safety limit/u);
  assert.throws(() => validateLatticeInput(`word ${"☃".repeat(11_995)}`), /too large to process safely/u);
  assert.throws(() => validateLatticeInput(`w${"x".repeat(512)}`), /overlong word-like token/u);
  assert.throws(() => validateLatticeInput(`word${"\u0301".repeat(64)}`), /character sequence/u);
  assert.throws(() => validateLatticeInput(`word${String.fromCharCode(0x85)}`), /control characters/u);
  assert.throws(() => validateLatticeInput(`word${String.fromCharCode(0x202E)}`), /control characters/u);
  assert.throws(() => validateLatticeInput(`word${String.fromCharCode(0xFDD0)}`), /noncharacter/u);
  assert.throws(() => validateLatticeInput(`word${String.fromCharCode(0x2066)}`), /direction markers/u);
  assert.doesNotThrow(() => validateLatticeInput(`${String.fromCharCode(0x2067)}مرحبا${String.fromCharCode(0x2069)}`));
  for (const filler of ["\u115F", "\u1160", "\u3164", "\uFFA0"]) {
    assert.throws(() => validateLatticeInput(filler.repeat(8)), /at least one word/u);
  }
  assert.throws(
    () => validateLatticeInput(Array.from({ length: 257 }, () => "a\u200C").join(" ")),
    /too many invisible formatting controls/u,
  );

  const exactAnswer = `yes${" ".repeat(LATTICE_CLARIFICATION_UTF8_LIMIT - 3)}`;
  assert.equal(validateLatticeClarificationAnswer(exactAnswer).answer, exactAnswer);
  assert.throws(() => validateLatticeClarificationAnswer("a".repeat(LATTICE_CLARIFICATION_SAFETY_LIMIT + 1)), /characters or fewer/u);
  assert.throws(() => validateLatticeClarificationAnswer(`${exactAnswer} `), /Shorten/u);
  assert.throws(() => validateLatticeClarificationAnswer(`answer${String.fromCharCode(0xD800)}`), /incomplete Unicode/u);
  assert.throws(() => validateLatticeClarificationAnswer("a ".repeat(LATTICE_CLARIFICATION_WORD_LIMIT + 1)), /words or fewer/u);
  assert.throws(() => validateLatticeClarificationAnswer(`answer${String.fromCharCode(0)}`), /control characters/u);
  assert.throws(() => validateLatticeClarificationAnswer(`answer${String.fromCharCode(0x85)}`), /control characters/u);
  assert.throws(() => validateLatticeClarificationAnswer(`answer${String.fromCharCode(0xFDD0)}`), /noncharacter/u);
  assert.throws(() => validateLatticeClarificationAnswer(`answer${String.fromCharCode(0x2066)}`), /direction markers/u);
  assert.throws(() => validateLatticeClarificationAnswer(`answer${"\u0301".repeat(64)}`), /character sequence/u);
  assert.throws(() => validateLatticeClarificationAnswer(`a${"x".repeat(512)}`), /characters or fewer/u);
});

test("assembled candidates enforce aggregate Unicode safety limits", () => {
  for (const candidate of [
    `a${"\u0301".repeat(64)}`,
    "x".repeat(513),
    Array.from({ length: 257 }, () => "ا\u200C").join(" "),
  ]) {
    assert.ok(deterministicDocumentReview("source wording", candidate)
      .some(({ id }) => id === "document-unicode-bounds"));
  }
});

test("literal-rich valid input stays within bounded passage and work-group ceilings", () => {
  const literalGroup = `word ${"`!` ".repeat(24)}`;
  for (const repetitions of [33, 34, 66]) {
    const preflight = preflightLatticeInput(literalGroup.repeat(repetitions));
    assert.ok(preflight.passages.length <= 64);
    assert.ok(preflight.batches.length <= 32);
  }
  const denseMarkup = "w<!---->.<!---->".repeat(700);
  const densePreflight = preflightLatticeInput(denseMarkup);
  assert.equal(densePreflight.wordCount, 700);
  assert.ok(densePreflight.batches.length <= 32);
  assert.ok(densePreflight.passages.every((passage) => latticeLiteralSpanScanForPassage(passage).complete));
});

test("preflight lifts whole-document bidi frames and bounds their logical text", () => {
  const crossPassageIsolate = `\u2066${opaqueWords(80)}\u2069`;
  assert.doesNotThrow(() => validateLatticeInput(crossPassageIsolate));
  const preflight = preflightLatticeInput(crossPassageIsolate);
  assert.ok(preflight.passages.length > 1);
  assert.equal(preflight.passages.reduce((sum, passage) => sum + passage.wordCount, 0), 80);
  assert.ok(preflight.passages.every(({ text, directionFrames }) => (
    !/[\u2066-\u2069]/u.test(text) && directionFrames?.join(",") === "LRI"
  )));
  assert.equal(reassembleLatticeSource(
    crossPassageIsolate,
    preflight.passages,
    preflight.passages.map(({ id, text }) => ({ passageId: id, text })),
  ), crossPassageIsolate);
  for (const wordCount of [121, 700]) {
    const compact = `\u2066${Array.from({ length: wordCount }, () => "a").join(" ")}\u2069`;
    const compactPreflight = preflightLatticeInput(compact);
    assert.equal(compactPreflight.wordCount, wordCount);
    assert.ok(compactPreflight.passages.length > 1);
    assert.ok(compactPreflight.passages.length <= LATTICE_PASSAGE_LIMIT);
    assert.ok(compactPreflight.passages.every(({ text, directionFrames }) => (
      !hasInvalidLatticeBidiIsolates(text) && directionFrames?.join(",") === "LRI"
    )));
    assert.equal(reassembleLatticeSource(
      compact,
      compactPreflight.passages,
      compactPreflight.passages.map(({ id, text }) => ({ passageId: id, text })),
    ), compact);
  }
  assert.doesNotThrow(() => preflightLatticeInput(`\u2067مرحبا بالعالم\u2069`));
});

test("adaptive splitting uses only whitespace or complete isolate boundaries", () => {
  const source = `before \u2067${opaqueWords(20, "inside")}\u2069 ${opaqueWords(20, "after")}`;
  const [passage] = segmentLatticeSource(source);
  const children = splitLatticePassage(passage);
  assert.ok(children);
  assert.equal(children.length, 2);
  assert.ok(children.every(({ text }) => !hasInvalidLatticeBidiIsolates(text)));
  assert.equal(source.slice(children[0].endUtf16, children[1].startUtf16), children[0].separatorAfter);
  assert.equal(children[0].separatorAfter, children[1].separatorBefore);
  assert.equal(reassembleLatticeSource(source, children, children.map(({ id, text }) => ({ passageId: id, text }))), source);
});

test("malformed source fails before every model stage", async () => {
  const adapter = scriptedAdapter();
  for (const value of [
    "",
    " \n\t ",
    `word${String.fromCharCode(0)}`,
    `word${String.fromCharCode(0xD800)}`,
    opaqueWords(LATTICE_WORD_LIMIT + 1),
    `word${" ".repeat(LATTICE_INPUT_SAFETY_LIMIT)}`,
  ]) {
    await assert.rejects(() => runTextToLattice(value, { adapter }));
  }
  assert.deepEqual(adapter.calls, { analyze: 0, generate: 0, verify: 0, repair: 0 });
});

test("segments and reassembles Unicode source without changing any source unit", () => {
  const units = ["x\u0301", "\u{1F9ED}", "\u{1F1FA}\u{1F1F3}", "\u{1F469}\u200D\u{1F4BB}", "\u{6F22}", "\u{0645}"];
  const source = Array.from({ length: 90 }, (_, index) => units[index % units.length]).join(" \r\n");
  const passages = segmentLatticeSource(source);
  const replacements = passages.map((passage) => ({ passageId: passage.id, text: passage.text }));
  assert.equal(reassembleLatticeSource(source, passages, replacements), source);
  assert.ok(passages.every((passage) => !/^[\u0300-\u036f\u200d]/u.test(passage.text)));
  assert.ok(batchLatticePassages(passages).every((batch) => batch.passages.length <= BATCH_PASSAGE_LIMIT));
});

test("sentence planning keeps attribution and title units without collapsing distinct short functions", () => {
  const fixtures = [
    ["“Leave now!” Imani responded after checking the panel. The doors shut.", ["“Leave now!” Imani responded after checking the panel.", "The doors shut."]],
    ["Asst. Prof. Noor opened the file. A bell sounded.", ["Asst. Prof. Noor opened the file.", "A bell sounded."]],
    ["The meeting is on Jan. 5. The room is ready.", ["The meeting is on Jan. 5.", "The room is ready."]],
    ["Rain fell. Bells rang. Doors closed.", ["Rain fell.", "Bells rang.", "Doors closed."]],
    ["Stop. Workers secured every outer gate.", ["Stop.", "Workers secured every outer gate."]],
    ["“Proceed?” The lamp changed. Everyone moved.", ["“Proceed?”", "The lamp changed.", "Everyone moved."]],
    ["No. Workers must wait outside.", ["No.", "Workers must wait outside."]],
    ["No. 5. Review the latch.", ["No. 5.", "Review the latch."]],
    ["The vendor is Northstar Inc. 5. Review the latch.", ["The vendor is Northstar Inc.", "5. Review the latch."]],
    ["“Proceed?” The sign said stop. Everyone moved.", ["“Proceed?”", "The sign said stop.", "Everyone moved."]],
    ["“Are the gates secure?” The coordinator responded after checking the panel.", ["“Are the gates secure?” The coordinator responded after checking the panel."]],
  ];
  for (const [source, expected] of fixtures) {
    const passages = segmentLatticeSource(source);
    assert.deepEqual(passages.map(({ text }) => text), expected);
    assert.equal(reassembleLatticeSource(source, passages, passages.map((passage) => ({
      passageId: passage.id,
      text: passage.text,
    }))), source);
  }
});

test("model stages receive exact space, line, paragraph, and stanza boundaries", async () => {
  const separators = [" ", "\n", "\r", "\r\n", "\u2028", "\n\n", "\u2029", "\r\n\u2028\u2029"];
  let certificationCalls = 0;
  for (const separator of separators) {
    const certificationCallsBefore = certificationCalls;
    const source = `First gate opens.${separator}Second gate closes.`;
    const passages = segmentLatticeSource(source);
    assert.equal(passages.length, 2);
    assert.equal(passages[0].separatorAfter, separator);
    assert.equal(passages[1].separatorBefore, separator);
    const batch = batchLatticePassages(passages)[0];
    const sourceSpans = latticeSourceSpansForBatch(batch);
    const serialized = analysisMessages({
      batch,
      sourceSpans,
      context: contextPassagesForBatch(passages, batch),
      documentLedger: [],
      clarificationAnswers: [],
    });
    const inert = serialized.find(({ role }) => role === "user").content;
    const payload = JSON.parse(inert.slice("<INERT_DATA>".length, -"</INERT_DATA>".length));
    assert.deepEqual(payload.sourceBoundaries, [
      [],
      encodeLatticeBoundaryForModel(separator),
      [],
    ]);
    assert.equal(decodeLatticeBoundaryForModel(payload.sourceBoundaries[1]), separator);
    const result = await runTextToLattice(source, {
      adapter: scriptedAdapter({ certify() { certificationCalls += 1; } }),
    });
    assert.equal(result.batchCount, 1);
    assert.equal(result.status, "translated");
    assert.equal(certificationCalls - certificationCallsBefore, separator === " " ? 0 : 1);
  }
  assert.equal(certificationCalls, separators.length - 1);
});

test("model boundary encodings are lossless when compact and bounded otherwise", () => {
  const compact = "\r\n\r\n\t  \u2028\u2029";
  const repeated = "\u2028\u2029".repeat(700);
  assert.equal(decodeLatticeBoundaryForModel(encodeLatticeBoundaryForModel(compact)), compact);
  assert.equal(decodeLatticeBoundaryForModel(encodeLatticeBoundaryForModel(repeated)), repeated);

  const irregular = Array.from({ length: 512 }, (_, index) => (
    ["\n", "\r", "\t", " ", "\u2028", "\u2029"][(index * index + index * 3 + 1) % 6]
  )).join("");
  const encoded = encodeLatticeBoundaryForModel(irregular);
  assert.ok(JSON.stringify(encoded).length < 1_000);
  if (encoded.encoding === "host-exact") {
    assert.equal(encoded.utf16Length, irregular.length);
    assert.equal(encoded.scalarCount, [...irregular].length);
    assert.equal(typeof encoded.fingerprint, "string");
  } else {
    assert.equal(decodeLatticeBoundaryForModel(encoded), irregular);
  }
});

test("reassembly rejects duplicate or non-text replacement records", () => {
  const source = "The first panel opened. The second panel closed.";
  const passages = segmentLatticeSource(source);
  const replacements = passages.map((passage) => ({ passageId: passage.id, text: passage.text }));
  assert.throws(() => reassembleLatticeSource(source, passages, [...replacements, replacements[0]]), /one text replacement/u);
  assert.throws(() => reassembleLatticeSource(source, passages, replacements.map((item, index) => (
    index === 0 ? { ...item, text: undefined } : item
  ))), /one text replacement/u);
});

test("an oversized grapheme makes forward progress and remains lossless", () => {
  const oversizedGrapheme = `g${"\u0301".repeat(900)}`;
  const source = `${oversizedGrapheme} ${opaqueWords(3)}`;
  const passages = segmentLatticeSource(source);
  assert.ok(passages.length >= 2);
  assert.equal(passages[0].text, oversizedGrapheme);
  assert.ok(passages.every(({ startUtf16, endUtf16, text }) => endUtf16 > startUtf16 && source.slice(startUtf16, endUtf16) === text));
  assert.equal(
    reassembleLatticeSource(source, passages, passages.map(({ id, text }) => ({ passageId: id, text }))),
    source,
  );
});

test("context excerpts never split a Unicode grapheme", () => {
  const cluster = `g${"\u0301".repeat(4)}`;
  const value = Array.from({ length: 80 }, () => cluster).join("");
  const start = graphemeExcerpt(value, "start", 181);
  const end = graphemeExcerpt(value, "end", 181);
  assert.equal(start.length % cluster.length, 0);
  assert.equal(end.length % cluster.length, 0);
  assert.equal(start, value.slice(0, start.length));
  assert.equal(end, value.slice(value.length - end.length));
  const maximumGrapheme = `a${String.fromCodePoint(0x1D165).repeat(63)}`;
  assert.equal(graphemeExcerpt(`${maximumGrapheme} rest`, "start", 96), maximumGrapheme);
});

test("source-span IDs losslessly disambiguate repeated Unicode text without splitting graphemes", () => {
  const cluster = `g${"\u0301".repeat(3)}\u200d\u{1F9ED}`;
  const source = Array.from({ length: 24 }, () => `u ${cluster}`).join(" ");
  const [passage] = segmentLatticeSource(source);
  const spans = latticeSourceSpansForPassage(passage);
  const graphemeBoundaries = new Set([0, ...[...new Intl.Segmenter("und", { granularity: "grapheme" }).segment(passage.text)]
    .map((part) => part.index + part.segment.length)]);
  assert.equal(spans.map(({ text }) => text).join(""), passage.text);
  assert.equal(new Set(spans.map(({ id }) => id)).size, spans.length);
  assert.ok(spans.every(({ passageId, startUtf16, endUtf16, text }) => (
    passageId === passage.id
    && graphemeBoundaries.has(startUtf16)
    && graphemeBoundaries.has(endUtf16)
    && passage.text.slice(startUtf16, endUtf16) === text
  )));
  const repeatedText = spans.filter(({ text }) => text.trim() === spans[0].text.trim());
  assert.ok(repeatedText.length > 1);
  assert.equal(new Set(repeatedText.map(({ id }) => id)).size, repeatedText.length);
});

test("passage, adaptive, and evidence boundaries never bisect a source grapheme", () => {
  const sources = [
    `${Array.from({ length: 36 }, () => "a").join(" ")} \u0301b`,
    "alpha \u0301 beta",
    "a `!`\u0301 b",
  ];
  for (const source of sources) {
    const boundarySet = new Set([0, source.length]);
    for (const part of new Intl.Segmenter("und", { granularity: "grapheme" }).segment(source)) {
      boundarySet.add(part.index);
      boundarySet.add(part.index + part.segment.length);
    }
    const passages = segmentLatticeSource(source);
    for (const passage of passages) {
      assert.ok(boundarySet.has(passage.startUtf16));
      assert.ok(boundarySet.has(passage.endUtf16));
      for (const span of latticeSourceSpansForPassage(passage)) {
        assert.ok(boundarySet.has(passage.startUtf16 + span.startUtf16));
        assert.ok(boundarySet.has(passage.startUtf16 + span.endUtf16));
      }
      for (const child of splitLatticePassage(passage) ?? []) {
        assert.ok(boundarySet.has(child.startUtf16));
        assert.ok(boundarySet.has(child.endUtf16));
      }
    }
  }
  const [literalPassage] = segmentLatticeSource("a `!`\u0301 b");
  assert.equal(latticeLiteralSpansForPassage(literalPassage)[0].text, "`!`\u0301");
});

test("direction isolates remain balanced inside every model-facing evidence span", () => {
  const source = `\u2067${opaqueWords(14, "term")}\u2069`;
  const [passage] = segmentLatticeSource(source);
  const spans = latticeSourceSpansForPassage(passage);
  assert.equal(spans.map(({ text }) => text).join(""), source.slice(1, -1));
  assert.deepEqual(passage.directionFrames, ["RLI"]);
  assert.ok(spans.every(({ text }) => !hasInvalidLatticeBidiIsolates(text)));
  assert.equal(reassembleLatticeSource(source, [passage], [{ passageId: passage.id, text: passage.text }]), source);
});

test("exact literals nested in a balanced isolate remain independently citable", () => {
  const source = "\u2067alpha `!` beta\u2069";
  const [passage] = segmentLatticeSource(source);
  const [group] = latticeSourceSpansForBatch(batchLatticePassages([passage])[0]);
  assert.equal(group.spans.map(({ text }) => text).join(""), source.slice(1, -1));
  assert.ok(group.spans.every(({ text }) => !hasInvalidLatticeBidiIsolates(text)));
  assert.deepEqual(group.directionFrames, ["RLI"]);
  assert.equal(group.spans.filter(({ kind }) => kind === "literal").length, 1);
  assert.equal(group.spans.find(({ kind }) => kind === "literal").text, "`!`");
  assert.equal(group.literalAnnotations.length, 0);
  assert.deepEqual(group.literalCoverage, { included: 1, detectedAtLeast: 1, complete: true });
  const serialized = analysisMessages({
    batch: batchLatticePassages([passage])[0],
    sourceSpans: [group],
    context: null,
    documentLedger: [],
    clarificationAnswers: [],
  });
  const system = serialized.find(({ role }) => role === "system").content;
  const user = serialized.find(({ role }) => role === "user").content;
  assert.match(system, /nested literal annotations/iu);
  assert.match(user, /p0001:l01/u);
});

test("nested whole-document direction frames remain host-owned across a rewrite", () => {
  const source = ` \u2066\u2067alpha remains near beta\u2069\u2069 `;
  const candidate = ` \u2066\u2067beta stays beside alpha\u2069\u2069 `;
  assert.equal(
    deterministicDocumentReview(source, candidate).some(({ id }) => id.startsWith("document-bidi")),
    false,
  );

  const localizedSource = "before \u2067alpha remains\u2069 after";
  const localizedCandidate = "before \u2067alpha changes\u2069 after";
  assert.equal(
    deterministicDocumentReview(localizedSource, localizedCandidate)
      .some(({ id }) => id === "document-bidi-sequence"),
    false,
  );
  assert.equal(
    deterministicDocumentReview(localizedSource, "before alpha \u2067remains\u2069 after")
      .some(({ id }) => id === "document-bidi-sequence"),
    true,
  );
});

test("dense astral text inside nested whole-document frames reaches candidate generation", async () => {
  const logicalText = Array.from(
    { length: LATTICE_WORD_LIMIT },
    (_, index) => String.fromCodePoint(0x20000 + (index % 1_000)),
  ).join(" ");
  const source = `\u2066\u2067${logicalText}\u2069\u2069`;
  const adapter = scriptedAdapter();
  const result = await runTextToLattice(source, { adapter });
  assert.ok(adapter.calls.analyze > 0);
  assert.ok(adapter.calls.generate > 0);
  assert.equal(result.status, "translated");
  assert.ok(result.text.startsWith("\u2066\u2067"));
  assert.ok(result.text.endsWith("\u2069\u2069"));
  assert.equal(deterministicDocumentReview(source, result.text).length, 0);
});

test("ordinary prose around an oversized exact literal still reaches candidate generation", async () => {
  const literal = `\`${Array.from(
    { length: 600 },
    (_, index) => `token${index.toString(36).padStart(8, "0")}`,
  ).join(" ")}\``;
  const source = `Lead phrase remains.\n${literal}\nClosing phrase remains.`;
  const adapter = scriptedAdapter();
  const result = await runTextToLattice(source, { adapter });
  assert.equal(adapter.calls.analyze, 2);
  assert.equal(adapter.calls.generate, 2);
  assert.equal(result.status, "translated");
  assert.ok(result.text.includes(literal));
  assert.equal(result.text.match(/`/gu)?.length, 2);
  assert.equal(deterministicDocumentReview(source, result.text).length, 0);
});

test("adaptive atomization recovery never bisects an exact literal", async () => {
  const source = "alpha `bravo charlie` delta";
  const observed = [];
  const adapter = scriptedAdapter({
    analyze(request, count) {
      if (count <= 2) throw new SyntaxError("synthetic invalid analysis");
      observed.push(...request.batch.passages.map(({ text }) => text));
      return rawAnalysis(request);
    },
  });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.equal(observed.filter((text) => text.includes("`bravo charlie`")).length, 1);
  assert.ok(observed.every((text) => (text.match(/`/gu)?.length ?? 0) % 2 === 0));
});

test("model-cited span IDs resolve to exact internal UTF-16 evidence records", async () => {
  const source = Array.from({ length: 12 }, () => `u${"\u0301".repeat(2)} \u{1F469}\u200d\u{1F4BB}`).join(" ");
  let resolved;
  const adapter = scriptedAdapter({
    generate(request) {
      resolved = request.analysis.passages.flatMap((passage) => passage.atoms.flatMap((atom) => atom.evidence));
      return rawCandidate(request);
    },
  });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.ok(resolved.length > 0);
  const passage = segmentLatticeSource(source)[0];
  assert.ok(resolved.every((item) => (
    Object.keys(item).sort().join(",") === "endUtf16,passageId,startUtf16,text"
    && item.passageId === passage.id
    && passage.text.slice(item.startUtf16, item.endUtf16) === item.text
  )));
});

test("unknown source-span IDs fail before generation", async () => {
  const adapter = scriptedAdapter({
    analyze(request) {
      const analysis = rawAnalysis(request);
      analysis.passages[0].atoms[0].evidenceSpanIds = ["pnone:snone"];
      return analysis;
    },
  });
  const result = await runTextToLattice(opaqueWords(8), { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.ok(adapter.calls.analyze > 2 && adapter.calls.analyze <= 64);
  assert.equal(adapter.calls.generate, 0);
});

test("atomization accepts only links and atom counts visible in its fitted model context", async () => {
  const adapter = scriptedAdapter({
    analyze(request) {
      const analysis = rawAnalysis(request);
      if (request.documentLedger.length > 0) {
        analysis.passages[0].atoms[0].links = [{
          relation: "related-to",
          targetAtomId: request.documentLedger[0].id,
        }];
        Object.defineProperty(analysis, LATTICE_FITTED_ANALYSIS_CONTEXT, {
          enumerable: false,
          value: Object.freeze({ analysisAtomLimit: 24, documentLedgerAtomIds: Object.freeze([]) }),
        });
      }
      return analysis;
    },
  });
  const result = await runTextToLattice(opaqueWords(90), { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.ok(adapter.calls.analyze > 2);
  assert.equal(adapter.calls.generate, 0);

  const generatedAtomCounts = [];
  const capped = scriptedAdapter({
    analyze(request) {
      const analysis = rawAnalysis(request);
      Object.defineProperty(analysis, LATTICE_FITTED_ANALYSIS_CONTEXT, {
        enumerable: false,
        value: Object.freeze({ analysisAtomLimit: 1, documentLedgerAtomIds: Object.freeze([]) }),
      });
      return analysis;
    },
    generate(request) {
      generatedAtomCounts.push(request.analysis.passages.flatMap(({ atoms }) => atoms).length);
      return rawCandidate(request);
    },
  });
  const cappedResult = await runTextToLattice(opaqueWords(14), { adapter: capped });
  assert.equal(cappedResult.status, "translated");
  assert.ok(capped.calls.analyze > 2);
  assert.ok(generatedAtomCounts.length > 0 && generatedAtomCounts.every((count) => count <= 1));

  const indivisible = scriptedAdapter({
    analyze(request) {
      const analysis = rawAnalysisWithAtomCount(request, 2);
      Object.defineProperty(analysis, LATTICE_FITTED_ANALYSIS_CONTEXT, {
        enumerable: false,
        value: Object.freeze({ analysisAtomLimit: 1, documentLedgerAtomIds: Object.freeze([]) }),
      });
      return analysis;
    },
  });
  const indivisibleResult = await runTextToLattice("word", { adapter: indivisible });
  assert.equal(indivisibleResult.status, "unable-to-attempt");
  assert.equal(indivisibleResult.text, null);
  assert.equal(indivisible.calls.generate, 0);
});

test("fine-grained literal spans preserve exact URL, quantity, and code while surrounding tokens rewrite", async () => {
  const source = "ua ub https://x.invalid/p uc 17kg ud `q_x()` ue uf ug uh";
  let exactEvidence;
  const adapter = scriptedAdapter({
    analyze(request) {
      const passage = request.batch.passages[0];
      const spans = request.sourceSpans[0].spans;
      const coarse = spans.filter(({ kind }) => kind === "source").map(({ id }) => id);
      const literals = new Map(spans.filter(({ kind }) => kind === "literal").map((span) => [span.literalType, span.id]));
      return {
        documentKind: "technical",
        passages: [{
          passageId: passage.id,
          discourseFunction: "d0",
          layer: "operative",
          disposition: "rewrite",
          rationale: "r0",
          atoms: [
            ...coarse.map((spanId, index) => ({
              id: `context${index}`,
              kind: ["state", "object", "unit"][index % 3],
              value: `v0_${index}`,
              priority: "semantic",
              preservation: "equivalent",
              evidenceSpanIds: [spanId],
              links: [],
            })),
            { id: "url", kind: "object", value: "v1", priority: "hard", preservation: "exact", evidenceSpanIds: [literals.get("url")], links: [] },
            { id: "quantity", kind: "quantity", value: "v2", priority: "hard", preservation: "exact", evidenceSpanIds: [literals.get("quantity")], links: [] },
            { id: "code", kind: "other", value: "v3", priority: "hard", preservation: "exact", evidenceSpanIds: [literals.get("inline-code")], links: [] },
          ],
          ambiguityAtomIds: [],
          conformanceCriteria: [],
          conformanceEvidenceSpanIds: [],
          conformanceAssertions: [],
        }],
        questions: [],
      };
    },
    generate(request) {
      exactEvidence = request.analysis.passages[0].atoms
        .filter(({ preservation }) => preservation === "exact")
        .flatMap(({ evidence }) => evidence.map(({ text }) => text));
      return rawCandidate(request);
    },
  });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.deepEqual(exactEvidence, ["https://x.invalid/p", "17kg", "`q_x()`"]);
  for (const literal of exactEvidence) assert.ok(result.text.includes(literal));
  assert.notEqual(result.text, source);
});

test("model messages distinguish literal spans from lossless source spans", () => {
  const [passage] = segmentLatticeSource("ua https://x.invalid/p ub");
  const batch = batchLatticePassages([passage])[0];
  const sourceSpans = latticeSourceSpansForBatch(batch);
  const serialized = analysisMessages({
    batch,
    sourceSpans,
    context: { preceding: null, following: null },
    documentLedger: [],
    clarificationAnswers: [],
  }).map(({ content }) => content).join("\n");
  assert.match(serialized, /\["p0001:s01","source","ua "\]/u);
  assert.match(serialized, /\["p0001:l01","literal","url","https:\/\/x\.invalid\/p"\]/u);
  assert.match(serialized, /\["p0001:s02","source"," ub"\]/u);
  assert.equal(serialized.match(/https:\/\/x\.invalid\/p/gu)?.length, 1);
});

test("document kind, discourse function, and realization rationale reach every drafting and checking stage", () => {
  const batch = { id: "b001", passages: [{ id: "p0001", text: "Teams close the gate after inspection.", wordCount: 7 }] };
  const sourceSpans = [{
    passageId: "p0001",
    spans: [{ id: "p0001:s01", kind: "source", passageId: "p0001", startUtf16: 0, endUtf16: 38, text: batch.passages[0].text }],
  }];
  const plan = {
    passageId: "p0001",
    discourseFunction: "coordinates a conditional closure sequence",
    layer: "operative",
    disposition: "rewrite",
    rationale: "make the supported actor, condition, and order directly navigable",
    atoms: [{
      id: "b001:a1", kind: "action", value: "close after inspection", priority: "hard", preservation: "equivalent",
      evidenceSpanIds: ["p0001:s01"], evidence: [], links: [],
    }],
    ambiguityAtomIds: [], conformanceCriteria: [], conformanceEvidenceSpanIds: [], conformanceAssertions: [],
  };
  const analysis = { documentKind: "instruction", passages: [plan], questions: [] };
  const candidate = { passages: [{ passageId: "p0001", layer: "operative", text: "After inspection, teams close the gate.", preservedAtomIds: ["b001:a1"] }] };
  const verification = { decision: "repair", gates: { clarity: false }, passages: [], issues: [], questions: [] };
  const request = { batch, sourceSpans, analysis, candidate, verification, documentLedger: [], deterministicFindings: [] };
  for (const factory of [candidateMessages, verificationMessages, repairMessages]) {
    const contract = factory(request).map(({ content }) => content).join("\n");
    assert.match(contract, /instruction/u);
    assert.match(contract, /coordinates a conditional closure sequence/u);
    assert.match(contract, /make the supported actor, condition, and order directly navigable/u);
  }
});

test("an exact atom cannot bind a coarse span and its surrounding text", async () => {
  const adapter = scriptedAdapter({
    analyze(request) {
      const analysis = rawAnalysis(request);
      analysis.passages[0].atoms[0].preservation = "exact";
      return analysis;
    },
  });
  const result = await runTextToLattice(opaqueWords(8), { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.equal(adapter.calls.generate, 0);
});

test("literal extraction remains bounded and non-throwing at its maximum", async () => {
  const source = `u ${Array.from({ length: 60 }, () => "``").join(" ")}`;
  const [passage] = segmentLatticeSource(source);
  assert.doesNotThrow(() => latticeSourceSpansForPassage(passage));
  assert.doesNotThrow(() => latticeLiteralSpansForPassage(passage));
  assert.ok(latticeLiteralSpansForPassage(passage).length <= 24);
  const adapter = scriptedAdapter();
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.ok(result.text);
});

test("exact literal multisets allow structural reordering while preserving counts", () => {
  const source = "ua 3kg ub 7kg https://x.invalid/a `q_a()` AB-17 [za](https://x.invalid/z) uc";
  const candidate = "vc [za](https://x.invalid/z) AB-17 7kg `q_a()` vb https://x.invalid/a 3kg va";
  const findings = deterministicDocumentReview(source, candidate);
  assert.deepEqual(findings, []);
});

test("quantity lists ignore layout spacing and spaced short numerals are not phone literals", () => {
  const source = "ua 1, 2, 3, 4; > 7 kg; 9-11ms ub";
  const candidate = "vb 9 - 11ms; 4, 3, 2, 1; >7kg va";
  assert.deepEqual(deterministicDocumentReview(source, candidate), []);
  const [passage] = segmentLatticeSource(source);
  const literals = latticeLiteralSpansForPassage(passage);
  assert.equal(literals.some(({ literalType }) => literalType === "phone"), false);
  assert.deepEqual(
    literals.filter(({ literalType }) => literalType === "quantity").map(({ text }) => text),
    ["1, 2, 3, 4; > 7 kg; 9-11ms"],
  );
});

test("literal detection does not bind URL punctuation, comparison prose, or following adjectives", () => {
  const source = "ua https://x.invalid/p). ub x < y > z 17 bright tokens uc";
  const candidate = "vc bright tokens number 17; z exceeds y; vb https://x.invalid/p! va";
  assert.deepEqual(deterministicDocumentReview(source, candidate), []);
  const [passage] = segmentLatticeSource(source);
  const literals = latticeLiteralSpansForPassage(passage);
  assert.equal(literals.find(({ literalType }) => literalType === "url").text, "https://x.invalid/p");
  assert.equal(literals.some(({ literalType }) => literalType === "markup"), false);
  assert.equal(literals.find(({ literalType }) => literalType === "quantity").text, "17");
});

test("protected dialogue and operative instructions stay exact, ordered, and locally scoped", () => {
  const source = "Intro can change. ‘If there’s smoke, crawl low.’ If smoke appears, crawl low and call 911. Ending can change.";
  assert.deepEqual(latticeProtectedLiteralMatches(source).map(({ literalType, text }) => ({ literalType, text })), [
    { literalType: "protected-dialogue", text: "‘If there’s smoke, crawl low.’" },
    { literalType: "protected-instruction", text: "If smoke appears, crawl low and call 911." },
  ]);
  assert.deepEqual(latticeLiteralSpansForPassage({ id: "p1", text: source })
    .filter(({ literalType }) => literalType.startsWith("protected-"))
    .map(({ literalType, text }) => ({ literalType, text })), [
    { literalType: "protected-dialogue", text: "‘If there’s smoke, crawl low.’" },
    { literalType: "protected-instruction", text: "If smoke appears, crawl low and call 911." },
  ]);

  const safeRewrite = "Opening prose differs. ‘If there’s smoke, crawl low.’ If smoke appears, crawl low and call 911. Closing prose differs.";
  assert.equal(deterministicDocumentReview(source, safeRewrite)
    .some(({ id }) => id.startsWith("deterministic-protected-literal")), false);
  for (const candidate of [
    source.replace("crawl low.’", "stand tall.’"),
    source.replace("crawl low and call 911", "stand tall and call 911"),
  ]) {
    assert.ok(deterministicDocumentReview(source, candidate)
      .some(({ id }) => id === "deterministic-protected-literal"));
  }

  assert.ok(deterministicDocumentReview("“First.”\n“Second.”", "“Second.”\n“First.”")
    .some(({ id }) => id === "deterministic-protected-literal-order"));
});

test("direct instructions containing dialogue remain operative without overprotecting quoted commands or dimensions", () => {
  for (const source of [
    "Seek medical care if she says “pain.”",
    "Call emergency services when the sign says “fire.”",
    "Keep the ramp clear when the sign says “open.”",
  ]) {
    assert.deepEqual(latticeProtectedLiteralMatches(source).map(({ literalType }) => literalType), ["protected-instruction"]);
  }
  assert.deepEqual(latticeProtectedLiteralMatches("The sign says “Call emergency services.”")
    .map(({ literalType }) => literalType), ["protected-dialogue"]);
  for (const source of [
    "Contact between surfaces produced heat.",
    "Press coverage continued throughout the day.",
    "Tap water remained available.",
    "The 6\" pipe and 8\" pipe remain.",
  ]) {
    assert.deepEqual(latticeProtectedLiteralMatches(source), []);
  }
});

test("same-kind exact literal bundles remain complete and model-citable", async () => {
  const source = `${opaqueWords(10)} ${Array.from({ length: 49 }, (_, index) => `\`q_${String(index).padStart(2, "0")}\``).join(" ")}`;
  const passages = segmentLatticeSource(source);
  assert.ok(passages.length >= 1);
  assert.ok(passages.every((passage) => latticeLiteralSpanScanForPassage(passage).complete));
  const batches = batchLatticePassages(passages);
  const citedLiterals = batches.flatMap((batch) => latticeSourceSpansForBatch(batch))
    .flatMap(({ spans }) => spans.filter(({ kind }) => kind === "literal"));
  assert.ok(citedLiterals.length >= 1 && citedLiterals.length <= 24);
  for (let index = 0; index < 49; index += 1) {
    assert.ok(citedLiterals.some(({ text }) => text.includes(`q_${String(index).padStart(2, "0")}`)));
  }
  assert.ok(batches.every((batch) => (
    latticeSourceSpansForBatch(batch).flatMap(({ spans }) => spans.filter(({ kind }) => kind === "literal")).length <= 24
  )));
  const result = await runTextToLattice(source, {
    adapter: scriptedAdapter({
      analyze(request) {
        const analysis = rawAnalysisWithAtomCount(request, 24);
        analysis.passages = analysis.passages.map((plan) => {
          const sourcePassage = request.batch.passages.find(({ id }) => id === plan.passageId);
          if (sourcePassage.text.replace(/`[^`]*`/gu, "").trim()) return plan;
          const spans = request.sourceSpans.find(({ passageId }) => passageId === plan.passageId).spans;
          return {
            ...plan,
            disposition: "retain-if-conformant",
            conformanceCriteria: requiredConformanceCriteria(plan.layer),
            conformanceEvidenceSpanIds: spans.map(({ id }) => id),
            conformanceAssertions: requiredConformanceCriteria(plan.layer).map((criterion) => ({
              criterion,
              evidenceSpanIds: spans.map(({ id }) => id),
            })),
          };
        });
        return analysis;
      },
    }),
  });
  assert.equal(result.status, "translated");
});

test("mixed exact literals compact without permitting a boundary inside a full-source literal", () => {
  const unit = "<b>`!`[!](#)";
  const source = Array.from({ length: 700 }, () => unit).join(" ");
  const preflight = preflightLatticeInput(source);
  assert.equal(preflight.wordCount, 700);
  assert.ok(preflight.batches.length <= 32);
  const literalTexts = ["<b>", "`!`", "[!](#)"];
  for (let cursor = 0; cursor < source.length;) {
    const unitStart = source.indexOf(unit, cursor);
    if (unitStart < 0) break;
    let literalCursor = unitStart;
    for (const literal of literalTexts) {
      const start = source.indexOf(literal, literalCursor);
      const end = start + literal.length;
      const containers = preflight.passages.filter((passage) => (
        passage.startUtf16 <= start && passage.endUtf16 >= end
      ));
      assert.equal(containers.length, 1, `${literal} at ${start}`);
      assert.equal(source.slice(start, end), literal);
      literalCursor = end;
    }
    cursor = unitStart + unit.length;
  }
  assert.ok(preflight.passages.every(({ text }) => (text.match(/`/gu)?.length ?? 0) % 2 === 0));
});

test("wordless combining separators cannot multiply alternating exact-literal work groups", () => {
  const source = Array.from({ length: 1_200 }, (_, index) => (
    `${index % 24 === 0 ? "w " : ""}${index % 2 === 0 ? "<!---->" : "`!`"}\u0301`
  )).join("");
  assert.equal(source.length, 7_300);
  assert.equal(countLatticeWords(source), 50);
  const preflight = preflightLatticeInput(source);
  assert.ok(preflight.passages.length <= LATTICE_PASSAGE_LIMIT);
  assert.ok(preflight.batches.length <= 32);
  assert.ok(preflight.passages.every(({ text }) => (text.match(/`/gu)?.length ?? 0) % 2 === 0));
});

test("the local JSON parser accepts only Qwen's exact empty-thinking prefix", () => {
  const expected = { k: 1 };
  assert.deepEqual(
    parseLocalLatticeJsonObject(`<think>\n\n</think>\n\n${JSON.stringify(expected)}`),
    expected,
  );
  assert.throws(() => parseLocalLatticeJsonObject(`<think>x</think>${JSON.stringify(expected)}`), SyntaxError);
  assert.throws(() => parseLocalLatticeJsonObject(`~~~${JSON.stringify(expected)}~~~`), SyntaxError);
});

test("each compact schema guide identifies its binding root shape", () => {
  for (const schema of [ANALYSIS_SCHEMA, REANALYSIS_SCHEMA, CANDIDATE_SCHEMA, VERIFICATION_SCHEMA]) {
    const guide = LATTICE_SCHEMA_GUIDES.get(schema);
    assert.equal(typeof guide, "string");
    assert.ok(guide.length < 1_000);
    for (const key of schema.required) assert.ok(guide.includes(key), `schema guide omitted root key ${key}`);
    assert.ok(collectSchemaEnums(schema).size > 0);
  }
});

test("materiality rejects presentation-only edits and admits a real lexical or syntactic change", () => {
  const source = opaqueWords(20);
  const presentationOnly = source.split(" ").join(" \n  ");
  const oneToken = source.split(" ");
  oneToken[9] = "v0009";
  const threshold = source.split(" ");
  threshold[3] = "v0003";
  threshold[9] = "v0009";
  threshold[15] = "v000f";
  assert.equal(materiallyDifferent(source, presentationOnly), false);
  assert.equal(materiallyDifferent(source, oneToken.join(" ")), true);
  assert.equal(materiallyDifferent(source, threshold.join(" ")), true);
  assert.equal(materiallyDifferent("We don’t pause here.", "we don't pause here"), false);
  assert.equal(materiallyDifferent("Straße remains open.", "STRASSE REMAINS OPEN."), false);
  assert.equal(materiallyDifferent("İstanbul remains open.", "istanbul remains open."), false);
  assert.equal(materiallyDifferent("co\u00ADoperate here", "cooperate here"), false);
  assert.equal(materiallyDifferent("section·name remains", "section・name remains"), false);
  assert.equal(materiallyDifferent("well-being remains", "well being remains"), false);
  assert.equal(materiallyDifferent("co-operate now", "cooperate now"), false);
  assert.equal(materiallyDifferent("we’ll proceed", "weʼll proceed"), false);
  assert.equal(materiallyDifferent("Stable markers remain.", "* Stable markers remain."), false);
  assert.equal(materiallyDifferent("Stable markers remain.", "> Stable markers remain."), false);
  assert.equal(materiallyDifferent("Stable markers remain.", "Stable markers remain:"), false);
  assert.equal(materiallyDifferent("Route marker ✈ remains.", "Route marker ✈️ remains."), false);
  assert.equal(materiallyDifferent("Route marker ✈️ remains.", "Route marker ✈ remains."), false);
  assert.equal(materiallyDifferent("Alpha beta", "Ⓐⓛⓟⓗⓐ ⓑⓔⓣⓐ"), false);
  assert.equal(materiallyDifferent("Alpha beta", "A⃝l⃝p⃝h⃝a⃝ b⃝e⃝t⃝a⃝"), false);
  assert.equal(materiallyDifferent("Alpha beta", "A̶l̶p̶h̶a̶ b̶e̶t̶a̶"), false);
  for (const [left, right] of [
    ["Alpha", "Al\u034Fpha"],
    ["café", "cafe\u034F\u0301"],
    ["ᠠ", "ᠠ\u180B"],
    ["ក", "ក\u17B4"],
    ["가", "가\u115F"],
    ["1", "1\uFE0F\u20E3"],
  ]) {
    assert.equal(materiallyDifferent(left, right), false, `${left} -> ${right}`);
    assert.equal(materiallyDifferent(right, left), false, `${right} -> ${left}`);
  }
  for (const [left, right] of [
    ["ano", "año"],
    ["كتب", "كَتب"],
    ["ספר", "סֵפר"],
    ["क", "कि"],
    ["は", "は\u3099"],
    ["x", "x\u20D7"],
  ]) {
    assert.equal(materiallyDifferent(left, right), true, `${left} -> ${right}`);
    assert.equal(materiallyDifferent(right, left), true, `${right} -> ${left}`);
  }
  for (const mark of ["\u0305", "\u0332", "\u0333", "\u0334", "\u0335", "\u0336", "\u0337", "\u0338", "\u033F",
    "\u20D2", "\u20D3", "\u20DD", "\u20DE", "\u20DF", "\u20E0", "\u20E2", "\u20E3", "\u20E4", "\u20E5", "\u20E6", "\u20EB"]) {
    const decorated = [..."Alpha beta"].map((character) => character === " " ? character : `${character}${mark}`).join("");
    assert.equal(materiallyDifferent("Alpha beta", decorated), false,
      `added presentation mark U+${mark.codePointAt(0).toString(16).toUpperCase()}`);
    assert.equal(materiallyDifferent(decorated, "Alpha beta"), false,
      `removed presentation mark U+${mark.codePointAt(0).toString(16).toUpperCase()}`);
  }
  assert.deepEqual(deterministicDocumentReview("Stable markers remain.", "* Stable markers remain."), []);
  assert.deepEqual(deterministicDocumentReview("Stable markers remain.", "> Stable markers remain."), []);
  assert.deepEqual(deterministicDocumentReview("Stable markers remain.", "Stable markers remain:"), []);
  assert.deepEqual(deterministicDocumentReview("Route marker ✈ remains.", "Route marker ✈️ remains."), []);
  for (const [left, right] of [
    ["Set x < y.", "Set x > y."],
    ["Charge = 5 units.", "Charge ≠ 5 units."],
    ["Use x <= y.", "Use x ≤ y."],
    ["Use x - y.", "Use x − y."],
    ["Open the gate.", "Open *the* gate."],
    ["Open the gate.", "**Open the gate.**"],
    ["Open the gate.", "Open ~the~ gate."],
    ["Open the gate.", "Open /the/ gate."],
    ["Open the gate.", "Open |the| gate."],
    ["Open the gate.", "Open &the& gate."],
    ["Open the gate.", "Open +the+ gate."],
    ["Open the gate.", "Open =the= gate."],
    ["Open the gate.", "Open ^the^ gate."],
    ["Open the gate.", "Open %the% gate."],
    ["Open the gate.", "Open ::the:: gate."],
    ["Open the gate.", "Open_the_gate."],
    ["Open the gate.", "'Open the gate."],
    ["Open the gate.", "Open the gate.'"],
    ["Open the gate.", "'Open the gate.'"],
    ["Open the gate.", "''Open the gate.''"],
    ["Open the gate.", "´Open the gate.´"],
    ["Open the gate.", "¨Open the gate.¨"],
    ["Open the gate.", "¯Open the gate.¯"],
    ["Open the gate.", "´Open the gate.´"],
    ["Open the gate.", "‾Open the gate.‾"],
    ["Open the gate.", "™Open the gate.™"],
    ["Open the gate.", "ⒶOpen the gate.Ⓐ"],
  ]) {
    for (const [sourceValue, candidateValue] of [[left, right], [right, left]]) {
      assert.equal(materiallyDifferent(sourceValue, candidateValue), false,
        `${sourceValue} -> ${candidateValue}`);
      assert.deepEqual(deterministicDocumentReview(sourceValue, candidateValue), [],
        `${sourceValue} -> ${candidateValue}`);
    }
  }
  let presentationMarkCount = 0;
  let defaultIgnorableCount = 0;
  for (let codePoint = 0; codePoint <= 0x10ffff; codePoint += 1) {
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) continue;
    const mark = String.fromCodePoint(codePoint);
    if (/[\p{P}\p{S}]/u.test(mark)) {
      presentationMarkCount += 1;
      for (const [sourceValue, candidateValue] of [
        ["Stable wording remains.", `Sta${mark}ble wording remains.`],
        [`Sta${mark}ble wording remains.`, "Stable wording remains."],
      ]) {
        assert.equal(materiallyDifferent(sourceValue, candidateValue), false,
          `presentation-only U+${codePoint.toString(16).toUpperCase()}: ${sourceValue} -> ${candidateValue}`);
      }
    }
    if (/\p{Default_Ignorable_Code_Point}/u.test(mark)) {
      defaultIgnorableCount += 1;
      for (const [sourceValue, candidateValue] of [
        ["Stable wording remains.", `Sta${mark}ble wording remains.`],
        [`Sta${mark}ble wording remains.`, "Stable wording remains."],
      ]) {
        assert.equal(materiallyDifferent(sourceValue, candidateValue), false,
          `default-ignorable U+${codePoint.toString(16).toUpperCase()}: ${sourceValue} -> ${candidateValue}`);
      }
    }
  }
  assert.ok(presentationMarkCount > 9_000);
  assert.equal(defaultIgnorableCount, 4_174);
  for (const [left, right] of [
    ["Open the stable gate.", "Open the sta™ble gate!"],
    ["Open the stable gate.", "Open the sta★ble gate"],
    ["Open the stable gate:", "Open the sta*ble gate."],
    ["Open (the) stable gate.", "Open the sta™ble gate."],
  ]) {
    for (const [sourceValue, candidateValue] of [[left, right], [right, left]]) {
      assert.equal(materiallyDifferent(sourceValue, candidateValue), false,
        `${sourceValue} -> ${candidateValue}`);
      assert.deepEqual(deterministicDocumentReview(sourceValue, candidateValue), [],
        `${sourceValue} -> ${candidateValue}`);
    }
  }
  assert.equal(materiallyDifferent("Area is m².", "Area is m2."), true);
  assert.equal(materiallyDifferent("Route A/B.", "Route C+B."), true);
  assert.equal(materiallyDifferent("therapist", "the rapist"), true);
  for (const [left, right] of [
    ["we'll proceed", "well proceed"],
    ["can't proceed", "cant proceed"],
    ["Set x-y.", "Set xy."],
    ["Set x−y.", "Set xy."],
    ["Use x*y.", "Use xy."],
    ["Keep A:B.", "Keep AB."],
    ["re-sign the form", "resign the form"],
    ["resign", "re-sign"],
    ["recover", "re-cover"],
    ["unionized", "un-ionized"],
    ["therapist", "the-rapist"],
    ["cannot", "can-not"],
  ]) {
    assert.equal(materiallyDifferent(left, right), false, `${left} -> ${right}`);
    assert.equal(materiallyDifferent(right, left), false, `${right} -> ${left}`);
  }
  assert.equal(materiallyDifferent("resign", "re sign"), true);
  assert.equal(materiallyDifferent("cannot", "can not"), true);
  assert.equal(materiallyDifferent("i remains", "ı remains"), true);
  assert.equal(materiallyDifferent("Alpha follows Beta.", "Beta follows Alpha."), true);
  assert.equal(materiallyDifferent("Stable markers remain.", "* Durable markers remain."), true);
  assert.equal(materiallyDifferent("Alpha follows Beta.", "Beta follows Alpha:"), true);
  assert.equal(materiallyDifferent("Route marker ✈ remains.", "Route marker ✈️ changed."), true);
  for (const length of [5, 20, 36]) {
    const words = opaqueWords(length).split(" ");
    const changed = [...words];
    changed[Math.floor(length / 2)] = `v${length}`;
    assert.equal(materiallyDifferent(words.join(" "), changed.join(" ")), true);
  }
});

test("question speech acts cannot move between unchanged propositions", () => {
  const source = "Alpha? Beta.";
  const candidate = "Alpha. Beta?";
  assert.ok(deterministicDocumentReview(source, candidate)
    .some(({ id }) => id === "document-speech-act"));
  assert.ok(deterministicPassageReview(
    { id: "p1", text: source, wordCount: 2 },
    { layer: "interpretive", disposition: "rewrite", atoms: [] },
    { text: candidate, layer: "interpretive", preservedAtomIds: [] },
  ).some(({ id }) => id === "candidate-speech-act"));
  assert.ok(deterministicDocumentReview("Really?!", "Really.")
    .some(({ id }) => id === "document-speech-act"));
  assert.equal(deterministicDocumentReview("هل وصل؟", "هل وصل?")
    .some(({ id }) => id === "document-speech-act"), false);
  assert.equal(deterministicDocumentReview(
    "Does https://x.invalid/?q=1 work?",
    "Will https://x.invalid/?q=1 work?",
  ).some(({ id }) => id === "document-speech-act"), false);
});

test("direction-isolate controls are deterministic preservation boundaries", () => {
  assert.ok(deterministicDocumentReview("Anchor remains.", "Marker\u2066 remains.")
    .some(({ id }) => id === "document-bidi-isolates"));
  assert.ok(deterministicDocumentReview("word\u2066term\u2069 remains", "word term changes")
    .some(({ id }) => id === "document-bidi-sequence"));
  assert.ok(deterministicDocumentReview("A \u2066B\u2069 C", "A B \u2066C\u2069")
    .some(({ id }) => id === "document-bidi-sequence"));
});

test("generated boundary-size inputs reach atomization, material generation, and verification", async () => {
  for (const wordCount of [1, 5, 6, 13, 14, 36, 37, LATTICE_WORD_LIMIT]) {
    const adapter = scriptedAdapter();
    const source = opaqueWords(wordCount);
    const result = await runTextToLattice(source, { adapter });
    assert.equal(result.status, "translated", `word count ${wordCount}`);
    assert.ok(result.revisedPassageCount > 0, `word count ${wordCount}`);
    assert.notEqual(result.text, source, `word count ${wordCount}`);
    assert.ok(adapter.calls.analyze > 0, `word count ${wordCount}`);
    assert.equal(adapter.calls.generate, adapter.calls.analyze, `word count ${wordCount}`);
    assert.equal(adapter.calls.verify, adapter.calls.analyze, `word count ${wordCount}`);
  }
});

test("zero-word punctuation runs cannot expand model work", async () => {
  const source = `u${".\n".repeat(24_999)}`;
  const adapter = scriptedAdapter();
  const started = performance.now();
  await assert.rejects(() => runTextToLattice(source, { adapter }), RangeError);
  const elapsed = performance.now() - started;
  assert.deepEqual(adapter.calls, { analyze: 0, generate: 0, verify: 0, repair: 0 });
  assert.ok(elapsed < 1_000, `bounded punctuation preprocessing took ${elapsed.toFixed(1)}ms`);
});

test("seven hundred one-word lines coalesce without rejecting valid text", async () => {
  const source = Array.from({ length: LATTICE_WORD_LIMIT }, (_, index) => `u${index.toString(36)}`).join("\n");
  const adapter = scriptedAdapter();
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.ok(result.passageCount < LATTICE_WORD_LIMIT / 4);
  assert.ok(adapter.calls.analyze < 30);
});

test("seven hundred paragraph boundaries compact losslessly within the passage ceiling", async () => {
  const words = Array.from({ length: LATTICE_WORD_LIMIT }, (_, index) => `u${index.toString(36)}`);
  for (const separator of ["\n\n", "\r\n\r\n", "\u2029"]) {
    const source = words.join(separator);
    const preflight = preflightLatticeInput(source);
    assert.ok(preflight.passages.length <= LATTICE_PASSAGE_LIMIT);
    assert.ok(preflight.batches.length <= 32);
    assert.equal(reassembleLatticeSource(
      source,
      preflight.passages,
      new Map(preflight.passages.map((passage) => [passage.id, passage.text])),
    ), source);
  }

  const source = words.join("\n\n");
  const adapter = scriptedAdapter();
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.equal(result.text.match(/\n\n/gu)?.length, LATTICE_WORD_LIMIT - 1);
});

test("internal paragraph boundaries remain a host-enforced invariant after compaction", async () => {
  const source = Array.from(
    { length: LATTICE_WORD_LIMIT },
    (_, index) => `u${index.toString(36)}`,
  ).join("\n\n");
  assert.ok(deterministicDocumentReview(source, source.replace(/\n+/gu, " "))
    .some(({ id }) => id === "document-boundaries"));

  let certificationCalls = 0;
  const collapseBoundaries = (request) => ({
    passages: rawCandidate(request).passages.map((passage) => ({
      ...passage,
      text: passage.text.replace(/\r\n|\r|\n|\u2028|\u2029/gu, " "),
    })),
  });
  const result = await runTextToLattice(source, {
    adapter: scriptedAdapter({
      generate: collapseBoundaries,
      repair: collapseBoundaries,
      certify() {
        certificationCalls += 1;
      },
    }),
  });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assertCandidateWithheld(result);
  assert.equal(certificationCalls, 0);
});

test("unchanged unique language cannot cross a structural boundary", async () => {
  const source = "Anchor waits here.\nMarker leaves soon.";
  const candidate = "Marker stays here.\nAnchor exits soon.";
  assert.ok(deterministicDocumentReview(source, candidate)
    .some(({ id }) => id === "document-boundary-anchor"));

  const relocatedCandidate = (request) => ({
    passages: request.batch.passages.map((passage, index) => ({
      passageId: passage.id,
      layer: request.analysis.passages[index].layer,
      text: index === 0 ? "Marker stays here." : "Anchor exits soon.",
      preservedAtomIds: request.analysis.passages[index].atoms.map(({ id }) => id),
    })),
  });
  let certificationCalls = 0;
  const result = await runTextToLattice(source, {
    adapter: scriptedAdapter({
      generate: relocatedCandidate,
      repair: relocatedCandidate,
      certify() { certificationCalls += 1; },
    }),
  });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assertCandidateWithheld(result);
  assert.equal(certificationCalls, 0);
});

test("length-changing rewrites retain shared unique language on its original boundary side", () => {
  const source = "Anchor waits here.\nMarker leaves soon.";
  const candidate = "Anchor still waits right here.\nMarker now leaves very soon.";
  assert.equal(materiallyDifferent(source, candidate), true);
  assert.deepEqual(deterministicDocumentReview(source, candidate), []);
});

test("an exact literal cannot move across an internal structural boundary", () => {
  const source = "Visit https://a.invalid now.\nLeave later.";
  const candidate = "Visit now.\nLeave https://a.invalid later.";
  assert.ok(deterministicDocumentReview(source, candidate)
    .some(({ id }) => id === "deterministic-url-boundary"));
});

test("maximum unique line and paragraph boundaries remain bounded and linear", () => {
  const words = Array.from({ length: LATTICE_WORD_LIMIT }, (_, index) => `u${index.toString(36)}`);
  const started = performance.now();
  for (const separator of ["\n", "\n\n", "\r\n", "\u2029"]) {
    const source = words.join(separator);
    const candidate = words.map((word) => `${word} stays`).join(separator);
    const preflight = preflightLatticeInput(source);
    assert.ok(preflight.passages.length <= LATTICE_PASSAGE_LIMIT);
    assert.ok(preflight.batches.length <= 32);
    assert.deepEqual(deterministicDocumentReview(source, candidate), []);
  }
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 3_000, `maximum boundary validation took ${elapsed.toFixed(1)}ms`);
});

test("semantic boundary relocation fails closed when surface anchors cannot decide", async (context) => {
  const source = "Alpha waits here.\nBeta departs soon.";
  const swappedCandidate = (request) => ({
    passages: request.batch.passages.map((passage, index) => ({
      passageId: passage.id,
      layer: request.analysis.passages[index].layer,
      text: index === 0 ? "The second traveler leaves shortly." : "The first traveler remains nearby.",
      preservedAtomIds: request.analysis.passages[index].atoms.map(({ id }) => id),
    })),
  });
  const assembled = "The second traveler leaves shortly.\nThe first traveler remains nearby.";
  assert.deepEqual(deterministicDocumentReview(source, assembled), []);

  await context.test("verifier rejection", async () => {
    const result = await runTextToLattice(source, {
      adapter: scriptedAdapter({
        generate: swappedCandidate,
        repair: swappedCandidate,
        verify(request) {
          return rawVerification(request, { passage: { boundaryFidelity: false } });
        },
      }),
    });
    assert.equal(result.status, "unable-to-attempt");
    assert.equal(result.text, null);
    assertCandidateWithheld(result);
  });

  await context.test("document certification rejection", async () => {
    const candidateOnlyMarker = "ZXQLEAK471";
    const result = await runTextToLattice(source, {
      adapter: scriptedAdapter({
        generate: swappedCandidate,
        certify(request) {
          return {
            certificateId: request.certificateId,
            obligationIds: request.obligationIds,
            decision: "reject",
            checks: Object.fromEntries(LATTICE_DOCUMENT_CERTIFICATION_CHECKS.map((name) => [
              name,
              name !== "boundaryFidelity",
            ])),
            issues: [{ id: candidateOnlyMarker, check: "boundaryFidelity", message: candidateOnlyMarker }],
          };
        },
      }),
    });
    assert.equal(result.status, "unable-to-attempt");
    assert.equal(result.text, null);
    assertCandidateWithheld(result);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(candidateOnlyMarker, "u"));
  });
});

test("wordless source ranges stay exact and require affirmative document certification", async (context) => {
  const prefix = "☢".repeat(900);
  const source = `${prefix} Proceed through the marked entrance.`;
  const segmented = segmentLatticeSource(source);
  const protectedPassages = segmented.filter(({ protected: exact }) => exact === true);
  assert.ok(protectedPassages.length > 1);
  const [semanticBatch] = batchLatticePassages(segmented);
  const semanticContext = contextPassagesForBatch(segmented, semanticBatch);
  assert.deepEqual(
    semanticContext.protectedBefore.map(({ passageId }) => passageId),
    protectedPassages.map(({ id }) => id),
  );
  assert.ok(semanticContext.protectedBefore.every(({ excerpt, protectedExact }) => (
    protectedExact === true && excerpt.length > 0
  )));

  await context.test("accepted", async () => {
    let certificationSource = "";
    const result = await runTextToLattice(source, {
      adapter: scriptedAdapter({ certify(request) { certificationSource = request.source; } }),
    });
    assert.equal(result.status, "translated");
    assert.ok(result.text.startsWith(prefix));
    assert.equal(certificationSource, source);
  });

  await context.test("rejected", async () => {
    const result = await runTextToLattice(source, {
      adapter: scriptedAdapter({
        certify(request) {
          return {
            certificateId: request.certificateId,
            obligationIds: request.obligationIds,
            decision: "reject",
            checks: Object.fromEntries(LATTICE_DOCUMENT_CERTIFICATION_CHECKS.map((name) => (
              [name, name !== "semanticFidelity"]
            ))),
            issues: [{ id: "symbol_scope", check: "semanticFidelity", message: "symbol_scope" }],
          };
        },
      }),
    });
    assert.equal(result.status, "unable-to-attempt");
    assert.equal(result.text, null);
  });

  await context.test("window fallback receives every consecutive protected unit", async () => {
    const windows = [];
    const result = await runTextToLattice(source, {
      adapter: scriptedAdapter({
        certify(request) {
          if (request.scope !== "window") {
            const error = new Error("flat_context");
            error.code = "lattice-context";
            throw error;
          }
          windows.push(request);
        },
      }),
    });
    assert.equal(result.status, "translated");
    const semanticWindow = windows.find(({ window }) => window.passageId === semanticBatch.passages[0].id);
    assert.ok(semanticWindow);
    assert.deepEqual(
      semanticWindow.context.protectedBefore.map(({ passageId }) => passageId),
      protectedPassages.map(({ id }) => id),
    );
    assert.ok(semanticWindow.context.protectedBefore.every(({ protectedExact, exactText, ...rest }) => (
      protectedExact === true && exactText.length > 0
      && !Object.hasOwn(rest, "sourceExcerpt") && !Object.hasOwn(rest, "candidateExcerpt")
    )));
  });
});

test("verification bounds long protected context with host-attested exact windows", async () => {
  const symbols = Array.from({ length: 500 }, (_, index) => (
    String.fromCodePoint(0x2200 + (index % 0x100))
  )).join("");
  const source = `${symbols}\n\nAnchor remains stable.`;
  let verificationRequest = null;
  const result = await runTextToLattice(source, {
    adapter: scriptedAdapter({
      verify(request) {
        verificationRequest = request;
        return rawVerification(request);
      },
    }),
  });
  assert.equal(result.status, "translated");
  assert.ok(verificationRequest);

  const payload = inertModelPayload(verificationMessages(verificationRequest));
  assert.equal(Object.hasOwn(payload, "context"), false);
  assert.ok(payload.assembledContext);
  const protectedEntries = [
    ...(payload.assembledContext.protectedBefore ?? []),
    ...(payload.assembledContext.protectedAfter ?? []),
  ];
  assert.equal(protectedEntries.reduce((sum, entry) => (
    sum + (entry.exactText?.length ?? entry.hostAttestedExact?.[0] ?? 0)
  ), 0), symbols.length);
  assert.ok(protectedEntries.filter(({ exactText }) => typeof exactText === "string").length <= 2);
  assert.ok(protectedEntries.every((entry) => {
    assert.equal(Object.hasOwn(entry, "sourceExcerpt"), false);
    assert.equal(Object.hasOwn(entry, "candidateExcerpt"), false);
    assert.equal(Object.hasOwn(entry, "excerpt"), false);
    return entry.protectedExact === true
      && (typeof entry.exactText === "string" || entry.hostAttestedExact?.length === 3);
  }));
  const serializedPayload = JSON.stringify(payload);
  assert.ok([...serializedPayload].filter((character) => (
    character.codePointAt(0) >= 0x2200 && character.codePointAt(0) <= 0x22ff
  )).length <= 420);
});

test("work stays bounded at the public word ceiling", async () => {
  const source = Array.from({ length: LATTICE_PASSAGE_LIMIT + 1 }, (_, index) => `u${index.toString(36)}`).join("\n\n");
  const adapter = scriptedAdapter();
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.ok(result.passageCount <= LATTICE_PASSAGE_LIMIT);
  assert.ok(result.batchCount <= 32);
});

test("an initial thirty-two-group source may safely split to a thirty-third execution group", async () => {
  const head = Array.from({ length: 480 }, () => "`!`").join("a ");
  const tail = Array.from({ length: 24 }, () => `z${"~".repeat(380)}`).join("\n\n");
  const source = `${head}\n\n${tail}`;
  const preflight = preflightLatticeInput(source);
  assert.equal(source.length, 11_590);
  assert.equal(preflight.wordCount, 503);
  assert.equal(preflight.batches.length, 32);

  const completeAnalysis = (request) => {
    let atomSerial = 0;
    return {
      documentKind: "other",
      passages: request.batch.passages.map((passage) => {
        const group = request.sourceSpans.find(({ passageId }) => passageId === passage.id);
        const evidence = [...group.spans, ...(group.literalAnnotations ?? [])];
        const atoms = [];
        for (let index = 0; index < evidence.length; index += 3) {
          const selected = evidence.slice(index, index + 3);
          atomSerial += 1;
          atoms.push({
            id: `a${atomSerial}`,
            kind: "state",
            value: `v${atomSerial}`,
            priority: atomSerial === 1 ? "hard" : "semantic",
            preservation: selected.every(({ kind }) => kind === "literal") ? "exact" : "equivalent",
            evidenceSpanIds: selected.map(({ id }) => id),
            links: [],
          });
        }
        return {
          passageId: passage.id,
          discourseFunction: "states bounded source content",
          layer: "interpretive",
          disposition: "rewrite",
          rationale: "make the stated content directly legible",
          atoms,
          ambiguityAtomIds: [],
          conformanceCriteria: [],
          conformanceEvidenceSpanIds: [],
          conformanceAssertions: [],
        };
      }),
      questions: [],
    };
  };
  const adapter = scriptedAdapter({
    analyze(request, count) {
      if (request.batch.id === "b001" && count <= 2) throw new SyntaxError("synthetic retryable parent failure");
      return completeAnalysis(request);
    },
  });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.equal(result.passageCount, 45);
  assert.equal(result.batchCount, 33);
  assert.ok(result.batchCount <= LATTICE_EXECUTION_BATCH_LIMIT);
  assert.equal(8 * LATTICE_EXECUTION_BATCH_LIMIT, LATTICE_COMPLETION_CALL_LIMIT);
});

test("tiny adjacent lines coalesce into bounded model work while admitting twenty-four atoms", async () => {
  const source = Array.from({ length: 12 }, (_, index) => `u${String.fromCharCode(97 + index)}`).join("\n");
  const admittedAtoms = [];
  const adapter = scriptedAdapter({
    analyze(request) { return rawAnalysisWithAtomCount(request, 24); },
    generate(request) {
      admittedAtoms.push(request.analysis.passages.reduce((sum, passage) => sum + passage.atoms.length, 0));
      return rawCandidate(request);
    },
  });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.equal(result.batchCount, 1);
  assert.equal(result.passageCount, 1);
  assert.deepEqual(admittedAtoms, [24]);
});

test("the twenty-four-atom batch limit is enforced before generation", async () => {
  const source = Array.from({ length: 12 }, (_, index) => `u${String.fromCharCode(97 + index)}`).join("\n");
  const adapter = scriptedAdapter({ analyze(request) { return rawAnalysisWithAtomCount(request, 25); } });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.ok(adapter.calls.analyze > 2 && adapter.calls.analyze <= 64);
  assert.equal(adapter.calls.generate, 0);
});

test("passage-local planning can select multiple registers in one generated document", async () => {
  const source = [fixedPassage("u"), fixedPassage("u"), fixedPassage("u")].join("\n");
  const layers = ["interpretive", "operative", "experiential"];
  const result = await runTextToLattice(source, {
    adapter: scriptedAdapter({
      analyze(request) {
        const analysis = rawAnalysis(request);
        analysis.passages = analysis.passages.map((passage) => ({
          ...passage,
          layer: layers[Number.parseInt(passage.passageId.slice(1), 10) - 1],
        }));
        return analysis;
      },
    }),
  });
  assert.equal(result.status, "translated");
  assert.deepEqual(new Set(result.layersUsed), new Set(["interpretive", "operative", "experiential"]));
});

test("analyzer clarification is returned before generation", async () => {
  const adapter = scriptedAdapter({ analysisOptions: { question: true } });
  const result = await runTextToLattice(opaqueWords(9), { adapter });
  assert.equal(result.status, "needs-clarification");
  assert.equal(result.text, null);
  assert.equal(result.questions.length, 1);
  assert.match(result.questions[0].id, /^analysis:/u);
  assert.equal(adapter.calls.generate, 0);
});

test("clarification questions bind to declared ambiguity evidence", async (context) => {
  const invalidGraphs = [
    ["declared non-ambiguity", (analysis) => { analysis.passages[0].atoms[0].kind = "state"; }],
    ["undeclared affected ambiguity", (analysis) => { analysis.passages[0].ambiguityAtomIds = []; }],
    ["wrong-kind affected atom", (analysis) => {
      analysis.questions[0].affectedAtomIds = [analysis.passages[0].atoms[1].id];
    }],
  ];
  for (const [name, mutate] of invalidGraphs) {
    await context.test(name, async () => {
      const adapter = scriptedAdapter({
        analyze(request, count) {
          const analysis = rawAnalysis(request, { question: true });
          if (count === 1) mutate(analysis);
          return analysis;
        },
      });
      const result = await runTextToLattice(opaqueWords(9), { adapter });
      assert.equal(result.status, "needs-clarification");
      assert.equal(adapter.calls.analyze, 2);
      assert.equal(adapter.calls.generate, 0);
    });
  }

  const source = "alpha ambiguity remains unresolved within this clause while departure timing stays unclear tomorrow";
  const unrelated = scriptedAdapter({
    analyze(request, count) {
      const analysis = rawAnalysis(request, { question: true });
      analysis.questions[0].prompt = count === 1 ? "Which departure timing applies?" : "Which reading applies?";
      return analysis;
    },
  });
  const result = await runTextToLattice(source, { adapter: unrelated });
  assert.equal(result.status, "needs-clarification");
  assert.equal(result.questions[0].prompt, "Which reading applies?");
  assert.equal(unrelated.calls.analyze, 2);
});

test("clarification copy is singular, short, direct, and free of implementation language", async () => {
  const invalidMutations = [
    (analysis) => { analysis.questions[0].prompt = "Which schema applies?"; },
    (analysis) => { analysis.questions[0].prompt = `${"x".repeat(160)}?`; },
    (analysis) => { analysis.questions[0].prompt = "Which reading\napplies?"; },
    (analysis) => { analysis.questions[0].prompt = "Which reading applies."; },
    (analysis) => { analysis.questions[0].prompt = "Which reading applies? What did you mean?"; },
    (analysis) => { analysis.questions[0].options = [{ id: "o1", label: "Use the model choice" }]; },
    (analysis) => { analysis.questions[0].prompt = "Which mo\u200Ddel should govern this reading?"; },
    (analysis) => { analysis.questions[0].options = [{ id: "o1", label: "Use the first sche\u200Dma" }]; },
    (analysis) => { analysis.questions[0].prompt = "Which mo\u034Fdel should govern this reading?"; },
    (analysis) => { analysis.questions[0].prompt = "Which mo\u061Cdel should govern this reading?"; },
    (analysis) => { analysis.questions[0].prompt = "Which mo\u2060del should govern this reading?"; },
    (analysis) => { analysis.questions[0].prompt = "Which mode\uFE0Fl should govern this reading?"; },
    (analysis) => { analysis.questions[0].prompt = "Which mode\u{E0100}l should govern this reading?"; },
    (analysis) => { analysis.questions[0].prompt = "Which mo\u0336del should govern this reading?"; },
    (analysis) => { analysis.questions[0].prompt = "Which m.o.d.e.l should govern this reading?"; },
    (analysis) => { analysis.questions[0].prompt = "Which mo™del should govern this reading?"; },
    (analysis) => { analysis.questions[0].prompt = "Which ⓜⓞⓓⓔⓛ should govern this reading?"; },
    (analysis) => { analysis.questions[0].prompt = "Which a.t.o.m should govern this reading?"; },
    (analysis) => { analysis.questions[0].prompt = "Which i.d. should govern this reading?"; },
    (analysis) => { analysis.questions[0].prompt = "Which g\u20DDate should govern this reading?"; },
    (analysis) => { analysis.questions[0].options = [{ id: "o1", label: "Use the c\u20DDandidate choice" }]; },
    (analysis) => { analysis.questions[0].options = [{ id: "o1", label: "Use the ver-ifier choice" }]; },
    (analysis) => { analysis.questions[0].options = [{ id: "o1", label: "a ".repeat(33).trim() }]; },
    (analysis) => {
      analysis.questions.push({ ...analysis.questions[0], id: "q2", prompt: "Which reading applies?" });
    },
  ];
  for (const mutate of invalidMutations) {
    const adapter = scriptedAdapter({
      analyze(request, count) {
        const analysis = rawAnalysis(request, { question: true });
        analysis.questions[0].prompt = "Which reading applies?";
        if (count === 1) mutate(analysis);
        return analysis;
      },
    });
    const result = await runTextToLattice(opaqueWords(9), { adapter });
    assert.equal(result.status, "needs-clarification");
    assert.equal(result.questions.length, 1);
    assert.equal(result.questions[0].prompt, "Which reading applies?");
    assert.equal(adapter.calls.analyze, 2);
    assert.equal(adapter.calls.generate, 0);
  }

  const multiBatch = scriptedAdapter({ analysisOptions: { question: true } });
  const multiResult = await runTextToLattice(opaqueWords(90), { adapter: multiBatch });
  assert.equal(multiResult.status, "needs-clarification");
  assert.equal(multiResult.questions.length, 1);

  const disguisedTechnicalTerm = scriptedAdapter({
    analyze(request, count) {
      const analysis = rawAnalysis(request, { question: true });
      analysis.questions[0].prompt = count === 1
        ? "Which alpha ᴍᴏᴅᴇʟ should govern?"
        : "Which reading applies?";
      return analysis;
    },
  });
  const disguisedResult = await runTextToLattice("Alpha is ambiguous.", { adapter: disguisedTechnicalTerm });
  assert.equal(disguisedResult.status, "needs-clarification");
  assert.equal(disguisedResult.questions[0].prompt, "Which reading applies?");
  assert.equal(disguisedTechnicalTerm.calls.analyze, 2);
});

test("source-grounded domain terms remain available in clarification questions", async () => {
  const source = "The note leaves the scientific model and political candidate unspecified.";
  const prompt = "Which scientific model or political candidate is meant?";
  const options = [
    { id: "model", label: "Use the scientific model" },
    { id: "candidate", label: "Use the political candidate" },
  ];
  const analyzerResult = await runTextToLattice(source, {
    adapter: scriptedAdapter({
      analyze(request) {
        const analysis = bindQuestionToCitedAmbiguities(rawAnalysis(request, { question: true }));
        analysis.questions[0].prompt = prompt;
        analysis.questions[0].options = options;
        return analysis;
      },
    }),
  });
  assert.equal(analyzerResult.status, "needs-clarification");
  assert.equal(analyzerResult.questions[0].prompt, prompt);
  assert.deepEqual(analyzerResult.questions[0].options.map(({ label }) => label), options.map(({ label }) => label));

  const verifierResult = await runTextToLattice(source, {
    adapter: scriptedAdapter({
      analyze(request) {
        const analysis = bindQuestionToCitedAmbiguities(rawAnalysis(request, { question: true }));
        analysis.questions = [];
        return analysis;
      },
      verify(request) {
        const question = rawVerificationQuestion(request);
        question.prompt = prompt;
        question.options = options;
        question.affectedAtomIds = request.analysis.passages[0].ambiguityAtomIds;
        return rawVerification(request, { questions: [question] });
      },
    }),
  });
  assert.equal(verifierResult.status, "unable-to-attempt");
  assert.equal(verifierResult.text, null);
  assert.deepEqual(verifierResult.questions, []);

  const allTermsSource = "The atom, ID, schema, gate, candidate, model, and verifier names are unresolved.";
  const allTermsPrompt = "Which atom, ID, schema, gate, candidate, model, or verifier is meant?";
  const allTermsResult = await runTextToLattice(allTermsSource, {
    adapter: scriptedAdapter({
      analyze(request) {
        const analysis = bindQuestionToCitedAmbiguities(rawAnalysis(request, { question: true }));
        analysis.questions[0].prompt = allTermsPrompt;
        return analysis;
      },
    }),
  });
  assert.equal(allTermsResult.status, "needs-clarification");
  assert.equal(allTermsResult.questions[0].prompt, allTermsPrompt);
});

test("source-grounded clarification supports no-space scripts and legitimate joiners", async () => {
  const cases = [
    ["颜色可能是红色或蓝色。", "「红色还是蓝色？」"],
    ["او می‌رود یا می‌ماند؟", "می‌رود یا می‌ماند؟"],
  ];
  for (const [source, prompt] of cases) {
    const result = await runTextToLattice(source, {
      adapter: scriptedAdapter({
        analyze(request) {
          const analysis = bindQuestionToCitedAmbiguities(rawAnalysis(request, { question: true }));
          analysis.questions[0].prompt = prompt;
          return analysis;
        },
      }),
    });
    assert.equal(result.status, "needs-clarification");
    assert.equal(result.questions[0].prompt, prompt);
  }
});

test("only one exact current clarification is rerun and stale history never reaches later stages", async () => {
  const pending = await runTextToLattice(opaqueWords(9), {
    adapter: scriptedAdapter({ analysisOptions: { question: true } }),
  });
  const currentQuestion = pending.questions[0];
  const clarificationAnswers = Array.from({ length: 23 }, (_, index) => ({
    questionId: `history:${index}`,
    questionFingerprint: `qf-${index.toString(16).padStart(64, "0")}`,
    sourceFingerprint: currentQuestion.sourceFingerprint,
    analysisRevisionId: "r999",
    questionStage: "analysis",
    passageId: currentQuestion.passageId,
    answer: `a${index}`,
  }));
  clarificationAnswers.push({
    questionId: currentQuestion.id,
    questionFingerprint: currentQuestion.fingerprint,
    sourceFingerprint: currentQuestion.sourceFingerprint,
    analysisRevisionId: currentQuestion.analysisRevisionId,
    questionStage: currentQuestion.questionStage,
    passageId: currentQuestion.passageId,
    prompt: "must-not-cross",
    answer: "answer-analysis",
  });
  const seen = [];
  const adapter = scriptedAdapter({
    analysisOptions: { question: true },
    analyze(request) {
      seen.push(request.clarificationAnswers);
      return rawAnalysis(request, { question: request.clarificationAnswers.length === 0 });
    },
    generate(request) {
      seen.push(request.clarificationAnswers);
      return rawCandidate(request);
    },
    verify(request) {
      seen.push(request.clarificationAnswers);
      return rawVerification(request);
    },
  });
  const result = await runTextToLattice(opaqueWords(9), { adapter, clarificationAnswers });
  assert.equal(result.status, "translated");
  assert.deepEqual(result.questions, []);
  assert.equal(seen.length, 4);
  assert.deepEqual(seen[0], []);
  assert.deepEqual(seen[1], [{
    passageId: currentQuestion.passageId,
    prompt: currentQuestion.prompt,
    answer: "answer-analysis",
  }]);
  assert.equal(seen[2], undefined);
  assert.equal(seen[3], undefined);
  assert.doesNotMatch(JSON.stringify(seen), /must-not-cross/u);
});

test("a matching answer authorizes one analyzer recheck but never host-promotes a repeated question", async () => {
  const source = opaqueWords(9);
  const pending = await runTextToLattice(source, {
    adapter: scriptedAdapter({ analysisOptions: { question: true } }),
  });
  const question = pending.questions[0];
  const answer = {
    questionId: question.id,
    questionFingerprint: question.fingerprint,
    sourceFingerprint: question.sourceFingerprint,
    analysisRevisionId: question.analysisRevisionId,
    questionStage: question.questionStage,
    passageId: question.passageId,
    answer: "The first reading",
  };
  const adapter = scriptedAdapter({
    analyze(request) {
      return rawAnalysis(request, { question: true });
    },
  });
  const result = await runTextToLattice(source, { adapter, clarificationAnswers: [answer] });
  assert.equal(result.status, "needs-clarification");
  assert.equal(result.text, null);
  assert.equal(result.questions.length, 1);
  assert.equal(adapter.calls.analyze, 2);
  assert.equal(adapter.calls.generate, 0);
});

test("post-candidate re-atomization cannot surface a question or receive clarification history", async () => {
  const candidateOnlyMarker = "candonlymkrqxjvz";
  const reanalysisRequests = [];
  const adapter = scriptedAdapter({
    analyze(request, count) {
      if (count === 1) return rawAnalysis(request);
      reanalysisRequests.push(request);
      const analysis = rawAnalysis(request, { question: true });
      analysis.questions[0].prompt = `What does ${candidateOnlyMarker} mean?`;
      analysis.questions[0].options = [{ id: "o1", label: candidateOnlyMarker }];
      return analysis;
    },
    verify(request) {
      return rawVerification(request, { gates: { sourceCoverage: false } });
    },
  });
  const result = await runTextToLattice(opaqueWords(18), {
    adapter,
    clarificationAnswers: [],
  });
  assert.ok(reanalysisRequests.length > 0);
  for (const request of reanalysisRequests) {
    assert.equal(request.allowClarification, false);
    assert.equal(Object.hasOwn(request, "candidate"), false);
    assert.equal(Object.hasOwn(request, "clarificationAnswers"), false);
  }
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.deepEqual(result.questions, []);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(candidateOnlyMarker, "u"));
});

test("rejected candidate prose cannot be laundered into the re-atomization graph", async () => {
  const candidateOnlyMarker = "rejectedcandmkrqxjvz";
  const reanalysisPayloads = [];
  let generated = 0;
  let verified = 0;
  const adapter = scriptedAdapter({
    analyze(request, count) {
      if (count > 1) {
        reanalysisPayloads.push({ request, messages: analysisMessages(request) });
      }
      return rawAnalysis(request);
    },
    generate(request) {
      generated += 1;
      const candidate = rawCandidate(request);
      if (generated === 1) candidate.passages[0].text += ` ${candidateOnlyMarker}`;
      return candidate;
    },
    verify(request) {
      verified += 1;
      if (verified > 1) return rawVerification(request);
      return rawVerification(request, {
        gates: { sourceCoverage: false },
        passage: {
          unsupportedClaims: [{ claim: candidateOnlyMarker, evidence: candidateOnlyMarker }],
        },
        issues: [{
          id: candidateOnlyMarker,
          check: "sourceCoverage",
          passageId: request.batch.passages[0].id,
          atomIds: [],
          message: candidateOnlyMarker,
        }],
      });
    },
  });
  const result = await runTextToLattice(opaqueWords(18), { adapter });
  assert.ok(reanalysisPayloads.length > 0);
  for (const payload of reanalysisPayloads) {
    assert.doesNotMatch(JSON.stringify(payload), new RegExp(candidateOnlyMarker, "u"));
  }
  assert.equal(result.status, "translated");
  assert.doesNotMatch(result.text, new RegExp(candidateOnlyMarker, "u"));
});

test("verifier-origin questions are never surfaced or host-promoted", async () => {
  const behavior = {
    analyze(request) {
      return { ...rawAnalysis(request, { question: true }), questions: [] };
    },
    verify(request) {
      return rawVerification(request, { questions: [rawVerificationQuestion(request)] });
    },
  };
  const adapter = scriptedAdapter(behavior);
  const result = await runTextToLattice(opaqueWords(9), { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.deepEqual(result.questions, []);
  assert.deepEqual(adapter.calls, { analyze: 1, generate: 1, verify: 2, repair: 0 });
});

test("a reused local question ID cannot suppress changed semantics", async () => {
  const first = await runTextToLattice(opaqueWords(9), {
    adapter: scriptedAdapter({ analysisOptions: { question: true } }),
  });
  const prior = first.questions[0];
  const adapter = scriptedAdapter({
    analyze(request) {
      const analysis = rawAnalysis(request, { question: true });
      analysis.questions[0].prompt = "What did you mean?";
      return analysis;
    },
  });
  const second = await runTextToLattice(opaqueWords(9), {
    adapter,
    clarificationAnswers: [{
      questionId: prior.id,
      questionFingerprint: prior.fingerprint,
      answer: "answer-prior",
    }],
  });
  assert.equal(second.status, "needs-clarification");
  assert.equal(second.questions[0].id, prior.id);
  assert.notEqual(second.questions[0].fingerprint, prior.fingerprint);
});

test("unchanged text is allowed only with complete positive source-bound conformance", async () => {
  const adapter = scriptedAdapter({ analysisOptions: { disposition: "retain-if-conformant" } });
  const source = opaqueWords(12);
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "conformant-for-context");
  assert.equal(result.text, source);
  assert.equal(result.revisedPassageCount, 0);
});

test("positive conformance requires every supplied lossless span", async (context) => {
  const source = opaqueWords(36);

  await context.test("analysis omission becomes a rewrite", async () => {
    const adapter = scriptedAdapter({
      analyze(request) {
        const analysis = rawAnalysis(request, { disposition: "retain-if-conformant" });
        analysis.passages[0].conformanceEvidenceSpanIds.pop();
        return analysis;
      },
    });
    const result = await runTextToLattice(source, { adapter });
    assert.equal(result.status, "translated");
    assert.notEqual(result.text, source);
  });

  await context.test("verifier omission cannot certify retained source", async () => {
    const adapter = scriptedAdapter({
      analysisOptions: { disposition: "retain-if-conformant" },
      verify(request) {
        const verification = rawVerification(request);
        verification.passages[0].conformanceEvidenceSpanIds.pop();
        return verification;
      },
    });
    const result = await runTextToLattice(source, { adapter });
    assert.equal(result.status, "translated");
    assert.ok(result.text);
    assert.notEqual(result.text, source);
    assert.deepEqual(adapter.calls, { analyze: 2, generate: 2, verify: 2, repair: 0 });
  });
});

test("an obsolete whole-passage protect disposition fails closed without returning source as output", async () => {
  const adapter = scriptedAdapter({ analysisOptions: { disposition: "protect" } });
  const source = opaqueWords(12);
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.ok(adapter.calls.analyze > 2 && adapter.calls.analyze <= 64);
  assert.equal(result.revisedPassageCount, 0);
  assert.equal(result.retainedPassageCount, 0);
  assert.equal(result.primaryLayer, null);
  assert.equal(result.layerLabel, "Undetermined");
  assert.ok(result.findings.some(({ id }) => id === "atomization-unavailable"));
});

test("protocol correction retries atomization, generation, and verification with bounded feedback", async () => {
  const feedback = {};
  const adapter = scriptedAdapter({
    analyze(request, count) {
      if (count === 2) feedback.analyze = request.protocolFeedback;
      const response = rawAnalysis(request);
      return count === 1 ? { ...response, extra: true } : response;
    },
    generate(request, count) {
      if (count === 2) feedback.generate = request.protocolFeedback;
      const response = rawCandidate(request);
      return count === 1 ? { ...response, extra: true } : response;
    },
    verify(request, count) {
      if (count === 2) feedback.verify = request.protocolFeedback;
      const response = rawVerification(request);
      return count === 1 ? { ...response, extra: true } : response;
    },
  });
  const result = await runTextToLattice(opaqueWords(8), { adapter });
  assert.equal(result.status, "translated");
  assert.deepEqual(adapter.calls, { analyze: 2, generate: 2, verify: 2, repair: 0 });
  assert.equal(feedback.analyze.stage, "atomization");
  assert.equal(feedback.generate.stage, "generation");
  assert.equal(feedback.verify.stage, "verification");
  assert.ok(Object.values(feedback).every(({ attempt }) => attempt === 2));
});

test("persistent generator and recovery protocol failures return no source-labelled draft", async () => {
  const adapter = scriptedAdapter({
    generate() {
      return { passages: [] };
    },
    repair() {
      return { passages: [] };
    },
  });
  const source = opaqueWords(8);
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.deepEqual(adapter.calls, { analyze: 1, generate: 2, verify: 0, repair: 2 });
  assert.ok(result.findings.some(({ id }) => id === "generation-unavailable"));
});

test("persistent verifier protocol failure hides an independently unchecked draft", async () => {
  const adapter = scriptedAdapter({
    verify() {
      return { decision: "accept" };
    },
  });
  const source = opaqueWords(8);
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.deepEqual(adapter.calls, { analyze: 1, generate: 1, verify: 2, repair: 0 });
  assertCandidateWithheld(result);
});

test("a review assembly is hidden when any planned rewrite is not material", async () => {
  const adapter = scriptedAdapter({
    generate(request) {
      const candidate = rawCandidate(request);
      const last = candidate.passages.at(-1);
      const source = request.batch.passages.find(({ id }) => id === last.passageId).text;
      last.text = source;
      return candidate;
    },
    verify() { return { decision: "accept" }; },
  });
  const result = await runTextToLattice(`${fixedPassage("u")}\n${fixedPassage("v")}`, { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.equal(result.revisedPassageCount, 0);
});

test("an unchanged retained passage needs available independent conformance before a mixed review assembly is shown", async (context) => {
  const retainedAnalysis = (request) => {
    const analysis = rawAnalysis(request);
    const retainedIndex = analysis.passages.findIndex(({ passageId }) => passageId === "p0002");
    if (retainedIndex < 0) return analysis;
    const retained = analysis.passages[retainedIndex];
    analysis.passages[retainedIndex] = {
      ...retained,
      disposition: "retain-if-conformant",
      conformanceCriteria: requiredConformanceCriteria(retained.layer),
      conformanceEvidenceSpanIds: request.sourceSpans
        .find((group) => group.passageId === retained.passageId).spans.map(({ id }) => id),
      conformanceAssertions: requiredConformanceCriteria(retained.layer).map((criterion) => ({
        criterion,
        evidenceSpanIds: request.sourceSpans
          .find((group) => group.passageId === retained.passageId).spans.map(({ id }) => id),
      })),
    };
    return analysis;
  };
  const source = `${fixedPassage("u")}\n${fixedPassage("v")}`;

  await context.test("unavailable verifier", async () => {
    const adapter = scriptedAdapter({
      analyze: retainedAnalysis,
      verify() { return { decision: "accept" }; },
    });
    const result = await runTextToLattice(source, { adapter });
    assert.equal(result.status, "unable-to-attempt");
    assert.equal(result.text, null);
  });

  await context.test("source-bound conformance cannot override unsupported verification", async () => {
    const adapter = scriptedAdapter({
      analyze: retainedAnalysis,
      verify(request) {
        return rawVerification(request, { decision: "reject", gates: { languageSupported: false } });
      },
    });
    const result = await runTextToLattice(source, { adapter });
    assert.equal(result.status, "unable-to-attempt");
    assert.equal(result.text, null);
    assert.equal(result.revisedPassageCount, 0);
  });
});

test("an unchanged failed rewrite is never exposed as review output", async () => {
  const adapter = scriptedAdapter({
    generate(request) {
      return rawCandidate(request, { identity: true });
    },
    repair(request) {
      return rawCandidate(request, { identity: true });
    },
  });
  const source = opaqueWords(8);
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.equal(result.revisedPassageCount, 0);
  assert.equal(adapter.calls.repair, 1);
  assert.equal(adapter.calls.verify, 2);
});

test("presentation-only failed drafts are never exposed as transformed output", async () => {
  const presentationCases = [
    { source: opaqueWords(8), transform: (value) => value.split(" ").join(" \n ") },
    { source: opaqueWords(8), transform: (value) => `${value}.` },
    { source: opaqueWords(8), transform: (value) => value.toLocaleUpperCase("und") },
    { source: "Stable markers remain.", transform: (value) => `* ${value}` },
    { source: "Stable markers remain.", transform: (value) => `> ${value}` },
    { source: "Stable markers remain.", transform: (value) => value.replace(/\.$/u, ":") },
    { source: "Route marker ✈ remains.", transform: (value) => value.replace("✈", "✈️") },
    { source: "Use x <= y.", transform: () => "Use x ≤ y." },
    { source: "Use x - y.", transform: () => "Use x − y." },
    { source: "Open the gate.", transform: () => "Open *the* gate." },
    { source: "Open the gate.", transform: () => "**Open the gate.**" },
    { source: "Open the gate.", transform: () => "Open ~the~ gate." },
    { source: "Open the gate.", transform: () => "Open_the_gate." },
    { source: "Open the gate.", transform: () => "'Open the gate.'" },
    { source: "Open the gate.", transform: () => "´¨¯´‾™ⒶOpen the gate.Ⓐ™‾´¯¨´" },
  ];
  for (const { source, transform } of presentationCases) {
    const candidateFor = (request) => ({
      passages: rawCandidate(request, { identity: true }).passages.map((passage) => ({
        ...passage,
        text: transform(passage.text),
      })),
    });
    let certificationCalls = 0;
    const adapter = scriptedAdapter({
      generate: candidateFor,
      repair: candidateFor,
      certify() {
        certificationCalls += 1;
        return {
          decision: "accept",
          checks: Object.fromEntries(LATTICE_DOCUMENT_CERTIFICATION_CHECKS.map((name) => [name, true])),
          issues: [],
        };
      },
    });
    const result = await runTextToLattice(source, { adapter });
    assert.equal(result.status, "unable-to-attempt");
    assert.equal(result.text, null);
    assert.equal(result.revisedPassageCount, 0);
    assert.deepEqual(adapter.calls, { analyze: 1, generate: 1, verify: 2, repair: 1 });
    assert.equal(certificationCalls, 0);
  }
});

test("a verifier clarification never exposes its provisional candidate", async () => {
  const candidateOnlyMarker = "ZXQLEAK471";
  const adapter = scriptedAdapter({
    analyze(request) {
      return { ...rawAnalysis(request, { question: true }), questions: [] };
    },
    verify(request) {
      const question = rawVerificationQuestion(request);
      question.id = candidateOnlyMarker;
      question.prompt = `Does ${candidateOnlyMarker} express the intended reading?`;
      question.options = [{ id: candidateOnlyMarker, label: candidateOnlyMarker }];
      return rawVerification(request, {
        decision: "repair",
        questions: [question],
      });
    },
  });
  const result = await runTextToLattice(opaqueWords(8), { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.equal(result.questions.length, 0);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(candidateOnlyMarker, "u"));
  assert.equal(adapter.calls.repair, 0);
});

test("model-authored verifier issue identifiers and messages never enter a textless result", async () => {
  const candidateOnlyMarker = "ZXQLEAK471";
  const adapter = scriptedAdapter({
    verify(request) {
      return rawVerification(request, {
        passage: { semanticFidelity: false },
        issues: [{
          id: candidateOnlyMarker,
          check: "semanticFidelity",
          passageId: request.batch.passages[0].id,
          atomIds: [],
          message: candidateOnlyMarker,
        }],
      });
    },
  });
  const result = await runTextToLattice(opaqueWords(8), { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(candidateOnlyMarker, "u"));
  assertCandidateWithheld(result);
});

test("withheld candidates expose one constant projection across divergent private failure paths", async () => {
  const source = opaqueWords(18);
  const candidateOnlyMarker = "covertcandonlymkrqxjvz";
  const markedCandidate = (request) => {
    const candidate = rawCandidate(request);
    candidate.passages[0].text += ` ${candidateOnlyMarker}`;
    return candidate;
  };
  const semantic = await runTextToLattice(source, {
    adapter: scriptedAdapter({
      generate: markedCandidate,
      repair: markedCandidate,
      verify(request) {
        return rawVerification(request, { passage: { semanticFidelity: false } });
      },
    }),
  });
  let structuralChecks = 0;
  const structural = await runTextToLattice(source, {
    adapter: scriptedAdapter({
      analyze(request, count) {
        const analysis = rawAnalysis(request);
        if (count > 1) {
          analysis.passages[0].layer = "experiential";
          analysis.passages[0].atoms[0].id = candidateOnlyMarker;
        }
        return analysis;
      },
      generate: markedCandidate,
      verify(request) {
        structuralChecks += 1;
        return structuralChecks === 1
          ? rawVerification(request, { gates: { sourceCoverage: false } })
          : rawVerification(request, { passage: { domainCorrectness: false } });
      },
    }),
  });
  const unsupported = await runTextToLattice(source, {
    adapter: scriptedAdapter({
      generate: markedCandidate,
      verify(request) {
        return rawVerification(request, { decision: "reject", gates: { languageSupported: false } });
      },
    }),
  });
  assert.deepEqual(structural, semantic);
  assert.deepEqual(unsupported, semantic);
  assert.equal(semantic.text, null);
  assert.equal(semantic.primaryLayer, null);
  assert.equal(semantic.revisedPassageCount, 0);
  assert.equal(semantic.retainedPassageCount, 0);
  assert.equal(semantic.verificationPasses, 0);
  assert.doesNotMatch(JSON.stringify(semantic), new RegExp(candidateOnlyMarker, "u"));
  assertCandidateWithheld(semantic);
});

test("a local context failure is not retried or routed through repair", async () => {
  const adapter = scriptedAdapter({
    generate() {
      const error = new Error("context");
      error.code = "lattice-context";
      throw error;
    },
  });
  const result = await runTextToLattice(opaqueWords(8), { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.deepEqual(adapter.calls, { analyze: 1, generate: 1, verify: 0, repair: 0 });
  assert.ok(result.findings.some(({ id }) => id === "generation-context-unavailable"));
});

test("missing source coverage re-atomizes before it regenerates", async () => {
  const adapter = scriptedAdapter({
    verify(request, count) {
      if (count === 1) {
        return rawVerification(request, {
          decision: "repair",
          gates: { sourceCoverage: false },
          passage: { unmodeledSpanIds: request.sourceSpans[0].spans.map(({ id }) => id) },
        });
      }
      return rawVerification(request);
    },
  });
  const result = await runTextToLattice(opaqueWords(8), { adapter });
  assert.equal(result.status, "translated");
  assert.equal(adapter.calls.analyze, 2);
  assert.equal(adapter.calls.generate, 2);
  assert.equal(adapter.calls.repair, 0);
  assert.equal(adapter.calls.verify, 2);
});

test("an independently unconfirmed sub-register re-atomizes and stays hidden if unresolved", async () => {
  const recovered = scriptedAdapter({
    verify(request, count) {
      return count === 1
        ? rawVerification(request, { passage: { independentLayer: "accessibility" } })
        : rawVerification(request);
    },
  });
  const recoveredResult = await runTextToLattice(opaqueWords(12), { adapter: recovered });
  assert.equal(recoveredResult.status, "translated");
  assert.ok(recoveredResult.text);
  assert.deepEqual(recovered.calls, { analyze: 2, generate: 2, verify: 2, repair: 0 });

  const unresolved = scriptedAdapter({
    verify(request) {
      return rawVerification(request, { passage: { independentLayer: "accessibility" } });
    },
  });
  const unresolvedResult = await runTextToLattice(opaqueWords(12), { adapter: unresolved });
  assert.equal(unresolvedResult.status, "unable-to-attempt");
  assert.equal(unresolvedResult.text, null);
  assertCandidateWithheld(unresolvedResult);
});

test("failed positive conformance escapes retain through re-planning and regeneration", async () => {
  const adapter = scriptedAdapter({
    analysisOptions: { disposition: "retain-if-conformant" },
    verify(request, count) {
      return count === 1
        ? rawVerification(request, {
          gates: { registerFit: false },
          passage: { registerFit: false, conformanceConfirmed: false, conformanceEvidenceSpanIds: [] },
        })
        : rawVerification(request);
    },
  });
  const source = opaqueWords(8);
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.notEqual(result.text, source);
  assert.deepEqual(adapter.calls, { analyze: 2, generate: 2, verify: 2, repair: 0 });
});

test("failed regeneration cannot pair an old candidate with a new plan revision", async () => {
  const adapter = scriptedAdapter({
    analyze(request, count) {
      return rawAnalysis(request, { layer: count === 1 ? "operative" : "interpretive" });
    },
    generate(request, count) {
      return count === 1 ? rawCandidate(request) : { passages: [] };
    },
    verify(request) {
      return rawVerification(request, { gates: { registerFit: false }, passage: { registerFit: false } });
    },
  });
  const result = await runTextToLattice(opaqueWords(8), { adapter });
  assert.equal(result.status, "review-required");
  assert.ok(result.text);
  assert.equal(result.primaryLayer, "operative");
  assert.equal(adapter.calls.analyze, 2);
  assert.equal(adapter.calls.generate, 3);
  assert.equal(adapter.calls.verify, 1);
});

test("unsupported verifier language hides the draft without futile repair", async () => {
  const adapter = scriptedAdapter({
    verify(request) {
      return rawVerification(request, { decision: "reject", gates: { languageSupported: false } });
    },
  });
  const result = await runTextToLattice(opaqueWords(8), { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.equal(adapter.calls.repair, 0);
  assertCandidateWithheld(result);
});

test("a negative verifier decision without a binding failure never exposes a draft", async () => {
  let certificationCalls = 0;
  const adapter = scriptedAdapter({
    verify(request) {
      return rawVerification(request, { decision: "reject" });
    },
    certify() {
      certificationCalls += 1;
      return {
        decision: "accept",
        checks: Object.fromEntries(LATTICE_DOCUMENT_CERTIFICATION_CHECKS.map((name) => [name, true])),
        issues: [],
      };
    },
  });
  const result = await runTextToLattice(opaqueWords(12), { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assertCandidateWithheld(result);
  assert.equal(certificationCalls, 0);
});

test("typed lower-priority verifier issues expose only a semantically safe review draft", async () => {
  for (const check of ["accessibility", "clarity", "registerFit", "ornament"]) {
    const adapter = scriptedAdapter({
      verify(request) {
        const passageId = request.batch.passages[0].id;
        return rawVerification(request, {
          gates: { [check]: false },
          passage: ["accessibility", "clarity", "registerFit"].includes(check) ? { [check]: false } : {},
          issues: [{ id: `${check}_note`, check, passageId, atomIds: [], message: `${check}_finding` }],
        });
      },
    });
    const result = await runTextToLattice(opaqueWords(8), { adapter });
    assert.equal(result.status, "review-required", check);
    assert.ok(result.text, check);
    assert.notEqual(result.text, opaqueWords(8), check);
  }
});

test("semantic, unsupported, and contradictory verifier issues never expose a draft", async (context) => {
  await context.test("purpose-and-consequence safety failure", async () => {
    const adapter = scriptedAdapter({
      verify(request) {
        return rawVerification(request, {
          gates: { safety: false },
          passage: { safety: false },
          issues: [{
            id: "prohibited_outcome",
            check: "safety",
            passageId: request.batch.passages[0].id,
            atomIds: [],
            message: "operationally harmful transformation",
          }],
        });
      },
    });
    const result = await runTextToLattice(opaqueWords(8), { adapter });
    assert.equal(result.status, "unable-to-attempt");
    assert.equal(result.text, null);
    assertCandidateWithheld(result);
  });

  await context.test("semantic issue", async () => {
    const adapter = scriptedAdapter({
      verify(request) {
        return rawVerification(request, {
          gates: { semanticFidelity: false },
          passage: { semanticFidelity: false },
          issues: [{
            id: "semantic_drift",
            check: "semanticFidelity",
            passageId: request.batch.passages[0].id,
            atomIds: [],
            message: "semantic_finding",
          }],
        });
      },
    });
    const result = await runTextToLattice(opaqueWords(8), { adapter });
    assert.equal(result.status, "unable-to-attempt");
    assert.equal(result.text, null);
  });

  await context.test("unsupported claim", async () => {
    const adapter = scriptedAdapter({
      verify(request) {
        return rawVerification(request, {
          decision: "reject",
          passage: { unsupportedClaims: [{ claim: "invented", evidence: "" }] },
        });
      },
    });
    const result = await runTextToLattice(opaqueWords(8), { adapter });
    assert.equal(result.status, "unable-to-attempt");
    assert.equal(result.text, null);
  });

  await context.test("issue does not name a failed field", async () => {
    const adapter = scriptedAdapter({
      verify(request) {
        return rawVerification(request, {
          decision: "repair",
          issues: [{
            id: "contradictory_note",
            check: "clarity",
            passageId: request.batch.passages[0].id,
            atomIds: [],
            message: "not_failed",
          }],
        });
      },
    });
    const result = await runTextToLattice(opaqueWords(8), { adapter });
    assert.equal(result.status, "unable-to-attempt");
    assert.equal(result.text, null);
  });
});

test("a polarity-flipped instruction stays hidden even when materially rewritten", async () => {
  const unsafeCandidate = (request) => ({
    passages: request.analysis.passages.map((plan) => ({
      passageId: plan.passageId,
      layer: plan.layer,
      text: "Open the western gate.",
      preservedAtomIds: plan.atoms.map(({ id }) => id),
    })),
  });
  const adapter = scriptedAdapter({
    generate: unsafeCandidate,
    repair: unsafeCandidate,
    verify(request) {
      return rawVerification(request, {
        gates: { semanticFidelity: false },
        passage: { semanticFidelity: false },
      });
    },
  });
  const result = await runTextToLattice("Do not open the western gate.", { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
});

test("ordinary rewrites do not receive false retain-conformance repair feedback", async () => {
  let repairPrompt = "";
  const adapter = scriptedAdapter({
    verify(request) {
      return rawVerification(request, { gates: { clarity: false } });
    },
    repair(request) {
      repairPrompt = repairMessages(request).map(({ content }) => content).join("\n");
      return rawCandidate(request);
    },
  });
  await runTextToLattice(opaqueWords(8), { adapter });
  assert.match(repairPrompt, /clarity/u);
  assert.doesNotMatch(repairPrompt, /conformanceConfirmed/u);
});

test("a dense legal literal batch reaches repair and remains independently verifiable", async () => {
  const source = [
    interleavedLiteralPassageNoSpaces(209, 12, 24, 18_000),
    interleavedLiteralPassageNoSpaces(209, 12, 24, 19_000),
  ].join("\n\n");
  assert.equal(source.length, 420);
  assert.equal(countLatticeWords(source), 48);
  let repairRequest = null;
  const adapter = scriptedAdapter({
    analyze(request) {
      const atomIds = Array.from({ length: 24 }, (_, index) => `a${String(index + 1).padStart(2, "0")}`);
      let serial = 0;
      return {
        documentKind: "narrative",
        passages: request.batch.passages.map((passage, passageIndex) => {
          const spans = request.sourceSpans[passageIndex].spans;
          const literals = spans.filter(({ kind }) => kind === "literal");
          const ordinary = spans.filter(({ kind }) => kind === "source");
          assert.equal(literals.length, 12);
          assert.equal(ordinary.length, 13);
          return {
            passageId: passage.id,
            discourseFunction: `d${passageIndex}`,
            layer: passageIndex === 0 ? "experiential" : "interpretive",
            disposition: "rewrite",
            rationale: `r${passageIndex}`,
            atoms: Array.from({ length: 12 }, (_, localIndex) => {
              const globalIndex = serial;
              serial += 1;
              const exactIndex = localIndex - 8;
              return {
                id: atomIds[globalIndex],
                kind: ["actor", "action", "relationship"][localIndex % 3],
                value: `v${String(globalIndex + 1).padStart(2, "0")}`,
                priority: localIndex === 0 ? "hard" : "semantic",
                preservation: localIndex >= 8 ? "exact" : "equivalent",
                evidenceSpanIds: localIndex >= 8
                  ? literals.slice(exactIndex * 3, (exactIndex + 1) * 3).map(({ id }) => id)
                  : ordinary.filter((_span, spanIndex) => spanIndex % 8 === localIndex).map(({ id }) => id),
                links: [{
                  relation: localIndex % 2 === 0 ? "agent" : "patient",
                  targetAtomId: atomIds[(globalIndex + 1) % atomIds.length],
                }],
              };
            }),
            ambiguityAtomIds: [],
            conformanceCriteria: [],
            conformanceEvidenceSpanIds: [],
            conformanceAssertions: [],
          };
        }),
        questions: [],
      };
    },
    generate(request) {
      return literalSafeCandidate(request);
    },
    verify(request, count) {
      return count === 1
        ? rawVerification(request, { gates: { clarity: false }, passage: { clarity: false } })
        : rawVerification(request);
    },
    repair(request) {
      repairRequest = request;
      return literalSafeCandidate(request);
    },
  });

  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.notEqual(result.text, source);
  assert.deepEqual(adapter.calls, { analyze: 1, generate: 1, verify: 2, repair: 1 });
  assert.equal(repairRequest.batch.passages.length, 2);
  assert.equal(repairRequest.batch.wordCount, 48);
  assert.equal(repairRequest.batch.characterCount, 418);
  assert.equal(repairRequest.sourceSpans.flatMap(({ spans }) => spans).length, 50);
  assert.equal(repairRequest.sourceSpans.flatMap(({ spans }) => spans).filter(({ kind }) => kind === "literal").length, 24);
  assert.equal(repairRequest.analysis.passages.flatMap(({ atoms }) => atoms).length, 24);
});

test("duplicate evidence triggers bounded finer planning before generation", async () => {
  const source = opaqueWords(30);
  const adapter = scriptedAdapter({
    analyze(request) {
      const passage = request.batch.passages[0];
      return {
        documentKind: "other",
        passages: [{
          passageId: passage.id,
          discourseFunction: "d0",
          layer: "interpretive",
          disposition: "rewrite",
          rationale: "r0",
          atoms: Array.from({ length: 24 }, (_, index) => ({
            id: `a${index}`,
            kind: ["state", "object", "unit"][index % 3],
            value: `v${index}`,
            priority: "semantic",
            preservation: "equivalent",
            evidenceSpanIds: [request.sourceSpans[0].spans[0].id],
            links: [],
          })),
          ambiguityAtomIds: [],
          conformanceCriteria: [],
          conformanceEvidenceSpanIds: [],
          conformanceAssertions: [],
        }],
        questions: [],
      };
    },
  });
  const result = await runTextToLattice(source, { adapter });
  assert.equal(result.status, "translated");
  assert.ok(result.text);
  assert.ok(adapter.calls.analyze > 2 && adapter.calls.analyze <= 64);
  assert.ok(result.passageCount > 1);
});

test("unknown model fields fail closed and invalid Unicode is rejected before model work", async () => {
  const adapter = scriptedAdapter({
    analyze(request) {
      return { ...rawAnalysis(request), extra: true };
    },
  });
  const result = await runTextToLattice(opaqueWords(4), { adapter });
  assert.equal(result.status, "unable-to-attempt");
  assert.equal(result.text, null);
  assert.throws(() => validateLatticeInput(`u0000${String.fromCharCode(0xD800)}`), RangeError);
});

test("ResumeProjects unmount cleanup invalidates work and releases input-bearing runtime state", async () => {
  const source = await readFile(new URL("../app/resume/ResumeProjects.tsx", import.meta.url), "utf8");
  const cleanup = source.match(
    /useEffect\(\(\) => \{\s*latticeMountedRef\.current = true;\s*return \(\) => \{(?<body>[\s\S]*?)\n    \};\n  \}, \[releaseCurrentLatticeLease\]\);/u,
  )?.groups?.body;
  assert.ok(cleanup, "the unmount cleanup must remain explicit and independently inspectable");

  const teardownSequence = [
    "latticeMountedRef.current = false",
    "latticeJobRef.current += 1",
    "const controller = latticeAbortRef.current",
    "latticeAbortRef.current = null",
    "controller?.abort()",
    "releaseCurrentLatticeLease()",
    "interruptLocalLatticeModel()",
    "discardLocalLatticeModel()",
    "latticeInputRef.current.value = \"\"",
    "latticeInputRef.current = null",
  ];
  let prior = -1;
  for (const operation of teardownSequence) {
    const index = cleanup.indexOf(operation);
    assert.ok(index > prior, `${operation} must occur in teardown order`);
    prior = index;
  }
  assert.doesNotMatch(cleanup, /\bset[A-Z][A-Za-z]+\(/u, "unmount cleanup must not schedule React state updates");

  const lateUpdateGuards = source.match(
    /!latticeMountedRef\.current \|\| latticeJobRef\.current !== (?:environmentJobId|jobId)/gu,
  ) ?? [];
  assert.ok(lateUpdateGuards.length >= 6, "each asynchronous environment or conversion continuation must be mount-and-job guarded");
  assert.doesNotMatch(source, /setLatticeModelCached\(await/u);
});

test("all resume production sources remain free of canned transformations and runtime-text persistence or exfiltration", async () => {
  const files = await productionResumeFiles(new URL("../app/resume/", import.meta.url));
  const records = await Promise.all(files.map(async (file) => ({ file, source: await readFile(file, "utf8") })));
  assert.ok(records.length >= 10);

  for (const { file, source } of records) {
    const label = file.pathname;
    const exfiltrationScanSource = /latticeWebllm\.worker\.ts$/u.test(label)
      ? source.replace(/\["XMLHttpRequest", "WebSocket", "EventSource", "WebTransport"\]/u, "[]")
      : source;
    assert.doesNotMatch(
      exfiltrationScanSource,
      /sample(?:Input|Output)|example(?:Input|Output)|phraseSubstitution|rewriteTable|sourceFixture|outputFixture|presetSample/iu,
      label,
    );
    assert.doesNotMatch(
      exfiltrationScanSource,
      /\blocalStorage\b|\bsessionStorage\b|indexedDB\.(?:open|deleteDatabase)|\bsendBeacon\b|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|console\.(?:log|info|debug)/u,
      label,
    );
  }

  const fetchRecords = records.flatMap(({ file, source }) => [...source.matchAll(/\bfetch\s*\(/gu)].map((match) => ({ file, source, index: match.index })));
  const tokenizerFetches = fetchRecords.filter(({ file }) => /\/app\/resume\/lattice\/latticeWebllm\.worker\.ts$/u.test(file.pathname));
  const leaseFetches = fetchRecords.filter(({ file }) => /\/app\/resume\/lattice\/usageLease\.js$/u.test(file.pathname));
  assert.equal(fetchRecords.length, 4);
  assert.equal(tokenizerFetches.length, 1);
  assert.equal(leaseFetches.length, 3);
  const fetchWindow = tokenizerFetches[0].source.slice(tokenizerFetches[0].index, tokenizerFetches[0].index + 360);
  assert.match(fetchWindow, /fetch\(new URL\("tokenizer\.json", LATTICE_MODEL_ROLES\[role\]\.model\)/u);
  assert.doesNotMatch(fetchWindow, /\bbody\s*:|\bmethod\s*:/u);
  const assetPolicy = records.find(({ file }) => /\/app\/resume\/lattice\/assetRequestPolicy\.js$/u.test(file.pathname));
  assert.ok(assetPolicy);
  assert.match(assetPolicy.source, /credentials:\s*"omit"/u);
  assert.match(assetPolicy.source, /referrerPolicy:\s*"no-referrer"/u);
  assert.match(tokenizerFetches[0].source, /useIndexedDBCache:\s*false/u);
  for (const leaseFetch of leaseFetches) {
    const leaseWindow = leaseFetch.source.slice(leaseFetch.index, leaseFetch.index + 400);
    assert.match(leaseWindow, /fetch\(LEASE_PATH/u);
    assert.doesNotMatch(leaseWindow, /\bbody\s*:/u);
  }
});
