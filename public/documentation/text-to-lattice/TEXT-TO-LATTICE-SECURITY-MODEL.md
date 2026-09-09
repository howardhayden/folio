---
title: Text to Lattice security model
revision: 2026-09-08
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
| SEC-01 | Prose crosses a network boundary | High | The official lease acquisition has no request body and the published policy forbids source transmission. Model asset URLs and headers are constant, enumerated, credentialless, and independent of user content. The attestation protocol uses closed messages without source or output. | Exercise production network traces for acquisition, renewal, release, asset fetches, errors, and verification. Confirm CSP and deployed telemetry configuration do not add unmodeled egress. | IP address, user agent, timing, public model choice, and ordinary transport metadata remain visible to contacted providers. The repository test suite is not a capture of deployed traffic. |
| SEC-02 | Hostile prose acquires authority or execution | High | Complete Unicode and structural preflight precedes lease acquisition and model load. System instructions are separated from escaped JSON user data and constrained by closed schemas. Public findings are host-authored and React renders visitor and model text as text nodes. | Re-run injection, Unicode, recursive noninterference, and generated-document escaping checks on the release artifact. Review any new renderer or model transport for HTML interpretation or dynamic authority. | A local model can still misunderstand inert data; later release gates, not prompt wording alone, contain that risk. |
| SEC-03 | Semantic drift is released as success | High | Protected spans and semantic sentinels preserve explicit high-consequence content. A distinct verifier, deterministic validators, re-atomization, repair, and whole-document certification gate release. Five outcome states prevent withheld or unresolved work from being relabeled as complete. | Run the full adversarial and semantic regression corpus against exact release revisions. Record manual review across realistic genres without treating those samples as universal proof. | No bounded corpus or model pair proves equivalence for all prose. Review-required is semantically releasable but explicitly not complete bounded clearance. |
| SEC-04 | Input or inference exhausts browser resources | High | Word, code-unit, grapheme, token, control, passage, batch, executed-group, context, completion, queue, and response ceilings are explicit. Preflight completes before lease or model load, and worker operations have timeouts and cancellation paths. | Measure representative supported devices for memory, storage, cancellation, thermal load, and worst-case completion time. Verify deployed limits match the documented constants after bundling. | WebGPU drivers and browser memory management remain outside application control. A supported capability probe cannot guarantee stable inference on every device. |
| SEC-05 | Pinned supply-chain artifact is substituted or unusable | High | Models, runtime versions, tokenizer hashes, WASM commit, and exact asset paths are pinned in source. The worker installs its request policy before loading model modules and rejects unexpected transports. The model contract links the Llama 3.2 community license and acceptable-use policy without treating those links as approval. | Resolve or explicitly accept the pinned WASM binary license and provenance boundary before public enablement. Record an owner-approved Llama 3.2 license and acceptable-use disposition for arbitrary public prose. Fetch, hash, archive, and compare release artifacts through the authorized supply-chain process. | The source currently records that standalone license metadata is absent from the pinned binary repository. Source pins do not establish binary reproducibility or resolve the Llama acceptable-use and licensing decision. |
| SEC-06 | Cross-origin attestation is forged, replayed, or confused | High | The parent checks exact origin, exact Window source, protocol version, closed keys, and a fresh 144-bit correlation identifier. The server validates hostname, action, freshness, and single use before grant accounting; every terminal path removes the frame. | Verify production frame headers, origin routing, site key, action, hostname, and replay storage with real provider responses. Exercise keyboard and assistive-technology behavior for interactive challenges. | Provider availability, accessibility, fraud scoring, and privacy practices remain external dependencies. |
| SEC-07 | Lease or accounting state is abused | High | Distinct HMAC secrets bind visitor cookies and lease credentials; canonical encoding, expiry, method, and actor checks precede state work. One globally named SQLite-backed Durable Object serializes exact admissions, grants, renewals, releases, ownership, and expiry. | Deploy with independent encrypted secrets and exercise concurrent production transitions, alarm recovery, and secret rotation. Confirm idempotent client release behavior against deployed Retry-After variants. | Provider point-in-time recovery may retain pseudonymous state for the published recovery window. Network loss can leave a lease until bounded expiry even when local teardown succeeds. |
| SEC-08 | Distributed traffic exhausts the free-tier budget | High | Exact global minute and UTC-day admission precedes Siteverify and lifecycle work; visitor, grant, and active-lease caps protect downstream resources. Ingress, method, path, and credential shapers shed local load, while policy states they do not guarantee billed invocation limits. Quota exhaustion fails closed and static semantic pages remain unrestricted. | Install and verify the required path-scoped edge rule before public enablement. Measure Worker, Durable Object, row, alarm, CPU, storage, and cross-location traffic in the provider dashboard; recalculate carryover from observed latency. | The Cloudflare Free plan does not provide an exact in-application bound on all hostile Worker invocations. Distributed adversarial traffic remains outside the published deterministic budget proof. |
| SEC-09 | Generated output is captured despite interface friction | Moderate | Routine selection, copy, cut, drag, context menu, touch callout, and print paths are disabled for generated output. Visibility, blur, print, and detectable Print Screen events conceal output behind a reduced-motion-compatible veil. Semantic access is preserved and the canonical limitation rejects guarantees of capture prevention or AI unreadability. | Manually exercise keyboard, touch, print, visibility, blur, reduced-motion, forced-colors, and assistive-technology paths. Review copy after each control change so deterrence is never described as prevention. | Browser, extension, operating-system, accessibility, camera, and physical observation remain outside application control. Additional anti-capture complexity can reduce accessibility while failing to remove the residual risk. |
| SEC-10 | Release or configuration drift invalidates the documented model | High | Requirements use stable identifiers and this documentation is deterministically generated with SHA-256 manifests. Model, protocol, endpoint, and policy constants are centralized and source-tested. | Run build, lint, type, full test, documentation drift, static-artifact inspection, and secret-name checks from the exact release tree. Verify both origins, Worker routes, CSP, bindings, edge rules, provider limits, and public links after deployment. | A repository manifest proves bytes in one tree, not remote deployment identity or provider configuration. Manual and operational evidence must be dated and renewed after consequential change. |

