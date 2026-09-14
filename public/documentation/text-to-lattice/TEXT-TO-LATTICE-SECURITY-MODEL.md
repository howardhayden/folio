---
title: Text to Lattice security model
revision: 2026-09-14
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

Threat model for the active hah.dev Text to Lattice remote capability: deliberate browser submission, same-origin API validation, fixed server-side Hugging Face and Featherless processing, bounded response handling, and application-level nonretention. Historical WebLLM, Turnstile, and lease controls are inactive and cannot satisfy this model.

Prioritize controls where consequence, realistic plausibility, and lifecycle reuse are jointly high. Preserve uncomfortable residuals: probabilistic semantic drift, external-provider processing and retention, public-endpoint abuse, output capture, supply-chain change, and the gap between source checks and production evidence.

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
| ASSET-01 | Visitor source, prompts, candidates, and results | Confidentiality, integrity, exact transmission authorization, and no application persistence. |
| ASSET-02 | Semantic obligations and outcome labels | Coverage, polarity, modality, quantity, uncertainty, ordering, accessibility, and honest withholding. |
| ASSET-03 | Named browser capability and provider credential | Exact same-origin request construction and server-only HF_TOKEN secrecy. |
| ASSET-04 | Provider budget and service availability | Bounded request, provider-call, completion, response-size, and retry behavior under public traffic. |
| ASSET-05 | Endpoint, provider, model, schema, and prompt integrity | Fixed routing and roles without user-selected targets, silent substitution, or fallback. |
| ASSET-06 | Public disclosures and release evidence | Traceability to exact source and deployed behavior without overstating privacy, accessibility, anti-abuse, or conformance. |

## Trust boundaries

| ID | Boundary | Crossing |
| --- | --- | --- |
| TB-01 | Visitor prose and browser UI | Untrusted authorized prose becomes inert local state; only an explicit external-processing action may authorize transmission. |
| TB-02 | Browser and same-origin /api/lattice | One exact POST carries text, requested_mode, and schema_version 1; the browser accepts only bounded closed success or error envelopes. |
| TB-03 | API Worker and Hugging Face router | Server-created prompts cross only to the fixed chat-completions endpoint with a server-only credential and fixed Featherless-served model roles. |
| TB-04 | Bounded request memory and persistence surfaces | Source, prompts, candidates, results, and raw provider bodies may exist transiently in request memory but have no application database, object store, cache, queue, raw-content log, or analytics sink. |
| TB-05 | Provider response and public result | Closed schemas, deterministic checks, size ceilings, and text-only rendering separate untrusted provider output from public outcome claims. |
| TB-06 | Source register and generated documentation | Escaped deterministic projections expose current claims and clearly marked historical evidence but no visitor content, secrets, or private profile inventory. |

## Threat register

| ID | Threat | Marginal value | As-built posture | Pre-publication work | Residual boundary |
| --- | --- | --- | --- | --- | --- |
| SEC-01 | Content is transmitted without valid authorization or to an undeclared destination | High | The browser capability is fixed to same-origin POST /api/lattice and constructs exactly text, requested_mode, and schema_version 1. Open, edit, validation failure, pre-submit dismissal, and cancellation create no transformation request; terminal failures do not automatically retry. The Worker alone calls the fixed Hugging Face endpoint and fixed Featherless-served model identifiers. | Verify zero network requests before explicit submission on the exact deployed artifact. Capture one successful deployed request and confirm the browser contacts only same-origin /api/lattice while Worker egress remains fixed. | The authorized request necessarily transmits content to Hugging Face, Featherless AI, and their infrastructure. Browser extensions, security software, DNS, networks, and provider infrastructure remain outside hah.dev control. |
| SEC-02 | Hostile prose or provider output acquires authority or execution | High | Complete Unicode and structural preflight occurs before the provider pipeline. System instructions are separated from serialized user data and provider responses must match closed size-bounded schemas. Public issue categories are host-controlled and React and documentation generators escape untrusted text. | Re-run injection, Unicode, recursive noninterference, malformed-provider-response, and documentation-escaping checks on the release artifact. Review any new renderer, logging hook, or model transport for HTML interpretation or dynamic authority. | A fixed model can still misunderstand inert data; later semantic gates contain but cannot eliminate that risk. |
| SEC-03 | Semantic drift is released as success | High | Protected spans and semantic sentinels preserve explicit high-consequence content. Fixed Qwen generation is checked by fixed Llama verification, deterministic validators, source-grounded reanalysis, bounded repair, and whole-document certification. Five outcome states prevent withheld or unresolved work from being relabeled as complete; remote clarification is disabled. | Run the full adversarial and semantic regression corpus against the exact remote release revisions. Record manual review across realistic genres without treating samples as universal proof. | No bounded corpus or fixed model pair proves equivalence for all prose. Review-required is semantically releasable but explicitly not complete bounded clearance. |
| SEC-04 | Input or remote inference exhausts bounded resources | High | Word, code-unit, request-byte, passage, work-group, completion, provider-output, response-size, and repair ceilings are explicit. The browser and Worker use 240-second request deadlines; each provider call uses a 60-second deadline. Rate limits and terminal failures expose bounded machine errors and optional bounded Retry-After without automatic retry. | Probe every documented size and timing boundary on the exact deployed API. Measure provider spend and concurrency under bounded realistic load before claiming availability. | A public endpoint can still consume finite provider budget or be unavailable. Provider queues and infrastructure behavior remain outside application control. |
| SEC-05 | Endpoint, provider, model, schema, or dependency identity drifts | High | The adapter fixes https://router.huggingface.co/v1/chat/completions, Qwen/Qwen3-4B:featherless-ai generation, and meta-llama/Llama-3.2-3B-Instruct:featherless-ai verification. User content cannot determine a URL, provider, model, header, or credential, and no provider or model fallback exists. Closed schemas and deterministic host validation bind public outcomes. | Verify the exact deployed configuration and live response model boundary without exposing HF_TOKEN or raw content. Requalify endpoint, provider, model identifier, schema, prompt, dependency, terms, or material serving-behavior changes. | Provider-managed serving is not byte-equivalent to the historical MLC artifacts and no such claim is made. A fixed hosted identifier does not prove immutable weights, tokenizer bytes, infrastructure, or serving implementation. |
| SEC-06 | Method, path, origin, query, media type, or schema is confused | High | The API accepts only same-origin POST /api/lattice with JSON and an exact closed body. Origin, path, query, method, content length, media type, word count, mode, version, and keys fail closed before provider use. Success and error envelopes are exact, bounded, and no-store. | Exercise forbidden origins, alternate paths and methods, queries, missing and extra fields, modes, versions, 700 and 701 words, malformed JSON, oversized bodies, and media types against deployment. Confirm rejected probes create no provider call. | Origin checking is not authentication or complete anti-abuse protection. Infrastructure before the Worker may still process ordinary connection metadata. |
| SEC-07 | Application storage, logging, caching, queues, or analytics retain content | High | The API configuration defines no application database, object storage, cache, or queue for content. The Worker and adapter do not emit raw-content logs or analytics and return Cache-Control: no-store. The browser excludes /api/lattice from service-worker or cache interception under the named capability contract. | Inspect deployed bindings, log and analytics configuration, browser-shaped responses, service-worker behavior, and edge injection. Run a sanitized trace and log review using unique non-sensitive markers without claiming control of provider retention. | Hugging Face, Featherless AI, and their infrastructure handle content and connection metadata under their own policies. No application-retention statement proves deletion or retention behavior inside an external provider. |
| SEC-08 | Automated or distributed traffic exhausts provider capacity | High | Input, time, completion, and response ceilings cap per-request work. Rate-limited responses are closed, bounded, and require a new deliberate browser submission. Static semantic documentation does not depend on provider availability. | Document and probe deployed rate and concurrency controls and provider budget alarms. Do not claim anti-bot or guaranteed availability without corresponding deployed evidence. | Distributed callers can still consume finite provider capacity. Origin enforcement and per-location shaping do not establish human use or a global invocation ceiling. |
| SEC-09 | Generated output is captured despite interface friction | Moderate | Selection, copy, context menu, print, drag, and common save gestures are deterred on the result surface. The UI and public documentation say that browser controls cannot prevent determined capture. | Keep the residual visible and retest keyboard and assistive-technology access after interaction changes. Do not add extraction instructions to the interface or claim capture prevention. | Screenshots, cameras, privileged extensions, developer tools, and memory access remain possible. A visitor can always manually reproduce visible content. |
| SEC-10 | Source, deployment, register, generated documentation, or public copy drifts | High | The atlas is the documentation source of truth and generated files carry deterministic digests. The release register projects exact gate records and the verifier fails closed on source, artifact, route, and deployment mismatch. Historical browser-local evidence is retained under explicitly inactive records and cannot satisfy the remote gates. | Regenerate documentation only after the release register contains the exact current remote gate projection. Qualify and deploy the exact source revision, then capture remote production evidence before activation. | Repository checks do not prove which bytes or secrets are deployed. A provider can change behavior without a repository diff. |
| SEC-11 | Prohibited or unsupported use is materially furthered | High | The interface requires authorization and warns against classified, controlled, privileged, export-controlled, operationally sensitive, or otherwise restricted information. The prompt and result pipeline preserves purpose-and-consequence use checks and can withhold a transformation. Llama license and acceptable-use evidence remain separately tracked from provider serving and model provenance. | Re-run the non-operational use evaluation corpus and confirm public disclosure and withholding behavior. Requalify model and provider terms before any model, endpoint, purpose, or audience change. | Purpose and consequence cannot be inferred perfectly from bounded prose. Visitors remain responsible for authorization, lawfulness, and downstream use. |
| SEC-12 | Disclosure minimizes external processing or overstates guarantees | High | Current public copy explicitly states that text leaves hah.dev after confirmation and names Hugging Face, Featherless AI, fixed model roles, application nonretention, external-policy limits, no automatic retry, and no fallback. The active atlas marks WebLLM, Turnstile, and lease material historical and inactive while preserving its identifiers and evidence. Provider-managed serving is expressly not represented as byte-equivalent to historical MLC artifacts. | Scan the exact public artifact for active local-inference, Turnstile, lease, download, or provider-retention claims. Manually verify that external-processing and restricted-information copy precedes the only submission action. | Concise disclosure cannot summarize every provider or infrastructure policy. Provider practices and terms can change after qualification. |

