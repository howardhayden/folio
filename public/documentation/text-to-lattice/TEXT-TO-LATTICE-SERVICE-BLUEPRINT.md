---
title: Text to Lattice service blueprint
revision: 2026-09-14
authority: docs/text-to-lattice/LATTICE-DOCUMENTATION-ATLAS.json
generator: scripts/docs/build-text-to-lattice-documentation.mjs
---

<!-- Generated file. Edit the authoritative JSON register, then run the builder. -->

# Text to Lattice service blueprint

A visitor converts authorized prose into one bounded Lattice outcome through the disclosed remote capability.

[Open the interactive HTML edition](https://hah.dev/documentation/text-to-lattice/text-to-lattice-service-blueprint.html) · [Download complete Markdown](https://hah.dev/documentation/text-to-lattice/TEXT-TO-LATTICE-SERVICE-BLUEPRINT.md) · [Download the machine-readable register](https://hah.dev/documentation/text-to-lattice/documentation-atlas.json) · [Inspect the artifact manifest](https://hah.dev/documentation/text-to-lattice/artifact-manifest.json)

## Authority and claim boundary

This register describes the Lattice method at an architectural level and the bounded Text to Lattice implementation evidenced in this repository. It does not redistribute the exclusive register profile, certify universal conformance, or convert source tests into deployed proof.

Stable identifiers persist. A claim changes here with cited evidence; a rendered filter, expansion, or downloaded view never changes authoritative state.

Markdown and HTML are deterministic projections of this register. Filtered browser exports are nonauthoritative reading views.

## Scenario contract

- **Actor:** A visitor using a secure, JavaScript-capable browser who is authorized to send the submitted text to the disclosed external service.
- **Goal:** Receive a bounded checked result, a review-marked material draft, an unable-to-attempt outcome with no transformed text, or a finite machine-readable error after one deliberate external-processing submission.
- **Method:** The blueprint follows NN/g's service-blueprint separation of user action, visible service, backstage process, and support process, then makes the client/server, provider, evidence, retention, and recovery boundaries explicit.

## Lines

| ID | Line | Between | Accountability meaning |
| --- | --- | --- | --- |
| BP-LINE-01 | Line of interaction | Visitor action and frontstage | What the visitor directly authorizes, acts upon, cancels, and receives. |
| BP-LINE-02 | Line of visibility | Frontstage and backstage client/server | The interface discloses external processing and bounded outcomes; prompts, provider calls, validation, and repair remain implementation details. |
| BP-LINE-03 | Line of trust and network | Browser, same-origin API, and external provider | After explicit confirmation, the browser sends exactly text, requested_mode, and schema_version 1 to same-origin /api/lattice; the Worker alone holds HF_TOKEN and calls the fixed Hugging Face router and Featherless-served models. |
| BP-LINE-04 | Line of accountability | As-built evidence and release claims | Source and tests support repository claims; current remote deployment, live-provider behavior, provider retention, and manual exercises require separate evidence. |

## Complete blueprint

| Stage | Visitor action | Frontstage | Backstage client/server | Support/network | Evidence/recovery | Data crossing boundary |
| --- | --- | --- | --- | --- | --- | --- |
| **BP-01 · Read the boundary** | Opens Text to Lattice and reads the purpose, limits, external-processing warning, restricted-information warning, and canonical documentation link. | The dialog names the same-origin API, external service, fixed model roles, application no-retention rule, provider limitation, and finite outcomes before accepting a submission. | The interface resolves the named lattice.remote capability and local input prerequisites without contacting /api/lattice. | No transformation request or provider call occurs on open, edit, validation failure, dismissal, or cancellation before submission. | Unsupported capability yields a precise unavailable state while the semantic documentation remains available. | No submitted prose crosses a network boundary. |
| **BP-02 · Compose and preflight** | Enters one to 700 Unicode-aware words and chooses a supported requested mode. | The shared counter and concise inline validation expose only actionable limits. | The browser validates Unicode structure, 12,000 code units, 65,536 request bytes, passage and work-group ceilings, the requested mode, and schema version before enabling submission. | The same-origin API and provider remain untouched during editing and failed preflight. | The source stays editable; rejection is local, bounded, and does not truncate or relabel text. | Source and structural findings remain in the browser document. |
| **BP-03 · Authorize external processing** | Reviews the warning and deliberately chooses Process with external service, or chooses Cancel. | The action states that the text leaves hah.dev and that Hugging Face, Featherless AI, and their infrastructure process it under their own policies. | Only the explicit submission action creates the exact request body; there is no implicit submit, prefetch, or background send, and no automatic retry. | No remote request exists unless the visitor confirms. | Cancel and pre-submit dismissal preserve local work without transmission. | Authorization precedes the first and only browser transformation request for this attempt. |
| **BP-04 · Submit and validate** | Waits after the deliberate submission or cancels the client wait. | A finite working state is announced without promising success. | The browser sends one same-origin POST /api/lattice with exactly text, requested_mode, and schema_version 1; the Worker rejects alternate origins, methods, paths, queries, media types, shapes, modes, versions, and oversized bodies. | The API Worker uses a 240-second request deadline, closed machine-readable errors, bounded Retry-After metadata, and Cache-Control: no-store. | Cancellation aborts the client wait; rate limit, timeout, invalid request, and service failures terminate without an automatic retry. | The submitted text enters bounded API request memory; HF_TOKEN remains server-only and no provider address enters the browser request. |
| **BP-05 · Analyze with fixed generator** | Receives progress semantics only; cannot select a provider, URL, model, prompt, header, or credential. | The interface continues to describe external processing, not browser-local inference. | The Worker creates bounded prompts, segments protected source spans, and uses the fixed Qwen/Qwen3-4B:featherless-ai generator for atomization, classification, and planning; remote clarification remains disabled with questions required to be empty. | Only https://router.huggingface.co/v1/chat/completions is eligible; each provider call has a 60-second timeout and bounded structured output. | Malformed, oversized, hostile, or unavailable upstream output fails closed or receives only bounded same-model schema correction within the overall pipeline budget. | Server-created prompts containing submitted text cross to Hugging Face and Featherless; the browser never receives raw provider bodies. |
| **BP-06 · Draft and deterministically check** | Waits for the bounded pipeline; no clarification question is presented. | The service does not solicit follow-up prose or silently broaden the requested mode. | The fixed Qwen generator drafts a material candidate while deterministic checks enforce source coverage, protected spans, semantic polarity, quantities, modality, uncertainty, and bounded work and repair ceilings. | Schema correction and repair may call the same fixed generator within the declared completion budget, never as transport retry or provider/model fallback. | Rejected candidates and provider-authored issue prose cannot become new semantic authority. | Only bounded pipeline prompts and candidate records exist in request memory and provider processing; the application defines no persistent content sink. |
| **BP-07 · Verify and classify** | Waits for one terminal outcome. | The eventual label distinguishes translated, conformant-for-context, review-required, unable-to-attempt, and finite request errors. | The fixed meta-llama/Llama-3.2-3B-Instruct:featherless-ai verifier and deterministic validators independently check coverage, fidelity, accessibility, clarity, domain correctness, register fit, and ornament; verifier records cannot emit clarification questions. | The same fixed Hugging Face/Featherless destination serves the verifier under the 60-second call and total completion bounds. | A verifier or schema failure cannot be relabeled as success and cannot trigger a provider or model fallback. | Verification prompts and candidate text cross the external-provider boundary in bounded request memory. |
| **BP-08 · Return, retain locally, or start over** | Reads, copies, closes, starts over, or deliberately submits a later attempt. | The browser renders only the validated closed response, protects output interaction without claiming capture prevention, and exposes accurate retry timing without initiating it. | The client rejects invalid, oversized, HTML, or non-JSON responses; terminal state remains local and reopenable while mounted, and teardown aborts active work. | API responses carry no-store; hah.dev defines no application database, object storage, cache, queue, raw-content log, or analytics event for content. | A new attempt requires a new explicit action. Repository checks do not prove live provider behavior or external-provider retention. | Bounded result or error returns to the browser; application request memory is released, while external-provider handling remains governed by its own policies. |

## Failure and recovery register

<details id="bp-01">
<summary><strong>BP-01</strong> · Read the boundary</summary>

- **Failure:** The browser cannot satisfy the secure-context, JavaScript, segmentation, or named-capability requirement.
- **Recovery:** Read the method and limitation record or use a compatible browser; no text was transmitted.
- **Network boundary:** No submitted prose crosses a network boundary.

</details>

<details id="bp-02">
<summary><strong>BP-02</strong> · Compose and preflight</summary>

- **Failure:** Input exceeds a published boundary or contains unsafe structure.
- **Recovery:** Revise the source locally; no remote work began.
- **Network boundary:** Source and structural findings remain in the browser document.

</details>

<details id="bp-03">
<summary><strong>BP-03</strong> · Authorize external processing</summary>

- **Failure:** Authorization is absent, stale, or the component unmounts.
- **Recovery:** Remain local and require a fresh deliberate action for any later attempt.
- **Network boundary:** Authorization precedes the first and only browser transformation request for this attempt.

</details>

<details id="bp-04">
<summary><strong>BP-04</strong> · Submit and validate</summary>

- **Failure:** The request is invalid, rate limited, canceled, timed out, or cannot reach the same-origin API.
- **Recovery:** Return a bounded error; any retry requires a new deliberate submission.
- **Network boundary:** The submitted text enters bounded API request memory; HF_TOKEN remains server-only and no provider address enters the browser request.

</details>

<details id="bp-05">
<summary><strong>BP-05</strong> · Analyze with fixed generator</summary>

- **Failure:** The fixed generator times out, fails, or cannot produce an admissible closed record within budget.
- **Recovery:** Terminate with a bounded error or unable-to-attempt outcome; do not switch provider or model.
- **Network boundary:** Server-created prompts containing submitted text cross to Hugging Face and Featherless; the browser never receives raw provider bodies.

</details>

<details id="bp-06">
<summary><strong>BP-06</strong> · Draft and deterministically check</summary>

- **Failure:** No candidate clears the protected gates within the finite budget.
- **Recovery:** Return unable-to-attempt with no transformed text or a bounded machine error.
- **Network boundary:** Only bounded pipeline prompts and candidate records exist in request memory and provider processing; the application defines no persistent content sink.

</details>

<details id="bp-07">
<summary><strong>BP-07</strong> · Verify and classify</summary>

- **Failure:** The candidate fails a semantic gate or the verifier cannot return a valid closed record.
- **Recovery:** Bounded same-model repair may occur within policy; otherwise return review-required, unable-to-attempt, or a finite error as the closed protocol permits.
- **Network boundary:** Verification prompts and candidate text cross the external-provider boundary in bounded request memory.

</details>

<details id="bp-08">
<summary><strong>BP-08</strong> · Return, retain locally, or start over</summary>

- **Failure:** The response is malformed, too large, interrupted, or the visitor dismisses during work.
- **Recovery:** Show a bounded error or preserve valid terminal state; never auto-retry or route content elsewhere.
- **Network boundary:** Bounded result or error returns to the browser; application request memory is released, while external-provider handling remains governed by its own policies.

</details>

## Lifecycle ownership

External providers are dependencies, not assumed accountable owners. Accountability remains assigned to a Lattice or hah.dev maintainer, the site owner, or the visitor at each handoff.

| ID | Surface | Accountable owner | Responsibility | Handoff evidence |
| --- | --- | --- | --- | --- |
| OWN-01 | Lattice contract | Lattice maintainer | Govern the method, licensed profile boundary, version, and authorized conformance claims. | A cited upstream revision, applicable license terms, and an explicit public claim boundary. |
| OWN-02 | hah.dev client | Portfolio implementation maintainer | Keep input bounds, explicit external-processing consent, exact request construction, accessibility, cancellation, and public outcome behavior aligned with the requirements. | Exact source revision, named capability tests, modal lifecycle tests, and built static artifact inspection. |
| OWN-03 | Same-origin Text to Lattice API | hah.dev service operator | Validate method, path, origin, media type, schema, modes, content limits, deadlines, response size, and closed success and error envelopes; return no-store responses. | Reviewed Worker revision, route and secret inventory, instrumented tests, bounded live probes, and deployed response captures. |
| OWN-04 | Hugging Face and Featherless provider boundary | Text to Lattice release maintainer | Keep egress fixed to the Hugging Face chat-completions router, Qwen generation, and Llama verification; prohibit user-selected targets and provider or model fallback. | Exact endpoint and model identifiers, server-only secret proof, adapter allowlist tests, provider terms review, and bounded live-provider evidence. |
| OWN-05 | Application data lifecycle | hah.dev service operator | Define no application storage, raw-content logging, cache, queue, or analytics sink for source, prompts, candidates, results, or raw provider bodies; keep content only in bounded request memory. | Static sink scan, binding inventory, no-store response capture, log configuration review, and an explicit provider-policy limitation. |
| OWN-06 | Static Pages, response policy, and documentation export | Portfolio documentation maintainer | Publish concise external-processing semantics, deterministic projections, working links, escaped register content, matching integrity metadata, and a browser policy that permits only the named same-origin capability. | Documentation drift check, SHA-256 manifest, generated-page inspection, route tests, and live CSP and Permissions-Policy captures. |
| OWN-07 | Exact-revision release approval | Site owner | Accept or reject residuals and approve only the exact source, configuration, artifacts, provider controls, and current remote deployment evidence reviewed. | A dated gate record naming the revision and artifact digests, with GATE-02 and GATE-06 satisfied by current remote evidence rather than historical browser-local evidence. |
| OWN-08 | Visitor authorization and information choice | Visitor | Use text they are authorized to process, avoid restricted information, deliberately choose Process with external service, and decide whether disclosed external-provider residuals are acceptable. | Visible purpose, transmission, restricted-information, provider, retention-boundary, outcome, and residual disclosures before submission. |

## Binding data-flow rule

After explicit confirmation, the browser sends exactly `{text, requested_mode, schema_version: 1}` in one same-origin `POST /api/lattice`. The Worker uses server-created prompts with the fixed Hugging Face and Featherless Qwen generator and Llama verifier, then returns one validated bounded result or machine-readable error. `HF_TOKEN` remains server-only; hah.dev defines no application storage, raw-content log, cache, queue, or analytics sink for content, performs no automatic retry, and has no alternate provider or model fallback. External-provider processing and retention remain governed by provider policies.

Repository tests support the as-built rows. They do not establish that the remote API, encrypted secret binding, provider behavior, response policy, application nonretention boundary, or canonical-browser lifecycle is deployed or observed in production.

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
