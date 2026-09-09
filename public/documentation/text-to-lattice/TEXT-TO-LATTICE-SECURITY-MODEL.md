---
title: Text to Lattice security model
revision: 2026-09-09
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
| SEC-01 | Prose crosses a network boundary | High | The official lease acquisition has no request body and the published policy forbids source transmission. Model asset URLs and headers are constant, enumerated, credentialless, and independent of user content. The attestation protocol uses closed messages without source or output. | Keep the bodyless lease, closed attestation schema, local inference, and content-telemetry prohibition machine-bound in the qualified source set. Capture production traces immediately after activation; disable the client if any source, clarification, candidate, verifier finding, or output appears in network traffic. | IP address, user agent, timing, public model choice, and ordinary transport metadata remain visible to contacted providers. The repository test suite is not a capture of deployed traffic. |
| SEC-02 | Hostile prose acquires authority or execution | High | Complete Unicode and structural preflight precedes lease acquisition and model load. System instructions are separated from escaped JSON user data and constrained by closed schemas. Public findings are host-authored and React renders visitor and model text as text nodes. | Re-run injection, Unicode, recursive noninterference, and generated-document escaping checks on the release artifact. Review any new renderer or model transport for HTML interpretation or dynamic authority. | A local model can still misunderstand inert data; later release gates, not prompt wording alone, contain that risk. |
| SEC-03 | Semantic drift is released as success | High | Protected spans and semantic sentinels preserve explicit high-consequence content. A distinct verifier, deterministic validators, re-atomization, repair, and whole-document certification gate release. Five outcome states prevent withheld or unresolved work from being relabeled as complete. | Run the full adversarial and semantic regression corpus against exact release revisions. Record manual review across realistic genres without treating those samples as universal proof. | No bounded corpus or model pair proves equivalence for all prose. Review-required is semantically releasable but explicitly not complete bounded clearance. |
| SEC-04 | Input or inference exhausts browser resources | High | Word, code-unit, grapheme, token, control, passage, batch, executed-group, context, completion, queue, and response ceilings are explicit. Preflight completes before lease or model load, and worker operations have timeouts and cancellation paths. | Measure representative supported devices for memory, storage, cancellation, thermal load, and worst-case completion time. Verify deployed limits match the documented constants after bundling. | WebGPU drivers and browser memory management remain outside application control. A supported capability probe cannot guarantee stable inference on every device. |
| SEC-05 | Pinned supply-chain artifact is substituted or lacks usable provenance | High | Models, runtime versions, tokenizer and WASM hashes, WASM repository commit, current binary blobs, upstream PR 158, and the named TVM and MLC-LLM source commits are recorded. The worker installs its request and cache policies before loading model modules: the exact two WASM and two tokenizer requests enforce SRI, protected Cache API hits are SHA-256 checked and mismatches are evicted before use, and allowed shards stay bounded to immutable model-revision URLs. The release workflow independently verifies pinned WASM identities, while the public bundle excludes the runtime whenever a release blocker is open. | Fetch and compare the pinned tokenizer and WASM byte identities through the authorized release workflow. Keep the incomplete Llama conversion narrative and WASM reproducibility and notice custody explicit as accepted residual risks; do not imply a source-equivalent rebuild. Requalify any artifact, runtime, repository, digest, ABI, configuration, or terms change before publication. | Upstream PR 158 establishes source-commit lineage for the current WASM files, not byte-reproducible compilation or a standalone binary-repository license grant. A source pin or binary hash alone does not prove source equivalence, compiler behavior, dependency completeness, or redistribution authority. |
| SEC-06 | Cross-origin attestation is forged, replayed, or confused | High | The parent checks exact origin, exact Window source, protocol version, closed keys, and a fresh 144-bit correlation identifier. The server validates hostname, action, freshness, and single use before grant accounting; every terminal path removes the frame. | Verify production frame headers, origin routing, site key, action, hostname, and replay storage with real provider responses. Exercise keyboard and assistive-technology behavior for interactive challenges. | Provider availability, accessibility, fraud scoring, and privacy practices remain external dependencies. |
| SEC-07 | Lease or accounting state is abused | High | Distinct HMAC secrets bind visitor cookies and lease credentials; canonical encoding, expiry, method, and actor checks precede state work. One globally named SQLite-backed Durable Object serializes exact admissions, grants, renewals, releases, ownership, and expiry. | Deploy with independent encrypted secrets and exercise concurrent production transitions, alarm recovery, and secret rotation. Confirm idempotent client release behavior against deployed Retry-After variants. | Provider point-in-time recovery may retain pseudonymous state for the published recovery window. Network loss can leave a lease until bounded expiry even when local teardown succeeds. |
| SEC-08 | Distributed traffic exhausts the free-tier budget | High | Exact global minute and UTC-day admission precedes Siteverify and lifecycle work; visitor, grant, and active-lease caps protect downstream resources. Ingress, method, path, and credential shapers shed local load, while policy states they do not guarantee billed invocation limits. Quota exhaustion fails closed and static semantic pages remain unrestricted. | Install and verify the required path-scoped edge rule before public enablement. Measure Worker, Durable Object, row, alarm, CPU, storage, and cross-location traffic in the provider dashboard; recalculate carryover from observed latency. | The Cloudflare Free plan does not provide an exact in-application bound on all hostile Worker invocations. Distributed adversarial traffic remains outside the published deterministic budget proof. |
| SEC-09 | Generated output is captured despite interface friction | Moderate | Routine selection, copy, cut, drag, context menu, touch callout, and print paths are disabled for generated output. Visibility, blur, print, and detectable Print Screen events conceal output behind a reduced-motion-compatible veil. Semantic access is preserved and the canonical limitation rejects guarantees of capture prevention or AI unreadability. | Manually exercise keyboard, touch, print, visibility, blur, reduced-motion, forced-colors, and assistive-technology paths. Review copy after each control change so deterrence is never described as prevention. | Browser, extension, operating-system, accessibility, camera, and physical observation remain outside application control. Additional anti-capture complexity can reduce accessibility while failing to remove the residual risk. |
| SEC-10 | Release or configuration drift invalidates the documented model | High | Requirements use stable identifiers and this documentation is deterministically generated with SHA-256 manifests. Model, protocol, endpoint, and policy constants are centralized and source-tested. The release register is executable policy: a held build excludes the interactive runtime, and an enabled build cannot pass with an open release blocker. | Run build, lint, type, full test, documentation drift, static route, release-boundary inspection, and secret-name checks from the exact release tree. Verify live origins, Worker routes, CSP, bindings, edge rules, provider limits, public links, and privacy traces according to their typed release status. | A repository manifest proves bytes in one tree, not remote deployment identity or provider configuration. Manual and operational evidence must be dated and renewed after consequential change. |
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
- **Required before publication:**
  - Keep the bodyless lease, closed attestation schema, local inference, and content-telemetry prohibition machine-bound in the qualified source set.
  - Capture production traces immediately after activation; disable the client if any source, clarification, candidate, verifier finding, or output appears in network traffic.
