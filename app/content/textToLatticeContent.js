import { LOCAL_LATTICE_MODEL as HISTORICAL_LOCAL_LATTICE_MODEL } from "../resume/lattice/modelContract.js";
import {
  LATTICE_COMPLETION_CALL_LIMIT,
  LATTICE_FORMAT_CONTROL_LIMIT,
  LATTICE_GRAPHEME_CODE_POINT_LIMIT,
  LATTICE_INPUT_SAFETY_LIMIT,
  LATTICE_INPUT_UTF8_LIMIT,
  LATTICE_TOKEN_CODE_POINT_LIMIT,
  LATTICE_WORD_LIMIT,
} from "../resume/lattice/inputPolicy.js";
import { LATTICE_BATCH_LIMIT, LATTICE_PASSAGE_LIMIT } from "../resume/lattice/segments.js";
import { LATTICE_USAGE_POLICY as HISTORICAL_LATTICE_USAGE_POLICY } from "../resume/lattice/usagePolicy.js";

const HUGGING_FACE_CHAT_COMPLETIONS_URL = "https://router.huggingface.co/v1/chat/completions";
const REMOTE_GENERATOR_ID = "Qwen/Qwen3-4B:featherless-ai";
const REMOTE_VERIFIER_ID = "meta-llama/Llama-3.2-3B-Instruct:featherless-ai";

// Keep the former lease-policy shape temporarily available to older semantic
// renderers, but mark every use as historical. It does not govern /api/lattice.
const historicalUsagePolicy = Object.freeze({
  ...HISTORICAL_LATTICE_USAGE_POLICY,
  status: "historical-inactive",
  purpose: "Historical, inactive browser-local lease profile retained for provenance only. After explicit confirmation, the current Text to Lattice capability sends one content-free cookie setup POST and then exactly one content-bearing transformation POST to the same-origin /api/lattice path, with a separate 30-transformation global UTC-day limit and 3-transformation ordinary-browser-cookie-jar UTC-day limit; it is not governed by these former lease counters.",
  endpoint: "/api/lattice",
  requestBody: "The cookie setup POST has no body or Content-Type. The only content-bearing request body is exactly {text, requested_mode, schema_version: 1}. Former bodyless lease fields and lifecycle values below are historical and inactive.",
  sourceTransmission: "Both POSTs occur only after explicit confirmation. Only the second contains submitted text or can initiate external-provider processing.",
  failureMode: "The active capability returns a bounded success or machine-readable error and does not automatically retry or fall back to another provider or model. Former lease limits below are historical and inactive.",
});

