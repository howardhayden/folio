export const PROJECT_DOCUMENTS_VERSION = "hah-portfolio-project-documents.v3";
export const PROJECT_DOCUMENTS_UPDATED = "2026-11-23";

const documentationRoot = "https://hah.dev/documentation/text-to-lattice/";

export const projectDocuments = Object.freeze([
  Object.freeze({
    id: "lattice-concept-map",
    artifactId: "DOC-CONCEPT",
    projectId: "lattice",
    scope: "method-and-ecosystem",
    label: "Lattice Concept and Ecosystem Map",
    title: "Lattice concept and ecosystem map",
    htmlUrl: `${documentationRoot}lattice-concept-map.html`,
    markdownUrl: `${documentationRoot}LATTICE-CONCEPT-MAP.md`,
    htmlMediaType: "text/html",
    markdownMediaType: "text/markdown",
  }),
  Object.freeze({
    id: "lattice-skill-map",
    artifactId: "DOC-SKILL",
    projectId: "lattice",
    scope: "method",
    label: "Lattice System Skill Map",
    title: "Lattice system skill map",
    htmlUrl: `${documentationRoot}lattice-skill-map.html`,
    markdownUrl: `${documentationRoot}LATTICE-SKILL-MAP.md`,
    htmlMediaType: "text/html",
    markdownMediaType: "text/markdown",
  }),
  Object.freeze({
    id: "text-to-lattice-service-blueprint",
    artifactId: "DOC-BLUEPRINT",
    projectId: "lattice",
    scope: "wrapper",
    label: "Text to Lattice Service Blueprint",
    title: "Text to Lattice service blueprint",
    htmlUrl: `${documentationRoot}text-to-lattice-service-blueprint.html`,
    markdownUrl: `${documentationRoot}TEXT-TO-LATTICE-SERVICE-BLUEPRINT.md`,
    htmlMediaType: "text/html",
    markdownMediaType: "text/markdown",
  }),
  Object.freeze({
    id: "text-to-lattice-security-model",
    artifactId: "DOC-SECURITY",
    projectId: "lattice",
    scope: "wrapper",
    label: "Text to Lattice Security Model",
    title: "Text to Lattice security model",
    htmlUrl: `${documentationRoot}text-to-lattice-security-model.html`,
    markdownUrl: `${documentationRoot}TEXT-TO-LATTICE-SECURITY-MODEL.md`,
    htmlMediaType: "text/html",
    markdownMediaType: "text/markdown",
  }),
]);

export function documentsForProject(projectId) {
  return projectDocuments.filter((document) => document.projectId === projectId);
}

const methodSource = "https://github.com/howardhayden/lattice/blob/c0658b7e92a2defb0a8ab45ad17cc00295a45fd2/";
const serviceSource = "https://github.com/howardhayden/folio/blob/a47ca0557d3678f5e5c64f8d5a9bc8e433b43b39/";
const browserBundle = documentationRoot + "browser-evidence/ttl-browser-20261123T143941Z-a495af12/TEXT-TO-LATTICE-BROWSER-EVIDENCE";

