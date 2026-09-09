import {
  LATTICE_CLARIFICATION_SAFETY_LIMIT,
  LATTICE_CLARIFICATION_SERIALIZED_UTF8_LIMIT,
  LATTICE_CLARIFICATION_UTF8_LIMIT,
  LATTICE_CLARIFICATION_WORD_LIMIT,
  LATTICE_COMPLETION_CALL_LIMIT,
  LATTICE_FORMAT_CONTROL_LIMIT,
  LATTICE_GRAPHEME_CODE_POINT_LIMIT,
  LATTICE_INPUT_SAFETY_LIMIT,
  LATTICE_INPUT_UTF8_LIMIT,
  LATTICE_TOKEN_CODE_POINT_LIMIT,
  LATTICE_WORD_LIMIT,
  containsDisallowedLatticeControls,
  containsLatticeNoncharacter,
  containsOversizedLatticeGrapheme,
  containsOversizedLatticeToken,
  containsUnpairedSurrogate,
  countLatticeFormatControls,
  countLatticeWords,
  hasInvalidLatticeBidiIsolates,
  latticeInertJsonUtf8Length,
  latticeUtf8Length,
  validateLatticeClarificationAnswer,
  validateLatticeInput,
} from "./lattice/inputPolicy.js";
import {
  batchLatticePassages,
  contextPassagesForBatch,
  graphemeExcerpt,
  LATTICE_EXECUTION_BATCH_LIMIT,
  LATTICE_PASSAGE_LIMIT,
  latticeSourceSpansForBatch,
  MODEL_SOURCE_SPAN_LIMIT,
  reassembleLatticeSource,
  segmentLatticeSource,
  splitLatticePassage,
} from "./lattice/segments.js";
import {
  LATTICE_ATOM_KINDS,
  LATTICE_ATOM_PRIORITIES,
  LATTICE_ATOM_RELATIONS,
  LATTICE_BATCH_ATOM_LIMIT,
  LATTICE_CONFORMANCE_CRITERIA,
  LATTICE_CONFORMANCE_CRITERION_IDS,
  LATTICE_DISPOSITIONS,
  LATTICE_DOCUMENT_CERTIFICATION_CHECKS,
  LATTICE_DOCUMENT_CERTIFICATION_DECISIONS,
  LATTICE_DOCUMENT_KINDS,
  LATTICE_FITTED_ANALYSIS_CONTEXT,
  LATTICE_LAYERS,
  LATTICE_PASSAGE_VERIFICATION_CHECKS,
  LATTICE_PRESERVATION_MODES,
  LATTICE_VERIFICATION_DECISIONS,
  LATTICE_VERIFICATION_GATES,
  LATTICE_VERIFICATION_ISSUE_CHECKS,
  TEXT_TO_LATTICE_VERSION,
} from "./lattice/promptContract.js";
import {
  deterministicBatchReview,
  deterministicDocumentReview,
  foldLatticePresentationLetters,
  materiallyDifferent,
} from "./lattice/validators.js";

export {
  LATTICE_CLARIFICATION_SAFETY_LIMIT,
  LATTICE_CLARIFICATION_SERIALIZED_UTF8_LIMIT,
  LATTICE_CLARIFICATION_UTF8_LIMIT,
  LATTICE_CLARIFICATION_WORD_LIMIT,
  LATTICE_COMPLETION_CALL_LIMIT,
  LATTICE_FORMAT_CONTROL_LIMIT,
  LATTICE_GRAPHEME_CODE_POINT_LIMIT,
  LATTICE_INPUT_SAFETY_LIMIT,
  LATTICE_INPUT_UTF8_LIMIT,
  LATTICE_TOKEN_CODE_POINT_LIMIT,
  LATTICE_WORD_LIMIT,
  TEXT_TO_LATTICE_VERSION,
  countLatticeWords,
  validateLatticeClarificationAnswer,
  validateLatticeInput,
};

