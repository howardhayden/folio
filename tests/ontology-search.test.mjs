import assert from "node:assert/strict";
import test from "node:test";

import {
  compileSearchOntology,
  damerauLevenshtein,
  normalizeSearchText,
  searchOntology,
} from "../app/search/ontologySearch.ts";

const evidence = (text, conceptIds = []) => ({
  text,
  sourcePath: "tests/fixture.json",
  fieldPath: text,
  strength: "explicit",
  conceptIds,
});

test("search normalization preserves semantic programming punctuation and folds presentation variants", () => {
  assert.equal(normalizeSearchText("  C++ / C# — .NET  "), "c++ / c# - .net");
  assert.equal(normalizeSearchText("Dzierżykraj–Stokalski"), "dzierzykraj-stokalski");
  assert.equal(damerauLevenshtein("architect", "archtiect", 2), 1);
  assert.equal(damerauLevenshtein("a", "", 1), 1);
  assert.equal(damerauLevenshtein("", "a", 1), 1);
});

test("ontology compilation rejects non-text evidence, dangling relations, and hierarchy cycles", () => {
  const base = {
    version: "fixture.v1",
    classOrder: ["Projects"],
    concepts: [{ id: "a", label: "Alpha" }],
    records: [{ id: "one", class: "Projects", order: 0, title: "One", href: "/one", evidence: [evidence("Alpha", ["a"])] }],
  };
  assert.throws(() => compileSearchOntology({
    ...base,
    records: [{ ...base.records[0], evidence: [{ ...base.records[0].evidence[0], text: { unsafe: true } }] }],
  }), /must be bounded text/u);
  assert.throws(() => compileSearchOntology({
    ...base,
    concepts: [],
  }), /nonempty subject ontology/u);
  assert.throws(() => compileSearchOntology({
    ...base,
    concepts: [{ id: "a", label: "Alpha", broader: ["missing"] }],
  }), /dangling broader relation/u);
  assert.throws(() => compileSearchOntology({
    ...base,
    concepts: [
      { id: "a", label: "Alpha", broader: ["b"] },
      { id: "b", label: "Beta", broader: ["a"] },
    ],
  }), /hierarchy contains a cycle/u);
});

test("fuzzy tolerance contracts around collisions and remains generous for isolated terms", () => {
  const definition = {
    version: "fixture.v1",
    classOrder: ["Projects"],
    concepts: [
      { id: "tom", label: "Tom" },
      { id: "tow", label: "Tow" },
      { id: "encyclopedia", label: "Encyclopedia" },
    ],
    records: [
      { id: "tom", class: "Projects", order: 0, title: "Tom", href: "/tom", evidence: [evidence("Tom", ["tom"])] },
      { id: "tow", class: "Projects", order: 1, title: "Tow", href: "/tow", evidence: [evidence("Tow", ["tow"])] },
      { id: "encyclopedia", class: "Projects", order: 2, title: "Encyclopedia", href: "/encyclopedia", evidence: [evidence("Encyclopedia", ["encyclopedia"])] },
    ],
  };
  const index = compileSearchOntology(definition);
  assert.deepEqual(searchOntology(index, "ton"), [], "an ambiguous one-edit typo does not choose Tom or Tow");
  assert.deepEqual(searchOntology(index, "encyclopdia").map(({ record }) => record.id), ["encyclopedia"]);
});

test("fuzzy prefixes remain collision-safe and do not fall through to raw evidence", () => {
  const index = compileSearchOntology({
    version: "fixture.v1",
    classOrder: ["Projects"],
    concepts: [
      { id: "alpha", label: "Alpha" },
      { id: "alpine", label: "Alpine" },
      { id: "information-architecture", label: "Information Architecture" },
    ],
    records: [
      { id: "alpha", class: "Projects", order: 0, title: "Alpha", href: "/alpha", evidence: [evidence("Alpha", ["alpha"])] },
      { id: "alpine", class: "Projects", order: 1, title: "Alpine", href: "/alpine", evidence: [evidence("Alpine", ["alpine"])] },
      { id: "ia", class: "Projects", order: 2, title: "IA", href: "/ia", evidence: [evidence("Information Architecture", ["information-architecture"])] },
    ],
  });
  assert.deepEqual(searchOntology(index, "al").map(({ record }) => record.id), ["alpha", "alpine"]);
  assert.deepEqual(searchOntology(index, "alpa"), [], "an unrelated fuzzy-prefix tie fails closed");
  assert.deepEqual(searchOntology(index, "infrmation architecture").map(({ record }) => record.id), ["ia"]);
});

