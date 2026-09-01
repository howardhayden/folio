# Text-to-Lattice resume demonstrator requirements

This file records the public contract for the Lattice project card and its browser-only **Text-to-Lattice** demonstrator. It does not restate or redistribute the Relational Systems Register profile.

## Sources

- **U1:** Site-owner brief, 2026-09-01: add the Lattice project, supplied summary, icon, documentation link, pop-up interaction, and initial 250-character limit.
- **U2:** Site-owner correction, 2026-09-01: name the tool Text-to-Lattice, raise the limit to 700 words, require material rewriting unless the input already clears the bounded checks, and select content layers below the whole-document level without defaulting to experiential.
- **U3:** Site-owner correction, 2026-09-01: accept realistic dialogue-heavy narrative input, perform material work instead of discarding every local candidate, move beyond a fixed experiential treatment, and represent processing time only when real work requires it.
- **L1:** `howardhayden/lattice` v0.1.1 README, architecture, requirements, context types, validators, and license scope at commit `d6cc85b275e3f14163a5a547f626832fd21b27b0`.
- **F1:** Existing `hah.dev` resume project-card, progressive-disclosure, resource-link, and modal patterns.

## Atomic requirements and evidence

| ID | Requirement | Source | Evidence |
| --- | --- | --- | --- |
| LAT-UI-001 | Add Lattice to Resume → Projects. | U1 | `ResumeProjects.tsx` project data; SSR tests |
| LAT-UI-002 | Use Bootstrap’s `pen-fill` path and the existing project-icon treatment. | U1, F1 | `PenFillIcon`; SSR tests |
| LAT-COPY-001 | Render the supplied first paragraph openly and conceal the remaining three under “Read me.” | U1, F1 | `.project-readme` disclosure; SSR tests |
| LAT-LINK-001 | Link Documentation to `https://github.com/howardhayden/lattice` using the existing resource formatting. | U1, F1 | project resource data; SSR tests |
| TTL-NAME-001 | Name the interactive tool exactly “Text-to-Lattice”; do not present a competing tool name or register subtitle inside the dialog. | U2 | dialog heading; source-contract tests |
| TTL-UI-001 | Open Text-to-Lattice in the resume’s established labelled, focus-managed pop-up treatment. | U1, U2, F1 | `.modal.resume-modal.lattice-modal`; dialog tests |
| TTL-LIM-001 | Accept between 1 and 700 Unicode-aware words, inclusively, and reject 701 words without truncation. | U2 | shared word counter and engine guard; 700/701 tests |
| TTL-LIM-002 | Reject a payload above 50,000 input code units before analysis, independently of the user-facing word limit. | L1 | engine safety guard; ceiling test |
| TTL-LAY-001 | Select the operative, experiential, or interpretive content layer for each sentence or bounded clause; report mixed-layer input when applicable. | U2, L1 | segment analysis and layer metadata; mixed-layer test |
| TTL-LAY-002 | Do not use experiential as a generic fallback. Leave insufficiently evidenced content unresolved, or inherit a single evidenced layer only within its local paragraph. | U2, L1 | scoring thresholds and local inheritance; classification tests |
| TTL-NAR-001 | Detect narrative as a document kind independently of operative, experiential, and interpretive passage layers; use actor-action and dialogue-attribution evidence without forcing every passage into the experiential layer. | U3 | narrative mode and quote-neutral local scoring; narrative tests |
| TTL-NAR-002 | Preserve every protected dialogue span byte-for-byte and in order. Dialogue may inform narrative context, but quoted commands, modality, causal language, and general terms must not be treated as host instructions or document-wide defects. | U3, L1 | typed protected spans, neutral classification view, ordered marker gate; quotation tests |
| TTL-XFM-001 | A successful transformation of nonconformant text must change its normalized word sequence; capitalization, punctuation, or paragraph spacing alone is insufficient. | U2 | candidate materiality gate; interpretive and experiential tests |
| TTL-XFM-002 | Return the source text unchanged only with the explicit `already-bounded-conformant` outcome after the bounded checks find no actionable issue. | U2, L1 | result state; fixed-point and known-good tests |
| TTL-XFM-003 | If zero material candidates clear their preservation gates, return `no-safe-candidate` and no transformed text; never relabel the source as a successful conversion. | U2, U3, L1 | result state and findings; vague-input test |
| TTL-XFM-004 | When one or more local candidates clear their gates, return the transformed document even if untouched passages retain review notes; distinguish this partial bounded candidate from complete bounded clearance. | U3, L1 | `bounded-candidate-with-review`; partial-candidate test |
| TTL-SEM-001 | Preserve explicit actors, actions, objects, polarity, modality, uncertainty, quantities, units, conditions, exceptions, timing, causality, consequences, and recovery relationships. Invent none. | L1 | semantic sentinels and rule-local guards; preservation tests |
| TTL-PRO-001 | Keep direct safety, medical, contact, timing, recovery, and accessibility instructions literal in their local protected spans, including within mixed input. | L1 | protected-segment precedence; exact-substring tests |
| TTL-DET-001 | Produce deterministic results. A transformed result with complete bounded clearance must become an unchanged positive fixed point. A partial bounded candidate must exhaust the available material rules; if review notes remain when it is resubmitted, return no text rather than falsely relabeling it as fully aligned. | U2, U3, L1 | deterministic ranking; full-clearance and partial-candidate exhaustion tests |
| TTL-LIC-001 | Do not embed or redistribute the exclusive register profile, its rule inventory, or its fixtures in public client code. | L1 | independently authored bounded host rules; source review |
| TTL-A11Y-001 | Provide a labelled dialog and textarea, shared word counter, inline error, short live status, Escape close, focus containment, and focus return. Do not mark the potentially 700-word result as one atomic live announcement. | U2, F1 | dialog markup and focus lifecycle; source-contract tests |
| TTL-UX-002 | Report actual passages reviewed, revised, retained, and protected. Keep processing immediate while the synchronous engine finishes within one frame; do not simulate delay, stages, or progress. | U3, F1 | result coverage metadata and live status; 700-word regression test |
| TTL-SEC-001 | Treat submitted text as inert data and render source, findings, and output through React text nodes, never HTML injection. | L1 | component rendering; injection tests |

