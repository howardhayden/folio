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

const serviceSource = "https://github.com/howardhayden/folio/blob/a47ca0557d3678f5e5c64f8d5a9bc8e433b43b39/";
const captureDirectory = documentationRoot + "browser-evidence/ttl-browser-20261123T143941Z-a495af12/";
const browserBundle = captureDirectory + "TEXT-TO-LATTICE-BROWSER-EVIDENCE";

const edgeArchitecture = {
  anchor: "cloudflare-edge",
  title: "Security, cost and verification at the Cloudflare edge",
  claims: [
    {
      id: "edge-browser-policy", title: "Where the browser can send text",
      summary: "A response-policy Worker runs on the four addresses that serve the résumé, so unrelated pages avoid that invocation. Its headers restrict browser API connections to hah.dev and keep other sites from embedding the résumé. Only the separate API Worker holds the provider credential.",
    },
    {
      id: "admission-and-consent", title: "When paid inference can begin",
      summary: "The API Worker checks the origin, signed quota cookie, request format and size. Requests arriving at different edge locations share one transactional quota ledger, so two cannot both spend the last daily admission. Tests recorded zero provider calls when admission was denied or the quota ledger was unavailable.",
    },
    {
      id: "service-path", title: "Which results reach the reader",
      summary: "The server checks proposed wording against the source for changed obligations. The API Worker also checks the fields and byte size of the final result. A rewrite that drops a required condition can be withheld even when the provider returned well-formed data.",
    },
    {
      id: "edge-release-verification", title: "How the tested deployment is identified",
      summary: "Release checks read route ownership and API bindings from Cloudflare. The Safari and Brave evidence identifies the tested Pages build and the version of each Worker assigned 100% of its traffic at qualification.",
    },
  ],
};

export const latticeApiOverview = "Text to Lattice starts with ordinary prose. Qwen identifies what the passage says and drafts a rewrite. Llama compares that draft with the source, while server code checks details such as quantities and protected quotations. A copied passage fails when a rewrite is required. Returning the original takes a separate decision that its wording already fits.";

