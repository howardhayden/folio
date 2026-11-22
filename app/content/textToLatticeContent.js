import { LOCAL_LATTICE_MODEL as HISTORICAL_LOCAL_LATTICE_MODEL } from "../resume/lattice/modelContract.js";
import {
  LATTICE_FORMAT_CONTROL_LIMIT,
  LATTICE_GRAPHEME_CODE_POINT_LIMIT,
  LATTICE_INPUT_SAFETY_LIMIT,
  LATTICE_INPUT_UTF8_LIMIT,
  LATTICE_TOKEN_CODE_POINT_LIMIT,
  LATTICE_WORD_LIMIT,
} from "../resume/lattice/inputPolicy.js";
import { LATTICE_PROVIDER_CALL_LIMIT } from "../resume/lattice/remoteProtocol.js";
import { LATTICE_BATCH_LIMIT, LATTICE_PASSAGE_LIMIT } from "../resume/lattice/segments.js";
import { LATTICE_USAGE_POLICY as HISTORICAL_LATTICE_USAGE_POLICY } from "../resume/lattice/usagePolicy.js";
import { TEXT_TO_LATTICE_CONTENT_UPDATED } from "../resume/projects.js";

const HUGGING_FACE_CHAT_COMPLETIONS_URL = "https://router.huggingface.co/v1/chat/completions";
const REMOTE_GENERATOR_ID = "Qwen/Qwen3-235B-A22B-Instruct-2507:deepinfra";
const REMOTE_VERIFIER_ID = "meta-llama/Llama-3.3-70B-Instruct:coreweave";
const REMOTE_GENERATOR_REVIEWED_REVISION = "ac9c66cc9b46af7306746a9250f23d47083d689e";
const REMOTE_VERIFIER_REVIEWED_REVISION = "6f6073b423013f6a7d4d9f39144961bfbfbc386b";

// Keep the former lease-policy shape temporarily available to older semantic
// renderers, but mark every use as historical. It does not govern /api/lattice.
const historicalUsagePolicy = Object.freeze({
  ...HISTORICAL_LATTICE_USAGE_POLICY,
  status: "historical-inactive",
  purpose: "Historical, inactive browser-local lease profile retained for provenance only. After explicit confirmation, the current Text to Lattice capability sends one content-free cookie setup POST and then exactly one content-bearing transformation POST to the same-origin /api/lattice path, with a standard 30-transformation global UTC-day limit and 3-transformation ordinary-browser-cookie-jar UTC-day limit. Both daily limits are lifted during the operator-ended browser qualification.",
  endpoint: "/api/lattice",
  requestBody: "The cookie setup POST has no body or Content-Type. The only content-bearing request body is exactly {text, requested_mode, schema_version: 1}. Former bodyless lease fields and lifecycle values below are historical and inactive.",
  sourceTransmission: "Both POSTs occur only after explicit confirmation. Only the second contains submitted text or can initiate external-provider processing.",
  failureMode: "The active capability returns a bounded success or machine-readable error and does not automatically retry or fall back to another provider or model. Former lease limits below are historical and inactive.",
});

export { TEXT_TO_LATTICE_CONTENT_UPDATED };

