# Text to Lattice release qualification

**Decision:** hold the interactive client; publish the method, implementation record, and documentation only.

**Reviewed baseline:** `233bdbc8dbafd401a94babe14a64c198be110830`

**Qualification date:** 2026-09-09

**Machine authority:** [`TEXT-TO-LATTICE-RELEASE-REGISTER.json`](TEXT-TO-LATTICE-RELEASE-REGISTER.json)
**Artifact-set projection SHA-256:** `eac29ee0b3d059ac5a4bee794cbc0c6157034d5d79e17a51744b943d55c06d23`

This is an engineering release decision, not legal advice, an upstream warranty, or independent certification. It applies only to the exact revisions and digests named below. A source test proves a source contract; it does not prove a production origin, provider setting, assistive-technology path, network trace, third-party license grant, or reproducible binary.

## Why the hold is correct

Text to Lattice can put arbitrary visitor prose through a Llama verifier and two precompiled WebAssembly model libraries. Those are consequential boundaries, not merely unusual edge cases.

- A generic `safety` Boolean cannot, by itself, establish that the service evaluates the requested use by purpose, authority, and likely consequence under the [Llama 3.2 Acceptable Use Policy](https://developer.meta.com/ai/llama3_2/use-policy/). Without point-of-use disclosure and a source-specific use confirmation, the visitor also lacks a clear account of model assistance, limitations, and their own authority.
- A digest proves which WASM bytes will run. The upstream lineage identifies where those bytes entered the binary repository and which source revisions the pull request names. Neither fact proves how the files were built, what exact compiler and linked inputs produced them, whether a rebuild matches them, or which artifact-level notices apply.
- The public interaction additionally depends on a lease Worker and `verify.hah.dev` surface that the Pages workflow does not deploy. During qualification, the public lease path did not expose the required service and the verification host was unavailable. Source completeness therefore cannot be promoted into a deployed claim.

The consequence is unauthorized or harmful model use, misleading presentation, execution of insufficiently attributable binary code, privacy leakage, an inaccessible failure path, or an interaction that simply cannot work. The pathways are plausible in an ordinary public deployment, and the controls are reusable across every later model or provider revision. These are high-marginal-value release gates.

Holding publication does not roll back the completed implementation. It keeps that implementation reviewable while the public surface offers native links to the canonical project page and mapped documentation. Eligibility returns only when every machine gate is satisfied and the site owner records approval for the exact source and artifact set.

### Deployment-history boundary

The candidate Pages workflow now verifies that its `GITHUB_SHA` is still the current `main` revision before building, before artifact upload, and immediately before deployment. It also pins the Pages artifact action to its signed v5.0.0 commit, whose nested upload action is SHA-pinned, and explicitly retains `.nojekyll` in the uploaded artifact.

That source change cannot alter a historical workflow retained by GitHub Actions. Successful [run 33575222169](https://github.com/howardhayden/folio/actions/runs/33575222169) used pre-hold `main` revision `7522ab1057c80747dc4e710210922b31ad60c094`, remains within GitHub’s rerun window at qualification time, and can rebuild the earlier interactive site under its original workflow. The existing `github-pages` environment restricts deployments to `main`, but a historical rerun retains that ref. GATE-01 therefore also requires an owner-side record that pre-hold Pages runs are deleted, have expired beyond rerun, or are rejected by a current-SHA deployment protection. No destructive run-history operation is inferred from this source review.

## Evidence register

| Boundary | Exact evidence | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| Implementation | [`233bdbc8dbafd401a94babe14a64c198be110830`](https://github.com/howardhayden/folio/commit/233bdbc8dbafd401a94babe14a64c198be110830) | Reviewed source baseline | Later changes or built output |
| Browser runtime set | [WebLLM](https://github.com/mlc-ai/web-llm) 0.2.82; [Web Tokenizers](https://github.com/mlc-ai/tokenizers-cpp) 0.1.6; [MLC Web XGrammar](https://github.com/mlc-ai/xgrammar) 0.1.27 | Named runtime identities and source repositories | Final browser behavior or binary provenance |
| Qwen MLC model | [`a5c9fab855e3ccbdfed2e7e69683d75f30332161`](https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC/tree/a5c9fab855e3ccbdfed2e7e69683d75f30332161) | Immutable artifact-repository revision | Independent conversion provenance |
| Llama MLC model | [`1e80abf71e3d17cd564e2d2b63caa15cb226018e`](https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/tree/1e80abf71e3d17cd564e2d2b63caa15cb226018e) | Immutable artifact-repository revision | Complete MLC conversion and artifact-license chain |
| Qwen tokenizer | `tokenizer.json`; SHA-256 `aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4` | Expected tokenizer bytes | Model behavior or source authorship |
| Llama tokenizer | `tokenizer.json`; SHA-256 `79e3e522635f3171300913bb421464a87de6222182a0570b9b2ccba2a964b2b4` | Expected tokenizer bytes | Model behavior or source authorship |
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

The reviewed Llama files are byte-identical to the official Llama 3.2 files introduced in Meta's [`8d29d93fa5700a60532e0061a02ffa89d0acd3fc`](https://github.com/meta-llama/llama-models/commit/8d29d93fa5700a60532e0061a02ffa89d0acd3fc) commit and exposed through Meta's current [license](https://developer.meta.com/ai/llama3_2/license/) and [acceptable-use](https://developer.meta.com/ai/llama3_2/use-policy/) pages. The repository already carries the required Llama notice and “Built with Llama” attribution. Nothing located in those terms requires case-by-case advance permission for an ordinary deployment below the license's stated scale threshold; the pending owner disposition is this project's release control, not a claim that Meta operates an approval queue.

## Llama-use qualification

### What is already sound

- The exact base-model license and acceptable-use text is retained with stable digests.
- The verifier model and revision are pinned.
- The required Llama attribution is present.
- A verifier `safety: false` disposition suppresses candidate release.

### What must exist before the interaction is public

1. **Model-assistance disclosure.** At the point of use, state that Qwen drafts locally and Llama 3.2 checks locally; both can miss altered, omitted, biased, or unsafe meaning; every result requires human review; and the service is built with Llama.
2. **Source-specific confirmation.** Reset the confirmation whenever source text changes. The visitor confirms that the use is lawful, authorized, within the supported language boundary, and does not materially further conduct prohibited by the Llama AUP.
3. **Purpose-and-consequence safety.** The prompt contract fails closed when the requested transformation or candidate materially furthers a prohibited outcome or when necessary authority cannot be established. It may handle quotation, history, criticism, journalism, fiction, prevention, or defensive analysis when the transformation does not further the prohibited outcome.
4. **No topic blacklist.** Do not substitute keyword matching for purpose, authority, and consequence. It predictably rejects legitimate contexts, misses paraphrases, and creates a brittle policy fork.
5. **Executable evidence.** Run the checked-in [`LLAMA-USE-EVALUATION-CASES.json`](LLAMA-USE-EVALUATION-CASES.json) fixture against the exact release revisions. It balances realistic operational harm, malware improvement, deliberate deception, unauthorized professional practice, and sensitive-person inference against journalism, history and criticism, fiction, prevention and defense, and rights analysis. Preserve the existing invariant that no safety-failing candidate reaches the visitor, and record every false-positive and false-negative disposition.
6. **Artifact provenance.** Resolve the Llama MLC conversion chain separately from behavior. Base-model terms and a Hugging Face commit pin do not alone establish the provenance of every converted artifact.

The held source now implements items 1–4, defines the ten-case non-operational fixture for item 5, and carries a direct safety-withholding regression. GATE-04A remains open because the fixture has not been exercised and manually reviewed against the exact verifier artifact, and because point-of-use comprehension evidence, trade-compliance disposition, and exact-revision owner acceptance have not been recorded. Item 6 is GATE-04B and remains independently open.

This is not a demand for theoretical certainty. It is a bounded control set for a public arbitrary-prose service whose verifier is both a release gate and a licensed model.

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

Two satisfactory closure paths remain:

- obtain an upstream artifact-level license and build record that binds the exact files to complete inputs, toolchain, commands, flags, notices, and digests; or
- produce controlled replacements from licensed pinned sources, record the complete dependency and compiler environment, publish notices, and verify the resulting bytes and behavior. A source-built replacement need not match the upstream binary, but its own provenance, integrity, compatibility, and tests must be complete.

Switching models does not close this problem by itself. It creates a new model, conversion, runtime, behavior, license, and regression qualification while leaving the general WASM provenance boundary intact.

### Controlled replacement closure

A controlled replacement is feasible without trying to recreate an undocumented workstation byte for byte. The build should compile the two pinned `mlc-chat-config.json` inputs directly, because the historical Qwen preset is absent. It must point MLC-LLM explicitly at external TVM `c8515e1…`; MLC-LLM's own TVM submodule is a different revision. The reviewed config digests are `9726ac7dbcd90475f8045604be0862ef1b4837e432c5004da20b8a6e348330da` for Qwen and `10b2318d871320ca66c86b7a44cb444cea7677e078a1b147d4e0646958a87dbe` for Llama.

Closure requires one bounded, reviewable evidence package:

1. An immutable Linux builder image with compiler identities, exact source/submodule/input manifests, and both builder and distributed-code SBOMs.
2. Hash-locked Python inputs and vendored Cargo crates; the build must succeed with locked, offline dependency resolution.
3. A complete environment and command transcript, including stable source paths and explicit TVM/MLC configuration.
4. Two independent clean builds that produce byte-identical replacement outputs, followed by digest, ABI, embedded-configuration, and import/export allowlist checks.
5. A link-derived license and notice inventory for material actually shipped in each WASM, kept distinct from the broader builder inventory.
6. Signed SLSA or in-toto provenance, project-controlled immutable hosting, and integrity enforcement for the exact public URLs.
7. WebLLM 0.2.82 first-load, cached-load, structured-output, tamper-failure, and production-network tests against both pinned model repositories.
8. Human review and an exact-revision owner disposition. Llama behavior and model-artifact authorization remain separate gates.

The replacement acceptance criterion is reproducible project-controlled output with a complete custody record and compatible behavior—not equality with undocumented upstream bytes. Reverse-engineering every theoretical component of the stripped binaries would add cost without reliable closure and is therefore low or negative marginal value.

## Gate disposition

| Gate | Status | Marginal value | Release consequence |
| --- | --- | --- | --- |
| GATE-01 · Exact release artifact | Open before publication | High | A later source or build could escape the reviewed boundary. |
| GATE-02 · Production origin and secret boundary | Open before publication | High | The public interaction can fail or cross an unverified origin/security boundary. |
| GATE-03 · Edge and provider capacity controls | Open before publication | High | Public load can bypass the promised admission and lifecycle limits. |
| GATE-04A · Llama behavior and public-use controls | Open before publication | High | The service can assist a prohibited outcome or misstate model-assisted work. |
| GATE-04B · Llama MLC-artifact provenance | Open before publication | High | The converted verifier artifact lacks a complete source and license chain. |
| GATE-04C · WASM provenance and license boundary | Open before publication | High | Exact opaque executable bytes lack a reproducible licensed build record. |
| GATE-05 · Manual interaction and accessibility | Open before publication | High | Automated contracts can miss a blocked keyboard, AT, zoom, touch, or browser path. |
| GATE-06 · Production privacy trace | Open before publication | High | Source or result text could escape through deployed behavior absent from source tests. |

No owner approval is recorded. The status therefore remains **held** even if source remediation later satisfies one or more rows.

## Deployment freshness and retained runs

The Pages workflow resolves GitHub's live `refs/heads/main` and requires its exact commit to equal `GITHUB_SHA` before build work, again after site verification and before artifact upload, and immediately before deployment. Missing credentials, an unexpected ref, an unreadable or malformed API response, and a stale workflow commit all fail closed. The repeated check and the workflow's cancel-in-progress concurrency policy narrow the interval in which a superseded build could reach Pages; they do not turn a remote ref read and deployment into one atomic operation.

Historical workflow runs retain their original commit and workflow definition. This repository change therefore cannot retrofit a freshness guard into a run created before the guard existed. Before relying on the held boundary, the site owner must cancel or delete retained pre-guard runs and invalidate their artifacts, or impose an equivalent `github-pages` environment control that rejects stale revisions. That owner-side action is required operational follow-through, not evidence this source tree can claim as completed.

## Marginal-value decisions

| Finding | Classification | Disposition | Reason |
| --- | --- | --- | --- |
| Leading-zero `Retry-After` inflation | Moderate/high | Fixed; retain | A valid ordinary response could manufacture an excessive wait; the canonicalization is cheap and reusable. |
| Pre-1900 HTTP-date rejection | Low | Completed behavior retained | The provider-impossible case has bounded consequence; completed work is not rolled back. |
| Keyword-only prohibited-topic blocking | Negative | Do not implement | Bespoke complexity creates false positives and trivial evasions while reducing semantic fidelity. |
| Deterministic language detection as sole language gate | Negative | Do not implement | Short and mixed text makes a bespoke detector unreliable; a resettable confirmation is clearer and bounded. |
| Point-of-use disclosure and source-specific confirmation | High | Fix now | Ordinary visitors otherwise cannot understand model participation, limitations, or the authority boundary. |
| Machine-enforced held publication | High | Fix now | It converts a prose warning into a reusable lifecycle control for every future revision. |
| Full WASM build record or controlled replacement | High | Required before enablement | Executable supply-chain integrity and license disposition have plausible security and maintenance consequences. |

The rule is not “ignore edge cases.” It is: repair when consequence × plausibility × lifecycle value justifies the change. Novel findings remain eligible; nonconsequential novelty does not acquire release priority merely by being difficult.

## Requalification boundary

Re-run this decision after any model, tokenizer, runtime, WASM, Llama-terms, prompt, safety schema, candidate-release, origin, provider, lease, storage, telemetry, accessibility-critical, source-revision, or artifact-digest change. Record the site owner's decision only after the evidence names the exact candidate revision and artifacts. Until then, documentation is publishable; inference is not.