export const textToLatticeContract = Object.freeze({
  id: "text-to-lattice",
  name: "Text to Lattice",
  canonicalPath: "/projects/lattice/text-to-lattice/",
  purpose: "Convert source prose into passage-appropriate Lattice registers while preserving its meaning.",
  input: `User-entered text from 1 through ${LATTICE_WORD_LIMIT} Unicode-aware words and no more than ${LATTICE_INPUT_SAFETY_LIMIT.toLocaleString("en-US")} UTF-16 code units. The browser validates these bounds before the explicit same-origin submission, and the server validates them again before provider work.`,
  output: "A checked Latticed text, a visible material draft marked for review, an unable-to-attempt result with no transformed text, or a finite request error. The remote capability does not ask follow-up clarification questions.",
  usagePolicy: historicalUsagePolicy,
  process: Object.freeze([
    "Validate and segment the source without losing separators before any network submission.",
    "After explicit confirmation, send one content-free cookie setup POST with no body or Content-Type to the same-origin /api/lattice capability; after its 204 response, send exactly one content-bearing POST with text, requested_mode, and schema_version 1.",
    "On the server, atomize actors, events, states, relationships, causality, chronology, modality, polarity, uncertainty, quantities, knowledge, instructions, institutional conditions, and ethical stakes.",
    "Select operative, experiential, interpretive, mixed, or accessibility treatment passage by passage under the Relational Systems Register; an operative or experiential request remains a preference subordinate to evidence, semantic fidelity, and safety.",
    "Use the fixed Qwen generator to draft and the fixed Llama 3.2 verifier to check source coverage, semantic fidelity, accessibility, clarity, domain correctness, register fit, and ornament through the configured Hugging Face/Featherless service.",
    "Re-atomize incomplete passages or repair a rejected draft within bounded passes against the same fixed models; do not switch providers or models.",
    "Certify required multi-batch candidates against the complete source for distant identity, attribution, chronology, causality, modality, polarity, ambiguity, and document consistency.",
    "Return one bounded result or an explicit terminal error; the browser performs no automatic retry or fallback.",
  ]),
  implementation: Object.freeze({
    generator: Object.freeze({
      name: "Qwen3-4B server-side generator",
      modelId: REMOTE_GENERATOR_ID,
      revision: "provider-managed remote serving revision",
      repository: "https://huggingface.co/Qwen/Qwen3-4B",
      revisionUrl: "https://huggingface.co/Qwen/Qwen3-4B",
      baseModelRepository: "https://huggingface.co/Qwen/Qwen3-4B",
      licenseName: "Apache License 2.0",
      licenseUrl: "https://huggingface.co/Qwen/Qwen3-4B/blob/main/LICENSE",
      inference: Object.freeze({
        seed: 71_903,
        thinking: false,
        stages: Object.freeze({
          analysis: Object.freeze({ temperature: 0.1, topP: 0.9, maximumOutputTokens: 3_072 }),
          candidate: Object.freeze({ temperature: 0.45, topP: 0.9, maximumOutputTokens: 800 }),
          repair: Object.freeze({ temperature: 0.45, topP: 0.9, maximumOutputTokens: 800 }),
        }),
      }),
      inferenceSummary: "server-side structured completion through Hugging Face Inference Providers and Featherless AI; fixed seed 71903; Qwen thinking disabled; bounded stage-specific output limits",
    }),
    verifier: Object.freeze({
      name: "Llama 3.2 3B Instruct server-side verifier",
      modelId: REMOTE_VERIFIER_ID,
      revision: "provider-managed remote serving revision",
      repository: "https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct",
      revisionUrl: "https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct",
      baseModelRepository: "https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct",
      licenseName: HISTORICAL_LOCAL_LATTICE_MODEL.models[1].licenseName,
      licenseUrl: HISTORICAL_LOCAL_LATTICE_MODEL.models[1].licenseUrl,
      acceptableUseUrl: HISTORICAL_LOCAL_LATTICE_MODEL.models[1].acceptableUseUrl,
      inference: Object.freeze({
        seed: 71_903,
        stages: Object.freeze({
          verification: Object.freeze({ temperature: 0, topP: 1, maximumOutputTokens: 1_200 }),
          certification: Object.freeze({ temperature: 0, topP: 1, maximumOutputTokens: 520 }),
        }),
      }),
    }),
    runtime: Object.freeze({
      name: "Hugging Face Inference Providers with Featherless AI",
      version: "provider-managed remote service",
      packageUrl: "https://huggingface.co/docs/inference-providers/",
      documentationUrl: "https://huggingface.co/docs/inference-providers/en/tasks/chat-completion",
      repository: HUGGING_FACE_CHAT_COMPLETIONS_URL,
      tokenizerName: "Provider-managed model tokenizer",
      tokenizerVersion: "provider-managed",
      tokenizerPackageUrl: "https://huggingface.co/docs/inference-providers/",
      structuredOutputName: "JSON-object generation with exact host-side closed-schema validation",
      structuredOutputVersion: "provider-managed",
      structuredOutputPackageUrl: "https://featherless.ai/docs/tool-calling",
      structuredOutputRepository: "https://featherless.ai/docs/tool-calling",
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
        `${LATTICE_COMPLETION_CALL_LIMIT} protocol-level model completions across initial, correction, repair, re-atomization, and certification work, additionally bounded by the shorter request and provider deadlines`,
        "65,536 request bytes, 60 seconds per provider call, 240 seconds for the complete API request, 262,144 provider-response bytes, and a bounded client response envelope",
        "30 accepted transformation requests globally per UTC day and 3 from one ordinary persistent browser cookie jar per UTC day",
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
      summary: "After explicit confirmation, hah.dev sends server-created prompts containing the submitted text to the Hugging Face Inference Providers chat-completions router, configured to use Featherless AI. Qwen3-4B is the fixed generator and Llama 3.2 3B Instruct is the fixed verifier.",
      protections: Object.freeze([
        `The server can call only ${HUGGING_FACE_CHAT_COMPLETIONS_URL}; user text cannot select a URL, provider, model, header, or credential.`,
        `The generator is fixed to ${REMOTE_GENERATOR_ID} and the verifier is fixed to ${REMOTE_VERIFIER_ID}. There is no automatic provider or model fallback.`,
        "The Hugging Face token is a server-side encrypted Worker secret and is never sent to the browser. Browser Content Security Policy limits connect-src to the hah.dev origin.",
        "Provider calls omit caches, reject redirects, request JSON-object output with the exact closed schema in the trusted system instruction, and enforce bounded request, response, token, and time limits. hah.dev validates every returned object against that closed contract; a schema-correction pass may call the same fixed model again within the pipeline budget and never switches providers.",
        "The hah.dev application does not persist source text, prompts, candidates, results, or raw provider bodies and does not write them to application logs or analytics. Responses use Cache-Control: no-store.",
      ]),
      residualDisclosure: "This text leaves hah.dev for external processing. Hugging Face, Featherless AI, and their infrastructure receive the content and ordinary connection metadata under their own policies; hah.dev's no-retention statement does not promise their retention behavior. Do not submit classified, controlled, privileged, export-controlled, operationally sensitive, or otherwise restricted information. Browser extensions, security products, DNS providers, and networks selected by the visitor remain outside hah.dev's control.",
      sources: Object.freeze([
        Object.freeze({ label: "Hugging Face Inference Providers chat completion", url: "https://huggingface.co/docs/inference-providers/en/tasks/chat-completion" }),
        Object.freeze({ label: "Hugging Face structured outputs", url: "https://huggingface.co/docs/inference-providers/en/guides/structured-output" }),
        Object.freeze({ label: "Featherless JSON-object guidance", url: "https://featherless.ai/docs/tool-calling" }),
        Object.freeze({ label: "Hugging Face Inference Providers security", url: "https://huggingface.co/docs/inference-providers/en/security" }),
        Object.freeze({ label: "Hugging Face Featherless AI provider documentation", url: "https://huggingface.co/docs/inference-providers/en/providers/featherless-ai" }),
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
        "Under one browser-wide lock, the browser first sends a content-free setup POST with same-origin credentials, no body, and no Content-Type to create or preserve one browser-owned opaque quota cookie. Only after a 204 response does it send exactly one content-bearing transformation POST. The cookie is named __Secure-hah-lattice-api-visitor, is HttpOnly, Secure, SameSite=Strict, scoped only to /api/lattice, expires at the next UTC-day boundary, and contains no source, result, account, fingerprint, or provider credential.",
        "The service accepts at most 30 transformation requests globally per UTC day and 3 from one ordinary persistent cookie jar per UTC day. It does not use an IP address or browser fingerprint as a second identity. Blocking or clearing cookies, using private browsing, or changing profiles can reset the per-cookie-jar count, but not the global count.",
        "The browser does not follow redirects, requests no storage cache, and has no provider origin in its connect-src policy. The setup POST has only its declared Accept header; the content-bearing POST has only Accept and Content-Type. The browser, not application JavaScript, manages the quota cookie.",
        "The Worker holds request data only for the bounded computation. Application code defines no database, object-store, cache, raw-content logger, analytics event, or background queue for source or result content.",
        "Success and error envelopes are closed and size-bounded. Timeouts, rate limits, upstream unavailability, malformed responses, and internal failures terminate with machine-readable errors; the browser does not retry automatically or route content elsewhere.",
      ]),
      limitation: "The finite boundary limits what hah.dev sends and retains, but it cannot guarantee external-provider availability, processing behavior, or retention. A 429 or transient provider failure requires a new deliberate user submission. The per-cookie-jar limit is an ordinary-browser control, not a claim that one person cannot clear or partition cookies; the exact global UTC-day limit remains authoritative. Ordinary infrastructure security metadata may still be processed without including application-authored raw content logs.",
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
        "A low-opacity line and wordmark veil changes captured pixels to deter routine OCR while keeping the on-screen result readable; it is static or omitted when accessibility preferences require that.",
        "The result remains semantic text for assistive technology and is removed with the transient dialog state rather than published in hah.dev's AI-readable records.",
      ]),
      limitation: "A website cannot prevent operating-system screenshots, cameras, browser extensions, developer tools, accessibility clients, or every clipboard path, and it cannot guarantee that a screenshot readable to a person will be unreadable to an AI system. These controls are deterrence, not digital-rights management.",
    }),
  }),
  constraints: Object.freeze([
    "After the user explicitly chooses Process with external service, the browser sends one content-free cookie setup POST and then exactly one content-bearing POST to the same-origin /api/lattice path. Only the second contains this text or can initiate external-provider processing, and its body is exactly {text, requested_mode, schema_version: 1}.",
    "Do not submit classified, controlled, privileged, export-controlled, operationally sensitive, or otherwise restricted information.",
    "hah.dev application code does not retain source text, prompts, candidates, results, or raw provider responses in storage, logs, caches, queues, or analytics. The bounded Worker and browser keep only transient in-memory state needed for the request and display.",
    "Hugging Face, Featherless AI, and their infrastructure process the submitted content under their own policies; hah.dev does not claim that its application-level no-retention rule governs those external systems.",
    "The provider endpoint, provider, generator, and verifier are fixed server-side. There is no automatic provider or model fallback, and a terminal failure requires another deliberate submission.",
    "The service admits at most 30 transformations globally per UTC day and 3 from one ordinary persistent cookie jar per UTC day. Its API-scoped opaque HttpOnly cookie contains no submitted content and expires at the next UTC-day boundary; no IP or browser fingerprint is used as a second quota identity.",
    "The active remote runtime may differ in weights, tokenizer behavior, kernels, numerical behavior, and serving configuration from the historical pinned MLC/WebGPU artifacts; byte-for-byte equivalence is not claimed.",
    "Canonical hah.dev pages, manifests, Markdown, JSON-LD, the sitemap, and the tool contract remain readable without JavaScript or conversion availability.",
    "Independent verification is limited to languages supported by both configured model families; unsupported text fails closed or is withheld for review.",
    "A review-required draft is an attempted translation, not a certification of semantic equivalence.",
  ]),
});
