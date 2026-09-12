export type SearchEvidenceStrength = "explicit" | "curated" | "derived";

export type SearchConceptDefinition = Readonly<{
  id: string;
  label: string;
  aliases?: readonly string[];
  abbreviations?: readonly string[];
  broader?: readonly string[];
  narrower?: readonly string[];
  related?: readonly string[];
}>;

export type SearchEvidence = Readonly<{
  text: string;
  sourcePath: string;
  fieldPath: string;
  strength: SearchEvidenceStrength;
  conceptIds?: readonly string[];
}>;

export type SearchInterval = Readonly<{
  start: string;
  end: string | null;
  ongoing: boolean;
}>;

export type SearchRecord = Readonly<{
  id: string;
  class: string;
  order: number;
  title: string;
  href: string;
  subtitle?: string;
  summary?: string;
  evidence: readonly SearchEvidence[];
  interval?: SearchInterval;
}>;

export type SearchOntologyDefinition = Readonly<{
  version: string;
  classOrder: readonly string[];
  concepts: readonly SearchConceptDefinition[];
  records: readonly SearchRecord[];
  policy?: Readonly<{
    minimumAtomScore?: number;
    maximumQueryGraphemes?: number;
    maximumQueryAtoms?: number;
    allowInfixPartial?: boolean;
  }>;
}>;

type LexemeKind = "preferred" | "alias" | "abbreviation";

type IndexedConceptLexeme = Readonly<{
  conceptId: string;
  kind: LexemeKind;
  normalized: string;
  graphemes: readonly string[];
  signature: ReadonlyMap<string, number>;
  editBudget: number;
}>;

type IndexedEvidence = Readonly<{
  evidence: SearchEvidence;
  normalized: string;
  tokens: readonly string[];
}>;

type IndexedRecord = Readonly<{
  record: SearchRecord;
  evidence: readonly IndexedEvidence[];
  conceptIds: ReadonlySet<string>;
}>;

type IndexedEvidenceLexeme = Readonly<{
  recordId: string;
  evidenceIndex: number;
  normalized: string;
  graphemes: readonly string[];
  signature: ReadonlyMap<string, number>;
  editBudget: number;
}>;

export type CompiledSearchOntology = Readonly<{
  version: string;
  classOrder: readonly string[];
  concepts: ReadonlyMap<string, SearchConceptDefinition>;
  records: readonly IndexedRecord[];
  evidenceLexemes: readonly IndexedEvidenceLexeme[];
  conceptLexemes: readonly IndexedConceptLexeme[];
  normalizedConceptLexemes: ReadonlyMap<string, readonly IndexedConceptLexeme[]>;
  broaderClosure: ReadonlyMap<string, ReadonlyMap<string, number>>;
  narrowerClosure: ReadonlyMap<string, ReadonlyMap<string, number>>;
  related: ReadonlyMap<string, ReadonlySet<string>>;
  policy: Readonly<{
    minimumAtomScore: number;
    maximumQueryGraphemes: number;
    maximumQueryAtoms: number;
    allowInfixPartial: boolean;
  }>;
}>;

export type SearchMatchKind =
  | "exact"
  | "partial"
  | "fuzzy"
  | "concept"
  | "broader"
  | "narrower"
  | "related"
  | "temporal";

export type SearchMatchedEvidence = Readonly<{
  text: string;
  sourcePath: string;
  fieldPath: string;
  strength: SearchEvidenceStrength;
  kind: SearchMatchKind;
  score: number;
}>;

export type SearchHit = Readonly<{
  record: SearchRecord;
  score: number;
  matches: readonly SearchMatchedEvidence[];
}>;

type ConceptCandidate = Readonly<{
  conceptId: string;
  kind: "exact" | "partial" | "fuzzy";
  distance: number;
  score: number;
}>;

type QueryAtom = Readonly<{
  normalized: string;
  temporal: "current" | "concurrent" | "year" | null;
  year: number | null;
  concepts: readonly ConceptCandidate[];
  conceptAmbiguous: boolean;
}>;

type ConceptResolution = Readonly<{
  candidates: readonly ConceptCandidate[];
  ambiguous: boolean;
}>;

const DEFAULT_POLICY = Object.freeze({
  minimumAtomScore: 0.54,
  maximumQueryGraphemes: 160,
  maximumQueryAtoms: 12,
  allowInfixPartial: false,
});
const MAX_DEFINITION_ITEMS = 10_000;
const MAX_TEXT_UNITS = 20_000;
const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "or", "the", "to", "with"]);
const STRICT_SYMBOL_TERM = /[+#./]/u;
const YEAR = /^(?:19|20)\d{2}$/u;
const CURRENT_TERMS = new Set(["current", "currently", "ongoing", "present"]);
const CONCURRENT_TERMS = new Set(["concurrent", "concurrently", "overlap", "overlapping"]);
const STRENGTH_WEIGHT: Readonly<Record<SearchEvidenceStrength, number>> = Object.freeze({
  explicit: 1,
  curated: 0.86,
  derived: 0.72,
});

function requireString(value: unknown, label: string, allowEmpty = false): asserts value is string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim()) || value.length > MAX_TEXT_UNITS) {
    throw new TypeError(`${label} must be bounded text.`);
  }
}

function requireStringArray(value: unknown, label: string): asserts value is readonly string[] {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > MAX_DEFINITION_ITEMS) {
    throw new TypeError(`${label} must be a bounded text array.`);
  }
  value.forEach((entry, index) => requireString(entry, `${label}[${index}]`));
}

