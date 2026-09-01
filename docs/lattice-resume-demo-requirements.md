# Lattice resume demonstrator requirements

This file records the bounded contract for the Lattice project card and its browser-only demonstrator. It does not restate or redistribute the Relational Systems Register profile.

## Sources

- **U1:** Site-owner brief, 2026-09-01.
- **L1:** `howardhayden/lattice` v0.1.1 README, architecture, requirements, context types, validators, and license scope at commit `d6cc85b275e3f14163a5a547f626832fd21b27b0`.
- **F1:** Existing `hah.dev` resume project-card, progressive-disclosure, resource-link, and modal patterns.

## Atomic requirements and evidence

| ID | Requirement | Source | Evidence |
| --- | --- | --- | --- |
| LAT-UI-001 | Add Lattice to Resume → Projects. | U1 | `ResumeProjects.tsx` project data |
| LAT-UI-002 | Use Bootstrap’s `pen-fill` path and existing project-icon treatment. | U1, F1 | `PenFillIcon` |
| LAT-COPY-001 | Render the supplied first paragraph openly and conceal the remaining three under “Read me.” | U1, F1 | `.project-readme` disclosure; SSR tests |
| LAT-LINK-001 | Link Documentation to `https://github.com/howardhayden/lattice` using existing resource formatting. | U1, F1 | project resource data; SSR tests |
| LAT-INT-001 | Open the interaction in the resume’s established pop-up treatment. | U1, F1 | `.modal.resume-modal.lattice-modal` |
| LAT-INT-002 | Accept no more than 250 user-perceived characters and fail without silent truncation. | U1, L1 | grapheme counter, controlled input, engine guard, boundary tests |
| LAT-INT-003 | Select one official Lattice layer—operative, experiential, or interpretive—using deterministic host heuristics. | U1, L1 | `selectLatticeLayer`; classification tests |
| LAT-SAF-001 | Protected instructions, constraints, quantities, timings, and accessibility language take precedence and remain literal. | L1 | operative precedence patterns; safety tests |
| LAT-SEM-001 | When shaping cadence, preserve every source word and its order; fail closed to the source text if the invariant fails. | L1 | word-inventory gate; semantic tests |
| LAT-SEM-002 | Never claim that arbitrary free text has passed Lattice’s full semantic-contract pipeline. | L1 | bounded-demo copy and implementation note |
| LAT-LIC-001 | Do not embed or redistribute the exclusive 69-rule register profile or fixtures in public client code. | L1 | local host heuristics only |
| LAT-A11Y-001 | Provide a labelled modal, labelled textarea, counter, inline error, live output, Escape close, focus containment, and focus return. | U1, F1 | dialog markup and focus lifecycle |
| LAT-SEC-001 | Render all submitted and output text through React text nodes, never HTML injection. | L1 | component rendering; injection test |

## Scope boundary

The published interaction is a deterministic, short-form portfolio demonstrator. The current Lattice package requires caller-supplied semantic atoms, context, and candidates; it does not infer a complete context or synthesize arbitrary prose from raw text. Accordingly, this demonstrator selects a provisional layer with small host-owned heuristics, reshapes punctuation or line cadence only when its word-order invariant passes, and leaves protected or unverifiable wording unchanged. It neither executes nor represents the exclusive Relational Systems Register profile.
