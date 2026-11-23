# Text to Lattice release qualification — qualified

Text to Lattice is qualified for public use on short, non-sensitive passages. Safari and Brave closed the final release gate by showing that a visitor could consent, receive a checked result and clear it on reload. Publish the converter after its final production service check, with daily admission limits in force.

## What decided the release

Earlier windows exposed two different failure modes. An unavailable provider could stop a request before review. When a draft changed meaning or failed certification, the service withheld it. Those outcomes justified an explicit refusal in the interface and a check on the actual visitor path.

Both browsers completed that path on the same deployment. Safari returned a translation and focused the output after 18 ms. Brave found the wording already suitable for its context and focused it after 52 ms. Each sent one content-free setup request and one request containing the passage. After a hard reload, each showed an empty input and output. The earlier backend qualification and fourteen Firefox input checks stand.

The site owner accepted the original browser evidence after a file-by-file comparison with the release candidate. Repeating the browser cases would exercise the same converter and spend additional public capacity. The fingerprints, original traces and approved differences are in the appendix.

## Operating decision

**The site owner accepts intermittent refusals and imperfect wording for this demonstrator.** Use a short passage you are entitled to share, then compare the result with your original before relying on it. Typing stays local until you confirm external processing. Hugging Face routes the passage through OpenRouter to DeepInfra for drafting and CoreWeave for review. hah.dev keeps no copy of your passage or result. The external services apply their own processing and retention terms.

**The owner limits the work a visitor can initiate.** Ordinary production admits 30 transformations globally per UTC day and 3 per cooperating browser cookie jar per UTC day. A request can use at most 32 provider calls, so the global limit admits up to 960 call opportunities per UTC day. A later service check took 8.49 seconds and five calls, with an estimated token cost of about $0.0062 for that passage. The budget limits work, and the bill depends on actual tokens and rates.

**The maintainer withdraws the converter if consent, privacy, admission or result clearing fails.** A routine upstream refusal ends the individual request. The maintainer verifies both the API and public page when restoring held service and reassesses the affected behavior before publication resumes.

## Evidence appendix

The machine register binds the release candidate and the original browser deployment separately. It records the decision rule as consequence × plausibility × lifecycle value.

**Qualification date:** 2026-11-23

**Reviewed baseline:** `b211964213cd49e8335a73bcbebce3221c3a6bc2`

**Machine authority:** [`TEXT-TO-LATTICE-RELEASE-REGISTER.json`](TEXT-TO-LATTICE-RELEASE-REGISTER.json)

**Qualified source-set SHA-256:** `e9816048c1b14bb73c60e1eff5d1b863d1dfd8d7ce958210b4c170f67bd286e0`

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
- [Run #736: later successful service canary](https://github.com/howardhayden/folio/actions/runs/45213457190) on commit `b211964213cd49e8335a73bcbebce3221c3a6bc2`. Its original `qualification-usage.json` is 2,067 bytes, SHA-256 `0c9acf89a6d41a0570395358748d2b03a3d6ea768313d8b617f9cc7691abe873`; its `live-boundary.json` SHA-256 is `a4dedb5694d5c070303b974624e3ecc1686da45bbe8e7cf9bab76288e0242112`. Generator usage was 3,040 prompt / 148 completion tokens; review usage was 7,767 prompt / 164 completion tokens. The dated input/output rates in USD per million tokens were 0.135 / 0.825 for generation and 0.71 / 0.71 for review.
- [Run #737: ordered held restoration](https://github.com/howardhayden/folio/actions/runs/45214683657). The original API verification at `2026-11-23T16:17:27.794Z` preceded held Pages verification at `2026-11-23T16:18:59.855Z`; both required jobs succeeded. This closes that qualification opportunity without adding a browser trace.

**Technical history:** The exact preceding dossier is preserved at repository path `../release-evidence/text-to-lattice/qualification-history-2026-11-23.md` and can be read in the [immutable original dossier at b211964213cd49e8335a73bcbebce3221c3a6bc2](https://github.com/howardhayden/folio/blob/b211964213cd49e8335a73bcbebce3221c3a6bc2/docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md). Its 708,796 bytes have SHA-256 `097d59a7779e108788e7d489a6f8123ae03dd92f3909792dc79ae4818a9e7593`. That archive retains the prior run logs and history links, earlier decisions and provider selections, backend #501 and Firefox #479 records, and the historical inactive WebLLM and lease appendix. Those dated records remain historical evidence, not active routes or new observations.

The [previous machine register](https://github.com/howardhayden/folio/blob/b211964213cd49e8335a73bcbebce3221c3a6bc2/docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json) preserves the complete pre-release decision history.