## Detailed treatment records

<details id="sec-01">
<summary><strong>SEC-01</strong> · Content is transmitted without valid authorization or to an undeclared destination — High marginal value</summary>

- **Vector:** Open, edit, validation, prefetch, cancellation, implicit submit, automatic retry, a user-controlled target, or a client-visible provider call sends content before deliberate confirmation or outside the named path.
- **Consequence:** Sensitive text leaves the browser contrary to the visitor's choice and the public disclosure.
- **Plausibility:** Ordinary UI, transport, and configuration regressions can create premature, duplicate, or misdirected requests.
- **Lifecycle value:** One named capability and one explicit-action boundary remain reusable across interface and provider revisions.
- **Classification:** Unauthorized or misdirected disclosure is high consequence, integration-plausible, and cheaply prevented by exact request construction and deployment probes.
- **Assets:** ASSET-01, ASSET-03, ASSET-05, ASSET-06
- **Boundaries:** TB-01, TB-02, TB-03
- **As built:**
  - The browser capability is fixed to same-origin POST /api/lattice and constructs exactly text, requested_mode, and schema_version 1.
  - Open, edit, validation failure, pre-submit dismissal, and cancellation create no transformation request; terminal failures do not automatically retry.
  - The Worker alone calls the fixed Hugging Face endpoint and fixed Featherless-served model identifiers.
- **Required before publication:**
  - Verify zero network requests before explicit submission on the exact deployed artifact.
  - Capture one successful deployed request and confirm the browser contacts only same-origin /api/lattice while Worker egress remains fixed.
- **Residual boundary:**
  - The authorized request necessarily transmits content to Hugging Face, Featherless AI, and their infrastructure.
  - Browser extensions, security software, DNS, networks, and provider infrastructure remain outside hah.dev control.
- **Sources:** SRC-REQUIREMENTS, SRC-PUBLIC-CONTRACT, SRC-NETWORK-CAPABILITY, SRC-REMOTE-PROTOCOL, SRC-REMOTE-CLIENT, SRC-API-WORKER, SRC-HF-ADAPTER, SRC-TEST-CAPABILITY

</details>

<details id="sec-02">
<summary><strong>SEC-02</strong> · Hostile prose or provider output acquires authority or execution — High marginal value</summary>

- **Vector:** Prompt injection, control characters, bidi abuse, HTML-like content, or provider-authored issue text becomes an instruction, executable markup, semantic authority, or generated-document markup.
- **Consequence:** The pipeline can ignore its contract, misrepresent a finding, execute injected content, or expose unsafe markup.
- **Plausibility:** Directly plausible because arbitrary prose and probabilistic provider output are intended inputs.
- **Lifecycle value:** Inert serialization, closed schemas, host-authored public fields, and text-only rendering protect future model and document revisions.
- **Classification:** The input and provider boundaries are necessarily hostile, so containment is a primary release condition.
- **Assets:** ASSET-01, ASSET-02, ASSET-06
- **Boundaries:** TB-01, TB-03, TB-05, TB-06
- **As built:**
  - Complete Unicode and structural preflight occurs before the provider pipeline.
  - System instructions are separated from serialized user data and provider responses must match closed size-bounded schemas.
  - Public issue categories are host-controlled and React and documentation generators escape untrusted text.
- **Required before publication:**
  - Re-run injection, Unicode, recursive noninterference, malformed-provider-response, and documentation-escaping checks on the release artifact.
  - Review any new renderer, logging hook, or model transport for HTML interpretation or dynamic authority.
- **Residual boundary:**
  - A fixed model can still misunderstand inert data; later semantic gates contain but cannot eliminate that risk.
- **Sources:** SRC-INPUT, SRC-PROMPTS, SRC-HF-ADAPTER, SRC-API-WORKER, SRC-DEMO, SRC-TEST-ISOLATE, SRC-TEST-API

</details>

<details id="sec-03">
<summary><strong>SEC-03</strong> · Semantic drift is released as success — High marginal value</summary>

- **Vector:** Generation drops, invents, negates, broadens, narrows, or reorders a material obligation and a correlated checker accepts the candidate.
- **Consequence:** Safety instructions, conditions, quantities, uncertainty, causality, consequences, or recovery relationships change while the interface claims success.
- **Plausibility:** Probabilistic server-side generation makes drift realistic even with structured output.
- **Lifecycle value:** A distinct verifier, deterministic sentinels, source-grounded reanalysis, and honest withholding remain useful across provider revisions.
- **Classification:** Meaning preservation is the product's central consequence; incorrect success is worse than refusal.
- **Assets:** ASSET-01, ASSET-02
- **Boundaries:** TB-01, TB-03, TB-05
- **As built:**
  - Protected spans and semantic sentinels preserve explicit high-consequence content.
  - Fixed Qwen generation is checked by fixed Llama verification, deterministic validators, source-grounded reanalysis, bounded repair, and whole-document certification.
  - Five outcome states prevent withheld or unresolved work from being relabeled as complete; remote clarification is disabled.
- **Required before publication:**
  - Run the full adversarial and semantic regression corpus against the exact remote release revisions.
  - Record manual review across realistic genres without treating samples as universal proof.
- **Residual boundary:**
  - No bounded corpus or fixed model pair proves equivalence for all prose.
  - Review-required is semantically releasable but explicitly not complete bounded clearance.
- **Sources:** SRC-PROTECTED, SRC-VALIDATORS, SRC-DEMO, SRC-HF-ADAPTER, SRC-TEST-ENGINE, SRC-TEST-API

</details>

<details id="sec-04">
<summary><strong>SEC-04</strong> · Input or remote inference exhausts bounded resources — High marginal value</summary>

- **Vector:** Pathological Unicode, oversized JSON, dense passages, excessive completions, stalled provider calls, repair loops, or oversized responses consume unbounded browser, Worker, provider, or account resources.
- **Consequence:** The interaction hangs, service capacity or provider spend is exhausted, or a response exceeds safe client handling.
- **Plausibility:** Realistic for arbitrary public input and third-party inference.
- **Lifecycle value:** Central ceilings and fail-closed deadlines bound future pipeline stages and provider revisions.
- **Classification:** Public arbitrary input and paid external work make resource exhaustion ordinary and consequential.
- **Assets:** ASSET-04, ASSET-06
- **Boundaries:** TB-01, TB-02, TB-03, TB-04
- **As built:**
  - Word, code-unit, request-byte, passage, work-group, completion, provider-output, response-size, and repair ceilings are explicit.
  - The browser and Worker use 240-second request deadlines; each provider call uses a 60-second deadline.
  - Rate limits and terminal failures expose bounded machine errors and optional bounded Retry-After without automatic retry.
- **Required before publication:**
  - Probe every documented size and timing boundary on the exact deployed API.
  - Measure provider spend and concurrency under bounded realistic load before claiming availability.
- **Residual boundary:**
  - A public endpoint can still consume finite provider budget or be unavailable.
  - Provider queues and infrastructure behavior remain outside application control.
- **Sources:** SRC-INPUT, SRC-REMOTE-CLIENT, SRC-API-WORKER, SRC-HF-ADAPTER, SRC-TEST-API

</details>

<details id="sec-05">
<summary><strong>SEC-05</strong> · Endpoint, provider, model, schema, or dependency identity drifts — High marginal value</summary>

- **Vector:** Configuration, provider routing, model aliases, schemas, prompts, dependencies, or terms change, or a failure silently switches provider or model.
- **Consequence:** Processing, semantics, privacy, cost, authorization, or evidence diverges from the reviewed release.
- **Plausibility:** Hosted model and dependency services can change independently of repository source even when identifiers are fixed.
- **Lifecycle value:** Exact endpoint and model allowlists plus requalification rules scale across upgrades and incidents.
- **Classification:** Silent substitution affects both semantic and data-processing claims; fixed targets and explicit requalification have high marginal value.
- **Assets:** ASSET-02, ASSET-05, ASSET-06
- **Boundaries:** TB-03, TB-05, TB-06
- **As built:**
  - The adapter fixes https://router.huggingface.co/v1/chat/completions, Qwen/Qwen3-4B:featherless-ai generation, and meta-llama/Llama-3.2-3B-Instruct:featherless-ai verification.
  - User content cannot determine a URL, provider, model, header, or credential, and no provider or model fallback exists.
  - Closed schemas and deterministic host validation bind public outcomes.
