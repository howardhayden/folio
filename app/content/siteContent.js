import { LOCAL_LATTICE_MODEL } from "../resume/lattice/modelContract.js";
import {
  LATTICE_CLARIFICATION_SAFETY_LIMIT,
  LATTICE_CLARIFICATION_UTF8_LIMIT,
  LATTICE_CLARIFICATION_WORD_LIMIT,
  LATTICE_COMPLETION_CALL_LIMIT,
  LATTICE_FORMAT_CONTROL_LIMIT,
  LATTICE_GRAPHEME_CODE_POINT_LIMIT,
  LATTICE_INPUT_SAFETY_LIMIT,
  LATTICE_INPUT_UTF8_LIMIT,
  LATTICE_TOKEN_CODE_POINT_LIMIT,
  LATTICE_WORD_LIMIT,
} from "../resume/lattice/inputPolicy.js";
import { LATTICE_BATCH_LIMIT, LATTICE_PASSAGE_LIMIT } from "../resume/lattice/segments.js";
import { LATTICE_USAGE_POLICY } from "../resume/lattice/usagePolicy.js";

function generatorInferenceSummary(inference) {
  const stages = Object.entries(inference.stages)
    .map(([stage, settings]) => `${stage} temperature ${settings.temperature}, top-p ${settings.topP}`)
    .join("; ");
  return `${stages}; fixed seed ${inference.seed}; thinking ${inference.thinking ? "enabled" : "disabled"}`;
}

export const SITE_ORIGIN = "https://hah.dev";
export const SITE_CONTENT_VERSION = "hah-portfolio.v1";
export const SITE_CONTENT_UPDATED = "2026-09-09";
export const SITE_REPOSITORY = "https://github.com/howardhayden/folio";
export const SITE_SOURCE_LICENSE_URL = "https://polyformproject.org/licenses/noncommercial/1.0.0/";
export const SITE_CONTENT_TERMS_URL = `${SITE_REPOSITORY}/blob/main/LICENSES/LicenseRef-Hayden-Portfolio-Content.txt`;
export const homeTitle = "Yes, my initials spell \"hah.\"";

export const person = Object.freeze({
  id: `${SITE_ORIGIN}/#hayden-howard`,
  name: "Hayden Howard",
  givenName: "Hayden",
  familyName: "Howard",
  homeLocation: "Dayton",
  headline: "Hayden Howard develops and operates resilient systems that people can trust under pressure.",
  repository: SITE_REPOSITORY,
  profiles: Object.freeze([
    "https://www.linkedin.com/in/howardhayden/",
    "https://medium.com/@howardhayden",
  ]),
});

export const homeIntroduction = Object.freeze([
  "I’m Hayden Howard, a techie from Dayton. I develop and operate resilient systems that people can trust under pressure.",
  "I live for good cold brew, meaningful work, and passionate people.",
]);

export const resumeEducationOverview = Object.freeze({
  graduated: "May 2023",
  activities: Object.freeze([
    Object.freeze({ label: "Digital Humanities Forum Committee", start: "August 2021" }),
    Object.freeze({ label: "Diversity, Equity, and Inclusion Committee", start: "August 2022" }),
  ]),
});

export const toolsSocial = Object.freeze([
  Object.freeze({ name: "LinkedIn", title: "LinkedIn Profile", url: "https://www.linkedin.com/in/howardhayden/", icon: "linkedin" }),
  Object.freeze({ name: "Duolingo", title: "Duolingo Profile", url: "https://duolingo.com/profile/hahdev", icon: "feather" }),
]);

export const shelfNotice = "The following materials contain insightful value per their associated collections. They do not reflect my views or those of any employers or associated organizations.";