function freezeMap<K, V>(entries: Iterable<readonly [K, V]>) {
  return new Map(entries) as ReadonlyMap<K, V>;
}

function normalizeDashesAndQuotes(value: string) {
  return value
    .replace(/[\u2010-\u2015\u2212]/gu, "-")
    .replace(/[\u2018\u2019\u02bc]/gu, "'")
    .replace(/&/gu, " and ");
}

/**
 * Search normalization is deliberately text-only. The engine never walks an
 * arbitrary object or serializes JSON/JSON-LD into a search corpus.
 */
export function normalizeSearchText(value: string) {
  requireString(value, "Search text", true);
  return normalizeDashesAndQuotes(value)
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Letter}\p{Number}+#./'\-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function searchTokens(value: string) {
  const normalized = normalizeSearchText(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

const GRAPHEME_SEGMENTER = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("en", { granularity: "grapheme" })
  : null;

function graphemes(value: string): string[] {
  if (GRAPHEME_SEGMENTER) return Array.from(GRAPHEME_SEGMENTER.segment(value), ({ segment }) => segment);
  return Array.from(value);
}

function graphemeSignature(value: readonly string[]) {
  const counts = new Map<string, number>();
  for (const item of value) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts as ReadonlyMap<string, number>;
}

function graphemeCountLowerBound(left: ReadonlyMap<string, number>, right: ReadonlyMap<string, number>) {
  let difference = 0;
  const visited = new Set<string>();
  for (const [item, count] of left) {
    difference += Math.abs(count - (right.get(item) ?? 0));
    visited.add(item);
  }
  for (const [item, count] of right) {
    if (!visited.has(item)) difference += count;
  }
  return Math.ceil(difference / 2);
}

function graphemeDistance(a: readonly string[], b: readonly string[], maximum = Number.POSITIVE_INFINITY) {
  if (Math.abs(a.length - b.length) > maximum) return maximum + 1;
  let previousPrevious = new Array<number>(b.length + 1).fill(0);
  let previous = Array.from({ length: b.length + 1 }, (_value, index) => index);

  for (let row = 1; row <= a.length; row += 1) {
    const current = new Array<number>(b.length + 1).fill(0);
    current[0] = row;
    let rowMinimum = current[0];
    for (let column = 1; column <= b.length; column += 1) {
      const substitution = a[row - 1] === b[column - 1] ? 0 : 1;
      let distance = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + substitution,
      );
      if (
        row > 1
        && column > 1
        && a[row - 1] === b[column - 2]
        && a[row - 2] === b[column - 1]
      ) {
        distance = Math.min(distance, previousPrevious[column - 2] + 1);
      }
      current[column] = distance;
      rowMinimum = Math.min(rowMinimum, distance);
    }
    if (rowMinimum > maximum) return maximum + 1;
    previousPrevious = previous;
    previous = current;
  }
  return previous[b.length];
}

export function damerauLevenshtein(left: string, right: string, maximum = Number.POSITIVE_INFINITY) {
  return graphemeDistance(graphemes(left), graphemes(right), maximum);
}

export function baseEditBudget(length: number) {
  if (length <= 2) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  if (length <= 14) return 3;
  return 4;
}

function validateConcepts(concepts: readonly SearchConceptDefinition[]) {
  if (concepts.length > MAX_DEFINITION_ITEMS) throw new RangeError("Search ontology has too many concepts.");
  const byId = new Map<string, SearchConceptDefinition>();
  for (const [index, concept] of concepts.entries()) {
    if (!concept || typeof concept !== "object" || Array.isArray(concept)) {
      throw new TypeError(`concepts[${index}] must be a concept record.`);
    }
    requireString(concept.id, `concepts[${index}].id`);
    requireString(concept.label, `concepts[${index}].label`);
    requireStringArray(concept.aliases, `concepts[${index}].aliases`);
    requireStringArray(concept.abbreviations, `concepts[${index}].abbreviations`);
    requireStringArray(concept.broader, `concepts[${index}].broader`);
    requireStringArray(concept.narrower, `concepts[${index}].narrower`);
    requireStringArray(concept.related, `concepts[${index}].related`);
    if (byId.has(concept.id)) throw new TypeError(`Duplicate search concept: ${concept.id}.`);
    byId.set(concept.id, concept);
  }

  for (const concept of concepts) {
    for (const relation of ["broader", "narrower", "related"] as const) {
      for (const target of concept[relation] ?? []) {
        if (!byId.has(target)) throw new TypeError(`Search concept ${concept.id} has a dangling ${relation} relation to ${target}.`);
        if (target === concept.id) throw new TypeError(`Search concept ${concept.id} cannot relate to itself.`);
      }
    }
  }

  const hierarchy = new Map<string, Set<string>>();
  for (const concept of concepts) hierarchy.set(concept.id, new Set(concept.broader ?? []));
  for (const concept of concepts) {
    for (const narrower of concept.narrower ?? []) hierarchy.get(narrower)?.add(concept.id);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new TypeError(`Search concept hierarchy contains a cycle at ${id}.`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const parent of hierarchy.get(id) ?? []) visit(parent);
    visiting.delete(id);
    visited.add(id);
  };
  concepts.forEach(({ id }) => visit(id));
  return { byId, hierarchy };
}