- **Required before publication:**
  - Verify the exact deployed configuration and live response model boundary without exposing HF_TOKEN or raw content.
  - Requalify endpoint, provider, model identifier, schema, prompt, dependency, terms, or material serving-behavior changes.
- **Residual boundary:**
  - Provider-managed serving is not byte-equivalent to the historical MLC artifacts and no such claim is made.
  - A fixed hosted identifier does not prove immutable weights, tokenizer bytes, infrastructure, or serving implementation.
- **Sources:** SRC-HF-ADAPTER, SRC-API-WORKER, SRC-API-CONFIG, SRC-HF-CHAT, SRC-HF-FEATHERLESS, SRC-RELEASE-REGISTER

</details>

<details id="sec-06">
<summary><strong>SEC-06</strong> · Method, path, origin, query, media type, or schema is confused — High marginal value</summary>

- **Vector:** Cross-origin callers, alternate methods or paths, query smuggling, permissive content types, duplicate or extra fields, unsupported modes or versions, or malformed bodies reach provider work.
- **Consequence:** Attackers bypass the public contract, trigger unreviewed behavior, consume budget, or cause content to be processed under false assumptions.
- **Plausibility:** Routine for a public HTTP endpoint and easy to automate.
- **Lifecycle value:** One fail-closed HTTP envelope remains reusable regardless of provider implementation.
- **Classification:** The probes are low-cost and directly protect privacy, cost, and protocol integrity.
- **Assets:** ASSET-01, ASSET-03, ASSET-04, ASSET-05
- **Boundaries:** TB-02, TB-03
- **As built:**
  - The API accepts only same-origin POST /api/lattice with JSON and an exact closed body.
  - Origin, path, query, method, content length, media type, word count, mode, version, and keys fail closed before provider use.
  - Success and error envelopes are exact, bounded, and no-store.
- **Required before publication:**
  - Exercise forbidden origins, alternate paths and methods, queries, missing and extra fields, modes, versions, 700 and 701 words, malformed JSON, oversized bodies, and media types against deployment.
  - Confirm rejected probes create no provider call.
- **Residual boundary:**
  - Origin checking is not authentication or complete anti-abuse protection.
  - Infrastructure before the Worker may still process ordinary connection metadata.
- **Sources:** SRC-REMOTE-PROTOCOL, SRC-REMOTE-CLIENT, SRC-API-WORKER, SRC-TEST-CAPABILITY, SRC-TEST-API

</details>

<details id="sec-07">
<summary><strong>SEC-07</strong> · Application storage, logging, caching, queues, or analytics retain content — High marginal value</summary>

- **Vector:** A database binding, object store, cache, service worker, raw request or provider log, exception report, background queue, analytics event, or edge transformation captures content.
- **Consequence:** Source or derived text persists beyond the request and contradicts the application no-retention claim.
- **Plausibility:** Telemetry and convenience logging are ordinary service-development regressions.
- **Lifecycle value:** A sink inventory, no-store policy, and content-free observability rule protect every future endpoint revision.
- **Classification:** Persistence is high consequence and preventable within the application boundary, while external-provider behavior must remain a disclosed limitation.
- **Assets:** ASSET-01, ASSET-06
- **Boundaries:** TB-02, TB-04, TB-06
- **As built:**
  - The API configuration defines no application database, object storage, cache, or queue for content.
  - The Worker and adapter do not emit raw-content logs or analytics and return Cache-Control: no-store.
  - The browser excludes /api/lattice from service-worker or cache interception under the named capability contract.
- **Required before publication:**
  - Inspect deployed bindings, log and analytics configuration, browser-shaped responses, service-worker behavior, and edge injection.
  - Run a sanitized trace and log review using unique non-sensitive markers without claiming control of provider retention.
- **Residual boundary:**
  - Hugging Face, Featherless AI, and their infrastructure handle content and connection metadata under their own policies.
  - No application-retention statement proves deletion or retention behavior inside an external provider.
- **Sources:** SRC-PUBLIC-CONTRACT, SRC-NETWORK-CAPABILITY, SRC-REMOTE-CLIENT, SRC-API-WORKER, SRC-API-CONFIG, SRC-HF-SECURITY, SRC-TEST-GOVERNANCE, SRC-TEST-API

</details>

<details id="sec-08">
<summary><strong>SEC-08</strong> · Automated or distributed traffic exhausts provider capacity — High marginal value</summary>

- **Vector:** One or many public callers repeatedly invoke valid requests, distribute traffic, or force high-cost bounded inputs before rate controls take effect.
- **Consequence:** Legitimate visitors lose access or provider spend exceeds the intended demonstration budget.
- **Plausibility:** A public unauthenticated endpoint is discoverable and automatable.
- **Lifecycle value:** Honest availability claims, measurable quotas, provider alarms, and rapid held rollback remain valuable across capacity plans.
- **Classification:** The path is easy and consequential, but it can be bounded as an availability and cost residual for a clearly labeled portfolio demonstration.
- **Assets:** ASSET-04, ASSET-06
- **Boundaries:** TB-02, TB-03
- **As built:**
  - Input, time, completion, and response ceilings cap per-request work.
  - Rate-limited responses are closed, bounded, and require a new deliberate browser submission.
  - Static semantic documentation does not depend on provider availability.
- **Required before publication:**
  - Document and probe deployed rate and concurrency controls and provider budget alarms.
  - Do not claim anti-bot or guaranteed availability without corresponding deployed evidence.
- **Residual boundary:**
  - Distributed callers can still consume finite provider capacity.
  - Origin enforcement and per-location shaping do not establish human use or a global invocation ceiling.
- **Sources:** SRC-API-WORKER, SRC-HF-ADAPTER, SRC-PUBLIC-CONTRACT, SRC-TEST-API

</details>

<details id="sec-09">
<summary><strong>SEC-09</strong> · Generated output is captured despite interface friction — Moderate marginal value</summary>

- **Vector:** Selection APIs, clipboard events, printing, page capture, browser extensions, developer tools, accessibility APIs, operating-system screenshots, cameras, or memory inspection obtain result text.
- **Consequence:** A visitor or third party retains output despite deterrent treatment, and an overstated claim misleads users about control.
- **Plausibility:** Browser event controls can block routine gestures but cannot control privileged or out-of-band capture.
- **Lifecycle value:** An explicit deterrence-only boundary remains truthful as browsers evolve.
- **Classification:** Ordinary extraction friction has value, while stronger prevention claims would be false and harmful to accessibility.
- **Assets:** ASSET-01, ASSET-06
- **Boundaries:** TB-01, TB-05
- **As built:**
  - Selection, copy, context menu, print, drag, and common save gestures are deterred on the result surface.
  - The UI and public documentation say that browser controls cannot prevent determined capture.
- **Required before publication:**
  - Keep the residual visible and retest keyboard and assistive-technology access after interaction changes.
  - Do not add extraction instructions to the interface or claim capture prevention.
- **Residual boundary:**
  - Screenshots, cameras, privileged extensions, developer tools, and memory access remain possible.
  - A visitor can always manually reproduce visible content.
- **Sources:** SRC-OUTPUT, SRC-PUBLIC-CONTRACT, SRC-TEST-SECURITY, SRC-TEST-A11Y

</details>

<details id="sec-10">
<summary><strong>SEC-10</strong> · Source, deployment, register, generated documentation, or public copy drifts — High marginal value</summary>

- **Vector:** A source change, deployment, secret, route, provider configuration, public disclosure, release projection, or generated artifact changes independently.
- **Consequence:** The public site makes stale privacy or capability claims, exposes a broken endpoint, or activates a revision that was not qualified.
- **Plausibility:** Multi-artifact release systems routinely drift without machine-bound projections and exact deployment evidence.
- **Lifecycle value:** Deterministic generation and exact-revision gates protect every later release.
- **Classification:** The architecture migration makes stale browser-local documentation an immediate material risk.
- **Assets:** ASSET-03, ASSET-05, ASSET-06
- **Boundaries:** TB-02, TB-03, TB-06
- **As built:**
  - The atlas is the documentation source of truth and generated files carry deterministic digests.
  - The release register projects exact gate records and the verifier fails closed on source, artifact, route, and deployment mismatch.
  - Historical browser-local evidence is retained under explicitly inactive records and cannot satisfy the remote gates.
- **Required before publication:**
  - Regenerate documentation only after the release register contains the exact current remote gate projection.
  - Qualify and deploy the exact source revision, then capture remote production evidence before activation.
- **Residual boundary:**
  - Repository checks do not prove which bytes or secrets are deployed.
  - A provider can change behavior without a repository diff.
- **Sources:** SRC-RELEASE-REGISTER, SRC-RELEASE-QUALIFICATION, SRC-REQUIREMENTS, SRC-PUBLIC-CONTRACT, SRC-ROUTE-INVENTORY

</details>

<details id="sec-11">
<summary><strong>SEC-11</strong> · Prohibited or unsupported use is materially furthered — High marginal value</summary>