export const latticeReadingGuide = {
  updated: PROJECT_DOCUMENTS_UPDATED,
  introduction: "Lattice evaluates wording against a meaning contract supplied by its caller. Text to Lattice starts with ordinary prose. Its interface stays on GitHub Pages, while two Cloudflare edge Workers run on demand to enforce browser policy and decide when to call paid external models. This lets the portfolio operate without a dedicated API server.",
  projectUrl: "https://hah.dev/projects/lattice/",
  documentationUrl: documentationRoot + "index.html",
  evidenceUrl: documentationRoot + "evidence.html",
  jsonUrl: documentationRoot + "reading-guide.json",
  edgeArchitecture,
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
      emphasis: [
        "Preserve the force of the original. Changing “may” to “must” can alter an obligation even when every name and number survives.",
        "Keep browser access, permission to spend provider capacity and acceptance of a rewrite separate. Each decision has a check the next component can rely on.",
        "Make external processing a deliberate choice. The application keeps passage text out of storage and logs, and bounds the inference work a submission can start.",
      ],
      capabilities: [
        "Check quantities, URLs and protected quotations in code. A separate model reviews obligations and relationships that literal matching can miss.",
        "Send a failed draft back with specific feedback, then check the revised wording again. A document-level review checks across passages when their relationship or the proposed outcome calls for it.",
        "Return a checked rewrite, affirm that the original already fits, label a draft that needs human review, or withhold the text when required checks fail.",
        "Show the server’s current phase in the terminal and diagram. The browser waits for a complete result before displaying output.",
      ],
      technologies: [
        "Two Cloudflare edge Workers handle the résumé’s security headers and API submissions. A SQLite-backed Durable Object coordinates the daily quota across requests.",
        "Hugging Face routes through OpenRouter to Qwen on Parasail for analysis and drafting, and to Llama on CoreWeave for verification and document certification.",
        "A single HTTP response carries numbered, content-free phase updates followed by the terminal result or error.",
      ],
      evidence: ["edge-browser-policy", "admission-and-consent", "service-path", "repair-and-outcomes", "server-progress", "edge-release-verification", "browser-results", "production-publication"],
    },
  ],
  evidence: [
    {
      id: "meaning-contract", subject: "lattice-method", title: "A change of tone can preserve an instruction",
      observation: "In this illustration, “Return the key by Friday” becomes “Please return the key by Friday.” The tone shifts while the action and deadline stay the same. Moving the deadline to Monday would change the instruction. These sentences were written for this guide.",
      kind: "editorial-illustration",
      sources: [{ label: "Public concept map, meaning contract", url: documentationRoot + "lattice-concept-map.html#lat-n-002" }],
    },
    {
      id: "selection", subject: "lattice-method", title: "The caller supplies the meaning to preserve",
      observation: "The published method assigns the caller responsibility for the intended meaning. The engine evaluates wording against that contract and returns a record of its decision. The skill map describes the responsibility the host keeps when it presents the result.",
      kind: "published-method-documentation",
      sources: [{ label: "Public concept map, decision record", url: documentationRoot + "lattice-concept-map.html#lat-n-017" }, { label: "Public skill map, host responsibilities", url: documentationRoot + "lattice-skill-map.html#lat-sk-10" }],
    },
    {
      id: "edge-browser-policy", subject: "text-to-lattice-api", title: "Two Workers separate page policy from provider access",
      observation: "The response-policy Worker adds the Content Security Policy to the four addresses that serve the résumé. It restricts browser API connections to the same origin and blocks embedding. The API Worker owns the inference route and keeps the provider credential on the server. During qualification, Safari and Brave each sent one request containing the passage to hah.dev.",
      kind: "implementation-and-browser-evidence",
      sources: [{ label: "Cloudflare’s request-driven edge runtime", url: "https://developers.cloudflare.com/workers/reference/how-workers-works/" }, { label: "Response headers and their four document paths", url: serviceSource + "workers/text-to-lattice-response-policy/worker.js#L1-L35" }, { label: "Same-origin connection policy test", url: serviceSource + "tests/lattice-network-governance.test.mjs#L226-L235" }, { label: "Observed browser requests (JSON)", url: browserBundle + ".json" }],
    },
    {
      id: "service-path", subject: "text-to-lattice-api", title: "Separate drafting from acceptance",
      observation: "Qwen analyzes the source and proposes wording. Server code checks protected details such as quantities, URLs and quoted dialogue. Llama compares the passage and candidate for changes in meaning. When the document needs certification, the service checks the assembled text as a whole.",
      kind: "implementation",
      sources: [{ label: "Final result and response-size checks", url: serviceSource + "workers/text-to-lattice-api/worker.js#L1115-L1128" }, { label: "Checks on protected details", url: serviceSource + "app/resume/lattice/validators.js#L661-L845" }, { label: "Document certification decision", url: serviceSource + "app/resume/latticeDemo.js#L2454-L2482" }, { label: "Service blueprint, review and classification", url: documentationRoot + "text-to-lattice-service-blueprint.html#bp-07" }],
    },
    {
      id: "repair-and-outcomes", subject: "text-to-lattice-api", title: "A copied draft and an accepted original have different outcomes",
      observation: "A repair that merely copies the source fails when a rewrite is required. A separately reviewed original can pass if its wording already fits. A changed draft can be shown for human review when safety and meaning checks pass but issues such as clarity or register remain. A failed required check can leave the reader with no candidate text.",
      kind: "implementation-and-tests",
      sources: [{ label: "Four result states and their conditions", url: serviceSource + "app/resume/latticeDemo.js#L3251-L3288" }, { label: "Rechecking a revised candidate", url: serviceSource + "app/resume/latticeDemo.js#L4036-L4073" }, { label: "Copied repair and real repair compared in tests", url: serviceSource + "tests/lattice-api-worker.test.mjs#L9870-L9886" }, { label: "Retained-original certification test", url: serviceSource + "tests/lattice-demo.test.mjs#L2887-L2940" }],
    },
    {
      id: "server-progress", subject: "text-to-lattice-api", title: "The terminal follows real server work",
      observation: "The Worker reports named phases such as drafting, verification and repair over the original request. Phase updates carry no passage text. The client waits for the terminal result and the end of the response. An interrupted response cannot turn a progress indication into an accepted rewrite.",
      kind: "protocol-and-tests",
      sources: [{ label: "Worker phase and terminal records", url: serviceSource + "workers/text-to-lattice-api/worker.js#L1174-L1247" }, { label: "Client completion check", url: serviceSource + "app/resume/lattice/remoteRequest.js#L451-L502" }, { label: "Streaming success, error and cancellation tests", url: serviceSource + "tests/lattice-service-telemetry-worker.test.mjs" }],
    },
    {
      id: "admission-and-consent", subject: "text-to-lattice-api", title: "Consent and admission bound each submission",
      observation: "Typing stays local until the visitor confirms external processing. The API validates the request before inference. Edge requests share a named Durable Object. It reserves both daily allowances in one transaction and stores counts and opaque browser identifiers. Ordinary service permits 30 admissions globally and three per cooperating browser cookie jar per UTC day. Each admission allows up to 32 logical provider calls. Cloudflare meters edge usage separately from model inference. External providers apply their own processing terms.",
      kind: "policy-and-implementation",
      sources: [{ label: "API contract and processing terms", url: "https://hah.dev/projects/lattice/text-to-lattice/" }, { label: "How every edge request reaches the same quota object", url: serviceSource + "workers/text-to-lattice-api/capacityClient.js#L43-L71" }, { label: "Transactional quota ledger", url: serviceSource + "workers/text-to-lattice-api/capacityGate.js#L29-L76" }, { label: "Admission before provider work, including a failed ledger", url: serviceSource + "tests/lattice-api-worker.test.mjs#L8334-L8424" }, { label: "Production admission policy", url: serviceSource + "workers/text-to-lattice-api/capacityPolicy.js" }, { label: "Consent boundary", url: documentationRoot + "text-to-lattice-security-model.html#sec-01" }, { label: "Cloudflare Workers pricing", url: "https://developers.cloudflare.com/workers/platform/pricing/" }],
    },
    {
      id: "edge-release-verification", subject: "text-to-lattice-api", title: "The browser evidence identifies the Workers that served the test",
      observation: "The service deployment checks Cloudflare’s route and custom-domain inventory against the declared routes. Run 729 recorded the API Worker’s secret and quota binding types without reading secret values. The records checked before and after the Safari and Brave captures match on the Pages artifact, the two Worker versions and their traffic assignments.",
      kind: "deployment-verification-and-observation",
      sources: [{ label: "Route ownership check", url: serviceSource + "scripts/verify-text-to-lattice-route-inventory.mjs#L224-L262" }, { label: "Deployment before browser capture (JSON)", url: captureDirectory + "TEXT-TO-LATTICE-DEPLOYMENT-EVIDENCE.before.json" }, { label: "Deployment after browser capture (JSON)", url: captureDirectory + "TEXT-TO-LATTICE-DEPLOYMENT-EVIDENCE.after.json" }, { label: "Version and traffic assignment tests", url: serviceSource + "tests/lattice-deployment-evidence.test.mjs#L429-L462" }],
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
    { id: "lattice-concept-map", subject: "lattice-method", question: "What must a rewrite preserve?", answer: "Compare a direct request to return a key by Friday with a more courteous version. The tone may change. The action and deadline must survive. The public map explains how a caller states those requirements.", evidence: ["meaning-contract"], sections: [{ id: "lat-n-002", label: "Meaning contract" }, { id: "lat-n-003", label: "Semantic atoms" }, { id: "lat-n-017", label: "Derivation receipt" }] },
    { id: "lattice-skill-map", subject: "lattice-method", question: "What can the engine decide?", answer: "The caller supplies the intended meaning. The engine assesses proposed wording and returns a decision record. Follow the public skill map to see which judgments still belong to the host.", evidence: ["selection"], sections: [{ id: "lat-sk-01", label: "Meaning and relations" }, { id: "lat-sk-05", label: "Deterministic selection" }, { id: "lat-sk-10", label: "Host responsibilities" }] },
    { id: "text-to-lattice-service-blueprint", subject: "text-to-lattice-api", question: "What happens after I submit?", answer: "Follow one submission from consent to a terminal result. Qwen drafts, server code checks protected details, and Llama compares the candidate with the source. A repair must pass review on its own wording. The reader receives a checked rewrite, a checked original, a labeled review draft, or an explanation that the text was withheld.", evidence: ["service-path", "repair-and-outcomes", "server-progress", "browser-results"], sections: [{ id: "bp-04", label: "Admission" }, { id: "bp-06", label: "Drafting and checks" }, { id: "bp-07", label: "Review and outcome" }] },
    { id: "text-to-lattice-security-model", subject: "text-to-lattice-api", question: "Where does my passage go, and what bounds the risk?", answer: "Typing stays local until confirmation. The page policy confines browser API connections to hah.dev. The API Worker checks admission before sending text through Hugging Face and OpenRouter to the named providers. The quota ledger stores usage counts without the passage. The release record shows which Workers served the tested build.", evidence: ["edge-browser-policy", "admission-and-consent", "edge-release-verification", "browser-results"], sections: [{ id: "sec-01", label: "Consent and destinations" }, { id: "sec-04", label: "Resource bounds" }, { id: "sec-07", label: "Content retention" }] },
  ],
};
