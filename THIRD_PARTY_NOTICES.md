# Third-party notices

The active Text to Lattice capability begins only when a visitor explicitly chooses **Process with external service**. The browser sends one same-origin `POST /api/lattice` request with exactly three JSON fields: `{text, requested_mode, schema_version: 1}`. Server-side hah.dev code creates bounded prompts and calls the Hugging Face Inference Providers router, configured for Featherless AI, with Qwen3-4B as the fixed generator and Llama 3.2 3B Instruct as the fixed verifier. It does not automatically select another provider or model.

hah.dev application code does not store source text, prompts, candidates, raw provider bodies, or results; write raw-content logs; cache or queue that content; or send it to analytics. The response uses `Cache-Control: no-store`, and the application defines no response cache. Timeouts, rate limits, provider unavailability, malformed output, and other failures terminate with a bounded machine-readable error: the browser does not retry automatically, and another attempt requires a new deliberate submission. Submitted text nevertheless leaves hah.dev and is processed by Hugging Face, Featherless AI, and their infrastructure under their own policies. Do not submit classified, controlled, privileged, export-controlled, operationally sensitive, or otherwise restricted information.

## Active site and remote capability

| Component | Resolved version or service identity | Upstream | Terms or notice |
| --- | --- | --- | --- |
| React and React DOM | 19.2.8 | https://github.com/react/react | [MIT License](LICENSES/MIT-React.txt) |
| Vinext | 1.0.0-beta.9 | https://github.com/cloudflare/vinext | [MIT License](LICENSES/MIT-vinext.txt) |
| Bootstrap | 4.6.2 | https://github.com/twbs/bootstrap | [MIT License](LICENSES/MIT-Bootstrap.txt) |
| Jost | Font files distributed through `@fontsource/jost` 5.3.0 | https://github.com/indestructible-type/Jost | [SIL Open Font License 1.1](LICENSES/OFL-1.1-Jost.txt) |
| Qwen3-4B generator | `Qwen/Qwen3-4B:featherless-ai`; provider-managed serving revision | https://huggingface.co/Qwen/Qwen3-4B | The upstream Qwen3-4B model is [Apache-2.0](LICENSES/Apache-2.0.txt). |
| Llama 3.2 3B Instruct verifier | `meta-llama/Llama-3.2-3B-Instruct:featherless-ai`; provider-managed serving revision | https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct | Governed by the [Llama 3.2 Community License](LICENSES/Llama-3.2-Community-License.txt) and [Acceptable Use Policy](LICENSES/Llama-3.2-Acceptable-Use-Policy.md). |
| Hugging Face Inference Providers router | Provider-managed chat-completions service | https://huggingface.co/docs/inference-providers/en/tasks/chat-completion | External service governed by the upstream [terms](https://huggingface.co/terms-of-service) and [privacy policy](https://huggingface.co/privacy); no service code or provider runtime is distributed here. |
| Featherless AI provider | Fixed provider selected through the Hugging Face router | https://huggingface.co/docs/inference-providers/en/providers/featherless-ai | External service; upstream provider and platform policies apply. |

The active provider-managed weights, tokenizers, kernels, structured-output implementation, and serving configuration are not asserted to be byte-for-byte equivalent to the historical MLC artifacts below. The active model and service materials are not works authored by Hayden Howard. Upstream model cards, service terms, privacy policies, licenses, and acceptable-use policies remain controlling; no hah.dev record supersedes them.

## Historical browser-local implementation — inactive

The following packages and artifacts are still distributed or documented for license compliance and provenance. The WebLLM/MLC inference path, model downloads, WebGPU runtime, bodyless quota lease, renewal/release lifecycle, and Turnstile attestation frame are inactive and do not govern `POST /api/lattice`.