- **Vector:** A visitor submits unlawful, unauthorized, restricted, unsupported-language, or provider-policy-prohibited material, or the transformation materially furthers prohibited conduct.
- **Consequence:** The service or model use violates rights, license or provider terms, or materially assists harmful conduct.
- **Plausibility:** Plausible for any public prose transformation endpoint; keyword-only screening would be both overbroad and underinclusive.
- **Lifecycle value:** Purpose-and-consequence controls, visitor authorization, and provider-policy requalification remain reusable across model revisions.
- **Classification:** Consequences can be severe and the service is public, so fail-closed use boundaries have high marginal value.
- **Assets:** ASSET-02, ASSET-05, ASSET-06
- **Boundaries:** TB-01, TB-03, TB-05
- **As built:**
  - The interface requires authorization and warns against classified, controlled, privileged, export-controlled, operationally sensitive, or otherwise restricted information.
  - The prompt and result pipeline preserves purpose-and-consequence use checks and can withhold a transformation.
  - Llama license and acceptable-use evidence remain separately tracked from provider serving and model provenance.
- **Required before publication:**
  - Re-run the non-operational use evaluation corpus and confirm public disclosure and withholding behavior.
  - Requalify model and provider terms before any model, endpoint, purpose, or audience change.
- **Residual boundary:**
  - Purpose and consequence cannot be inferred perfectly from bounded prose.
  - Visitors remain responsible for authorization, lawfulness, and downstream use.
- **Sources:** SRC-REQUIREMENTS, SRC-PUBLIC-CONTRACT, SRC-LLAMA-LICENSE, SRC-LLAMA-AUP, SRC-LLAMA-EVAL, SRC-HF-SECURITY

</details>

<details id="sec-12">
<summary><strong>SEC-12</strong> · Disclosure minimizes external processing or overstates guarantees — High marginal value</summary>

- **Vector:** Public copy calls the active path local, implies that hah.dev's no-retention rule governs providers, implies byte-equivalence with historical MLC artifacts, promises privacy or availability, or hides the need for deliberate submission.
- **Consequence:** Visitors make decisions using materially false privacy, provenance, or service claims.
- **Plausibility:** Highly plausible during a migration when older documentation and evidence remain present.
- **Lifecycle value:** A concise shared disclosure contract and historical-state marker prevent regressions across UI, documentation, and release records.
- **Classification:** False privacy framing directly defeats meaningful authorization and is especially likely while historical local records remain auditable.
- **Assets:** ASSET-01, ASSET-05, ASSET-06
- **Boundaries:** TB-01, TB-03, TB-04, TB-06
- **As built:**
  - Current public copy explicitly states that text leaves hah.dev after confirmation and names Hugging Face, Featherless AI, fixed model roles, application nonretention, external-policy limits, no automatic retry, and no fallback.
  - The active atlas marks WebLLM, Turnstile, and lease material historical and inactive while preserving its identifiers and evidence.
  - Provider-managed serving is expressly not represented as byte-equivalent to historical MLC artifacts.
- **Required before publication:**
  - Scan the exact public artifact for active local-inference, Turnstile, lease, download, or provider-retention claims.
  - Manually verify that external-processing and restricted-information copy precedes the only submission action.
- **Residual boundary:**
  - Concise disclosure cannot summarize every provider or infrastructure policy.
  - Provider practices and terms can change after qualification.
- **Sources:** SRC-REQUIREMENTS, SRC-PUBLIC-CONTRACT, SRC-HF-SECURITY, SRC-RELEASE-QUALIFICATION

</details>

## Release qualification gates

Only `open-release-blocker` prevents activation. `satisfied-in-source` records repository evidence; `satisfied-in-production` records current observed live evidence for the permitted production gates; `historical-inactive` preserves non-authorizing evidence for a superseded architecture. Every other status preserves its distinct evidence boundary, safeguards, and follow-up.
The public client remains held and documentation-only. GATE-06 has source and test evidence for the explicit-submit, exact same-origin POST /api/lattice, fixed server targets, bounded response, cancellation, no-retry, no-fallback, and application nonretention contracts, but no remote production evidence or successful canonical-browser remote transformation. Historical WebLLM, Turnstile, lease, and two-origin traces remain preserved as inactive evidence for their own deployed revisions and cannot satisfy the current gate.

| ID | Gate | Status | Marginal value | Requirement | Current active evidence | Evidence needed |
| --- | --- | --- | --- | --- | --- | --- |
| GATE-01 | Exact release artifact | Release Workflow Enforced | High | Every publication candidate runs build, lint, type-check, full tests, documentation drift checks, release-boundary checks, static-route checks, generated-artifact inspection, and current-main freshness checks from the exact release tree. | The Pages workflow fail-closes around its current-main identity checks, runs the release validator before upload, and uses pinned actions. The qualified source-set digest binds the activation, runtime, validator, complete test tree, license-routing map, shipped legal notices, and workflow sources without hashing this register. | The workflow run and deployment record for each release remain operational evidence; the source status means the control is mandatory, not that a future run has already occurred. |
| GATE-02 | Remote API origin, secret, and privacy boundary | Open Release Blocker | High | Before public activation, the deployed hah.dev origin must expose exactly one same-origin POST /api/lattice capability with schema version 1 and only text, requested_mode, and schema_version; the API Worker must use the encrypted HF_TOKEN binding by name, the fixed Hugging Face router and Featherless-qualified Qwen and Llama targets, bounded non-reflective errors, Cache-Control: no-store, no application content storage or logging, no automatic retry, no alternate provider or model fallback, and a Content-Security-Policy whose connect-src is 'self'. | Source and tests define the exact remote capability, API Worker, fixed provider adapter, secret-binding name, bounded request and response policies, no-store behavior, and restrictive browser connection boundary. No retained production run, deployed API Worker version, live route inventory, or encrypted-binding inventory proves those controls at hah.dev. | Deploy the API and response-policy Workers from one reviewed commit; retain the workflow run, deployed commit, API and response-policy Worker versions, exact hah.dev/api/lattice and document-route inventory, and an encrypted binding-name inventory that proves HF_TOKEN exists without reading its value. Live probes must reject the wrong path, method, origin, media type, additional or missing fields, invalid mode, invalid schema version, cookies, credentials, and oversized input; prove bounded non-reflective JSON errors and no-store responses; prove connect-src 'self'; and confirm the Worker uses only the fixed router and model targets. This server evidence does not substitute for the canonical-browser lifecycle and content trace in GATE-06. |
| GATE-03 | Remote provider capacity and cost boundary | Open Release Blocker | High | The deployed API must fail closed within its request and provider-call limits, apply the configured path-scoped rate limiter before model work, bound per-call time and response size, expose no paid or generic proxy path, and document provider rate, retention, availability, and cost boundaries without promising availability. | Source bounds each provider call to 60 seconds, caps a transformation at 32 provider calls, bounds provider response bytes and characters, configures a path-scoped Worker rate limiter, disables observability, and exposes no provider-selection parameter. The provider quota, effective production limiter, latency, cost, and abuse behavior have not been observed for a deployed remote candidate. | After a reviewed deployment, verify the configured limiter is bound and fail-closed before model work; record bounded production-representative request, provider-call, timeout, rate-limit, malformed-response, latency, and cost behavior; confirm no generic proxy or paid fallback path; and record external provider retention and availability as unguaranteed. Retain observed abuse or cost drift as a requalification trigger. |
| GATE-04A | Llama behavior and public-use controls | Accepted Residual Risk | Moderate | The public flow discloses model assistance and known limitations, obtains a source-specific lawful-and-authorized-use confirmation, defines prohibited-use safety by purpose and consequence, withholds any safety-failing candidate, and tests realistic harmful and legitimate-context cases. | The checked-in terms and attribution match the reviewed official files. Source implements point-of-use disclosure, resettable source-specific confirmation, purpose-and-consequence safety, and candidate suppression, with deterministic regressions and a balanced ten-case non-operational fixture. This environment does not contain a recorded execution and manual review of that fixture against the exact verifier artifact. | When the exact runtime is available, execute the checked-in cases and record false-positive and false-negative dispositions; treat any consequential safety-release failure as a release regression. |
| GATE-04B | Historical inactive Llama MLC-artifact provenance | Historical Inactive | Moderate | The exact MLC-converted Llama artifact has a recorded source, conversion, license, integrity, and notice chain rather than relying only on the base-model terms and repository revision. | Historical inactive — The verifier repository and revision are pinned and the controlling base-model terms are present; the MLC artifact repository does not provide a complete conversion and artifact-license record. | Publisher provenance or a maintainable independently documented conversion would narrow the residual; preserve exact repository, revision, integrity, terms, and attribution bindings meanwhile. |
| GATE-04C | Historical inactive WASM provenance and license boundary | Historical Inactive | Moderate | The exact Qwen and Llama WebGPU WASM identities, available lineage, compatibility evidence, integrity controls, and unresolved reproducibility and notice boundary are recorded without overstating source equivalence. | Historical inactive — Exact bytes, digests, git blobs, repository revision, initial and final artifact commits, introducing pull request, and recorded TVM and MLC-LLM source revisions are recorded. The final artifact rewrite postdates the recorded TVM revision and its configuration metadata is consistent with the recorded MLC source, which supports plausibility but not provenance. The binary repository has no root license at the reviewed revision; the historical helper is workstation-specific, calls a Qwen preset absent from the recorded MLC revision, leaves Python and Cargo inputs unlocked, and has no matching independent rebuild. | Upstream artifact-level license and build attestation, or a maintainable project-controlled replacement with its own provenance and notices, would narrow the residual. Reproducing an undocumented historical workstation build byte for byte is not required. |
| GATE-05 | Manual interaction and accessibility | Accepted Residual Risk | Moderate | Keyboard, screen reader, touch, 400 percent zoom, reduced motion, forced colors, print, cancellation, blur, and a second browser engine complete the critical paths. | Automated interaction, accessibility, rendering, and browser-path checks cover dialog focus, dismissal, blur, cancellation, reduced motion, forced colors, print, responsive layout, and no-JS navigation. A complete dated assistive-technology matrix for the eventual deployed artifact is not recorded here. | Record a representative dated keyboard, screen-reader, touch, 400 percent zoom, reduced-motion, forced-colors, print, cancellation, blur, and second-engine matrix when the interactive deployment exists. |
| GATE-06 | Remote production lifecycle and privacy trace | Open Release Blocker | High | From the activated canonical page in each supported browser engine, one explicit confirmed submission must produce exactly one same-origin POST /api/lattice request with only text, requested_mode, and schema_version 1, reach one non-error terminal result (translated, conformant-for-context, or review-required), and expose no provider origin, credential, automatic retry, service-worker replay, or additional content-bearing browser request. A sanitized trace must distinguish the intentionally transmitted request body from prohibited source or result reflection in URLs, headers, errors, logs, caches, analytics, and unrelated traffic. | Source and adversarial tests prove the explicit-submit call path, exact same-origin request, fixed server targets, bounded cancellation and response parsing, held import boundary, and application no-retention policy. No canonical production browser capture or non-error remote transformation is recorded for the candidate. | After GATE-02 and GATE-03 close and the public client is deliberately activated, retain timestamped sanitized captures from the canonical page in the supported browser engines and bind them to one deployed commit and workflow run. Each trace must show one explicit confirmation, exactly one content-bearing same-origin POST /api/lattice with the exact three-field versioned JSON body, a non-error terminal conversion, no provider-origin browser request, no credential, no automatic retry or fallback, no service-worker or cache replay, and no source or result in URLs, headers, bounded error bodies, analytics, unrelated requests, or retained application state. Provider processing of the submitted body must be acknowledged rather than misreported as browser-local privacy. |