function transitiveClosure(adjacency: ReadonlyMap<string, ReadonlySet<string>>) {
  const result = new Map<string, ReadonlyMap<string, number>>();
  for (const origin of adjacency.keys()) {
    const distances = new Map<string, number>();
    const queue = [...(adjacency.get(origin) ?? [])].map((id) => ({ id, distance: 1 }));
    while (queue.length) {
      const current = queue.shift();
      if (!current || current.id === origin) continue;
      const prior = distances.get(current.id);
      if (prior !== undefined && prior <= current.distance) continue;
      distances.set(current.id, current.distance);
      for (const target of adjacency.get(current.id) ?? []) {
        queue.push({ id: target, distance: current.distance + 1 });
      }
    }
    result.set(origin, freezeMap(distances));
  }
  return freezeMap(result);
}

function conceptGraph(
  concepts: readonly SearchConceptDefinition[],
  hierarchy: ReadonlyMap<string, ReadonlySet<string>>,
) {
  const narrower = new Map<string, Set<string>>(concepts.map(({ id }) => [id, new Set()]));
  for (const [child, parents] of hierarchy) {
    for (const parent of parents) narrower.get(parent)?.add(child);
  }
  const related = new Map<string, Set<string>>(concepts.map(({ id }) => [id, new Set()]));
  for (const concept of concepts) {
    for (const target of concept.related ?? []) {
      related.get(concept.id)?.add(target);
      related.get(target)?.add(concept.id);
    }
  }
  return {
    broaderClosure: transitiveClosure(hierarchy),
    narrowerClosure: transitiveClosure(narrower),
    related: freezeMap(Array.from(related, ([id, values]) => [id, values as ReadonlySet<string>] as const)),
  };
}

function rawConceptLexemes(concepts: readonly SearchConceptDefinition[]) {
  const lexemes: Array<Omit<IndexedConceptLexeme, "editBudget">> = [];
  for (const concept of concepts) {
    const add = (text: string, kind: LexemeKind) => {
      const normalized = normalizeSearchText(text);
      if (!normalized) return;
      const segmented = Object.freeze(graphemes(normalized));
      lexemes.push(Object.freeze({ conceptId: concept.id, kind, normalized, graphemes: segmented, signature: graphemeSignature(segmented) }));
    };
    add(concept.label, "preferred");
    concept.aliases?.forEach((alias) => add(alias, "alias"));
    concept.abbreviations?.forEach((abbreviation) => add(abbreviation, "abbreviation"));
  }
  return lexemes;
}

function collisionBudget(
  lexeme: Omit<IndexedConceptLexeme, "editBudget">,
  all: readonly Omit<IndexedConceptLexeme, "editBudget">[],
) {
  if (lexeme.kind === "abbreviation" || STRICT_SYMBOL_TERM.test(lexeme.normalized)) return 0;
  const base = baseEditBudget(lexeme.graphemes.length);
  if (base === 0) return 0;
  let nearest = Number.POSITIVE_INFINITY;
  for (const candidate of all) {
    if (candidate.conceptId === lexeme.conceptId || candidate.normalized === lexeme.normalized) continue;
    if (Math.abs(candidate.graphemes.length - lexeme.graphemes.length) > base * 2 + 1) continue;
    if (graphemeCountLowerBound(lexeme.signature, candidate.signature) > base * 2 + 1) continue;
    nearest = Math.min(nearest, graphemeDistance(lexeme.graphemes, candidate.graphemes, base * 2 + 1));
    if (nearest <= 1) break;
  }
  const safeRadius = Number.isFinite(nearest) ? Math.max(0, Math.floor((nearest - 1) / 2)) : base;
  return Math.min(base, safeRadius);
}

function compileConceptLexemes(concepts: readonly SearchConceptDefinition[]) {
  const raw = rawConceptLexemes(concepts);
  const compiled = raw.map((lexeme) => Object.freeze({
    ...lexeme,
    editBudget: collisionBudget(lexeme, raw),
  }));
  const byNormalized = new Map<string, IndexedConceptLexeme[]>();
  for (const lexeme of compiled) {
    const bucket = byNormalized.get(lexeme.normalized) ?? [];
    bucket.push(lexeme);
    byNormalized.set(lexeme.normalized, bucket);
  }
  return {
    lexemes: Object.freeze(compiled),
    byNormalized: freezeMap(Array.from(byNormalized, ([key, value]) => [key, Object.freeze(value)] as const)),
  };
}

function validateInterval(interval: SearchInterval | undefined, label: string) {
  if (!interval) return;
  requireString(interval.start, `${label}.start`);
  if (interval.end !== null) requireString(interval.end, `${label}.end`);
  if (typeof interval.ongoing !== "boolean") throw new TypeError(`${label}.ongoing must be boolean.`);
  if (!/^\d{4}(?:-\d{2})?$/u.test(interval.start) || (interval.end !== null && !/^\d{4}(?:-\d{2})?$/u.test(interval.end))) {
    throw new TypeError(`${label} must use a year or year-month interval.`);
  }
}