const LAYERS = new Set(LATTICE_LAYERS);
const DISPOSITIONS = new Set(LATTICE_DISPOSITIONS);
const ATOM_KINDS = new Set(LATTICE_ATOM_KINDS);
const PRIORITIES = new Set(LATTICE_ATOM_PRIORITIES);
const PRESERVATION = new Set(LATTICE_PRESERVATION_MODES);
const DOCUMENT_KINDS = new Set(LATTICE_DOCUMENT_KINDS);
const DECISIONS = new Set(LATTICE_VERIFICATION_DECISIONS);
const DOCUMENT_CERTIFICATION_DECISIONS = new Set(LATTICE_DOCUMENT_CERTIFICATION_DECISIONS);
const DOCUMENT_CERTIFICATION_CHECKS = new Set(LATTICE_DOCUMENT_CERTIFICATION_CHECKS);
const ATOM_RELATIONS = new Set(LATTICE_ATOM_RELATIONS);
const CONFORMANCE_CRITERIA = new Set(LATTICE_CONFORMANCE_CRITERION_IDS);
const VERIFICATION_ISSUE_CHECKS = new Set(LATTICE_VERIFICATION_ISSUE_CHECKS);
const REVIEW_ONLY_VERIFICATION_CHECKS = new Set(["accessibility", "clarity", "registerFit", "ornament"]);
const ANALYSIS_REVISION_ID_PATTERN = /^r\d{3}$/u;
const HOST_QUALIFIED_ATOM_ID_PATTERN = /^r[0-9]+:/u;
const SOURCE_FINGERPRINT_PATTERN = /^sf-[0-9a-f]{64}$/u;
const CANDIDATE_FINGERPRINT_PATTERN = /^cf-[0-9a-f]{64}$/u;
const QUESTION_FINGERPRINT_PATTERN = /^qf-[0-9a-f]{64}$/u;
const CLARIFICATION_PROMPT_UTF8_LIMIT = 128;
const CLARIFICATION_PROMPT_SERIALIZED_UTF8_LIMIT = 160;
const CLARIFICATION_MODEL_CONTEXT_UTF8_LIMIT = 320;
const CLARIFICATION_HISTORY_LIMIT = 24;
const QUESTION_TECHNICAL_TERMS = Object.freeze([
  /\batoms?\b/iu,
  /\bids?\b/iu,
  /\bschemas?\b/iu,
  /\bgates?\b/iu,
  /\bcandidates?\b/iu,
  /\bmodels?\b/iu,
  /\bverifiers?\b/iu,
]);
const QUESTION_TERMINAL = /[?؟？](?:[!！"']|\p{Pe}|\p{Pf})*$/u;
const QUESTION_TERMINAL_IN_TEXT = /[?؟？](?=(?:[!！"']|\p{Pe}|\p{Pf})*(?:\s|$))/gu;
const QUESTION_VARIATION_SELECTOR = /[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu;
const QUESTION_JOINER = /[\u200C\u200D]/gu;
const QUESTION_WORD_SEGMENTER = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("und", { granularity: "word" })
  : null;
const QUESTION_GROUNDING_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "did", "do", "does", "for", "from",
  "in", "is", "mean", "means", "meant", "of", "on", "or", "reading", "the", "to", "was", "were",
  "what", "when", "where", "which", "who", "why", "with", "would", "you", "your",
]);
const NEUTRAL_CLARIFICATION_OPTIONS = new Set([
  "yes", "no", "both", "neither", "not sure", "first", "second", "the first reading", "the second reading",
]);
const NEUTRAL_CLARIFICATION_PROMPTS = new Set([
  "which reading applies?",
  "what did you mean?",
]);
const VERIFICATION_CHECK_MESSAGES = Object.freeze({
  languageSupported: "The independent check could not reliably assess this language.",
  safety: "The candidate did not clear the binding safety check.",
  semanticFidelity: "The candidate did not clear the semantic-fidelity check.",
  sourceCoverage: "The semantic graph did not cover all source meaning.",
  atomCoverage: "The candidate did not account for every semantic atom.",
  accessibility: "The candidate did not clear the accessibility check.",
  clarity: "The candidate did not clear the clarity check.",
  domainCorrectness: "The candidate did not clear the domain-correctness check.",
  registerFit: "The candidate did not clear the selected-register check.",
  ornament: "Ornament obscured higher-priority meaning.",
  documentConsistency: "The passage did not remain consistent with the document.",
  planFit: "The selected plan did not fit the passage.",
  materiality: "The draft did not make a material language change.",
  boundaryFidelity: "The candidate moved meaning across a structural boundary.",
});
const CERTIFICATION_CHECK_MESSAGES = Object.freeze({
  semanticFidelity: "The document check did not confirm semantic fidelity.",
  identityRolesAttribution: "The document check did not confirm identity, roles, and attribution.",
  chronology: "The document check did not confirm chronology.",
  causality: "The document check did not confirm causality.",
  modalityPolarity: "The document check did not confirm modality and polarity.",
  ambiguityPreservation: "The document check did not confirm ambiguity preservation.",
  noUnsupportedMeaning: "The document check found unsupported meaning.",
  registerConformance: "The document check did not confirm register conformance.",
  boundaryFidelity: "The document check did not confirm structural boundaries.",
  documentConsistency: "The document check did not confirm document consistency.",
});

export class LatticeProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = "LatticeProtocolError";
  }
}

export function preflightLatticeInput(value) {
  const { source, wordCount } = validateLatticeInput(value);
  const passages = segmentLatticeSource(source);
  if (passages.length === 0) {
    throw new RangeError("Text to Lattice could not create a safe work unit from this input.");
  }
  if (passages.some(({ text }) => hasInvalidLatticeBidiIsolates(text))) {
    throw new RangeError("Text to Lattice cannot safely split these direction-isolated passages.");
  }
  const batches = batchLatticePassages(passages);
  return Object.freeze({ source, wordCount, passages, batches });
}

function protocol(condition, message) {
  if (!condition) throw new LatticeProtocolError(message);
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new DOMException("The local conversion was canceled.", "AbortError");
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, required, field, optional = []) {
  protocol(record(value), `${field} must be an object.`);
  const allowed = new Set([...required, ...optional]);
  protocol(Object.keys(value).every((key) => allowed.has(key)), `${field} contains an unknown field.`);
  protocol(required.every((key) => Object.prototype.hasOwnProperty.call(value, key)), `${field} is missing a required field.`);
}

function stringValue(value, field, { empty = false, maximum = 2_000 } = {}) {
  protocol(typeof value === "string", `${field} must be text.`);
  protocol(value.length <= maximum, `${field} exceeded its protocol limit.`);
  protocol(!containsUnpairedSurrogate(value), `${field} contains an incomplete Unicode character.`);
  protocol(!containsDisallowedLatticeControls(value), `${field} contains an unsupported control character.`);
  protocol(!containsLatticeNoncharacter(value), `${field} contains a Unicode noncharacter.`);
  protocol(!hasInvalidLatticeBidiIsolates(value), `${field} contains invalid direction markers.`);
  protocol(!containsOversizedLatticeGrapheme(value), `${field} contains an oversized character sequence.`);
  protocol(!containsOversizedLatticeToken(value), `${field} contains an overlong word-like token.`);
  protocol(countLatticeFormatControls(value) <= LATTICE_FORMAT_CONTROL_LIMIT, `${field} contains too many invisible format controls.`);
  if (!empty) protocol(value.trim().length > 0, `${field} cannot be empty.`);
  return value;
}

function uniqueStrings(value, field, maximum = 24) {
  protocol(Array.isArray(value) && value.length <= maximum, `${field} must be a bounded list.`);
  const result = value.map((item, index) => stringValue(item, `${field}[${index}]`, { maximum: 160 }));
  protocol(new Set(result).size === result.length, `${field} contains a duplicate identifier.`);
  return Object.freeze(result);
}

function exactIdCoverage(items, expectedIds, field) {
  protocol(Array.isArray(items), `${field} must be a list.`);
  const ids = items.map((item) => item?.passageId);
  protocol(ids.every((id) => typeof id === "string"), `${field} contains an invalid passage identifier.`);
  protocol(new Set(ids).size === ids.length, `${field} contains a duplicate passage.`);
  protocol(ids.length === expectedIds.length, `${field} did not cover every passage.`);
  const available = new Set(ids);
  protocol(expectedIds.every((id) => available.has(id)), `${field} did not match the requested passages.`);
}

function sourceSpanLookup(batch) {
  return new Map(latticeSourceSpansForBatch(batch).map(({ passageId, spans, literalAnnotations = [] }) => [
    passageId,
    new Map([...spans, ...literalAnnotations].map((span) => [span.id, span])),
  ]));
}

function resolveSourceSpanIds(value, passageId, lookup, field, { minimum = 0, maximum = 12 } = {}) {
  const ids = uniqueStrings(value, field, maximum);
  protocol(ids.length >= minimum, `${field} must cite at least ${minimum} source span${minimum === 1 ? "" : "s"}.`);
  const passageSpans = lookup.get(passageId);
  protocol(passageSpans, `${field} references an unknown passage.`);
  protocol(ids.every((id) => passageSpans.has(id)), `${field} references an unknown or cross-passage source span.`);
  const records = Object.freeze(ids.map((id) => passageSpans.get(id)));
  return Object.freeze({
    ids,
    records,
    evidence: Object.freeze(records.map((record) => {
      const { passageId: sourcePassageId, startUtf16, endUtf16, text } = record;
      return Object.freeze({ passageId: sourcePassageId, startUtf16, endUtf16, text });
    })),
  });
}

function hasCompleteSpanCoverage(ids, passageSpans) {
  return ids.length === passageSpans.size && ids.every((id) => passageSpans.has(id));
}

async function normalizeAnalysis(
  raw,
  batch,
  documentLedger = [],
  revisionId,
  sourceFingerprint,
  committedProvenance = [],
  { allowClarification = true } = {},
) {
  protocol(typeof revisionId === "string" && ANALYSIS_REVISION_ID_PATTERN.test(revisionId),
    "The host supplied an invalid atomization revision.");
  protocol(record(raw), "The atomizer returned an invalid response.");
  exactKeys(raw, ["documentKind", "passages", "questions"], "Atomization response");
  if (!allowClarification) {
    protocol(Array.isArray(raw.questions) && raw.questions.length === 0,
      "Post-candidate re-atomization cannot return visible clarification text.");
  }
  protocol(DOCUMENT_KINDS.has(raw.documentKind), "The atomizer returned an invalid document kind.");
  const expectedIds = batch.passages.map((passage) => passage.id);
  exactIdCoverage(raw.passages, expectedIds, "Atomization");
  const sourceById = new Map(batch.passages.map((passage) => [passage.id, passage]));
  const spansByPassage = sourceSpanLookup(batch);
  const fittedContext = raw[LATTICE_FITTED_ANALYSIS_CONTEXT];
  if (fittedContext !== undefined) {
    protocol(record(fittedContext)
      && Number.isSafeInteger(fittedContext.analysisAtomLimit)
      && fittedContext.analysisAtomLimit >= 1
      && fittedContext.analysisAtomLimit <= LATTICE_BATCH_ATOM_LIMIT
      && Array.isArray(fittedContext.documentLedgerAtomIds),
    "The atomizer response lost its fitted host context.");
  }
  const analysisAtomLimit = fittedContext?.analysisAtomLimit ?? LATTICE_BATCH_ATOM_LIMIT;
  protocol(raw.passages.reduce((sum, passage) => sum + (Array.isArray(passage?.atoms) ? passage.atoms.length : 0), 0) <= analysisAtomLimit,
    `Atomization exceeded the fitted ${analysisAtomLimit}-atom batch limit.`);
  const originalExternalAtomIds = new Set(documentLedger.map((atom) => atom.id));
  const externalAtomIds = fittedContext
    ? new Set(fittedContext.documentLedgerAtomIds)
    : originalExternalAtomIds;
  protocol([...externalAtomIds].every((id) => originalExternalAtomIds.has(id)),
    "The atomizer response referenced invalid fitted ledger provenance.");

  const passagesById = new Map();
  const rawAtomIds = new Set();
  for (const rawPassage of raw.passages) {
    protocol(record(rawPassage) && Array.isArray(rawPassage.atoms), "The atomizer returned an invalid passage.");
    for (const rawAtom of rawPassage.atoms) {
      protocol(record(rawAtom) && typeof rawAtom.id === "string" && rawAtom.id.trim(), "The atomizer returned an invalid atom identifier.");
      protocol(!HOST_QUALIFIED_ATOM_ID_PATTERN.test(rawAtom.id),
        "The atomizer used the host-reserved atom identifier namespace.");
      protocol(!externalAtomIds.has(rawAtom.id),
        "The atomizer reused a visible external atom identifier as a local identifier.");
      protocol(!rawAtomIds.has(rawAtom.id), `Atom identifier ${rawAtom.id} is duplicated.`);
      rawAtomIds.add(rawAtom.id);
    }
  }
  const localAtomIds = new Map([...rawAtomIds].map((id) => [id, `${revisionId}:${id}`]));
  const allAtomIds = new Set([...localAtomIds.values(), ...externalAtomIds]);
  for (const rawPassage of raw.passages) {
    const source = sourceById.get(rawPassage.passageId);
    protocol(record(rawPassage) && source, "The atomizer referenced an unknown passage.");
    exactKeys(rawPassage, [
      "passageId", "discourseFunction", "layer", "disposition", "rationale", "atoms",
      "ambiguityAtomIds", "conformanceCriteria", "conformanceEvidenceSpanIds", "conformanceAssertions",
    ], `Atomization passage ${source.id}`);
    protocol(LAYERS.has(rawPassage.layer), `The atomizer returned an invalid layer for ${source.id}.`);
    protocol(DISPOSITIONS.has(rawPassage.disposition), `The atomizer returned an invalid disposition for ${source.id}.`);
    protocol(Array.isArray(rawPassage.atoms) && rawPassage.atoms.length >= 1 && rawPassage.atoms.length <= 24,
      `The atomizer returned an invalid atom set for ${source.id}.`);

    const atoms = rawPassage.atoms.map((rawAtom, atomIndex) => {
      protocol(record(rawAtom), `Atom ${atomIndex + 1} in ${source.id} is invalid.`);
      exactKeys(rawAtom, ["id", "kind", "value", "priority", "preservation", "evidenceSpanIds", "links"], `Atom ${atomIndex + 1} in ${source.id}`);
      const rawId = stringValue(rawAtom.id, `Atom identifier in ${source.id}`, { maximum: 120 });
      const id = localAtomIds.get(rawId);
      protocol(ATOM_KINDS.has(rawAtom.kind), `Atom ${id} has an invalid kind.`);
      protocol(PRIORITIES.has(rawAtom.priority), `Atom ${id} has an invalid priority.`);
      protocol(PRESERVATION.has(rawAtom.preservation), `Atom ${id} has an invalid preservation mode.`);
      const resolvedEvidence = resolveSourceSpanIds(
        rawAtom.evidenceSpanIds,
        source.id,
        spansByPassage,
        `Atom ${id} evidence spans`,
        { minimum: 1, maximum: 3 },
      );
      if (rawAtom.preservation === "exact") {
        protocol(resolvedEvidence.records.every(({ kind }) => kind === "literal"),
          `Exact atom ${id} must cite only fine-grained literal spans.`);
      }
      protocol(Array.isArray(rawAtom.links) && rawAtom.links.length <= 8, `Atom ${id} has invalid links.`);
      const linkKeys = new Set();
      const links = rawAtom.links.map((rawLink) => {
        protocol(record(rawLink), `Atom ${id} has an invalid link.`);
        exactKeys(rawLink, ["relation", "targetAtomId"], `Atom ${id} link`);
        protocol(ATOM_RELATIONS.has(rawLink.relation), `Atom ${id} has an unsupported link relation.`);
        const rawTarget = stringValue(rawLink.targetAtomId, `Atom ${id} link target`, { maximum: 180 });
        const targetAtomId = localAtomIds.get(rawTarget) ?? rawTarget;
        const linkKey = `${rawLink.relation}\u241f${targetAtomId}`;
        protocol(!linkKeys.has(linkKey), `Atom ${id} repeats an identical typed link.`);
        linkKeys.add(linkKey);
        return Object.freeze({
          relation: stringValue(rawLink.relation, `Atom ${id} link`, { maximum: 120 }),
          targetAtomId,
        });
      });
      return Object.freeze({
        id,
        kind: rawAtom.kind,
        value: stringValue(rawAtom.value, `Atom ${id} value`, { maximum: 600 }),
        priority: rawAtom.priority,
        preservation: rawAtom.preservation,
        evidenceSpanIds: resolvedEvidence.ids,
        evidence: resolvedEvidence.evidence,
        links: Object.freeze(links),
      });
    });
    const citedSpanIds = new Set(atoms.flatMap((atom) => atom.evidenceSpanIds));
    const sourceSpanIds = [...spansByPassage.get(source.id).keys()];
    protocol(sourceSpanIds.length === citedSpanIds.size && sourceSpanIds.every((id) => citedSpanIds.has(id)),
      `Atomization did not ground every lossless source span of passage ${source.id}.`);
    const rawAmbiguityIds = uniqueStrings(rawPassage.ambiguityAtomIds, `Ambiguity atoms in ${source.id}`, 8);
    const ambiguityAtomIds = Object.freeze(rawAmbiguityIds.map((id) => localAtomIds.get(id) ?? id));
    const atomIds = new Set(atoms.map((atom) => atom.id));
    protocol(ambiguityAtomIds.every((id) => atomIds.has(id)), `Passage ${source.id} references an unknown ambiguity atom.`);
    const atomById = new Map(atoms.map((atom) => [atom.id, atom]));
    protocol(ambiguityAtomIds.every((id) => ["ambiguity", "uncertainty"].includes(atomById.get(id).kind)),
      `Passage ${source.id} labels a non-ambiguity atom as an ambiguity.`);

    const conformanceCriteria = uniqueStrings(rawPassage.conformanceCriteria, `Conformance criteria in ${source.id}`, 6);
    protocol(conformanceCriteria.every((criterion) => CONFORMANCE_CRITERIA.has(criterion)),
      `Conformance criteria in ${source.id} include an unknown assertion.`);
    const resolvedConformance = resolveSourceSpanIds(
      rawPassage.conformanceEvidenceSpanIds,
      source.id,
      spansByPassage,
      `Conformance evidence spans in ${source.id}`,
      { maximum: MODEL_SOURCE_SPAN_LIMIT },
    );
    const conformanceEvidence = resolvedConformance.evidence;
    protocol(Array.isArray(rawPassage.conformanceAssertions) && rawPassage.conformanceAssertions.length <= 6,
      `Conformance assertions in ${source.id} must be a bounded list.`);
    const assertedCriteria = new Set();
    const conformanceAssertions = rawPassage.conformanceAssertions.map((rawAssertion, assertionIndex) => {
      protocol(record(rawAssertion), `Conformance assertion ${assertionIndex + 1} in ${source.id} is invalid.`);
      exactKeys(rawAssertion, ["criterion", "evidenceSpanIds"], `Conformance assertion ${assertionIndex + 1} in ${source.id}`);
      protocol(CONFORMANCE_CRITERIA.has(rawAssertion.criterion),
        `Conformance assertion ${assertionIndex + 1} in ${source.id} names an unknown criterion.`);
      protocol(!assertedCriteria.has(rawAssertion.criterion),
        `Conformance assertions in ${source.id} repeat a criterion.`);
      assertedCriteria.add(rawAssertion.criterion);
      const resolved = resolveSourceSpanIds(
        rawAssertion.evidenceSpanIds,
        source.id,
        spansByPassage,
        `Conformance assertion ${rawAssertion.criterion} evidence in ${source.id}`,
        { minimum: 1, maximum: MODEL_SOURCE_SPAN_LIMIT },
      );
      return Object.freeze({
        criterion: rawAssertion.criterion,
        evidenceSpanIds: resolved.ids,
        evidence: resolved.evidence,
      });
    });
    if (rawPassage.disposition === "rewrite") {
      protocol(conformanceCriteria.length === 0 && resolvedConformance.ids.length === 0 && conformanceAssertions.length === 0,
        `Rewrite plan ${source.id} must not claim unchanged-text conformance.`);
    }
    let disposition = rawPassage.disposition;
    let retainedCriteria = conformanceCriteria;
    let retainedConformanceSpanIds = resolvedConformance.ids;
    let retainedConformanceEvidence = conformanceEvidence;
    let retainedAssertions = Object.freeze(conformanceAssertions);
    if (disposition === "retain-if-conformant") {
      const requiredCriteria = [...LATTICE_CONFORMANCE_CRITERIA.universal, ...LATTICE_CONFORMANCE_CRITERIA[rawPassage.layer]];
      const completeCriteria = requiredCriteria.every((criterion) => conformanceCriteria.includes(criterion));
      const completeEvidence = hasCompleteSpanCoverage(resolvedConformance.ids, spansByPassage.get(source.id));
      const completeAssertions = conformanceAssertions.length === requiredCriteria.length
        && requiredCriteria.every((criterion) => assertedCriteria.has(criterion));
      const assertedEvidence = new Set(conformanceAssertions.flatMap(({ evidenceSpanIds }) => evidenceSpanIds));
      const completeAssertionEvidence = hasCompleteSpanCoverage([...assertedEvidence], spansByPassage.get(source.id));
      if (!completeCriteria || conformanceCriteria.length !== requiredCriteria.length || !completeEvidence
        || !completeAssertions || !completeAssertionEvidence) {
        disposition = "rewrite";
      }
    }
    if (disposition === "rewrite") {
      retainedCriteria = Object.freeze([]);
      retainedConformanceSpanIds = Object.freeze([]);
      retainedConformanceEvidence = Object.freeze([]);
      retainedAssertions = Object.freeze([]);
    }
    passagesById.set(source.id, Object.freeze({
      passageId: source.id,
      discourseFunction: stringValue(rawPassage.discourseFunction, `Discourse function in ${source.id}`, { maximum: 300 }),
      layer: rawPassage.layer,
      disposition,
      rationale: stringValue(rawPassage.rationale, `Layer rationale in ${source.id}`, { maximum: 600 }),
      atoms: Object.freeze(atoms),
      ambiguityAtomIds,
      conformanceCriteria: retainedCriteria,
      conformanceEvidenceSpanIds: retainedConformanceSpanIds,
      conformanceEvidence: retainedConformanceEvidence,
      conformanceAssertions: retainedAssertions,
    }));
  }

  for (const passage of passagesById.values()) {
    for (const atom of passage.atoms) {
      for (const link of atom.links) {
        protocol(allAtomIds.has(link.targetAtomId), `Atom ${atom.id} links to an unknown atom.`);
        protocol(link.targetAtomId !== atom.id, `Atom ${atom.id} cannot link to itself.`);
      }
    }
  }

  return Object.freeze({
    revisionId,
    documentKind: raw.documentKind,
    passages: Object.freeze(expectedIds.map((id) => passagesById.get(id))),
    questions: allowClarification ? await normalizeQuestions(raw.questions, passagesById, {
      atomIdMap: localAtomIds,
      namespace: `analysis:${batch.id}`,
      sourceByPassage: sourceById,
      provenanceAtomsById: clarificationProvenanceAtoms(
        passagesById.values(),
        committedProvenance,
      ),
      sourceFingerprint,
      analysisRevisionId: revisionId,
      questionStage: "analysis",
    }) : Object.freeze([]),
  });
}

function containsUngroundedQuestionLanguage(value, source) {
  const lexicalViews = (text) => {
    const original = foldLatticePresentationLetters(String(text));
    const normalize = (candidate) => candidate.normalize("NFKD")
      .replace(/(?:\p{Default_Ignorable_Code_Point}|\p{Cf}|\p{M})/gu, "")
      .toLocaleLowerCase("und")
      .replace(/\s+/gu, " ")
      .trim();
    const substitutePresentation = (candidate, replacement) => (
      [...candidate].map((character) => /[\p{P}\p{S}]/u.test(character) ? replacement : character).join("")
    );
    const folded = original.normalize("NFKD");
    return Object.freeze([
      normalize(substitutePresentation(original, "")),
      normalize(substitutePresentation(original, " ")),
      normalize(substitutePresentation(folded, "")),
      normalize(substitutePresentation(folded, " ")),
    ]);
  };
  const normalizedValues = lexicalViews(value);
  const normalizedSources = lexicalViews(source);
  return QUESTION_TECHNICAL_TERMS.some((pattern) => (
    normalizedValues.some((normalizedValue) => pattern.test(normalizedValue))
      && !normalizedSources.some((normalizedSource) => pattern.test(normalizedSource))
  ));
}

function questionGroundingTokens(value) {
  const normalized = foldLatticePresentationLetters(String(value)).normalize("NFKD")
    .replace(/(?:\p{Default_Ignorable_Code_Point}|\p{Cf}|\p{M})/gu, "")
    .toLocaleLowerCase("und");
  const tokens = QUESTION_WORD_SEGMENTER
    ? [...QUESTION_WORD_SEGMENTER.segment(normalized)].filter(({ isWordLike }) => isWordLike).map(({ segment }) => segment)
    : normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(tokens
    .filter((token) => !QUESTION_GROUNDING_STOPWORDS.has(token)));
}

function scalarBesideQuestionJoiner(value, index, direction) {
  const side = direction < 0 ? value.slice(0, index) : value.slice(index + 1);
  const scalars = [...side.replace(QUESTION_VARIATION_SELECTOR, "")];
  return direction < 0 ? scalars.at(-1) ?? "" : scalars[0] ?? "";
}

function containsUnsafeQuestionFormatting(value) {
  for (const match of value.matchAll(QUESTION_JOINER)) {
    const before = scalarBesideQuestionJoiner(value, match.index, -1);
    const after = scalarBesideQuestionJoiner(value, match.index, 1);
    const nonLatinWordJoin = /[\p{L}\p{M}]/u.test(before)
      && /[\p{L}\p{M}]/u.test(after)
      && !/\p{Script=Latin}/u.test(before)
      && !/\p{Script=Latin}/u.test(after);
    const emojiJoin = match[0] === "\u200D"
      && /\p{Extended_Pictographic}/u.test(before)
      && /\p{Extended_Pictographic}/u.test(after);
    if (!nonLatinWordJoin && !emojiJoin) return true;
  }
  const remaining = value.replace(QUESTION_VARIATION_SELECTOR, "").replace(QUESTION_JOINER, "");
  return /(?:\p{Cf}|\p{Default_Ignorable_Code_Point}|[\u115F\u1160\u3164\uFFA0])/u.test(remaining);
}

function questionTerminalCount(value) {
  let count = 0;
  for (const match of value.matchAll(QUESTION_TERMINAL_IN_TEXT)) {
    const tokenStart = Math.max(
      value.lastIndexOf(" ", match.index - 1),
      value.lastIndexOf("\t", match.index - 1),
      value.lastIndexOf("\n", match.index - 1),
      value.lastIndexOf("\r", match.index - 1),
      value.lastIndexOf("\u2028", match.index - 1),
      value.lastIndexOf("\u2029", match.index - 1),
    ) + 1;
    if (!value.slice(tokenStart, match.index).includes("://")) count += 1;
  }
  return count;
}

function hasQuestionGrounding(value, evidenceTexts) {
  const evidenceTokens = new Set(evidenceTexts.flatMap((text) => [...questionGroundingTokens(text)]));
  return [...questionGroundingTokens(value)].some((token) => evidenceTokens.has(token));
}

function canonicalQuestionCopy(value) {
  return String(value).normalize("NFKC").toLocaleLowerCase("und").replace(/\s+/gu, " ").trim();
}

function canonicalQuestionTupleOrder(left, right) {
  const leftValue = JSON.stringify(left);
  const rightValue = JSON.stringify(right);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

function clarificationProvenanceAtoms(passages, committedProvenance = []) {
  const atoms = new Map(committedProvenance.map(({ atom, passageId }) => [
    atom.id,
    { atom, passageId },
  ]));
  for (const passage of passages) {
    for (const atom of passage.atoms) {
      atoms.set(atom.id, { atom, passageId: passage.passageId });
    }
  }
  return atoms;
}

function committedClarificationProvenance(analyses, anchorBatchId = null) {
  return Object.freeze(analyses.flatMap(({ batch, analysis }) => (
    batch.id === anchorBatchId ? [] : analysis.passages.flatMap((passage) => (
      passage.atoms.map((atom) => Object.freeze({ atom, passageId: passage.passageId }))
    ))
  )));
}

function clarificationAtomProvenance({ atom, passageId }) {
  const atomEvidence = Array.isArray(atom.evidence) ? atom.evidence : [];
  const atomEvidenceSpanIds = Array.isArray(atom.evidenceSpanIds) ? atom.evidenceSpanIds : [];
  const evidence = atomEvidence.map((item, index) => [
    atomEvidenceSpanIds[index] ?? "",
    item.passageId,
    item.startUtf16,
    item.endUtf16,
    item.text,
  ]).sort(canonicalQuestionTupleOrder);
  const links = (atom.links ?? []).map(({ relation, targetAtomId }) => (
    [relation, targetAtomId]
  )).sort(canonicalQuestionTupleOrder);
  return [
    atom.id,
    passageId,
    atom.kind,
    atom.value,
    atom.priority ?? "",
    atom.preservation ?? "",
    evidence,
    links,
  ];
}

function completeClarificationProvenance(provenanceAtomsById) {
  return [...provenanceAtomsById.keys()]
    .sort()
    .map((atomId) => clarificationAtomProvenance(provenanceAtomsById.get(atomId)));
}

async function normalizeQuestions(rawQuestions, passagesById, {
  atomIdMap = new Map(),
  namespace = "question",
  sourceByPassage = new Map(),
  provenanceAtomsById = new Map(),
  sourceFingerprint = "",
  analysisRevisionId = "",
  candidateFingerprint = "",
  questionStage = "analysis",
} = {}) {
  protocol(Array.isArray(rawQuestions) && rawQuestions.length <= 1, "Clarification questions must contain at most one direct question.");
  const normalizedQuestionStage = stringValue(questionStage, "Clarification question stage", { maximum: 120 });
  const verifierQuestion = normalizedQuestionStage.startsWith("verification:");
  protocol(verifierQuestion ? CANDIDATE_FINGERPRINT_PATTERN.test(candidateFingerprint) : candidateFingerprint === "",
    "Clarification question candidate provenance does not match its stage.");
  const questionIds = new Set();
  return Object.freeze(await Promise.all(rawQuestions.map(async (rawQuestion, index) => {
    protocol(record(rawQuestion), `Clarification question ${index + 1} is invalid.`);
    exactKeys(rawQuestion, ["id", "passageId", "prompt", "affectedAtomIds", "options"], `Clarification question ${index + 1}`);
    const rawId = stringValue(rawQuestion.id, "Clarification question identifier", { maximum: 120 });
    const id = `${namespace}:${rawId}`;
    protocol(!questionIds.has(id), `Clarification question ${id} is duplicated.`);
    questionIds.add(id);
    const passage = passagesById.get(rawQuestion.passageId);
    protocol(passage, `Clarification question ${id} references an unknown passage.`);
    protocol(SOURCE_FINGERPRINT_PATTERN.test(sourceFingerprint),
      `Clarification question ${id} is missing its source provenance.`);
    protocol(ANALYSIS_REVISION_ID_PATTERN.test(analysisRevisionId),
      `Clarification question ${id} is missing its analysis provenance.`);
    const source = sourceByPassage.get(rawQuestion.passageId)?.text ?? "";
    const affectedAtomIds = Object.freeze(uniqueStrings(rawQuestion.affectedAtomIds, `Clarification question ${id} atoms`, 8).map((atomId) => atomIdMap.get(atomId) ?? atomId));
    const atomById = new Map(passage.atoms.map((atom) => [atom.id, atom]));
    protocol(affectedAtomIds.length > 0 && affectedAtomIds.every((atomId) => atomById.has(atomId)),
      `Clarification question ${id} references an unknown atom.`);
    protocol(affectedAtomIds.every((atomId) => ["ambiguity", "uncertainty"].includes(atomById.get(atomId).kind)),
      `Clarification question ${id} is not tied to a meaning-changing ambiguity.`);
    const declaredAmbiguityIds = new Set(passage.ambiguityAtomIds);
    protocol(affectedAtomIds.every((atomId) => declaredAmbiguityIds.has(atomId)),
      `Clarification question ${id} is not tied to a declared ambiguity.`);
    const groundingEvidence = affectedAtomIds.flatMap((atomId) => (
      atomById.get(atomId).evidence.map(({ text }) => text)
    ));
    protocol(Array.isArray(rawQuestion.options) && rawQuestion.options.length <= 4,
      `Clarification question ${id} has invalid options.`);
    const optionIds = new Set();
    const options = rawQuestion.options.map((rawOption) => {
      protocol(record(rawOption), `Clarification question ${id} has an invalid option.`);
      exactKeys(rawOption, ["id", "label"], `Clarification option for ${id}`);
      const optionId = stringValue(rawOption.id, `Clarification option for ${id}`, { maximum: 120 });
      protocol(!optionIds.has(optionId), `Clarification question ${id} repeats an option.`);
      optionIds.add(optionId);
      return Object.freeze({
        id: `${id}:${optionId}`,
        label: (() => {
          const label = stringValue(rawOption.label, `Clarification option ${optionId}`, { maximum: 80 });
          protocol(label === label.trim() && !/[\r\n\u2028\u2029]/u.test(label),
            `Clarification option ${optionId} must be one direct line.`);
          protocol(!containsUnsafeQuestionFormatting(label),
            `Clarification option ${optionId} contains invisible formatting.`);
          protocol(!containsUngroundedQuestionLanguage(label, source),
            `Clarification option ${optionId} contains internal implementation language.`);
          protocol(latticeUtf8Length(label) <= LATTICE_CLARIFICATION_UTF8_LIMIT
            && latticeInertJsonUtf8Length(label) <= LATTICE_CLARIFICATION_SERIALIZED_UTF8_LIMIT,
          `Clarification option ${optionId} is too large for a bounded answer.`);
          const labelWordCount = countLatticeWords(label);
          protocol(labelWordCount > 0 && labelWordCount <= LATTICE_CLARIFICATION_WORD_LIMIT,
            `Clarification option ${optionId} is not a bounded answer.`);
          const normalizedLabel = [...questionGroundingTokens(label)].join(" ");
          protocol(NEUTRAL_CLARIFICATION_OPTIONS.has(normalizedLabel)
            || hasQuestionGrounding(label, groundingEvidence),
          `Clarification option ${optionId} is not grounded in the cited ambiguity.`);
          return label;
        })(),
      });
    });
    const prompt = stringValue(rawQuestion.prompt, `Clarification question ${id}`, { maximum: 160 });
    protocol(prompt === prompt.trim() && !/[\r\n\u2028\u2029]/u.test(prompt),
      `Clarification question ${id} must be one direct line.`);
    protocol(!containsUnsafeQuestionFormatting(prompt),
      `Clarification question ${id} contains invisible formatting.`);
    protocol(!containsUngroundedQuestionLanguage(prompt, source),
      `Clarification question ${id} contains internal implementation language.`);
    const promptWordCount = countLatticeWords(prompt);
    protocol(promptWordCount > 0 && promptWordCount <= LATTICE_CLARIFICATION_WORD_LIMIT,
      `Clarification question ${id} is not a bounded visible question.`);
    protocol(QUESTION_TERMINAL.test(prompt) && questionTerminalCount(prompt) === 1,
      `Clarification question ${id} must be one explicit question.`);
    protocol(NEUTRAL_CLARIFICATION_PROMPTS.has(canonicalQuestionCopy(prompt))
      || hasQuestionGrounding(prompt, groundingEvidence),
      `Clarification question ${id} is not grounded in its cited source evidence.`);
    protocol(latticeUtf8Length(prompt) <= CLARIFICATION_PROMPT_UTF8_LIMIT
      && latticeInertJsonUtf8Length(prompt) <= CLARIFICATION_PROMPT_SERIALIZED_UTF8_LIMIT,
    `Clarification question ${id} is too large for a bounded recheck.`);
    const emptyAnswerTupleSize = latticeInertJsonUtf8Length([
      rawQuestion.passageId,
      prompt,
      "",
    ]);
    protocol(
      emptyAnswerTupleSize + LATTICE_CLARIFICATION_SERIALIZED_UTF8_LIMIT - latticeInertJsonUtf8Length("")
        <= CLARIFICATION_MODEL_CONTEXT_UTF8_LIMIT,
      `Clarification question ${id} leaves insufficient room for a bounded answer.`,
    );
    const fingerprintAtomIds = [...affectedAtomIds].sort();
    const graphAtomsById = new Map(provenanceAtomsById);
    for (const atom of passage.atoms) {
      if (!graphAtomsById.has(atom.id)) {
        graphAtomsById.set(atom.id, { atom, passageId: passage.passageId });
      }
    }
    const graphProvenance = completeClarificationProvenance(graphAtomsById);
    const fingerprint = await clarificationFingerprint({
      sourceFingerprint,
      analysisRevisionId,
      questionStage: normalizedQuestionStage,
      candidateFingerprint,
      passageId: rawQuestion.passageId,
      passageSource: source,
      prompt,
      affectedAtomIds: fingerprintAtomIds,
      graphProvenance,
      options: options.map(({ label }, optionIndex) => [rawQuestion.options[optionIndex].id, label])
        .sort(canonicalQuestionTupleOrder),
    });
    return Object.freeze({
      id,
      fingerprint,
      sourceFingerprint,
      analysisRevisionId,
      questionStage: normalizedQuestionStage,
      ...(candidateFingerprint ? { candidateFingerprint } : {}),
      passageId: rawQuestion.passageId,
      prompt,
      affectedAtomIds,
      options: Object.freeze(options),
    });
  })));
}

async function provenanceFingerprint(prefix, value) {
  const serialized = JSON.stringify(value);
  protocol(typeof TextEncoder === "function" && typeof globalThis.crypto?.subtle?.digest === "function",
    "Text to Lattice requires a secure browser digest implementation.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}-${hex}`;
}

function clarificationFingerprint(value) {
  return provenanceFingerprint("qf", value);
}

function assembledCandidateProvenance(entries, assembledText) {
  const passages = entries.flatMap(({ analysisRevisionId, batch, candidate }) => (
    candidate.passages.map((passage) => [
      batch.id,
      passage.passageId,
      analysisRevisionId,
      passage.layer,
      passage.text,
      [...passage.preservedAtomIds].sort(),
    ])
  )).sort(canonicalQuestionTupleOrder);
  return Object.freeze({ assembledText, passages });
}

function normalizeCandidate(raw, batch, analysis) {
  protocol(record(raw), "The generator returned an invalid response.");
  exactKeys(raw, ["passages"], "Candidate response");
  const expectedIds = batch.passages.map((passage) => passage.id);
  exactIdCoverage(raw.passages, expectedIds, "Candidate generation");
  const planById = new Map(analysis.passages.map((passage) => [passage.passageId, passage]));
  const byId = new Map();
  for (const rawPassage of raw.passages) {
    const plan = planById.get(rawPassage.passageId);
    protocol(record(rawPassage) && plan, "The candidate referenced an unknown passage.");
    exactKeys(rawPassage, ["passageId", "layer", "text", "preservedAtomIds"], `Candidate passage ${rawPassage.passageId}`);
    protocol(LAYERS.has(rawPassage.layer), `The candidate returned an invalid layer for ${rawPassage.passageId}.`);
    byId.set(rawPassage.passageId, Object.freeze({
      passageId: rawPassage.passageId,
      layer: rawPassage.layer,
      text: stringValue(rawPassage.text, `Candidate ${rawPassage.passageId}`, { maximum: 2_800 }),
      preservedAtomIds: uniqueStrings(rawPassage.preservedAtomIds, `Candidate ${rawPassage.passageId} atom claims`, 24),
    }));
  }
  return Object.freeze({ passages: Object.freeze(expectedIds.map((id) => byId.get(id))) });
}

function normalizeVerification(
  raw,
  batch,
  analysis,
  deterministicFindings,
) {
  protocol(record(raw) && DECISIONS.has(raw.decision), "The verifier returned an invalid decision.");
  exactKeys(raw, ["decision", "failedGates", "passages", "issues", "questions"], "Verification response");
  const failedGates = uniqueStrings(raw.failedGates, "Verifier failed gates", LATTICE_VERIFICATION_GATES.length);
  protocol(failedGates.every((name) => LATTICE_VERIFICATION_GATES.includes(name)), "The verifier returned an unknown failed gate.");
  const failedGateSet = new Set(failedGates);
  const gates = Object.fromEntries(LATTICE_VERIFICATION_GATES.map((name) => [name, !failedGateSet.has(name)]));

  const expectedIds = batch.passages.map((passage) => passage.id);
  exactIdCoverage(raw.passages, expectedIds, "Verification");
  const sourceById = new Map(batch.passages.map((passage) => [passage.id, passage]));
  const spansByPassage = sourceSpanLookup(batch);
  const planById = new Map(analysis.passages.map((passage) => [passage.passageId, passage]));
  const byId = new Map();
  let passageChecksPass = true;
  for (const rawPassage of raw.passages) {
    protocol(record(rawPassage), "The verifier returned an invalid passage result.");
    exactKeys(rawPassage, [
      "passageId", "checkedAtomIds", "missingAtomIds", "unsupportedClaims", "unmodeledSpanIds",
      "failedChecks", "conformanceConfirmed", "conformanceEvidenceSpanIds", "independentLayer",
      "layerEvidenceAtomIds", "layerEvidenceSpanIds", "criterionChecks",
    ], `Verification passage ${rawPassage.passageId}`);
    const source = sourceById.get(rawPassage.passageId);
    const plan = planById.get(rawPassage.passageId);
    protocol(source && plan, "The verifier referenced an unknown passage.");
    const atomIds = plan.atoms.map((atom) => atom.id);
    const atomSet = new Set(atomIds);
    const checkedAtomIds = uniqueStrings(rawPassage.checkedAtomIds, `Verifier checked atoms in ${source.id}`, 24);
    const missingAtomIds = uniqueStrings(rawPassage.missingAtomIds, `Verifier missing atoms in ${source.id}`, 24);
    protocol([...checkedAtomIds, ...missingAtomIds].every((id) => atomSet.has(id)),
      `The verifier referenced an unknown atom in ${source.id}.`);
    protocol(missingAtomIds.every((id) => !checkedAtomIds.includes(id)), `The verifier both checked and omitted an atom in ${source.id}.`);
    protocol(Array.isArray(rawPassage.unsupportedClaims) && rawPassage.unsupportedClaims.length <= 8,
      `The verifier returned invalid unsupported claims in ${source.id}.`);
    const unsupportedClaims = rawPassage.unsupportedClaims.map((item) => {
      protocol(record(item), `The verifier returned an invalid unsupported claim in ${source.id}.`);
      exactKeys(item, ["claim", "evidence"], `Unsupported claim in ${source.id}`);
      return Object.freeze({
        claim: stringValue(item.claim, `Unsupported claim in ${source.id}`, { maximum: 600 }),
        evidence: stringValue(item.evidence, `Unsupported claim evidence in ${source.id}`, { empty: true, maximum: 700 }),
      });
    });
    const resolvedUnmodeled = resolveSourceSpanIds(
      rawPassage.unmodeledSpanIds,
      source.id,
      spansByPassage,
      `Verifier unmodeled spans in ${source.id}`,
      { maximum: 12 },
    );
    const failedChecks = uniqueStrings(rawPassage.failedChecks, `Verifier failed checks in ${source.id}`, LATTICE_PASSAGE_VERIFICATION_CHECKS.length);
    protocol(failedChecks.every((name) => LATTICE_PASSAGE_VERIFICATION_CHECKS.includes(name)),
      `The verifier returned an unknown failed passage check in ${source.id}.`);
    protocol(typeof rawPassage.conformanceConfirmed === "boolean", `Verifier conformance result is invalid in ${source.id}.`);
    const failedCheckSet = new Set(failedChecks);
    const booleans = Object.fromEntries(LATTICE_PASSAGE_VERIFICATION_CHECKS.map((name) => [name, !failedCheckSet.has(name)]));
    protocol(LAYERS.has(rawPassage.independentLayer), `Verifier layer result is invalid in ${source.id}.`);
    const layerEvidenceAtomIds = uniqueStrings(rawPassage.layerEvidenceAtomIds, `Verifier layer-evidence atoms in ${source.id}`, 24);
    protocol(layerEvidenceAtomIds.length > 0 && layerEvidenceAtomIds.every((id) => atomSet.has(id)),
      `Verifier layer evidence references an unknown atom in ${source.id}.`);
    const resolvedLayerEvidence = resolveSourceSpanIds(
      rawPassage.layerEvidenceSpanIds,
      source.id,
      spansByPassage,
      `Verifier layer-evidence spans in ${source.id}`,
      { minimum: 1, maximum: MODEL_SOURCE_SPAN_LIMIT },
    );
    const layerAtomEvidenceIds = new Set(plan.atoms
      .filter(({ id }) => layerEvidenceAtomIds.includes(id))
      .flatMap(({ evidenceSpanIds }) => evidenceSpanIds));
    const layerEvidenceGrounded = resolvedLayerEvidence.ids.every((id) => layerAtomEvidenceIds.has(id));
    booleans.registerFit &&= rawPassage.independentLayer === plan.layer && layerEvidenceGrounded;
    const resolvedConformance = resolveSourceSpanIds(
      rawPassage.conformanceEvidenceSpanIds,
      source.id,
      spansByPassage,
      `Verifier conformance spans in ${source.id}`,
      { maximum: MODEL_SOURCE_SPAN_LIMIT },
    );
    protocol(Array.isArray(rawPassage.criterionChecks) && rawPassage.criterionChecks.length <= 6,
      `Verifier criterion checks in ${source.id} must be a bounded list.`);
    const checkedCriteria = new Set();
    const criterionChecks = rawPassage.criterionChecks.map((rawCheck, criterionIndex) => {
      protocol(record(rawCheck), `Verifier criterion check ${criterionIndex + 1} in ${source.id} is invalid.`);
      exactKeys(rawCheck, ["criterion", "passed", "evidenceSpanIds"], `Verifier criterion check ${criterionIndex + 1} in ${source.id}`);
      protocol(CONFORMANCE_CRITERIA.has(rawCheck.criterion),
        `Verifier criterion check ${criterionIndex + 1} in ${source.id} names an unknown criterion.`);
      protocol(!checkedCriteria.has(rawCheck.criterion), `Verifier criterion checks in ${source.id} repeat a criterion.`);
      protocol(typeof rawCheck.passed === "boolean", `Verifier criterion check ${rawCheck.criterion} in ${source.id} is invalid.`);
      checkedCriteria.add(rawCheck.criterion);
      const resolved = resolveSourceSpanIds(
        rawCheck.evidenceSpanIds,
        source.id,
        spansByPassage,
        `Verifier criterion check ${rawCheck.criterion} evidence in ${source.id}`,
        { minimum: rawCheck.passed ? 1 : 0, maximum: MODEL_SOURCE_SPAN_LIMIT },
      );
      return Object.freeze({
        criterion: rawCheck.criterion,
        passed: rawCheck.passed,
        evidenceSpanIds: resolved.ids,
        evidence: resolved.evidence,
      });
    });
    const unmodeledEvidence = resolvedUnmodeled.evidence;
    const conformanceEvidence = resolvedConformance.evidence;
    const checkedComplete = atomIds.length === checkedAtomIds.length && atomIds.every((id) => checkedAtomIds.includes(id));
    const materialityPasses = plan.disposition !== "rewrite" || booleans.materiality;
    const requiresPositiveConformance = plan.disposition === "retain-if-conformant";
    const requiredCriteria = [...LATTICE_CONFORMANCE_CRITERIA.universal, ...LATTICE_CONFORMANCE_CRITERIA[plan.layer]];
    const criterionEvidenceIds = new Set(criterionChecks.flatMap(({ evidenceSpanIds }) => evidenceSpanIds));
    const positiveCriterionChecks = criterionChecks.length === requiredCriteria.length
      && requiredCriteria.every((criterion) => criterionChecks.some((check) => check.criterion === criterion && check.passed));
    const completeCriterionEvidence = hasCompleteSpanCoverage([...criterionEvidenceIds], spansByPassage.get(source.id));
    const independentlyConfirmedConformance = rawPassage.conformanceConfirmed
      && positiveCriterionChecks
      && completeCriterionEvidence
      && hasCompleteSpanCoverage(resolvedConformance.ids, spansByPassage.get(source.id));
    booleans.conformanceConfirmed = independentlyConfirmedConformance;
    const positiveConformance = !requiresPositiveConformance || independentlyConfirmedConformance;
    if (!requiresPositiveConformance) {
      protocol(rawPassage.conformanceConfirmed === false
        && resolvedConformance.ids.length === 0
        && criterionChecks.length === 0,
      `Verifier rewrite result ${source.id} must not claim unchanged-text conformance.`);
    }
    const passes = checkedComplete && missingAtomIds.length === 0 && unsupportedClaims.length === 0
      && unmodeledEvidence.length === 0 && booleans.semanticFidelity && booleans.safety
      && booleans.accessibility && booleans.clarity && booleans.domainCorrectness
      && booleans.registerFit && booleans.planFit && booleans.boundaryFidelity
      && materialityPasses && positiveConformance;
    passageChecksPass &&= passes;
    if (!booleans.registerFit) gates.registerFit = false;
    byId.set(source.id, Object.freeze({
      passageId: source.id,
      checkedAtomIds,
      missingAtomIds,
      unsupportedClaims: Object.freeze(unsupportedClaims),
      unmodeledSpanIds: resolvedUnmodeled.ids,
      unmodeledEvidence,
      conformanceEvidenceSpanIds: resolvedConformance.ids,
      conformanceEvidence,
      independentLayer: rawPassage.independentLayer,
      layerEvidenceAtomIds,
      layerEvidenceSpanIds: resolvedLayerEvidence.ids,
      layerEvidence: resolvedLayerEvidence.evidence,
      layerEvidenceGrounded,
      criterionChecks: Object.freeze(criterionChecks),
      requiresPositiveConformance,
      ...booleans,
      complete: passes,
    }));
  }

  protocol(Array.isArray(raw.issues) && raw.issues.length <= 24, "Verifier issues must be a bounded list.");
  const allAtomIds = new Set(analysis.passages.flatMap((passage) => passage.atoms.map((atom) => atom.id)));
  const issues = raw.issues.map((rawIssue, index) => {
    protocol(record(rawIssue), `Verifier issue ${index + 1} is invalid.`);
    exactKeys(rawIssue, ["id", "check", "passageId", "atomIds", "message"], `Verifier issue ${index + 1}`);
    protocol(VERIFICATION_ISSUE_CHECKS.has(rawIssue.check), "A verifier issue names an unknown check.");
    const passageId = stringValue(rawIssue.passageId, "Verifier issue passage", { empty: true, maximum: 120 });
    protocol(passageId === "" || sourceById.has(passageId), "A verifier issue references an unknown passage.");
    const checkFailedGlobally = failedGateSet.has(rawIssue.check);
    const checkFailedLocally = passageId !== "" && byId.get(passageId)?.[rawIssue.check] === false;
    protocol(checkFailedGlobally || checkFailedLocally, "A verifier issue must identify a failed gate or passage check.");
    const atomIds = uniqueStrings(rawIssue.atomIds, "Verifier issue atoms", 12);
    protocol(atomIds.every((id) => allAtomIds.has(id)), "A verifier issue references an unknown atom.");
    stringValue(rawIssue.id, "Verifier issue identifier", { maximum: 120 });
    stringValue(rawIssue.message, "Verifier issue message", { maximum: 800 });
    return Object.freeze({
      id: `verifier:${rawIssue.check}:${passageId || "document"}`,
      check: rawIssue.check,
      passageId,
      atomIds,
      message: VERIFICATION_CHECK_MESSAGES[rawIssue.check]
        ?? "The independent check did not clear a required condition.",
    });
  });
  protocol(Array.isArray(raw.questions) && raw.questions.length === 0,
    "Independent verification cannot return visible clarification text.");
  const questions = Object.freeze([]);
  const allGatesPass = LATTICE_VERIFICATION_GATES.every((name) => gates[name]);
  const reportedChecksPass = allGatesPass && passageChecksPass && issues.length === 0 && questions.length === 0;
  // A model may overlook the contradiction encoded by its own detailed
  // evidence (for example, independently selecting a different layer while
  // claiming acceptance). Preserve that evidence as a binding repair result
  // so structural failures can be re-atomized; never promote a negative model
  // decision when its detailed result is actually all-positive.
  const decision = raw.decision === "accept" && !reportedChecksPass ? "repair" : raw.decision;
  if (decision === "accept") {
    protocol(reportedChecksPass, "The verifier accepted while reporting a failed check, issue, or question.");
  } else {
    protocol(!reportedChecksPass,
      `The verifier returned ${decision} without a failed gate, passage check, issue, or unresolved question.`);
  }
  const accepted = deterministicFindings.length === 0 && decision === "accept" && allGatesPass
    && passageChecksPass && issues.length === 0 && questions.length === 0;
  return Object.freeze({
    decision,
    gates: Object.freeze(gates),
    passages: Object.freeze(expectedIds.map((id) => byId.get(id))),
    issues: Object.freeze(issues),
    questions,
    accepted,
    available: true,
  });
}

function normalizeDocumentCertification(raw, expected) {
  protocol(record(raw) && DOCUMENT_CERTIFICATION_DECISIONS.has(raw.decision), "The document certifier returned an invalid decision.");
  protocol(record(expected), "The host did not bind the document certification response to an obligation.");
  exactKeys(raw, ["certificateId", "obligationIds", "decision", "checks", "issues"], "Document certification response");
  protocol(raw.certificateId === expected.certificateId, "The document certifier returned a mismatched certificate identifier.");
  const obligationIds = uniqueStrings(raw.obligationIds, "Document certification obligation identifiers", 24);
  protocol(obligationIds.length === expected.obligationIds.length
    && expected.obligationIds.every((id) => obligationIds.includes(id)),
  "The document certifier did not cover every requested obligation exactly once.");
  protocol(record(raw.checks), "The document certifier returned invalid checks.");
  exactKeys(raw.checks, LATTICE_DOCUMENT_CERTIFICATION_CHECKS, "Document certification checks");
  const checks = {};
  for (const name of LATTICE_DOCUMENT_CERTIFICATION_CHECKS) {
    protocol(typeof raw.checks[name] === "boolean", `Document certification check ${name} is invalid.`);
    checks[name] = raw.checks[name];
  }
  protocol(Array.isArray(raw.issues) && raw.issues.length <= 6, "Document certification issues must be a bounded list.");
  const issueIds = new Set();
  const issues = raw.issues.map((rawIssue, index) => {
    protocol(record(rawIssue), `Document certification issue ${index + 1} is invalid.`);
    exactKeys(rawIssue, ["id", "check", "message"], `Document certification issue ${index + 1}`);
    const rawId = stringValue(rawIssue.id, "Document certification issue identifier", { maximum: 80 });
    protocol(!issueIds.has(rawId), `Document certification issue ${rawId} is duplicated.`);
    issueIds.add(rawId);
    protocol(DOCUMENT_CERTIFICATION_CHECKS.has(rawIssue.check), `Document certification issue ${rawId} names an unknown check.`);
    stringValue(rawIssue.message, `Document certification issue ${rawId}`, { maximum: 240 });
    return Object.freeze({
      id: `document-certification:${rawIssue.check}`,
      check: rawIssue.check,
      message: CERTIFICATION_CHECK_MESSAGES[rawIssue.check]
        ?? "The independent document check did not clear a required condition.",
    });
  });
  protocol(issues.every(({ check }) => checks[check] === false), "A document certification issue must identify a failed check.");
  const allChecksPass = LATTICE_DOCUMENT_CERTIFICATION_CHECKS.every((name) => checks[name]);
  protocol(raw.decision === "accept" ? allChecksPass && issues.length === 0 : !allChecksPass,
    "The document certification decision contradicts its checks or issues.");
  const accepted = raw.decision === "accept";
  return Object.freeze({
    decision: raw.decision,
    checks: Object.freeze(checks),
    boundaryFidelity: checks.boundaryFidelity,
    issues: Object.freeze(issues),
    accepted,
  });
}

function clarificationAnswersPayload(value) {
  if (value === undefined || value === null) return Object.freeze([]);
  protocol(Array.isArray(value) && value.length <= CLARIFICATION_HISTORY_LIMIT,
    "Text to Lattice reached its bounded clarification limit; begin a new run.");
  const deduplicated = new Map();
  for (const answer of value) {
    if (!record(answer)
      || typeof answer.questionId !== "string"
      || typeof answer.questionFingerprint !== "string"
      || typeof answer.sourceFingerprint !== "string"
      || typeof answer.analysisRevisionId !== "string"
      || typeof answer.questionStage !== "string"
      || typeof answer.passageId !== "string"
      || typeof answer.answer !== "string") continue;
    validateLatticeClarificationAnswer(answer.answer);
    const candidateFingerprint = typeof answer.candidateFingerprint === "string"
      ? answer.candidateFingerprint
      : "";
    if (!QUESTION_FINGERPRINT_PATTERN.test(answer.questionFingerprint)
      || !SOURCE_FINGERPRINT_PATTERN.test(answer.sourceFingerprint)
      || !ANALYSIS_REVISION_ID_PATTERN.test(answer.analysisRevisionId)
      || candidateFingerprint && !CANDIDATE_FINGERPRINT_PATTERN.test(candidateFingerprint)) continue;
    const normalized = Object.freeze({
      questionId: stringValue(answer.questionId, "Clarification answer question", { maximum: 300 }),
      questionFingerprint: answer.questionFingerprint,
      sourceFingerprint: answer.sourceFingerprint,
      analysisRevisionId: answer.analysisRevisionId,
      questionStage: stringValue(answer.questionStage, "Clarification answer stage", { maximum: 180 }),
      candidateFingerprint,
      passageId: stringValue(answer.passageId, "Clarification answer passage", { maximum: 120 }),
      answer: answer.answer,
    });
    const key = [
      normalized.sourceFingerprint,
      normalized.analysisRevisionId,
      normalized.questionStage,
      normalized.candidateFingerprint,
      normalized.questionId,
      normalized.questionFingerprint,
    ].join("\u241f");
    deduplicated.set(key, normalized);
  }
  return Object.freeze([...deduplicated.values()]);
}

export function clarificationAnswerForQuestion(question, clarificationAnswers) {
  if (!record(question) || !Array.isArray(clarificationAnswers)) return null;
  const matched = clarificationAnswers.find((answer) => (
    answer.questionId === question.id
    && answer.questionFingerprint === question.fingerprint
    && answer.sourceFingerprint === question.sourceFingerprint
    && answer.analysisRevisionId === question.analysisRevisionId
    && answer.questionStage === question.questionStage
    && answer.passageId === question.passageId
    && (answer.candidateFingerprint || "") === (question.candidateFingerprint || "")
  ));
  if (!matched) return null;
  const modelAnswer = Object.freeze({
    passageId: question.passageId,
    prompt: question.prompt,
    answer: matched.answer,
  });
  if (latticeInertJsonUtf8Length([
    modelAnswer.passageId,
    modelAnswer.prompt,
    modelAnswer.answer,
  ]) > CLARIFICATION_MODEL_CONTEXT_UTF8_LIMIT) {
    throw new RangeError("Shorten the clarification answer before continuing.");
  }
  return modelAnswer;
}

function retryableStageFailure(error) {
  return error instanceof LatticeProtocolError
    || error instanceof SyntaxError
    || ["lattice-context", "lattice-output-length", "lattice-json", "lattice-response"].includes(error?.code);
}

function stageFeedback(stage, error, attempt) {
  return Object.freeze({
    stage,
    attempt,
    issue: String(error?.message ?? "The prior structured response failed validation.").slice(0, 360),
    instruction: "Return a complete object matching every named field, enum, identifier, and evidence constraint.",
  });
}

async function callNormalizedStage({ stage, request, invoke, normalize, signal, attempts = 2 }) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    throwIfAborted(signal);
    const currentRequest = attempt === 1
      ? request
      : Object.freeze({ ...request, protocolFeedback: stageFeedback(stage, lastError, attempt) });
    try {
      return await normalize(await invoke(currentRequest), currentRequest);
    } catch (error) {
      throwIfAborted(signal);
      if (error?.code === "lattice-context") throw error;
      if (!retryableStageFailure(error)) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new LatticeProtocolError(`The ${stage} stage did not return a valid response.`);
}

async function callClarifiableStage({ clarificationAnswers, ...stageOptions }) {
  const initial = await callNormalizedStage({
    ...stageOptions,
    request: Object.freeze({
      ...stageOptions.request,
      clarificationAnswers: Object.freeze([]),
    }),
  });
  const question = initial.questions?.[0];
  const answer = question
    ? clarificationAnswerForQuestion(question, clarificationAnswers)
    : null;
  if (!answer) return initial;
  try {
    return await callNormalizedStage({
      ...stageOptions,
      request: Object.freeze({
        ...stageOptions.request,
        clarificationAnswers: Object.freeze([answer]),
      }),
    });
  } catch (error) {
    if (error?.code === "lattice-context") {
      throw new RangeError("Shorten the clarification answer before continuing.");
    }
    throw error;
  }
}

function progress(onProgress, phase, current, total, batchId) {
  onProgress?.(Object.freeze({ phase, current, total, batchId, progress: total ? current / total : null }));
}

function activeCertificationProgress(onProgress, current, total, batchId) {
  onProgress?.(Object.freeze({
    phase: "certifying-windows",
    current,
    total,
    batchId,
    progress: total ? (current + 1) / total : null,
    text: "Checking bounded text windows",
  }));
}

function certificationWindowContext(passages, passageIndex, candidateById) {
  const entry = (index, edge) => {
    if (index < 0 || index >= passages.length) return null;
    const passage = passages[index];
    if (passage.protected === true) {
      return Object.freeze({
        passageId: passage.id,
        exactText: passage.text,
        separatorBefore: passage.separatorBefore ?? "",
        separatorAfter: passage.separatorAfter ?? "",
        protectedExact: true,
        ...(passage.hostAttestedOnly === true ? { hostAttestedOnly: true } : {}),
      });
    }
    const candidate = candidateById.get(passage.id)?.text ?? "";
    return Object.freeze({
      passageId: passage.id,
      sourceExcerpt: graphemeExcerpt(passage.text, edge),
      candidateExcerpt: graphemeExcerpt(candidate, edge),
      separatorBefore: passage.separatorBefore ?? "",
      separatorAfter: passage.separatorAfter ?? "",
    });
  };
  const protectedEntry = (passage) => Object.freeze({
    passageId: passage.id,
    exactText: passage.text,
    separatorBefore: passage.separatorBefore ?? "",
    separatorAfter: passage.separatorAfter ?? "",
    protectedExact: true,
    ...(passage.hostAttestedOnly === true ? { hostAttestedOnly: true } : {}),
  });
  const protectedBefore = [];
  let precedingIndex = passageIndex - 1;
  while (precedingIndex >= 0 && passages[precedingIndex].protected === true) {
    protectedBefore.unshift(protectedEntry(passages[precedingIndex]));
    precedingIndex -= 1;
  }
  const protectedAfter = [];
  let followingIndex = passageIndex + 1;
  while (followingIndex < passages.length && passages[followingIndex].protected === true) {
    protectedAfter.push(protectedEntry(passages[followingIndex]));
    followingIndex += 1;
  }
  return Object.freeze({
    preceding: entry(precedingIndex, "end"),
    following: entry(followingIndex, "start"),
    protectedBefore: Object.freeze(protectedBefore),
    protectedAfter: Object.freeze(protectedAfter),
  });
}

function protectedCertificationContext(passages, passageIndex, candidateById) {
  const entry = (index, edge) => {
    if (index < 0 || index >= passages.length) return null;
    const passage = passages[index];
    if (passage.protected === true) {
      return Object.freeze({
        passageId: passage.id,
        exactText: passage.text,
        separatorBefore: passage.separatorBefore ?? "",
        separatorAfter: passage.separatorAfter ?? "",
        protectedExact: true,
        ...(passage.hostAttestedOnly === true ? { hostAttestedOnly: true } : {}),
      });
    }
    return Object.freeze({
      passageId: passage.id,
      sourceExcerpt: graphemeExcerpt(passage.text, edge),
      candidateExcerpt: graphemeExcerpt(candidateById.get(passage.id)?.text ?? "", edge),
      separatorBefore: passage.separatorBefore ?? "",
      separatorAfter: passage.separatorAfter ?? "",
    });
  };
  return Object.freeze({
    preceding: entry(passageIndex - 1, "end"),
    following: entry(passageIndex + 1, "start"),
    protectedBefore: Object.freeze([]),
    protectedAfter: Object.freeze([]),
  });
}

function verifiedCertificationLedger(analyses, finalReviews) {
  const reviewsByBatch = new Map(finalReviews.map((entry) => [entry.batch.id, entry]));
  if (analyses.some((entry) => {
    const review = reviewsByBatch.get(entry.batch.id);
    return !review
      || !ANALYSIS_REVISION_ID_PATTERN.test(entry.analysisRevisionId ?? "")
      || entry.analysis.revisionId !== entry.analysisRevisionId
      || review.analysisRevisionId !== entry.analysisRevisionId
      || review.analysis?.revisionId !== entry.analysisRevisionId
      || !verificationSemanticallySafe(review);
  })) return null;
  const all = [];
  for (const entry of analyses) {
    const review = reviewsByBatch.get(entry.batch.id);
    const reviewedPassageById = new Map(review.verification.passages.map((passage) => [passage.passageId, passage]));
    for (const plan of entry.analysis.passages) {
      const checked = new Set(reviewedPassageById.get(plan.passageId)?.checkedAtomIds ?? []);
      for (const atom of plan.atoms) {
        if (!checked.has(atom.id)) return null;
        all.push(Object.freeze({
          id: atom.id,
          passageId: plan.passageId,
          kind: atom.kind,
          value: atom.value,
          priority: atom.priority,
          preservation: atom.preservation,
          ambiguity: plan.ambiguityAtomIds.includes(atom.id),
          links: atom.links,
          evidence: atom.evidence,
          independentlyVerified: true,
        }));
      }
    }
  }
  return Object.freeze(all);
}

const RELATION_CERTIFICATION_EDGE_TARGET = 12;
const RELATION_CERTIFICATION_CHARACTER_TARGET = 6_000;
function crossPassageRelationObligations(verifiedAtoms) {
  const atomById = new Map(verifiedAtoms.map((atom) => [atom.id, atom]));
  const obligations = [];
  for (const sourceAtom of verifiedAtoms) {
    for (const link of sourceAtom.links) {
      const targetAtom = atomById.get(link.targetAtomId);
      if (!targetAtom) return null;
      if (targetAtom.passageId === sourceAtom.passageId) continue;
      obligations.push(Object.freeze({
        id: `e${String(obligations.length + 1).padStart(4, "0")}`,
        relation: link.relation,
        sourceAtomId: sourceAtom.id,
        targetAtomId: targetAtom.id,
        sourcePassageId: sourceAtom.passageId,
        targetPassageId: targetAtom.passageId,
      }));
    }
  }
  return Object.freeze(obligations);
}

function certificationAtomEndpoint(atom) {
  return Object.freeze({
    id: atom.id,
    passageId: atom.passageId,
    kind: atom.kind,
    value: atom.value,
    priority: atom.priority,
    preservation: atom.preservation,
    ambiguity: atom.ambiguity,
    evidence: atom.evidence,
    independentlyVerified: atom.independentlyVerified,
  });
}

function relationCertificationRequestData(obligations, atomById, passageById, candidateById) {
  const passageIds = new Set();
  const relations = obligations.map((obligation) => {
    const sourceAtom = atomById.get(obligation.sourceAtomId);
    const targetAtom = atomById.get(obligation.targetAtomId);
    passageIds.add(obligation.sourcePassageId);
    passageIds.add(obligation.targetPassageId);
    return Object.freeze({
      ...obligation,
      sourceAtom: certificationAtomEndpoint(sourceAtom),
      targetAtom: certificationAtomEndpoint(targetAtom),
    });
  });
  const documents = [...passageIds].map((passageId) => {
    const passage = passageById.get(passageId);
    return Object.freeze({
      passageId,
      source: passage.text,
      candidate: candidateById.get(passageId)?.text ?? "",
      separatorBefore: passage.separatorBefore ?? "",
      separatorAfter: passage.separatorAfter ?? "",
    });
  });
  return Object.freeze({ relations: Object.freeze(relations), documents: Object.freeze(documents) });
}

function packRelationCertificationJobs(obligations, atomById, passageById, candidateById) {
  const jobs = [];
  let current = [];
  const finish = () => {
    if (current.length === 0) return;
    jobs.push(Object.freeze(current));
    current = [];
  };
  for (const obligation of obligations) {
    const proposed = [...current, obligation];
    const payload = relationCertificationRequestData(proposed, atomById, passageById, candidateById);
    if (current.length > 0 && (
      proposed.length > RELATION_CERTIFICATION_EDGE_TARGET
      || JSON.stringify(payload).length > RELATION_CERTIFICATION_CHARACTER_TARGET
    )) finish();
    current.push(obligation);
  }
  finish();
  return Object.freeze(jobs);
}

function passageCertificationRequest(passages, passage, index, candidateById, analysisByPassage, signal) {
  const planned = analysisByPassage.get(passage.id);
  const candidate = candidateById.get(passage.id)?.text;
  if (typeof candidate !== "string" || !planned) return null;
  const obligationId = `passage:${passage.id}`;
  const boundaryIds = Object.freeze([
    ...(index > 0 ? [`boundary:${passages[index - 1].id}:${passage.id}`] : []),
    ...(index + 1 < passages.length ? [`boundary:${passage.id}:${passages[index + 1].id}`] : []),
  ]);
  return Object.freeze({
    scope: "window",
    certificateId: `certificate:${obligationId}`,
    obligationIds: Object.freeze([obligationId, ...boundaryIds]),
    window: Object.freeze({
      id: `w${String(index + 1).padStart(3, "0")}`,
      index: index + 1,
      total: passages.length,
      passageId: passage.id,
      boundaryIds,
      ...(passage.directionFrames?.length ? { directionFrames: passage.directionFrames } : {}),
    }),
    source: passage.text,
    candidate,
    sourceBoundary: Object.freeze({
      separatorBefore: passage.separatorBefore ?? "",
      separatorAfter: passage.separatorAfter ?? "",
    }),
    context: certificationWindowContext(passages, index, candidateById),
    analysis: Object.freeze({
      documentKind: planned.entry.analysis.documentKind,
      passages: Object.freeze([planned.plan]),
    }),
    signal,
  });
}

function protectedPassageCertificationRequest(passages, passage, index, candidateById, signal) {
  const obligationId = `passage:${passage.id}`;
  const boundaryIds = Object.freeze([
    ...(index > 0 ? [`boundary:${passages[index - 1].id}:${passage.id}`] : []),
    ...(index + 1 < passages.length ? [`boundary:${passage.id}:${passages[index + 1].id}`] : []),
  ]);
  return Object.freeze({
    scope: "window",
    certificateId: `certificate:${obligationId}`,
    obligationIds: Object.freeze([obligationId, ...boundaryIds]),
    window: Object.freeze({
      id: `w${String(index + 1).padStart(3, "0")}`,
      index: index + 1,
      total: passages.length,
      passageId: passage.id,
      protectedExact: true,
      boundaryIds,
      ...(passage.directionFrames?.length ? { directionFrames: passage.directionFrames } : {}),
    }),
    protectedExactSource: passage.text,
    ...(passage.hostAttestedOnly === true ? { hostAttestedOnly: true } : {}),
    sourceBoundary: Object.freeze({
      separatorBefore: passage.separatorBefore ?? "",
      separatorAfter: passage.separatorAfter ?? "",
    }),
    context: protectedCertificationContext(passages, index, candidateById),
    signal,
  });
}

function relationCertificationRequest(obligations, atomById, passageById, candidateById, signal) {
  const data = relationCertificationRequestData(obligations, atomById, passageById, candidateById);
  const obligationIds = Object.freeze(obligations.map(({ id }) => id));
  return Object.freeze({
    scope: "relations",
    certificateId: `certificate:relations:${obligationIds[0]}-${obligationIds.at(-1)}`,
    obligationIds,
    relations: data.relations,
    endpointPassages: data.documents,
    signal,
  });
}

async function prepareWindowCertificationPlan({ passages, analyses, finalCandidates, verifiedAtoms, adapter, signal }) {
  const candidateById = new Map(finalCandidates
    .flatMap((entry) => entry.candidate.passages)
    .map((passage) => [passage.passageId, passage]));
  const passageById = new Map(passages.map((passage) => [passage.id, passage]));
  const atomById = new Map(verifiedAtoms.map((atom) => [atom.id, atom]));
  const analysisByPassage = new Map();
  for (const entry of analyses) {
    for (const plan of entry.analysis.passages) analysisByPassage.set(plan.passageId, { entry, plan });
  }
  const passageRequests = passages
    .map((passage, index) => passage.protected === true
      ? protectedPassageCertificationRequest(passages, passage, index, candidateById, signal)
      : passageCertificationRequest(passages, passage, index, candidateById, analysisByPassage, signal))
    .filter(Boolean);
  if (passageRequests.length !== passages.length) return null;
  const relationObligations = crossPassageRelationObligations(verifiedAtoms);
  if (relationObligations === null) return null;
  let relationJobs = [...packRelationCertificationJobs(
    relationObligations,
    atomById,
    passageById,
    candidateById,
  )];
  if (typeof adapter.certificationFits === "function") {
    for (const request of passageRequests) {
      if (await adapter.certificationFits(request) !== true) return null;
    }
    const queue = [...relationJobs];
    relationJobs = [];
    while (queue.length > 0) {
      throwIfAborted(signal);
      const obligations = queue.shift();
      const request = relationCertificationRequest(obligations, atomById, passageById, candidateById, signal);
      if (await adapter.certificationFits(request) === true) {
        relationJobs.push(obligations);
        continue;
      }
      if (obligations.length === 1) return null;
      const midpoint = Math.ceil(obligations.length / 2);
      queue.unshift(
        Object.freeze(obligations.slice(0, midpoint)),
        Object.freeze(obligations.slice(midpoint)),
      );
    }
  }
  return Object.freeze({
    passageRequests: Object.freeze(passageRequests),
    relationJobs: Object.freeze(relationJobs),
    completionReservation: (passageRequests.length + relationJobs.length) * 2,
  });
}

function certificationCoverageFinding(message) {
  return Object.freeze({
    id: "document-certification-window-coverage",
    passageId: "",
    atomIds: Object.freeze([]),
    message,
  });
}

function certificationIssueFinding(issue, scope, passageId = "", atomIds = Object.freeze([])) {
  return Object.freeze({
    id: `document-certification-${scope}-${issue.check}`,
    passageId,
    atomIds: Object.freeze([...atomIds]),
    message: CERTIFICATION_CHECK_MESSAGES[issue.check]
      ?? "The independent document check did not clear a required condition.",
  });
}

function closedVerifiedCertificationAtoms(analyses, finalReviews) {
  const verifiedAtoms = verifiedCertificationLedger(analyses, finalReviews);
  if (verifiedAtoms === null) return null;
  const atomIds = new Set(verifiedAtoms.map(({ id }) => id));
  if (atomIds.size !== verifiedAtoms.length || verifiedAtoms.some((atom) => (
    atom.links.some(({ targetAtomId }) => !atomIds.has(targetAtomId))
  ))) return null;
  return verifiedAtoms;
}

async function certifyDocumentWindows({ source, candidate: assembledCandidate, passages, analyses, finalCandidates, finalReviews, adapter, signal, onProgress, preparedPlan = null }) {
  const candidateById = new Map(finalCandidates
    .flatMap((entry) => entry.candidate.passages)
    .map((passage) => [passage.passageId, passage]));
  const passageById = new Map(passages.map((passage) => [passage.id, passage]));
  const analysisByPassage = new Map();
  for (const entry of analyses) {
    for (const plan of entry.analysis.passages) {
      analysisByPassage.set(plan.passageId, { entry, plan });
    }
  }
  const verifiedAtoms = verifiedCertificationLedger(analyses, finalReviews);
  const findings = [];
  const certifiedPassageIds = new Set();
  const certifiedAtomIds = new Set();
  const certifiedRelationIds = new Set();
  const expectedPassageIds = passages.map(({ id }) => id);
  const expectedBoundaryIds = passages.slice(0, -1).map((passage, index) => (
    `boundary:${passage.id}:${passages[index + 1].id}`
  ));
  const expectedBoundaryPassages = new Map(passages.slice(0, -1).map((passage, index) => [
    expectedBoundaryIds[index],
    Object.freeze([passage.id, passages[index + 1].id]),
  ]));
  const certifiedBoundarySides = new Map(expectedBoundaryIds.map((id) => [id, new Set()]));
  const certifiedBoundaryIds = new Set();
  const replaceablePassages = passages.filter((passage) => passage.protected !== true);
  const replacementRecords = finalCandidates.flatMap((entry) => entry.candidate.passages);
  const sourceLayoutValid = passageById.size === passages.length
    && passages.every((passage, index) => (
      source.slice(passage.startUtf16, passage.endUtf16) === passage.text
      && (index === 0 || passages[index - 1].endUtf16 <= passage.startUtf16)
    ));
  let exactAssembly = null;
  try {
    exactAssembly = reassembleLatticeSource(source, passages, replacementRecords);
  } catch {
    exactAssembly = null;
  }
  const candidateCoverageValid = candidateById.size === replaceablePassages.length
    && replacementRecords.length === replaceablePassages.length
    && replaceablePassages.every(({ id }) => candidateById.has(id));
  if (!sourceLayoutValid || !candidateCoverageValid || exactAssembly !== assembledCandidate || verifiedAtoms === null) {
    return Object.freeze({
      accepted: false,
      required: true,
      performed: false,
      windowed: true,
      findings: Object.freeze([certificationCoverageFinding(
        "The host could not establish a complete exact source, candidate, atom, and verifier obligation plan.",
      )]),
    });
  }

  const atomById = new Map(verifiedAtoms.map((atom) => [atom.id, atom]));
  const verifiedPlanValid = atomById.size === verifiedAtoms.length && verifiedAtoms.every((atom) => {
    const passage = passageById.get(atom.passageId);
    return passage
      && Array.isArray(atom.evidence)
      && atom.evidence.length > 0
      && atom.evidence.every((item) => (
        item.passageId === atom.passageId
        && Number.isSafeInteger(item.startUtf16)
        && Number.isSafeInteger(item.endUtf16)
        && item.startUtf16 >= 0
        && item.endUtf16 > item.startUtf16
        && passage.text.slice(item.startUtf16, item.endUtf16) === item.text
      ))
      && atom.links.every(({ targetAtomId }) => atomById.has(targetAtomId));
  });
  if (!verifiedPlanValid) {
    return Object.freeze({
      accepted: false,
      required: true,
      performed: false,
      windowed: true,
      findings: Object.freeze([certificationCoverageFinding(
        "The verified atom graph contained a dangling relation or invalid source-evidence record.",
      )]),
    });
  }
  const expectedAtomIds = verifiedAtoms.map(({ id }) => id);
  const relationObligations = crossPassageRelationObligations(verifiedAtoms);
  if (relationObligations === null) {
    return Object.freeze({
      accepted: false,
      required: true,
      performed: false,
      windowed: true,
      findings: Object.freeze([certificationCoverageFinding(
        "The verified atom graph contained a dangling cross-passage relation.",
      )]),
    });
  }
  const expectedRelationIds = relationObligations.map(({ id }) => id);
  const modelPassageIndexes = passages.map((passage, index) => ({ passage, index }));
  const certificationPlan = preparedPlan ?? await prepareWindowCertificationPlan({
    passages,
    analyses,
    finalCandidates,
    verifiedAtoms,
    adapter,
    signal,
  });
  if (!certificationPlan) {
    return Object.freeze({
      accepted: false,
      required: true,
      performed: false,
      windowed: true,
      findings: Object.freeze([certificationCoverageFinding(
        "At least one complete certification obligation could not fit the independent local context.",
      )]),
    });
  }
  const plannedPassageRequests = new Map(certificationPlan.passageRequests.map((request) => (
    [request.window.passageId, request]
  )));
  const relationJobs = [...certificationPlan.relationJobs];
  const plannedRelationIds = relationJobs.flatMap((job) => job.map(({ id }) => id));
  if (plannedPassageRequests.size !== modelPassageIndexes.length
    || plannedRelationIds.length !== expectedRelationIds.length
    || new Set(plannedRelationIds).size !== plannedRelationIds.length
    || !expectedRelationIds.every((id) => plannedRelationIds.includes(id))) {
    return Object.freeze({
      accepted: false,
      required: true,
      performed: false,
      windowed: true,
      findings: Object.freeze([certificationCoverageFinding(
        "The context-fitted certification plan lost or duplicated a host-enumerated obligation.",
      )]),
    });
  }
  if (typeof adapter.completionCapacity === "function") {
    const capacity = adapter.completionCapacity();
    const remaining = record(capacity) && Number.isSafeInteger(capacity.remaining) ? capacity.remaining : -1;
    if (remaining < certificationPlan.completionReservation) {
      return Object.freeze({
        accepted: false,
        required: true,
        performed: false,
        windowed: true,
        findings: Object.freeze([certificationCoverageFinding(
          "The remaining local completion budget could not cover every certification obligation.",
        )]),
      });
    }
  }

  for (let modelIndex = 0; modelIndex < modelPassageIndexes.length; modelIndex += 1) {
    throwIfAborted(signal);
    const { passage } = modelPassageIndexes[modelIndex];
    const planned = analysisByPassage.get(passage.id);
    const request = plannedPassageRequests.get(passage.id);
    if (!request || (passage.protected !== true && !planned)) {
      findings.push(Object.freeze({
        id: "document-certification-window-coverage",
        passageId: passage.id,
        atomIds: Object.freeze([]),
        message: "A required lossless certification window lacked a fully verified candidate or relational ledger.",
      }));
      continue;
    }
    activeCertificationProgress(onProgress, modelIndex, modelPassageIndexes.length, request.window.id);
    try {
      const certification = await callNormalizedStage({
        stage: "document-window-certification",
        request,
        invoke: (currentRequest) => adapter.certify(currentRequest),
        normalize: (raw) => normalizeDocumentCertification(raw, request),
        signal,
        attempts: 1,
      });
      if (certification.accepted) {
        certifiedPassageIds.add(passage.id);
        for (const atom of planned?.plan.atoms ?? []) certifiedAtomIds.add(atom.id);
        if (certification.boundaryFidelity) {
          for (const boundaryId of request.window.boundaryIds) {
            const requiredPassages = expectedBoundaryPassages.get(boundaryId);
            if (!requiredPassages || !requiredPassages.includes(passage.id)) {
              findings.push(certificationCoverageFinding(
                "A document window returned an unknown boundary obligation.",
              ));
              break;
            }
            certifiedBoundarySides.get(boundaryId).add(passage.id);
          }
        }
      } else {
        findings.push(...certification.issues.map((issue) => (
          certificationIssueFinding(issue, "window", passage.id)
        )));
        if (certification.issues.length === 0) {
          findings.push(Object.freeze({
            id: "document-certification-window-rejected",
            passageId: passage.id,
            atomIds: Object.freeze([]),
            message: "An independent lossless document window did not preserve its source meaning and boundaries.",
          }));
        }
      }
    } catch (error) {
      throwIfAborted(signal);
      findings.push(Object.freeze({
        id: error?.code === "lattice-context"
          ? "document-certification-window-context"
          : "document-certification-window-unavailable",
        passageId: passage.id,
        atomIds: Object.freeze([]),
        message: error?.code === "lattice-context"
          ? "A required lossless document window did not fit the independent local check."
          : "A required lossless document window did not return a valid independent check.",
      }));
    }
  }

  for (const [boundaryId, requiredPassages] of expectedBoundaryPassages) {
    const certifiedPassages = certifiedBoundarySides.get(boundaryId);
    if (requiredPassages.every((passageId) => certifiedPassages?.has(passageId))) {
      certifiedBoundaryIds.add(boundaryId);
    }
  }

  if (findings.length === 0 && relationJobs.length > 0) {
    const queue = relationJobs.map((obligations) => ({ obligations }));
    let completedRelations = 0;
    while (queue.length > 0) {
      throwIfAborted(signal);
      if (typeof adapter.completionCapacity === "function") {
        const capacity = adapter.completionCapacity();
        const remaining = record(capacity) && Number.isSafeInteger(capacity.remaining) ? capacity.remaining : -1;
        if (remaining < queue.length * 2) {
          findings.push(certificationCoverageFinding(
            "The remaining local completion budget could not cover every context-bounded relation job after splitting.",
          ));
          break;
        }
      }
      const { obligations } = queue.shift();
      const request = relationCertificationRequest(obligations, atomById, passageById, candidateById, signal);
      const { obligationIds } = request;
      progress(
        onProgress,
        "certifying-relations",
        completedRelations,
        completedRelations + obligations.length + queue.reduce((sum, job) => sum + job.obligations.length, 0),
        request.certificateId,
      );
      try {
        const certification = await callNormalizedStage({
          stage: "document-relation-certification",
          request,
          invoke: (currentRequest) => adapter.certify(currentRequest),
          normalize: (raw) => normalizeDocumentCertification(raw, request),
          signal,
          attempts: 1,
        });
        if (certification.accepted) {
          for (const obligationId of obligationIds) {
            if (certifiedRelationIds.has(obligationId)) {
              findings.push(certificationCoverageFinding("A cross-passage relation obligation was certified more than once."));
              break;
            }
            certifiedRelationIds.add(obligationId);
          }
          completedRelations += obligationIds.length;
        } else {
          findings.push(...certification.issues.map((issue) => certificationIssueFinding(
            issue,
            "relation",
            "",
            obligations.flatMap(({ sourceAtomId, targetAtomId }) => [sourceAtomId, targetAtomId]),
          )));
          if (certification.issues.length === 0) {
            findings.push(Object.freeze({
              id: "document-certification-relation-rejected",
              passageId: "",
              atomIds: Object.freeze(obligations.flatMap(({ sourceAtomId, targetAtomId }) => [sourceAtomId, targetAtomId])),
              message: "An independent cross-passage relation check rejected the candidate.",
            }));
          }
        }
      } catch (error) {
        throwIfAborted(signal);
        const capacityFailure = ["lattice-context", "lattice-output-length"].includes(error?.code);
        if (capacityFailure && obligations.length > 1) {
          const midpoint = Math.ceil(obligations.length / 2);
          const left = Object.freeze(obligations.slice(0, midpoint));
          const right = Object.freeze(obligations.slice(midpoint));
          const parentIds = obligationIds;
          const childIds = [...left, ...right].map(({ id }) => id);
          if (new Set(childIds).size !== parentIds.length || !parentIds.every((id) => childIds.includes(id))) {
            findings.push(certificationCoverageFinding("A bounded relation split lost or duplicated an obligation."));
            break;
          }
          queue.unshift({ obligations: left }, { obligations: right });
          continue;
        }
        findings.push(Object.freeze({
          id: capacityFailure
            ? "document-certification-relation-context"
            : "document-certification-relation-unavailable",
          passageId: "",
          atomIds: Object.freeze(obligations.flatMap(({ sourceAtomId, targetAtomId }) => [sourceAtomId, targetAtomId])),
          message: capacityFailure
            ? "A required cross-passage relation obligation did not fit the independent local check."
            : "A required cross-passage relation obligation did not return a valid independent check.",
        }));
      }
      if (findings.length > 0) break;
    }
  }

  const completeCoverage = expectedPassageIds.length === certifiedPassageIds.size
    && expectedPassageIds.every((id) => certifiedPassageIds.has(id))
    && expectedAtomIds.length === certifiedAtomIds.size
    && expectedAtomIds.every((id) => certifiedAtomIds.has(id))
    && expectedRelationIds.length === certifiedRelationIds.size
    && expectedRelationIds.every((id) => certifiedRelationIds.has(id))
    && expectedBoundaryIds.length === certifiedBoundaryIds.size
    && expectedBoundaryIds.every((id) => certifiedBoundaryIds.has(id));
  if (!completeCoverage) {
    findings.push(Object.freeze({
      id: "document-certification-window-coverage",
      passageId: "",
      atomIds: Object.freeze([]),
      message: "The independent window checks did not affirm every passage, atom, relation, and two-sided structural boundary.",
    }));
  }
  return Object.freeze({
    accepted: completeCoverage && findings.length === 0,
    required: true,
    performed: true,
    windowed: true,
    findings: Object.freeze(findings),
  });
}

async function certifyWholeDocument({
  source,
  candidate,
  batchCount,
  protectedPassageCount = 0,
  passages = [],
  analyses = [],
  finalCandidates = [],
  finalReviews = [],
  adapter,
  signal,
  onProgress,
  forceRequired = false,
}) {
  const required = forceRequired
    || batchCount > 1
    || protectedPassageCount > 0
    || /[\r\n\u2028\u2029]/u.test(source);
  if (!required) {
    return Object.freeze({ accepted: true, required: false, performed: false, findings: Object.freeze([]) });
  }
  if (typeof adapter.certify !== "function") {
    return Object.freeze({
      accepted: false,
      required: true,
      performed: false,
      findings: Object.freeze([Object.freeze({
        id: "document-certification-unavailable",
        passageId: "",
        atomIds: Object.freeze([]),
        message: "The required independent whole-document check was unavailable.",
      })]),
    });
  }
  throwIfAborted(signal);
  const verifiedAtoms = closedVerifiedCertificationAtoms(analyses, finalReviews);
  if (analyses.length > 0 && verifiedAtoms === null) {
    return Object.freeze({
      accepted: false,
      required: true,
      performed: false,
      findings: Object.freeze([certificationCoverageFinding(
        "The committed verified atom graph was incomplete or contained a dangling relation.",
      )]),
    });
  }
  const fallbackReady = passages.length > 0 && analyses.length > 0 && finalCandidates.length > 0;
  let preparedPlan = null;
  if (fallbackReady) {
    try {
      preparedPlan = await prepareWindowCertificationPlan({
        passages,
        analyses,
        finalCandidates,
        verifiedAtoms,
        adapter,
        signal,
      });
    } catch {
      throwIfAborted(signal);
      return Object.freeze({
        accepted: false,
        required: true,
        performed: false,
        findings: Object.freeze([certificationCoverageFinding(
          "The context-bounded certification plan could not be prepared safely.",
        )]),
      });
    }
  }
  const fallbackMinimum = preparedPlan?.completionReservation ?? null;
  let attemptFlatCertification = true;
  if (typeof adapter.completionCapacity === "function") {
    const capacity = adapter.completionCapacity();
    const remaining = record(capacity) && Number.isSafeInteger(capacity.remaining)
      ? capacity.remaining
      : -1;
    if (remaining < 0) {
      return Object.freeze({
        accepted: false,
        required: true,
        performed: false,
        findings: Object.freeze([certificationCoverageFinding(
          "The local model did not expose a valid remaining certification budget.",
        )]),
      });
    }
    if (fallbackMinimum !== null && remaining >= fallbackMinimum + 4) {
      attemptFlatCertification = true;
    } else if (fallbackMinimum !== null && remaining >= fallbackMinimum) {
      attemptFlatCertification = false;
    } else if (remaining < 4) {
      return Object.freeze({
        accepted: false,
        required: true,
        performed: false,
        findings: Object.freeze([certificationCoverageFinding(
          "The remaining local completion budget could not cover a whole-document or complete bounded certification proof.",
        )]),
      });
    }
  }
  if (!attemptFlatCertification) {
    return certifyDocumentWindows({
      source,
      candidate,
      passages,
      analyses,
      finalCandidates,
      finalReviews,
      adapter,
      signal,
      onProgress,
      preparedPlan,
    });
  }
  progress(onProgress, "certifying-document", 0, 1, "document");
  const retainConformanceRequired = analyses.some(({ analysis }) => analysis.passages.some(({ disposition }) => (
    disposition === "retain-if-conformant"
  )));
  const request = Object.freeze({
    certificateId: "certificate:document",
    obligationIds: Object.freeze(["document:whole"]),
    source,
    candidate,
    analysis: analyses.length > 0 ? Object.freeze({
      documentKind: analyses[0].analysis.documentKind,
      passages: Object.freeze(analyses.flatMap(({ analysis }) => analysis.passages)),
    }) : null,
    retainConformanceRequired,
    signal,
  });
  let certification;
  try {
    certification = await callNormalizedStage({
      stage: "document-certification",
      request,
      invoke: (currentRequest) => adapter.certify(currentRequest),
      normalize: (raw) => normalizeDocumentCertification(raw, request),
      signal,
    });
  } catch (error) {
    throwIfAborted(signal);
    const contextFailure = error?.code === "lattice-context";
    const capacityFailure = contextFailure || error?.code === "lattice-output-length";
    if (capacityFailure
      && passages.length > 0 && analyses.length > 0 && finalCandidates.length > 0) {
      return certifyDocumentWindows({
        source,
        candidate,
        passages,
        analyses,
        finalCandidates,
        finalReviews,
        adapter,
        signal,
        onProgress,
        preparedPlan,
      });
    }
    return Object.freeze({
      accepted: false,
      required: true,
      performed: false,
      findings: Object.freeze([Object.freeze({
        id: contextFailure ? "document-certification-context" : "document-certification-unavailable",
        passageId: "",
        atomIds: Object.freeze([]),
        message: contextFailure
          ? "The complete source and candidate did not fit the required independent local document check."
          : "The required independent local document check did not return a valid result after its bounded attempts.",
      })]),
    });
  }
  if (certification.accepted) {
    return Object.freeze({ accepted: true, required: true, performed: true, findings: Object.freeze([]) });
  }
  const findings = certification.issues.map((issue) => (
    certificationIssueFinding(issue, "document")
  ));
  if (findings.length === 0) {
    const failedChecks = LATTICE_DOCUMENT_CERTIFICATION_CHECKS.filter((name) => !certification.checks[name]);
    findings.push(Object.freeze({
      id: "document-certification-rejected",
      passageId: "",
      atomIds: Object.freeze([]),
      message: failedChecks.length > 0
        ? `The independent whole-document check rejected cross-passage consistency: ${failedChecks.join(", ")}.`
        : "The independent whole-document check rejected the assembled candidate.",
    }));
  }
  return Object.freeze({ accepted: false, required: true, performed: true, findings: Object.freeze(findings) });
}

function buildBatch(id, passages) {
  return Object.freeze({
    id,
    passages: Object.freeze(passages),
    wordCount: passages.reduce((sum, passage) => sum + passage.wordCount, 0),
    characterCount: passages.reduce((sum, passage) => sum + passage.text.length, 0),
  });
}

function splitBatch(batch) {
  const midpoint = Math.ceil(batch.passages.length / 2);
  return [
    buildBatch(`${batch.id}a`, batch.passages.slice(0, midpoint)),
    buildBatch(`${batch.id}b`, batch.passages.slice(midpoint)),
  ];
}

function replacePassageWithChildren(passages, passage, children) {
  const index = passages.findIndex(({ id }) => id === passage.id);
  if (index < 0) return false;
  passages.splice(index, 1, ...children);
  return true;
}

function retryableAnalysisFailure(error) {
  return retryableStageFailure(error);
}

function buildDocumentLedger(analyses, anchorBatchId = null) {
  const relationalKinds = new Set([
    "actor", "action", "relationship", "polarity", "modality", "uncertainty", "quantity",
    "condition", "exception", "chronology", "causality", "consequence", "attribution", "ambiguity",
  ]);
  const anchorIndex = analyses.findIndex(({ batch }) => batch.id === anchorBatchId);
  const anchor = anchorIndex >= 0 ? analyses[anchorIndex] : null;
  const linkedTargets = new Set(anchor?.analysis.passages.flatMap((passage) => (
    passage.atoms.flatMap((atom) => atom.links.map(({ targetAtomId }) => targetAtomId))
  )) ?? []);
  const atoms = analyses.flatMap(({ analysis, batch }, batchIndex) => (
    batch.id === anchorBatchId ? [] : analysis.passages.flatMap((passage, passageIndex) => passage.atoms.map((atom, atomIndex) => ({
      atom: {
        id: atom.id,
        passageId: passage.passageId,
        kind: atom.kind,
        value: atom.value.slice(0, 96),
        priority: atom.priority,
        links: atom.links.slice(0, 3).map(({ relation, targetAtomId }) => ({ relation, targetAtomId })),
      },
      batchId: batch.id,
      batchIndex,
      passageIndex,
      atomIndex,
    })))
  ));
  const scored = atoms.map((entry) => ({
    ...entry,
    rank: entry.atom.priority === "hard" ? 0 : relationalKinds.has(entry.atom.kind) ? 1 : 2,
    distance: anchorIndex >= 0 ? Math.abs(anchorIndex - entry.batchIndex) : analyses.length - entry.batchIndex,
  }));
  const stableOrder = (left, right) => left.distance - right.distance
    || left.rank - right.rank
    || right.batchIndex - left.batchIndex
    || left.passageIndex - right.passageIndex
    || left.atomIndex - right.atomIndex;
  const linked = scored.filter((entry) => linkedTargets.has(entry.atom.id)).sort(stableOrder);
  const linkedIds = new Set(linked.map((entry) => entry.atom.id));
  const linkedPassages = new Set(linked.map((entry) => `${entry.batchId}\u241f${entry.atom.passageId}`));

  // Context fitting keeps a prefix. Give each other batch one representative
  // before a second passage from any batch, then cover every remaining passage,
  // so a locally dense batch cannot crowd distant roles out of the verifier view.
  const representativesByBatch = new Map();
  const passageGroups = new Map();
  for (const entry of scored.filter((item) => !linkedIds.has(item.atom.id))) {
    const key = `${entry.batchId}\u241f${entry.atom.passageId}`;
    if (linkedPassages.has(key)) continue;
    const current = passageGroups.get(key);
    if (!current || stableOrder(entry, current) < 0) passageGroups.set(key, entry);
  }
  for (const representative of passageGroups.values()) {
    const group = representativesByBatch.get(representative.batchId) ?? [];
    group.push(representative);
    representativesByBatch.set(representative.batchId, group);
  }
  const orderedBatches = [...representativesByBatch.values()]
    .map((entries) => entries.sort(stableOrder))
    .sort((left, right) => stableOrder(left[0], right[0]));
  const representatives = [];
  const longestBatch = Math.max(0, ...orderedBatches.map((entries) => entries.length));
  for (let round = 0; round < longestBatch; round += 1) {
    for (const entries of orderedBatches) {
      if (entries[round]) representatives.push(entries[round]);
    }
  }
  const representativeIds = new Set(representatives.map((entry) => entry.atom.id));
  const remaining = scored
    .filter((entry) => !linkedIds.has(entry.atom.id) && !representativeIds.has(entry.atom.id))
    .sort(stableOrder);
  const ranked = [...linked, ...representatives, ...remaining]
    .map(({ atom }) => Object.freeze({ ...atom, links: Object.freeze(atom.links) }));
  return Object.freeze(ranked);
}

function requiredExternalLedgerAtomIds(analysis) {
  const localAtomIds = new Set(analysis.passages.flatMap((passage) => (
    passage.atoms.map(({ id }) => id)
  )));
  return Object.freeze([...new Set(analysis.passages.flatMap((passage) => (
    passage.atoms.flatMap((atom) => atom.links
      .map(({ targetAtomId }) => targetAtomId)
      .filter((targetAtomId) => !localAtomIds.has(targetAtomId)))
  )))]);
}

function bindRequiredLedgerTargets(analysis, documentLedger) {
  const requiredDocumentLedgerAtomIds = requiredExternalLedgerAtomIds(analysis);
  const available = new Set(documentLedger.map(({ id }) => id));
  protocol(requiredDocumentLedgerAtomIds.every((id) => available.has(id)),
    "A committed atom graph lost a required external ledger target.");
  return Object.freeze({ documentLedger, requiredDocumentLedgerAtomIds });
}

function assembledContextFor(passages, batch, candidateById) {
  const first = passages.indexOf(batch.passages[0]);
  const last = passages.indexOf(batch.passages[batch.passages.length - 1]);
  const contextEntry = (index, edge) => {
    if (index < 0 || index >= passages.length) return null;
    const passage = passages[index];
    if (passage.protected === true) {
      return Object.freeze({
        passageId: passage.id,
        exactText: passage.text,
        separatorBefore: passage.separatorBefore ?? "",
        separatorAfter: passage.separatorAfter ?? "",
        protectedExact: true,
        ...(passage.hostAttestedOnly === true ? { hostAttestedOnly: true } : {}),
      });
    }
    return Object.freeze({
      passageId: passage.id,
      sourceExcerpt: graphemeExcerpt(passage.text, edge),
      candidateExcerpt: graphemeExcerpt(candidateById.get(passage.id)?.text ?? "", edge),
      separatorBefore: passage.separatorBefore ?? "",
      separatorAfter: passage.separatorAfter ?? "",
    });
  };
  const exactProtectedEntry = (passage) => Object.freeze({
    passageId: passage.id,
    exactText: passage.text,
    separatorBefore: passage.separatorBefore ?? "",
    separatorAfter: passage.separatorAfter ?? "",
    protectedExact: true,
    ...(passage.hostAttestedOnly === true ? { hostAttestedOnly: true } : {}),
  });
  const protectedBefore = [];
  let precedingIndex = first - 1;
  while (precedingIndex >= 0 && passages[precedingIndex].protected === true) {
    protectedBefore.unshift(exactProtectedEntry(passages[precedingIndex]));
    precedingIndex -= 1;
  }
  const protectedAfter = [];
  let followingIndex = last + 1;
  while (followingIndex < passages.length && passages[followingIndex].protected === true) {
    protectedAfter.push(exactProtectedEntry(passages[followingIndex]));
    followingIndex += 1;
  }
  return Object.freeze({
    preceding: contextEntry(precedingIndex, "end"),
    following: contextEntry(followingIndex, "start"),
    protectedBefore: Object.freeze(protectedBefore),
    protectedAfter: Object.freeze(protectedAfter),
  });
}

function summarizeLayers(analyses, includedPassageIds = null) {
  const weights = new Map();
  for (const { batch, analysis } of analyses) {
    const sourceById = new Map(batch.passages.map((passage) => [passage.id, passage]));
    for (const passage of analysis.passages) {
      if (includedPassageIds && !includedPassageIds.has(passage.passageId)) continue;
      const weight = sourceById.get(passage.passageId)?.wordCount ?? 1;
      weights.set(passage.layer, (weights.get(passage.layer) ?? 0) + weight);
    }
  }
  const ranked = [...weights.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const labels = { operative: "Operative", experiential: "Experiential", interpretive: "Interpretive", mixed: "Mixed", accessibility: "Accessibility" };
  if (ranked.length === 0) return { layersUsed: [], primaryLayer: null, layerLabel: "Undetermined" };
  const layersUsed = ranked.map(([layer]) => layer);
  const primaryLayer = ranked[0][0];
  const layerLabel = ranked.length === 1
    ? labels[primaryLayer]
    : `${labels[primaryLayer]}-led · ${ranked.slice(1).map(([layer]) => labels[layer].toLocaleLowerCase("en-US")).join(" and ")} passages`;
  return { layersUsed, primaryLayer, layerLabel };
}

function batchFindings(batch, deterministic, verification) {
  if (verification.available === false) return [...deterministic, ...verification.issues];
  const findings = [
    ...deterministic,
    ...verification.issues.map((issue) => Object.freeze({
      id: `verifier-issue-${issue.check}-${issue.passageId || "document"}`,
      passageId: issue.passageId,
      atomIds: Object.freeze([]),
      message: VERIFICATION_CHECK_MESSAGES[issue.check]
        ?? "The independent check did not clear a required condition.",
    })),
  ];
  for (const passage of verification.passages) {
    for (const item of passage.unmodeledEvidence) {
      findings.push(Object.freeze({
        id: "verifier-unmodeled-source",
        passageId: passage.passageId,
        atomIds: Object.freeze([]),
        message: `The atom graph omitted source meaning near “${item.text.slice(0, 90)}”.`,
      }));
    }
    if (!passage.complete && passage.missingAtomIds.length > 0) {
      findings.push(Object.freeze({ id: "verifier-missing-atoms", passageId: passage.passageId, atomIds: Object.freeze([]), message: "The candidate did not preserve every semantic atom." }));
    }
    if (passage.unsupportedClaims.length > 0) {
      findings.push(Object.freeze({ id: "verifier-unsupported-claim", passageId: passage.passageId, atomIds: Object.freeze([]), message: "The candidate introduced meaning that the source does not support." }));
    }
  }
  if (!verification.gates.languageSupported) {
    findings.push(Object.freeze({ id: "verifier-language-support", passageId: batch.passages[0]?.id ?? "", atomIds: Object.freeze([]), message: "The independent verifier could not reliably assess this language." }));
  }
  const gateMessages = {
    safety: "The candidate did not clear the binding safety check.",
    semanticFidelity: "The candidate did not clear the semantic-fidelity check.",
    sourceCoverage: "The atom graph did not cover all meaningful source content.",
    atomCoverage: "The candidate or verifier did not account for every semantic atom.",
    accessibility: "The candidate did not clear the accessibility check.",
    clarity: "The candidate did not clear the clarity check.",
    domainCorrectness: "The candidate did not clear the domain-correctness check.",
    registerFit: "The candidate did not clear the selected-register check.",
    ornament: "Ornament obscured or altered higher-priority meaning.",
    documentConsistency: "The passage did not remain consistent with the assembled document.",
  };
  for (const [gate, message] of Object.entries(gateMessages)) {
    if (!verification.gates[gate]) findings.push(Object.freeze({ id: `verifier-gate-${gate}`, passageId: batch.passages[0]?.id ?? "", atomIds: Object.freeze([]), message }));
  }
  for (const passage of verification.passages) {
    if (!passage.planFit) findings.push(Object.freeze({ id: "verifier-plan-fit", passageId: passage.passageId, atomIds: Object.freeze([]), message: "The planned sub-register did not fit this passage and required re-atomization." }));
    if (!passage.boundaryFidelity) findings.push(Object.freeze({ id: "verifier-boundary-fidelity", passageId: passage.passageId, atomIds: Object.freeze([]), message: "The candidate moved source meaning across a line, paragraph, or stanza boundary." }));
    if (!passage.registerFit || !passage.layerEvidenceGrounded) {
      findings.push(Object.freeze({
        id: "verifier-independent-layer",
        passageId: passage.passageId,
        atomIds: Object.freeze([]),
        message: "The independent check did not confirm the planned register from grounded passage evidence.",
      }));
    }
    if (passage.requiresPositiveConformance && (!passage.conformanceConfirmed || passage.conformanceEvidence.length === 0)) {
      findings.push(Object.freeze({ id: "verifier-positive-conformance", passageId: passage.passageId, atomIds: Object.freeze([]), message: "The unchanged passage lacked independent positive conformance evidence." }));
    }
  }
  return findings;
}

function unavailableVerification(batch, analysis, message) {
  const gates = Object.freeze({
    languageSupported: true,
    safety: false,
    semanticFidelity: false,
    sourceCoverage: false,
    atomCoverage: false,
    accessibility: false,
    clarity: false,
    domainCorrectness: false,
    registerFit: false,
    ornament: false,
    documentConsistency: false,
  });
  return Object.freeze({
    decision: "reject",
    gates,
    passages: Object.freeze(analysis.passages.map((passage) => Object.freeze({
      passageId: passage.passageId,
      checkedAtomIds: Object.freeze([]),
      missingAtomIds: Object.freeze(passage.atoms.map(({ id }) => id)),
      unsupportedClaims: Object.freeze([]),
      unmodeledSpanIds: Object.freeze([]),
      unmodeledEvidence: Object.freeze([]),
      conformanceEvidenceSpanIds: Object.freeze([]),
      conformanceEvidence: Object.freeze([]),
      independentLayer: passage.layer,
      layerEvidenceAtomIds: Object.freeze([]),
      layerEvidenceSpanIds: Object.freeze([]),
      layerEvidence: Object.freeze([]),
      layerEvidenceGrounded: false,
      criterionChecks: Object.freeze([]),
      requiresPositiveConformance: passage.disposition === "retain-if-conformant",
      semanticFidelity: false,
      safety: false,
      accessibility: false,
      clarity: false,
      domainCorrectness: false,
      registerFit: false,
      planFit: false,
      materiality: false,
      boundaryFidelity: false,
      conformanceConfirmed: false,
      complete: false,
    }))),
    issues: Object.freeze([Object.freeze({
      id: "verification-unavailable",
      passageId: batch.passages[0]?.id ?? "",
      atomIds: Object.freeze([]),
      message,
    })]),
    questions: Object.freeze([]),
    accepted: false,
    available: false,
  });
}

function deduplicateFindings(findings) {
  const seen = new Set();
  return Object.freeze(findings.filter((item) => {
    const key = `${item.id}\u241f${item.passageId}\u241f${item.message}\u241f${(item.atomIds ?? []).join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}

function hasNoDeterministicFindings(entries) {
  return entries.every((entry) => entry.deterministicFindings.length === 0);
}

function hasExplicitReviewOnlyFailure(entry) {
  const { verification } = entry;
  return verification.issues.some(({ check }) => REVIEW_ONLY_VERIFICATION_CHECKS.has(check))
    || ["accessibility", "clarity", "registerFit", "ornament"].some((gate) => verification.gates[gate] === false)
    || verification.passages.some((passage) => (
      !passage.accessibility || !passage.clarity || !passage.registerFit
    ));
}

function verificationSemanticallySafe(entry) {
  const verification = entry.verification;
  if (verification.available !== true || verification.questions.length > 0
    || !verification.issues.every(({ check }) => REVIEW_ONLY_VERIFICATION_CHECKS.has(check))) return false;
  for (const gate of [
    "languageSupported", "safety", "semanticFidelity", "sourceCoverage", "atomCoverage",
    "domainCorrectness", "documentConsistency",
  ]) {
    if (!verification.gates[gate]) return false;
  }
  const planById = new Map(entry.analysis.passages.map((passage) => [passage.passageId, passage]));
  const sourceSpanIdsByPassage = new Map(entry.sourceSpans.map((group) => [
    group.passageId,
    [...group.spans, ...(group.literalAnnotations ?? [])].map(({ id }) => id),
  ]));
  return verification.passages.every((passage) => {
    const plan = planById.get(passage.passageId);
    const checked = new Set(passage.checkedAtomIds);
    const conformanceIds = new Set(passage.conformanceEvidenceSpanIds);
    const requiredConformanceIds = sourceSpanIdsByPassage.get(passage.passageId) ?? [];
    const retainedConformance = plan?.disposition !== "retain-if-conformant" || (
      passage.requiresPositiveConformance
      && passage.conformanceConfirmed
      && passage.complete
      && requiredConformanceIds.length === conformanceIds.size
      && requiredConformanceIds.every((id) => conformanceIds.has(id))
    );
    const explainedReviewFailures = ["accessibility", "clarity", "registerFit"].every((check) => (
      passage[check]
      || verification.gates[check] === false
      || verification.issues.some((issue) => issue.check === check && issue.passageId === passage.passageId)
    ));
    return plan
      && plan.atoms.length === checked.size
      && plan.atoms.every(({ id }) => checked.has(id))
      && passage.missingAtomIds.length === 0
      && passage.unsupportedClaims.length === 0
      && passage.unmodeledEvidence.length === 0
      && passage.semanticFidelity
      && passage.safety
      && passage.domainCorrectness
      && passage.planFit
      && passage.materiality
      && passage.boundaryFidelity
      && passage.independentLayer === plan.layer
      && passage.layerEvidenceGrounded
      && passage.layerEvidenceAtomIds.length > 0
      && passage.layerEvidenceSpanIds.length > 0
      && explainedReviewFailures
      && retainedConformance;
  });
}

function closedReanalysisFeedback(verification) {
  return Object.freeze({
    decision: verification.decision,
    gates: Object.freeze(Object.fromEntries(
      LATTICE_VERIFICATION_GATES.map((gate) => [gate, verification.gates[gate] === true]),
    )),
    passages: Object.freeze(verification.passages.map((passage) => Object.freeze({
      passageId: passage.passageId,
      missingAtomIds: Object.freeze([...passage.missingAtomIds]),
      unsupportedClaims: Object.freeze([]),
      unmodeledSpanIds: Object.freeze([...passage.unmodeledSpanIds]),
      conformanceEvidenceSpanIds: Object.freeze([...passage.conformanceEvidenceSpanIds]),
      requiresPositiveConformance: passage.requiresPositiveConformance === true,
      conformanceConfirmed: passage.conformanceConfirmed === true,
      independentLayer: passage.independentLayer,
      layerEvidenceAtomIds: Object.freeze([...passage.layerEvidenceAtomIds]),
      layerEvidenceSpanIds: Object.freeze([...passage.layerEvidenceSpanIds]),
      criterionChecks: Object.freeze(passage.criterionChecks.map((check) => Object.freeze({
        criterion: check.criterion,
        passed: check.passed === true,
        evidenceSpanIds: Object.freeze([...check.evidenceSpanIds]),
      }))),
      ...Object.fromEntries(LATTICE_PASSAGE_VERIFICATION_CHECKS.map((check) => (
        [check, passage[check] === true]
      ))),
    }))),
    issues: Object.freeze(verification.issues.map((issue) => Object.freeze({
      id: issue.id,
      check: issue.check,
      passageId: issue.passageId,
      atomIds: Object.freeze([...issue.atomIds]),
      message: VERIFICATION_CHECK_MESSAGES[issue.check]
        ?? "The independent check did not clear a required condition.",
    }))),
    questions: Object.freeze([]),
  });
}

function resultFromState({
  source,
  wordCount,
  passages,
  analyses,
  finalCandidates,
  finalReviews,
  status,
  questions = [],
  verificationPasses,
  documentFindings = [],
  wholeDocumentCertification = null,
}) {
  const replaceablePassages = passages.filter((passage) => passage.protected !== true);
  const protectedPassages = passages.filter((passage) => passage.protected === true);
  const replacements = finalCandidates.flatMap((entry) => entry.candidate.passages);
  const assembledText = replacements.length === replaceablePassages.length
    ? reassembleLatticeSource(source, passages, replacements)
    : null;
  const revisionForEntry = (entry) => (
    ANALYSIS_REVISION_ID_PATTERN.test(entry?.analysisRevisionId ?? "")
      && entry.analysis?.revisionId === entry.analysisRevisionId
      ? entry.analysisRevisionId
      : null
  );
  const candidateRecordsById = new Map(finalCandidates.flatMap((entry) => (
    entry.candidate.passages.map((passage) => [
      passage.passageId,
      { passage, revisionId: revisionForEntry(entry) },
    ])
  )));
  const planRecordsById = new Map(analyses.flatMap((entry) => entry.analysis.passages.map((passage) => [
    passage.passageId,
    { passage, revisionId: revisionForEntry(entry) },
  ])));
  const reviewRecordsById = new Map(finalReviews.flatMap((entry) => entry.verification.passages.map((passage) => [
    passage.passageId,
    { passage, available: entry.verification.available, revisionId: revisionForEntry(entry) },
  ])));
  const candidateById = new Map([...candidateRecordsById].map(([id, entry]) => [id, entry.passage]));
  const planById = new Map([...planRecordsById].map(([id, entry]) => [id, entry.passage]));
  const reviewById = new Map([...reviewRecordsById].map(([id, entry]) => [id, entry]));
  const completeRecordIds = new Set(replaceablePassages.filter((sourcePassage) => {
    const candidateRevisionId = candidateRecordsById.get(sourcePassage.id)?.revisionId;
    return ANALYSIS_REVISION_ID_PATTERN.test(candidateRevisionId ?? "")
      && candidateRevisionId === planRecordsById.get(sourcePassage.id)?.revisionId
      && candidateRevisionId === reviewRecordsById.get(sourcePassage.id)?.revisionId;
  }).map(({ id }) => id));
  const revisionCoherentAssembly = assembledText !== null
    && completeRecordIds.size === replaceablePassages.length
    && analyses.every((entry) => revisionForEntry(entry) !== null)
    && finalCandidates.every((entry) => revisionForEntry(entry) !== null)
    && finalReviews.every((entry) => revisionForEntry(entry) !== null);
  const summary = summarizeLayers(analyses, completeRecordIds);
  const revisedPassageCount = replaceablePassages.filter((sourcePassage) => {
    if (!completeRecordIds.has(sourcePassage.id)) return false;
    const candidate = candidateById.get(sourcePassage.id);
    const plan = planById.get(sourcePassage.id);
    return plan.disposition === "rewrite" && materiallyDifferent(sourcePassage.text, candidate.text);
  }).length;
  const retainedPassageCount = replaceablePassages.filter((sourcePassage) => {
    if (!completeRecordIds.has(sourcePassage.id)) return false;
    const candidate = candidateById.get(sourcePassage.id);
    const plan = planById.get(sourcePassage.id);
    const review = reviewById.get(sourcePassage.id);
    return candidate.text === sourcePassage.text
      && plan.disposition === "retain-if-conformant"
      && review.available !== false
      && review.passage.requiresPositiveConformance
      && review.passage.conformanceConfirmed
      && review.passage.complete;
  }).length;
  const requiresWholeDocumentCertification = analyses.length > 1
    || protectedPassages.length > 0
    || /[\r\n\u2028\u2029]/u.test(source)
    || status === "review-required"
    || [...planById.values()].some(({ disposition }) => disposition === "retain-if-conformant");
  const deterministicDocumentSafe = revisionCoherentAssembly
    && deterministicDocumentReview(source, assembledText).length === 0;
  const reviewAssemblyEligible = revisionCoherentAssembly
    && materiallyDifferent(source, assembledText)
    && deterministicDocumentSafe
    && hasNoDeterministicFindings(finalCandidates)
    && finalReviews.length === analyses.length
    && finalReviews.every(verificationSemanticallySafe)
    && finalReviews.some(hasExplicitReviewOnlyFailure)
    && replaceablePassages.every((sourcePassage) => {
      const candidate = candidateById.get(sourcePassage.id);
      const plan = planById.get(sourcePassage.id);
      const review = reviewById.get(sourcePassage.id);
      if (!candidate || !plan || !review) return false;
      if (plan.disposition === "rewrite") return materiallyDifferent(sourcePassage.text, candidate.text);
      return candidate.text === sourcePassage.text
        && review.available === true
        && review.passage.requiresPositiveConformance
        && review.passage.conformanceConfirmed
        && review.passage.complete;
    })
    && (!requiresWholeDocumentCertification || wholeDocumentCertification?.accepted === true);
  const requestedOutput = ["conformant-for-context", "translated", "review-required"].includes(status);
  const publicStatus = (requestedOutput && !revisionCoherentAssembly)
    || (status === "review-required" && !reviewAssemblyEligible)
      ? "unable-to-attempt"
      : status;
  const text = publicStatus === "conformant-for-context"
    ? assembledText
    : publicStatus === "translated" || publicStatus === "review-required" && reviewAssemblyEligible
      ? assembledText
      : null;
  const candidateSuppressed = text === null && finalCandidates.length > 0;
  const internalFindings = deduplicateFindings([
    ...documentFindings,
    ...finalReviews.flatMap((entry) => batchFindings(entry.batch, entry.deterministicFindings, entry.verification)),
  ].map((finding) => Object.freeze({ ...finding, atomIds: Object.freeze([]) })));
  const findings = candidateSuppressed
    ? Object.freeze([Object.freeze({
      id: "candidate-withheld",
      passageId: "",
      atomIds: Object.freeze([]),
      message: "No candidate cleared every required check.",
    })])
    : internalFindings;
  const publicSummary = candidateSuppressed
    ? { primaryLayer: null, layerLabel: "Undetermined", layersUsed: Object.freeze([]) }
    : summary;
  return Object.freeze({
    version: TEXT_TO_LATTICE_VERSION,
    status: publicStatus,
    text,
    wordCount,
    primaryLayer: publicSummary.primaryLayer,
    layerId: publicSummary.primaryLayer,
    layerLabel: publicSummary.layerLabel,
    layersUsed: Object.freeze(publicSummary.layersUsed),
    passageCount: passages.length,
    revisedPassageCount: candidateSuppressed ? 0 : revisedPassageCount,
    retainedPassageCount: candidateSuppressed ? 0 : retainedPassageCount,
    batchCount: analyses.length,
    verificationPasses: candidateSuppressed ? 0 : verificationPasses,
    findings,
    questions: Object.freeze(candidateSuppressed ? [] : questions),
  });
}

function adapterContract(adapter) {
  protocol(record(adapter), "Text to Lattice requires a local model adapter.");
  for (const stage of ["analyze", "generate", "verify", "repair"]) {
    protocol(typeof adapter[stage] === "function", `The local model adapter is missing ${stage}.`);
  }
  protocol(adapter.certify === undefined || typeof adapter.certify === "function",
    "The local model adapter has an invalid document certifier.");
  protocol(adapter.completionCapacity === undefined || typeof adapter.completionCapacity === "function",
    "The local model adapter has an invalid completion-capacity reporter.");
  protocol(adapter.certificationFits === undefined || typeof adapter.certificationFits === "function",
    "The local model adapter has an invalid certification-context preflight.");
}

export async function runTextToLattice(value, options = {}) {
  const preflight = preflightLatticeInput(value);
  const { source, wordCount, batches } = preflight;
  const passages = [...preflight.passages];
  adapterContract(options.adapter);
  const signal = options.signal;
  const onProgress = options.onProgress;
  const clarificationAnswers = clarificationAnswersPayload(options.clarificationAnswers);
  throwIfAborted(signal);
  const sourceFingerprint = await provenanceFingerprint("sf", {
    scope: "normalized-source",
    text: source,
  });
  throwIfAborted(signal);

  const pendingBatches = [...batches];
  let analyses = [];
  let analysisRevisionSerial = 0;
  const nextAnalysisRevisionId = () => {
    analysisRevisionSerial += 1;
    protocol(analysisRevisionSerial <= 999, "Text to Lattice exhausted its bounded atomization revisions.");
    return `r${String(analysisRevisionSerial).padStart(3, "0")}`;
  };

  while (pendingBatches.length > 0) {
    throwIfAborted(signal);
    const batch = pendingBatches.shift();
    const documentLedger = buildDocumentLedger(analyses);
    const clarificationDocumentProvenance = committedClarificationProvenance(analyses);
    const analysisRevisionId = nextAnalysisRevisionId();
    const request = Object.freeze({
      batch,
      analysisRevisionId,
      sourceFingerprint,
      sourceSpans: latticeSourceSpansForBatch(batch),
      context: contextPassagesForBatch(passages, batch),
      documentLedger,
      clarificationDocumentProvenance,
      signal,
    });
    progress(onProgress, "atomizing", analyses.length, analyses.length + pendingBatches.length + 1, batch.id);
    try {
      const analysis = await callClarifiableStage({
        clarificationAnswers,
        stage: "atomization",
        request,
        invoke: (currentRequest) => options.adapter.analyze(currentRequest),
        normalize: (raw) => normalizeAnalysis(
          raw,
          batch,
          documentLedger,
          analysisRevisionId,
          sourceFingerprint,
          clarificationDocumentProvenance,
        ),
        signal,
      });
      analyses.push(Object.freeze({ ...request, analysis }));
      progress(onProgress, "atomizing", analyses.length, analyses.length + pendingBatches.length, batch.id);
    } catch (error) {
      if (batch.passages.length > 1 && retryableAnalysisFailure(error)) {
        const [left, right] = splitBatch(batch);
        pendingBatches.unshift(left, right);
        continue;
      }
      if (retryableAnalysisFailure(error)) {
        const sourcePassage = batch.passages[0];
        const children = splitLatticePassage(sourcePassage);
        const withinPassageLimit = children && passages.length + 1 <= LATTICE_PASSAGE_LIMIT;
        const withinBatchLimit = analyses.length + pendingBatches.length + 2 <= LATTICE_EXECUTION_BATCH_LIMIT;
        if (withinPassageLimit && withinBatchLimit && replacePassageWithChildren(passages, sourcePassage, children)) {
          pendingBatches.unshift(
            buildBatch(`${batch.id}a`, [children[0]]),
            buildBatch(`${batch.id}b`, [children[1]]),
          );
          continue;
        }
        return resultFromState({
          source,
          wordCount,
          passages,
          analyses,
          finalCandidates: [],
          finalReviews: [],
          status: "unable-to-attempt",
          verificationPasses: 0,
          documentFindings: [Object.freeze({
            id: "atomization-unavailable",
            passageId: batch.passages[0]?.id ?? "",
            atomIds: Object.freeze([]),
            message: "The bounded local atomization attempts did not produce a valid semantic graph. No source text was presented as transformed output.",
          })],
        });
      }
      throw error;
    }
  }

  const analysisQuestions = analyses.flatMap(({ analysis }) => analysis.questions);
  if (analysisQuestions.length > 0) {
    return resultFromState({
      source, wordCount, passages, analyses, finalCandidates: [], finalReviews: [],
      status: "needs-clarification", questions: analysisQuestions.slice(0, 1), verificationPasses: 0,
    });
  }

  analyses = analyses.map((entry) => Object.freeze({
    ...entry,
    ...bindRequiredLedgerTargets(entry.analysis, buildDocumentLedger(analyses, entry.batch.id)),
  }));
  const candidates = [];
  for (let index = 0; index < analyses.length; index += 1) {
    const request = analyses[index];
    throwIfAborted(signal);
    progress(onProgress, "generating", index, analyses.length, request.batch.id);
    let candidate;
    try {
      candidate = await callNormalizedStage({
        stage: "generation",
        request,
        invoke: (currentRequest) => options.adapter.generate(currentRequest),
        normalize: (raw) => normalizeCandidate(raw, request.batch, request.analysis),
        signal,
      });
    } catch (generationError) {
      if (!retryableStageFailure(generationError)) throw generationError;
      if (generationError?.code === "lattice-context") {
        return resultFromState({
          source,
          wordCount,
          passages,
          analyses,
          finalCandidates: candidates,
          finalReviews: [],
          status: "unable-to-attempt",
          verificationPasses: 0,
          documentFindings: [Object.freeze({
            id: "generation-context-unavailable",
            passageId: request.batch.passages[0]?.id ?? "",
            atomIds: Object.freeze([]),
            message: "This passage and its required structured output exceeded the local model context even after the cross-passage ledger was reduced. No source text was presented as transformed output.",
          })],
        });
      }
      const identityCandidate = Object.freeze({
        passages: Object.freeze(request.batch.passages.map((passage) => {
          const plan = request.analysis.passages.find(({ passageId }) => passageId === passage.id);
          return Object.freeze({
            passageId: passage.id,
            layer: plan.layer,
            text: passage.text,
            preservedAtomIds: Object.freeze(plan.atoms.map(({ id }) => id)),
          });
        })),
      });
      const recoveryRequest = Object.freeze({
        ...request,
        candidate: identityCandidate,
        deterministicFindings: Object.freeze([Object.freeze({
          id: "generation-protocol",
          passageId: request.batch.passages[0]?.id ?? "",
          atomIds: Object.freeze([]),
          message: "The initial generator responses were invalid; produce a complete material draft from the source and atom graph.",
        })]),
        verification: null,
        protocolFeedback: stageFeedback("generation-recovery", generationError, 1),
      });
      try {
        candidate = await callNormalizedStage({
          stage: "generation-recovery",
          request: recoveryRequest,
          invoke: (currentRequest) => options.adapter.repair(currentRequest),
          normalize: (raw) => normalizeCandidate(raw, request.batch, request.analysis),
          signal,
        });
      } catch (recoveryError) {
        if (!retryableStageFailure(recoveryError)) throw recoveryError;
        return resultFromState({
          source,
          wordCount,
          passages,
          analyses,
          finalCandidates: candidates,
          finalReviews: [],
          status: "unable-to-attempt",
          verificationPasses: 0,
          documentFindings: [Object.freeze({
            id: "generation-unavailable",
            passageId: request.batch.passages[0]?.id ?? "",
            atomIds: Object.freeze([]),
            message: "The bounded local drafting attempts did not produce a valid material candidate. No source text was presented as transformed output.",
          })],
        });
      }
    }
    const deterministicFindings = deterministicBatchReview(request.batch, request.analysis, candidate);
    candidates.push(Object.freeze({ ...request, candidate, deterministicFindings }));
    progress(onProgress, "generating", index + 1, analyses.length, request.batch.id);
  }

  const assemble = (entries) => {
    const replacements = entries.flatMap((entry) => entry.candidate.passages);
    const text = reassembleLatticeSource(source, passages, replacements);
    return Object.freeze({
      text,
      candidateById: new Map(replacements.map((passage) => [passage.passageId, passage])),
      documentFindings: deterministicDocumentReview(source, text),
    });
  };

  let assembly = assemble(candidates);
  let candidateFingerprint = await provenanceFingerprint(
    "cf",
    assembledCandidateProvenance(candidates, assembly.text),
  );
  throwIfAborted(signal);
  const reviews = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const request = candidates[index];
    throwIfAborted(signal);
    progress(onProgress, "verifying", index, candidates.length, request.batch.id);
    const verificationRequest = Object.freeze({
      ...request,
      assembledContext: assembledContextFor(passages, request.batch, assembly.candidateById),
      documentFindings: assembly.documentFindings,
    });
    let verification;
    try {
      verification = await callNormalizedStage({
        stage: "verification",
        request: verificationRequest,
        invoke: (currentRequest) => options.adapter.verify(currentRequest),
        normalize: (raw) => normalizeVerification(
          raw,
          request.batch,
          request.analysis,
          request.deterministicFindings,
          `verification:1:${request.batch.id}`,
          {
            sourceFingerprint,
            analysisRevisionId: request.analysisRevisionId,
            committedProvenance: request.clarificationDocumentProvenance,
            candidateFingerprint,
          },
        ),
        signal,
      });
    } catch (error) {
      if (!retryableStageFailure(error)) throw error;
      verification = unavailableVerification(
        request.batch,
        request.analysis,
        "The independent local verifier did not return a valid bounded check after two attempts.",
      );
    }
    reviews.push(Object.freeze({ ...verificationRequest, verification }));
    progress(onProgress, "verifying", index + 1, candidates.length, request.batch.id);
  }

  const firstQuestions = reviews.flatMap((entry) => entry.verification.questions);
  if (firstQuestions.length > 0) {
    return resultFromState({
      source, wordCount, passages, analyses, finalCandidates: candidates, finalReviews: reviews,
      status: "needs-clarification", questions: firstQuestions.slice(0, 1), verificationPasses: 1,
      documentFindings: assembly.documentFindings,
    });
  }

  const acceptedStatus = (accepted, output, currentAnalyses) => {
    if (!accepted) return "review-required";
    if (output !== source) return "translated";
    const dispositions = currentAnalyses.flatMap(({ analysis }) => analysis.passages.map((passage) => passage.disposition));
    if (dispositions.length > 0 && dispositions.every((item) => item === "retain-if-conformant")) return "conformant-for-context";
    return "review-required";
  };

  let failures = reviews.filter((entry) => !entry.verification.accepted);
  if (assembly.documentFindings.length > 0 && failures.length === 0) failures = [...reviews];
  if (failures.length === 0) {
    const certification = await certifyWholeDocument({
      source,
      candidate: assembly.text,
      batchCount: analyses.length,
      protectedPassageCount: passages.filter((passage) => passage.protected === true).length,
      passages,
      analyses,
      finalCandidates: candidates,
      finalReviews: reviews,
      adapter: options.adapter,
      signal,
      onProgress,
      forceRequired: analyses.some(({ analysis }) => analysis.passages.some(({ disposition }) => (
        disposition === "retain-if-conformant"
      ))),
    });
    const status = certification.accepted
      ? acceptedStatus(true, assembly.text, analyses)
      : materiallyDifferent(source, assembly.text) ? "review-required" : "unable-to-attempt";
    return resultFromState({
      source, wordCount, passages, analyses, finalCandidates: candidates, finalReviews: reviews,
      status, verificationPasses: 1,
      documentFindings: [...assembly.documentFindings, ...certification.findings],
      wholeDocumentCertification: certification,
    });
  }

  const structurallyFailed = failures.filter((entry) => entry.verification.available !== false && entry.verification.gates.languageSupported && (
    !entry.verification.gates.sourceCoverage
    || !entry.verification.gates.atomCoverage
    || !entry.verification.gates.registerFit
    || entry.verification.passages.some((passage) => (
      passage.unmodeledEvidence.length > 0
      || !passage.planFit
      || !passage.layerEvidenceGrounded
      || passage.independentLayer !== entry.analysis.passages.find(({ passageId }) => (
        passageId === passage.passageId
      ))?.layer
      || passage.requiresPositiveConformance && !passage.conformanceConfirmed
    ))
  ));
  const structuralIds = new Set(structurallyFailed.map((entry) => entry.batch.id));
  const retryableFailures = failures.filter((entry) => entry.verification.available !== false && entry.verification.gates.languageSupported);
  const retryNotes = [];
  const reanalyzedByBatch = new Map();

  for (let index = 0; index < structurallyFailed.length; index += 1) {
    const entry = structurallyFailed[index];
    throwIfAborted(signal);
    progress(onProgress, "reatomizing", index, structurallyFailed.length, entry.batch.id);
    const reanalysisLedger = buildDocumentLedger(analyses, entry.batch.id);
    const clarificationDocumentProvenance = committedClarificationProvenance(analyses, entry.batch.id);
    const analysisRevisionId = nextAnalysisRevisionId();
    const request = Object.freeze({
      batch: entry.batch,
      sourceSpans: entry.sourceSpans,
      context: entry.context,
      sourceFingerprint,
      analysisRevisionId,
      documentLedger: reanalysisLedger,
      clarificationDocumentProvenance,
      reanalysisFeedback: closedReanalysisFeedback(entry.verification),
      allowClarification: false,
      signal,
    });
    try {
      const normalizedAnalysis = await callNormalizedStage({
        stage: "re-atomization",
        request,
        invoke: (currentRequest) => options.adapter.analyze(currentRequest),
        normalize: (raw) => normalizeAnalysis(
          raw,
          entry.batch,
          reanalysisLedger,
          analysisRevisionId,
          sourceFingerprint,
          clarificationDocumentProvenance,
          { allowClarification: false },
        ),
        signal,
      });
      const rejectedRetains = new Set(entry.verification.passages
        .filter((passage) => passage.requiresPositiveConformance && (
          !passage.conformanceConfirmed
          || !entry.verification.gates.registerFit
          || !passage.registerFit
          || !passage.layerEvidenceGrounded
          || passage.independentLayer !== entry.analysis.passages.find(({ passageId }) => (
            passageId === passage.passageId
          ))?.layer
        ))
        .map((passage) => passage.passageId));
      const analysis = rejectedRetains.size === 0
        ? normalizedAnalysis
        : Object.freeze({
          ...normalizedAnalysis,
          passages: Object.freeze(normalizedAnalysis.passages.map((passage) => (
            rejectedRetains.has(passage.passageId) && passage.disposition === "retain-if-conformant"
              ? Object.freeze({
                ...passage,
                disposition: "rewrite",
                conformanceCriteria: Object.freeze([]),
                conformanceEvidenceSpanIds: Object.freeze([]),
                conformanceEvidence: Object.freeze([]),
                conformanceAssertions: Object.freeze([]),
              })
              : passage
          ))),
        });
      reanalyzedByBatch.set(entry.batch.id, Object.freeze({ ...request, analysis }));
    } catch (error) {
      throwIfAborted(signal);
      if (!retryableStageFailure(error)) throw error;
      retryNotes.push(Object.freeze({ id: "reanalysis-unavailable", passageId: entry.batch.passages[0]?.id ?? "", atomIds: Object.freeze([]), message: "The bounded re-atomization pass did not produce a valid replacement graph." }));
    }
    progress(onProgress, "reatomizing", index + 1, structurallyFailed.length, entry.batch.id);
  }

  const provisionalAnalyses = analyses.map((entry) => reanalyzedByBatch.get(entry.batch.id) ?? entry);
  const reanalysisQuestions = [...reanalyzedByBatch.values()].flatMap(({ analysis }) => analysis.questions);
  if (reanalysisQuestions.length > 0) {
    return resultFromState({
      source, wordCount, passages, analyses: provisionalAnalyses, finalCandidates: candidates, finalReviews: reviews,
      status: "needs-clarification", questions: reanalysisQuestions.slice(0, 1), verificationPasses: 1,
      documentFindings: [...assembly.documentFindings, ...retryNotes],
    });
  }

  const actionableFailures = retryableFailures.filter((entry) => !structuralIds.has(entry.batch.id) || reanalyzedByBatch.has(entry.batch.id));
  const retriedCandidates = [];
  for (let index = 0; index < actionableFailures.length; index += 1) {
    const original = actionableFailures[index];
    throwIfAborted(signal);
    progress(onProgress, structuralIds.has(original.batch.id) ? "regenerating" : "repairing", index, actionableFailures.length, original.batch.id);
    const replacementEntry = reanalyzedByBatch.get(original.batch.id);
    const replacementAnalysis = replacementEntry?.analysis ?? original.analysis;
    const retryRequest = Object.freeze({
      ...original,
      analysisRevisionId: replacementEntry?.analysisRevisionId ?? original.analysisRevisionId,
      clarificationDocumentProvenance: replacementEntry?.clarificationDocumentProvenance
        ?? original.clarificationDocumentProvenance,
      analysis: replacementAnalysis,
      ...bindRequiredLedgerTargets(
        replacementAnalysis,
        buildDocumentLedger(provisionalAnalyses, original.batch.id),
      ),
    });
    try {
      const stage = reanalyzedByBatch.has(original.batch.id) ? "regeneration" : "repair";
      const candidate = await callNormalizedStage({
        stage,
        request: retryRequest,
        invoke: (currentRequest) => reanalyzedByBatch.has(original.batch.id)
          ? options.adapter.generate(currentRequest)
          : options.adapter.repair(currentRequest),
        normalize: (raw) => normalizeCandidate(raw, original.batch, replacementAnalysis),
        signal,
      });
      const deterministicFindings = deterministicBatchReview(original.batch, replacementAnalysis, candidate);
      retriedCandidates.push(Object.freeze({ ...retryRequest, candidate, deterministicFindings }));
    } catch (error) {
      throwIfAborted(signal);
      if (!retryableStageFailure(error)) throw error;
      retryNotes.push(Object.freeze({ id: "candidate-retry-unavailable", passageId: original.batch.passages[0]?.id ?? "", atomIds: Object.freeze([]), message: "The bounded candidate retry did not produce a valid draft." }));
    }
    progress(onProgress, structuralIds.has(original.batch.id) ? "regenerating" : "repairing", index + 1, actionableFailures.length, original.batch.id);
  }

  const retryCandidateByBatch = new Map(retriedCandidates.map((entry) => [entry.batch.id, entry]));
  let tentativeCandidates = candidates.map((entry) => retryCandidateByBatch.get(entry.batch.id) ?? entry);
  assembly = assemble(tentativeCandidates);
  candidateFingerprint = await provenanceFingerprint(
    "cf",
    assembledCandidateProvenance(tentativeCandidates, assembly.text),
  );
  throwIfAborted(signal);
  const secondReviews = [];
  for (let index = 0; index < retriedCandidates.length; index += 1) {
    const request = retriedCandidates[index];
    throwIfAborted(signal);
    progress(onProgress, "reverifying", index, retriedCandidates.length, request.batch.id);
    const verificationRequest = Object.freeze({
      ...request,
      assembledContext: assembledContextFor(passages, request.batch, assembly.candidateById),
      documentFindings: assembly.documentFindings,
    });
    try {
      const verification = await callNormalizedStage({
        stage: "reverification",
        request: verificationRequest,
        invoke: (currentRequest) => options.adapter.verify(currentRequest),
        normalize: (raw) => normalizeVerification(
          raw,
          request.batch,
          request.analysis,
          request.deterministicFindings,
          `verification:2:${request.batch.id}`,
          {
            sourceFingerprint,
            analysisRevisionId: request.analysisRevisionId,
            committedProvenance: request.clarificationDocumentProvenance,
            candidateFingerprint,
          },
        ),
        signal,
      });
      secondReviews.push(Object.freeze({ ...verificationRequest, verification }));
    } catch (error) {
      throwIfAborted(signal);
      if (!retryableStageFailure(error)) throw error;
      retryCandidateByBatch.delete(request.batch.id);
      retryNotes.push(Object.freeze({ id: "reverification-unavailable", passageId: request.batch.passages[0]?.id ?? "", atomIds: Object.freeze([]), message: "The independent recheck did not complete with a valid result." }));
    }
    progress(onProgress, "reverifying", index + 1, retriedCandidates.length, request.batch.id);
  }

  tentativeCandidates = candidates.map((entry) => retryCandidateByBatch.get(entry.batch.id) ?? entry);
  const secondByBatch = new Map(secondReviews.map((entry) => [entry.batch.id, entry]));
  const finalReviews = reviews.map((entry) => secondByBatch.get(entry.batch.id) ?? entry);
  const committedReanalysisIds = new Set(secondReviews
    .filter((entry) => reanalyzedByBatch.has(entry.batch.id) && retryCandidateByBatch.has(entry.batch.id))
    .map((entry) => entry.batch.id));
  analyses = analyses.map((entry) => (
    committedReanalysisIds.has(entry.batch.id) ? reanalyzedByBatch.get(entry.batch.id) : entry
  ));
  assembly = assemble(tentativeCandidates);
  const secondQuestions = secondReviews.flatMap((entry) => entry.verification.questions);
  if (secondQuestions.length > 0) {
    return resultFromState({
      source, wordCount, passages, analyses, finalCandidates: tentativeCandidates, finalReviews,
      status: "needs-clarification", questions: secondQuestions.slice(0, 1), verificationPasses: 2,
      documentFindings: [...assembly.documentFindings, ...retryNotes],
    });
  }

  let accepted = assembly.documentFindings.length === 0 && finalReviews.every((entry) => entry.verification.accepted);
  let certificationFindings = Object.freeze([]);
  let wholeDocumentCertification = null;
  const preliminarilySafeForReview = assembly.documentFindings.length === 0
    && hasNoDeterministicFindings(tentativeCandidates)
    && finalReviews.every(verificationSemanticallySafe)
    && finalReviews.some(hasExplicitReviewOnlyFailure);
  if (accepted || preliminarilySafeForReview) {
    wholeDocumentCertification = await certifyWholeDocument({
      source,
      candidate: assembly.text,
      batchCount: analyses.length,
      protectedPassageCount: passages.filter((passage) => passage.protected === true).length,
      passages,
      analyses,
      finalCandidates: tentativeCandidates,
      finalReviews,
      adapter: options.adapter,
      signal,
      onProgress,
      forceRequired: !accepted || analyses.some(({ analysis }) => analysis.passages.some(({ disposition }) => (
        disposition === "retain-if-conformant"
      ))),
    });
    accepted &&= wholeDocumentCertification.accepted;
    certificationFindings = wholeDocumentCertification.findings;
  }
  const finalStatus = !accepted && !materiallyDifferent(source, assembly.text)
    ? "unable-to-attempt"
    : acceptedStatus(accepted, assembly.text, analyses);
  return resultFromState({
    source, wordCount, passages, analyses, finalCandidates: tentativeCandidates, finalReviews,
    status: finalStatus, verificationPasses: retriedCandidates.length ? 2 : 1,
    documentFindings: [...assembly.documentFindings, ...retryNotes, ...certificationFindings],
    wholeDocumentCertification,
  });
}