### GATE-01 · Exact release artifact

- **Rationale:** A stale or substituted artifact can bypass every reviewed control. Enforcing one reusable release workflow has high consequence reduction and lifecycle value.
- **Current evidence:** The Pages workflow fail-closes around its current-main identity checks, runs the release validator before upload, and uses pinned actions. The qualified source-set digest binds the activation, runtime, validator, complete test tree, license-routing map, shipped legal notices, and workflow sources without hashing this register.
- **Evidence record:** .github/workflows/pages.yml; scripts/verify-current-main-sha.mjs; scripts/verify-text-to-lattice-release.mjs; authority.qualifiedSourceSet
- **Safeguards:** current-main checks fail closed at publication boundaries; the release decision is machine-checked against the exact source set; deployment actions are immutable-revision pinned
- **Follow-up:** Retain the workflow run, deployed commit, and artifact identity for each publication and requalify after any named-source change.

### GATE-02 · Remote API origin, secret, and privacy boundary

- **Rationale:** Raw visitor text leaves the browser at this boundary and a server credential authorizes external model calls. Route, schema, destination, logging, caching, and error-policy drift therefore have high privacy and cost consequences. Source controls are necessary but cannot establish the deployed route, binding, edge response, or provider behavior.
- **Current active evidence:** Source and tests define the exact remote capability, API Worker, fixed provider adapter, secret-binding name, bounded request and response policies, no-store behavior, and restrictive browser connection boundary. No retained production run, deployed API Worker version, live route inventory, or encrypted-binding inventory proves those controls at hah.dev.
- **Active evidence record:** app/privacy/networkCapabilities.js; app/resume/lattice/remoteProtocol.js; app/resume/lattice/remoteRequest.js; workers/text-to-lattice-api/worker.js; workers/text-to-lattice-api/huggingFaceAdapter.js; workers/text-to-lattice-api/wrangler.jsonc; workers/text-to-lattice-response-policy/worker.js; tests/lattice-network-capability.test.mjs; tests/lattice-network-governance.test.mjs; tests/lattice-api-worker.test.mjs
- **Historical inactive classification:** The two named fields are retained verbatim for their deployed revisions and do not satisfy the active remote API requirement.
- **Historical inactive architecture:** browser-local WebLLM with Turnstile attestation and lease lifecycle
- **Historical inactive current evidence (verbatim):** The canonical run URL is https://github.com/howardhayden/folio/actions/runs/34320931448; service job 102367490246; commit a9b1db818dc7bb87b5bee16d0e168bf17d130185; live verification at 2026-09-09T06:52:40.6740509Z; and current-main postcheck at 2026-09-09T06:52:41.0031258Z. The successful job deployed response-policy Worker version 06e29e21-bbba-48d7-9fe3-28e8a960a88f, verification-frame Worker version 8c7d9e11-f6b8-40b2-9b5d-b9e2af082271, and lease Worker version 1a18b449-2341-449b-96e1-f27451efd483. The exact route inventory covered hah.dev/, hah.dev/index.html, hah.dev/resume/, hah.dev/resume/index.html, verify.hah.dev, and hah.dev/api/text-to-lattice/lease, with no missing, extra, or stale owned routes; the job verified frame bytes and isolation headers, main-page response policies, and the four encrypted binding-name inventory without reading values. Its fail-closed probes covered method, cross-origin, cookie, missing-attestation, and invalid-attestation behavior, including first-visitor and returning-visitor flows. The exact official dummy-token lifecycle returned HTTP 200 acquisition and authenticated bodyless HTTP 204 release. The direct dummy-token lifecycle establishes only the deployed Siteverify, lease, and release path; it is not evidence that the frame or widget participated or that canonical-browser GATE-06 passed, and it does not establish human verification or production anti-bot assurance. This retained production record predates the replacement source candidate's negotiated typed HTTP 200 challenge and does not establish that new protocol; the checked-in workflow must deploy and live-verify its typed HTTP 200 path plus legacy HTTP 428 overlap compatibility before publishing the new Pages client.
- **Historical inactive evidence record (verbatim):** https://github.com/howardhayden/folio/actions/runs/34320931448; service job 102367490246; commit a9b1db818dc7bb87b5bee16d0e168bf17d130185; live verification at 2026-09-09T06:52:40.6740509Z; current-main postcheck at 2026-09-09T06:52:41.0031258Z; response-policy Worker version 06e29e21-bbba-48d7-9fe3-28e8a960a88f; verification-frame Worker version 8c7d9e11-f6b8-40b2-9b5d-b9e2af082271; lease Worker version 1a18b449-2341-449b-96e1-f27451efd483; exact route inventory for hah.dev/, hah.dev/index.html, hah.dev/resume/, hah.dev/resume/index.html, verify.hah.dev, and hah.dev/api/text-to-lattice/lease, including absence of missing, extra, or stale owned routes; live frame byte and isolation-header verification, main-page response policies, and four encrypted binding-name inventory without reading values; fail-closed probes for method, cross-origin, cookie, missing-attestation, and invalid-attestation behavior, including first-visitor and returning-visitor flows; exact official dummy-token lifecycle returned HTTP 200 acquisition and authenticated bodyless HTTP 204 release; direct dummy-token lifecycle establishes only the deployed Siteverify, lease, and release path; it is not evidence that the frame or widget participated or that canonical-browser GATE-06 passed; workers/text-to-lattice-response-policy/worker.js; scripts/bootstrap-text-to-lattice-secrets.mjs; scripts/verify-text-to-lattice-route-inventory.mjs; replacement source controls awaiting deployment: workers/text-to-lattice-lease/worker.js and app/resume/lattice/usageLease.js negotiated typed challenge protocol; replacement source control awaiting deployment: scripts/verify-text-to-lattice-services.mjs typed HTTP 200 and legacy HTTP 428 compatibility probes; Cloudflare official Turnstile testing-key documentation
- **Safeguards:** the public client and submission code remain absent from the held Pages artifact; the browser declares one same-origin content-bearing capability and connect-src 'self'; the API Worker accepts one exact path, method, media type, field set, mode vocabulary, and schema version; only the server reads the HF_TOKEN encrypted binding and provider origins never enter the browser executable graph; provider and public responses are bounded, non-reflective, and no-store, with no application content logs or persistence; automatic retry and alternate provider or model fallback remain disabled
- **Follow-up:** Keep the client held until one exact production deployment closes this gate. Repeat the route, header, binding-name, fixed-destination, failure-policy, CSP, no-store, and non-retention review after any consequential API, provider, model, response-policy, logging, cache, schema, or workflow change.
- **Rollback condition:** Keep or return the public client to held documentation-only publication if the route, encrypted HF_TOKEN binding name, fixed provider or model target, exact request schema, no-store response, non-reflective error, no-retention boundary, restrictive CSP, or live fail-closed probe is absent or materially drifts.

### GATE-03 · Remote provider capacity and cost boundary