- **Residual boundary:**
  - IP address, user agent, timing, public model choice, and ordinary transport metadata remain visible to contacted providers.
  - The repository test suite is not a capture of deployed traffic.
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
  - Preflight completes before lease or model load, and worker operations have timeouts and cancellation paths.
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

- **Vector:** A sibling frame, stale token, mismatched hostname/action, guessed correlation identifier, unexpected message shape, or replayed attestation reaches grant accounting.
- **Consequence:** Automated or cross-site traffic can consume scarce capacity or bind verification to the wrong visitor flow.
- **Plausibility:** Cross-origin messaging and bearer tokens create a routine web attack surface.
- **Lifecycle value:** A closed versioned protocol and server-side binding remain reusable if the provider or frame changes.
- **Classification:** The boundary protects shared availability and credential authenticity with realistic web vectors.
- **Assets:** ASSET-03, ASSET-04
- **Boundaries:** TB-04, TB-05
- **As built:**
  - The parent checks exact origin, exact Window source, protocol version, closed keys, and a fresh 144-bit correlation identifier.
  - The server validates hostname, action, freshness, and single use before grant accounting; every terminal path removes the frame.
- **Required before publication:**
  - Verify production frame headers, origin routing, site key, action, hostname, and replay storage with real provider responses.
  - Exercise keyboard and assistive-technology behavior for interactive challenges.
- **Residual boundary:**
  - Provider availability, accessibility, fraud scoring, and privacy practices remain external dependencies.
- **Sources:** SRC-ATTESTATION, SRC-FRAME, SRC-LEASE-WORKER, SRC-USAGE-POLICY, SRC-TEST-SECURITY

</details>

<details id="sec-07">
<summary><strong>SEC-07</strong> · Lease or accounting state is abused — High marginal value</summary>