function validateAndCompileRecords(
  records: readonly SearchRecord[],
  classOrder: readonly string[],
  concepts: ReadonlyMap<string, SearchConceptDefinition>,
) {
  if (records.length > MAX_DEFINITION_ITEMS) throw new RangeError("Search ontology has too many records.");
  const recordIds = new Set<string>();
  const classSet = new Set(classOrder);
  return Object.freeze(records.map((record, recordIndex) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new TypeError(`records[${recordIndex}] must be a search record.`);
    }
    requireString(record.id, `records[${recordIndex}].id`);
    requireString(record.class, `records[${recordIndex}].class`);
    requireString(record.title, `records[${recordIndex}].title`);
    requireString(record.href, `records[${recordIndex}].href`);
    if (record.subtitle !== undefined) requireString(record.subtitle, `records[${recordIndex}].subtitle`, true);
    if (record.summary !== undefined) requireString(record.summary, `records[${recordIndex}].summary`, true);
    if (!classSet.has(record.class)) throw new TypeError(`Search record ${record.id} has an unknown class.`);
    if (!Number.isSafeInteger(record.order) || record.order < 0) throw new TypeError(`Search record ${record.id} has an invalid order.`);
    if (recordIds.has(record.id)) throw new TypeError(`Duplicate search record: ${record.id}.`);
    recordIds.add(record.id);
    validateInterval(record.interval, `records[${recordIndex}].interval`);
    if (!Array.isArray(record.evidence) || record.evidence.length > MAX_DEFINITION_ITEMS) {
      throw new TypeError(`Search record ${record.id} must have bounded evidence.`);
    }
    const conceptIds = new Set<string>();
    const evidence = record.evidence.map((item, evidenceIndex) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new TypeError(`records[${recordIndex}].evidence[${evidenceIndex}] must be an evidence record.`);
      }
      requireString(item.text, `records[${recordIndex}].evidence[${evidenceIndex}].text`);
      requireString(item.sourcePath, `records[${recordIndex}].evidence[${evidenceIndex}].sourcePath`);
      requireString(item.fieldPath, `records[${recordIndex}].evidence[${evidenceIndex}].fieldPath`);
      if (typeof item.strength !== "string" || !Object.hasOwn(STRENGTH_WEIGHT, item.strength)) {
        throw new TypeError(`Search evidence has an invalid strength.`);
      }
      requireStringArray(item.conceptIds, `records[${recordIndex}].evidence[${evidenceIndex}].conceptIds`);
      for (const conceptId of item.conceptIds ?? []) {
        if (!concepts.has(conceptId)) throw new TypeError(`Search record ${record.id} cites unknown concept ${conceptId}.`);
        conceptIds.add(conceptId);
      }
      return Object.freeze({
        evidence: item,
        normalized: normalizeSearchText(item.text),
        tokens: Object.freeze(searchTokens(item.text)),
      });
    });
    return Object.freeze({ record, evidence: Object.freeze(evidence), conceptIds: conceptIds as ReadonlySet<string> });
  }));
}

