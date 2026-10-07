# Text to Lattice development handoff — 2026-10-07

Work stopped at the owner's request to preserve the remaining usage allowance. Continue from this checkpoint when instructed. The public client remains held; this document grants no deployment or release authority.

## Current delivery

- Repository: `howardhayden/folio`; requirements authority: `howardhayden/requirements`, main `5a12659150eaa33fb91810176ef775ab29bab976` at the last read.
- Branch: `fix/lattice-retention-regeneration-feedback`.
- Reviewed implementation commit: `d23f2b57ab4e57e0abd1006c42c160ed583d76bc`; tree: `def419ccfe967d54a0c1f41a2b2a7421fe4f1469`.
- PR: https://github.com/howardhayden/folio/pull/114 — pushed and open, not merged.
- Main baseline: `c35b1ed89458c8c4dab0884303b4ad91675ce0dd` (PR #113).
- Qualified source: `b624133582f3303be892a31f9af2a0d550ade468d0401b46d850c9c208a80d27`, 241 files.
- Dossier: `ce63e2e1ccdff7b1d9ff1050c3763716446ded3acd0592dd14d6b14dc6c5d6d3`.
- This handoff is a separate documentation-only commit after the reviewed implementation. It is outside the qualified source inventory and changes no product behavior or release register. Its new Git head still needs its own CI observation; do not call the earlier implementation tree identical to the handoff tree.

## Last actual qualification

Run #289, attempt 1, https://github.com/howardhayden/folio/actions/runs/37596920429, failed on main `c35b1ed` after six provider calls. The final regenerated rewrite matched the source exactly and was correctly withheld by D14. The host recorded initial retained plan, initially clear deterministic checks, retained-conformance structural retry, committed retain override and regeneration lineage. Certification was not reached. These finite host observations do not establish a raw verifier verdict, provider motive or unique cause. This run did not reach the D25 output-limit observation.

Original rollback at `08:58:45.739Z` and final API enforcement at `08:59:09.357Z` each observed three held responses, zero active responses and zero errors. Held Pages passed at `08:58:56.241Z`. These are timestamped samples. Successful live/admission/complete usage, after-environment and deployment-index evidence are absent. GATE-02, GATE-03 and GATE-06 remain open.

## D26 implementation and validation

Tracing ruled out stale source, stale replacement plan and an incorrect generation stage. The concrete omission was that generation lost the specific fact that prior unchanged retention was unconfirmed when initial D14 was clear. D26 carries only `retentionNotConfirmedPassagePositions` into the existing regeneration prompt, bound temporarily to the actual request, batch, normalized prior review and replacement rewrite analysis. The adapter transfers context through its mode-only request copy; all aliases expire after the attempt. Authentic prior D14 feedback stays separate. Existing acceptance and materiality checks remain intact. This corrects omitted context, not a demonstrated unique cause of copying.

Completed:

- 52 focused author tests and 12 additional independent controls passed; implementation review found no issues.
- Full validation: 2,370 passed, 15 optional fixtures skipped, zero failures (2,385 total). Required verifier tokenizer capacity, generator reference tokenizer, lint, typecheck/build, documentation/source/site checks passed.
- All three Worker dry-run builds passed against 129 byte-verified inputs.
- Independent documentation review verified the exact source and dossier, 944 preserved historical entries plus 10 additions, 17 public artifacts, four mirrors and unchanged rights/release gates.
- Exact-commit local workerd/SQLite test passed with six intercepted synthetic provider calls and one stored admission after withholding and disposal. The new cue reached only regeneration; a copied candidate still failed D14. The first sandboxed attempt failed before any provider calls with a finite Error; the identical harness passed with local runtime permissions. The first error's precise cause remains unproved. **Independent review of this runtime result is still pending.**
- Offline collector and browser-assembler import manifests were refreshed and independently reviewed. Graph sizes are 23 and 42. Only three existing imports and the new helper changed. Collector/parser/assembler behavior and native bundles are unchanged; exact predecessor bytes were retained.

CI run #290 (`37600303289`) was in progress for implementation commit `d23f2b5` at the last observation. No CI success is claimed here. The handoff commit will create a newer PR CI run.

## Resume sequence

1. Read this handoff and the local continuation status; inspect actual branch/head, PR #114, current main and requirements. Preserve any newer user work.
2. Independently review the retained exact-commit local runtime result, including the failed first attempt, successful receipt, original sidecar, source/module/tool guards, one admission and cleanup. No new runtime run is needed absent a concrete concern.
3. Verify CI for the actual final PR head. If checks and review pass, merge the reviewed held-source change under the standing GitHub authority. Verify merged source identity and original routine held-publication artifacts.
4. Prepare and independently review one deliberate U27/D26 whole-service qualification packet, exact current merged identities, fresh held/source checks, original artifact collectors and durable pre-dispatch consumption. The prospective D26 packet currently has used 0 / remaining 1, but is **not dispatch-ready**. No D26 workflow dispatch has occurred. Do not blindly retry or replenish earlier consumed grants.
5. Collect original result/custody and actual held restoration; reassess the real outcome before choosing more work. Do not infer live success from synthetic tests.
6. Only after accepted service prerequisites, use the existing U13 guarded canonical browser activation procedure. That workflow itself performs the current-source canary/index before exposing Pages. Do not invent a separate source-equivalence exception or extra paid probe.

## Browser work still open

Firefox passed 14 input checks; the reported inability to click in the input was not reproduced. Safari and Brave passed earlier limited local lifecycle/reload checks, but canonical network, persistence and native-pixel proof remains incomplete. Safari's two unavailable cached-image metrics retain their limits. Native capture tooling has reviewed document-CSP and scoped Safari interval support. Root owns native UI actions; agents must not manipulate browsers in parallel. Read the current operation addendum and frozen installer references before capture. Previous cleanup stopped local test servers and restored Safari's temporary “Allow Inspecting Web Inspector” setting to off at its recorded observation; inspect actual state before resuming UI work.

## Fixed boundaries

Keep generator `Qwen/Qwen3-235B-A22B-Instruct-2507:deepinfra`, verifier/certifier `meta-llama/Llama-3.1-8B-Instruct:nscale`, the existing Hugging Face endpoint, strict schemas, 32-call ceiling, 240-second total deadline, stage token/time limits, admission and quota policy, semantic/materiality/conformance acceptance, privacy and rights unchanged. No raw source/candidate/provider-body, cookie or secret retention. No new fallback, automatic repeat or public release. The user's continuing iteration authority permits necessary scoped corrections and reviewed bounded qualifications, not arbitrary model/provider changes or final public release.

## Local evidence locations

Workspace: `/Users/howie/Documents/Codex/2026-10-04/using-github-is-approved-across-this`.

Evidence is under `work/evidence/`; these local receipts are not included in the public repository:

| Receipt | SHA-256 |
|---|---|
| `d26-reviewed-commit.json` | See local exact receipt; binds the reviewed implementation and 18 changed files. |
| `d26-full-local-validation.json` | `dc4a6483fe903068c4f43dda921f959de155c8b6f007215806f9a3ea80f12270` |
| `d26-implementation-independent-review.json` | `eb38b9dbb1276b2b7205f7cfa301af2d60793f71e95810369f4165103eff6ce4` |
| `d26-docs-independent-review.json` | `69be9738095ca4bed222db797037bd9074a647d9234f45030278761c40157f06` |
| `d26-scoped-runtime-plan-independent-review.json` | `2ed0e572acfd3daa036126471d42b7609661ec8c63e8128eccad4ccd474b5d7f` |
| `d26-scoped-local-runtime-receipt.json` | `279c3afc9f43386cb01fb9d75cb4294d90d85c5427cee86b89486820294cd017` |
| `d26-offline-import-refresh-independent-review.json` | `1a8d07edd17eed0ae61119756e7b37e1ce8347105c7b59fe1fa7ba1faa024423` |
| `run289-independent-semantic-review.json` | `9e59b471c7e779648d890ea398491539c6cf2fddd9cca6ca69075c023d7a39ce` |

Also retain `u27-d26-implementation-packet.json`, `d26-runtime-collection.json`, `d26-runtime-environment-retry.json`, the original runtime archives in `work/gate03-harness/`, `d26-before-offline-import-refresh/manifest.json`, both run289 ZIPs, and `pr114-ci-observation-001.json`. The original finite collector timestamp refusal and later correction remain preserved; the discarded first read does not prove its precise timestamp or cause.

Native runbook: `work/native-collector/canonical-safari/operation-runbook.txt`; current addendum: `work/native-collector/canonical-proof-preparation/operation-addendum.txt`. The current offline dependency manifests have D26 bindings; the unchanged native bundles retain their earlier reviewed identity. No native capture or paid qualification occurred during this handoff.
