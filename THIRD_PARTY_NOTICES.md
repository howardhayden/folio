# Third-party notices

The qualified Text to Lattice client is designed to run locally in a supported browser. The public site bundle includes the conversion dialog and its browser-local clients; pinned model, tokenizer, and WebAssembly assets are downloaded from their public upstream hosts only after the user starts the tool. The inventory below binds the enabled implementation's dependencies; it is not a claim that every row executes on every visit.

| Component | Resolved version or pinned revision | Upstream | Terms supplied here |
| --- | --- | --- | --- |
| React and React DOM | 19.2.8 | https://github.com/react/react | [MIT License](LICENSES/MIT-React.txt) |
| Vinext | 1.0.0-beta.9 | https://github.com/cloudflare/vinext | [MIT License](LICENSES/MIT-vinext.txt) |
| Bootstrap | 4.6.2 | https://github.com/twbs/bootstrap | [MIT License](LICENSES/MIT-Bootstrap.txt) |
| MLC WebLLM | 0.2.82 | https://github.com/mlc-ai/web-llm | [Apache License 2.0](LICENSES/Apache-2.0.txt) |
| MLC Web Tokenizers | 0.1.6 | https://github.com/mlc-ai/tokenizers-cpp | [Apache License 2.0](LICENSES/Apache-2.0.txt) |
| MLC Web XGrammar (bundled structured-output runtime) | 0.1.27 | https://github.com/mlc-ai/xgrammar | [Apache License 2.0](LICENSES/Apache-2.0.txt) |
| loglevel | 1.9.2 | https://github.com/pimterry/loglevel | [MIT License](LICENSES/MIT-loglevel.txt) |
| Qwen3 4B generator, MLC build | a5c9fab855e3ccbdfed2e7e69683d75f30332161 | https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC | The Qwen/Qwen3-4B base model is [Apache-2.0](LICENSES/Apache-2.0.txt); the MLC artifact repository does not attach separate license metadata. |
| Llama 3.2 3B verifier, MLC build | 1e80abf71e3d17cd564e2d2b63caa15cb226018e | https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC | The base model and derivatives remain governed by the [Llama 3.2 Community License](LICENSES/Llama-3.2-Community-License.txt) and [Acceptable Use Policy](LICENSES/Llama-3.2-Acceptable-Use-Policy.md); the MLC artifact repository does not attach separate license metadata. |
| MLC WebGPU model libraries | 025bcaf3780fa8254f5e5efd3bfea0a5397248f4 | https://github.com/mlc-ai/binary-mlc-llm-libs | Available to the bounded interactive release as runtime-downloaded code. The pinned binary repository does not publish a standalone root license; exact identity and partial lineage are recorded below, while reproducibility and artifact-level notice disposition remain accepted residuals. |

The Qwen and Llama rows describe runtime-downloaded compiled model artifacts, not models authored by Hayden Howard. Upstream model cards and terms remain controlling. No project claim supersedes a third-party license, acceptable-use policy, attribution, or restriction.

The current Qwen WASM is 6,070,240 bytes with SHA-256 `5ddf44e49b03e53e24fd29a45591850924346140452f60c29280190388571340` and git blob `449f3615aa712b22e548f5ad91bb9fbee0c12259`. The current Llama WASM is 6,131,270 bytes with SHA-256 `34de0d60ab598c6a85ae882b48474f250193076f902057a21070bb2daae96d5b` and git blob `beda4ea1d45dc6c5294972b3ea3edfd317462142`. Both current blobs were finalized in `a973639103dd389292a0315274495cb1bc406c7c`, after the recorded TVM revision, entered through [upstream PR #158](https://github.com/mlc-ai/binary-mlc-llm-libs/pull/158), and remain unchanged at the pinned binary-repository revision. The pull request names TVM source `c8515e1ddfaf4d1afff916c484e68e1513631dd6` and MLC-LLM source `4084e7fe7532fb932810d8b707f2d760eefd0dea`. Those facts establish exact byte identity, plausible chronology, and recorded source lineage. They do not establish the exact clean checkout, compiler, locked dependency graph, commands, flags, a matching clean rebuild, or a standalone binary-repository license grant. The historical helper also calls a Qwen preset absent from the recorded MLC-LLM revision and leaves Python and Cargo resolution unlocked.

The checked-in Llama 3.2 license and acceptable-use policy are byte-identical to the reviewed official files: SHA-256 `8cc15535a8a34b41888f644b339a1a9eb428af793a4f5e24df58a3e5b1487d74` and `40e2777d7faa6beaf98400654170f414d8ab29b921b5163ad4ea0a1d39894201`. Current canonical sources are Meta's [Llama 3.2 license](https://developer.meta.com/ai/llama3_2/license/) and [acceptable-use policy](https://developer.meta.com/ai/llama3_2/use-policy/).

See the [release qualification](/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md) and [machine-readable release register](/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json) for the separated behavioral, model-artifact, WASM, deployed-service, accessibility, and privacy gates.

Built with Llama.

Llama 3.2 is licensed under the Llama 3.2 Community License, Copyright © Meta Platforms, Inc. All Rights Reserved.