## Detailed treatment records

<details id="sec-01">
<summary><strong>SEC-01</strong> · Prose crosses a network boundary — High marginal value</summary>

- **Vector:** A URL, header, request body, telemetry hook, attestation message, or error report incorporates source, clarification, candidate, or result text.
- **Consequence:** Private or sensitive prose leaves the visitor's browser and contradicts the core privacy claim.
- **Plausibility:** Realistic whenever a model runtime, verification provider, or usage service performs network work.
- **Lifecycle value:** A single enforced data-flow boundary is reusable across every pipeline stage and dependency revision.
- **Classification:** High consequence, ordinary integration plausibility, and architectural reuse make this release-blocking.
- **Assets:** ASSET-01
- **Boundaries:** TB-03, TB-04, TB-05
- **As built:**
  - The official lease acquisition has no request body and the published policy forbids source transmission.
  - Model asset URLs and headers are constant, enumerated, credentialless, and independent of user content.
  - The attestation protocol uses closed messages without source or output.
- **Required before publication:**
  - Exercise production network traces for acquisition, renewal, release, asset fetches, errors, and verification.
  - Confirm CSP and deployed telemetry configuration do not add unmodeled egress.
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
<summary><strong>SEC-05</strong> · Pinned supply-chain artifact is substituted or unusable — High marginal value</summary>