- **Rationale:** A public content-bearing endpoint can multiply model calls and cost even when application storage is absent. The source limits are strong but a missing production binding, provider quota mismatch, or generic escape path would be consequential. This gate stays open until the deployed boundary is observed.
- **Current active evidence:** Source bounds each provider call to 60 seconds, caps a transformation at 32 provider calls, bounds provider response bytes and characters, configures a path-scoped Worker rate limiter, disables observability, and exposes no provider-selection parameter. The provider quota, effective production limiter, latency, cost, and abuse behavior have not been observed for a deployed remote candidate.
- **Active evidence record:** workers/text-to-lattice-api/huggingFaceAdapter.js; workers/text-to-lattice-api/worker.js; workers/text-to-lattice-api/wrangler.jsonc; tests/lattice-api-worker.test.mjs; tests/lattice-network-governance.test.mjs
- **Historical inactive classification:** The two named fields are retained verbatim as historical capacity analysis and do not establish the remote provider boundary.
- **Historical inactive architecture:** Durable Object lease admission and public Turnstile testing profile
- **Historical inactive current evidence (verbatim):** Deterministic source contracts bound per-visitor and global admission, lease lifetime, retry behavior, row lifecycle, and fail-closed provider errors. Under the public reusable testing token, however, one client can use the permitted 16-request acquisition sequence to fill all eight slots and renew them; the 48-per-10-second per-IP rule does not stop that sequence. The controls bound cost, state, and privacy consequence, not tool availability, and source cannot establish live provider capacity.
- **Historical inactive evidence record (verbatim):** workers/text-to-lattice-lease/policy.js; workers/text-to-lattice-lease/usageStorage.js; workers/text-to-lattice-lease/retryPolicy.js; tests/lattice-protocol-capacity.test.mjs
- **Safeguards:** the API route has a path-scoped rate-limiter binding; provider calls, response bytes, response characters, and total stage count are bounded; provider timeouts and malformed responses fail closed without reflection; there is no browser retry, alternate provider fallback, model fallback, or generic proxy parameter; the public copy promises no availability and identifies provider retention as external
- **Follow-up:** Keep the public client held until the production limiter and provider behavior are observed. Re-run bounded capacity and cost checks after provider, model, quota, limiter, timeout, stage-count, or response-size changes.
- **Rollback condition:** Keep or return the public client to held documentation-only publication if the production limiter is absent or fails open, provider work exceeds the recorded bounds, an alternate or generic proxy path appears, or observed latency, abuse, or cost behavior makes the published boundary materially false.

### GATE-04A · Llama behavior and public-use controls

- **Rationale:** The public-use controls address realistic misuse and misunderstanding. Exact provider-served model fixture execution would improve empirical confidence; a verifier false negative remains unobserved and candidate withholding depends on the verifier's classification. Source-specific confirmation, error and explicit-denial withholding, a fixed tool-free server pipeline, and mandatory human review bound the official product surface without proving classifier behavior.
- **Current evidence:** The checked-in terms and attribution match the reviewed official files. Source implements point-of-use disclosure, resettable source-specific confirmation, purpose-and-consequence safety, and candidate suppression, with deterministic regressions and a balanced ten-case non-operational fixture. This environment does not contain a recorded execution and manual review of that fixture against the exact verifier artifact.
- **Evidence record:** LICENSES/Llama-3.2-Community-License.txt; LICENSES/Llama-3.2-Acceptable-Use-Policy.md; docs/text-to-lattice/LLAMA-USE-EVALUATION-CASES.json; app/resume/lattice/usagePolicy.js; tests/lattice-usage-policy.test.mjs
- **Safeguards:** an explicit safety-failing verifier result never releases a candidate; the confirmation resets when source text changes; disclosure states that model output can be unsafe or semantically wrong and requires human review
- **Follow-up:** Run and review the exact-model fixture when bounded runtime access is available; re-open the gate if observed behavior defeats candidate withholding or the published use boundary.
- **Acceptance basis:** The missing execution is a moderate empirical gap, and false-negative behavior is explicitly unobserved. The candidate uses a fixed tool-free server-side text transformation with source-specific user confirmation and mandatory human review; errors and explicit denials withhold output. This accepted source-level residual does not override the open deployment, capacity, or lifecycle gates.

### GATE-04B · Historical inactive Llama MLC-artifact provenance

- **Rationale:** A substituted verifier artifact would be consequential, so immutable identity and controlling terms remain mandatory. The missing publisher conversion narrative is a real but moderate custody gap after those controls, not a demonstrated incompatible or malicious artifact.
- **Historical inactive current evidence:** The verifier repository and revision are pinned and the controlling base-model terms are present; the MLC artifact repository does not provide a complete conversion and artifact-license record.
- **Historical inactive evidence record:** immutable verifier repository revision 1e80abf71e3d17cd564e2d2b63caa15cb226018e; reviewed Llama 3.2 terms and acceptable-use files; pinned tokenizer digest and WebLLM model contract
- **Safeguards:** model identifiers, revisions, and URLs plus tokenizer digests are machine-bound; runtime downloads are restricted to the pinned artifact paths; Built with Llama attribution and controlling terms remain published
- **Follow-up:** Accept publisher provenance if it becomes available or qualify a maintainable controlled conversion; re-open on any artifact, terms, or integrity drift.
- **Acceptance basis:** The exact artifact identity and base-model terms are known, but hashes do not establish the converted artifact's own authorization or notice custody; that gap remains explicitly accepted for this bounded browser-local demonstrator, which retrieves the immutable publisher-hosted artifact rather than redistributing its shards from hah.dev. Preserving pins, attribution, and requalification triggers has better lifecycle value than an indefinite block on an unavailable publisher narrative.

### GATE-04C · Historical inactive WASM provenance and license boundary

- **Rationale:** Opaque executable bytes make identity and lineage consequential. Exact SHA-256, SRI, git-blob, repository, revision, ABI, and configuration bindings materially reduce substitution and compatibility risk; pursuing theoretical reconstruction of every unavailable historical input would add substantial complexity without a plausible proportional failure reduction.
- **Historical inactive current evidence:** Exact bytes, digests, git blobs, repository revision, initial and final artifact commits, introducing pull request, and recorded TVM and MLC-LLM source revisions are recorded. The final artifact rewrite postdates the recorded TVM revision and its configuration metadata is consistent with the recorded MLC source, which supports plausibility but not provenance. The binary repository has no root license at the reviewed revision; the historical helper is workstation-specific, calls a Qwen preset absent from the recorded MLC revision, leaves Python and Cargo inputs unlocked, and has no matching independent rebuild.
- **Historical inactive evidence record:** exact WASM byte counts, SHA-256 digests, SRI values, and git blob identifiers; pinned binary repository revision and introducing pull request; recorded TVM, MLC-LLM, and tokenizer source revisions; ABI and embedded-configuration inspection
- **Safeguards:** the release workflow independently verifies byte count, SHA-256, and git blob identity; the exact two WASM and two tokenizer requests enforce their recorded SRI values; protected Cache API hits are SHA-256 checked and mismatches are evicted before use; allowed model shards remain bounded to the manifest-enumerated immutable model-revision URLs; reproducibility and artifact-level notice gaps remain explicitly unestablished
- **Follow-up:** Prefer upstream clarification or a maintainable controlled replacement when available; re-open immediately on digest, ABI, repository, runtime, or license-term drift.
- **Acceptance basis:** Exact identity and compatibility controls reduce technical substitution and incompatibility risk. They do not establish artifact-level authorization or notice custody; that separate gap remains explicitly accepted for this bounded browser-local demonstrator, which retrieves exact publisher-hosted libraries rather than redistributing them from hah.dev. A full historical reproducible rebuild is negative marginal value for this boundary because it demands bespoke reconstruction and long-term maintenance without a commensurate plausible technical-risk reduction; upstream clarification or a maintainable replacement remains eligible future work.

### GATE-05 · Manual interaction and accessibility

- **Rationale:** A blocked critical path is consequential, while exhaustive device coverage is impossible. Existing automated and browser checks make the unrecorded matrix a moderate residual that is cheap to observe and triage during release follow-up.
- **Current evidence:** Automated interaction, accessibility, rendering, and browser-path checks cover dialog focus, dismissal, blur, cancellation, reduced motion, forced colors, print, responsive layout, and no-JS navigation. A complete dated assistive-technology matrix for the eventual deployed artifact is not recorded here.
- **Evidence record:** tests/lattice-modal-accessibility.test.mjs; tests/lattice-boundary-regressions.test.mjs; tests/rendered-html.test.mjs; tests/lattice-graceful-degradation.test.mjs
- **Safeguards:** ARIA dialog semantics and deterministic focus restoration; page blur and scroll isolation while expanded content is active; reduced-motion, forced-color, print, and no-JS paths remain source-tested
- **Follow-up:** Record the dated deployed interaction matrix and fix any realistic blocked or misleading path; do not block on exotic combinations without a plausible consequential failure.
- **Acceptance basis:** The remaining evidence is observational rather than a known defect. Automated and browser checks cover the highest-consequence paths, and the residual can be bounded through prompt post-release observation and repair.

### GATE-06 · Remote production lifecycle and privacy trace