export const homeQuestions = Object.freeze([
  Object.freeze({
    question: "What is your favorite programming language?",
    answer: "C++, though it didn't usurp Java until my second Systems course, wherein I adopted some of Professor \"DJ\" Rao's passion for it. Today, it's my go-to language for scripting and general coding practice. I admire its efficiency, versatility, and integrative capacity.",
    column: 2,
  }),
  Object.freeze({
    question: "Do you prefer in-person or remote work?",
    answer: "I prefer a hybrid approach. Working remotely helps me focus and get into a productive flow, while in-person collaboration allows for faster and more efficient teamwork.",
    column: 2,
  }),
  Object.freeze({
    question: "What is your favorite music genre?",
    answer: "I listen most often to big band swing, finding it especially easy to slip into a flow state with. I also play acoustic guitar and flute.",
    column: 2,
  }),
  Object.freeze({ question: "Dogs or cats?", answer: "Cats.", column: 2 }),
  Object.freeze({ question: "Why USN Officer Candidate School?", answer: "Type three fun.", column: 2 }),
  Object.freeze({
    question: "What is your favorite latte?",
    answer: "Naoki fragrant yame blend matcha with traditionally processed whole milk, grade B maple syrup, and either cinnamon or peppermint extract.",
    column: 1,
  }),
  Object.freeze({
    question: "What have you learned during your education and GLAM-sector \"gap\"?",
    answer: Object.freeze([
      "How to command attention and order while maintaining both high energy and clarity of thought for several hours at a time.",
      "I learn best while teaching others.",
      "How to translate ideas presented with moderate formality into extremely informal language so as to reach audiences with differing levels of literacy.",
    ]),
    column: 1,
  }),
  Object.freeze({
    question: "What enticed you into the world of coding, data, and analysis?",
    answer: "I discovered during self-study of pathophysiology while taking an anatomy and physiology course that I truly enjoy the systematic nature of physiology. My directive became transparent.",
    column: 1,
  }),
]);

export const sharedRequirements = Object.freeze([
  Object.freeze({ id: "accessibility", label: "Accessibility", description: "Public interfaces and information are designed to remain perceivable and operable across access needs." }),
  Object.freeze({ id: "privacy", label: "Privacy", description: "Public systems minimize disclosure and keep transient user material out of published semantic artifacts." }),
  Object.freeze({ id: "traceability", label: "Requirements traceability", description: "Claims, requirements, relationships, and representations remain linked to their authoritative public records." }),
  Object.freeze({ id: "evidence", label: "Evidence", description: "Public claims distinguish authored evidence from inference and identify limitations explicitly." }),
]);

export const practiceStandards = Object.freeze([
  Object.freeze({
    id: "provenance-continuity",
    label: "Provenance and continuity",
    description: "Custody, integrity, dependencies, decisions, recovery paths, and handoff remain explicit across disruption and change.",
  }),
]);