function compileEvidenceLexemes(records: readonly IndexedRecord[]) {
  const raw: Array<Omit<IndexedEvidenceLexeme, "editBudget">> = [];
  for (const indexedRecord of records) {
    indexedRecord.evidence.forEach((indexedEvidence, evidenceIndex) => {
      const values = new Set(indexedEvidence.tokens);
      // Hyphenated names and slash-delimited labels expose each lexical access
      // point independently without discarding the punctuation-preserving
      // whole value used by programming and product terms.
      for (const token of indexedEvidence.tokens) {
        for (const accessPoint of token.split(/[-/']+/u)) {
          if (accessPoint) values.add(accessPoint);
        }
      }
      if (indexedEvidence.tokens.length === 1 || graphemes(indexedEvidence.normalized).length <= 32) {
        values.add(indexedEvidence.normalized);
      }
      for (const normalized of values) {
        if (!normalized) continue;
        const segmented = Object.freeze(graphemes(normalized));
        raw.push(Object.freeze({
          recordId: indexedRecord.record.id,
          evidenceIndex,
          normalized,
          graphemes: segmented,
          signature: graphemeSignature(segmented),
        }));
      }
    });
  }
  return Object.freeze(raw.map((entry) => Object.freeze({
    ...entry,
    editBudget: STRICT_SYMBOL_TERM.test(entry.normalized) ? 0 : baseEditBudget(entry.graphemes.length),
  })));
}

export function compileSearchOntology(definition: SearchOntologyDefinition): CompiledSearchOntology {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    throw new TypeError("Search ontology definition must be a record.");
  }
  requireString(definition.version, "Search ontology version");
  requireStringArray(definition.classOrder, "Search ontology classOrder");
  if (!definition.classOrder.length || new Set(definition.classOrder).size !== definition.classOrder.length) {
    throw new TypeError("Search ontology classOrder must contain unique classes.");
  }
  if (!Array.isArray(definition.concepts) || !Array.isArray(definition.records)) {
    throw new TypeError("Search ontology concepts and records must be arrays.");
  }
  if (!definition.concepts.length) {
    throw new TypeError("Search requires a nonempty subject ontology.");
  }
  const { byId, hierarchy } = validateConcepts(definition.concepts);
  const graph = conceptGraph(definition.concepts, hierarchy);
  const lexemes = compileConceptLexemes(definition.concepts);
  const policy = Object.freeze({
    minimumAtomScore: definition.policy?.minimumAtomScore ?? DEFAULT_POLICY.minimumAtomScore,
    maximumQueryGraphemes: definition.policy?.maximumQueryGraphemes ?? DEFAULT_POLICY.maximumQueryGraphemes,
    maximumQueryAtoms: definition.policy?.maximumQueryAtoms ?? DEFAULT_POLICY.maximumQueryAtoms,
    allowInfixPartial: definition.policy?.allowInfixPartial ?? DEFAULT_POLICY.allowInfixPartial,
  });
  if (
    !Number.isFinite(policy.minimumAtomScore)
    || policy.minimumAtomScore <= 0
    || policy.minimumAtomScore > 1
    || !Number.isSafeInteger(policy.maximumQueryGraphemes)
    || policy.maximumQueryGraphemes < 1
    || policy.maximumQueryGraphemes > 1_000
    || !Number.isSafeInteger(policy.maximumQueryAtoms)
    || policy.maximumQueryAtoms < 1
    || policy.maximumQueryAtoms > 100
    || typeof policy.allowInfixPartial !== "boolean"
  ) throw new TypeError("Search ontology policy is invalid.");

  const records = validateAndCompileRecords(definition.records, definition.classOrder, byId);
  return Object.freeze({
    version: definition.version,
    classOrder: Object.freeze([...definition.classOrder]),
    concepts: freezeMap(byId),
    records,
    evidenceLexemes: compileEvidenceLexemes(records),
    conceptLexemes: lexemes.lexemes,
    normalizedConceptLexemes: lexemes.byNormalized,
    ...graph,
    policy,
  });
}

function partialMatch(query: string, lexeme: string, allowInfix = false) {
  if (!query || !lexeme) return false;
  if (query === lexeme) return true;
  // Literal progressive matching is safe at every length because it does not
  // infer a correction. In particular, Shelf historically filtered from the
  // first typed character; typo budgets remain zero for short terms. Search
  // never treats an arbitrary substring as a prefix: `work` must not match
  // `network`, and `ux` must not match `lux`.
  return lexeme.startsWith(query) || (allowInfix && lexeme.includes(query));
}

type FuzzyTarget = Readonly<{
  graphemes: readonly string[];
  signature: ReadonlyMap<string, number>;
  maximumBudget: number;
  spanLength: number;
  surface: string;
  kind: "full" | "progressive";
}>;

type ScoredFuzzyTarget = FuzzyTarget & Readonly<{ distance: number }>;

function fuzzyTargets(
  query: string,
  queryLength: number,
  fullNormalized: string,
  fullGraphemes: readonly string[],
  fullSignature: ReadonlyMap<string, number>,
  fullMaximumBudget: number,
  allowProgressive: boolean,
) {
  if (STRICT_SYMBOL_TERM.test(query)) return Object.freeze([]) as readonly FuzzyTarget[];
  const targets: FuzzyTarget[] = [];
  if (fullMaximumBudget > 0 && !STRICT_SYMBOL_TERM.test(fullNormalized)) {
    targets.push(Object.freeze({
      graphemes: fullGraphemes,
      signature: fullSignature,
      maximumBudget: fullMaximumBudget,
      spanLength: fullGraphemes.length,
      surface: fullNormalized,
      kind: "full" as const,
    }));
  }

  const progressiveBudget = Math.min(baseEditBudget(queryLength), 1);
  if (
    !allowProgressive
    || queryLength < 4
    || queryLength >= fullGraphemes.length
    || progressiveBudget === 0
  ) return Object.freeze(targets);

  // A correction may insert or remove a character at the autocomplete
  // frontier. Compare the same-size prefix and its immediate neighbours so
  // substitution, transposition, insertion, and deletion remain available
  // before a long label is fully typed.
  for (const spanLength of [queryLength - 1, queryLength, queryLength + 1]) {
    if (spanLength < 4 || spanLength >= fullGraphemes.length) continue;
    const targetGraphemes = Object.freeze(fullGraphemes.slice(0, spanLength));
    const surface = targetGraphemes.join("");
    // Whitespace is a boundary, not an inferred character. Symbol-bearing
    // spans remain strict, but punctuation later in an unseen suffix must not
    // disable correction of a plain-text prefix such as `jonh` -> `john` in
    // `John W. Parker and Son`.
    if (surface.trim() !== surface || STRICT_SYMBOL_TERM.test(surface)) continue;
    targets.push(Object.freeze({
      graphemes: targetGraphemes,
      signature: graphemeSignature(targetGraphemes),
      maximumBudget: progressiveBudget,
      spanLength,
      surface,
      kind: "progressive" as const,
    }));
  }
  return Object.freeze(targets);
}

function scoreFuzzyTargets(
  queryGraphemes: readonly string[],
  querySignature: ReadonlyMap<string, number>,
  targets: readonly FuzzyTarget[],
  budgetForTarget: (target: FuzzyTarget) => number = ({ maximumBudget }) => maximumBudget,
) {
  const matches: ScoredFuzzyTarget[] = [];
  for (const target of targets) {
    // Do these cheap maximum-radius checks before computing a lazy collision
    // budget. This keeps impossible short/long pairs out of global scans.
    if (Math.abs(target.graphemes.length - queryGraphemes.length) > target.maximumBudget) continue;
    if (graphemeCountLowerBound(querySignature, target.signature) > target.maximumBudget) continue;
    const budget = Math.min(target.maximumBudget, budgetForTarget(target));
    if (budget === 0) continue;
    const distance = graphemeDistance(queryGraphemes, target.graphemes, budget);
    if (distance <= budget) matches.push(Object.freeze({ ...target, distance }));
  }
  if (!matches.length) return null;
  const bestDistance = Math.min(...matches.map(({ distance }) => distance));
  // Within one lexeme, prefer the longest equally plausible corrected prefix:
  // `jonh` is `john`, not the shorter `joh` plus an inserted character.
  const bestSpanLength = Math.max(...matches
    .filter(({ distance }) => distance === bestDistance)
    .map(({ spanLength }) => spanLength));
  return matches.find(({ distance, spanLength }) => (
    distance === bestDistance && spanLength === bestSpanLength
  )) ?? null;
}

function fuzzyConceptCandidate(
  query: string,
  queryGraphemes: readonly string[],
  querySignature: ReadonlyMap<string, number>,
  lexeme: IndexedConceptLexeme,
) {
  const best = scoreFuzzyTargets(queryGraphemes, querySignature, fuzzyTargets(
    query,
    queryGraphemes.length,
    lexeme.normalized,
    lexeme.graphemes,
    lexeme.signature,
    lexeme.editBudget,
    lexeme.kind !== "abbreviation",
  ));
  if (!best) return null;
  return {
    conceptId: lexeme.conceptId,
    kind: "fuzzy" as const,
    distance: best.distance,
    score: Math.max(0.58, 0.84 - best.distance * 0.08),
    surface: best.surface,
    lexeme,
  };
}

function conceptResolution(index: CompiledSearchOntology, normalized: string): ConceptResolution {
  const exact = index.normalizedConceptLexemes.get(normalized) ?? [];
  if (exact.length) {
    return Object.freeze({
      candidates: Object.freeze(exact.map(({ conceptId }) => Object.freeze({ conceptId, kind: "exact" as const, distance: 0, score: 1 }))),
      ambiguous: false,
    });
  }

  const partial = index.conceptLexemes.filter((lexeme) => partialMatch(normalized, lexeme.normalized, index.policy.allowInfixPartial));
  if (partial.length) {
    const best = new Map<string, ConceptCandidate>();
    for (const lexeme of partial) {
      const score = lexeme.normalized.startsWith(normalized) ? 0.92 : 0.88;
      const current = best.get(lexeme.conceptId);
      if (!current || current.score < score) best.set(lexeme.conceptId, { conceptId: lexeme.conceptId, kind: "partial", distance: 0, score });
    }
    return Object.freeze({ candidates: Object.freeze([...best.values()]), ambiguous: false });
  }

  const queryGraphemes = graphemes(normalized);
  const querySignature = graphemeSignature(queryGraphemes);
  const fuzzy: Array<ConceptCandidate & { surface: string; lexeme: IndexedConceptLexeme }> = [];
  for (const lexeme of index.conceptLexemes) {
    const candidate = fuzzyConceptCandidate(normalized, queryGraphemes, querySignature, lexeme);
    if (candidate) fuzzy.push(candidate);
  }
  if (!fuzzy.length) return Object.freeze({ candidates: Object.freeze([]), ambiguous: false });
  fuzzy.sort((left, right) => (
    left.distance - right.distance
    || left.surface.localeCompare(right.surface)
    || left.conceptId.localeCompare(right.conceptId)
  ));
  const bestDistance = fuzzy[0].distance;
  const closest = fuzzy.filter(({ distance }) => distance === bestDistance);
  const correctedSurfaces = new Set(closest.map(({ surface }) => surface));
  if (correctedSurfaces.size !== 1) {
    return Object.freeze({ candidates: Object.freeze([]), ambiguous: true });
  }
  const [selectedSurface] = correctedSurfaces;
  const bestByConcept = new Map<string, ConceptCandidate>();
  for (const candidate of closest) {
    if (candidate.surface !== selectedSurface || bestByConcept.has(candidate.conceptId)) continue;
    bestByConcept.set(candidate.conceptId, Object.freeze({
      conceptId: candidate.conceptId,
      kind: candidate.kind,
      distance: candidate.distance,
      score: candidate.score,
    }));
  }
  return Object.freeze({
    // Multiple ontology concepts may deliberately share the same corrected
    // prefix (`john`, `stud`, `adam`). Preserve that fanout; ambiguity belongs
    // to distinct corrected surfaces, not to the number of owning concepts.
    candidates: Object.freeze([...bestByConcept.values()]),
    ambiguous: false,
  });
}

function exactConceptSpan(index: CompiledSearchOntology, tokens: readonly string[], start: number) {
  const maximum = Math.min(tokens.length, start + 6);
  for (let end = maximum; end > start; end -= 1) {
    const normalized = tokens.slice(start, end).join(" ");
    if (index.normalizedConceptLexemes.has(normalized)) return { normalized, end };
  }
  return null;
}

function queryAtoms(index: CompiledSearchOntology, query: string): readonly QueryAtom[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return Object.freeze([]);
  if (graphemes(normalized).length > index.policy.maximumQueryGraphemes) {
    throw new RangeError(`Search accepts at most ${index.policy.maximumQueryGraphemes} characters.`);
  }
  const wholeResolution = conceptResolution(index, normalized);
  if (normalized.includes(" ") && (wholeResolution.candidates.length || wholeResolution.ambiguous)) {
    return Object.freeze([Object.freeze({
      normalized,
      temporal: null,
      year: null,
      concepts: wholeResolution.candidates,
      conceptAmbiguous: wholeResolution.ambiguous,
    })]);
  }
  const tokens = normalized.split(" ").filter((token) => token && !STOP_WORDS.has(token));
  const atoms: QueryAtom[] = [];
  for (let position = 0; position < tokens.length;) {
    const span = exactConceptSpan(index, tokens, position);
    const atomText = span?.normalized ?? tokens[position];
    position = span?.end ?? position + 1;
    const year = YEAR.test(atomText) ? Number(atomText) : null;
    const temporal = year !== null
      ? "year"
      : CURRENT_TERMS.has(atomText)
        ? "current"
        : CONCURRENT_TERMS.has(atomText)
          ? "concurrent"
          : null;
    const resolution = temporal
      ? Object.freeze({ candidates: Object.freeze([]), ambiguous: false })
      : conceptResolution(index, atomText);
    atoms.push(Object.freeze({
      normalized: atomText,
      temporal,
      year,
      concepts: resolution.candidates,
      conceptAmbiguous: resolution.ambiguous,
    }));
  }
  if (atoms.length > index.policy.maximumQueryAtoms) {
    throw new RangeError(`Search accepts at most ${index.policy.maximumQueryAtoms} meaningful terms.`);
  }
  return Object.freeze(atoms);
}

function intervalYear(value: string) {
  return Number(value.slice(0, 4));
}

function intervalsOverlap(left: SearchInterval, right: SearchInterval) {
  const leftStart = intervalYear(left.start);
  const rightStart = intervalYear(right.start);
  const leftEnd = left.end === null ? Number.POSITIVE_INFINITY : intervalYear(left.end);
  const rightEnd = right.end === null ? Number.POSITIVE_INFINITY : intervalYear(right.end);
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function temporalScore(index: CompiledSearchOntology, record: IndexedRecord, atom: QueryAtom) {
  const interval = record.record.interval;
  if (!interval || !atom.temporal) return 0;
  if (atom.temporal === "current") return interval.ongoing ? 1 : 0;
  if (atom.temporal === "year" && atom.year !== null) {
    const start = intervalYear(interval.start);
    const end = interval.end === null ? Number.POSITIVE_INFINITY : intervalYear(interval.end);
    return atom.year >= start && atom.year <= end ? 1 : 0;
  }
  if (atom.temporal === "concurrent") {
    return index.records.some((candidate) => candidate.record.id !== record.record.id
      && candidate.record.interval
      && intervalsOverlap(interval, candidate.record.interval)) ? 0.82 : 0;
  }
  return 0;
}

function relationScore(index: CompiledSearchOntology, queryConcept: string, recordConcept: string) {
  if (queryConcept === recordConcept) return { kind: "concept" as const, score: 1 };
  const narrowerDistance = index.narrowerClosure.get(queryConcept)?.get(recordConcept);
  if (narrowerDistance !== undefined) return { kind: "narrower" as const, score: Math.max(0.62, 0.88 - (narrowerDistance - 1) * 0.1) };
  // A broad query may retrieve specifically classified records. The reverse
  // is not evidence: a record tagged only "systems" does not thereby claim
  // UX or information architecture. Related concepts likewise aid ontology
  // design but do not independently make a record eligible.
  return null;
}

const EVIDENCE_COLLISION_BUDGETS = new WeakMap<object, Map<string, number>>();

function evidenceCollisionBudget(index: CompiledSearchOntology, lexeme: IndexedEvidenceLexeme) {
  let cache = EVIDENCE_COLLISION_BUDGETS.get(index);
  if (!cache) {
    cache = new Map();
    EVIDENCE_COLLISION_BUDGETS.set(index, cache);
  }
  const cached = cache.get(lexeme.normalized);
  if (cached !== undefined) return cached;
  const base = lexeme.editBudget;
  if (base === 0) {
    cache.set(lexeme.normalized, 0);
    return 0;
  }
  let nearest = Number.POSITIVE_INFINITY;
  const visited = new Set<string>();
  for (const candidate of index.evidenceLexemes) {
    if (candidate.normalized === lexeme.normalized || visited.has(candidate.normalized)) continue;
    visited.add(candidate.normalized);
    if (Math.abs(candidate.graphemes.length - lexeme.graphemes.length) > base * 2) continue;
    if (graphemeCountLowerBound(lexeme.signature, candidate.signature) > base * 2) continue;
    nearest = Math.min(nearest, graphemeDistance(lexeme.graphemes, candidate.graphemes, base * 2));
    if (nearest <= 1) break;
  }
  const safeRadius = Number.isFinite(nearest) ? Math.max(0, Math.floor((nearest - 1) / 2)) : base;
  const budget = Math.min(base, safeRadius);
  cache.set(lexeme.normalized, budget);
  return budget;
}

function fuzzyEvidenceMatches(index: CompiledSearchOntology, atom: QueryAtom) {
  if (STRICT_SYMBOL_TERM.test(atom.normalized)) return new Set<string>();
  const queryGraphemes = graphemes(atom.normalized);
  const querySignature = graphemeSignature(queryGraphemes);
  const queryLength = queryGraphemes.length;
  const candidates: Array<IndexedEvidenceLexeme & { distance: number; surface: string }> = [];
  for (const lexeme of index.evidenceLexemes) {
    const fullCouldMatch = lexeme.editBudget > 0
      && Math.abs(lexeme.graphemes.length - queryLength) <= lexeme.editBudget
      && graphemeCountLowerBound(querySignature, lexeme.signature) <= lexeme.editBudget;
    const progressiveCouldMatch = queryLength >= 4 && queryLength < lexeme.graphemes.length;
    if (!fullCouldMatch && !progressiveCouldMatch) continue;
    const best = scoreFuzzyTargets(
      queryGraphemes,
      querySignature,
      fuzzyTargets(
        atom.normalized,
        queryLength,
        lexeme.normalized,
        lexeme.graphemes,
        lexeme.signature,
        lexeme.editBudget,
        true,
      ),
      (target) => target.kind === "full" ? evidenceCollisionBudget(index, lexeme) : target.maximumBudget,
    );
    if (best) candidates.push({ ...lexeme, distance: best.distance, surface: best.surface });
  }
  if (!candidates.length) return new Set<string>();
  candidates.sort((left, right) => left.distance - right.distance || left.surface.localeCompare(right.surface));
  const bestDistance = candidates[0].distance;
  const closest = candidates.filter(({ distance }) => distance === bestDistance);
  const correctedSurfaces = new Set(closest.map(({ surface }) => surface));
  if (correctedSurfaces.size !== 1) return new Set<string>();
  const [winningSurface] = correctedSurfaces;
  return new Set(candidates
    .filter(({ surface, distance }) => surface === winningSurface && distance === bestDistance)
    .map(({ recordId, evidenceIndex }) => `${recordId}\u0000${evidenceIndex}`));
}

function directEvidenceScore(
  recordId: string,
  evidenceIndex: number,
  atom: QueryAtom,
  indexed: IndexedEvidence,
  fuzzyMatches: ReadonlySet<string>,
  allowInfixPartial: boolean,
) {
  if (indexed.normalized === atom.normalized) return { kind: "exact" as const, score: 1 };
  if (
    partialMatch(atom.normalized, indexed.normalized, allowInfixPartial)
    || indexed.tokens.some((token) => partialMatch(atom.normalized, token, allowInfixPartial))
  ) {
    return { kind: "partial" as const, score: indexed.normalized.startsWith(atom.normalized) ? 0.92 : 0.86 };
  }
  if (fuzzyMatches.has(`${recordId}\u0000${evidenceIndex}`)) return { kind: "fuzzy" as const, score: 0.72 };
  return null;
}

function scoreAtom(
  index: CompiledSearchOntology,
  record: IndexedRecord,
  atom: QueryAtom,
  fuzzyMatches: ReadonlySet<string>,
) {
  const temporal = temporalScore(index, record, atom);
  if (atom.temporal) {
    return temporal > 0 ? {
      text: record.record.interval?.ongoing ? "Current" : atom.normalized,
      sourcePath: "typed interval",
      fieldPath: "interval",
      strength: "derived" as const,
      kind: "temporal" as const,
      score: temporal,
    } : null;
  }
  if (atom.conceptAmbiguous) return null;
  let best: SearchMatchedEvidence | null = null;

  for (const [evidenceIndex, indexedEvidence] of record.evidence.entries()) {
    const strength = STRENGTH_WEIGHT[indexedEvidence.evidence.strength];
    // Once the subject ontology resolves an atom, it owns eligibility. Raw
    // prose cannot bypass that intent merely because it happens to contain
    // the same word (for example, "work under pressure").
    if (atom.concepts.length === 0) {
      const direct = directEvidenceScore(
        record.record.id,
        evidenceIndex,
        atom,
        indexedEvidence,
        fuzzyMatches,
        index.policy.allowInfixPartial,
      );
      if (direct) {
        const score = direct.score * strength;
        if (!best || score > best.score) best = { ...indexedEvidence.evidence, kind: direct.kind, score };
      }
    }
    for (const candidate of atom.concepts) {
      for (const recordConcept of indexedEvidence.evidence.conceptIds ?? []) {
        const relation = relationScore(index, candidate.conceptId, recordConcept);
        if (!relation) continue;
        const score = candidate.score * relation.score * strength;
        if (!best || score > best.score) best = { ...indexedEvidence.evidence, kind: relation.kind, score };
      }
    }
  }
  return best;
}

function exactWholeEvidenceMatch(record: IndexedRecord, normalizedQuery: string) {
  // A specific multiword entity or quoted corpus phrase remains directly
  // findable even when one of its component words is also an ontology label.
  // Single-token queries do not receive this escape hatch: resolved subject
  // intent still owns eligibility for queries such as "work" or "systems".
  if (!normalizedQuery.includes(" ")) return null;
  let best: SearchMatchedEvidence | null = null;
  for (const indexedEvidence of record.evidence) {
    if (indexedEvidence.normalized !== normalizedQuery) continue;
    const score = STRENGTH_WEIGHT[indexedEvidence.evidence.strength];
    if (!best || score > best.score) {
      best = { ...indexedEvidence.evidence, kind: "exact", score };
    }
  }
  return best;
}

export function searchOntology(
  index: CompiledSearchOntology,
  query: string,
  options: Readonly<{ limit?: number }> = {},
): readonly SearchHit[] {
  if (!index || typeof index !== "object") throw new TypeError("Search requires a compiled ontology.");
  requireString(query, "Search query", true);
  const normalizedQuery = normalizeSearchText(query);
  const atoms = queryAtoms(index, query);
  if (!atoms.length) return Object.freeze([]);
  const classRank = new Map(index.classOrder.map((name, rank) => [name, rank]));
  const fuzzyMatches = atoms.map((atom) => atom.temporal ? new Set<string>() : fuzzyEvidenceMatches(index, atom));
  const hits: SearchHit[] = [];
  for (const indexedRecord of index.records) {
    const matches = atoms.map((atom, atomIndex) => scoreAtom(index, indexedRecord, atom, fuzzyMatches[atomIndex]));
    const atomFailure = matches.some((match) => !match || match.score < index.policy.minimumAtomScore);
    const exactPhrase = atomFailure ? exactWholeEvidenceMatch(indexedRecord, normalizedQuery) : null;
    if (atomFailure && !exactPhrase) continue;
    const accepted = exactPhrase
      ? [exactPhrase]
      : matches.filter((match): match is SearchMatchedEvidence => match !== null);
    const average = accepted.reduce((total, match) => total + match.score, 0) / accepted.length;
    const score = Number(average.toFixed(6));
    hits.push(Object.freeze({
      record: indexedRecord.record,
      score,
      matches: Object.freeze(accepted.map((match) => Object.freeze(match))),
    }));
  }
  hits.sort((left, right) => (
    (classRank.get(left.record.class) ?? Number.MAX_SAFE_INTEGER) - (classRank.get(right.record.class) ?? Number.MAX_SAFE_INTEGER)
    || right.score - left.score
    || left.record.order - right.record.order
    || left.record.id.localeCompare(right.record.id)
  ));
  const limit = options.limit;
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) throw new TypeError("Search result limit must be a non-negative integer.");
  return Object.freeze(limit === undefined ? hits : hits.slice(0, limit));
}