export const latticeReadingGuide = {
  updated: PROJECT_DOCUMENTS_UPDATED,
  introduction: "The Lattice engine evaluates candidate wording against meaning supplied by the caller. Text to Lattice is a separate hosted service that starts with ordinary prose, proposes a rewrite, and checks whether it preserves the passage’s meaning.",
  projectUrl: "https://hah.dev/projects/lattice/",
  documentationUrl: documentationRoot + "index.html",
  evidenceUrl: documentationRoot + "evidence.html",
  jsonUrl: documentationRoot + "reading-guide.json",
  subjects: [
    {
      id: "lattice-method",
      name: "Lattice method and engine",
      emphasis: ["Preserve what a passage says while changing how it reads.", "Keep required instructions explicit across registers and accessible channels."],
      capabilities: ["Represent facts, obligations and their relationships in a caller-supplied meaning contract.", "Test candidate wording against that contract, prioritize protected meaning, and record the selection in a derivation receipt."],
      technologies: ["TypeScript engine", "Typed meaning contracts", "Deterministic candidate selection"],
      evidence: ["meaning-contract", "selection"],
    },
    {
      id: "text-to-lattice-api",
      name: "Text to Lattice API",
      emphasis: ["Let visitors try a register change on a short passage and compare the result with their original.", "Give visitors control over external processing and bound the cost of each request."],
      capabilities: ["Accept prose after confirmation, infer its meaning, and send drafting and review to designated models.", "Check the proposed wording, return a translation or an already-suitable result, and withhold drafts that fail review."],
      technologies: ["Cloudflare Workers and Durable Objects", "Same-origin HTTP API", "Hugging Face via OpenRouter", "Qwen on DeepInfra", "Llama on CoreWeave"],
      evidence: ["service-path", "admission-and-consent", "browser-results", "production-publication"],
    },
  ],
  evidence: [
    {
      id: "meaning-contract", subject: "lattice-method", title: "The caller defines what must survive a rewrite",
      observation: "The export notice records a digest mismatch and requires the recipient to isolate the export until its provenance is reviewed. It expressly forbids attributing the change to a person. These are three distinct constraints on candidate wording.",
      kind: "worked-example",
      sources: [{ label: "Export mismatch notice, example input", url: methodSource + "examples/export-mismatch-notice.request.json" }, { label: "Typed meaning contract", url: documentationRoot + "lattice-concept-map.html#lat-n-002" }],
    },
    {
      id: "selection", subject: "lattice-method", title: "Required meaning takes priority over style",
      observation: "The engine checks a candidate against protected requirements before comparing register fit. Its receipt identifies the selected wording and the decisions that led to it. A host can inspect that record when reviewing a passage.",
      kind: "implementation-and-tests",
      sources: [{ label: "Engine selection and receipt", url: methodSource + "src/engine.ts" }, { label: "Executable boundary cases", url: methodSource + "test/adversarial.test.mjs" }, { label: "Deterministic selection", url: documentationRoot + "lattice-skill-map.html#lat-sk-05" }],
    },
    {
      id: "service-path", subject: "text-to-lattice-api", title: "The service infers meaning from visitor prose",
      observation: "After confirmation, the browser sends the passage to hah.dev. The Worker uses Qwen to analyze and draft, deterministic checks to screen the draft, and Llama to review it. A failed check can withhold the result. The hosted service implements its own inference pipeline.",
      kind: "implementation",
      sources: [{ label: "Deployed Worker source", url: serviceSource + "workers/text-to-lattice-api/worker.js" }, { label: "Inference and review adapter", url: serviceSource + "workers/text-to-lattice-api/huggingFaceAdapter.js" }, { label: "Review and classification", url: documentationRoot + "text-to-lattice-service-blueprint.html#bp-07" }],
    },
    {
      id: "admission-and-consent", subject: "text-to-lattice-api", title: "Consent and admission bound each submission",
      observation: "Until the visitor confirms external processing, typing stays in the browser. Ordinary service admits 30 transformations globally and three per cooperating browser cookie jar each UTC day. The external services apply their own data-handling terms.",
      kind: "policy-and-implementation",
      sources: [{ label: "API contract and processing terms", url: "https://hah.dev/projects/lattice/text-to-lattice/" }, { label: "Production admission policy", url: serviceSource + "workers/text-to-lattice-api/capacityPolicy.js" }, { label: "Consent boundary", url: documentationRoot + "text-to-lattice-security-model.html#sec-01" }],
    },
    {
      id: "browser-results", subject: "text-to-lattice-api", title: "Safari and Brave completed the visitor path",
      observation: "In run 729, Safari returned a translation. Brave found its original passage already suited to the context. Each browser sent one content-bearing request to hah.dev, focused the result, and cleared the input and output on a hard reload. Firefox separately passed 14 input-only checks.",
      kind: "observed-browser-results",
      sources: [{ label: "Sanitized browser observations (JSON)", url: browserBundle + ".json" }, { label: "Safari capture", url: browserBundle + ".safari-webkit.png" }, { label: "Brave capture", url: browserBundle + ".brave-chromium.png" }, { label: "Release qualification, including Firefox scope", url: documentationRoot + "TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md" }],
    },
    {
      id: "production-publication", subject: "text-to-lattice-api", title: "The qualified build reached production",
      observation: "On November 23, the production service check returned HTTP 200 and accepted the original wording. The subsequent Pages recovery published the build from that check. The two runs record the service result and the publication separately.",
      kind: "production-receipt",
      sources: [{ label: "Run 744, production service check", url: "https://github.com/howardhayden/folio/actions/runs/45255468630" }, { label: "Pages publication receipt", url: "https://github.com/howardhayden/folio/actions/runs/45259201772" }, { label: "Machine-readable release register", url: documentationRoot + "TEXT-TO-LATTICE-RELEASE-REGISTER.json" }],
    },
  ],
  documents: [
    { id: "lattice-concept-map", subject: "lattice-method", question: "What must a rewrite preserve?", answer: "Start with the export notice. Its meaning contract names the finding, the required action and the conclusion a reader must avoid. Follow those requirements from semantic atoms to the selected passage.", evidence: ["meaning-contract"], sections: [{ id: "lat-n-002", label: "Meaning contract" }, { id: "lat-n-003", label: "Semantic atoms" }, { id: "lat-n-017", label: "Derivation receipt" }] },
    { id: "lattice-skill-map", subject: "lattice-method", question: "What can the engine decide?", answer: "Follow one selection. The engine can check protected meaning and choose among eligible candidates in a defined order. The host supplies the meaning contract and remains responsible for its accuracy.", evidence: ["selection"], sections: [{ id: "lat-sk-01", label: "Meaning and relations" }, { id: "lat-sk-05", label: "Deterministic selection" }, { id: "lat-sk-10", label: "Host responsibilities" }] },
    { id: "text-to-lattice-service-blueprint", subject: "text-to-lattice-api", question: "What happens after I submit?", answer: "The visitor confirms processing. The Worker checks admission, asks Qwen to analyze and draft, then checks the result with Llama. The terminal presents an accepted outcome or explains that the service withheld it.", evidence: ["service-path", "browser-results"], sections: [{ id: "bp-04", label: "Admission" }, { id: "bp-06", label: "Drafting and checks" }, { id: "bp-07", label: "Review and outcome" }] },
    { id: "text-to-lattice-security-model", subject: "text-to-lattice-api", question: "Where does my passage go, and what bounds the risk?", answer: "Typing stays local until confirmation. hah.dev then sends the passage through Hugging Face and OpenRouter to the named providers. Admission limits constrain work, the application avoids storing passage content, and a hard reload clears the visitor’s text.", evidence: ["admission-and-consent", "browser-results"], sections: [{ id: "sec-01", label: "Consent and destinations" }, { id: "sec-04", label: "Resource bounds" }, { id: "sec-07", label: "Content retention" }] },
  ],
};
