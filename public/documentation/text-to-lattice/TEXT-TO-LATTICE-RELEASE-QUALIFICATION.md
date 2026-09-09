# Text to Lattice release qualification

**Decision:** hold the interactive client; publish the method, implementation record, and documentation only.

**Reviewed baseline:** `233bdbc8dbafd401a94babe14a64c198be110830`

**Qualification date:** 2026-09-09

**Machine authority:** [`TEXT-TO-LATTICE-RELEASE-REGISTER.json`](TEXT-TO-LATTICE-RELEASE-REGISTER.json)
**Qualified source-set SHA-256:** `77a2a4bba558c7fb920052b14486e1ab81d0f5fcde2706a56bac5cef100c08c1`
**Artifact-set projection SHA-256:** `5613bf89d45e9b61213b6cc4c2bd6d4a72d2e4e4d3bcda34d0fcf97a587eaf1f`

This is an engineering release decision, not legal advice, an upstream warranty, or independent certification. It applies only to the exact revisions and digests named below. A source test proves a source contract; it does not prove a production origin, provider setting, assistive-technology path, network trace, third-party license grant, or reproducible binary.

## Why the client remains held

Exactly one release blocker remains: the deployed origin and secret boundary does not yet exist in the form the interaction requires. During the 2026-09-09 review, the live lease route returned HTTP 404, `verify.hah.dev` did not resolve, and the reviewed `hah.dev` response carried neither Content-Security-Policy nor Permissions-Policy. An interaction activated in that state would predictably fail and would not have the documented two-origin browser boundary. This is high marginal value: the failure is ordinary, plausible, consequential, and cheap to recognize.

The other gaps are real, but they do not all have the same release consequence:

- Exact release identity is **release-workflow-enforced**. The qualified source set binds the activation, runtime, validator, and workflow sources without hashing this register or generated evidence. Current-main checks separately bind the deployed commit. This records a mandatory lifecycle control; it does not claim that a future workflow run has already happened.
- Capacity and the production privacy trace are **post-deployment verification**. Those facts cannot exist honestly before the service exists. Each has bounded safeguards, a concrete follow-up, and a condition that disables the client on consequential failure.
- Exact-model Llama fixture execution, the incomplete converted-model custody narrative, the absent historical WASM rebuild, and the eventual complete assistive-technology matrix are **accepted residual risks**. Their evidence gaps stay explicit. A verifier false negative is not bounded merely because explicit denials are withheld, and artifact hashes do not establish license or notice custody. Source confirmation, tool-free local operation, human review, exact technical identity, accessibility contracts, and requalification triggers bound the official product surface without pretending the missing evidence exists.

This is not a relaxation into “edge cases do not matter.” It is a classification by consequence × plausibility × lifecycle value. A rare finding can still block release when its realistic consequence is high. Conversely, byte-for-byte reconstruction of an undocumented workstation WASM build has negative marginal value for this product boundary after exact artifact identity, lineage, ABI, configuration, release-time digest checks, and runtime integrity checks are bound. The exact two WASM and two tokenizer requests enforce their recorded SRI values; protected Cache API hits are SHA-256 checked and mismatches are evicted before use, while allowed model shards remain bounded to immutable model-revision URLs. Upstream clarification or a maintainable controlled replacement remains useful; bespoke historical reconstruction is not a condition of publication.

Holding the client does not roll back the completed implementation. It keeps the interaction out of the public bundle while the canonical project page, mapped documentation, source, and evidence remain available. The machine rule is direct: the public client is enabled if and only if no gate is `open-release-blocker`.

## Owner direction and evidence boundary

Owner direction authorizes inclusion after the open release blocker closes; it is not deployment or runtime evidence. The direction is bound to the qualified source-set digest, not to the older implementation baseline alone. It does not manufacture a successful lease response, DNS record, response header, provider capacity result, exact-model execution, assistive-technology session, artifact license, reproducible build, or network trace.

## Evidence register