## Word-count policy

The counter and engine use the same `Intl.Segmenter("en", { granularity: "word" })` policy and count only `isWordLike` segments, with a Unicode word-pattern fallback for runtimes without `Intl.Segmenter`. Contractions such as “can’t” normally count as one word; Unicode segmentation may count a hyphenated compound as multiple word-like segments. The displayed count is therefore the engine’s count, not a separate approximation.

The 50,000-code-unit ceiling is a defensive implementation limit, not an additional authoring allowance: input must clear both it and the 700-word limit.

## Outcome and preservation boundary

Text-to-Lattice is an independently authored, deterministic public host over a bounded set of transparent transformations. Its order is:

1. validate limits;
2. segment paragraphs, sentences, clauses, and protected spans;
3. score a content layer locally;
4. generate only guarded candidates;
5. reject candidates that fail materiality or semantic-preservation checks;
6. rank the survivors deterministically; and
7. report `transformed`, `already-bounded-conformant`, or `no-safe-candidate`.

The full Lattice pipeline expects caller-supplied semantic atoms, context, and candidates. Text-to-Lattice cannot infer that full contract from arbitrary prose and does not certify text as “perfectly Latticed.” Its unchanged outcome means only that the text is already aligned with this host’s bounded checks. Its transformed outcome likewise means that each reported revision cleared its local and document preservation gates, not that every untouched passage passed the complete private profile.

Unchanged output is admitted only by a narrow positive check on every passage: protected operative copy must remain direct; experiential copy must use compact, concrete material or relational evidence without unresolved ornament; and interpretive copy must expose an active institutional and causal relationship. Local inheritance, unsupported structure, or an unresolved finding prevents the unchanged outcome. It does not suppress a separate material revision that cleared its own preservation gates; those results are returned with review notes and explicit coverage.

## Supersession history

| Earlier requirement | Status | Replaced by | Reason |
| --- | --- | --- | --- |
| LAT-INT-002: maximum 250 user-perceived characters | Superseded by U2 | TTL-LIM-001, TTL-LIM-002 | The owner raised the authoring limit to 700 words; a separate defensive ceiling remains. |
| LAT-INT-003: select one layer for the entire input | Superseded by U2 | TTL-LAY-001, TTL-LAY-002 | Mixed inputs require sentence- or clause-level selection, and experiential is not a fallback. |
| LAT-SEM-001: preserve every word and its order while changing cadence | Superseded by U2 | TTL-XFM-001–003, TTL-SEM-001 | The tool must materially rewrite when safe; punctuation-only or paragraph-only changes do not satisfy the interaction. |
| Global all-findings success veto in the initial U2 implementation | Superseded by U3 | TTL-XFM-003, TTL-XFM-004 | A concern in one untouched passage must not erase safe, material revisions elsewhere. |
| Broad fixed-point language covering partial candidates | Refined by U3 | TTL-DET-001, TTL-XFM-004 | A partial candidate must exhaust safe revisions without being relabeled as fully aligned while review notes remain. |
