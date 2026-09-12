---
title: Text to Lattice security model
revision: 2026-09-11
authority: docs/text-to-lattice/LATTICE-DOCUMENTATION-ATLAS.json
generator: scripts/docs/build-text-to-lattice-documentation.mjs
---

<!-- Generated file. Edit the authoritative JSON register, then run the builder. -->

# Text to Lattice security model

This is an as-built source model, not a penetration test, formal semantic proof, privacy guarantee, or deployed-control attestation.

[Open the interactive HTML edition](https://hah.dev/documentation/text-to-lattice/text-to-lattice-security-model.html) · [Download complete Markdown](https://hah.dev/documentation/text-to-lattice/TEXT-TO-LATTICE-SECURITY-MODEL.md) · [Download the machine-readable register](https://hah.dev/documentation/text-to-lattice/documentation-atlas.json) · [Inspect the artifact manifest](https://hah.dev/documentation/text-to-lattice/artifact-manifest.json)

## Authority and claim boundary

This register describes the Lattice method at an architectural level and the bounded Text to Lattice implementation evidenced in this repository. It does not redistribute the exclusive register profile, certify universal conformance, or convert source tests into deployed proof.

Stable identifiers persist. A claim changes here with cited evidence; a rendered filter, expansion, or downloaded view never changes authoritative state.

Markdown and HTML are deterministic projections of this register. Filtered browser exports are nonauthoritative reading views.

## Scope and decision rule

The browser wrapper, isolated model worker, dedicated verification frame, public lease endpoint, global usage authority, pinned model-asset origins, and generated documentation surfaces.

Threats are release-relevant when consequence, plausibility, and lifecycle value together justify action. Each entry separates as-built controls from pre-publication evidence and from the residual boundary that the browser or provider cannot erase.

The decision boundary is:

$$\text{marginal value} \propto \text{consequence} \times \text{plausibility} \times \text{lifecycle value}$$

An unusual finding remains eligible. Novelty alone neither promotes nor dismisses it.

| Classification | Test | Disposition |
| --- | --- | --- |
| High marginal value | Realistic failure, meaningful consequence, or reusable architectural benefit | Fix now |
| Moderate marginal value | Lower probability but cheap and bounded to fix or test | Fix when bounded |
| Low marginal value | Exotic, nonconsequential, or provider-impossible with little lifecycle value | Document or defer |
| Negative marginal value | Bespoke complexity or new failure surface exceeds risk removed | Do not implement |

## Protected assets

| ID | Asset | Objective |
| --- | --- | --- |
| ASSET-01 | Source, clarification, candidate, and result text | Confidentiality and semantic integrity |
| ASSET-02 | Semantic obligations and outcome truthfulness | Integrity and nondeceptive release |
| ASSET-03 | Lease, visitor, and attestation credentials | Confidentiality, authenticity, and bounded replay |
| ASSET-04 | Free-tier capacity and global fairness | Availability and exact accounting |
| ASSET-05 | Model, tokenizer, WASM, and runtime integrity | Supply-chain integrity and provenance |
| ASSET-06 | Accessible public evidence and honest limitations | Availability, comprehension, and auditability |

## Trust boundaries

| ID | Boundary | Crossing |
| --- | --- | --- |
| TB-01 | Visitor ↔ résumé interface | Untrusted prose and interaction events enter a semantic React surface. |
| TB-02 | Document ↔ isolated model worker | Closed RPC carries bounded inert model data and validated responses. |
| TB-03 | Model worker ↔ pinned asset origins | Only enumerated HTTPS model, tokenizer, and WASM assets may cross. |
| TB-04 | Résumé origin ↔ verify.hah.dev frame | Closed postMessage schemas carry correlation state and an attestation token, never prose. |
| TB-05 | Browser ↔ lease Worker and global authority | No-body acquisition plus authenticated lifecycle calls govern capacity without semantic content. |
| TB-06 | Source register ↔ generated public documentation | Escaped deterministic projections expose claims and citations but no private profile inventory or visitor content. |

## Threat register

| ID | Threat | Marginal value | As-built posture | Pre-publication work | Residual boundary |
| --- | --- | --- | --- | --- | --- |
| SEC-01 | Prose crosses a network boundary | High | The official lease acquisition has no request body and the published policy forbids source transmission. Model asset URLs and headers are constant, enumerated, credentialless, and independent of user content. The attestation protocol uses closed messages without source or output. The reviewed first-session canonical-client evidence records Safari/WebKit and Brave/Chromium lifecycle behavior plus a capture-wide zero-match source-marker review across hah.dev and verify.hah.dev. | Keep the bodyless lease, closed attestation schema, local inference, and content-telemetry prohibition machine-bound in the qualified source set. Retain the completed first-activation-session supported-browser trace and repeat it after consequential changes; the machine transition still sets GATE-06 to open-release-blocker and restores the held client when any content-bearing request appears. | IP address, user agent, timing, public model choice, and ordinary transport metadata remain visible to contacted providers. The repository test suite is not a capture of deployed traffic. Cloudflare's edge-injected Web Analytics tag remains visible in the reviewed HTML response, but CSP blocked the external beacon resource before transfer or execution and no RUM submission was observed; this does not establish that Web Analytics is disabled or remove ordinary provider transport metadata. |
| SEC-02 | Hostile prose acquires authority or execution | High | Complete Unicode and structural preflight precedes lease acquisition and model load. System instructions are separated from escaped JSON user data and constrained by closed schemas. Public findings are host-authored and React renders visitor and model text as text nodes. | Re-run injection, Unicode, recursive noninterference, and generated-document escaping checks on the release artifact. Review any new renderer or model transport for HTML interpretation or dynamic authority. | A local model can still misunderstand inert data; later release gates, not prompt wording alone, contain that risk. |
| SEC-03 | Semantic drift is released as success | High | Protected spans and semantic sentinels preserve explicit high-consequence content. A distinct verifier, deterministic validators, re-atomization, repair, and whole-document certification gate release. Five outcome states prevent withheld or unresolved work from being relabeled as complete. | Run the full adversarial and semantic regression corpus against exact release revisions. Record manual review across realistic genres without treating those samples as universal proof. | No bounded corpus or model pair proves equivalence for all prose. Review-required is semantically releasable but explicitly not complete bounded clearance. |
| SEC-04 | Input or inference exhausts browser resources | High | Word, code-unit, grapheme, token, control, passage, batch, executed-group, context, completion, queue, and response ceilings are explicit. Preflight completes before lease or model load. A closed worker-start acknowledgement begins execution deadlines only when serialized work starts; 30-second start, 120-second preparation-inactivity, 720-second completion-inactivity, and 45-minute absolute execution bounds terminate stalls explicitly. WebLLM download, GPU-loading, and shader-compilation resets are treated as distinct live phases; after the first completed phase the interface remains nondeterminate, and duplicate progress cannot slide inactivity. Each SHA-256 provenance binding has a 10-second browser deadline and fails explicitly when secure digest support is unavailable or stalled. | Measure representative supported devices for memory, storage, cancellation, thermal load, and worst-case completion time. Verify deployed limits match the documented constants after bundling. | WebGPU drivers and browser memory management remain outside application control. A supported capability probe cannot guarantee stable inference on every device. |
| SEC-05 | Pinned supply-chain artifact is substituted or lacks usable provenance | High | Models, runtime versions, tokenizer and WASM hashes, WASM repository commit, current binary blobs, upstream PR 158, and the named TVM and MLC-LLM source commits are recorded. The worker installs its request and cache policies before loading model modules: the exact two WASM and two tokenizer requests enforce SRI, protected Cache API hits are SHA-256 checked and mismatches are evicted before use, and allowed shards stay bounded to immutable model-revision URLs. The release workflow independently verifies pinned WASM identities, while the public bundle excludes the runtime whenever a release blocker is open. | Fetch and compare the pinned tokenizer and WASM byte identities through the authorized release workflow. Keep the incomplete Llama conversion narrative and WASM reproducibility and notice custody explicit as accepted residual risks; do not imply a source-equivalent rebuild. Requalify any artifact, runtime, repository, digest, ABI, configuration, or terms change before publication. | Upstream PR 158 establishes source-commit lineage for the current WASM files, not byte-reproducible compilation or a standalone binary-repository license grant. A source pin or binary hash alone does not prove source equivalence, compiler behavior, dependency completeness, or redistribution authority. |
| SEC-06 | Cross-origin attestation is forged, replayed, or confused | High | The official parent flow checks exact origin, exact Window source, protocol version, closed keys, and a fresh 144-bit correlation identifier. Under the demonstration profile, the server accepts only the exact published dummy token with the exact testing secret, requires Siteverify success, and bounds the returned response timestamp; it does not claim token freshness, single use, frame participation, human-or-bot verification, hostname, or action assurance. A real profile additionally requires hostname and action while the provider enforces its token rules. Exact admission and signed lease state remain downstream in either profile; every terminal official-browser path removes the frame. | For GATE-02, verify deployed frame bytes and headers, exact origin routing, the advertised testing site key, invalid-token rejection, and a bodyless dummy-token Siteverify, acquisition, and release API round trip; do not call that browser or frame proof. Keep the official testing profile visibly classified as demonstration-only, and replace and requalify it before claiming production anti-bot protection. Retain the reviewed official browser flow and two-origin privacy trace as historical evidence for its deployed revision, and repeat the functional conversion, lifecycle, and privacy evidence under GATE-06 after consequential changes; continue keyboard and assistive-technology verification under GATE-05. | A direct caller can skip the frame and replay the official testing token; the profile does not distinguish people from automated clients or assure availability. Provider availability, accessibility, fraud scoring, and privacy practices remain external dependencies. |
| SEC-07 | Lease or accounting state is abused | High | Distinct HMAC secrets bind visitor cookies and lease credentials; canonical encoding, expiry, method, and actor checks precede state work. One globally named SQLite-backed Durable Object serializes exact admissions, grants, renewals, releases, ownership, and expiry. Acquisition, renewal, and release share a 30-second fetch-and-bounded-body deadline; caller AbortError remains distinct, stalled bodies are canceled without awaiting an uncooperative cancel promise, and release failure settles false. | Deploy with independent encrypted secrets and exercise concurrent production transitions, alarm recovery, and secret rotation. Confirm idempotent client release behavior against deployed Retry-After variants and stalled response bodies. | Provider point-in-time recovery may retain pseudonymous state for the published recovery window. Network loss can leave a lease until bounded expiry even when local teardown succeeds. |
| SEC-08 | Automated or distributed traffic exhausts capacity | High | Exact global minute and UTC-day admission precedes Siteverify and lifecycle work; visitor, grant, and active-lease caps bound downstream resources but do not prevent a caller from minting multiple visitor cookies. Ingress, method, path, and credential shapers shed local load, while policy states they do not guarantee billed invocation limits or stop the sixteen-request slot-starvation sequence. Quota exhaustion fails closed, the UI promises no availability assurance, and static semantic pages remain unrestricted. | Disclose the concrete eight-slot starvation path and that the bounded testing profile offers no anti-bot or availability assurance. Treat the path-scoped 48-request-per-10-second IP rule as recommended GATE-03 operational hardening, not proof against slot starvation; record it and provider capacity measurements when available. Replace and requalify the testing profile before claiming anti-bot protection, and restore the held client if observed abuse defeats demonstrable use. | One client can fill and renew all eight slots with the reusable public token; the documented IP rule does not stop the acquisition sequence. The Cloudflare Free plan does not provide an exact in-application bound on hostile Worker invocations, and distributed traffic remains outside the deterministic budget proof. |
| SEC-09 | Generated output is captured despite interface friction | Moderate | Routine selection, copy, cut, drag, context menu, touch callout, and print paths are disabled for generated output. Visibility, blur, print, and detectable Print Screen events conceal output behind a reduced-motion-compatible veil. Semantic access is preserved and the canonical limitation rejects guarantees of capture prevention or AI unreadability. | Manually exercise keyboard, touch, print, visibility, blur, reduced-motion, forced-colors, and assistive-technology paths. Review copy after each control change so deterrence is never described as prevention. | Browser, extension, operating-system, accessibility, camera, and physical observation remain outside application control. Additional anti-capture complexity can reduce accessibility while failing to remove the residual risk. |
| SEC-10 | Release or configuration drift invalidates the documented model | High | Requirements use stable identifiers and this documentation is deterministically generated with SHA-256 manifests. Model, protocol, endpoint, response-policy, demonstration-profile, secret-bootstrap, and exact route-inventory constants are centralized and source-tested. The release register is executable policy: a held build excludes the interactive runtime, and an enabled build cannot pass with an open release blocker. GATE-06 retains the historical deployed workflow, dated Safari/WebKit and Brave/Chromium capture identities and digests, the zero-match privacy review, and explicit testing-profile claim limits while the repaired runtime awaits a supported-browser terminal conversion and repeated lifecycle and privacy trace. | Run build, lint, type, full test, documentation drift, static route, release-boundary inspection, secret-name, and authenticated route-inventory checks from the exact release tree. Verify live origins, exact Worker routes including stale-route absence, CSP, bindings, selected attestation profile, provider limits, public links, and privacy traces according to their typed release status. | A repository manifest proves bytes in one tree, not remote deployment identity or provider configuration. Manual and operational evidence must be dated and renewed after consequential change. |
| SEC-11 | Model assistance materially furthers a prohibited outcome | High | The interactive surface requires a per-source lawful, authorized, supported-language and AUP confirmation before work can begin. The verifier's safety contract fails closed when a transformation materially furthers a prohibited outcome or necessary authority cannot be established. Candidate text is withheld whenever safety is false; the rule explicitly permits non-furthering quotation, history, criticism, journalism, fiction, prevention, and defensive discussion. A balanced non-operational evaluation set fixes ten harmful and legitimate-context cases for exact-model qualification. | Keep disclosure, source-specific confirmation, purpose-and-consequence review, and candidate withholding machine-bound in the qualified source set. Record exact-model fixture results when bounded runtime access is available and reopen the accepted residual if consequential false allowances defeat candidate withholding. | The checked-in fixture has not been executed and manually reviewed against the exact verifier artifact in this environment. No local model or checkbox can establish every visitor's actual purpose or authority. A modified client can bypass interface controls and invoke public upstream artifacts independently; the product can control only its official surface. |
| SEC-12 | Model assistance or known danger is concealed at the decision point | High | The interactive dialog identifies Qwen drafting and Llama checking, states that local checks can miss altered, omitted, biased, or unsafe meaning, and requires review before reliance. Built with Llama appears at the interaction and in the distributed notice and provenance pages. First-use transfer and working-memory costs are stated before activation. | Verify the disclosure remains visible, comprehensible, and associated with the form at 400 percent zoom, forced colors, and supported screen-reader combinations. Confirm every output state retains an honest review boundary. | Disclosure reduces mistaken reliance; it does not make model output reliable or safe. |

## Detailed treatment records

<details id="sec-01">
<summary><strong>SEC-01</strong> · Prose crosses a network boundary — High marginal value</summary>

- **Vector:** A URL, header, request body, telemetry hook, attestation message, or error report incorporates source, clarification, candidate, or result text.
- **Consequence:** Private or sensitive prose leaves the visitor's browser and contradicts the core privacy claim.
- **Plausibility:** Realistic whenever a model runtime, verification provider, or usage service performs network work.
- **Lifecycle value:** A single enforced data-flow boundary is reusable across every pipeline stage and dependency revision.
- **Classification:** High consequence, ordinary integration plausibility, and architectural reuse require source controls plus immediate post-deployment trace verification and a hard disable condition.
- **Assets:** ASSET-01
- **Boundaries:** TB-03, TB-04, TB-05
- **As built:**
  - The official lease acquisition has no request body and the published policy forbids source transmission.
  - Model asset URLs and headers are constant, enumerated, credentialless, and independent of user content.
  - The attestation protocol uses closed messages without source or output.
  - The reviewed first-session canonical-client evidence records Safari/WebKit and Brave/Chromium lifecycle behavior plus a capture-wide zero-match source-marker review across hah.dev and verify.hah.dev.
- **Required before publication:**
  - Keep the bodyless lease, closed attestation schema, local inference, and content-telemetry prohibition machine-bound in the qualified source set.
  - Retain the completed first-activation-session supported-browser trace and repeat it after consequential changes; the machine transition still sets GATE-06 to open-release-blocker and restores the held client when any content-bearing request appears.
- **Residual boundary:**
  - IP address, user agent, timing, public model choice, and ordinary transport metadata remain visible to contacted providers.
  - The repository test suite is not a capture of deployed traffic.
  - Cloudflare's edge-injected Web Analytics tag remains visible in the reviewed HTML response, but CSP blocked the external beacon resource before transfer or execution and no RUM submission was observed; this does not establish that Web Analytics is disabled or remove ordinary provider transport metadata.
- **Sources:** SRC-ASSET-POLICY, SRC-MODEL-WORKER, SRC-ATTESTATION, SRC-USAGE-LEASE, SRC-USAGE-POLICY, SRC-TEST-SECURITY

</details>

<details id="sec-02">
<summary><strong>SEC-02</strong> · Hostile prose acquires authority or execution — High marginal value</summary>

- **Vector:** Prompt injection, control characters, bidi abuse, HTML-like content, or model-authored issue text becomes an instruction, executable markup, or public authority.
- **Consequence:** The pipeline can ignore its contract, misrepresent a finding, execute injected content, or expose unsafe markup.
- **Plausibility:** Directly plausible because arbitrary prose is the intended input.
- **Lifecycle value:** Inert serialization and text-only rendering protect every future model and document revision.
- **Classification:** The input channel is necessarily hostile, so containment is a primary release boundary.
- **Assets:** ASSET-01, ASSET-02, ASSET-06
- **Boundaries:** TB-01, TB-02, TB-06
- **As built:**
  - Complete Unicode and structural preflight precedes lease acquisition and model load.
  - System instructions are separated from escaped JSON user data and constrained by closed schemas.
  - Public findings are host-authored and React renders visitor and model text as text nodes.
- **Required before publication:**
  - Re-run injection, Unicode, recursive noninterference, and generated-document escaping checks on the release artifact.
  - Review any new renderer or model transport for HTML interpretation or dynamic authority.
- **Residual boundary:**
  - A local model can still misunderstand inert data; later release gates, not prompt wording alone, contain that risk.
- **Sources:** SRC-INPUT, SRC-PROMPTS, SRC-DEMO, SRC-REQUIREMENTS, SRC-TEST-ISOLATE

</details>

<details id="sec-03">
<summary><strong>SEC-03</strong> · Semantic drift is released as success — High marginal value</summary>

- **Vector:** Generation drops, invents, negates, broadens, narrows, or reorders a material obligation and a correlated checker accepts the candidate.
- **Consequence:** Safety instructions, conditions, quantities, uncertainty, causality, consequences, or recovery relationships can change while the interface claims successful transformation.
- **Plausibility:** Probabilistic generation makes drift realistic even under structured output.
- **Lifecycle value:** Independent verification, deterministic sentinels, and honest withholding remain useful across model upgrades.
- **Classification:** Meaning preservation is the product's central consequence; an incorrect success is worse than a refusal.
- **Assets:** ASSET-01, ASSET-02
- **Boundaries:** TB-01, TB-02
- **As built:**
  - Protected spans and semantic sentinels preserve explicit high-consequence content.
  - A distinct verifier, deterministic validators, re-atomization, repair, and whole-document certification gate release.
  - Five outcome states prevent withheld or unresolved work from being relabeled as complete.
- **Required before publication:**
  - Run the full adversarial and semantic regression corpus against exact release revisions.
  - Record manual review across realistic genres without treating those samples as universal proof.
- **Residual boundary:**
  - No bounded corpus or model pair proves equivalence for all prose.
  - Review-required is semantically releasable but explicitly not complete bounded clearance.
- **Sources:** SRC-PROTECTED, SRC-VALIDATORS, SRC-DEMO, SRC-LOCAL-MODEL, SRC-TEST-ENGINE

</details>

<details id="sec-04">
<summary><strong>SEC-04</strong> · Input or inference exhausts browser resources — High marginal value</summary>

- **Vector:** Pathological Unicode, dense passages, oversized tokens, retry subdivision, completion loops, worker queues, or memory pressure trigger unbounded local work.
- **Consequence:** The page stalls, a device becomes unstable, accessibility degrades, or capacity remains occupied without useful work.
- **Plausibility:** Realistic for arbitrary prose and multi-gigabyte browser models, especially on constrained devices.
- **Lifecycle value:** Central ceilings and early preflight bound new pipeline stages as the implementation evolves.
- **Classification:** Common resource variability and meaningful reliability consequences justify fixing and testing the boundary now.
- **Assets:** ASSET-04, ASSET-06
- **Boundaries:** TB-01, TB-02
- **As built:**
  - Word, code-unit, grapheme, token, control, passage, batch, executed-group, context, completion, queue, and response ceilings are explicit.
  - Preflight completes before lease or model load. A closed worker-start acknowledgement begins execution deadlines only when serialized work starts; 30-second start, 120-second preparation-inactivity, 720-second completion-inactivity, and 45-minute absolute execution bounds terminate stalls explicitly.
  - WebLLM download, GPU-loading, and shader-compilation resets are treated as distinct live phases; after the first completed phase the interface remains nondeterminate, and duplicate progress cannot slide inactivity.
  - Each SHA-256 provenance binding has a 10-second browser deadline and fails explicitly when secure digest support is unavailable or stalled.
- **Required before publication:**
  - Measure representative supported devices for memory, storage, cancellation, thermal load, and worst-case completion time.
  - Verify deployed limits match the documented constants after bundling.
- **Residual boundary:**
  - WebGPU drivers and browser memory management remain outside application control.
  - A supported capability probe cannot guarantee stable inference on every device.
- **Sources:** SRC-INPUT, SRC-DEMO, SRC-LOCAL-MODEL, SRC-MODEL-WORKER, SRC-TEST-ENGINE

</details>

<details id="sec-05">
<summary><strong>SEC-05</strong> · Pinned supply-chain artifact is substituted or lacks usable provenance — High marginal value</summary>

- **Vector:** A model shard, tokenizer, WASM binary, runtime package, CDN response, or upstream license changes, is substituted, or cannot be related to a licensed source build.
- **Consequence:** Inference semantics, code execution, availability, incident response, or redistribution authority can diverge from the reviewed build.
- **Plausibility:** Revision and digest pinning lower accidental drift, but executable third-party binaries and incomplete build custody remain realistic dependencies.
- **Lifecycle value:** One artifact identity and qualification record scales across upgrades, audits, and incident response.
- **Classification:** Untreated executable substitution is high consequence, so exact identity and runtime-integrity controls are high-value fixes. The remaining source-equivalence, build-custody, and artifact-authorization record is a distinct moderate accepted residual; hashes do not cure that custody gap.
- **Assets:** ASSET-05, ASSET-06
- **Boundaries:** TB-03
- **As built:**
  - Models, runtime versions, tokenizer and WASM hashes, WASM repository commit, current binary blobs, upstream PR 158, and the named TVM and MLC-LLM source commits are recorded.
  - The worker installs its request and cache policies before loading model modules: the exact two WASM and two tokenizer requests enforce SRI, protected Cache API hits are SHA-256 checked and mismatches are evicted before use, and allowed shards stay bounded to immutable model-revision URLs.
  - The release workflow independently verifies pinned WASM identities, while the public bundle excludes the runtime whenever a release blocker is open.
- **Required before publication:**
  - Fetch and compare the pinned tokenizer and WASM byte identities through the authorized release workflow.
  - Keep the incomplete Llama conversion narrative and WASM reproducibility and notice custody explicit as accepted residual risks; do not imply a source-equivalent rebuild.
  - Requalify any artifact, runtime, repository, digest, ABI, configuration, or terms change before publication.
- **Residual boundary:**
  - Upstream PR 158 establishes source-commit lineage for the current WASM files, not byte-reproducible compilation or a standalone binary-repository license grant.
  - A source pin or binary hash alone does not prove source equivalence, compiler behavior, dependency completeness, or redistribution authority.
- **Sources:** SRC-MODEL-CONTRACT, SRC-ASSET-POLICY, SRC-MODEL-WORKER, SRC-RELEASE-REGISTER, SRC-RELEASE-QUALIFICATION, SRC-WASM-PR, SRC-TEST-SECURITY

</details>

<details id="sec-06">
<summary><strong>SEC-06</strong> · Cross-origin attestation is forged, replayed, or confused — High marginal value</summary>

- **Vector:** A sibling frame, mismatched production hostname/action, guessed correlation identifier, unexpected message shape, or replayed public demonstration token reaches grant accounting.
- **Consequence:** Automated or cross-site traffic can consume scarce capacity or bind a real-profile verification to the wrong visitor flow.
- **Plausibility:** Cross-origin messaging and bearer tokens create a routine web attack surface; the bounded official testing profile intentionally publishes a reusable token and provides no bot discrimination.
- **Lifecycle value:** A closed versioned browser protocol, explicit credential profiles, and signed lease boundary remain reusable if the provider or frame changes.
- **Classification:** Origin, message, and signed-lease checks protect realistic browser and credential-integrity boundaries. The demonstration token's replayability remains a moderate accepted availability residual for this capacity-capped portfolio tool, not an exotic edge case; a real hostname-restricted profile is required before claiming token freshness, single use, or anti-bot protection.
- **Assets:** ASSET-03, ASSET-04
- **Boundaries:** TB-04, TB-05
- **As built:**
  - The official parent flow checks exact origin, exact Window source, protocol version, closed keys, and a fresh 144-bit correlation identifier.
  - Under the demonstration profile, the server accepts only the exact published dummy token with the exact testing secret, requires Siteverify success, and bounds the returned response timestamp; it does not claim token freshness, single use, frame participation, human-or-bot verification, hostname, or action assurance.
  - A real profile additionally requires hostname and action while the provider enforces its token rules. Exact admission and signed lease state remain downstream in either profile; every terminal official-browser path removes the frame.
- **Required before publication:**
  - For GATE-02, verify deployed frame bytes and headers, exact origin routing, the advertised testing site key, invalid-token rejection, and a bodyless dummy-token Siteverify, acquisition, and release API round trip; do not call that browser or frame proof.
  - Keep the official testing profile visibly classified as demonstration-only, and replace and requalify it before claiming production anti-bot protection.
  - Retain the reviewed official browser flow and two-origin privacy trace as historical evidence for its deployed revision, and repeat the functional conversion, lifecycle, and privacy evidence under GATE-06 after consequential changes; continue keyboard and assistive-technology verification under GATE-05.
- **Residual boundary:**
  - A direct caller can skip the frame and replay the official testing token; the profile does not distinguish people from automated clients or assure availability.
  - Provider availability, accessibility, fraud scoring, and privacy practices remain external dependencies.
- **Sources:** SRC-ATTESTATION, SRC-FRAME, SRC-LEASE-WORKER, SRC-DEMO-PROFILE, SRC-USAGE-POLICY, SRC-TEST-SECURITY

</details>

<details id="sec-07">
<summary><strong>SEC-07</strong> · Lease or accounting state is abused — High marginal value</summary>

- **Vector:** Forged, expired, replayed, cross-method, cross-owner, concurrently mutated, or indefinitely stalled credentials and responses cause duplicate grants, stolen renewals, missed releases, or inconsistent counts.
- **Consequence:** One visitor can monopolize capacity, legitimate work can be denied, or the global authority can drift from real lifecycle state.
- **Plausibility:** Any public signed-credential lifecycle is exposed to replay, concurrency races, and transport stalls.
- **Lifecycle value:** Exact state transitions and one global authority simplify every future quota policy.
- **Classification:** Shared capacity depends on exact lifecycle integrity under ordinary concurrency and hostile replay.
- **Assets:** ASSET-03, ASSET-04
- **Boundaries:** TB-05
- **As built:**
  - Distinct HMAC secrets bind visitor cookies and lease credentials; canonical encoding, expiry, method, and actor checks precede state work.
  - One globally named SQLite-backed Durable Object serializes exact admissions, grants, renewals, releases, ownership, and expiry.
  - Acquisition, renewal, and release share a 30-second fetch-and-bounded-body deadline; caller AbortError remains distinct, stalled bodies are canceled without awaiting an uncooperative cancel promise, and release failure settles false.
- **Required before publication:**
  - Deploy with independent encrypted secrets and exercise concurrent production transitions, alarm recovery, and secret rotation.
  - Confirm idempotent client release behavior against deployed Retry-After variants and stalled response bodies.
- **Residual boundary:**
  - Provider point-in-time recovery may retain pseudonymous state for the published recovery window.
  - Network loss can leave a lease until bounded expiry even when local teardown succeeds.
- **Sources:** SRC-USAGE-LEASE, SRC-USAGE-POLICY, SRC-LEASE-WORKER, SRC-USAGE-STORAGE, SRC-TEST-CAPACITY

</details>

<details id="sec-08">
<summary><strong>SEC-08</strong> · Automated or distributed traffic exhausts capacity — High marginal value</summary>

- **Vector:** One caller replays the public testing token through sixteen acquisition requests to occupy all eight slots, or distributed callers invoke the public Worker before in-Worker shaping and exceed accounting assumptions.
- **Consequence:** The demonstrator becomes unavailable to legitimate visitors or consumes shared free-tier capacity; other static evidence must remain available.
- **Plausibility:** Realistic and easy under the disclosed testing profile. The 48-request-per-10-second IP rule would not stop the sixteen-request slot acquisition, and location-local permissive counters cannot guarantee an aggregate Worker-invocation ceiling.
- **Lifecycle value:** Separating exact downstream accounting, honest availability claims, and best-effort edge shedding prevents false capacity claims in later deployments.
- **Classification:** The threat is consequential and plausible. Exact global admission and expiry bound its blast radius to tool availability and free-tier work but do not make the attacker unlikely. For this explicitly capacity-capped portfolio demonstrator, accepting that availability residual has moderate incremental release cost only with prominent disclosure, rollback on observed abuse, and requalification before any operational anti-bot claim.
- **Assets:** ASSET-04, ASSET-06
- **Boundaries:** TB-05
- **As built:**
  - Exact global minute and UTC-day admission precedes Siteverify and lifecycle work; visitor, grant, and active-lease caps bound downstream resources but do not prevent a caller from minting multiple visitor cookies.
  - Ingress, method, path, and credential shapers shed local load, while policy states they do not guarantee billed invocation limits or stop the sixteen-request slot-starvation sequence.
  - Quota exhaustion fails closed, the UI promises no availability assurance, and static semantic pages remain unrestricted.
- **Required before publication:**
  - Disclose the concrete eight-slot starvation path and that the bounded testing profile offers no anti-bot or availability assurance.
  - Treat the path-scoped 48-request-per-10-second IP rule as recommended GATE-03 operational hardening, not proof against slot starvation; record it and provider capacity measurements when available.
  - Replace and requalify the testing profile before claiming anti-bot protection, and restore the held client if observed abuse defeats demonstrable use.
- **Residual boundary:**
  - One client can fill and renew all eight slots with the reusable public token; the documented IP rule does not stop the acquisition sequence.
  - The Cloudflare Free plan does not provide an exact in-application bound on hostile Worker invocations, and distributed traffic remains outside the deterministic budget proof.
- **Sources:** SRC-USAGE-POLICY, SRC-LEASE-WORKER, SRC-DEMO-PROFILE, SRC-USAGE-STORAGE, SRC-TEST-CAPACITY

</details>

<details id="sec-09">
<summary><strong>SEC-09</strong> · Generated output is captured despite interface friction — Moderate marginal value</summary>

- **Vector:** Selection APIs, clipboard events, printing, page capture, browser extensions, developer tools, accessibility APIs, operating-system screenshots, cameras, or memory inspection obtain result text.
- **Consequence:** A visitor or third party retains output despite the interface's deterrent treatment, and an overstated claim would mislead users about control.
- **Plausibility:** Browser event controls can block routine paths, but privileged and out-of-band capture is always plausible.
- **Lifecycle value:** An honest limitation prevents future styling or browser changes from becoming a false security promise.
- **Classification:** The privacy consequence is meaningful, but bespoke escalation cannot close the browser and operating-system boundary; the bounded fix is deterrence plus precise disclosure.
- **Assets:** ASSET-01, ASSET-06
- **Boundaries:** TB-01
- **As built:**
  - Routine selection, copy, cut, drag, context menu, touch callout, and print paths are disabled for generated output.
  - Visibility, blur, print, and detectable Print Screen events conceal output behind a reduced-motion-compatible veil.
  - Semantic access is preserved and the canonical limitation rejects guarantees of capture prevention or AI unreadability.
- **Required before publication:**
  - Manually exercise keyboard, touch, print, visibility, blur, reduced-motion, forced-colors, and assistive-technology paths.
  - Review copy after each control change so deterrence is never described as prevention.
- **Residual boundary:**
  - Browser, extension, operating-system, accessibility, camera, and physical observation remain outside application control.
  - Additional anti-capture complexity can reduce accessibility while failing to remove the residual risk.
- **Sources:** SRC-OUTPUT, SRC-REQUIREMENTS, SRC-TEST-A11Y

</details>

<details id="sec-10">
<summary><strong>SEC-10</strong> · Release or configuration drift invalidates the documented model — High marginal value</summary>

- **Vector:** Bundled constants, Worker secrets, routes, CSP, edge rules, attestation profile, model revisions, provider bindings, generated documents, or deployed artifacts diverge from the reviewed register.
- **Consequence:** Controls exist in source but not in production, public evidence becomes stale, or a release claim silently exceeds its proof.
- **Plausibility:** Configuration drift is routine across independent origins, Workers, static export, and third-party artifacts.
- **Lifecycle value:** Deterministic generation, drift checks, explicit gates, and traceable identifiers reduce every later release review.
- **Classification:** The architecture spans several independent release surfaces, making drift both plausible and consequential.
- **Assets:** ASSET-02, ASSET-03, ASSET-04, ASSET-05, ASSET-06
- **Boundaries:** TB-03, TB-04, TB-05, TB-06
- **As built:**
  - Requirements use stable identifiers and this documentation is deterministically generated with SHA-256 manifests.
  - Model, protocol, endpoint, response-policy, demonstration-profile, secret-bootstrap, and exact route-inventory constants are centralized and source-tested.
  - The release register is executable policy: a held build excludes the interactive runtime, and an enabled build cannot pass with an open release blocker.
  - GATE-06 retains the historical deployed workflow, dated Safari/WebKit and Brave/Chromium capture identities and digests, the zero-match privacy review, and explicit testing-profile claim limits while the repaired runtime awaits a supported-browser terminal conversion and repeated lifecycle and privacy trace.
- **Required before publication:**
  - Run build, lint, type, full test, documentation drift, static route, release-boundary inspection, secret-name, and authenticated route-inventory checks from the exact release tree.
  - Verify live origins, exact Worker routes including stale-route absence, CSP, bindings, selected attestation profile, provider limits, public links, and privacy traces according to their typed release status.
- **Residual boundary:**
  - A repository manifest proves bytes in one tree, not remote deployment identity or provider configuration.
  - Manual and operational evidence must be dated and renewed after consequential change.
- **Sources:** SRC-REQUIREMENTS, SRC-MODEL-CONTRACT, SRC-USAGE-POLICY, SRC-RESPONSE-POLICY, SRC-DEMO-PROFILE, SRC-SECRET-BOOTSTRAP, SRC-ROUTE-INVENTORY, SRC-RELEASE-REGISTER, SRC-TEST-SECURITY, SRC-TEST-CAPACITY

</details>

<details id="sec-11">
<summary><strong>SEC-11</strong> · Model assistance materially furthers a prohibited outcome — High marginal value</summary>

- **Vector:** A visitor uses transformation or verification to improve actionable harm, malware, deliberate deception, unauthorized professional practice, sensitive-person inference, or another purpose prohibited by the Llama 3.2 Acceptable Use Policy.
- **Consequence:** The product can contribute to concrete harm, breach governing use terms, and lose authorization to distribute or use the model.
- **Plausibility:** Arbitrary public prose makes adversarial and dual-use requests plausible even though inference is local and tool-free.
- **Lifecycle value:** A purpose-and-consequence rule, separate from topic matching, remains reusable across model and policy revisions.
- **Classification:** Untreated prohibited assistance is high consequence, so disclosure, source confirmation, purpose-and-consequence review, and explicit-denial withholding are high-value controls. The unexecuted exact-model fixture and false-negative uncertainty remain a distinct moderate accepted residual.
- **Assets:** ASSET-02, ASSET-06
- **Boundaries:** TB-01, TB-02
- **As built:**
  - The interactive surface requires a per-source lawful, authorized, supported-language and AUP confirmation before work can begin.
  - The verifier's safety contract fails closed when a transformation materially furthers a prohibited outcome or necessary authority cannot be established.
  - Candidate text is withheld whenever safety is false; the rule explicitly permits non-furthering quotation, history, criticism, journalism, fiction, prevention, and defensive discussion.
  - A balanced non-operational evaluation set fixes ten harmful and legitimate-context cases for exact-model qualification.
- **Required before publication:**
  - Keep disclosure, source-specific confirmation, purpose-and-consequence review, and candidate withholding machine-bound in the qualified source set.
  - Record exact-model fixture results when bounded runtime access is available and reopen the accepted residual if consequential false allowances defeat candidate withholding.
- **Residual boundary:**
  - The checked-in fixture has not been executed and manually reviewed against the exact verifier artifact in this environment.
  - No local model or checkbox can establish every visitor's actual purpose or authority.
  - A modified client can bypass interface controls and invoke public upstream artifacts independently; the product can control only its official surface.
- **Sources:** SRC-PROMPTS, SRC-DEMO, SRC-MODEL-CONTRACT, SRC-LLAMA-AUP, SRC-LLAMA-EVAL, SRC-RELEASE-REGISTER, SRC-TEST-ENGINE

</details>

<details id="sec-12">
<summary><strong>SEC-12</strong> · Model assistance or known danger is concealed at the decision point — High marginal value</summary>

- **Vector:** The interface presents transformed text without identifying model assistance, independent checking, fallibility, or the need for human review.
- **Consequence:** A visitor can mistake probabilistic output for human-authored or certified text and rely on altered, omitted, biased, or unsafe meaning.
- **Plausibility:** The former dialog exposed only a generic review warning after one failure state; successful-looking output made overreliance plausible.
- **Lifecycle value:** One durable disclosure at point of use protects comprehension across outcome states and model upgrades.
- **Classification:** The failure is easy to understand, consequential in high-stakes prose, and cheap to prevent without expanding the model boundary.
- **Assets:** ASSET-02, ASSET-06
- **Boundaries:** TB-01
- **As built:**
  - The interactive dialog identifies Qwen drafting and Llama checking, states that local checks can miss altered, omitted, biased, or unsafe meaning, and requires review before reliance.
  - Built with Llama appears at the interaction and in the distributed notice and provenance pages.
  - First-use transfer and working-memory costs are stated before activation.
- **Required before publication:**
  - Verify the disclosure remains visible, comprehensible, and associated with the form at 400 percent zoom, forced colors, and supported screen-reader combinations.
  - Confirm every output state retains an honest review boundary.
- **Residual boundary:**
  - Disclosure reduces mistaken reliance; it does not make model output reliable or safe.
- **Sources:** SRC-DEMO, SRC-MODEL-CONTRACT, SRC-LLAMA-LICENSE, SRC-LLAMA-AUP, SRC-TEST-A11Y

</details>

## Release qualification gates

Only `open-release-blocker` prevents activation. `satisfied-in-source` records repository evidence; `satisfied-in-production` records observed live evidence for the permitted production gates. Every other status preserves its distinct evidence boundary, safeguards, and follow-up, while production satisfaction and post-deployment verification require an explicit rollback condition.
Before activation, the held artifact had no canonical interactive client. End-to-end acquisition, a non-error terminal conversion result, release, and two-origin privacy evidence through the declared deployed credential profile must now originate from the enabled official page under GATE-06; it does not authorize a separate public or operator bypass harness. Under Cloudflare’s official testing profile, that evidence establishes demonstrator integration and privacy behavior, not human verification or production anti-bot assurance. A failed mandatory step, an observed real renewal defect, or a privacy-trace failure sets GATE-06 to open-release-blocker, making return to the held publication machine-enforceable after GATE-02 closes. Renewal remains follow-up evidence when an ordinary session naturally reaches its interval, not a deliberately timed condition of operational completion.

| ID | Gate | Status | Marginal value | Requirement | Current evidence | Evidence needed |
| --- | --- | --- | --- | --- | --- | --- |
| GATE-01 | Exact release artifact | Release Workflow Enforced | High | Every publication candidate runs build, lint, type-check, full tests, documentation drift checks, release-boundary checks, static-route checks, generated-artifact inspection, and current-main freshness checks from the exact release tree. | The Pages workflow fail-closes around its current-main identity checks, runs the release validator before upload, and uses pinned actions. The qualified source-set digest binds the activation, runtime, validator, complete test tree, license-routing map, shipped legal notices, and workflow sources without hashing this register. | The workflow run and deployment record for each release remain operational evidence; the source status means the control is mandatory, not that a future run has already occurred. |
| GATE-02 | Deployed origin, secret, and demonstration boundary | Satisfied In Production | High | The deployed hah.dev and verify.hah.dev origins, the four exact response-policy routes hah.dev/, hah.dev/index.html, hah.dev/resume/, and hah.dev/resume/index.html, the independent lease Worker route, response policies, bindings, and independent encrypted secrets match the documented protocol, and every live noninteractive or intentionally invalid-token probe fails closed. If the bounded demonstrable release uses Cloudflare's official testing pair, that fact remains explicit and does not count as production anti-bot evidence. | The canonical run URL is https://github.com/howardhayden/folio/actions/runs/34320931448; service job 102367490246; commit a9b1db818dc7bb87b5bee16d0e168bf17d130185; live verification at 2026-09-09T06:52:40.6740509Z; and current-main postcheck at 2026-09-09T06:52:41.0031258Z. The successful job deployed response-policy Worker version 06e29e21-bbba-48d7-9fe3-28e8a960a88f, verification-frame Worker version 8c7d9e11-f6b8-40b2-9b5d-b9e2af082271, and lease Worker version 1a18b449-2341-449b-96e1-f27451efd483. The exact route inventory covered hah.dev/, hah.dev/index.html, hah.dev/resume/, hah.dev/resume/index.html, verify.hah.dev, and hah.dev/api/text-to-lattice/lease, with no missing, extra, or stale owned routes; the job verified frame bytes and isolation headers, main-page response policies, and the four encrypted binding-name inventory without reading values. Its fail-closed probes covered method, cross-origin, cookie, missing-attestation, and invalid-attestation behavior, including first-visitor and returning-visitor flows. The exact official dummy-token lifecycle returned HTTP 200 acquisition and authenticated bodyless HTTP 204 release. The direct dummy-token lifecycle establishes only the deployed Siteverify, lease, and release path; it is not evidence that the frame or widget participated or that canonical-browser GATE-06 passed, and it does not establish human verification or production anti-bot assurance. This retained production record predates the replacement source candidate's negotiated typed HTTP 200 challenge and does not establish that new protocol; the checked-in workflow must deploy and live-verify its typed HTTP 200 path plus legacy HTTP 428 overlap compatibility before publishing the new Pages client. | Retain this successful production workflow record and, on every consequential requalification, deploy the response-policy Worker only on hah.dev/, hah.dev/index.html, hah.dev/resume/, and hah.dev/resume/index.html; deploy the verification frame and independent lease service; preserve a complete existing Turnstile pair without reading or replacing its values, or install Cloudflare's official testing pair when both bindings are absent; configure independent generated signing secrets; inspect live headers, origins, exact routes, bindings, and secret names without disclosing values; then pass the checked-in method, cross-origin, cookie, missing-attestation, intentionally invalid-attestation, exact official demonstration-site-key, and exact official dummy-token acquisition-and-release probes, plus the exact closed protocol/version/type/allowed/code/site-key challenge-envelope probe. The live verifier must require the versioned Accept negotiation to return the typed challenge with HTTP 200 and must also require the legacy no-negotiation path to remain HTTP 428-compatible throughout the Worker-before-Pages deployment window. The current demonstrable release remains qualified only while the returned site key and direct dummy-token lifecycle match that exact official testing profile. A different complete pair remains preserved but fails this profile's verifier until the workflow, register, and live qualification intentionally change. The direct dummy-token lifecycle establishes only the deployed Siteverify, lease, and release path; it is not evidence that the frame or widget participated or that canonical-browser GATE-06 passed. |
| GATE-03 | Edge and provider capacity controls | Post Deployment Verification | Moderate | Provider-side CPU, storage, request, row, alarm, latency, and distributed-traffic evidence supports the published budget; the status and effect of the recommended path-scoped 48-per-10-second edge rule are recorded without treating it as an availability guarantee. | Deterministic source contracts bound per-visitor and global admission, lease lifetime, retry behavior, row lifecycle, and fail-closed provider errors. Under the public reusable testing token, however, one client can use the permitted 16-request acquisition sequence to fill all eight slots and renew them; the 48-per-10-second per-IP rule does not stop that sequence. The controls bound cost, state, and privacy consequence, not tool availability, and source cannot establish live provider capacity. | After deployment, record whether the recommended path-scoped edge rule is feasible and active, measure its actual effect, and perform a bounded production-representative exercise of CPU, storage, request, row, alarm, latency, distributed traffic, and public-token slot pressure. Retain observed abuse as a requalification trigger. |
| GATE-04A | Llama behavior and public-use controls | Accepted Residual Risk | Moderate | The public flow discloses model assistance and known limitations, obtains a source-specific lawful-and-authorized-use confirmation, defines prohibited-use safety by purpose and consequence, withholds any safety-failing candidate, and tests realistic harmful and legitimate-context cases. | The checked-in terms and attribution match the reviewed official files. Source implements point-of-use disclosure, resettable source-specific confirmation, purpose-and-consequence safety, and candidate suppression, with deterministic regressions and a balanced ten-case non-operational fixture. This environment does not contain a recorded execution and manual review of that fixture against the exact verifier artifact. | When the exact runtime is available, execute the checked-in cases and record false-positive and false-negative dispositions; treat any consequential safety-release failure as a release regression. |
| GATE-04B | Llama MLC-artifact provenance | Accepted Residual Risk | Moderate | The exact MLC-converted Llama artifact has a recorded source, conversion, license, integrity, and notice chain rather than relying only on the base-model terms and repository revision. | The verifier repository and revision are pinned and the controlling base-model terms are present; the MLC artifact repository does not provide a complete conversion and artifact-license record. | Publisher provenance or a maintainable independently documented conversion would narrow the residual; preserve exact repository, revision, integrity, terms, and attribution bindings meanwhile. |
| GATE-04C | WASM provenance and license boundary | Accepted Residual Risk | Moderate | The exact Qwen and Llama WebGPU WASM identities, available lineage, compatibility evidence, integrity controls, and unresolved reproducibility and notice boundary are recorded without overstating source equivalence. | Exact bytes, digests, git blobs, repository revision, initial and final artifact commits, introducing pull request, and recorded TVM and MLC-LLM source revisions are recorded. The final artifact rewrite postdates the recorded TVM revision and its configuration metadata is consistent with the recorded MLC source, which supports plausibility but not provenance. The binary repository has no root license at the reviewed revision; the historical helper is workstation-specific, calls a Qwen preset absent from the recorded MLC revision, leaves Python and Cargo inputs unlocked, and has no matching independent rebuild. | Upstream artifact-level license and build attestation, or a maintainable project-controlled replacement with its own provenance and notices, would narrow the residual. Reproducing an undocumented historical workstation build byte for byte is not required. |
| GATE-05 | Manual interaction and accessibility | Accepted Residual Risk | Moderate | Keyboard, screen reader, touch, 400 percent zoom, reduced motion, forced colors, print, cancellation, blur, and a second browser engine complete the critical paths. | Automated interaction, accessibility, rendering, and browser-path checks cover dialog focus, dismissal, blur, cancellation, reduced motion, forced colors, print, responsive layout, and no-JS navigation. A complete dated assistive-technology matrix for the eventual deployed artifact is not recorded here. | Record a representative dated keyboard, screen-reader, touch, 400 percent zoom, reduced-motion, forced-colors, print, cancellation, blur, and second-engine matrix when the interactive deployment exists. |
| GATE-06 | Production lifecycle and privacy trace | Post Deployment Verification | High | The activated canonical page, in its first session, validates one closed versioned typed HTTP 200 challenge, completes one distinct real end-to-end 200 acquisition grant, reaches a non-error terminal conversion result (translated, conformant-for-context, or review-required) through the exact local model worker, and completes a 204 release through the declared deployed credential profile; a sanitized trace from both origins shows no source, clarification, candidate, verifier finding, or output in lease, attestation, model-asset, error, or telemetry traffic. Testing-profile success establishes demonstrator integration, not production anti-bot assurance. | The owner supplied sanitized captures from the activated canonical client at https://hah.dev/resume/#text-to-lattice after workflow run https://github.com/howardhayden/folio/actions/runs/34325228788 deployed commit 9ab26b95cc1f9a94697118c0fc20a849db8f6ad2. Safari Version 26.5 (21624.2.5.11.4), WebKit, on macOS 26.5.1 (25F80), M5 iMac, with an operator-normalized capture time of 2026-09-09T08:05:50Z, directly records the first-session sequence POST /api/text-to-lattice/lease 428, the isolated https://verify.hah.dev/turnstile/ frame and Cloudflare challenge resources, POST /api/text-to-lattice/lease 200, and DELETE /api/text-to-lattice/lease 204 with a zero-byte response. Brave 1.94.121 (Chromium 152.0.7977.83, arm64) on the same platform, with operator-normalized capture times from 2026-09-09T08:15:12Z through 2026-09-09T08:22:30Z, independently records the second-engine lease statuses 428, 200, and 204, the isolated verification origin and challenge flow, and pinned Qwen tokenizer and model-asset loading. The deployed canonical-client source correlates those ordered Brave rows to POST 428, POST 200, and DELETE 204; the screenshot itself does not independently prove the later request methods. The owner reports that a capture-wide search for the unique submitted source marker returned 0 matches across the Brave network record. That search establishes the source-specific negative check. The deployed source contract and tests keep source, clarification, candidate, verifier finding, and output browser-local and exclude them from lease, attestation, model-asset, error, or telemetry traffic; the captured request inventory shows no undocumented content-bearing route. The canonical URL, bodyless lease request and release source contracts, and exact Cloudflare official testing profile are additionally bound by the deployed source and operator record rather than inferred from screenshot pixels. Payload-pane inspection was not claimed. The UTC times are operator normalizations of the local capture filenames, not server-signed timestamps. Cloudflare automatically injected a Web Analytics tag for https://static.cloudflareinsights.com/beacon.min.js into both document responses, but each CSP blocked the external beacon resource before transfer or execution (blocked:csp, 0.0 kB), and no /cdn-cgi/rum or other RUM transmission appeared. This composite evidence establishes canonical official-page integration and the observed privacy boundary under the declared testing profile; it does not establish human verification, bot resistance, token freshness or single use, hostname or action assurance, universal browser behavior, or production anti-bot assurance, and it does not establish that Cloudflare Web Analytics is disabled or that ordinary provider transport metadata is absent. Those captures remain historical evidence for the lease lifecycle and observed privacy boundary of their deployed revision; subsequent diagnosis established that the rapid DELETE followed a model-worker import failure and did not demonstrate a terminal conversion. The repair candidate adds a worker-only Vite pre-transform that preserves fourteen bare realm checks across the pinned WebLLM and web-tokenizers modules with fail-closed twelve/two count assertions, plus a final-artifact Worker-realm smoke that boots without window, completes the cached RPC, and reaches the first approved model-configuration cache request without network access. Because this changes emitted runtime behavior, GATE-06 is post-deployment verification: after deployment, repeat the supported-engine lifecycle and sanitized two-origin privacy trace and record one non-error terminal conversion. On 2026-09-11, the site owner reported that the deployed repaired runtime reached a full green progress bar after about one minute but remained at "Preparing on this device" with "Your result will appear here" and produced no terminal result. This owner report establishes the failed observable outcome; it is not a timestamped network capture, does not identify a newly verified deployment revision, and does not replace the historical evidence above. The replacement source candidate requires the exact https://hah.dev browser origin before any lease fetch, so local and Vite previews fail with a canonical-origin explanation instead of requesting a missing local API route. It adds a worker-realm capability probe before lease acquisition or model download; phase-aware WebLLM download, GPU-loading, and shader-compilation progress that becomes nondeterminate after the first completed phase; a closed worker-start acknowledgement so execution deadlines do not run while requests wait in the serialized queue; 30-second worker-start, 120-second preparation-inactivity, 720-second completion-inactivity, and 45-minute hard execution bounds; 15-second adapter and 10-second storage checks; a 30-second lease fetch-and-body deadline; a 10-second browser provenance-digest deadline; and explicit terminal errors. While the resume component remains mounted, Close, backdrop, and Escape are visibility-only in every phase and preserve input, availability or attestation request, lease-bound work, post-request processing, clarification, error, terminal state, and result for reopening; Cancel and Start over terminate or reset the current request, and component unmount tears it down; completion and error may release runtime resources, but their terminal state remains reopenable. The response-policy candidate preserves or adds Cache-Control: no-transform, and the live verifier now uses browser-shaped navigation requests and rejects conditionally injected Cloudflare beacon or RUM markers. These are source controls awaiting deployment verification; they do not establish that Cloudflare Web Analytics or RUM is disabled and do not establish a successful production conversion. | Retain the completed first activation session evidence from the canonical public page in the supported browser engines as historical evidence for its deployed revision. After the replacement source candidate deploys, record one actual supported-browser WebGPU conversion ending in a non-error terminal result (translated, conformant-for-context, or review-required), the closed versioned typed challenge with HTTP 200, the distinct HTTP 200 lease grant, the HTTP 204 release, and the sanitized trace from both origins. Confirm that the current client emits no 428 network error for its normal challenge path and that browser-shaped responses contain no conditionally injected Cloudflare beacon or RUM marker; this must be observed after deployment and is not established by source policy alone. Repeat this functional lifecycle after any consequential widget, key, hostname, action, lease protocol, origin, provider, telemetry, runtime, request-contract, modal-lifecycle, or progress-state change. Record the declared credential profile with each trace and do not treat testing-profile success as anti-bot evidence. If an ordinary session naturally reaches the renewal interval, retain its bodyless renewal status as follow-up evidence, but do not deliberately wait for that interval or treat a 200 renewal as a condition of operational completion. Do not create a public or operator bypass harness; this evidence must originate from the activated canonical public client. |

### GATE-01 · Exact release artifact

- **Rationale:** A stale or substituted artifact can bypass every reviewed control. Enforcing one reusable release workflow has high consequence reduction and lifecycle value.
- **Evidence:** .github/workflows/pages.yml; scripts/verify-current-main-sha.mjs; scripts/verify-text-to-lattice-release.mjs; authority.qualifiedSourceSet
- **Safeguards:** current-main checks fail closed at publication boundaries; the release decision is machine-checked against the exact source set; deployment actions are immutable-revision pinned
- **Follow-up:** Retain the workflow run, deployed commit, and artifact identity for each publication and requalify after any named-source change.

### GATE-02 · Deployed origin, secret, and demonstration boundary

- **Rationale:** The ordinary public flow cannot work without the deployed origin, policy, secret, and lease boundaries. Those controls have high consequence and lifecycle value. A production anti-bot credential remains useful, but its incremental value for a capacity-capped demonstrator is moderate: the official test pair removes bot assurance without weakening same-origin, privacy, signing, lease, or global admission controls. Those controls bound consequence but do not assure availability.
- **Evidence:** https://github.com/howardhayden/folio/actions/runs/34320931448; service job 102367490246; commit a9b1db818dc7bb87b5bee16d0e168bf17d130185; live verification at 2026-09-09T06:52:40.6740509Z; current-main postcheck at 2026-09-09T06:52:41.0031258Z; response-policy Worker version 06e29e21-bbba-48d7-9fe3-28e8a960a88f; verification-frame Worker version 8c7d9e11-f6b8-40b2-9b5d-b9e2af082271; lease Worker version 1a18b449-2341-449b-96e1-f27451efd483; exact route inventory for hah.dev/, hah.dev/index.html, hah.dev/resume/, hah.dev/resume/index.html, verify.hah.dev, and hah.dev/api/text-to-lattice/lease, including absence of missing, extra, or stale owned routes; live frame byte and isolation-header verification, main-page response policies, and four encrypted binding-name inventory without reading values; fail-closed probes for method, cross-origin, cookie, missing-attestation, and invalid-attestation behavior, including first-visitor and returning-visitor flows; exact official dummy-token lifecycle returned HTTP 200 acquisition and authenticated bodyless HTTP 204 release; direct dummy-token lifecycle establishes only the deployed Siteverify, lease, and release path; it is not evidence that the frame or widget participated or that canonical-browser GATE-06 passed; workers/text-to-lattice-response-policy/worker.js; scripts/bootstrap-text-to-lattice-secrets.mjs; scripts/verify-text-to-lattice-route-inventory.mjs; replacement source controls awaiting deployment: workers/text-to-lattice-lease/worker.js and app/resume/lattice/usageLease.js negotiated typed challenge protocol; replacement source control awaiting deployment: scripts/verify-text-to-lattice-services.mjs typed HTTP 200 and legacy HTTP 428 compatibility probes; Cloudflare official Turnstile testing-key documentation
- **Safeguards:** the enabled release validator requires the qualified interactive surface and rejects stale held-only copy; the exact successful service workflow is retained with deployed commit, job identity, and completion time; the canonical project page and mapped documentation remain available independently of inference availability; the live service verifier exercises public fail-closed behavior without a valid token or lease credential, then proves the declared server profile with an exact dummy-token acquisition and cleanup; the live service verifier requires an exact closed typed HTTP 200 challenge for the current negotiated media type and a legacy HTTP 428 challenge for already-published clients during the non-atomic deployment overlap; authenticated zone inventory rejects missing, extra, or stale wildcard routes owned by either hah.dev Text to Lattice Worker; two generated signing secrets remain independent encrypted bindings and are never printed or committed; the demonstrable profile retains exact-origin checks, bodyless requests, per-location shaping, global daily admission, concurrent-lease caps, bounded lease lifetime, and fail-closed provider handling; the official testing pair is accepted only through its exact published secret and is never described as anti-bot assurance; the canonical launch uses /resume/#text-to-lattice, whose fragment does not alter the protected /resume/ document request; unrelated portfolio paths and traffic bypass the Text to Lattice response-policy Worker
- **Follow-up:** Retain workflow run 34320931448, service job 102367490246, deployed commit a9b1db818dc7bb87b5bee16d0e168bf17d130185, and its live qualification record; rerun the exact route, header, binding-name, noninteractive, invalid-token, exact demonstration-site-key, and direct dummy-token lifecycle checks after any consequential deployment or protocol change. Keep canonical-browser acquisition, release, and privacy tracing in GATE-06 and do not relabel the direct token result as browser evidence. Before describing the release as operationally anti-bot protected, intentionally change the declared profile, workflow verifier, and register to a hostname-restricted real widget pair and repeat qualification; do not add a bespoke bypass route or unsigned token mode.
- **Rollback condition:** Reopen GATE-02 as an open release blocker and return the public client to held documentation-only publication if any exact origin, route, response policy, frame byte, isolation header, encrypted binding-name inventory, signing-domain separation, fail-closed probe, official demonstration-site-key, direct dummy-token acquisition, or release-cleanup check fails or materially drifts.

### GATE-03 · Edge and provider capacity controls

- **Rationale:** Capacity failure and public-token slot starvation are plausible, but their consequence is bounded to demonstrator availability by fail-closed admission, eight-slot and lifetime caps, browser-local prose, and the absence of a paid overage path. The per-IP edge rule is moderate-value operational hardening, not a release prerequisite or complete answer to a reusable public token. Measuring the real provider and reopening on observed abuse has greater lifecycle value than claiming unavailable bot resistance.
- **Evidence:** workers/text-to-lattice-lease/policy.js; workers/text-to-lattice-lease/usageStorage.js; workers/text-to-lattice-lease/retryPolicy.js; tests/lattice-protocol-capacity.test.mjs
- **Safeguards:** global and visitor admission limits fail closed; lease lifetimes and retries are bounded; provider exceptions do not grant work; the demonstrator promises no availability assurance while the public testing profile is active; the recommended per-IP edge rule is recorded as operational hardening, not as prevention of public-token slot starvation
- **Follow-up:** Capture provider configuration and bounded load evidence during the first deployed verification window and after material capacity changes. Add the recommended path-scoped edge rule when feasible, monitor all-eight-slot occupancy and renewal patterns, and requalify the credential profile or admission boundary when observed abuse materially impairs use.
- **Rollback condition:** Disable the public client if live admission, storage, alarm, or latency behavior exceeds the published bounds or fails open, or if observed public-token abuse materially prevents demonstrator use beyond the disclosed no-availability-assurance boundary.

### GATE-04A · Llama behavior and public-use controls

- **Rationale:** The public-use controls address realistic misuse and misunderstanding. Exact-model fixture execution would improve empirical confidence; a verifier false negative remains unobserved and candidate withholding depends on the verifier's classification. Source-specific confirmation, error and explicit-denial withholding, local tool-free transformation, and mandatory human review bound the official product surface without proving classifier behavior.
- **Evidence:** LICENSES/Llama-3.2-Community-License.txt; LICENSES/Llama-3.2-Acceptable-Use-Policy.md; docs/text-to-lattice/LLAMA-USE-EVALUATION-CASES.json; app/resume/lattice/usagePolicy.js; tests/lattice-usage-policy.test.mjs
- **Safeguards:** an explicit safety-failing verifier result never releases a candidate; the confirmation resets when source text changes; disclosure states that model output can be unsafe or semantically wrong and requires human review
- **Follow-up:** Run and review the exact-model fixture when bounded runtime access is available; re-open the gate if observed behavior defeats candidate withholding or the published use boundary.
- **Acceptance basis:** The missing execution is a moderate empirical gap, and false-negative behavior is explicitly unobserved. The official surface is a local, tool-free text transformation with source-specific user confirmation and mandatory human review; errors and explicit denials withhold output. Blocking indefinitely on unavailable local artifact execution has lower lifecycle value than recording, testing when bounded access exists, and reopening on consequential observed failure.

### GATE-04B · Llama MLC-artifact provenance

- **Rationale:** A substituted verifier artifact would be consequential, so immutable identity and controlling terms remain mandatory. The missing publisher conversion narrative is a real but moderate custody gap after those controls, not a demonstrated incompatible or malicious artifact.
- **Evidence:** immutable verifier repository revision 1e80abf71e3d17cd564e2d2b63caa15cb226018e; reviewed Llama 3.2 terms and acceptable-use files; pinned tokenizer digest and WebLLM model contract
- **Safeguards:** model identifiers, revisions, and URLs plus tokenizer digests are machine-bound; runtime downloads are restricted to the pinned artifact paths; Built with Llama attribution and controlling terms remain published
- **Follow-up:** Accept publisher provenance if it becomes available or qualify a maintainable controlled conversion; re-open on any artifact, terms, or integrity drift.
- **Acceptance basis:** The exact artifact identity and base-model terms are known, but hashes do not establish the converted artifact's own authorization or notice custody; that gap remains explicitly accepted for this bounded browser-local demonstrator, which retrieves the immutable publisher-hosted artifact rather than redistributing its shards from hah.dev. Preserving pins, attribution, and requalification triggers has better lifecycle value than an indefinite block on an unavailable publisher narrative.

### GATE-04C · WASM provenance and license boundary

- **Rationale:** Opaque executable bytes make identity and lineage consequential. Exact SHA-256, SRI, git-blob, repository, revision, ABI, and configuration bindings materially reduce substitution and compatibility risk; pursuing theoretical reconstruction of every unavailable historical input would add substantial complexity without a plausible proportional failure reduction.
- **Evidence:** exact WASM byte counts, SHA-256 digests, SRI values, and git blob identifiers; pinned binary repository revision and introducing pull request; recorded TVM, MLC-LLM, and tokenizer source revisions; ABI and embedded-configuration inspection
- **Safeguards:** the release workflow independently verifies byte count, SHA-256, and git blob identity; the exact two WASM and two tokenizer requests enforce their recorded SRI values; protected Cache API hits are SHA-256 checked and mismatches are evicted before use; allowed model shards remain bounded to the manifest-enumerated immutable model-revision URLs; reproducibility and artifact-level notice gaps remain explicitly unestablished
- **Follow-up:** Prefer upstream clarification or a maintainable controlled replacement when available; re-open immediately on digest, ABI, repository, runtime, or license-term drift.
- **Acceptance basis:** Exact identity and compatibility controls reduce technical substitution and incompatibility risk. They do not establish artifact-level authorization or notice custody; that separate gap remains explicitly accepted for this bounded browser-local demonstrator, which retrieves exact publisher-hosted libraries rather than redistributing them from hah.dev. A full historical reproducible rebuild is negative marginal value for this boundary because it demands bespoke reconstruction and long-term maintenance without a commensurate plausible technical-risk reduction; upstream clarification or a maintainable replacement remains eligible future work.

### GATE-05 · Manual interaction and accessibility

- **Rationale:** A blocked critical path is consequential, while exhaustive device coverage is impossible. Existing automated and browser checks make the unrecorded matrix a moderate residual that is cheap to observe and triage during release follow-up.
- **Evidence:** tests/lattice-modal-accessibility.test.mjs; tests/lattice-boundary-regressions.test.mjs; tests/rendered-html.test.mjs; tests/lattice-graceful-degradation.test.mjs
- **Safeguards:** ARIA dialog semantics and deterministic focus restoration; page blur and scroll isolation while expanded content is active; reduced-motion, forced-color, print, and no-JS paths remain source-tested
- **Follow-up:** Record the dated deployed interaction matrix and fix any realistic blocked or misleading path; do not block on exotic combinations without a plausible consequential failure.
- **Acceptance basis:** The remaining evidence is observational rather than a known defect. Automated and browser checks cover the highest-consequence paths, and the residual can be bounded through prompt post-release observation and repair.

### GATE-06 · Production lifecycle and privacy trace

- **Rationale:** A broken model-worker runtime, a misleading completed progress bar, a lost modal process, declared-profile acquisition, or release would make the interaction unusable or strand capacity, and source-text disclosure would be a high-consequence privacy failure. The earlier lifecycle trace and the owner's 2026-09-11 observation each demonstrate that successful acquisition or apparent preparation can coexist with no terminal conversion, so production qualification still requires a non-error terminal result. Genuine official-page evidence must originate from the enabled canonical client. Immediate functional conversion, acquisition, release, and two-origin privacy verification with rapid held rollback has greater reliability, privacy, and lifecycle value than adding a bespoke preactivation harness and its new attack surface. A hostname-restricted widget provides additional bot assurance but is not required for an honestly labeled, capacity-capped demonstrable release. A deliberately timed renewal trace has lower incremental value because extensive renewal contracts, bodyless PATCH requests, fail-closed client termination, bounded lease expiry, and eventual cleanup already constrain the plausible failure while an ordinary session can expose it without holding release completion.
- **Evidence:** canonical production client https://hah.dev/resume/#text-to-lattice; workflow run https://github.com/howardhayden/folio/actions/runs/34325228788 deployed commit 9ab26b95cc1f9a94697118c0fc20a849db8f6ad2 before the canonical browser captures; Safari Version 26.5 (21624.2.5.11.4), WebKit, on macOS 26.5.1 (25F80), M5 iMac; operator-normalized capture time 2026-09-09T08:05:50Z; sanitized-capture SHA-256 266db6b8264a0aa42ac16916ddf696554c846b239960e7d19fc002917d843950; directly observed POST 428, isolated verify.hah.dev frame and challenge resources, POST 200, and DELETE 204 with a zero-byte response; Brave 1.94.121, Chromium 152.0.7977.83, arm64, on macOS 26.5.1 (25F80), M5 iMac; operator-normalized capture times from 2026-09-09T08:15:12Z through 2026-09-09T08:22:30Z; sanitized-capture SHA-256 8cd8a22b1b8375d05d7f1f727dafbd7fd604ed91dec3d8cee853fb071f8cb957; independently recorded lease statuses 428, 200, and 204 plus the isolated verify.hah.dev challenge flow and pinned Qwen tokenizer and model asset; deployed canonical-client source correlates the ordered rows to POST 428, POST 200, and DELETE 204, while the screenshot itself does not independently prove the later request methods; Brave sanitized-capture SHA-256 d9b84b3f5a49b383d2472ffdb909dfe0bd68fb822bdd5d64ae05421654092741; Brave sanitized-detail-capture SHA-256 247777816b443b6eb9e4b63012941cbb38b342108347b081f99f457412ff17dd; Brave sanitized-detail-capture SHA-256 5f14ff23d8b2749dd81830656b9d71f0d58e79f853121f52860d28b62e4c1c64; owner-attested capture-wide unique-source-marker search returned 0 matches across the Brave network record; composite privacy evidence: the owner-attested trace search found no source marker; deployed source contracts and tests keep source, clarification, candidate, verifier finding, and output browser-local and exclude them from lease, attestation, model-asset, error, or telemetry traffic; the captured request inventory showed no undocumented content-bearing route; Cloudflare Web Analytics beacon tag was edge-injected on both origins; each external resource request was blocked by CSP before transfer or execution at 0.0 kB, with no observed /cdn-cgi/rum or other RUM transmission; declared Cloudflare official testing profile; browser evidence establishes demonstrator integration and observed privacy behavior, not human verification or production anti-bot assurance; acquisition, renewal, release, and teardown source contracts; bodyless lease request and release source contracts; the record does not claim independent Payload-pane inspection; historical production worker latticeWebllm.worker-BuQrxTen.js failed its model RPC with ReferenceError: window is not defined; the rapid DELETE 204 was client cleanup rather than evidence of a completed conversion; vite.config.ts preserves the pinned WebLLM and web-tokenizers bare worker-realm checks with fail-closed per-package counts without installing a synthetic window global; tests/lattice-built-worker.test.mjs executes the final emitted bundle in a Window-free Worker realm, requires a successful cached RPC, reaches the first approved generator model-configuration cache request, and prohibits network access in the smoke; closed attestation message schema; browser-local model execution and output protection tests; source-level prohibition on content telemetry; site-owner report dated 2026-09-11: the deployed repaired runtime reached a full green progress bar after about one minute, remained at Preparing on this device with an empty result region, and produced no terminal result; no new deployed commit, trace digest, or successful conversion is inferred; app/resume/lattice/latticeWebllm.worker.ts, app/resume/lattice/modelRpc.js, and app/resume/lattice/localModel.js add a closed worker capability probe and start acknowledgement; phase-aware download, GPU-loading, and shader-compilation liveness; sticky nondeterminate setup and inference presentation after the first completed progress phase; 30-second worker-start, 120-second preparation-inactivity, 720-second completion-inactivity, and 45-minute hard execution bounds; queued requests do not begin execution deadlines before their start acknowledgement, and duplicate progress cannot slide inactivity; app/resume/lattice/usageLease.js requires the exact https://hah.dev browser origin before acquisition, produces no local missing-route fetch, and bounds acquisition, renewal, and release fetch plus response-body handling to 30 seconds while preserving distinct caller cancellation; workers/text-to-lattice-lease/worker.js and app/resume/lattice/usageLease.js negotiate application/vnd.hah.text-to-lattice-lease.v1+json plus application/json, require the exact closed protocol/version/type/allowed/code/site-key challenge envelope before attestation, use HTTP 200 for the current normal challenge path, retain legacy HTTP 428 only for deployment-overlap compatibility, and reject an untyped or malformed HTTP 200 challenge without retrying; app/resume/latticeDemo.js bounds each browser SHA-256 provenance digest to 10 seconds and fails explicitly when secure digest support is unavailable or stalled; app/resume/ResumeProjects.tsx preserves input, availability or attestation request, lease-bound conversion, post-request processing, clarification, error, terminal state, and eventual output across Close, backdrop, or Escape dismissal and reopening in every phase while mounted; Cancel and Start over terminate or reset the current request, and component unmount tears it down; completion and error may release runtime resources, but their terminal state remains reopenable; workers/text-to-lattice-response-policy/worker.js and the verification-frame headers preserve or add Cache-Control: no-transform; scripts/verify-text-to-lattice-services.mjs uses browser-shaped document requests and rejects Cloudflare beacon, data-cf-beacon, and /cdn-cgi/rum markers without claiming the provider setting is disabled
- **Safeguards:** GATE-02 must establish the deployed origins, secrets, response policies, routes, and live fail-closed probe behavior before activation; the lifecycle evidence must originate from the canonical public client and does not authorize a bypass harness; a failed lifecycle or privacy trace can set GATE-06 itself to open-release-blocker so the machine release rule restores the held publication; source, clarification, candidate, verifier finding, and output remain browser-local; lease traffic carries no request body; attestation messages expose only closed status and correlation fields; the retained trace summary and capture digests exclude raw HAR data, cookies, bearer values, Turnstile tokens, attestation values, signed asset-query values, and sensitive header values; the worker-only build transform preserves fourteen exact bare realm checks across the two pinned MLC modules and fails closed if their twelve/two source counts drift; the final-artifact Worker-realm smoke runs without window or document and fails if WebLLM import regresses before the first approved model-configuration request; the blocked Web Analytics resource is retained as a non-content-bearing edge-injection residual; the evidence claims CSP prevention and no observed RUM transmission, not disabled Cloudflare analytics or the absence of ordinary edge metadata; the worker-realm probe fails unsupported or unavailable worker WebGPU before lease acquisition and model download; download, GPU-loading, and shader-compilation progress resets count as distinct liveness phases; after the first completed phase the interface remains nondeterminate, duplicate reports cannot slide inactivity, worker execution clocks begin only after a closed start acknowledgement, and bounded stalls become explicit terminal errors; each browser SHA-256 provenance digest settles within 10 seconds or fails explicitly, so integrity binding cannot leave the process pending indefinitely; Close, backdrop, and Escape are visibility-only in every phase while mounted, preserving input, availability or attestation request, lease-bound work, post-request processing, clarification, error, terminal state, and result; Cancel and Start over terminate or reset the current request, and component unmount tears it down; completion and error may release runtime resources, but their terminal state remains reopenable; the exact canonical browser-origin guard runs before any lease fetch, and acquisition, renewal, and release fetch plus bounded-body processing settle within 30 seconds; a local preview neither requests a missing lease route nor introduces a proxy or bypass; the current client accepts a normal HTTP 200 challenge only when every closed versioned envelope field and exact key is valid, retries at most once, never treats the challenge as a grant, and accepts the historical HTTP 428 envelope only as a bounded rollback compatibility path; no-transform response policy and browser-shaped conditional-injection verification are source controls only; provider-side Web Analytics or RUM disablement is not claimed until live responses establish it
- **Follow-up:** After the replacement source candidate deploys, retain one supported-browser non-error terminal conversion plus the typed HTTP 200 challenge, distinct HTTP 200 grant, HTTP 204 release, and two-origin privacy trace, including browser-shaped checks for an absent normal-path 428 and absent conditional Cloudflare beacon and RUM markers. Repeat the functional lifecycle after any consequential widget, key, hostname, action, lease protocol, origin, provider, telemetry, runtime, request-contract, modal-lifecycle, or progress-state change. Observe a bodyless real renewal when an ordinary session naturally reaches the renewal interval; do not create a special wait or harness solely to manufacture it.
- **Rollback condition:** Set GATE-06 to open-release-blocker and return the overall release and public client immediately to the held documentation-only artifact if the replacement source candidate fails before a non-error terminal conversion result, acquisition fails, release fails, any observed real renewal attempt fails, or any trace contains source text, clarification text, candidate text, verifier findings, output text, an undocumented content-bearing request, or a conditionally injected Cloudflare beacon or RUM marker.

## Honest residual boundary

- Text to Lattice is a bounded demonstrator, not the full Lattice profile and not a universal conformance oracle.
- Source tests and deterministic manifests prove repository behavior and bytes; they do not prove deployed configuration or external service behavior.
- Local inference still downloads executable third-party artifacts and reveals ordinary transport metadata to their hosts.
- No browser page can guarantee prevention of screenshots, extensions, developer tools, accessibility extraction, cameras, or operating-system capture.
- The public endpoint can bound exact downstream work but cannot guarantee a global free-tier Worker-invocation ceiling against distributed hostile traffic.
- Accessibility, comprehension, semantic fidelity across uncontrolled prose, and operational reliability require continuing empirical evidence.

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