| Boundary | Exact evidence | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| Implementation | [`233bdbc8dbafd401a94babe14a64c198be110830`](https://github.com/howardhayden/folio/commit/233bdbc8dbafd401a94babe14a64c198be110830) | Reviewed source baseline | Later changes or built output |
| Browser runtime set | [WebLLM](https://github.com/mlc-ai/web-llm) 0.2.82; [Web Tokenizers](https://github.com/mlc-ai/tokenizers-cpp) 0.1.6; [MLC Web XGrammar](https://github.com/mlc-ai/xgrammar) 0.1.27 | Named runtime identities and source repositories | Final browser behavior or binary provenance |
| Qwen MLC model | [`a5c9fab855e3ccbdfed2e7e69683d75f30332161`](https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC/tree/a5c9fab855e3ccbdfed2e7e69683d75f30332161) | Immutable artifact-repository revision | Independent conversion provenance |
| Llama MLC model | [`1e80abf71e3d17cd564e2d2b63caa15cb226018e`](https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/tree/1e80abf71e3d17cd564e2d2b63caa15cb226018e) | Immutable artifact-repository revision | Complete MLC conversion and artifact-license chain |
| Qwen tokenizer | `tokenizer.json`; SHA-256 `aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4`; SRI `sha256-rrEzB6cazY/oGGHZStVKtonfdzMYgJ7tPL55S0SS2uQ=` | Expected tokenizer bytes and runtime integrity identity | Model behavior or source authorship |
| Llama tokenizer | `tokenizer.json`; SHA-256 `79e3e522635f3171300913bb421464a87de6222182a0570b9b2ccba2a964b2b4`; SRI `sha256-eePlImNfMXEwCRO7QhRkqH3mIiGCoFcLmyzLoqlksrQ=` | Expected tokenizer bytes and runtime integrity identity | Model behavior or source authorship |
| WASM repository | [`025bcaf3780fa8254f5e5efd3bfea0a5397248f4`](https://github.com/mlc-ai/binary-mlc-llm-libs/tree/025bcaf3780fa8254f5e5efd3bfea0a5397248f4/web-llm-models/v0_2_80) | Immutable binary tree | License grant or reproducible build |
| Qwen WASM | `Qwen3-4B-q4f16_1-ctx4k_cs1k-webgpu.wasm`; 6,070,240 bytes; SHA-256 `5ddf44e49b03e53e24fd29a45591850924346140452f60c29280190388571340`; SRI `sha256-Xd9E5JsD5T4k/SmkVZGFCSQ0YUBFL2DCkoAZA4hXE0A=`; git blob `449f3615aa712b22e548f5ad91bb9fbee0c12259` | Exact library identity | Source equivalence |
| Llama WASM | `Llama-3.2-3B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm`; 6,131,270 bytes; SHA-256 `34de0d60ab598c6a85ae882b48474f250193076f902057a21070bb2daae96d5b`; SRI `sha256-NN4NYKtZjGqFrogrSEdPJQGTB2+QIFeiEHC7LarpbVs=`; git blob `beda4ea1d45dc6c5294972b3ea3edfd317462142` | Exact library identity | Source equivalence |
| Final WASM artifact commit | [`a973639103dd389292a0315274495cb1bc406c7c`](https://github.com/mlc-ai/binary-mlc-llm-libs/commit/a973639103dd389292a0315274495cb1bc406c7c) | Both current blobs were finalized after the recorded TVM revision and remain unchanged at the pinned repository revision | Exact checkout, clean tree, compiler, dependency graph, or build commands |
| WASM introduction | [binary-libs PR #158](https://github.com/mlc-ai/binary-mlc-llm-libs/pull/158), merge `6ed5b97c37f4cdc49d1a8044a339db5588176d7e` | Current blobs entered through the identified recompilation | Complete build recipe or independent verification |
| Named TVM source | [`c8515e1ddfaf4d1afff916c484e68e1513631dd6`](https://github.com/apache/tvm/commit/c8515e1ddfaf4d1afff916c484e68e1513631dd6) | Source revision asserted by PR #158 | Proof the published bytes were produced only from that tree |
| Named MLC-LLM source | [`4084e7fe7532fb932810d8b707f2d760eefd0dea`](https://github.com/mlc-ai/mlc-llm/commit/4084e7fe7532fb932810d8b707f2d760eefd0dea) | Source revision asserted by PR #158 | Complete dependency, flag, or compiler identity |
| Llama license | SHA-256 `8cc15535a8a34b41888f644b339a1a9eb428af793a4f5e24df58a3e5b1487d74` | Checked-in terms match the reviewed official file | Approval of this public use |
| Llama AUP | SHA-256 `40e2777d7faa6beaf98400654170f414d8ab29b921b5163ad4ea0a1d39894201` | Checked-in policy matches the reviewed official file | Enforcement by the product |
| Llama-use evaluation fixture | [`LLAMA-USE-EVALUATION-CASES.json`](LLAMA-USE-EVALUATION-CASES.json); SHA-256 `259ba4cc17d28e16bf9470621f95af017e26988e22602c452246f055e0b8d3b4`; five expected denials and five expected allowances | Stable non-operational cases and expected purpose-and-consequence dispositions | Actual behavior of the exact verifier artifact |

The reviewed Llama files are byte-identical to the official Llama 3.2 files introduced in Meta's [`8d29d93fa5700a60532e0061a02ffa89d0acd3fc`](https://github.com/meta-llama/llama-models/commit/8d29d93fa5700a60532e0061a02ffa89d0acd3fc) commit and exposed through Meta's current [license](https://developer.meta.com/ai/llama3_2/license/) and [acceptable-use](https://developer.meta.com/ai/llama3_2/use-policy/) pages. The repository already carries the required Llama notice and “Built with Llama” attribution. Nothing located in those terms requires case-by-case advance permission for an ordinary deployment below the license's stated scale threshold; the recorded owner direction is this project's release control, not a claim that Meta operates an approval queue.

## Llama-use qualification

### What is already sound

- The exact base-model license and acceptable-use text is retained with stable digests.
- The verifier model and revision are pinned.
- The required Llama attribution is present.
- A verifier `safety: false` disposition suppresses candidate release.

### Controls and residual evidence

1. **Model-assistance disclosure.** At the point of use, state that Qwen drafts locally and Llama 3.2 checks locally; both can miss altered, omitted, biased, or unsafe meaning; every result requires human review; and the service is built with Llama.
2. **Source-specific confirmation.** Reset the confirmation whenever source text changes. The visitor confirms that the use is lawful, authorized, within the supported language boundary, and does not materially further conduct prohibited by the Llama AUP.
3. **Purpose-and-consequence safety.** The prompt contract fails closed when the requested transformation or candidate materially furthers a prohibited outcome or when necessary authority cannot be established. It may handle quotation, history, criticism, journalism, fiction, prevention, or defensive analysis when the transformation does not further the prohibited outcome.
4. **No topic blacklist.** Do not substitute keyword matching for purpose, authority, and consequence. It predictably rejects legitimate contexts, misses paraphrases, and creates a brittle policy fork.
5. **Executable evidence.** The checked-in [`LLAMA-USE-EVALUATION-CASES.json`](LLAMA-USE-EVALUATION-CASES.json) fixture balances realistic operational harm, malware improvement, deliberate deception, unauthorized professional practice, and sensitive-person inference against journalism, history and criticism, fiction, prevention and defense, and rights analysis. It has not been executed and manually reviewed against the exact verifier artifact in this environment. That unperformed run is recorded, not implied.
6. **Artifact provenance.** The Llama MLC conversion chain remains separate from behavior. Base-model terms and a Hugging Face commit pin do not establish every conversion input or artifact-level notice.

The source implements items 1–4, defines the ten-case non-operational fixture, and carries a direct safety-withholding regression. GATE-04A accepts the unexecuted exact-model fixture as a moderate residual while stating that verifier false negatives remain unobserved and explicit-denial withholding depends on the model's classification. The bounded official surface is local and tool-free, requires source-specific confirmation, withholds errors and explicit denials, and requires human review. GATE-04B separately accepts the incomplete publisher conversion and artifact-notice narrative while binding the exact repository revision, tokenizer digest, runtime contract, controlling base-model terms, and attribution. Hashes do not cure the authorization gap. Either gate reopens on consequential observed behavior, artifact drift, or terms drift.

This is a bounded risk disposition, not a claim that the exact model was tested here or that the converted artifact has a complete custody chain.

## WASM provenance qualification

The current record establishes **identity** and meaningful but partial **lineage**:

- both filenames, byte counts, SHA-256 digests, and git blob identifiers are exact;
- both current blobs trace to the recompilation merged by [PR #158](https://github.com/mlc-ai/binary-mlc-llm-libs/pull/158);
- that pull request names TVM and MLC-LLM source commits; and
- those source trees carry Apache-2.0 licenses ([TVM](https://github.com/apache/tvm/blob/c8515e1ddfaf4d1afff916c484e68e1513631dd6/LICENSE), [MLC-LLM](https://github.com/mlc-ai/mlc-llm/blob/4084e7fe7532fb932810d8b707f2d760eefd0dea/LICENSE)).

The current record does **not** establish a reproducible artifact:

- the pinned binary repository publishes no standalone root license or notice;
- the [historical `compile_wasm.py` at the introducing merge](https://github.com/mlc-ai/binary-mlc-llm-libs/blob/6ed5b97c37f4cdc49d1a8044a339db5588176d7e/web-llm-models/v0_2_80/compile_wasm.py) uses placeholders and local paths, requires manually uncommented calls, and does not pin the complete compiler, environment, dependency graph, configuration, or commands; its `qwen3_4b` preset does not exist at the recorded MLC-LLM revision, so the published helper cannot produce the Qwen target as written; the later pinned repository revision deletes that helper;
- MLC-LLM's pinned `tokenizers-cpp` submodule at `55d53aa38dc8df7d9c8bd9ed50907e82ae83ce66` has no `Cargo.lock`, its CMake path invokes an ordinary network-resolving `cargo build`, and the Python dependency declarations contain open ranges rather than a build lock;
- the binaries do not embed a useful producer, source-map, version, or license section; observed strings include workstation paths, which are provenance clues rather than a recipe; and
- no independent rebuild has produced and matched the published bytes.

The license gap is not cured by organizational proximity. [GitHub's repository-licensing guidance](https://docs.github.com/articles/licensing-a-repository) explains that default copyright restrictions remain when a repository has no license, while the [GitHub Terms of Service](https://docs.github.com/site-policy/github-terms/github-terms-of-service) supply only the platform-facing rights needed to provide public-repository functionality. WebLLM 0.2.82 is Apache-2.0 and intentionally names the `v0_2_80` directory and these model-library filenames, which is strong evidence of intended integration. Its license does not expressly grant rights in a separately hosted repository whose own license metadata is null.

The TVM qualification is narrower than a simple commit citation, but the final chronology is plausible. An initial artifact commit, [`40ef9663ecf3474f2b03b4edcead0d362a283e41`](https://github.com/mlc-ai/binary-mlc-llm-libs/commit/40ef9663ecf3474f2b03b4edcead0d362a283e41), predates the PR's recorded TVM commit `c8515e1…`; the current blobs were then rewritten by [`a973639103dd389292a0315274495cb1bc406c7c`](https://github.com/mlc-ai/binary-mlc-llm-libs/commit/a973639103dd389292a0315274495cb1bc406c7c) after `c8515e1…` and remain unchanged at the pinned binary-repository revision. The earlier time-plausible TVM PR head [`372c92844ce708cb1c9e1d13a2102823a4e50498`](https://github.com/apache/tvm/commit/372c92844ce708cb1c9e1d13a2102823a4e50498) differs from `c8515e1…` only in two Torch-frontend files and one CUDA file, outside the inspected Web/runtime/model-library path. The final embedded allocation values also agree with the recorded MLC source's 1,024-token prefill × model hidden size × two-byte float calculation. Together these facts corroborate source plausibility; they do not prove the builder's checkout, clean-tree state, commands, or compiler. TVM's CI pins Emscripten 3.1.51 at that source, yet no evidence proves the local macOS builder used it.

Both files expose the same 13-import/93-export ABI shape and embed the expected model-family, `q4f16_1`, 4,096-token context, 1,024-token prefill-chunk, and 128-sequence batch metadata. They contain no custom producer, version, source-map, license, or notice section. These observations support compatibility and triage; they do not establish authorship, reproducibility, or license custody.

Two useful lifecycle-improvement paths remain:

- obtain an upstream artifact-level license and build record that binds the exact files to complete inputs, toolchain, commands, flags, notices, and digests; or
- produce controlled replacements from licensed pinned sources, record the complete dependency and compiler environment, publish notices, and verify the resulting bytes and behavior. A source-built replacement need not match the upstream binary, but its own provenance, integrity, compatibility, and tests must be complete.

Switching models does not erase the boundary by itself. It creates a new model, conversion, runtime, behavior, license, and regression qualification while leaving the general WASM provenance question intact.

### Controlled replacement option

A controlled replacement is feasible without trying to recreate an undocumented workstation byte for byte. The build should compile the two pinned `mlc-chat-config.json` inputs directly, because the historical Qwen preset is absent. It must point MLC-LLM explicitly at external TVM `c8515e1…`; MLC-LLM's own TVM submodule is a different revision. The reviewed config digests are `9726ac7dbcd90475f8045604be0862ef1b4837e432c5004da20b8a6e348330da` for Qwen and `10b2318d871320ca66c86b7a44cb444cea7677e078a1b147d4e0646958a87dbe` for Llama.

If a controlled replacement is pursued, its acceptance should use one bounded, reviewable evidence package:

1. An immutable Linux builder image with compiler identities, exact source/submodule/input manifests, and both builder and distributed-code SBOMs.
2. Hash-locked Python inputs and vendored Cargo crates; the build must succeed with locked, offline dependency resolution.
3. A complete environment and command transcript, including stable source paths and explicit TVM/MLC configuration.
4. Two independent clean builds that produce byte-identical replacement outputs, followed by digest, ABI, embedded-configuration, and import/export allowlist checks.
5. A link-derived license and notice inventory for material actually shipped in each WASM, kept distinct from the broader builder inventory.
6. Signed SLSA or in-toto provenance, project-controlled immutable hosting, and integrity enforcement for the exact public URLs.
7. WebLLM 0.2.82 first-load, cached-load, structured-output, tamper-failure, and production-network tests against both pinned model repositories.
8. Human review and an exact-revision owner disposition. Llama behavior and model-artifact authorization remain separate gates.

The replacement acceptance criterion would be reproducible project-controlled output with a complete custody record and compatible behavior—not equality with undocumented upstream bytes. Reverse-engineering every theoretical component of the stripped binaries would add cost without reliable closure and is negative marginal value for the current product boundary. GATE-04C therefore records an accepted moderate residual with two distinct parts: exact identity, available lineage, ABI, embedded configuration, immutable runtime URLs, release-time byte verification, protected-request SRI, and protected-cache digest verification reduce technical substitution and incompatibility risk; reproducibility and artifact-level authorization and notice custody remain explicitly unestablished and are not reduced by those hashes. The accepted boundary is a browser-local demonstrator retrieving the exact publisher-hosted libraries, not redistribution of those libraries from hah.dev.

## Gate disposition

| Gate | Status | Marginal value | Release consequence |
| --- | --- | --- | --- |
| GATE-01 · Exact release artifact | Release workflow enforced | High | A stale or substituted artifact could escape the reviewed boundary; the workflow fails closed and binds current main. |
| GATE-02 · Production origin and secret boundary | Open release blocker | High | The live interaction cannot work as designed and lacks its required origin and response-policy boundary. |
| GATE-03 · Edge and provider capacity controls | Post deployment verification | Moderate | Source controls bound failure; live provider behavior must be measured and disables the client if it exceeds the published bounds. |
| GATE-04A · Llama behavior and public-use controls | Accepted residual risk | Moderate | Source disclosure, confirmation, semantic safety, candidate withholding, and balanced fixtures are present; exact-model execution is not claimed. |
| GATE-04B · Llama MLC-artifact provenance | Accepted residual risk | Moderate | Immutable identity and controlling terms are bound; the publisher conversion and artifact-notice narrative remains incomplete. |
| GATE-04C · WASM provenance and license boundary | Accepted residual risk | Moderate | Exact identity, lineage, ABI, and configuration are bound; reproducibility and artifact-level notice custody remain unestablished. |
| GATE-05 · Manual interaction and accessibility | Accepted residual risk | Moderate | Automated and browser checks cover critical paths; the eventual deployed assistive-technology matrix remains follow-up evidence. |
| GATE-06 · Production privacy trace | Post deployment verification | High | Source controls keep prose local; the first deployed trace must confirm that fact and any content-bearing request disables the client. |

Owner direction is recorded for the qualified source set, but it does not override an open release blocker or count as missing runtime evidence. The status remains **held solely because GATE-02 is open**.

## Deployment freshness and retained runs

The Pages workflow resolves GitHub's live `refs/heads/main` and requires its exact commit to equal `GITHUB_SHA` at its publication boundaries. Missing credentials, an unexpected ref, an unreadable or malformed API response, and a stale workflow commit fail closed. Immutable action pins, machine release-state checks, service and secret-name checks, and the qualified source-set digest make the control reusable across later releases. A successful future run and deployed commit remain workflow evidence; this source record does not predeclare them.

## Marginal-value decisions

| Finding | Classification | Disposition | Reason |
| --- | --- | --- | --- |
| Leading-zero `Retry-After` inflation | Moderate/high | Fixed; retain | A valid ordinary response could manufacture an excessive wait; the canonicalization is cheap and reusable. |
| Pre-1900 HTTP-date rejection | Low | Completed behavior retained | The provider-impossible case has bounded consequence; completed work is not rolled back. |
| Keyword-only prohibited-topic blocking | Negative | Do not implement | Bespoke complexity creates false positives and trivial evasions while reducing semantic fidelity. |
| Deterministic language detection as sole language gate | Negative | Do not implement | Short and mixed text makes a bespoke detector unreliable; a resettable confirmation is clearer and bounded. |
| Point-of-use disclosure and source-specific confirmation | High | Fix now | Ordinary visitors otherwise cannot understand model participation, limitations, or the authority boundary. |
| Machine-enforced release-state publication | High | Fix now | It converts a prose warning into a reusable lifecycle control for every future revision and keeps GATE-02 fail-closed. |
| Full historical WASM byte-for-byte rebuild | Negative | Do not require for this boundary | Bespoke reconstruction of unavailable workstation state adds greater maintenance burden than plausible risk reduction after exact identity and compatibility controls. |
| Maintainable controlled WASM replacement | Moderate | Revisit when bounded | A project-controlled replacement can improve custody and notices if it is supportable without recreating undocumented history. |
| Immediate post-deployment privacy trace | High | Verify; disable on failure | Sensitive prose leaving the browser would be consequential, while the evidence can exist only after deployment. |
| Held résumé title and Text to Lattice icon link drift | Moderate | Fixed; regression tested | A stale built-boundary assertion could reject the corrected canonical-title and SVG-only tool-link contract; the plausible mismatch was cheap to repair without weakening the hold. |
| Shared verification-frame propagation deadline | Moderate | Fixed; regression tested | A slowly settling first asset could leave later healthy frame assets only a token verification window; separate bounded windows remove a recoverable deployment false negative. |
| Simultaneous programmatic résumé-modal body-class race | Low | Document; defer | Normal interface paths cannot open two résumé modals at once; reference-counting the class would add coordination complexity for a nonconsequential programmatic-only state. |

The rule is not “ignore edge cases.” It is: repair when consequence × plausibility × lifecycle value justifies the change. Novel findings remain eligible; nonconsequential novelty does not acquire release priority merely by being difficult.

## Requalification boundary

Re-run this decision after any model, tokenizer, runtime, WASM, Llama-terms, prompt, safety schema, candidate-release, origin, provider, lease, storage, telemetry, accessibility-critical, qualified-source, or artifact-digest change. The current owner direction binds the named qualified source set. Documentation is publishable now; inference remains held until GATE-02 has recorded live evidence and no open release blocker remains.