export const textToLatticeContract = Object.freeze({
  id: "text-to-lattice",
  name: "Text to Lattice",
  canonicalPath: "/projects/lattice/text-to-lattice/",
  lastUpdated: TEXT_TO_LATTICE_CONTENT_UPDATED,
  purpose: "Convert source prose into passage-appropriate Lattice registers while preserving its meaning.",
  heldReleaseNotes: Object.freeze([
    "The public converter and its API are held. Text to Lattice is available here as documentation only.",
    "The fixed CoreWeave review route passed a bounded backend check on November 20. That dated result does not qualify the current identifier-preservation correction or establish general output reliability.",
    "Fourteen Firefox input checks passed on November 20. That day, a Safari submission reached review and a bounded revision, but no candidate cleared every required check. No transformed text was released.",
    "The November 21 Safari check returned no accepted output, and the service was restored. The corrected source subsequently passed one bounded backend check without a rewrite. Safari and Brave qualification remains pending.",
    "Successful Safari and Brave submission and reload evidence is still required before public release.",
    "The November 13 backend check passed one case on the former OVHcloud review route. It retained the passage and did not exercise rewrite repair.",
    "Release requires backend acceptance and hosted Safari and Brave evidence of submission, response handling, and reload.",
    "Review each result for changes in meaning, including omissions.",
  ]),
  input: `User-entered text from 1 through ${LATTICE_WORD_LIMIT} Unicode-aware words and no more than ${LATTICE_INPUT_SAFETY_LIMIT.toLocaleString("en-US")} UTF-16 code units. The browser validates these bounds before the explicit same-origin submission, and the server validates them again before provider work.`,
  output: "A checked Latticed text, a visible material draft marked for review, an unable-to-attempt result with no transformed text, or a finite request error. The remote capability does not ask follow-up clarification questions.",
  usagePolicy: historicalUsagePolicy,
  process: Object.freeze([
    "Validate and segment the source without losing separators before any network submission.",
    "After explicit confirmation, send one content-free cookie setup POST with no body or Content-Type to the same-origin /api/lattice capability; after its 204 response, send exactly one content-bearing POST with text, requested_mode, and schema_version 1.",
    "On the server, atomize actors, events, states, relationships, causality, chronology, modality, polarity, uncertainty, quantities, knowledge, instructions, institutional conditions, and ethical stakes.",
    "Select operative, experiential, interpretive, mixed, or accessibility treatment passage by passage under the Relational Systems Register; an operative or experiential request remains a preference subordinate to evidence, semantic fidelity, and safety.",
    "Use the fixed DeepInfra-served Qwen generator to draft and the fixed CoreWeave-served Llama 3.3 verifier to check source coverage, semantic fidelity, accessibility, clarity, domain correctness, register fit, and ornament through Hugging Face and OpenRouter.",
    "Re-atomize incomplete passages or repair a rejected draft within bounded passes against the same fixed models; do not switch providers or models.",
    "Certify required multi-batch candidates against the complete source for distant identity, attribution, chronology, causality, modality, polarity, ambiguity, and document consistency.",
    "Return one bounded result or an explicit terminal error; the browser performs no automatic retry or fallback.",
  ]),
  implementation: Object.freeze({
    generator: Object.freeze({
      name: "Qwen3-235B-A22B-Instruct-2507 server-side generator",
      modelId: REMOTE_GENERATOR_ID,
      revision: "provider-managed remote serving revision",
      repository: "https://huggingface.co/Qwen/Qwen3-235B-A22B-Instruct-2507",
      reviewedSourceRevision: REMOTE_GENERATOR_REVIEWED_REVISION,
      revisionUrl: `https://huggingface.co/Qwen/Qwen3-235B-A22B-Instruct-2507/tree/${REMOTE_GENERATOR_REVIEWED_REVISION}`,
      baseModelRepository: "https://huggingface.co/Qwen/Qwen3-235B-A22B-Instruct-2507",
      licenseName: "Apache License 2.0",
      licenseUrl: `https://huggingface.co/Qwen/Qwen3-235B-A22B-Instruct-2507/blob/${REMOTE_GENERATOR_REVIEWED_REVISION}/LICENSE`,
      inference: Object.freeze({
        stages: Object.freeze({
          analysis: Object.freeze({
            maximumOutputTokens: 2_048,
          }),
          candidate: Object.freeze({ maximumOutputTokens: 800 }),
          repair: Object.freeze({ maximumOutputTokens: 800 }),
        }),
      }),
      inferenceSummary: "The server routes Qwen analysis and drafting to DeepInfra and Llama review to CoreWeave through Hugging Face and OpenRouter. Each stage has an output limit. The server checks returned objects against a closed contract and rejects invalid or incomplete output.",
    }),
    verifier: Object.freeze({
      name: "Llama 3.3 70B Instruct server-side verifier",
      modelId: REMOTE_VERIFIER_ID,
      revision: "provider-managed remote serving revision",
      repository: "https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct",
      reviewedSourceRevision: REMOTE_VERIFIER_REVIEWED_REVISION,
      revisionUrl: `https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct/tree/${REMOTE_VERIFIER_REVIEWED_REVISION}`,
      baseModelRepository: "https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct",
      licenseName: "Llama 3.3 Community License Agreement",
      licenseUrl: "https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct/blob/6f6073b423013f6a7d4d9f39144961bfbfbc386b/LICENSE",
      acceptableUseUrl: "https://www.llama.com/llama3_3/use-policy",
      inference: Object.freeze({
        stages: Object.freeze({
          verification: Object.freeze({
            maximumOutputTokens: 2_048,
          }),
          certification: Object.freeze({
            maximumOutputTokens: 520,
          }),
        }),
      }),
    }),
    runtime: Object.freeze({
      name: "Hugging Face Inference Providers with OpenRouter, DeepInfra and CoreWeave",
      version: "provider-managed remote service",
      packageUrl: "https://huggingface.co/docs/inference-providers/",
      documentationUrl: "https://huggingface.co/docs/inference-providers/en/tasks/chat-completion",
      repository: HUGGING_FACE_CHAT_COMPLETIONS_URL,
      tokenizerName: "Provider-managed model tokenizer",
      tokenizerVersion: "provider-managed",
      tokenizerPackageUrl: "https://huggingface.co/docs/inference-providers/",
      structuredOutputName: "Bounded structured output with exact host-side closed-schema validation",
      structuredOutputVersion: "provider-managed",
      structuredOutputPackageUrl: "https://huggingface.co/docs/inference-providers/en/guides/structured-output",
      structuredOutputRepository: "https://huggingface.co/docs/inference-providers/en/guides/structured-output",
      structuredOutputLicenseName: "Hugging Face and provider service terms",
      structuredOutputLicenseUrl: "https://huggingface.co/terms-of-service",
      wasmRevision: "historical and inactive",
      wasmRepository: HISTORICAL_LOCAL_LATTICE_MODEL.wasmRepository,
      wasmLicenseStatus: "The active provider-managed runtime is not asserted to be byte-for-byte equivalent to the historical pinned MLC/WebGPU artifacts. Those artifact records describe the inactive browser-local release only.",
    }),
    historicalLocalRuntime: Object.freeze({
      status: "inactive",
      version: HISTORICAL_LOCAL_LATTICE_MODEL.version,
      generatorModelId: HISTORICAL_LOCAL_LATTICE_MODEL.models[0].id,
      verifierModelId: HISTORICAL_LOCAL_LATTICE_MODEL.models[1].id,
      runtime: `${HISTORICAL_LOCAL_LATTICE_MODEL.runtime.name} ${HISTORICAL_LOCAL_LATTICE_MODEL.runtime.version}`,
      statement: "Preserved for provenance only; it is not the active inference path and does not establish byte identity with provider-served weights, tokenizer behavior, kernels, or runtime configuration.",
    }),
  }),
  securityAndPrivacy: Object.freeze({
    inputHardening: Object.freeze({
      summary: "Source text is bounded, treated as inert data, and rejected in the browser and again on the server when it does not clear the input contract.",
      limits: Object.freeze([
        `${LATTICE_WORD_LIMIT} source words, ${LATTICE_INPUT_SAFETY_LIMIT.toLocaleString("en-US")} source UTF-16 code units, and ${LATTICE_INPUT_UTF8_LIMIT.toLocaleString("en-US")} encoded bytes`,
        `${LATTICE_PASSAGE_LIMIT} passages and ${LATTICE_BATCH_LIMIT} model work groups`,
        `${LATTICE_GRAPHEME_CODE_POINT_LIMIT} Unicode code points in any grapheme, ${LATTICE_TOKEN_CODE_POINT_LIMIT} in any word-like token, and ${LATTICE_FORMAT_CONTROL_LIMIT} format controls in an entry`,
        `${LATTICE_PROVIDER_CALL_LIMIT} provider calls across analysis, candidate generation, verification, certification, correction, repair, and re-atomization work, bounded further by the request and per-call deadlines`,
        "2,048 requested output tokens per provider call, 65,536 requested output tokens across the 32-call ceiling of one admitted request. Under the standard daily limits the ceilings are 196,608 across the 3-admission ceiling of one cooperating ordinary persistent browser cookie jar per UTC day, and 1,966,080 across the 30-admission global UTC-day ceiling",
        "65,536 request bytes; 120 seconds for analysis, candidate, certification, and repair calls; 180 seconds for verification calls; 240 seconds for the complete API request; 262,144 provider-response bytes; and a bounded client response envelope",
        "Standard service limits are 30 accepted transformation requests globally per UTC day and 3 from one ordinary persistent browser cookie jar per UTC day. Both daily limits are lifted during the operator-ended browser qualification.",
      ]),
      isolation: Object.freeze([
        "Unpaired surrogates, unsupported control characters, pathological grapheme sequences, excess invisible format controls, excess passages, and excess work groups fail closed.",
        "The browser runs complete source preflight before the explicit submission, and the Worker repeats preflight before creating any provider request.",
        "The model receives escaped JSON inside a delimited inert-data message; task instructions remain in the system message, responses must satisfy closed JSON schemas, and deterministic validators reject unknown fields and failed preservation gates.",
        "The remote path disables clarification. Analyzer responses must contain an empty questions list; ambiguity and uncertainty remain source-grounded semantic records rather than follow-up prompts.",
        "If a candidate is withheld, the public result omits model atom identifiers and candidate-derived metadata and reports one host-authored failure state.",
        "Source, findings, and results are rendered only as React text and never interpreted as HTML, code, network destinations, or request headers. The source appears only in the declared text field of the capability request and in server-created fixed-provider prompts.",
      ]),
    }),
    huggingFace: Object.freeze({
      summary: "After explicit confirmation, hah.dev sends prompts containing the submitted text to Hugging Face. DeepInfra serves the fixed Qwen3-235B-A22B-Instruct-2507 generator. CoreWeave serves the Llama 3.3 70B Instruct verifier and certifier. Hugging Face routes both models through OpenRouter.",
      protections: Object.freeze([
        `The server uses only ${HUGGING_FACE_CHAT_COMPLETIONS_URL} for all stages, including verification, its bounded correction or reverification, and certification. User text cannot select a URL, provider, model, header, or credential.`,
        `The generator is fixed to ${REMOTE_GENERATOR_ID}; verification and certification are fixed to ${REMOTE_VERIFIER_ID} with strict JSON-schema content and mandatory closed host decoding. There is no automatic provider or model fallback.`,
        "The Hugging Face token is a server-side encrypted Worker secret and is never sent to the browser. Browser Content Security Policy limits connect-src to the hah.dev origin.",
        "hah.dev provider fetches request no storage cache and reject redirects; this does not establish or control any external provider cache. Request, response, token, and time limits remain bounded. hah.dev deterministically validates every returned object against its closed contract, and invalid, incomplete, or unknown data fails closed. A schema-correction pass may call the same fixed model again within the pipeline budget and never switches providers.",
        "The hah.dev application does not persist source text, prompts, candidates, results, or raw provider bodies and does not write them to application logs or analytics. Responses use Cache-Control: no-store.",
      ]),
      residualDisclosure: "This text leaves hah.dev for external processing. Hugging Face, OpenRouter, DeepInfra and CoreWeave process submitted text and ordinary connection metadata under their own policies. Hugging Face says it does not store routed prompts or responses and can keep non-content troubleshooting logs for up to 30 days. OpenRouter records request metadata and describes anonymous prompt categorization. Its safety screening and applicable endpoint policies can retain content for abuse prevention or legal reporting, including unflagged requests on Safety Retention endpoints. The settings Hugging Face uses on this route are unknown. DeepInfra describes deletion of ordinary inputs and outputs after inference. Its terms allow temporary in-memory caching, operational metadata, authorized support retention of up to 30 days, and legal or elected-feature exceptions. CoreWeave describes zero data retention by default for serverless inference. Optional tracing can record requests. The tracing setting for this route is unknown. External-provider retention, deletion and processing behavior are not guaranteed by hah.dev. Do not submit classified, controlled, privileged, export-controlled, operationally sensitive, or otherwise restricted information. Browser extensions, security products, DNS providers, and networks selected by the visitor remain outside hah.dev's control.",
      sources: Object.freeze([
        Object.freeze({ label: "Hugging Face Inference Providers chat completion", url: "https://huggingface.co/docs/inference-providers/en/tasks/chat-completion" }),
        Object.freeze({ label: "Hugging Face structured outputs", url: "https://huggingface.co/docs/inference-providers/en/guides/structured-output" }),
        Object.freeze({ label: "Hugging Face Inference Providers security", url: "https://huggingface.co/docs/inference-providers/en/security" }),
        Object.freeze({ label: "Hugging Face language-model routing", url: "https://huggingface.co/docs/inference-providers/en/providers" }),
        Object.freeze({ label: "OpenRouter data collection", url: "https://openrouter.ai/docs/guides/privacy/data-collection" }),
        Object.freeze({ label: "OpenRouter Privacy Policy", url: "https://openrouter.ai/privacy" }),
        Object.freeze({ label: "Hugging Face DeepInfra provider documentation", url: "https://huggingface.co/docs/inference-providers/en/providers/deepinfra" }),
        Object.freeze({ label: "DeepInfra data privacy", url: "https://docs.deepinfra.com/account/data-privacy" }),
        Object.freeze({ label: "DeepInfra Privacy Policy", url: "https://deepinfra.com/privacy" }),
        Object.freeze({ label: "DeepInfra Terms of Service", url: "https://deepinfra.com/terms" }),
        Object.freeze({ label: "CoreWeave serverless inference", url: "https://www.coreweave.com/products/coreweave-forge/serverless-inference" }),
        Object.freeze({ label: "CoreWeave Terms of Service", url: "https://docs.coreweave.com/policies/terms-of-service" }),
        Object.freeze({ label: "CoreWeave Privacy Policy", url: "https://docs.coreweave.com/policies/terms-of-service/privacy-policy" }),
        Object.freeze({ label: "Hugging Face Privacy Policy", url: "https://huggingface.co/privacy" }),
        Object.freeze({ label: "Hugging Face Terms of Service", url: "https://huggingface.co/terms-of-service" }),
      ]),
    }),
    api: Object.freeze({
      summary: "Text to Lattice has one named remote capability at the same-origin /api/lattice path. After explicit confirmation, the browser sends one content-free cookie setup POST and then exactly one content-bearing transformation POST. Only the latter has a JSON body: exactly text, requested_mode, and schema_version with the fixed value 1.",
      rules: Object.freeze([
        "Only https://hah.dev/api/lattice with no query or fragment accepts the transformation request. Other paths return 404; other methods return 405 with Allow: POST; unsupported media types, origins, JSON, fields, modes, and versions are rejected before provider work.",
        "requested_mode accepts only auto, operative, or experiential. It guides classification but cannot override safety, semantic fidelity, accessibility, or better-supported evidence.",
        "The client submits only after the user chooses Process with external service. Input edits, validation failures, modal opening, dismissal, and cancellation before submission cause neither the cookie setup nor the transformation request.",
        "The same content-request response can stream only fixed phase names from actual engine work, followed by the existing checked result or error. Progress events contain no source, result, identifiers, or provider diagnostics and create no additional request. They mark work boundaries, not completion percentages, remaining time, or completed or billed model calls.",
        "Under one browser-wide lock, the browser first sends a content-free setup POST with same-origin credentials, no body, and no Content-Type to create or preserve one browser-owned opaque quota cookie. Only after a 204 response does it send exactly one content-bearing transformation POST. The cookie is named __Secure-hah-lattice-api-visitor, is HttpOnly, Secure, SameSite=Strict, scoped only to /api/lattice, expires at the next UTC-day boundary, and contains no source, result, account, fingerprint, or provider credential.",
        "In standard operation the service accepts at most 30 transformation requests globally per UTC day and 3 from one ordinary persistent cookie jar per UTC day. It does not use an IP address or browser fingerprint as a second identity. Blocking or clearing cookies, using private browsing, or changing profiles can reset the per-cookie-jar count, but not the global count.",
        "The browser does not follow redirects, requests no storage cache, and has no provider origin in its connect-src policy. The setup POST has only its declared Accept header; the content-bearing POST has only Accept and Content-Type. The browser, not application JavaScript, manages the quota cookie.",
        "The Worker holds request data only for the bounded computation. Application code defines no database, object-store, cache, raw-content logger, analytics event, or background queue for source or result content.",
        "Success and error envelopes are closed and size-bounded. Timeouts, rate limits, upstream unavailability, malformed responses, and internal failures terminate with machine-readable errors; the browser does not retry automatically or route content elsewhere.",
      ]),
      limitation: "The finite boundary limits what hah.dev sends and retains, but it cannot guarantee external-provider availability, processing behavior, or retention. A 429 or transient provider failure requires a new deliberate user submission. The per-cookie-jar limit is an ordinary-browser control, not a claim that one person cannot clear or partition cookies; the global limit applies across cookie jars during standard operation. Ordinary infrastructure security metadata may still be processed without including application-authored raw content logs.",
      sources: Object.freeze([
        Object.freeze({ label: "Cloudflare Workers secrets", url: "https://developers.cloudflare.com/workers/configuration/secrets/" }),
        Object.freeze({ label: "Cloudflare Workers Request API", url: "https://developers.cloudflare.com/workers/runtime-apis/request/" }),
        Object.freeze({ label: "Hugging Face Inference Providers security", url: "https://huggingface.co/docs/inference-providers/en/security" }),
      ]),
    }),
    outputProtection: Object.freeze({
      summary: "Generated results remain transient in the open browser interface; hah.dev does not persist them after returning the response.",
      controls: Object.freeze([
        "Selection, copy, cut, drag, touch callout, and the output context menu are disabled; print styles omit the result.",
        "The result is concealed while the page is hidden, the window loses focus, printing begins, or a detectable Print Screen key event occurs.",
        "The result remains semantic text for assistive technology and is removed with the transient dialog state rather than published in hah.dev's AI-readable records.",
      ]),
      limitation: "A website cannot prevent operating-system screenshots, cameras, browser extensions, developer tools, accessibility clients, or every clipboard path, and it cannot guarantee that a screenshot readable to a person will be unreadable to an AI system. These controls are deterrence, not digital-rights management.",
    }),
  }),
  constraints: Object.freeze([
    "After the user explicitly chooses Process with external service, the browser sends one content-free cookie setup POST and then exactly one content-bearing POST to the same-origin /api/lattice path. Only the second contains this text or can initiate external-provider processing, and its body is exactly {text, requested_mode, schema_version: 1}.",
    "Do not submit classified, controlled, privileged, export-controlled, operationally sensitive, or otherwise restricted information.",
    "hah.dev application code does not retain source text, prompts, candidates, results, or raw provider responses in storage, logs, caches, queues, or analytics. The bounded Worker and browser keep only transient in-memory state needed for the request and display.",
    "Hugging Face, OpenRouter, DeepInfra, CoreWeave, and their infrastructure process the submitted content under their own policies; hah.dev does not claim that its application-level no-retention rule governs those external systems.",
    "Provider endpoints, stage routing, the generator, and the verifier are fixed server-side. There is no automatic provider or model fallback, and a terminal failure requires another deliberate submission.",
    "In standard operation the service admits at most 30 transformations globally per UTC day and 3 from one ordinary persistent cookie jar per UTC day. Both daily limits are lifted during the operator-ended browser qualification. Its API-scoped opaque HttpOnly cookie contains no submitted content and expires at the next UTC-day boundary; no IP or browser fingerprint is used as a second quota identity.",
    "The active remote runtime may differ in weights, tokenizer behavior, kernels, numerical behavior, and serving configuration from the historical pinned MLC/WebGPU artifacts; byte-for-byte equivalence is not claimed.",
    "Canonical hah.dev pages, manifests, Markdown, JSON-LD, the sitemap, and the tool contract remain readable without JavaScript or conversion availability.",
    "Independent verification is limited to languages supported by both configured model families; unsupported text fails closed or is withheld for review.",
    "A review-required draft is an attempted translation, not a certification of semantic equivalence.",
  ]),
});