- **Vector:** Forged, expired, replayed, cross-method, cross-owner, or concurrently mutated credentials cause duplicate grants, stolen renewals, missed releases, or inconsistent counts.
- **Consequence:** One visitor can monopolize capacity, legitimate work can be denied, or the global authority can drift from real lifecycle state.
- **Plausibility:** Any public signed-credential lifecycle is exposed to replay and concurrency races.
- **Lifecycle value:** Exact state transitions and one global authority simplify every future quota policy.
- **Classification:** Shared capacity depends on exact lifecycle integrity under ordinary concurrency and hostile replay.
- **Assets:** ASSET-03, ASSET-04
- **Boundaries:** TB-05
- **As built:**
  - Distinct HMAC secrets bind visitor cookies and lease credentials; canonical encoding, expiry, method, and actor checks precede state work.
  - One globally named SQLite-backed Durable Object serializes exact admissions, grants, renewals, releases, ownership, and expiry.
- **Required before publication:**
  - Deploy with independent encrypted secrets and exercise concurrent production transitions, alarm recovery, and secret rotation.
  - Confirm idempotent client release behavior against deployed Retry-After variants.
- **Residual boundary:**
  - Provider point-in-time recovery may retain pseudonymous state for the published recovery window.
  - Network loss can leave a lease until bounded expiry even when local teardown succeeds.
- **Sources:** SRC-USAGE-LEASE, SRC-USAGE-POLICY, SRC-LEASE-WORKER, SRC-USAGE-STORAGE, SRC-TEST-CAPACITY

</details>

<details id="sec-08">
<summary><strong>SEC-08</strong> · Distributed traffic exhausts the free-tier budget — High marginal value</summary>

- **Vector:** Requests distributed across IPs or Cloudflare locations invoke the public Worker before in-Worker shaping and exceed the accounting assumptions.
- **Consequence:** The demonstrator fails closed for legitimate visitors or consumes shared account capacity; other static evidence must remain available.
- **Plausibility:** Plausible for any public endpoint; location-local permissive counters cannot guarantee an aggregate Worker-invocation ceiling.
- **Lifecycle value:** Separating exact downstream accounting from best-effort edge shedding prevents false capacity claims in later deployments.
- **Classification:** The free-tier boundary is consequential and the provider architecture leaves a known distributed-traffic gap.
- **Assets:** ASSET-04, ASSET-06
- **Boundaries:** TB-05
- **As built:**
  - Exact global minute and UTC-day admission precedes Siteverify and lifecycle work; visitor, grant, and active-lease caps protect downstream resources.
  - Ingress, method, path, and credential shapers shed local load, while policy states they do not guarantee billed invocation limits.
  - Quota exhaustion fails closed and static semantic pages remain unrestricted.
- **Required before publication:**
  - Install and verify the required path-scoped edge rule before public enablement.
  - Measure Worker, Durable Object, row, alarm, CPU, storage, and cross-location traffic in the provider dashboard; recalculate carryover from observed latency.
- **Residual boundary:**
  - The Cloudflare Free plan does not provide an exact in-application bound on all hostile Worker invocations.
  - Distributed adversarial traffic remains outside the published deterministic budget proof.
- **Sources:** SRC-USAGE-POLICY, SRC-LEASE-WORKER, SRC-USAGE-STORAGE, SRC-TEST-CAPACITY

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

- **Vector:** Bundled constants, Worker secrets, routes, CSP, edge rules, model revisions, provider bindings, generated documents, or deployed artifacts diverge from the reviewed register.
- **Consequence:** Controls exist in source but not in production, public evidence becomes stale, or a release claim silently exceeds its proof.
- **Plausibility:** Configuration drift is routine across independent origins, Workers, static export, and third-party artifacts.
- **Lifecycle value:** Deterministic generation, drift checks, explicit gates, and traceable identifiers reduce every later release review.
- **Classification:** The architecture spans several independent release surfaces, making drift both plausible and consequential.
- **Assets:** ASSET-02, ASSET-03, ASSET-04, ASSET-05, ASSET-06
- **Boundaries:** TB-03, TB-04, TB-05, TB-06
- **As built:**
  - Requirements use stable identifiers and this documentation is deterministically generated with SHA-256 manifests.
  - Model, protocol, endpoint, and policy constants are centralized and source-tested.
  - The release register is executable policy: a held build excludes the interactive runtime, and an enabled build cannot pass with an open release blocker.
- **Required before publication:**
  - Run build, lint, type, full test, documentation drift, static route, release-boundary inspection, and secret-name checks from the exact release tree.
  - Verify live origins, Worker routes, CSP, bindings, edge rules, provider limits, public links, and privacy traces according to their typed release status.
