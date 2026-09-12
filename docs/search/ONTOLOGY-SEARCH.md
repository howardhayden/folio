# Ontology-first search contract

Search in hah.dev is a subject-information-architecture feature, not a styled text filter. New search implementations begin by defining the product or service domain as a versioned subject ontology: preferred concepts, evidence-backed aliases and abbreviations, broader and narrower concepts, related concepts, result classes, and source provenance.

That ontology is a maintained part of the product or service IA. Search observations, false positives, new language, and changed subject boundaries should improve the ontology and its evidence mappings rather than accumulate as unstructured string exceptions.

The shared engine in `app/search/ontologySearch.ts` enforces a nonempty ontology and accepts only explicitly mapped text evidence. It does not traverse arbitrary objects or index rendered DOM. Product adapters own their corpus boundaries and map every searchable statement to its source and field.

Fuzzy retrieval follows these defaults:

- Normalize Unicode, presentation quotes and dashes, and diacritics while preserving semantic punctuation such as `C++`, `C#`, `.NET`, and `CI/CD`.
- Prefer exact and progressive matches before fuzzy matches.
- Correct incomplete prefixes as prefixes as well as complete terms, including independently compiled lexical access points in compound values. Compare the adjacent prefix lengths needed to recover insertions and deletions as well as substitutions and transpositions.
- Measure edits by grapheme-aware Damerau–Levenshtein distance.
- Derive the initial edit allowance from term length, then contract it to the safe radius around the nearest different concept in the relevant ontology.
- Treat one accepted correction as a corrected surface before deciding ambiguity. Every concept or record sharing that surface receives the same fanout as the literal prefix; distinct equal-best surfaces fail closed instead of guessing. A common broader concept may safely represent its own narrower family. Keep abbreviations and symbol-bearing typed spans exact without disabling a plain prefix merely because unseen suffix text contains punctuation.
- Once a query atom resolves to a subject concept, ontology relations own result eligibility. Incidental prose cannot bypass that intent.
- Treat hierarchy directionally: a broad query may retrieve narrower classified evidence, while a narrow query does not retrieve evidence tagged only with a broad parent. Related concepts inform IA but do not make a record eligible by themselves.
- Use token-prefix matching by default so `work` does not match `network` and `UX` does not match `LUX`. A product may explicitly retain infix behavior only where its existing interaction contract requires it, as Shelf does per field.
- Preserve deterministic ordering, explicit result-class precedence, source provenance, accessibility, and reduced-motion, reduced-transparency, and forced-colors behavior.

Faceted products compile and query each input against its own ontology and collision universe. Combining active facets remains the product layer's responsibility; the fuzzy engine must not silently introduce cross-facet evidence or relevance ordering.

This fuzzy, ontology-first engine—and the requirement to evolve the product or service subject ontology with it—is the default Search implementation contract for future hah.dev work unless a later product-specific decision explicitly replaces it.