| Historical component | Resolved version or pinned revision | Upstream | Terms supplied here |
| --- | --- | --- | --- |
| MLC WebLLM | 0.2.82 | https://github.com/mlc-ai/web-llm | [Apache License 2.0](LICENSES/Apache-2.0.txt) |
| MLC Web Tokenizers | 0.1.6 | https://github.com/mlc-ai/tokenizers-cpp | [Apache License 2.0](LICENSES/Apache-2.0.txt) |
| MLC Web XGrammar (bundled structured-output runtime) | 0.1.27 | https://github.com/mlc-ai/xgrammar | [Apache License 2.0](LICENSES/Apache-2.0.txt) |
| loglevel | 1.9.2 | https://github.com/pimterry/loglevel | [MIT License](LICENSES/MIT-loglevel.txt) |
| Qwen3 4B generator, historical MLC build | a5c9fab855e3ccbdfed2e7e69683d75f30332161 | https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC | The Qwen/Qwen3-4B base model is [Apache-2.0](LICENSES/Apache-2.0.txt); the MLC artifact repository does not attach separate license metadata. |
| Llama 3.2 3B verifier, historical MLC build | 1e80abf71e3d17cd564e2d2b63caa15cb226018e | https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC | The base model and derivatives remain governed by the [Llama 3.2 Community License](LICENSES/Llama-3.2-Community-License.txt) and [Acceptable Use Policy](LICENSES/Llama-3.2-Acceptable-Use-Policy.md); the MLC artifact repository does not attach separate license metadata. |
| Historical MLC WebGPU model libraries | 025bcaf3780fa8254f5e5efd3bfea0a5397248f4 | https://github.com/mlc-ai/binary-mlc-llm-libs | Inactive runtime-downloaded code retained for provenance. The pinned binary repository does not publish a standalone root license; exact identity and partial lineage are recorded below, while reproducibility and artifact-level notice disposition remain historical residuals. |

The historical Qwen and Llama MLC rows describe compiled browser artifacts, not models authored by Hayden Howard. They do not identify the active provider-served model bytes.

The historical Qwen WASM is 6,070,240 bytes with SHA-256 `5ddf44e49b03e53e24fd29a45591850924346140452f60c29280190388571340` and git blob `449f3615aa712b22e548f5ad91bb9fbee0c12259`. The historical Llama WASM is 6,131,270 bytes with SHA-256 `34de0d60ab598c6a85ae882b48474f250193076f902057a21070bb2daae96d5b` and git blob `beda4ea1d45dc6c5294972b3ea3edfd317462142`. Both historical blobs were finalized in `a973639103dd389292a0315274495cb1bc406c7c`, after the recorded TVM revision, entered through [upstream PR #158](https://github.com/mlc-ai/binary-mlc-llm-libs/pull/158), and remain unchanged at the pinned binary-repository revision. The pull request names TVM source `c8515e1ddfaf4d1afff916c484e68e1513631dd6` and MLC-LLM source `4084e7fe7532fb932810d8b707f2d760eefd0dea`. Those facts establish exact byte identity, plausible chronology, and recorded source lineage for the inactive browser runtime. They do not establish the exact clean checkout, compiler, locked dependency graph, commands, flags, a matching clean rebuild, or a standalone binary-repository license grant. The historical helper also calls a Qwen preset absent from the recorded MLC-LLM revision and leaves Python and Cargo resolution unlocked.

The checked-in Llama 3.2 license and acceptable-use policy are byte-identical to the reviewed official files: SHA-256 `8cc15535a8a34b41888f644b339a1a9eb428af793a4f5e24df58a3e5b1487d74` and `40e2777d7faa6beaf98400654170f414d8ab29b921b5163ad4ea0a1d39894201`. Current canonical sources are Meta's [Llama 3.2 license](https://developer.meta.com/ai/llama3_2/license/) and [acceptable-use policy](https://developer.meta.com/ai/llama3_2/use-policy/).

See the [release qualification](/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md) and [machine-readable release register](/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json) for the historical browser-local qualification record and its separated behavioral, model-artifact, WASM, deployed-service, accessibility, and privacy gates. Those records do not qualify or identify the active provider-served bytes.

Built with Llama.

Llama 3.2 is licensed under the Llama 3.2 Community License, Copyright © Meta Platforms, Inc. All Rights Reserved.