- **Residual boundary:**
  - A repository manifest proves bytes in one tree, not remote deployment identity or provider configuration.
  - Manual and operational evidence must be dated and renewed after consequential change.
- **Sources:** SRC-REQUIREMENTS, SRC-MODEL-CONTRACT, SRC-USAGE-POLICY, SRC-RELEASE-REGISTER, SRC-TEST-SECURITY, SRC-TEST-CAPACITY

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

Only `open-release-blocker` prevents activation. Every other status must preserve its evidence boundary, safeguards, follow-up, and—when verification can exist only after deployment—an explicit rollback condition.

| ID | Gate | Status | Marginal value | Requirement | Current evidence | Evidence needed |
| --- | --- | --- | --- | --- | --- | --- |
| GATE-01 | Exact release artifact | Release Workflow Enforced | High | Every publication candidate runs build, lint, type-check, full tests, documentation drift checks, release-boundary checks, static-route checks, generated-artifact inspection, and current-main freshness checks from the exact release tree. | The Pages workflow fail-closes around its current-main identity checks, runs the release validator before upload, and uses pinned actions. The qualified source-set digest binds the activation, runtime, validator, and workflow sources without hashing this register. | The workflow run and deployment record for each release remain operational evidence; the source status means the control is mandatory, not that a future run has already occurred. |
| GATE-02 | Production origin and secret boundary | Open Release Blocker | High | hah.dev, verify.hah.dev, lease Worker routes, CSP, bindings, and independent encrypted secrets match the documented protocol. | During the 2026-09-09 review, the live lease path returned HTTP 404, verify.hah.dev did not resolve, and the reviewed hah.dev response did not carry Content-Security-Policy or Permissions-Policy. Source contracts and deployment automation cannot substitute for those absent public boundaries. | Deploy the lease service and verification frame, configure independent encrypted secrets and exact routes, add the required response policies, then inspect the live headers, origins, routes, bindings, and secret names without disclosing secret values. |
| GATE-03 | Edge and provider capacity controls | Post Deployment Verification | Moderate | The path-scoped edge rule is active and provider-side CPU, storage, request, row, alarm, latency, and distributed-traffic evidence supports the published budget. | Deterministic source contracts bound per-visitor and global admission, lease lifetime, retry behavior, row lifecycle, and fail-closed provider errors. They do not establish live provider capacity before the provider is deployed. | After deployment, record the edge configuration and a bounded production-representative exercise of CPU, storage, request, row, alarm, latency, and distributed-traffic behavior. |
| GATE-04A | Llama behavior and public-use controls | Accepted Residual Risk | Moderate | The public flow discloses model assistance and known limitations, obtains a source-specific lawful-and-authorized-use confirmation, defines prohibited-use safety by purpose and consequence, withholds any safety-failing candidate, and tests realistic harmful and legitimate-context cases. | The checked-in terms and attribution match the reviewed official files. Source implements point-of-use disclosure, resettable source-specific confirmation, purpose-and-consequence safety, and candidate suppression, with deterministic regressions and a balanced ten-case non-operational fixture. This environment does not contain a recorded execution and manual review of that fixture against the exact verifier artifact. | When the exact runtime is available, execute the checked-in cases and record false-positive and false-negative dispositions; treat any consequential safety-release failure as a release regression. |
| GATE-04B | Llama MLC-artifact provenance | Accepted Residual Risk | Moderate | The exact MLC-converted Llama artifact has a recorded source, conversion, license, integrity, and notice chain rather than relying only on the base-model terms and repository revision. | The verifier repository and revision are pinned and the controlling base-model terms are present; the MLC artifact repository does not provide a complete conversion and artifact-license record. | Publisher provenance or a maintainable independently documented conversion would narrow the residual; preserve exact repository, revision, integrity, terms, and attribution bindings meanwhile. |
| GATE-04C | WASM provenance and license boundary | Accepted Residual Risk | Moderate | The exact Qwen and Llama WebGPU WASM identities, available lineage, compatibility evidence, integrity controls, and unresolved reproducibility and notice boundary are recorded without overstating source equivalence. | Exact bytes, digests, git blobs, repository revision, initial and final artifact commits, introducing pull request, and recorded TVM and MLC-LLM source revisions are recorded. The final artifact rewrite postdates the recorded TVM revision and its configuration metadata is consistent with the recorded MLC source, which supports plausibility but not provenance. The binary repository has no root license at the reviewed revision; the historical helper is workstation-specific, calls a Qwen preset absent from the recorded MLC revision, leaves Python and Cargo inputs unlocked, and has no matching independent rebuild. | Upstream artifact-level license and build attestation, or a maintainable project-controlled replacement with its own provenance and notices, would narrow the residual. Reproducing an undocumented historical workstation build byte for byte is not required. |
| GATE-05 | Manual interaction and accessibility | Accepted Residual Risk | Moderate | Keyboard, screen reader, touch, 400 percent zoom, reduced motion, forced colors, print, cancellation, blur, and a second browser engine complete the critical paths. | Automated interaction, accessibility, rendering, and browser-path checks cover dialog focus, dismissal, blur, cancellation, reduced motion, forced colors, print, responsive layout, and no-JS navigation. A complete dated assistive-technology matrix for the eventual deployed artifact is not recorded here. | Record a representative dated keyboard, screen-reader, touch, 400 percent zoom, reduced-motion, forced-colors, print, cancellation, blur, and second-engine matrix when the interactive deployment exists. |
| GATE-06 | Production privacy trace | Post Deployment Verification | High | Network traces show no source, clarification, candidate, verifier finding, or output in lease, attestation, model-asset, error, or telemetry traffic. | Local data-flow and request policies are implemented and tested; they do not prove the final deployed origins, service configuration, browser behavior, or third-party request surface. | Capture and review sanitized production traces from both origins and supported browser engines immediately after activation and after any network-boundary change. |