- **Vector:** A model shard, tokenizer, WASM binary, runtime package, CDN response, or upstream license changes or is served contrary to the reviewed revision.
- **Consequence:** Inference semantics, code execution, availability, or redistribution authority can diverge from the reviewed build.
- **Plausibility:** Revision pinning lowers accidental drift but third-party hosting, binary provenance, and model-use terms remain realistic dependencies.
- **Lifecycle value:** One manifest and provenance gate scales across upgrades and incident response.
- **Classification:** Executable third-party artifacts cross a privileged boundary; the WASM provenance gap and the public-prose model-use disposition remain open.
- **Assets:** ASSET-05, ASSET-06
- **Boundaries:** TB-03
- **As built:**
  - Models, runtime versions, tokenizer hashes, WASM commit, and exact asset paths are pinned in source.
  - The worker installs its request policy before loading model modules and rejects unexpected transports.
  - The model contract links the Llama 3.2 community license and acceptable-use policy without treating those links as approval.
- **Required before publication:**
  - Resolve or explicitly accept the pinned WASM binary license and provenance boundary before public enablement.
  - Record an owner-approved Llama 3.2 license and acceptable-use disposition for arbitrary public prose.
  - Fetch, hash, archive, and compare release artifacts through the authorized supply-chain process.
- **Residual boundary:**
  - The source currently records that standalone license metadata is absent from the pinned binary repository.
  - Source pins do not establish binary reproducibility or resolve the Llama acceptable-use and licensing decision.
- **Sources:** SRC-MODEL-CONTRACT, SRC-ASSET-POLICY, SRC-MODEL-WORKER, SRC-TEST-SECURITY

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
- **Required before publication:**
  - Run build, lint, type, full test, documentation drift, static-artifact inspection, and secret-name checks from the exact release tree.
  - Verify both origins, Worker routes, CSP, bindings, edge rules, provider limits, and public links after deployment.
- **Residual boundary:**
  - A repository manifest proves bytes in one tree, not remote deployment identity or provider configuration.
  - Manual and operational evidence must be dated and renewed after consequential change.
- **Sources:** SRC-REQUIREMENTS, SRC-MODEL-CONTRACT, SRC-USAGE-POLICY, SRC-TEST-SECURITY, SRC-TEST-CAPACITY

</details>

## Pre-publication gate block

Open gates are not converted into confidence by source test volume. The interactive wrapper must not be represented as release-cleared until each gate has exact-revision evidence or a recorded owner disposition.

| ID | Gate | Status | Requirement | Evidence needed |
| --- | --- | --- | --- | --- |
| GATE-01 | Exact release artifact | Open Before Publication | Build, lint, type-check, full tests, documentation drift, static route, and generated-worker inspections pass from the exact release tree. | Dated command transcript and artifact digests. |
| GATE-02 | Production origin and secret boundary | Open Before Publication | hah.dev, verify.hah.dev, Worker routes, CSP, bindings, and distinct encrypted secrets match the documented protocol. | Deployed configuration inspection without secret disclosure. |
| GATE-03 | Edge and provider capacity controls | Open Before Publication | The required path-scoped edge rule is active and provider-side CPU, storage, request, row, alarm, latency, and distributed-traffic measurements support the budget. | Provider configuration record and bounded load evidence. |
| GATE-04 | Supply-chain provenance and model-use approval | Open Before Publication | Pinned model, tokenizer, runtime, and WASM bytes are verified; the standalone WASM license and provenance boundary is resolved or explicitly accepted; and the Llama 3.2 license and acceptable-use disposition for arbitrary public prose is recorded. | Hashes, source or archive record, licenses, acceptable-use review, and owner decisions. |
| GATE-05 | Manual interaction and accessibility | Open Before Publication | Keyboard, screen reader, touch, 400 percent zoom, reduced motion, forced colors, print, cancellation, blur, and a second browser engine complete the critical paths. | Dated manual matrix with failures and dispositions. |
| GATE-06 | Production privacy trace | Open Before Publication | Network traces show no source, clarification, candidate, verifier finding, or output in lease, attestation, model-asset, error, or telemetry traffic. | Sanitized trace inventory from both origins and supported browsers. |

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
