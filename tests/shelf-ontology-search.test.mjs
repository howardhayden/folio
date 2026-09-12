import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { papers } from "../app/data.ts";
import { filterShelfPapers } from "../app/shelf/shelfLogic.js";
import {
  SHELF_SEARCH_FIELDS,
  compileShelfSearchIndexes,
} from "../app/shelf/shelfSearchOntology.ts";

const blank = () => ({ language: "", publisher: "", author: "", collection: "" });
const titles = (items) => items.map(({ title }) => title);

test("Shelf compiles one collision universe per existing input", () => {
  const indexes = compileShelfSearchIndexes(papers);
  assert.deepEqual(Object.keys(indexes), [...SHELF_SEARCH_FIELDS]);
  for (const field of SHELF_SEARCH_FIELDS) assert.equal(indexes[field].version.endsWith(`:${field}`), true);
});

test("Shelf keeps progressive matching and adds ontology parents, aliases, and diacritic folding", () => {
  const englishCorpus = titles(papers.filter(({ languages }) => languages.some((language) => language.startsWith("English")))).sort();
  for (const query of ["Eng", "Engi", "Engil", "Engils", "Engilsh"]) {
    assert.deepEqual(
      titles(filterShelfPapers(papers, { ...blank(), language: query })).sort(),
      englishCorpus,
      `${query} must retain the collision-safe English autocomplete result`,
    );
  }
  for (const query of ["t", "te", "tec", "tech"]) {
    assert.deepEqual(
      titles(filterShelfPapers(papers, { ...blank(), collection: query })).sort(),
      titles(papers.filter(({ collections }) => collections.join(", ").toLowerCase().includes(query))).sort(),
      `collection search must preserve progressive literal matching for ${query}`,
    );
  }
  assert.deepEqual(
    titles(filterShelfPapers(papers, { ...blank(), language: "Spanish" })).sort(),
    titles(papers.filter(({ languages }) => languages.some((language) => language.startsWith("Spanish")))).sort(),
  );
  assert.deepEqual(titles(filterShelfPapers(papers, { ...blank(), publisher: "Production IG" })), ["Psycho-Pass"]);
  assert.deepEqual(titles(filterShelfPapers(papers, { ...blank(), publisher: "Simn and Schuster" })), ["Grit: The Power of Passion and Perseverance"]);
  assert.ok(titles(filterShelfPapers(papers, { ...blank(), collection: "Resilience" })).includes("Frostpunk 2"));
  assert.ok(titles(filterShelfPapers(papers, { ...blank(), author: "Dzierzykraj" })).includes("Frostpunk 2"));
  assert.deepEqual(titles(filterShelfPapers(papers, { ...blank(), author: "Dzire" })), ["Frostpunk 2"]);
  assert.deepEqual(titles(filterShelfPapers(papers, { ...blank(), author: "Stko" })), ["Frostpunk 2"]);
});

test("Shelf inputs remain isolated and ambiguous author typos fail closed", () => {
  assert.deepEqual(filterShelfPapers(papers, { ...blank(), language: "Wiley" }), []);
  assert.deepEqual(filterShelfPapers(papers, { ...blank(), language: "tehc" }), []);
  assert.ok(filterShelfPapers(papers, { ...blank(), collection: "tehc" }).length > 0);
  assert.deepEqual(filterShelfPapers(papers, { ...blank(), author: "ton" }), []);
  assert.deepEqual(
    titles(filterShelfPapers(papers, { ...blank(), language: "Japanese", collection: "Technology" })).sort(),
    ["Ascendance of a Bookworm", "Psycho-Pass", "The Wind Rises"].sort(),
  );
  assert.deepEqual(
    titles(filterShelfPapers(papers, { ...blank(), language: "engi", collection: "tehc" })).sort(),
    titles(papers.filter(({ languages, collections }) => (
      languages.some((language) => language.startsWith("English"))
      && collections.includes("Technology")
    ))).sort(),
  );
  for (const [field, query] of [
    ["language", "glish"],
    ["publisher", "view"],
    ["author", "zier"],
    ["collection", "nolo"],
  ]) {
    assert.ok(filterShelfPapers(papers, { ...blank(), [field]: query }).length > 0, `${field} retains Shelf's infix behavior`);
  }
});

test("Shelf applies generic progressive correction independently across every field", () => {
  const cases = [
    {
      field: "language",
      query: "simplixf",
      expected: papers.filter(({ languages }) => languages.includes("Simplified Chinese")),
    },
    {
      field: "publisher",
      query: "stdu",
      expected: papers.filter(({ publishers }) => publishers.some((publisher) => publisher.startsWith("Studio "))),
    },
    {
      field: "publisher",
      query: "studxio",
      expected: papers.filter(({ publishers }) => publishers.some((publisher) => publisher.startsWith("Studio "))),
    },
    {
      field: "author",
      query: "jonh",
      expected: papers.filter(({ authors }) => authors.some((author) => author.startsWith("John"))),
    },
    {
      field: "author",
      query: "adma",
      expected: papers.filter(({ authors }) => authors.some((author) => author.startsWith("Adam"))),
    },
    {
      field: "author",
      query: "erci",
      expected: papers.filter(({ authors }) => authors.some((author) => author.startsWith("Eric"))),
    },
    {
      field: "collection",
      query: "tecnol",
      expected: papers.filter(({ collections }) => collections.includes("Technology")),
    },
    {
      field: "collection",
      query: "texhn",
      expected: papers.filter(({ collections }) => collections.includes("Technology")),
    },
  ];
  for (const { field, query, expected } of cases) {
    assert.deepEqual(
      titles(filterShelfPapers(papers, { ...blank(), [field]: query })).sort(),
      titles(expected).sort(),
      `${field}:${query} follows the engine's generic correction policy`,
    );
  }
  assert.deepEqual(filterShelfPapers(papers, { ...blank(), author: "chra" }), [],
    "Charles/Cara is a distinct corrected-surface tie and must fail closed");
});

test("Shelf Search applies the same five-pixel fog to its stable trigger without changing its footprint", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/shelf/ShelfExplorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /aria-expanded=\{open\}[\s\S]*?<span className="signal-fuzz signal-fuzz--nav">Search<\/span>/u);
  assert.match(css, /\.nav-btn#navbarDropdown \.signal-fuzz--nav \{[\s\S]*?display: inline-block;[\s\S]*?transition: filter \.5s ease, opacity \.5s ease/u);
  assert.match(css, /\.nav-btn#navbarDropdown::after \{[\s\S]*?transition: filter \.5s ease, opacity \.5s ease/u);
  assert.match(css, /\.nav-btn#navbarDropdown\[aria-expanded="true"\] \.signal-fuzz--nav,\s*\.nav-btn#navbarDropdown\[aria-expanded="true"\]::after \{[\s\S]*?filter: blur\(5px\);[\s\S]*?opacity: 0/u);
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)[\s\S]*?\.nav-btn#navbarDropdown\[aria-expanded="true"\] \.signal-fuzz--nav,\s*\.nav-btn#navbarDropdown\[aria-expanded="true"\]::after \{[\s\S]*?filter: none;[\s\S]*?opacity: 1/u);
});