### GATE-01 · Exact release artifact

- **Rationale:** A stale or substituted artifact can bypass every reviewed control. Enforcing one reusable release workflow has high consequence reduction and lifecycle value.
- **Evidence:** .github/workflows/pages.yml; scripts/verify-current-main-sha.mjs; scripts/verify-text-to-lattice-release.mjs; authority.qualifiedSourceSet
- **Safeguards:** current-main checks fail closed at publication boundaries; the release decision is machine-checked against the exact source set; deployment actions are immutable-revision pinned
- **Follow-up:** Retain the workflow run, deployed commit, and artifact identity for each publication and requalify after any named-source change.

### GATE-02 · Production origin and secret boundary

- **Rationale:** The ordinary public flow cannot work as designed and would cross an unverified origin and secret boundary. Both plausibility and consequence are high.
- **Evidence:** 2026-09-09 live lease request returned HTTP 404; 2026-09-09 DNS review found verify.hah.dev absent; 2026-09-09 hah.dev response review found no Content-Security-Policy or Permissions-Policy
- **Safeguards:** the held source imports no interactive project surface; the held artifact validator rejects lease, verification, model, and runtime execution surfaces; documentation and the canonical project page remain available without inference
- **Follow-up:** Provision the exact two-origin service boundary, run the live configuration inspection, and change this status only from recorded evidence.

### GATE-03 · Edge and provider capacity controls

- **Rationale:** Capacity failure is plausible but bounded by fail-closed admission and retry controls. Verifying the real provider after deployment has moderate incremental value and avoids inventing predeployment evidence.
- **Evidence:** workers/text-to-lattice-lease/policy.js; workers/text-to-lattice-lease/usageStorage.js; workers/text-to-lattice-lease/retryPolicy.js; tests/lattice-protocol-capacity.test.mjs
- **Safeguards:** global and visitor admission limits fail closed; lease lifetimes and retries are bounded; provider exceptions do not grant work
- **Follow-up:** Capture provider configuration and bounded load evidence during the first deployed verification window and after material capacity changes.
- **Rollback condition:** Disable the public client if live admission, storage, alarm, or latency behavior exceeds the published bounds or fails open.

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

### GATE-06 · Production privacy trace

- **Rationale:** Source-text disclosure would be a high-consequence privacy failure. A truthful production trace can exist only after deployment, so immediate verification with a hard disable condition has greater semantic and lifecycle value than fabricated predeployment proof.
- **Evidence:** bodyless lease request contract; closed attestation message schema; browser-local model execution and output protection tests; source-level prohibition on content telemetry
- **Safeguards:** source, clarification, candidate, verifier finding, and output remain browser-local; lease traffic carries no request body; attestation messages expose only closed status and correlation fields
- **Follow-up:** Capture the trace in the first deployment verification window and repeat it after any origin, provider, telemetry, runtime, or request-contract change.
- **Rollback condition:** Disable the public client immediately if any trace contains source text, clarification text, candidate text, verifier findings, output text, or an undocumented content-bearing request.

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
- **SRC-USAGE-STORAGE — Global usage authority:** `workers/text-to-lattice-lease/usageStorage.js`
- **SRC-FRAME — Dedicated verification bridge:** `workers/text-to-lattice-attestation-frame/public/turnstile/bridge.js`
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
