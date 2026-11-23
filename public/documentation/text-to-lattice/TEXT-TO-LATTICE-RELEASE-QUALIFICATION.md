# Text to Lattice release qualification — qualified

Text to Lattice is qualified for short, non-sensitive passages. Safari and Brave cleared the visitor path, and the site owner accepts occasional provider refusal and imperfect wording. Confirm external processing and compare the result with your original before relying on it.

The November 23 production check accepted the original passage in 10.563 seconds. The protected Pages publication delivered that build. [Service check](https://github.com/howardhayden/folio/actions/runs/45255468630) · [Publication receipt](https://github.com/howardhayden/folio/actions/runs/45259201772) · [Evidence by claim](https://hah.dev/documentation/text-to-lattice/evidence.html)

## One-off capacity decision

The owner approved one application usage reset followed by one additional ordinary deployment. At 19:56:38 UTC on November 23, the application’s ordinary count changed from 30 to 0 and qualification excess remained at 0. A separate readback found both usage keys absent and the charged-day alarm cleared.

This one-off reset permits up to 30 further global admissions before the next UTC-day reset, with the ordinary three-per-cooperating-cookie-jar limit in the reset ledger. Earlier usage and any provider charges remain separate from the reset. The 30/3 admission rules, 32-call request bound, consent and refusal behavior remain in force. Actual tokens and rates determine the bill.

Each ordinary publication must pass its own production service check before interactive Pages are published. For the November 23 documentation update, the owner approved publishing reviewed editorial changes against the successful production check and the deployed converter and Worker source. The accepted Safari and Brave traces and the dated Firefox checks retain their existing scopes. The exact reset operation and original evidence are recorded in the appendix.

## What decided the release

Earlier windows exposed two different failure modes. An unavailable provider could stop a request before review. When a draft changed meaning or failed certification, the service withheld it. Those outcomes justified an explicit refusal in the interface and a check on the actual visitor path.

Both browsers completed that path on the same deployment. Safari returned a translation and focused the output 18 ms after response completion. Brave found the wording already suitable for its context and focused it 52 ms after response completion. Each sent one content-free setup request and one request containing the passage. After a hard reload, each showed an empty input and output. The earlier backend qualification and fourteen Firefox input checks stand.

The site owner accepted the original browser evidence after a file-by-file comparison with the release candidate. Repeating the browser cases would exercise the same converter and spend additional public capacity. The fingerprints, original traces and approved differences are in the appendix.

## Operating decision

**The site owner accepts intermittent refusals and imperfect wording for this demonstrator.** Use a short passage you are entitled to share, then compare the result with your original before relying on it. Typing stays local until you confirm external processing. Hugging Face routes the passage through OpenRouter to DeepInfra for drafting and CoreWeave for review. hah.dev keeps no copy of your passage or result. The external services apply their own processing and retention terms.

**The owner limits the work a visitor can initiate.** Ordinary production admits 30 transformations globally per UTC day and 3 per cooperating browser cookie jar per UTC day. A request can use at most 32 provider calls, so the ordinary daily allowance admits up to 960 call opportunities. The one-off reset above permits additional work that day. A later service check took 8.49 seconds and five calls, with an estimated token cost of about $0.0062 for that passage. The budget limits work, and the bill depends on actual tokens and rates.

**The maintainer withdraws the converter if consent, privacy, admission or result clearing fails.** A routine upstream refusal ends the individual request. The maintainer verifies both the API and public page when restoring held service and reassesses the affected behavior before publication resumes.

## Evidence appendix

The machine register binds the release candidate and the original browser deployment separately. It records the decision rule as consequence × plausibility × lifecycle value.

**Qualification date:** 2026-11-23

**Reviewed baseline:** `b211964213cd49e8335a73bcbebce3221c3a6bc2`

**Machine authority:** [`TEXT-TO-LATTICE-RELEASE-REGISTER.json`](TEXT-TO-LATTICE-RELEASE-REGISTER.json)

**Qualified source-set SHA-256:** `57a18fb42a14480084758b80ae0e5e7a4eefc763dbf2df4cb5f8f3c5366f151e`

**Artifact-set projection SHA-256:** `58e9c64506ecb739ca2a5b6a5dbf142d988fc95e9178115e0f2bed9dd120b644`

| Gate | Status | Marginal value |
| --- | --- | --- |
| GATE-01 · Exact release artifact | Release workflow enforced | High |
| GATE-02 · Remote API origin, secret, and privacy boundary | Satisfied in production | High |
| GATE-03 · Remote provider capacity and cost boundary | Satisfied in production | High |
| GATE-04A · Llama behavior and public-use controls | Accepted residual risk | Moderate |
| GATE-04B · Historical inactive Llama MLC-artifact provenance | Historical inactive | Moderate |
| GATE-04C · Historical inactive WASM provenance and license boundary | Historical inactive | Moderate |
| GATE-05 · Manual interaction and accessibility | Accepted residual risk | Moderate |
| GATE-06 · Remote production lifecycle and privacy trace | Satisfied in production | High |

Accepted structured browser evidence docs/text-to-lattice/browser-evidence/ttl-browser-20261123T143941Z-a495af12/TEXT-TO-LATTICE-BROWSER-EVIDENCE.json, SHA-256 b4ebf4345afe1bd90fdc566140fb0f83c11abf3426fbb597e2610e5d45ce9595, binds supported-browser Safari/WebKit sanitized capture with SHA-256 6eee316114d5caa67cb4d025a83dd45c96601868fbe995e2f38c697fc2872c05 and Brave/Chromium sanitized capture with SHA-256 ff6d4051975dcea7050f8e6a400d965bd67a2d482853f5bb1ca3fc2c4e88b9a7, deployed commit 6166a3f430338331ca3f0336450e500571cbb896, a non-error terminal result, and exactly one content-bearing POST /api/lattice after the bodyless setup per engine.

### Current capability projection

Under the same origin-wide browser Web Lock, a bodyless same-origin `POST /api/lattice` with `Accept: application/vnd.hah.text-to-lattice-visitor-session.v1+json` sets up the visitor session. Setup makes no quota claim or provider call. An HTTP 204 allows exactly one content-bearing request. A missing cookie returns `428 visitor_session_required` before Durable Object admission or provider work. The browser performs no automatic retry and the service has no alternate provider or model fallback. The models are provider-managed and their serving bytes are not byte-pinned. The browser capture used an operator-ended window with a null qualification expiry.

These are the register’s current capability values, including the exact request schema, selected model identifiers, server-only `HF_TOKEN` and `VISITOR_COOKIE_SECRET` binding names, `__Secure-hah-lattice-api-visitor` cookie boundary, provider timeouts and output limits. Secret values and cookie values are not evidence fields.

- The qualified service accepts POST requests at `/api/lattice`, with schema version 1 and fields `text`, `requested_mode` and `schema_version`. Available modes are `auto`, `operative` and `experiential`.
- Both stages use https://router.huggingface.co/v1/chat/completions. The generation model is `Qwen/Qwen3-235B-A22B-Instruct-2507:deepinfra`. Review and certification use `meta-llama/Llama-3.3-70B-Instruct:coreweave`. The runtime revision is `provider-managed-not-byte-pinned`.
- The complete request has 240 seconds. Stage deadlines are 120,000 ms for analysis, drafting, repair and certification, and 180,000 ms for verification.
- Requested output tokens per call are 2,048 for analysis and verification, 800 for drafting and repair, and 520 for certification. The ceilings are 65,536 requested output tokens per admission, 196,608 per cooperating cookie jar per UTC day and 1,966,080 globally per UTC day.
- Application handling is recorded as “no application storage, raw-content logs, cache, queue, or analytics for source, prompts, candidates, raw provider bodies, or results”.
- Hugging Face, OpenRouter, DeepInfra and CoreWeave process submitted text after confirmation. DeepInfra describes deletion of ordinary inputs and outputs after inference. Its terms allow temporary in-memory caching, operational metadata, and legal or elected-feature exceptions. With written authorization, DeepInfra may retain data to resolve a support issue. It deletes that data within 30 days after resolving the issue. OpenRouter can retain metadata, categorize prompts and retain content for safety or legal reasons. Its settings for the Hugging Face route are unknown. CoreWeave describes zero retention by default. Tracing settings for this route are unknown.

### Current-to-captured source comparison

The documentation revision and the browser capture share 267 qualified paths. 255 are byte-identical. This update explains how the Cloudflare edge Workers control access and cost. The preceding documentation release and this edition have byte-identical Workers, converter and résumé components. The [preceding documentation comparison](https://github.com/howardhayden/folio/blob/c04dac7d51afb17566039c2dcd270009f16b58f3/docs/release-evidence/text-to-lattice/nov23-architecture-source-comparison.json) and [original production comparison](https://github.com/howardhayden/folio/blob/784cc7c62f20a073986bae09a174ca688fb6608f/docs/release-evidence/text-to-lattice/run-729-source-comparison.json) retain the earlier decisions.

The current fingerprint is `57a18fb42a14480084758b80ae0e5e7a4eefc763dbf2df4cb5f8f3c5366f151e`. The original captured fingerprint is `0b3cd95947daa3a53ef731745c95dbaa3d0514799333087462d657e356f4faaa`. The repository appendix `docs/release-evidence/text-to-lattice/nov23-architecture-source-comparison.json` contains 946,838 bytes (SHA-256 `7d934e93afe137ec6d9f1bbf1761f02b560aac850a0d6f791ef02179df0d1ec9`) and retains each original beforeimage.

| Qualified path | Captured SHA-256 | Documentation revision SHA-256 |
| --- | --- | --- |
| `app/projects/lattice/text-to-lattice/page.tsx` | `1c64e9eb0fad6de81fecd8702d4adc2a6167fbd68a98246d9b385f58002518c8` | `08d4ba950643d347a4be1903faf4c8b13baf56e4296f8f25ed57a7a7c6093870` |
| `scripts/verify-text-to-lattice-release.mjs` | `e171b7997594b9330bd2bf75a4b282b5bdd3512ba226bdf2da5cc722783d848a` | `0dd579abc50bd5fb714d8936c7a2084f181cea47f915fff59bfe57979db48e3c` |
| `tests/lattice-documentation.test.mjs` | `66a6dc7a5c26c4d25afbd39bec5f7f4f93cdb7e66160022d6ef90fa60a3da28e` | `c4ec022476a6aea7c43ffaeb8cc813bd7d24093dd33f463904160c8bbcdcde8d` |
| `tests/lattice-release-boundary.test.mjs` | `7c50db000140269e6772e7746b84fdc280a4a4d2c666d674f500ca74a2bf1114` | `b8c71d865c0edcdf9f5dd86e20e837069bc6af2f0a7ea61067512b2bcefdbb7f` |
| `.github/workflows/pages.yml` | `c23120677b068f817ad2a1261e76db63bc3ac0013d2e7426d46d7cf0b52792fd` | `f40a09196adc6423f6148d69e32899e9bf0a94a21c98d0656d6ff71fd82e376d` |
| `app/content/projectDocuments.js` | `261c3150e2b68cc0c6944da91c29dca26544ec73126de52dbff195ed6a9c7251` | `a7e92316b513757b6a19ece0fbc2fd4390e08d3c8766edc146c61184e4d21ca3` |
| `app/projects/[slug]/page.tsx` | `d9c197e75d35c3522104367272ab426f8c9bdec2253b7a619eecd2a47f4abf62` | `02b7b92a48aeee4a963986c3c14e4c964c472c9450e809382c7b3f804ec9cdbb` |
| `app/semantic/portfolio.js` | `7fcc144c8b57b75973b78ce43c9a407ac85d941d0ed8271c4e94b82c7195ffe6` | `8506fd4f7d49f5b6ab672b5ba00265c39774c4e71ff035fee70beaa82462380c` |
| `scripts/docs/build-text-to-lattice-documentation.mjs` | `69908da7315c7d07500b18196cfe76912d3c58560510aec7a3b3a1474f810afc` | `9de393af9459626e99c7562aaa8d3a22fd7640535a9ef5d5a6319aa83091469e` |
| `tests/lattice-deployment-workflow.test.mjs` | `3ff5d963b27488cac81ca7689636755ec9a6774dc8510387d688328fec541089` | `366acd4a9aedfd2fb36667557b75942e91c67b698c7097a245aa1fe293f35364` |
| `app/resume/ProjectDescriptionDisclosure.tsx` | `5e75a6ab95b261ea2ff77c5012998f618126de1c59456acde2310b663b174e89` | `cef3f61fa66e2ceeb91cb61f8d236751c9d6f2e4688062bb496741110541d832` |
| `app/resume/ResumeProjects.tsx` | `42b88aa9be93601a305f266f2948722f401dc17d712293fee6e6ea78bffa7db4` | `0c33c2c88a96f29ff17cd0e29d191f22c252ea4ff4677bafdbd62aa55f379ef6` |

### Captured identity and five immutable files

| Typed evidence field | Original value |
| --- | --- |
| Capture deployment commit | `6166a3f430338331ca3f0336450e500571cbb896` |
| Capture qualified source-set SHA-256 | `0b3cd95947daa3a53ef731745c95dbaa3d0514799333087462d657e356f4faaa` |
| Capture qualification dossier SHA-256 | `73010ba48731d3cfc8384685249c1ab91c3b246e23eab620e5b95235cdcdcb30` |
| Capture site TAR SHA-256 | `7fd5737cfeef573178daafe5059a363307898d5eacc179927fcc09a7f9fe5385` |
| Capture workflow / attempt | `45188974550` / `1` |
| BEFORE / AFTER checks, UTC | `2026-11-23T14:02:45.044Z` / `2026-11-23T14:26:49.488Z` |

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `TEXT-TO-LATTICE-BROWSER-EVIDENCE.json` | 24,252 | `b4ebf4345afe1bd90fdc566140fb0f83c11abf3426fbb597e2610e5d45ce9595` |
| `TEXT-TO-LATTICE-DEPLOYMENT-EVIDENCE.before.json` | 3,724 | `4033050542df2254a1eef5c63de256dcbd6d6b9b82a123aa5c75cae50151d951` |
| `TEXT-TO-LATTICE-DEPLOYMENT-EVIDENCE.after.json` | 3,724 | `4033050542df2254a1eef5c63de256dcbd6d6b9b82a123aa5c75cae50151d951` |
| `TEXT-TO-LATTICE-BROWSER-EVIDENCE.safari-webkit.png` | 120,502 | `6eee316114d5caa67cb4d025a83dd45c96601868fbe995e2f38c697fc2872c05` |
| `TEXT-TO-LATTICE-BROWSER-EVIDENCE.brave-chromium.png` | 160,901 | `ff6d4051975dcea7050f8e6a400d965bd67a2d482853f5bb1ca3fc2c4e88b9a7` |

[Open the original browser evidence bundle](browser-evidence/ttl-browser-20261123T143941Z-a495af12/TEXT-TO-LATTICE-BROWSER-EVIDENCE.json). Its two screenshots preserve the reviewed image samples. [Inspect the file comparison](https://github.com/howardhayden/folio/blob/main/docs/release-evidence/text-to-lattice/run-729-source-comparison.json).

### Original runs, dated service evidence and archived history

The Pages workflow resolves the current main branch and requires its exact commit to equal `GITHUB_SHA` at its publication boundaries. An unreadable main ref and a stale workflow commit fail closed. The archive also preserves the earlier production qualification for commit `a9b1db818dc7bb87b5bee16d0e168bf17d130185`. [Historical workflow run](https://github.com/howardhayden/folio/actions/runs/34320931448).

- [Run #729: accepted Safari and Brave pair](https://github.com/howardhayden/folio/actions/runs/45188974550) and [run #730: ordered held restoration](https://github.com/howardhayden/folio/actions/runs/45194346668). The API was verified held at `2026-11-23T14:27:52.607Z`, followed by held Pages at `2026-11-23T14:28:59.464Z`.
- [Run #736: later successful service canary](https://github.com/howardhayden/folio/actions/runs/45213457190) on commit `b211964213cd49e8335a73bcbebce3221c3a6bc2`. Its original `qualification-usage.json` is 2,067 bytes with SHA-256 `0c9acf89a6d41a0570395358748d2b03a3d6ea768313d8b617f9cc7691abe873`. Its `live-boundary.json` SHA-256 is `a4dedb5694d5c070303b974624e3ecc1686da45bbe8e7cf9bab76288e0242112`. Generation used 3,040 prompt and 148 completion tokens. Review used 7,767 prompt and 164 completion tokens. The dated input/output rates in USD per million tokens were 0.135 / 0.825 for generation and 0.71 / 0.71 for review.
- [Run #737: ordered held restoration](https://github.com/howardhayden/folio/actions/runs/45214683657). The original API verification at `2026-11-23T16:17:27.794Z` preceded held Pages verification at `2026-11-23T16:18:59.855Z`. Both jobs succeeded. This closes that qualification opportunity without adding a browser trace.

The [final ordinary attempt](https://github.com/howardhayden/folio/actions/runs/45220488480) returned HTTP 429 at 16:52 UTC. The workflow verified the held API at 16:52:37 and again at 16:53:06 UTC. Interactive Pages publication was skipped. The ordinary error identifies a rate limit. Several layers can return that response.

**Technical history:** The exact preceding dossier is preserved at repository path `../release-evidence/text-to-lattice/qualification-history-2026-11-23.md` and can be read in the [immutable original dossier at b211964213cd49e8335a73bcbebce3221c3a6bc2](https://github.com/howardhayden/folio/blob/b211964213cd49e8335a73bcbebce3221c3a6bc2/docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md). Its 708,796 bytes have SHA-256 `097d59a7779e108788e7d489a6f8123ae03dd92f3909792dc79ae4818a9e7593`. That archive retains the prior run logs and history links, earlier decisions and provider selections, backend #501 and Firefox #479 records, and the historical inactive WebLLM and lease appendix. Those dated records remain historical evidence, not active routes or new observations.

The [previous machine register](https://github.com/howardhayden/folio/blob/b211964213cd49e8335a73bcbebce3221c3a6bc2/docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json) preserves the complete pre-release decision history.

**Prior operational station:** The [qualification account after run #740](https://github.com/howardhayden/folio/blob/f4c24f15050278ae6e94de4ac31e6576fc9d345b/docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md) and [its machine register](https://github.com/howardhayden/folio/blob/f4c24f15050278ae6e94de4ac31e6576fc9d345b/docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json) preserve that dated public hold and then-current decision. The original 429 remains a rate refusal with an unidentified originating layer. At least 32 authenticated earlier admissions support daily exhaustion only under continuity of the same stored ledger.

**Completed application usage reset:** Operation `text-to-lattice-ordinary-usage-2026-11-23-after-740` was applied at `2026-11-23T19:56:38.482Z` to namespace `1427646ecd3a43a6aa4fdf21a419675b`, singleton `text-to-lattice-transformation-budget-v1`. The ordinary count changed from 30 to 0 and qualification excess remained at 0. The separate post-operation readback matched the receipt’s after-state, with both usage keys absent and alarm `null`. The exact aggregate receipt is retained at repository path `docs/release-evidence/text-to-lattice/application-usage-reset-2026-11-23.json` (624 bytes, SHA-256 `038c8986a3eeec5d44f3ad08d1119a9134449e98d6b6ae13351712ead6db2a04`) and in the machine register’s publication decision.

**Final production receipt:** Follow [PR #249](https://github.com/howardhayden/folio/pull/249) for the ordinary production run and verification of the public project page, converter, qualification dossier and machine register. The workflow publishes the interactive page only after its ordinary production request succeeds.