- **Rationale:** The migration intentionally moves source text across a new browser/server/provider boundary. A source-correct UI can still fail in deployment, retry unexpectedly, contact a wrong destination, leak content through errors or instrumentation, or produce no terminal result. Canonical-browser evidence is therefore a high-value release prerequisite rather than post-release follow-up.
- **Current active evidence:** Source and adversarial tests prove the explicit-submit call path, exact same-origin request, fixed server targets, bounded cancellation and response parsing, held import boundary, and application no-retention policy. No canonical production browser capture or non-error remote transformation is recorded for the candidate.
- **Active evidence record:** app/resume/ResumeProjects.tsx; app/privacy/networkCapabilities.js; app/resume/lattice/remoteProtocol.js; app/resume/lattice/remoteRequest.js; tests/lattice-network-capability.test.mjs; tests/lattice-network-governance.test.mjs; tests/lattice-api-worker.test.mjs
- **Historical inactive classification:** The two named fields are retained verbatim for the captured deployed revisions. They do not establish a remote conversion, /api/lattice request, provider destination, or current privacy boundary.
- **Historical inactive architecture:** canonical browser-local WebLLM, Turnstile, and lease lifecycle
- **Historical inactive current evidence (verbatim):** The owner supplied sanitized captures from the activated canonical client at https://hah.dev/resume/#text-to-lattice after workflow run https://github.com/howardhayden/folio/actions/runs/34325228788 deployed commit 9ab26b95cc1f9a94697118c0fc20a849db8f6ad2. Safari Version 26.5 (21624.2.5.11.4), WebKit, on macOS 26.5.1 (25F80), M5 iMac, with an operator-normalized capture time of 2026-09-09T08:05:50Z, directly records the first-session sequence POST /api/text-to-lattice/lease 428, the isolated https://verify.hah.dev/turnstile/ frame and Cloudflare challenge resources, POST /api/text-to-lattice/lease 200, and DELETE /api/text-to-lattice/lease 204 with a zero-byte response. Brave 1.94.121 (Chromium 152.0.7977.83, arm64) on the same platform, with operator-normalized capture times from 2026-09-09T08:15:12Z through 2026-09-09T08:22:30Z, independently records the second-engine lease statuses 428, 200, and 204, the isolated verification origin and challenge flow, and pinned Qwen tokenizer and model-asset loading. The deployed canonical-client source correlates those ordered Brave rows to POST 428, POST 200, and DELETE 204; the screenshot itself does not independently prove the later request methods. The owner reports that a capture-wide search for the unique submitted source marker returned 0 matches across the Brave network record. That search establishes the source-specific negative check. The deployed source contract and tests keep source, clarification, candidate, verifier finding, and output browser-local and exclude them from lease, attestation, model-asset, error, or telemetry traffic; the captured request inventory shows no undocumented content-bearing route. The canonical URL, bodyless lease request and release source contracts, and exact Cloudflare official testing profile are additionally bound by the deployed source and operator record rather than inferred from screenshot pixels. Payload-pane inspection was not claimed. The UTC times are operator normalizations of the local capture filenames, not server-signed timestamps. Cloudflare automatically injected a Web Analytics tag for https://static.cloudflareinsights.com/beacon.min.js into both document responses, but each CSP blocked the external beacon resource before transfer or execution (blocked:csp, 0.0 kB), and no /cdn-cgi/rum or other RUM transmission appeared. This composite evidence establishes canonical official-page integration and the observed privacy boundary under the declared testing profile; it does not establish human verification, bot resistance, token freshness or single use, hostname or action assurance, universal browser behavior, or production anti-bot assurance, and it does not establish that Cloudflare Web Analytics is disabled or that ordinary provider transport metadata is absent. Those captures remain historical evidence for the lease lifecycle and observed privacy boundary of their deployed revision; subsequent diagnosis established that the rapid DELETE followed a model-worker import failure and did not demonstrate a terminal conversion. The repair candidate adds a worker-only Vite pre-transform that preserves fourteen bare realm checks across the pinned WebLLM and web-tokenizers modules with fail-closed twelve/two count assertions, plus a final-artifact Worker-realm smoke that boots without window, completes the cached RPC, and reaches the first approved model-configuration cache request without network access. Because this changes emitted runtime behavior, GATE-06 is post-deployment verification: after deployment, repeat the supported-engine lifecycle and sanitized two-origin privacy trace and record one non-error terminal conversion. On 2026-09-11, the site owner reported that the deployed repaired runtime reached a full green progress bar after about one minute but remained at "Preparing on this device" with "Your result will appear here" and produced no terminal result. This owner report establishes the failed observable outcome; it is not a timestamped network capture, does not identify a newly verified deployment revision, and does not replace the historical evidence above. The replacement source candidate requires the exact https://hah.dev browser origin before any lease fetch, so local and Vite previews fail with a canonical-origin explanation instead of requesting a missing local API route. It adds a worker-realm capability probe before lease acquisition or model download; phase-aware WebLLM download, GPU-loading, and shader-compilation progress that becomes nondeterminate after the first completed phase; a closed worker-start acknowledgement so execution deadlines do not run while requests wait in the serialized queue; 30-second worker-start, 120-second preparation-inactivity, 720-second completion-inactivity, and 45-minute hard execution bounds; 15-second adapter and 10-second storage checks; a 30-second lease fetch-and-body deadline; a 10-second browser provenance-digest deadline; and explicit terminal errors. While the resume component remains mounted, Close, backdrop, and Escape are visibility-only in every phase and preserve input, availability or attestation request, lease-bound work, post-request processing, clarification, error, terminal state, and result for reopening; Cancel and Start over terminate or reset the current request, and component unmount tears it down; completion and error may release runtime resources, but their terminal state remains reopenable. The response-policy candidate preserves or adds Cache-Control: no-transform, and the live verifier now uses browser-shaped navigation requests and rejects conditionally injected Cloudflare beacon or RUM markers. These are source controls awaiting deployment verification; they do not establish that Cloudflare Web Analytics or RUM is disabled and do not establish a successful production conversion.
- **Historical inactive evidence record (verbatim):** canonical production client https://hah.dev/resume/#text-to-lattice; workflow run https://github.com/howardhayden/folio/actions/runs/34325228788 deployed commit 9ab26b95cc1f9a94697118c0fc20a849db8f6ad2 before the canonical browser captures; Safari Version 26.5 (21624.2.5.11.4), WebKit, on macOS 26.5.1 (25F80), M5 iMac; operator-normalized capture time 2026-09-09T08:05:50Z; sanitized-capture SHA-256 266db6b8264a0aa42ac16916ddf696554c846b239960e7d19fc002917d843950; directly observed POST 428, isolated verify.hah.dev frame and challenge resources, POST 200, and DELETE 204 with a zero-byte response; Brave 1.94.121, Chromium 152.0.7977.83, arm64, on macOS 26.5.1 (25F80), M5 iMac; operator-normalized capture times from 2026-09-09T08:15:12Z through 2026-09-09T08:22:30Z; sanitized-capture SHA-256 8cd8a22b1b8375d05d7f1f727dafbd7fd604ed91dec3d8cee853fb071f8cb957; independently recorded lease statuses 428, 200, and 204 plus the isolated verify.hah.dev challenge flow and pinned Qwen tokenizer and model asset; deployed canonical-client source correlates the ordered rows to POST 428, POST 200, and DELETE 204, while the screenshot itself does not independently prove the later request methods; Brave sanitized-capture SHA-256 d9b84b3f5a49b383d2472ffdb909dfe0bd68fb822bdd5d64ae05421654092741; Brave sanitized-detail-capture SHA-256 247777816b443b6eb9e4b63012941cbb38b342108347b081f99f457412ff17dd; Brave sanitized-detail-capture SHA-256 5f14ff23d8b2749dd81830656b9d71f0d58e79f853121f52860d28b62e4c1c64; owner-attested capture-wide unique-source-marker search returned 0 matches across the Brave network record; composite privacy evidence: the owner-attested trace search found no source marker; deployed source contracts and tests keep source, clarification, candidate, verifier finding, and output browser-local and exclude them from lease, attestation, model-asset, error, or telemetry traffic; the captured request inventory showed no undocumented content-bearing route; Cloudflare Web Analytics beacon tag was edge-injected on both origins; each external resource request was blocked by CSP before transfer or execution at 0.0 kB, with no observed /cdn-cgi/rum or other RUM transmission; declared Cloudflare official testing profile; browser evidence establishes demonstrator integration and observed privacy behavior, not human verification or production anti-bot assurance; acquisition, renewal, release, and teardown source contracts; bodyless lease request and release source contracts; the record does not claim independent Payload-pane inspection; historical production worker latticeWebllm.worker-BuQrxTen.js failed its model RPC with ReferenceError: window is not defined; the rapid DELETE 204 was client cleanup rather than evidence of a completed conversion; vite.config.ts preserves the pinned WebLLM and web-tokenizers bare worker-realm checks with fail-closed per-package counts without installing a synthetic window global; tests/lattice-built-worker.test.mjs executes the final emitted bundle in a Window-free Worker realm, requires a successful cached RPC, reaches the first approved generator model-configuration cache request, and prohibits network access in the smoke; closed attestation message schema; browser-local model execution and output protection tests; source-level prohibition on content telemetry; site-owner report dated 2026-09-11: the deployed repaired runtime reached a full green progress bar after about one minute, remained at Preparing on this device with an empty result region, and produced no terminal result; no new deployed commit, trace digest, or successful conversion is inferred; app/resume/lattice/latticeWebllm.worker.ts, app/resume/lattice/modelRpc.js, and app/resume/lattice/localModel.js add a closed worker capability probe and start acknowledgement; phase-aware download, GPU-loading, and shader-compilation liveness; sticky nondeterminate setup and inference presentation after the first completed progress phase; 30-second worker-start, 120-second preparation-inactivity, 720-second completion-inactivity, and 45-minute hard execution bounds; queued requests do not begin execution deadlines before their start acknowledgement, and duplicate progress cannot slide inactivity; app/resume/lattice/usageLease.js requires the exact https://hah.dev browser origin before acquisition, produces no local missing-route fetch, and bounds acquisition, renewal, and release fetch plus response-body handling to 30 seconds while preserving distinct caller cancellation; workers/text-to-lattice-lease/worker.js and app/resume/lattice/usageLease.js negotiate application/vnd.hah.text-to-lattice-lease.v1+json plus application/json, require the exact closed protocol/version/type/allowed/code/site-key challenge envelope before attestation, use HTTP 200 for the current normal challenge path, retain legacy HTTP 428 only for deployment-overlap compatibility, and reject an untyped or malformed HTTP 200 challenge without retrying; app/resume/latticeDemo.js bounds each browser SHA-256 provenance digest to 10 seconds and fails explicitly when secure digest support is unavailable or stalled; app/resume/ResumeProjects.tsx preserves input, availability or attestation request, lease-bound conversion, post-request processing, clarification, error, terminal state, and eventual output across Close, backdrop, or Escape dismissal and reopening in every phase while mounted; Cancel and Start over terminate or reset the current request, and component unmount tears it down; completion and error may release runtime resources, but their terminal state remains reopenable; workers/text-to-lattice-response-policy/worker.js and the verification-frame headers preserve or add Cache-Control: no-transform; scripts/verify-text-to-lattice-services.mjs uses browser-shaped document requests and rejects Cloudflare beacon, data-cf-beacon, and /cdn-cgi/rum markers without claiming the provider setting is disabled
- **Safeguards:** GATE-02 and GATE-03 must close before activation; the trace must originate from the canonical public client and bind one deployed revision; the request is explicit, same-origin, exact-schema, credentialless, no-store, and never automatically retried; provider origin and credentials remain server-only and there is no alternate provider or model fallback; bounded non-reflective failures cannot echo source, prompt, provider body, or result; the retained trace summary excludes raw HAR data, cookies, bearer values, provider credentials, submitted source, generated output, and sensitive headers
- **Follow-up:** Keep the public client held until the required canonical-browser records exist. Repeat the functional and privacy trace after any consequential route, schema, provider, model, response, CSP, cache, retention, telemetry, interaction, timeout, or retry-policy change.
- **Rollback condition:** Keep GATE-06 open and the public client held, or return it immediately to held documentation-only publication, if a canonical trace lacks one non-error terminal result, emits more or fewer than one intended content-bearing POST /api/lattice, contacts a provider from the browser, retries automatically, uses a cache or service worker, exposes a credential, or reflects source, prompts, provider bodies, findings, or output outside the acknowledged request and bounded result.