test("progressive fuzzy correction covers every edit operation and fans out only across a shared surface", () => {
  const concepts = [
    { id: "john-parker", label: "John W. Parker and Son" },
    { id: "johnnemann", label: "Johnnemann Nordhagen" },
    { id: "studio-ghibli", label: "Studio Ghibli" },
    { id: "studio-madhouse", label: "Studio Madhouse" },
    { id: "adam-robinson", label: "Adam Robinson-Yu" },
    { id: "adamgryu", label: "Adamgryu" },
    { id: "technology", label: "Technology Roadmap" },
    { id: "charles", label: "Charles T. Munger" },
    { id: "cara", label: "Cara Ellison" },
    { id: "alpha", label: "Alpha" },
    { id: "alpine", label: "Alpine" },
    { id: "abcdef", label: "Abcdef" },
  ];
  const index = compileSearchOntology({
    version: "fixture.progressive.v1",
    classOrder: ["People"],
    concepts,
    records: concepts.map(({ id, label }, order) => ({
      id,
      class: "People",
      order,
      title: label,
      href: `/${id}`,
      evidence: [evidence(label, [id])],
    })),
  });
  const ids = (query) => searchOntology(index, query).map(({ record }) => record.id);

  assert.deepEqual(ids("jonh"), ["john-parker", "johnnemann"],
    "a transposed plain prefix fans out even when punctuation exists only in an unseen suffix");
  assert.deepEqual(ids("stdu"), ["studio-ghibli", "studio-madhouse"]);
  assert.deepEqual(ids("adma"), ["adam-robinson", "adamgryu"]);
  assert.deepEqual(ids("texhn"), ["technology"], "substitution compares the same-length frontier");
  assert.deepEqual(ids("tehcn"), ["technology"], "transposition compares the same-length frontier");
  assert.deepEqual(ids("techhn"), ["technology"], "an inserted query character compares the shorter frontier");
  assert.deepEqual(ids("tecnol"), ["technology"], "a missing query character compares the longer frontier");
  assert.deepEqual(ids("chra"), [], "distinct equal-best `char` and `cara` surfaces fail closed");
  assert.deepEqual(ids("alpa"), [], "distinct equal-best `alpha` and `alpi` surfaces fail closed");
  assert.deepEqual(ids("axbc"), [], "a typo cannot infer a corrected prefix shorter than four graphemes");
  assert.deepEqual(ids("john+"), [], "punctuation in the typed span remains strict");
});

test("literal progressive intent takes precedence over a plausible fuzzy correction", () => {
  const index = compileSearchOntology({
    version: "fixture.literal-precedence.v1",
    classOrder: ["Projects"],
    concepts: [
      { id: "literal", label: "Jonh Archive" },
      { id: "correctable", label: "John Handbook" },
    ],
    records: [
      { id: "literal", class: "Projects", order: 0, title: "Jonh", href: "/jonh", evidence: [evidence("Jonh Archive", ["literal"])] },
      { id: "correctable", class: "Projects", order: 1, title: "John", href: "/john", evidence: [evidence("John Handbook", ["correctable"])] },
    ],
  });

  assert.deepEqual(searchOntology(index, "jonh").map(({ record }) => record.id), ["literal"]);
});

test("untagged evidence uses the same corrected-surface frontier as ontology concepts", () => {
  const index = compileSearchOntology({
    version: "fixture.evidence-progressive.v1",
    classOrder: ["People"],
    concepts: [{ id: "taxonomy", label: "Unrelated Taxonomy" }],
    records: [
      { id: "john-parker", class: "People", order: 0, title: "John Parker", href: "/john", evidence: [evidence("John W. Parker and Son")] },
      { id: "johnnemann", class: "People", order: 1, title: "Johnnemann", href: "/johnnemann", evidence: [evidence("Johnnemann Nordhagen")] },
      { id: "alpha", class: "People", order: 2, title: "Alpha", href: "/alpha", evidence: [evidence("Alpha")] },
      { id: "alpine", class: "People", order: 3, title: "Alpine", href: "/alpine", evidence: [evidence("Alpine")] },
      { id: "technology", class: "People", order: 4, title: "Technology", href: "/technology", evidence: [evidence("Technology Roadmap")] },
    ],
  });

  assert.deepEqual(searchOntology(index, "jonh").map(({ record }) => record.id), ["john-parker", "johnnemann"]);
  assert.deepEqual(searchOntology(index, "techhn").map(({ record }) => record.id), ["technology"]);
  assert.deepEqual(searchOntology(index, "tecnol").map(({ record }) => record.id), ["technology"]);
  assert.deepEqual(searchOntology(index, "alpa"), []);
});

