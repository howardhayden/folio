---
title: Lattice system skill map
revision: 2026-09-11
authority: docs/text-to-lattice/LATTICE-DOCUMENTATION-ATLAS.json
generator: scripts/docs/build-text-to-lattice-documentation.mjs
---

<!-- Generated file. Edit the authoritative JSON register, then run the builder. -->

# Lattice system skill map

> **System evidence, never human proficiency.** This map adapts NN/g's competency-mapping form to an evidence inventory for the upstream Lattice engine at revision d6cc85b. It never rates a person, team member, or human proficiency. A score records the strongest evidence class for a system capability, not importance or artistic quality.

[Open the interactive HTML edition](https://hah.dev/documentation/text-to-lattice/lattice-skill-map.html) · [Download complete Markdown](https://hah.dev/documentation/text-to-lattice/LATTICE-SKILL-MAP.md) · [Download the machine-readable register](https://hah.dev/documentation/text-to-lattice/documentation-atlas.json) · [Inspect the artifact manifest](https://hah.dev/documentation/text-to-lattice/artifact-manifest.json)

## Authority and claim boundary

This register describes the Lattice method at an architectural level and the bounded Text to Lattice implementation evidenced in this repository. It does not redistribute the exclusive register profile, certify universal conformance, or convert source tests into deployed proof.

Stable identifiers persist. A claim changes here with cited evidence; a rendered filter, expansion, or downloaded view never changes authoritative state.

Markdown and HTML are deterministic projections of this register. Filtered browser exports are nonauthoritative reading views.

## Evidence scale

| Score | Status | Meaning |
| ---: | --- | --- |
| 0 | Not claimed | The capability is outside the authorized product boundary or lacks a supported claim. |
| 1 | Defined | A bounded requirement and intended evidence path exist. |
| 2 | Implemented | Repository implementation exists; verification or lifecycle evidence remains incomplete. |
| 3 | Internally verified | Maintainer-authored repository tests verify ordinary and boundary behavior. |
| 4 | Adversarially verified | Self-authored adversarial repository evidence challenges realistic failure and tampering modes. |
| 5 | Externally validated | Independent, production, longitudinal, or representative user evidence supports the claim across contexts. |

Score five requires independent, production, longitudinal, or representative user evidence. No capability receives five at this revision.

## Capability shape

| Capability | Group | Evidence score | Evidence class | Open boundary |
| --- | --- | ---: | --- | --- |
| LAT-SK-01 · Semantic and relational modeling | meaning | 4/5 | Adversarially verified | Typed contracts make declared meaning testable but do not prove source facts or interpret arbitrary prose. |
| LAT-SK-02 · Context and audience modeling | context | 4/5 | Adversarially verified | Correctness still depends on the caller supplying adequate and truthful context; English-oriented resources limit locale scope. |
| LAT-SK-03 · Layered content architecture | context | 4/5 | Adversarially verified | The engine evaluates supplied structured candidates; it does not generate novel literary prose or infer a layer from free-form text. |
| LAT-SK-04 · Register and constraint architecture | policy | 4/5 | Adversarially verified | A structurally valid profile is not proof of artistic quality; the bundled RSR remains separately licensed and is not inventoried here. |
| LAT-SK-05 · Deterministic and bounded engineering | execution | 4/5 | Adversarially verified | Determinism holds for canonical requests and pinned engine/profile versions; hosts and external candidate producers need their own controls. |
| LAT-SK-06 · Core security and trust boundary | security | 4/5 | Adversarially verified | Hosts still own parsing duplicate-key rejection, output escaping, candidate trust, storage permission, network behavior, and UI security. |
| LAT-SK-07 · Accessibility equivalence | accessibility | 3/5 | Internally verified | Structural channel independence does not replace testing with disabled users, assistive technologies, or the host interface. |
| LAT-SK-08 · Evidence and provenance | evidence | 4/5 | Adversarially verified | The receipt is self-consistent and unauthenticated; hashes do not establish truth, authorship, or historical authenticity. |
| LAT-SK-09 · Adversarial verification | assurance | 4/5 | Adversarially verified | The suite is self-authored repository evidence, not independent security review, formal proof, or production observation. |
| LAT-SK-10 · Lifecycle and host integration | lifecycle | 3/5 | Internally verified | No score five is assigned: independent integration, production, longitudinal maintenance, and representative user evidence remain external. |

## Capability register

<details id="lat-sk-01">
<summary><strong>LAT-SK-01</strong> · Semantic and relational modeling — 4/5 Adversarially verified</summary>

Models independently identified atoms, protected frame fields, delivery obligations, terminology, prohibited claims, and before, after, requires, causes, and contradicts relations.

- **Evidence:** The semantic core rejects unresolved conditions, invalid relation targets, contradictions, ordering cycles, and weakened protected meaning; adversarial fixtures challenge polarity, modality, quantity, units, uncertainty, order, and recovery.
- **Open boundary:** Typed contracts make declared meaning testable but do not prove source facts or interpret arbitrary prose.
- **Sources:** SRC-LAT-SEMANTIC, SRC-LAT-REQ, SRC-LAT-ADVERSARIAL

</details>

<details id="lat-sk-02">
<summary><strong>LAT-SK-02</strong> · Context and audience modeling — 4/5 Adversarially verified</summary>

Requires explicit domain, surface, mode, stakes, safety class, locale, audience, focalizer, channel, scene, and bounded execution context.

- **Evidence:** Context validation rejects missing or unsupported high-priority values, bounds tags and limits, and never consults ambient identity, time, locale, network, or previous runs.
- **Open boundary:** Correctness still depends on the caller supplying adequate and truthful context; English-oriented resources limit locale scope.
- **Sources:** SRC-LAT-CONTEXT, SRC-LAT-ARCH, SRC-LAT-ADVERSARIAL

</details>

<details id="lat-sk-03">
<summary><strong>LAT-SK-03</strong> · Layered content architecture — 4/5 Adversarially verified</summary>

Keeps operative, experiential, and interpretive content obligations separate while allowing multiple representations of the same atoms.

- **Evidence:** Output normalization, required-atom planning, cross-output checks, and adversarial layer-contradiction cases enforce the distinction.
- **Open boundary:** The engine evaluates supplied structured candidates; it does not generate novel literary prose or infer a layer from free-form text.
- **Sources:** SRC-LAT-README, SRC-LAT-CONTEXT, SRC-LAT-ENGINE, SRC-LAT-ADVERSARIAL

</details>

<details id="lat-sk-04">
<summary><strong>LAT-SK-04</strong> · Register and constraint architecture — 4/5 Adversarially verified</summary>

Compiles versioned declarative profiles with bounded predicates, known validators, dependencies, conflicts, priorities, enforcement, and protected engine namespaces.

- **Evidence:** Compilation rejects unknown fields, executable or unknown validators, cycles, undeclared conflicts, same-tier hard conflicts, protected priorities, and unresolved dependencies.
- **Open boundary:** A structurally valid profile is not proof of artistic quality; the bundled RSR remains separately licensed and is not inventoried here.
- **Sources:** SRC-LAT-PROFILE, SRC-LAT-ARCH, SRC-LAT-ADVERSARIAL

</details>

<details id="lat-sk-05">
<summary><strong>LAT-SK-05</strong> · Deterministic and bounded engineering — 4/5 Adversarially verified</summary>

Normalizes bounded plain data, freezes compiled structures, ranks lexicographically, and excludes time, filesystem order, platform locale, network state, and ambient randomness from realization.

- **Evidence:** Canonical digests, stable ordering, explicit execution limits, candidate-order invariance, and repeated adversarial requests demonstrate byte-identical derivation within the reviewed revision.
- **Open boundary:** Determinism holds for canonical requests and pinned engine/profile versions; hosts and external candidate producers need their own controls.
- **Sources:** SRC-LAT-ARCH, SRC-LAT-ENGINE, SRC-LAT-ADVERSARIAL

</details>

<details id="lat-sk-06">
<summary><strong>LAT-SK-06</strong> · Core security and trust boundary — 4/5 Adversarially verified</summary>

Accepts bounded nonexecutable data, prevents profiles from rewriting semantic slots or running arbitrary code, rejects prohibited structures, and performs no runtime network, telemetry, or hidden persistence.

- **Evidence:** Plain-data validation, restricted predicate syntax, known validator registration, protected priorities, fail-closed errors, and adversarial malformed-input cases exercise the core boundary.
- **Open boundary:** Hosts still own parsing duplicate-key rejection, output escaping, candidate trust, storage permission, network behavior, and UI security.
- **Sources:** SRC-LAT-ARCH, SRC-LAT-PROFILE, SRC-LAT-ENGINE, SRC-LAT-ADVERSARIAL

</details>

<details id="lat-sk-07">
<summary><strong>LAT-SK-07</strong> · Accessibility equivalence — 3/5 Internally verified</summary>

Models accessibility-equivalent output as a representation of the same relevant atoms and suppresses imagery, color, sound, spatial, timing-perception, or implication dependencies where unavailable.

- **Evidence:** Context protection, output normalization, atom delivery, hard gates, and cross-output parity are implemented and covered by maintainer-authored tests.
- **Open boundary:** Structural channel independence does not replace testing with disabled users, assistive technologies, or the host interface.
- **Sources:** SRC-LAT-CONTEXT, SRC-LAT-ENGINE, SRC-LAT-ARCH, SRC-LAT-REQ

</details>

<details id="lat-sk-08">
<summary><strong>LAT-SK-08</strong> · Evidence and provenance — 4/5 Adversarially verified</summary>

Records canonical inputs, versioned dependencies, candidate decisions, atom coverage, rule dispositions, findings, output digests, trust scope, and a reproducible derivation digest.

- **Evidence:** Receipt and result verifiers enforce exact schemas, referential consistency, aggregate conformance, output binding, and tamper detection in adversarial fixtures.
- **Open boundary:** The receipt is self-consistent and unauthenticated; hashes do not establish truth, authorship, or historical authenticity.
- **Sources:** SRC-LAT-ENGINE, SRC-LAT-README, SRC-LAT-ADVERSARIAL

</details>

<details id="lat-sk-09">
<summary><strong>LAT-SK-09</strong> · Adversarial verification — 4/5 Adversarially verified</summary>

Challenges realistic contract, profile, candidate, ordering, accessibility, tampering, execution-bound, locale, and trust-scope failures rather than counting happy paths alone.

- **Evidence:** The reviewed adversarial suite exercises candidate exhaustion, protected meaning, conflicts, malformed records, candidate-order independence, receipt tampering, and bounded failure behavior.
- **Open boundary:** The suite is self-authored repository evidence, not independent security review, formal proof, or production observation.
- **Sources:** SRC-LAT-ADVERSARIAL, SRC-LAT-REQ

</details>

<details id="lat-sk-10">
<summary><strong>LAT-SK-10</strong> · Lifecycle and host integration — 3/5 Internally verified</summary>

Uses stable versions, schemas, identifiers, profile digests, typed failures, verification functions, CLI boundaries, and explicit host duties to make integration and supersession inspectable.

- **Evidence:** Architecture and requirements define extension, failure, verification, and host contracts; the reviewed engine exposes structured results and verification rather than presentation-side assertions.
- **Open boundary:** No score five is assigned: independent integration, production, longitudinal maintenance, and representative user evidence remain external.
- **Sources:** SRC-LAT-ARCH, SRC-LAT-REQ, SRC-LAT-ENGINE

</details>

## Interpretation rules

- The shape belongs to the upstream Lattice engine at the reviewed revision, not to the hah.dev wrapper.
- Score records evidence maturity, not feature importance, effort, market value, or aesthetic quality.
- One strong axis cannot compensate for a hard failure on another axis.
- Score four is self-authored adversarial repository evidence. It is deliberately below external validation.
- A score moves only when new evidence changes the strongest supported class.

## Source register

- **SRC-REQUIREMENTS — Text to Lattice public requirements:** `docs/lattice-resume-demo-requirements.md`
- **SRC-DEMO — Bounded pipeline coordinator:** `app/resume/latticeDemo.js`
- **SRC-INPUT — Input and clarification policy:** `app/resume/lattice/inputPolicy.js`
- **SRC-SEGMENTS — Lossless segmentation:** `app/resume/lattice/segments.js`
- **SRC-PROTECTED — Protected-span handling:** `app/resume/lattice/protectedSpans.js`
- **SRC-PROMPTS — Closed prompts and schemas:** `app/resume/lattice/promptContract.js`
- **SRC-VALIDATORS — Deterministic semantic validators:** `app/resume/lattice/validators.js`
- **SRC-LOCAL-MODEL — Local model adapter:** `app/resume/lattice/localModel.js`
- **SRC-MODEL-CONTRACT — Pinned model contract:** `app/resume/lattice/modelContract.js`
- **SRC-MODEL-WORKER — Isolated model worker:** `app/resume/lattice/latticeWebllm.worker.ts`
- **SRC-ASSET-POLICY — Model-asset request policy:** `app/resume/lattice/assetRequestPolicy.js`
- **SRC-ATTESTATION — Cross-origin attestation protocol:** `app/resume/lattice/attestation.js`
- **SRC-USAGE-LEASE — Browser lease client:** `app/resume/lattice/usageLease.js`
- **SRC-USAGE-POLICY — Published usage and capacity policy:** `app/resume/lattice/usagePolicy.js`
- **SRC-OUTPUT — Output protection controls:** `app/resume/lattice/outputProtection.js`
- **SRC-LEASE-WORKER — Lease Worker request coordinator:** `workers/text-to-lattice-lease/worker.js`
- **SRC-DEMO-PROFILE — Bounded Cloudflare demonstration profile:** `workers/text-to-lattice-lease/demonstrationProfile.js`
- **SRC-USAGE-STORAGE — Global usage authority:** `workers/text-to-lattice-lease/usageStorage.js`
- **SRC-FRAME — Dedicated verification bridge:** `workers/text-to-lattice-attestation-frame/public/turnstile/bridge.js`
- **SRC-RESPONSE-POLICY — Résumé response-policy Worker:** `workers/text-to-lattice-response-policy/worker.js`
- **SRC-SECRET-BOOTSTRAP — Fail-closed secret bootstrap:** `scripts/bootstrap-text-to-lattice-secrets.mjs`
- **SRC-ROUTE-INVENTORY — Authenticated Worker route inventory verifier:** `scripts/verify-text-to-lattice-route-inventory.mjs`
- **SRC-TEST-ENGINE — Engine executable contracts:** `tests/lattice-demo.test.mjs`
- **SRC-TEST-SECURITY — Security executable contracts:** `tests/lattice-security.test.mjs`
- **SRC-TEST-ISOLATE — Isolate hardening executable contracts:** `tests/lattice-isolate-hardening.test.mjs`
- **SRC-TEST-CAPACITY — Protocol capacity executable contracts:** `tests/lattice-protocol-capacity.test.mjs`
- **SRC-TEST-A11Y — Modal accessibility source contracts:** `tests/lattice-modal-accessibility.test.mjs`
- **SRC-PROJECTS — Portfolio project and ecosystem register:** `app/resume/projects.js`
- **SRC-RELEASE-REGISTER — Machine-enforced Text to Lattice release register:** `docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json`
- **SRC-RELEASE-QUALIFICATION — Text to Lattice release qualification:** `docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md`
- **SRC-LLAMA-LICENSE — Canonical Llama 3.2 Community License:** [Reviewed source](https://developer.meta.com/ai/llama3_2/license/)
- **SRC-LLAMA-AUP — Canonical Llama 3.2 Acceptable Use Policy:** [Reviewed source](https://developer.meta.com/ai/llama3_2/use-policy/)
- **SRC-LLAMA-EVAL — Non-operational Llama-use evaluation cases:** `docs/text-to-lattice/LLAMA-USE-EVALUATION-CASES.json`
- **SRC-WASM-PR — Upstream current-WASM rebuild record:** [Reviewed source](https://github.com/mlc-ai/binary-mlc-llm-libs/pull/158)
- **SRC-LAT-README — Lattice README at the reviewed revision:** [Reviewed source](https://github.com/howardhayden/lattice/blob/d6cc85b275e3f14163a5a547f626832fd21b27b0/README.md)
- **SRC-LAT-ARCH — Lattice architecture at the reviewed revision:** [Reviewed source](https://github.com/howardhayden/lattice/blob/d6cc85b275e3f14163a5a547f626832fd21b27b0/docs/architecture.md)
- **SRC-LAT-REQ — Lattice requirements at the reviewed revision:** [Reviewed source](https://github.com/howardhayden/lattice/blob/d6cc85b275e3f14163a5a547f626832fd21b27b0/docs/requirements.md)
- **SRC-LAT-SEMANTIC — Lattice semantic core at the reviewed revision:** [Reviewed source](https://github.com/howardhayden/lattice/blob/d6cc85b275e3f14163a5a547f626832fd21b27b0/src/semantic.ts)
- **SRC-LAT-CONTEXT — Lattice context core at the reviewed revision:** [Reviewed source](https://github.com/howardhayden/lattice/blob/d6cc85b275e3f14163a5a547f626832fd21b27b0/src/context.ts)
- **SRC-LAT-PROFILE — Lattice profile compiler at the reviewed revision:** [Reviewed source](https://github.com/howardhayden/lattice/blob/d6cc85b275e3f14163a5a547f626832fd21b27b0/src/profile.ts)
- **SRC-LAT-ENGINE — Lattice engine at the reviewed revision:** [Reviewed source](https://github.com/howardhayden/lattice/blob/d6cc85b275e3f14163a5a547f626832fd21b27b0/src/engine.ts)
- **SRC-LAT-ADVERSARIAL — Lattice adversarial executable contracts at the reviewed revision:** [Reviewed source](https://github.com/howardhayden/lattice/blob/d6cc85b275e3f14163a5a547f626832fd21b27b0/test/adversarial.test.mjs)
- **SRC-NNG-SKILL — NN/g skill mapping:** [Reviewed source](https://www.nngroup.com/articles/skill-mapping/)
- **SRC-NNG-BLUEPRINT — NN/g service blueprint definition:** [Reviewed source](https://www.nngroup.com/articles/service-blueprints-definition/)
- **SRC-LATTICE-UPSTREAM — Lattice upstream repository:** [Reviewed source](https://github.com/howardhayden/lattice)

## Terms and provenance

Authored documentation follows the hah.dev portfolio-content terms. The generator and executable documentation shell retain the applicable source-component terms. The separately licensed Relational Systems Register profile is not reproduced.