export const textToLatticeContract = Object.freeze({
  id: "text-to-lattice",
  name: "Text to Lattice",
  canonicalPath: "/projects/lattice/text-to-lattice/",
  purpose: "Convert source prose into passage-appropriate Lattice registers while preserving its meaning.",
  input: `User-entered text from 1 through ${LATTICE_WORD_LIMIT} Unicode-aware words and no more than ${LATTICE_INPUT_SAFETY_LIMIT.toLocaleString("en-US")} UTF-16 code units; invalid input is rejected before a usage lease or model load.`,
  output: "A locally drafted Latticed text, a visible draft marked for review, or a clarification tied to a specific ambiguity.",
  usagePolicy: LATTICE_USAGE_POLICY,
  process: Object.freeze([
    "Segment the source without losing separators.",
    "Atomize actors, events, states, relationships, causality, chronology, modality, polarity, uncertainty, quantities, knowledge, instructions, institutional conditions, and ethical stakes.",
    "Select operative, experiential, interpretive, mixed, or accessibility treatment passage by passage under the Relational Systems Register.",
    "Draft each passage and test exact invariants and material change.",
    "Use a separately trained local model family to check source coverage, semantic fidelity, accessibility, clarity, domain correctness, register fit, and ornament.",
    "Re-atomize incomplete passages or repair a rejected draft within bounded passes.",
    "Certify every multi-batch candidate against the complete source for distant identity, attribution, chronology, causality, modality, polarity, ambiguity, and document consistency.",
    "Return a checked result, a review-required material draft, or a precise clarification.",
  ]),
  implementation: Object.freeze({
    generator: Object.freeze({
      name: LOCAL_LATTICE_MODEL.models[0].label,
      modelId: LOCAL_LATTICE_MODEL.models[0].id,
      revision: LOCAL_LATTICE_MODEL.models[0].revision,
      repository: LOCAL_LATTICE_MODEL.models[0].repository,
      revisionUrl: LOCAL_LATTICE_MODEL.models[0].revisionUrl,
      baseModelRepository: LOCAL_LATTICE_MODEL.models[0].baseModelRepository,
      licenseName: LOCAL_LATTICE_MODEL.models[0].licenseName,
      licenseUrl: LOCAL_LATTICE_MODEL.models[0].licenseUrl,
      inference: Object.freeze({ ...LOCAL_LATTICE_MODEL.models[0].inference }),
      inferenceSummary: generatorInferenceSummary(LOCAL_LATTICE_MODEL.models[0].inference),
    }),
    verifier: Object.freeze({
      name: LOCAL_LATTICE_MODEL.models[1].label,
      modelId: LOCAL_LATTICE_MODEL.models[1].id,
      revision: LOCAL_LATTICE_MODEL.models[1].revision,
      repository: LOCAL_LATTICE_MODEL.models[1].repository,
      revisionUrl: LOCAL_LATTICE_MODEL.models[1].revisionUrl,
      baseModelRepository: LOCAL_LATTICE_MODEL.models[1].baseModelRepository,
      licenseName: LOCAL_LATTICE_MODEL.models[1].licenseName,
      licenseUrl: LOCAL_LATTICE_MODEL.models[1].licenseUrl,
      acceptableUseUrl: LOCAL_LATTICE_MODEL.models[1].acceptableUseUrl,
      inference: Object.freeze({ ...LOCAL_LATTICE_MODEL.models[1].inference }),
    }),
    runtime: Object.freeze({
      name: LOCAL_LATTICE_MODEL.runtime.name,
      version: LOCAL_LATTICE_MODEL.runtime.version,
      packageUrl: LOCAL_LATTICE_MODEL.runtime.packageUrl,
      documentationUrl: LOCAL_LATTICE_MODEL.runtime.documentationUrl,
      repository: LOCAL_LATTICE_MODEL.runtime.repository,
      tokenizerName: LOCAL_LATTICE_MODEL.tokenizerRuntime.name,
      tokenizerVersion: LOCAL_LATTICE_MODEL.tokenizerRuntime.version,
      tokenizerPackageUrl: LOCAL_LATTICE_MODEL.tokenizerRuntime.packageUrl,
      structuredOutputName: LOCAL_LATTICE_MODEL.structuredOutputRuntime.name,
      structuredOutputVersion: LOCAL_LATTICE_MODEL.structuredOutputRuntime.version,
      structuredOutputPackageUrl: LOCAL_LATTICE_MODEL.structuredOutputRuntime.packageUrl,
      structuredOutputRepository: LOCAL_LATTICE_MODEL.structuredOutputRuntime.repository,
      structuredOutputLicenseName: LOCAL_LATTICE_MODEL.structuredOutputRuntime.licenseName,
      structuredOutputLicenseUrl: LOCAL_LATTICE_MODEL.structuredOutputRuntime.licenseUrl,
      wasmRevision: LOCAL_LATTICE_MODEL.wasmRevision,
      wasmRepository: LOCAL_LATTICE_MODEL.wasmRepository,
      wasmLicenseStatus: LOCAL_LATTICE_MODEL.wasmLicenseStatus,
    }),
  }),
  securityAndPrivacy: Object.freeze({
    inputHardening: Object.freeze({
      summary: "Source and clarification text are bounded, treated as inert data, and rejected before scarce work begins when they do not clear the input contract.",
      limits: Object.freeze([
        `${LATTICE_WORD_LIMIT} source words, ${LATTICE_INPUT_SAFETY_LIMIT.toLocaleString("en-US")} source UTF-16 code units, and ${LATTICE_INPUT_UTF8_LIMIT.toLocaleString("en-US")} encoded bytes`,
        `${LATTICE_PASSAGE_LIMIT} passages and ${LATTICE_BATCH_LIMIT} model work groups`,
        `${LATTICE_GRAPHEME_CODE_POINT_LIMIT} Unicode code points in any grapheme, ${LATTICE_TOKEN_CODE_POINT_LIMIT} in any word-like token, and ${LATTICE_FORMAT_CONTROL_LIMIT} format controls in an entry`,
        `${LATTICE_CLARIFICATION_WORD_LIMIT} words, ${LATTICE_CLARIFICATION_SAFETY_LIMIT.toLocaleString("en-US")} UTF-16 code units, and ${LATTICE_CLARIFICATION_UTF8_LIMIT.toLocaleString("en-US")} encoded bytes in each clarification`,
        `${LATTICE_COMPLETION_CALL_LIMIT} local model completions across initial, correction, repair, re-atomization, and certification work`,
      ]),
      isolation: Object.freeze([
        "Unpaired surrogates, unsupported control characters, pathological grapheme sequences, excess invisible format controls, excess passages, and excess work groups fail closed.",
        "The full preflight runs before a quota lease is acquired, so malformed or oversized text does not spend a demonstration grant or start a model download.",
        "The model receives escaped JSON inside a delimited inert-data message; task instructions remain in the system message, responses must satisfy closed JSON schemas, and deterministic validators reject unknown fields and failed preservation gates.",
        "Each analyzer starts without prior answers. One answer can return only when its current question ID and SHA-256 provenance match the same source, revision, semantic graph, prompt, options, and stage; the host reconstructs the bounded tuple and requires the analyzer itself to resolve it.",
        "Clarification history never reaches drafting, verification, certification, repair, or post-candidate re-atomization. Verifiers and post-candidate analyzers use schemas that forbid public questions.",
        "If a candidate is withheld, the public result omits model atom identifiers and candidate-derived metadata and reports one host-authored failure state.",
        "Source, clarifications, prompts, candidates, and results are rendered only as React text and never interpreted as HTML, code, network destinations, request headers, or remote or network request bodies.",
      ]),
    }),
    huggingFace: Object.freeze({
      summary: "Hugging Face hosts two public model repositories; Text to Lattice requests fixed revisions and does not use a Hugging Face inference API, Space, account, access token, or server-side prompt service.",
      protections: Object.freeze([
        "The browser starts model downloads only from constant HTTPS paths under two allowlisted commit revisions. The worker's fetch and cache-add paths reject other explicit external request targets; redirects performed by the upstream hosts remain part of the disclosed upstream and TLS trust boundary.",
        "Model-asset requests omit credentials and referrers and strip authorization, cookie, proxy-authorization, and referer headers. They contain no source text, clarification, prompt, candidate, result, register, genre, or word count.",
        "All inference runs in the visitor's browser. Model output cannot choose an upstream URL, and entered text is never sent to hah.dev's quota endpoint or to Hugging Face by Text to Lattice.",
        "The revisions are pinned, but this client does not independently hash every downloaded shard. TLS, revision pinning, the browser's origin controls, the request allowlist, and Hugging Face Hub scanning are separate layers rather than a guarantee of upstream integrity.",
      ]),
      residualDisclosure: "Hugging Face and its delivery infrastructure still receive ordinary connection and download metadata, including the requesting IP address, the hah.dev site origin, and request/device information described in Hugging Face's Privacy Policy; model publishers may receive Hugging Face's anonymized request-level download logs. GitHub receives ordinary connection metadata when the pinned model-library WASM is downloaded from raw.githubusercontent.com. Browser extensions, security products, DNS providers, networks, and browser services selected by the visitor remain outside hah.dev's control. Sensitive text should not be entered.",
      sources: Object.freeze([
        Object.freeze({ label: "Hugging Face Privacy Policy", url: "https://huggingface.co/privacy" }),
        Object.freeze({ label: "Hugging Face Terms of Service", url: "https://huggingface.co/terms-of-service" }),
        Object.freeze({ label: "Hugging Face Content Policy (for content on its platform; local input is not posted there)", url: "https://huggingface.co/content-policy" }),
        Object.freeze({ label: "Hub security", url: "https://huggingface.co/docs/hub/security" }),
        Object.freeze({ label: "Hub malware scanning", url: "https://huggingface.co/docs/hub/security-malware" }),
        Object.freeze({ label: "Hub pickle scanning", url: "https://huggingface.co/docs/hub/security-pickle" }),
        Object.freeze({ label: "Model downloading", url: "https://huggingface.co/docs/hub/models-downloading" }),
        Object.freeze({ label: "Download files from the Hub", url: "https://huggingface.co/docs/huggingface_hub/guides/download" }),
        Object.freeze({ label: "Model download statistics", url: "https://huggingface.co/docs/hub/models-download-stats" }),
        Object.freeze({ label: "Inference Providers security (not used by Text to Lattice)", url: "https://huggingface.co/docs/inference-providers/security" }),
      ]),
    }),
    api: Object.freeze({
      summary: "The quota API authorizes bounded local demonstrations and does not perform inference. The official client sends it no user text, and its schema defines no user-text field.",
      rules: Object.freeze([
        "Only the exact same-origin lease path accepts POST, PATCH, or DELETE. Requests have no query string or body and are rejected for unsafe origin, fetch metadata, content headers, transfer encoding, oversized cookies, malformed attestation, or invalid authorization.",
        "Each official-client acquisition requires a fresh Cloudflare Turnstile token. After exact request admission, the Worker validates its single-use status, five-minute lifetime, verify.hah.dev hostname, and text_to_lattice action before grant accounting; the official frame bridge places no source text in the token.",
        "Turnstile runs only in a dedicated verify.hah.dev cross-origin frame, not in the résumé document. The bridge sends only the public site key, widget size, and a random request identifier, checks the exact origin, Window, and closed message schema in both directions, and removes the frame after every result.",
        "An opaque signed, host-only HttpOnly cookie scoped to the Text to Lattice API path, short-lived HMAC-authenticated lease credentials, independent local request shapers, exact 40-per-rolling-minute and 3,000-per-UTC-day request admission, eight otherwise eligible grants per minute, 100 grants per rolling day, one active lease per browser, and eight service-wide concurrent leases are independent controls.",
        "Visitor-cookie, lease-credential, and Turnstile validation keys are distinct Cloudflare encrypted Worker secrets; deploy credentials belong only in protected repository or deployment-environment secrets and never in source, client bundles, logs, or public artifacts.",
        "The globally named SQLite-backed Durable Object is the accounting authority. Retention alarms coalesce at UTC minute boundaries while each request still prunes exact millisecond timestamps. Location and IP shapers shed load but are explicitly not used as exact quota evidence.",
        "Application and edge quota denials carry a bounded Retry-After estimate; while the page remains open, the interface presents its remaining duration and local-time ETA and holds retry until that estimate expires.",
        "The gate fails closed. Public HTML, Markdown, manifests, JSON-LD, sitemap, llms files, and canonical project records remain available when the tool or gate is unavailable.",
      ]),
      limitation: "The exact admission boundary limits verified downstream work and bounds admitted state changes, but hostile requests that reach it still consume Worker and Durable Object admission requests; no application-layer rule can guarantee a free-tier request budget against a sufficiently distributed hostile flood. Exact limits are request, grant, and concurrency backstops, while Free-plan exhaustion is the monetary fail-closed boundary. The required Cloudflare IP rule and Turnstile are best-effort perimeter controls, and rejected traffic still consumes some provider work. The published free-tier basis includes direct and alarm Durable Object requests, state and alarm row writes, and the full-day duration bound for one 128 MB singleton; CPU, real runtime, permissive-counter overshoot, distributed traffic, and other account workloads still require production measurement. Cloudflare may process request and Turnstile security signals and retain deleted Durable Object SQLite state in managed recovery history under its own service terms.",
      sources: Object.freeze([
        Object.freeze({ label: "Cloudflare Turnstile server-side validation", url: "https://developers.cloudflare.com/turnstile/get-started/server-side-validation/" }),
        Object.freeze({ label: "Cloudflare Turnstile client-side rendering", url: "https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/" }),
        Object.freeze({ label: "Cloudflare Turnstile hostname management", url: "https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/" }),
        Object.freeze({ label: "Cloudflare Turnstile Content Security Policy", url: "https://developers.cloudflare.com/turnstile/reference/content-security-policy/" }),
        Object.freeze({ label: "Cloudflare Turnstile Privacy Addendum", url: "https://www.cloudflare.com/turnstile-privacy-policy/" }),
        Object.freeze({ label: "Cloudflare WAF rate-limiting availability", url: "https://developers.cloudflare.com/waf/rate-limiting-rules/#availability" }),
        Object.freeze({ label: "Cloudflare Workers limits", url: "https://developers.cloudflare.com/workers/platform/limits/" }),
        Object.freeze({ label: "Cloudflare Workers Static Assets billing", url: "https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/" }),
        Object.freeze({ label: "Cloudflare Durable Objects pricing", url: "https://developers.cloudflare.com/durable-objects/platform/pricing/" }),
      ]),
    }),
    outputProtection: Object.freeze({
      summary: "Generated results remain transient within the open tool.",
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
    "hah.dev keeps the source and output in transient page memory and does not transmit them or include them in public semantic artifacts; browser extensions and browser services a visitor has separately enabled remain outside hah.dev's control.",
    "The official hah.dev client sends the usage gate only bodyless same-origin requests and a bounded acquisition-attestation header. The API schema accepts no source, clarification, prompt, candidate, result, word-count, register, or genre field; unknown fields are not read, logged, stored, or forwarded, while the bounded attestation value is sent to Cloudflare Siteverify.",
    "An opaque signed, host-only HttpOnly browser cookie scoped to the tool API path, bounded usage timestamps, and active-lease tokens enforce the official interface limits; application-visible records are alarm-pruned, while Cloudflare may retain deleted SQLite state in provider-managed recovery history for up to 30 days.",
    "The official interface quota bounds the deployed demonstration; exact request admission, grant limits, per-browser ownership, and service-wide concurrency remain backstops when a browser pseudonym changes.",
    "Turnstile runs at the dedicated verify.hah.dev origin, isolated from the résumé DOM; the exact-origin message bridge carries no source or generated text. Cloudflare still receives the security signals described in its Privacy Addendum.",
    "A modified client can invoke the public local engine or download the public model assets without the lease API; the gate controls only the official hah.dev interface.",
    "The browser must provide WebGPU in a secure context.",
    "First use downloads about 4.10 GB of public model assets and can require about 3.5 GB of working memory.",
    "If the pinned model assets are not already cached, conversion requires network access to their public upstream hosts; entered text is not included in those asset requests.",
    "Canonical hah.dev pages, manifests, Markdown, JSON-LD, the sitemap, and the tool contract remain readable without JavaScript, WebGPU, model downloads, or conversion availability.",
    "Independent verification is limited to languages supported by both local model families; other text is marked for review.",
    "A review-required draft is an attempted translation, not a certification of semantic equivalence.",
  ]),
});