test("impossible fuzzy lengths are rejected before collision-universe scans", () => {
  const compiled = compileSearchOntology({
    version: "fixture.v1",
    classOrder: ["Projects"],
    concepts: [{ id: "encyclopedia", label: "Encyclopedia" }],
    records: [
      {
        id: "encyclopedia",
        class: "Projects",
        order: 0,
        title: "Encyclopedia",
        href: "/encyclopedia",
        evidence: [evidence("Encyclopedia", ["encyclopedia"])],
      },
    ],
  });
  const longLexeme = compiled.evidenceLexemes.find(({ normalized }) => normalized === "encyclopedia");
  assert.ok(longLexeme);

  let collisionKeyReads = 0;
  const observedLexeme = new Proxy(longLexeme, {
    get(target, property, receiver) {
      if (property === "normalized") collisionKeyReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  const largeImpossibleUniverse = Object.freeze(Array.from({ length: 4_096 }, () => observedLexeme));
  const instrumented = Object.freeze({
    ...compiled,
    evidenceLexemes: largeImpossibleUniverse,
  });

  assert.deepEqual(searchOntology(instrumented, "x"), []);
  assert.equal(
    collisionKeyReads,
    0,
    "a one-grapheme query cannot enter any long lexeme's O(n) collision-budget scan",
  );
});

test("ontology relations retrieve narrower evidence while class order remains a hard boundary", () => {
  const index = compileSearchOntology({
    version: "fixture.v1",
    classOrder: ["Projects", "Education"],
    concepts: [
      { id: "language", label: "Language" },
      { id: "typescript", label: "TypeScript", broader: ["language"] },
    ],
    records: [
      { id: "project", class: "Projects", order: 0, title: "Project", href: "/project", evidence: [evidence("TypeScript", ["typescript"])] },
      { id: "education", class: "Education", order: 0, title: "Education", href: "/education", evidence: [evidence("Language", ["language"])] },
    ],
  });
  const hits = searchOntology(index, "language");
  assert.deepEqual(hits.map(({ record }) => record.id), ["project", "education"]);
  assert.equal(hits[0].matches[0].sourcePath, "tests/fixture.json");
  assert.deepEqual(searchOntology(index, "TypeScript").map(({ record }) => record.id), ["project"],
    "a narrow intent does not retrieve evidence tagged only with its broader parent");
});

test("resolved ontology intent owns eligibility over incidental prose", () => {
  const index = compileSearchOntology({
    version: "fixture.v1",
    classOrder: ["Projects"],
    concepts: [{ id: "work-experience", label: "Work Experience", aliases: ["Work"] }],
    records: [
      { id: "product", class: "Projects", order: 0, title: "Product", href: "/product", evidence: [evidence("Work under pressure")] },
      { id: "employment", class: "Projects", order: 1, title: "Employment", href: "/employment", evidence: [evidence("Employment", ["work-experience"])] },
    ],
  });
  assert.deepEqual(searchOntology(index, "work").map(({ record }) => record.id), ["employment"]);
});

test("temporal operators use typed intervals instead of coincidental prose", () => {
  const index = compileSearchOntology({
    version: "fixture.v1",
    classOrder: ["Projects"],
    concepts: [{ id: "publishing", label: "Publishing" }],
    records: [
      { id: "current-prose", class: "Projects", order: 0, title: "Current prose", href: "/current", evidence: [evidence("Current affairs", ["publishing"])] },
      { id: "year-prose", class: "Projects", order: 1, title: "Year prose", href: "/year", evidence: [evidence("Published in 2026", ["publishing"])] },
      { id: "ongoing", class: "Projects", order: 2, title: "Ongoing", href: "/ongoing", interval: { start: "2025", end: null, ongoing: true }, evidence: [evidence("Publishing", ["publishing"])] },
    ],
  });
  assert.deepEqual(searchOntology(index, "current").map(({ record }) => record.id), ["ongoing"]);
  assert.deepEqual(searchOntology(index, "2026").map(({ record }) => record.id), ["ongoing"]);
});
