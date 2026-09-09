# Third-party notices

Text to Lattice runs locally in a supported browser. The site bundle includes the application framework and presentation components below. Its application bundle also includes the inference and tokenizer runtimes, and the browser downloads the pinned model and WebAssembly assets from their public upstream hosts when the tool is used.

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
| MLC WebGPU model libraries | 025bcaf3780fa8254f5e5efd3bfea0a5397248f4 | https://github.com/mlc-ai/binary-mlc-llm-libs | Used through WebLLM; the pinned binary repository does not publish a standalone root license file. |

The Qwen and Llama rows describe runtime-downloaded compiled model artifacts, not models authored by Hayden Howard. Upstream model cards and terms remain controlling. No project claim supersedes a third-party license, acceptable-use policy, attribution, or restriction.

Built with Llama.

Llama 3.2 is licensed under the Llama 3.2 Community License, Copyright © Meta Platforms, Inc. All Rights Reserved.