## Honest residual boundary

- The authorized request necessarily sends submitted content and server-created prompts to Hugging Face, Featherless AI, and their infrastructure under external policies; hah.dev's application nonretention rule does not guarantee provider retention or deletion behavior.
- Qwen generation and Llama verification are probabilistic. Closed schemas, deterministic sentinels, independent model roles, bounded repair, and honest withholding reduce but do not eliminate semantic drift.
- Provider-managed serving is not byte-pinned or byte-equivalent to the historical MLC WebLLM artifacts. Fixed hosted identifiers do not prove immutable weights, tokenizer bytes, infrastructure, or serving implementation.
- A public same-origin endpoint can still consume finite provider capacity or become unavailable despite per-request bounds, a path-scoped limiter, cost monitoring, and fail-closed errors.
- Browser output controls deter routine copying but cannot prevent screenshots, cameras, privileged extensions, developer tools, accessibility APIs, or memory access.
- Repository source and tests do not prove deployed routes, encrypted secret bindings, edge response behavior, live-provider behavior, external retention, representative accessibility, or a successful canonical-browser lifecycle.
- Historical WebLLM, Turnstile, lease, artifact, and production-trace evidence remains useful design history but is inactive and cannot qualify the remote candidate.

## Source register

- **SRC-REQUIREMENTS — Text to Lattice public requirements:** `docs/lattice-resume-demo-requirements.md`
- **SRC-DEMO — Bounded pipeline coordinator:** `app/resume/latticeDemo.js`
- **SRC-INPUT — Input and clarification policy:** `app/resume/lattice/inputPolicy.js`
- **SRC-SEGMENTS — Lossless segmentation:** `app/resume/lattice/segments.js`
- **SRC-PROTECTED — Protected-span handling:** `app/resume/lattice/protectedSpans.js`
- **SRC-PROMPTS — Closed prompts and schemas:** `app/resume/lattice/promptContract.js`
- **SRC-VALIDATORS — Deterministic semantic validators:** `app/resume/lattice/validators.js`
- **SRC-LOCAL-MODEL — Historical inactive local model adapter:** `app/resume/lattice/localModel.js`
- **SRC-MODEL-CONTRACT — Historical inactive browser-model contract:** `app/resume/lattice/modelContract.js`
- **SRC-MODEL-WORKER — Historical inactive isolated WebLLM worker:** `app/resume/lattice/latticeWebllm.worker.ts`
- **SRC-ASSET-POLICY — Historical inactive model-asset request policy:** `app/resume/lattice/assetRequestPolicy.js`
- **SRC-ATTESTATION — Historical inactive cross-origin attestation protocol:** `app/resume/lattice/attestation.js`
- **SRC-USAGE-LEASE — Historical inactive browser lease client:** `app/resume/lattice/usageLease.js`
- **SRC-USAGE-POLICY — Historical inactive usage and capacity policy:** `app/resume/lattice/usagePolicy.js`
- **SRC-OUTPUT — Output protection controls:** `app/resume/lattice/outputProtection.js`
- **SRC-LEASE-WORKER — Historical inactive lease Worker request coordinator:** `workers/text-to-lattice-lease/worker.js`
- **SRC-DEMO-PROFILE — Historical inactive bounded Cloudflare demonstration profile:** `workers/text-to-lattice-lease/demonstrationProfile.js`
- **SRC-USAGE-STORAGE — Historical inactive global usage authority:** `workers/text-to-lattice-lease/usageStorage.js`
- **SRC-FRAME — Historical inactive Turnstile verification bridge:** `workers/text-to-lattice-attestation-frame/public/turnstile/bridge.js`
- **SRC-RESPONSE-POLICY — Résumé response-policy Worker:** `workers/text-to-lattice-response-policy/worker.js`
- **SRC-PUBLIC-CONTRACT — Public Text to Lattice disclosure and policy contract:** `app/content/textToLatticeContent.js`
- **SRC-NETWORK-CAPABILITY — Named browser network capability:** `app/privacy/networkCapabilities.js`
- **SRC-REMOTE-PROTOCOL — Remote request and response protocol:** `app/resume/lattice/remoteProtocol.js`
- **SRC-REMOTE-CLIENT — Same-origin remote request client:** `app/resume/lattice/remoteRequest.js`
- **SRC-API-WORKER — Same-origin Text to Lattice API Worker:** `workers/text-to-lattice-api/worker.js`
- **SRC-HF-ADAPTER — Fixed Hugging Face and Featherless provider adapter:** `workers/text-to-lattice-api/huggingFaceAdapter.js`
- **SRC-API-CONFIG — Text to Lattice API Worker configuration:** `workers/text-to-lattice-api/wrangler.jsonc`
- **SRC-SECRET-BOOTSTRAP — Fail-closed secret bootstrap:** `scripts/bootstrap-text-to-lattice-secrets.mjs`
- **SRC-ROUTE-INVENTORY — Authenticated Worker route inventory verifier:** `scripts/verify-text-to-lattice-route-inventory.mjs`
- **SRC-TEST-ENGINE — Engine executable contracts:** `tests/lattice-demo.test.mjs`
- **SRC-TEST-SECURITY — Security executable contracts:** `tests/lattice-security.test.mjs`
- **SRC-TEST-ISOLATE — Isolate hardening executable contracts:** `tests/lattice-isolate-hardening.test.mjs`
- **SRC-TEST-CAPACITY — Protocol capacity executable contracts:** `tests/lattice-protocol-capacity.test.mjs`
- **SRC-TEST-A11Y — Modal accessibility source contracts:** `tests/lattice-modal-accessibility.test.mjs`
- **SRC-TEST-CAPABILITY — Remote capability executable contracts:** `tests/lattice-network-capability.test.mjs`
- **SRC-TEST-GOVERNANCE — Remote governance executable contracts:** `tests/lattice-network-governance.test.mjs`
- **SRC-TEST-API — Remote API Worker executable contracts:** `tests/lattice-api-worker.test.mjs`
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
- **SRC-HF-CHAT — Hugging Face OpenAI-compatible chat-completions API:** [Reviewed source](https://huggingface.co/docs/inference-providers/tasks/chat-completion)
- **SRC-HF-STRUCTURED — Hugging Face structured-output guidance:** [Reviewed source](https://huggingface.co/docs/inference-providers/guides/structured-output)
- **SRC-HF-SECURITY — Hugging Face security and privacy policy:** [Reviewed source](https://huggingface.co/security)
- **SRC-HF-FEATHERLESS — Hugging Face Featherless provider documentation:** [Reviewed source](https://huggingface.co/docs/inference-providers/providers/featherless-ai)
- **SRC-LATTICE-UPSTREAM — Lattice upstream repository:** [Reviewed source](https://github.com/howardhayden/lattice)

## Terms and provenance

Authored documentation follows the hah.dev portfolio-content terms. The generator and executable documentation shell retain the applicable source-component terms. The separately licensed Relational Systems Register profile is not reproduced.
