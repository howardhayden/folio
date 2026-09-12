import type { Paper } from "../data";
import {
  compileSearchOntology,
  searchOntology,
  type CompiledSearchOntology,
  type SearchConceptDefinition,
  type SearchEvidence,
  type SearchOntologyDefinition,
  type SearchRecord,
} from "../search/ontologySearch.ts";

export const SHELF_SEARCH_ONTOLOGY_VERSION = "hah-shelf-search.v1";

export const SHELF_SEARCH_FIELDS = Object.freeze([
  "language",
  "publisher",
  "author",
  "collection",
] as const);

export type ShelfSearchField = (typeof SHELF_SEARCH_FIELDS)[number];

type ShelfIndexes = Readonly<Record<ShelfSearchField, CompiledSearchOntology>>;

const PAPER_FIELD: Readonly<Record<ShelfSearchField, keyof Pick<Paper, "languages" | "publishers" | "authors" | "collections">>> = Object.freeze({
  language: "languages",
  publisher: "publishers",
  author: "authors",
  collection: "collections",
});

const LANGUAGE_PARENT: Readonly<Record<string, string>> = Object.freeze({
  "Portuguese — Brazil": "Portuguese",
  "Simplified Chinese": "Chinese",
  "Spanish — Latin America": "Spanish",
  "Spanish — Spain": "Spanish",
  "Traditional Chinese": "Chinese",
});

const COLLECTION_PARENT: Readonly<Record<string, string>> = Object.freeze({
  "Personal Resilience": "Resilience",
  "Societal Resilience": "Resilience",
});

const PUBLISHER_ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "ALA Editions": Object.freeze(["American Library Association Editions"]),
  "ALA Neal-Schuman": Object.freeze(["American Library Association Neal-Schuman"]),
  "Production I.G.": Object.freeze(["Production IG"]),
  "Simon & Schuster": Object.freeze(["Simon and Schuster"]),
});

const PUBLISHER_ABBREVIATIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "ALA Editions": Object.freeze(["ALA"]),
  "ALA Neal-Schuman": Object.freeze(["ALA"]),
});

function conceptId(field: ShelfSearchField, index: number) {
  return `shelf-${field}-${index}`;
}

function parentConceptId(field: ShelfSearchField, label: string) {
  return `shelf-${field}-parent-${label.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "")}`;
}

function aliasesFor(field: ShelfSearchField, value: string) {
  if (field === "language" && value === "Portuguese — Brazil") return Object.freeze(["Brazilian Portuguese"]);
  return field === "publisher" ? PUBLISHER_ALIASES[value] : undefined;
}

function abbreviationsFor(field: ShelfSearchField, value: string) {
  return field === "publisher" ? PUBLISHER_ABBREVIATIONS[value] : undefined;
}

function parentFor(field: ShelfSearchField, value: string) {
  if (field === "language") return LANGUAGE_PARENT[value];
  if (field === "collection") return COLLECTION_PARENT[value];
  return undefined;
}

export function shelfSearchDefinition(papers: readonly Paper[], field: ShelfSearchField): SearchOntologyDefinition {
  const paperField = PAPER_FIELD[field];
  const values = [...new Set(papers.flatMap((paper) => paper[paperField]))];
  const valueConcepts = new Map<string, string>();
  const parentLabels = new Set<string>();
  const concepts: SearchConceptDefinition[] = values.map((value, index) => {
    const id = conceptId(field, index);
    valueConcepts.set(value, id);
    const parent = parentFor(field, value);
    if (parent) parentLabels.add(parent);
    return Object.freeze({
      id,
      label: value,
      aliases: aliasesFor(field, value),
      abbreviations: abbreviationsFor(field, value),
      broader: parent ? Object.freeze([parentConceptId(field, parent)]) : undefined,
    });
  });

  for (const label of parentLabels) {
    concepts.push(Object.freeze({ id: parentConceptId(field, label), label }));
  }

  const records: SearchRecord[] = papers.map((paper, order) => {
    const evidence: SearchEvidence[] = paper[paperField].map((text, valueIndex) => Object.freeze({
      text,
      sourcePath: "app/data.ts",
      fieldPath: `papers[${order}].${paperField}[${valueIndex}]`,
      strength: "explicit" as const,
      conceptIds: Object.freeze([valueConcepts.get(text)!]),
    }));
    return Object.freeze({
      id: `shelf-paper-${order}`,
      class: "Shelf item",
      order,
      title: paper.title,
      href: "/shelf/",
      evidence: Object.freeze(evidence),
    });
  });

  return Object.freeze({
    version: `${SHELF_SEARCH_ONTOLOGY_VERSION}:${field}`,
    classOrder: Object.freeze(["Shelf item"]),
    concepts: Object.freeze(concepts),
    records: Object.freeze(records),
    // Preserve Shelf's existing progressive contains behavior inside each
    // isolated field; other Search implementations default to token prefixes.
    policy: Object.freeze({
      minimumAtomScore: 0.54,
      maximumQueryGraphemes: 120,
      maximumQueryAtoms: 8,
      allowInfixPartial: true,
    }),
  });
}

export function compileShelfSearchIndexes(papers: readonly Paper[]): ShelfIndexes {
  return Object.freeze(Object.fromEntries(SHELF_SEARCH_FIELDS.map((field) => [
    field,
    compileSearchOntology(shelfSearchDefinition(papers, field)),
  ])) as unknown as ShelfIndexes);
}

let cachedPapers: readonly Paper[] | null = null;
let cachedIndexes: Partial<Record<ShelfSearchField, CompiledSearchOntology>> = {};

function indexFor(papers: readonly Paper[], field: ShelfSearchField) {
  if (cachedPapers !== papers) {
    cachedPapers = papers;
    cachedIndexes = {};
  }
  const cached = cachedIndexes[field];
  if (cached) return cached;
  const compiled = compileSearchOntology(shelfSearchDefinition(papers, field));
  cachedIndexes[field] = compiled;
  return compiled;
}

export function filterShelfPapersWithOntology(
  papers: readonly Paper[],
  filters: Readonly<Record<ShelfSearchField, string>>,
) {
  const matchingRecordIds = new Map<ShelfSearchField, ReadonlySet<string>>();
  for (const field of SHELF_SEARCH_FIELDS) {
    const query = filters[field].trim();
    if (!query) continue;
    matchingRecordIds.set(field, new Set(searchOntology(indexFor(papers, field), query).map(({ record }) => record.id)));
  }
  if (!matchingRecordIds.size) return [...papers];
  return papers.filter((_paper, order) => {
    const id = `shelf-paper-${order}`;
    return [...matchingRecordIds.values()].every((recordIds) => recordIds.has(id));
  });
}
