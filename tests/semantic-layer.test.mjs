import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  SITE_CONTENT_UPDATED,
  SITE_CONTENT_VERSION,
  SITE_REPOSITORY,
  sharedRequirements,
  practiceStandards,
} from "../app/content/siteContent.js";
import { textToLatticeContract } from "../app/content/textToLatticeContent.js";
import {
  PROJECT_DOCUMENTS_UPDATED, PROJECT_DOCUMENTS_VERSION, projectDocuments,
} from "../app/content/projectDocuments.js";
import {
  LOCAL_LATTICE_MODEL,
  LATTICE_MODEL_ROLES,
  LATTICE_RUNTIME,
  LATTICE_STRUCTURED_OUTPUT_RUNTIME,
  LATTICE_TOKENIZER_RUNTIME,
  LATTICE_WASM_REVISION,
  LATTICE_WASM_REPOSITORY,
} from "../app/resume/lattice/modelContract.js";
import {
  knowledgeGraph,
  namespaceTerms,
  projectsManifest,
  projectsSchema,
  projectsSchemaV1,
  renderProjectMarkdown,
  resumeManifest,
  shelfManifest,
  toolsManifest,
} from "../app/semantic/portfolio.js";
import {
  canonicalHtmlRoutes,
  semanticArtifactRoutes,
  staticExportRoutes,
  staticSourceCopies,
} from "../app/semantic/routes.js";
import {
  PROJECT_CONTENT_UPDATED,
  PROJECT_CONTENT_VERSION,
  projects,
} from "../app/resume/projects.js";
import { resumeDetailList } from "../app/resume/resumeDetails.js";

const root = resolve(new URL("..", import.meta.url).pathname);
let handlerPromise;

const expectedSkillStacks = [
  {
    id: "systems-architecture",
    title: "Systems Architecture",
    sections: [{
      label: null,
      items: [
        "Local-First Architecture",
        "API Integration and Boundary Design",
        "State Modeling",
        "Deterministic Simulation",
        "Multi-Agent Systems",
        "Requirements Engineering and Traceability",
      ],
    }],
  },
  {
    id: "interaction-and-service-design",
    title: "Interaction and Service Design",
    sections: [{
      label: null,
      items: [
        "Information Architecture",
        "Interaction Design",
        "Accessibility Engineering",
        "Service and Ecosystem Mapping",
      ],
    }],
  },
  {
    id: "security-and-verification",
    title: "Security and Verification",
    sections: [
      {
        label: null,
        items: [
          "Threat Modeling",
          "Input and Import Validation",
          "Adversarial Testing",
          "Regression Testing",
          "Failure-Mode and Recovery Testing",
          "Software Bill of Materials (SBOM)",
        ],
      },
      { label: "Tools", items: ["Playwright", "CodeQL"] },
    ],
  },
  {
    id: "data-architecture-and-interoperability",
    title: "Data Architecture and Interoperability",
    sections: [
      {
        label: null,
        items: [
          "Schema Design and Validation",
          "Entity-Relationship Modeling",
          "Metadata Crosswalks and Interoperability",
          "Data Governance",
        ],
      },
      {
        label: "Technologies",
        items: ["SQL", "SQLite", "MySQL", "Neo4j", "MongoDB", "ArangoDB", "IndexedDB", "R"],
      },
    ],
  },
  {
    id: "technical-documentation-and-modeling",
    title: "Technical Documentation and Modeling",
    sections: [{
      label: null,
      items: [
        "Architecture and Design Documentation",
        "Technical Guides and User Manuals",
        "Unified Modeling Language (UML)",
        "Network Diagrams",
        "Data-Flow Diagrams",
        "Interactive and Exportable Documentation",
      ],
    }],
  },
  {
    id: "business-analysis-and-operational-planning",
    title: "Business Analysis and Operational Planning",
    sections: [{
      label: null,
      items: [
        "Business Process Modeling (BPMN) and Flowcharts",
        "Project Scheduling (Gantt Charts)",
        "Contract Analysis",
        "Proposal Development",
        "Risk Assessment",
        "Incident Response and Continuity Planning",
        "Release and Change Management",
      ],
    }],
  },
  {
    id: "software-development",
    title: "Software Development",
    sections: [
      {
        label: "Languages",
        items: ["TypeScript", "JavaScript", "Python", "C#", "C++", "Java", "Bash", "GLSL"],
      },
      { label: "Design Practices", items: ["Object-Oriented Design", "SOLID Principles"] },
    ],
  },
  {
    id: "frameworks-platforms-and-delivery",
    title: "Frameworks, Platforms & Delivery",
    sections: [
      {
        label: "Application frameworks and runtimes",
        items: [".NET", "React", "Next.js", "Node.js", "Three.js", "Bootstrap"],
      },
      {
        label: "Build and delivery",
        items: [
          "Vite",
          "Git",
          "npm",
          "GitHub Actions",
          "Continuous Integration & Deployment (CI/CD)",
          "Cloudflare Workers",
          "Wrangler",
        ],
      },
    ],
  },
  {
    id: "fabrication-and-electronics",
    title: "Fabrication & Electronics",
    sections: [
      {
        label: "Fabrication",
        items: [
          "Laser Cutting",
          "Machined Drilling",
          "Multi-Needle Embroidery",
          "3D Printing",
          "Sublimation Printing",
        ],
      },
      { label: "Electronics", items: ["Soldering with 63Sn–37Pb Alloy"] },
      {
        label: "Electrostatic discharge controls",
        items: ["Grounding", "Continuous Monitoring", "Wrist Straps", "ESD Smocks"],
      },
    ],
  },
].map((stack) => ({
  ...stack,
  description: "",
  items: stack.sections.flatMap(({ items }) => items),
}));

const expectedSkillStacksMarkdown = `# Skill stacks\n\n${expectedSkillStacks.map((stack) => {
  const sections = stack.sections.map((section) => [
    ...(section.label === null ? [] : [`### ${section.label}`, ""]),
    section.items.map((item) => `- ${item}`).join("\n"),
  ].join("\n")).join("\n\n");
  return `## ${stack.title}\n\n${sections}`;
}).join("\n\n")}`;

function handler() {
  handlerPromise ??= import(`${pathToFileURL(resolve(root, "dist/server/index.js")).href}?semantic=${process.pid}-${Date.now()}`)
    .then(({ default: render }) => render);
  return handlerPromise;
}

async function request(pathname, accept) {
  const render = await handler();
  let url = new URL(pathname, "https://hah.dev");
  for (let count = 0; count <= 2; count += 1) {
    const response = await render(new Request(url, { headers: { accept } }));
    if (![301, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    assert.ok(location, `${pathname} redirect has a location`);
    url = new URL(location, url);
    assert.equal(url.origin, "https://hah.dev", `${pathname} stays on the canonical origin`);
  }
  assert.fail(`${pathname} exceeded the redirect bound`);
}

function authoredDocument(html) {
  return html.split('<script id="_R_">')[0];
}

function decodedText(html) {
  return authoredDocument(html)
    .replace(/<script\b[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[\s\S]*?<\/style>/giu, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&nbsp;", " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function staticFileUrl(filename) {
  return new URL(`../site/${filename}`, import.meta.url);
}

function decodeAttribute(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'");
}

function attributeFromTag(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, "iu"));
  return match ? decodeAttribute(match[1] ?? match[2]) : null;
}

function tagsWithAttribute(html, element, attribute, value) {
  return [...html.matchAll(new RegExp(`<${element}\\b[^>]*>`, "giu"))]
    .map((match) => match[0])
    .filter((tag) => attributeFromTag(tag, attribute)?.toLowerCase() === value.toLowerCase());
}

function embeddedJsonLd(html) {
  return [...authoredDocument(html).matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/giu)]
    .map((match) => JSON.parse(match[1]));
}

function jsonLdNodes(documents) {
  return documents.flatMap((document) => Array.isArray(document?.["@graph"]) ? document["@graph"] : [document]);
}

function internalAnchorPaths(html, basePathname) {
  const paths = new Set();
  for (const match of authoredDocument(html).matchAll(/<a\b[^>]*\bhref=(?:"([^"]+)"|'([^']+)')[^>]*>/giu)) {
    let url;
    try {
      url = new URL(decodeAttribute(match[1] ?? match[2]), new URL(basePathname, "https://hah.dev"));
    } catch {
      continue;
    }
    if (url.origin === "https://hah.dev") paths.add(url.pathname);
  }
  return paths;
}

function collectInternalGraphReferences(value, references, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectInternalGraphReferences(item, references, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  if (typeof value["@id"] === "string" && value["@id"].startsWith("https://hah.dev")) {
    references.push({ id: value["@id"], path });
  }
  for (const [key, item] of Object.entries(value)) {
    collectInternalGraphReferences(item, references, `${path}.${key}`);
  }
}

function projectValidator(schema = projectsSchema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

test("every canonical route is a substantive no-JavaScript document", async () => {
  for (const route of canonicalHtmlRoutes) {
    const response = await request(route.pathname, route.accept);
    const html = await response.text();
    const documentHtml = authoredDocument(html);
    assert.equal(response.status, 200, route.pathname);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/iu, route.pathname);
    assert.match(documentHtml, /<!DOCTYPE html>/iu, route.pathname);
    assert.equal((documentHtml.match(/<main\b/giu) ?? []).length, 1, `${route.pathname} has one main landmark`);
    assert.equal((documentHtml.match(/<h1\b/giu) ?? []).length, 1, `${route.pathname} has one h1`);
    assert.match(
      documentHtml,
      new RegExp(`<link rel="canonical" href="${new URL(route.pathname, "https://hah.dev").href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
      `${route.pathname} declares its canonical URL`,
    );
    assert.ok(decodedText(documentHtml).length >= 80, `${route.pathname} exposes substantive text before hydration`);
  }
});

test("project and résumé records remain present while the Lattice interaction is held", async () => {
  const response = await request("/resume/", "text/html");
  const html = await response.text();
  const text = decodedText(html);

  for (const project of projects) {
    assert.ok(text.includes(project.name), `${project.name} title is server-rendered`);
    for (const paragraph of project.summary) assert.ok(text.includes(paragraph), `${project.name} summary is server-rendered`);
  }
  for (const detail of resumeDetailList) {
    assert.ok(text.includes(detail.title), `${detail.title} modal title is server-rendered`);
    for (const line of [...detail.details, ...(detail.courses ?? [])]) {
      assert.ok(text.includes(line), `${detail.id} modal content is server-rendered`);
    }
  }
  assert.match(html, /Text to Lattice is held at the public boundary/u);
  assert.match(html, /href="\/projects\/lattice\/text-to-lattice\/"[^>]*>Lattice<\/a>/u);
  assert.doesNotMatch(html, /class="modal resume-modal lattice-modal"|id="lattice-demo-dialog"|id="lattice-demo-input"/u);
});

test("machine manifests match their authoritative source objects", async () => {
  const expected = new Map([
    ["/projects.json", projectsManifest],
    ["/resume.json", resumeManifest],
    ["/tools.json", toolsManifest],
    ["/shelf.json", shelfManifest],
    ["/knowledge-graph.jsonld", knowledgeGraph],
    ["/schemas/projects-v1.schema.json", projectsSchemaV1],
    ["/schemas/projects-v2.schema.json", projectsSchema],
  ]);

  for (const [pathname, value] of expected) {
    const response = await request(pathname, pathname.endsWith("jsonld") ? "application/ld+json" : "application/json");
    assert.equal(response.status, 200, pathname);
    assert.deepEqual(await response.json(), value, `${pathname} has no divergent copy`);
  }
  assert.equal(projectsManifest.schema, projectsSchema.$id);
  for (const required of projectsSchema.required) {
    assert.ok(Object.hasOwn(projectsManifest, required), `project manifest has required field ${required}`);
  }
});

test("the nine skill stacks retain their exact hierarchy across AI-readable artifacts", async () => {
  assert.deepEqual(resumeManifest.skillStacks, expectedSkillStacks);
  assert.deepEqual(
    resumeManifest.skillStacks.map(({ id, title }) => ({ id, title })),
    expectedSkillStacks.map(({ id, title }) => ({ id, title })),
    "stack identifiers and presentation order remain authoritative",
  );
  for (const stack of resumeManifest.skillStacks) {
    assert.deepEqual(
      stack.items,
      stack.sections.flatMap(({ items }) => items),
      `${stack.id} keeps a complete flattened compatibility list`,
    );
  }

  const [resumeJsonResponse, resumeMarkdownResponse, llmsFullResponse] = await Promise.all([
    request("/resume.json", "application/json"),
    request("/content/resume.md", "text/markdown"),
    request("/llms-full.txt", "text/plain"),
  ]);
  const [resumeJson, resumeMarkdown, llmsFull] = await Promise.all([
    resumeJsonResponse.json(),
    resumeMarkdownResponse.text(),
    llmsFullResponse.text(),
  ]);

  assert.deepEqual(resumeJson.skillStacks, expectedSkillStacks, "/resume.json preserves every stack and group");

  const resumeSkillStart = resumeMarkdown.indexOf("# Skill stacks");
  assert.ok(resumeSkillStart >= 0, "résumé Markdown includes the skill-stack section");
  const resumeSkillMarkdown = resumeMarkdown.slice(resumeSkillStart).trimEnd();
  assert.equal(resumeSkillMarkdown, expectedSkillStacksMarkdown);

  const completeSkillStart = llmsFull.indexOf("# Skill stacks");
  assert.ok(completeSkillStart >= 0, "complete AI text includes the skill-stack section");
  const completeSkillEnd = llmsFull.indexOf("\n\n---", completeSkillStart);
  assert.ok(completeSkillEnd > completeSkillStart, "complete AI text bounds the résumé section");
  assert.equal(llmsFull.slice(completeSkillStart, completeSkillEnd).trimEnd(), expectedSkillStacksMarkdown);

  for (const renderedSkills of [resumeSkillMarkdown, llmsFull.slice(completeSkillStart, completeSkillEnd)]) {
    assert.doesNotMatch(renderedSkills, /No additional description is stated\.|- Not documented\./u);
  }
});

test("the project manifest passes its strict Draft 2020-12 schema and malformed records do not", () => {
  const validate = projectValidator();
  assert.equal(validate(projectsManifest), true, JSON.stringify(validate.errors, null, 2));

  const legacyManifest = structuredClone(projectsManifest);
  legacyManifest.schema = projectsSchemaV1.$id;
  legacyManifest.version = "hah-portfolio-projects.v1";
  for (const project of legacyManifest.projects) delete project.interactiveRelease;
  const validateV1 = projectValidator(projectsSchemaV1);
  assert.equal(validateV1(legacyManifest), true, JSON.stringify(validateV1.errors, null, 2));
  assert.equal(validateV1(projectsManifest), false, "archived v1 remains strict and does not silently accept the v2 field");

  const cases = [
    ["top-level extension", (manifest) => { manifest.runtimeText = "transient"; }],
    ["project extension", (manifest) => { manifest.projects[0].confidence = 1; }],
    ["missing required emphasis", (manifest) => { delete manifest.projects[0].emphasis; }],
    ["unknown project status", (manifest) => { manifest.projects[0].status.value = "unknown"; }],
    ["unknown interactive release status", (manifest) => { manifest.projects[0].interactiveRelease = "preview"; }],
    ["missing interactive release status", (manifest) => { delete manifest.projects[0].interactiveRelease; }],
    ["evidence extension", (manifest) => { manifest.projects[0].evidence[0].confidence = "high"; }],
    ["unknown relationship predicate", (manifest) => { manifest.projects[0].relationships[0].predicate = "loosely-related-to"; }],
    ["unresolvable relationship target", (manifest) => { manifest.projects[0].relationships[0].target = "https://hah.dev/projects/unlisted/#work"; }],
    ["undocumented license carrying a value", (manifest) => {
      manifest.projects[0].license = { documented: false, value: "https://example.com/license" };
    }],
    ["documented list with no items", (manifest) => {
      manifest.projects[0].capabilities = { documented: true, items: [] };
    }],
    ["unsecured evidence URL", (manifest) => { manifest.projects[0].evidence[0].url = "http://example.com/evidence"; }],
    ["absolute provenance source path", (manifest) => { manifest.projects[0].provenance.sourcePaths[0] = "/private/source"; }],
  ];

  for (const [label, mutate] of cases) {
    const candidate = structuredClone(projectsManifest);
    mutate(candidate);
    assert.equal(validate(candidate), false, `${label} is rejected`);
    assert.ok(validate.errors?.length, `${label} reports a schema error`);
  }
});

test("the completed King's College London record is exact across representations", async () => {
  const expected = {
    role: "Continuing Education",
    engagementKind: "education",
    organization: { name: "King’s College London" },
    period: "June 2026 — August 2026",
    start: "2026-06",
    end: "2026-08",
    ongoing: false,
    details: [
      "Professional Certificate in Grand Strategy:",
      "Strategic Communications",
      "Artificial Intelligence in National Security",
      "Sanctions and Statecraft",
      "Wargaming and Strategy",
    ],
  };
  const entry = resumeManifest.experience.find(({ id }) => id === "kings-college-london-grand-strategy");
  assert.ok(entry);
  assert.deepEqual(
    {
      role: entry.role,
      engagementKind: entry.engagementKind,
      organization: entry.organization,
      period: entry.period,
      start: entry.start,
      end: entry.end,
      ongoing: entry.ongoing,
      details: entry.details,
    },
    expected,
  );

  const [resumeHtml, resumeJson, graphText, resumeMarkdown, llmsFull] = await Promise.all([
    readFile(staticFileUrl("resume/index.html"), "utf8"),
    readFile(staticFileUrl("resume.json"), "utf8"),
    readFile(staticFileUrl("knowledge-graph.jsonld"), "utf8"),
    readFile(staticFileUrl("content/resume.md"), "utf8"),
    readFile(staticFileUrl("llms-full.txt"), "utf8"),
  ]);
  const bodies = [decodedText(resumeHtml), resumeJson, graphText, resumeMarkdown, llmsFull];
  for (const body of bodies) {
    assert.ok(body.includes(expected.period));
    for (const line of expected.details) assert.ok(body.includes(line));
  }
  const graphRole = JSON.parse(graphText)["@graph"].find((node) => node["@id"].endsWith("#kings-college-london-grand-strategy"));
  assert.deepEqual(
    {
      type: graphRole["@type"],
      role: graphRole.roleName,
      start: graphRole.startDate,
      end: graphRole.endDate,
      period: graphRole["hah:periodLabel"],
      organization: graphRole["hah:organization"],
      engagementKind: graphRole["hah:engagementKind"],
      ongoing: graphRole["hah:ongoing"],
      details: graphRole["hah:detail"],
    },
    {
      type: "Role",
      role: expected.role,
      start: expected.start,
      end: expected.end,
      period: expected.period,
      organization: { "@type": "Organization", name: expected.organization.name },
      engagementKind: expected.engagementKind,
      ongoing: expected.ongoing,
      details: expected.details,
    },
  );
  assert.deepEqual(graphRole["hah:heldBy"], { "@id": "https://hah.dev/#hayden-howard" });
  assert.equal(Object.hasOwn(graphRole, "worksFor"), false, "education is not represented as employment");
  assert.equal(Object.hasOwn(graphRole, "member"), false, "education is not represented as membership");

  const article = authoredDocument(resumeHtml).match(/<article\b[^>]*data-record-id="kings-college-london-grand-strategy"[^>]*>[\s\S]*?<\/article>/u)?.[0];
  assert.ok(article, "the KCL record is a visible semantic article");
  assert.match(article, /id="kings-college-london-grand-strategy"/u);
  assert.ok(article.includes(`<h3>${expected.role}</h3><p>${expected.period}<br/>${expected.organization.name}</p>`));
  assert.ok(article.includes(`<p><small>${expected.details.map((line) => `<span>${line}<br/></span>`).join("")}</small></p>`));
  assert.doesNotMatch(article, /present/iu);
  assert.doesNotMatch(resumeJson, /June 2026 — present/u);
});

test("legacy query-state views declare the canonical page and page-local JSON-LD", async () => {
  const cases = [
    ["/?view=resume", "/resume/"],
    ["/?view=tools", "/tools/"],
    ["/?view=shelf", "/shelf/"],
    ["/?view=home", "/"],
    ["/?view=unrecognized", "/"],
  ];

  for (const [requestPath, canonicalPath] of cases) {
    const response = await request(requestPath, "text/html");
    const html = authoredDocument(await response.text());
    const canonicalUrl = new URL(canonicalPath, "https://hah.dev").href;
    const pageId = `${canonicalUrl}#page`;
    const canonicalTags = tagsWithAttribute(html, "link", "rel", "canonical");
    const openGraphUrlTags = tagsWithAttribute(html, "meta", "property", "og:url");
    assert.equal(response.status, 200, requestPath);
    assert.deepEqual(canonicalTags.map((tag) => attributeFromTag(tag, "href")), [canonicalUrl], `${requestPath} has one query-free canonical`);
    assert.deepEqual(openGraphUrlTags.map((tag) => attributeFromTag(tag, "content")), [canonicalUrl], `${requestPath} has one matching Open Graph URL`);

    const pageNodes = jsonLdNodes(embeddedJsonLd(html)).filter((node) => node?.["@id"] === pageId);
    assert.equal(pageNodes.length, 1, `${requestPath} emits its canonical page node once`);
    assert.ok(pageNodes[0].mainEntity?.["@id"], `${requestPath} names a stable main entity`);
    assert.equal(pageNodes[0].url, canonicalUrl);
  }
});

test("every canonical page and internal JSON-LD reference resolves in the full graph", async () => {
  const graphNodes = knowledgeGraph["@graph"];
  const graphById = new Map(graphNodes.map((node) => [node["@id"], node]));
  assert.equal(graphById.size, graphNodes.length, "knowledge graph identifiers are unique");

  for (const route of canonicalHtmlRoutes) {
    const canonicalUrl = new URL(route.pathname, "https://hah.dev").href;
    const pageId = `${canonicalUrl}#page`;
    const page = graphById.get(pageId);
    assert.ok(page, `${route.pathname} has a page node in the authoritative graph`);
    assert.equal(page.url, canonicalUrl, `${route.pathname} page-node URL is canonical`);
    assert.ok(page.mainEntity?.["@id"], `${route.pathname} has a reference-valued mainEntity`);
    assert.ok(graphById.has(page.mainEntity["@id"]), `${route.pathname} mainEntity resolves`);

    const response = await request(route.pathname, "text/html");
    const localPages = jsonLdNodes(embeddedJsonLd(await response.text())).filter((node) => node?.["@id"] === pageId);
    assert.equal(localPages.length, 1, `${route.pathname} emits exactly one matching page node`);
    assert.equal(localPages[0].mainEntity?.["@id"], page.mainEntity["@id"], `${route.pathname} local and full graphs name the same main entity`);

    const mainEntity = graphById.get(page.mainEntity["@id"]);
    if (mainEntity.mainEntityOfPage) {
      assert.equal(mainEntity.mainEntityOfPage["@id"], pageId, `${route.pathname} has a consistent reverse page relation`);
    }
  }

  const references = [];
  collectInternalGraphReferences(knowledgeGraph, references);
  for (const { id, path } of references) {
    assert.ok(graphById.has(id), `${path} resolves ${id}`);
  }
});

test("requirements and namespace terms have stable anchors, routes, and graph definitions", async () => {
  const [requirementsResponse, namespaceResponse] = await Promise.all([
    request("/requirements/", "text/html"),
    request("/ns/", "text/html"),
  ]);
  const requirementsHtml = authoredDocument(await requirementsResponse.text());
  const namespaceHtml = authoredDocument(await namespaceResponse.text());
  const graphById = new Map(knowledgeGraph["@graph"].map((node) => [node["@id"], node]));

  assert.equal(requirementsResponse.status, 200);
  for (const requirement of [...sharedRequirements, ...practiceStandards]) {
    assert.match(requirementsHtml, new RegExp(`\\bid="${requirement.id}"`, "u"), `${requirement.id} has a stable HTML anchor`);
    const graphId = `https://hah.dev/requirements/#${requirement.id}`;
    assert.deepEqual(
      { type: graphById.get(graphId)?.["@type"], name: graphById.get(graphId)?.name, description: graphById.get(graphId)?.description },
      { type: "DefinedTerm", name: requirement.label, description: requirement.description },
    );
  }

  assert.equal(namespaceResponse.status, 200);
  for (const term of namespaceTerms) {
    assert.match(namespaceHtml, new RegExp(`\\bid="${term.id}"`, "u"), `${term.id} has a stable HTML anchor`);
    const graphId = `https://hah.dev/ns/#${term.id}`;
    assert.deepEqual(
      {
        type: graphById.get(graphId)?.["@type"],
        name: graphById.get(graphId)?.name,
        description: graphById.get(graphId)?.description,
        code: graphById.get(graphId)?.termCode,
      },
      { type: "DefinedTerm", name: term.label, description: term.description, code: term.id },
    );
  }
});

test("the not-found document contains only exclusionary crawler directives", async () => {
  const response = await request("/not-found/", "text/html");
  const html = authoredDocument(await response.text());
  const robotsTags = tagsWithAttribute(html, "meta", "name", "robots");
  const directives = robotsTags.flatMap((tag) => (attributeFromTag(tag, "content") ?? "")
    .toLowerCase().split(",").map((item) => item.trim()).filter(Boolean));

  assert.equal(response.status, 404);
  assert.ok(robotsTags.length >= 1, "the 404 has a robots directive");
  assert.ok(directives.includes("noindex"), "the 404 is excluded from indexing");
  assert.equal(directives.includes("index"), false, "the 404 has no conflicting index directive");
  assert.equal(directives.includes("follow"), false, "the 404 has no conflicting follow directive");
});

test("project and Text to Lattice implementation provenance stays source-aligned", async () => {
  const graphById = new Map(knowledgeGraph["@graph"].map((node) => [node["@id"], node]));
  assert.equal(projectsManifest.version, PROJECT_CONTENT_VERSION);
  assert.equal(projectsManifest.asOf, PROJECT_CONTENT_UPDATED);
  const expectedLeadingProjectIds = ["lattice", "in-keeping", "fog-of-sea"];
  assert.deepEqual(projects.slice(0, 3).map(({ id }) => id), expectedLeadingProjectIds);
  assert.deepEqual(projectsManifest.projects.slice(0, 3).map(({ id }) => id), expectedLeadingProjectIds);
  const projectsList = graphById.get("https://hah.dev/projects/#items");
  assert.ok(projectsList, "the knowledge graph has an ordered Projects list");
  assert.deepEqual(
    projectsList.itemListElement.slice(0, 3).map(({ position, item }) => ({ position, id: item["@id"] })),
    [
      { position: 1, id: "https://hah.dev/projects/lattice/#work" },
      { position: 2, id: "https://hah.dev/projects/in-keeping/#work" },
      { position: 3, id: "https://hah.dev/projects/fog-of-sea/#work" },
    ],
  );

  for (const source of projects) {
    const record = projectsManifest.projects.find(({ id }) => id === source.id);
    assert.ok(record, `${source.id} has a manifest record`);
    assert.deepEqual(
      {
        slug: record.slug,
        name: record.name,
        kind: record.kind,
        thesis: record.thesis,
        summary: record.summary,
        emphasis: record.emphasis,
        canonicalUrl: record.canonicalUrl,
        externalUrl: record.externalUrl,
        evidence: record.evidence.map(({ url }) => url),
        documentation: record.documentation,
        publication: record.publication,
        status: record.status,
        interactiveRelease: record.interactiveRelease,
      },
      {
        slug: source.slug,
        name: source.name,
        kind: source.type,
        thesis: source.thesis,
        summary: [...source.summary],
        emphasis: [...source.emphasis],
        canonicalUrl: new URL(source.canonicalPath, "https://hah.dev").href,
        externalUrl: source.url,
        evidence: [...source.evidence],
        documentation: (source.resources ?? []).map((document) => Object.fromEntries(
          Object.entries(document).filter(([key]) => key !== "icon" && key !== "opensInNewTab"),
        )),
        publication: { ...source.publication },
        status: { value: source.status, asOf: PROJECT_CONTENT_UPDATED },
        interactiveRelease: source.interactiveRelease ?? "not-applicable",
      },
    );
    assert.deepEqual(record.provenance, {
      repository: SITE_REPOSITORY,
      sourcePaths: [
        "app/resume/projects.js",
        ...(source.id === "lattice" ? ["app/content/projectDocuments.js"] : []),
      ],
      version: PROJECT_CONTENT_VERSION,
      lastUpdated: PROJECT_CONTENT_UPDATED,
    });
    const graphNode = graphById.get(`${record.canonicalUrl}#work`);
    assert.ok(graphNode, `${source.id} has a graph record`);
    assert.deepEqual(graphNode["hah:provenance"], record.provenance);
    assert.equal(graphNode.mainEntityOfPage?.["@id"], `${record.canonicalUrl}#page`);
  }

  const latticeRecord = projectsManifest.projects.find(({ id }) => id === "lattice");
  const latticeResumeRecord = resumeManifest.projects.find(({ id }) => id === "lattice");
  assert.ok(latticeRecord && latticeResumeRecord);
  assert.equal(latticeRecord.interactiveRelease, "held");
  assert.deepEqual(latticeResumeRecord.documentation, latticeRecord.documentation);
  assert.equal(latticeResumeRecord.interactiveRelease, "held");
  assert.deepEqual(latticeResumeRecord.limitations, latticeRecord.limitations);
  assert.deepEqual(
    latticeRecord.documentation.filter(({ markdownUrl }) => markdownUrl).map(({ artifactId }) => artifactId),
    projectDocuments.map(({ artifactId }) => artifactId),
  );
  const latticeGraph = graphById.get("https://hah.dev/projects/lattice/#work");
  assert.equal(latticeGraph["hah:interactiveRelease"], "held");
  assert.deepEqual(latticeGraph.hasPart, projectDocuments.map(({ htmlUrl }) => ({ "@id": htmlUrl })));
  for (const document of projectDocuments) {
    const node = graphById.get(document.htmlUrl);
    assert.ok(node, `${document.id} has a DigitalDocument graph record`);
    assert.equal(node["@type"], "DigitalDocument");
    assert.equal(node.name, document.title);
    assert.equal(node.version, PROJECT_DOCUMENTS_VERSION);
    assert.equal(node.dateModified, PROJECT_DOCUMENTS_UPDATED);
    assert.deepEqual(node.about, { "@id": "https://hah.dev/projects/lattice/#work" });
    assert.equal(node.encoding.contentUrl, document.markdownUrl);
    assert.equal(node.encoding.encodingFormat, document.markdownMediaType);
  }

  const generatorInferenceSummary = `${Object.entries(LATTICE_MODEL_ROLES.generator.inference.stages)
    .map(([stage, settings]) => `${stage} temperature ${settings.temperature}, top-p ${settings.topP}`)
    .join("; ")}; fixed seed ${LATTICE_MODEL_ROLES.generator.inference.seed}; thinking disabled`;
  const expectedGenerator = {
    name: LATTICE_MODEL_ROLES.generator.label,
    modelId: LATTICE_MODEL_ROLES.generator.id,
    revision: LATTICE_MODEL_ROLES.generator.revision,
    repository: LATTICE_MODEL_ROLES.generator.repository,
    revisionUrl: LATTICE_MODEL_ROLES.generator.revisionUrl,
    baseModelRepository: LATTICE_MODEL_ROLES.generator.baseModelRepository,
    licenseName: LATTICE_MODEL_ROLES.generator.licenseName,
    licenseUrl: LATTICE_MODEL_ROLES.generator.licenseUrl,
    inference: { ...LATTICE_MODEL_ROLES.generator.inference },
    inferenceSummary: generatorInferenceSummary,
  };
  const expectedVerifier = {
    name: LATTICE_MODEL_ROLES.verifier.label,
    modelId: LATTICE_MODEL_ROLES.verifier.id,
    revision: LATTICE_MODEL_ROLES.verifier.revision,
    repository: LATTICE_MODEL_ROLES.verifier.repository,
    revisionUrl: LATTICE_MODEL_ROLES.verifier.revisionUrl,
    baseModelRepository: LATTICE_MODEL_ROLES.verifier.baseModelRepository,
    licenseName: LATTICE_MODEL_ROLES.verifier.licenseName,
    licenseUrl: LATTICE_MODEL_ROLES.verifier.licenseUrl,
    acceptableUseUrl: LATTICE_MODEL_ROLES.verifier.acceptableUseUrl,
    inference: { ...LATTICE_MODEL_ROLES.verifier.inference },
  };
  const expectedRuntime = {
    name: LATTICE_RUNTIME.name,
    version: LATTICE_RUNTIME.version,
    packageUrl: LATTICE_RUNTIME.packageUrl,
    documentationUrl: LATTICE_RUNTIME.documentationUrl,
    repository: LATTICE_RUNTIME.repository,
    tokenizerName: LATTICE_TOKENIZER_RUNTIME.name,
    tokenizerVersion: LATTICE_TOKENIZER_RUNTIME.version,
    tokenizerPackageUrl: LATTICE_TOKENIZER_RUNTIME.packageUrl,
    structuredOutputName: LATTICE_STRUCTURED_OUTPUT_RUNTIME.name,
    structuredOutputVersion: LATTICE_STRUCTURED_OUTPUT_RUNTIME.version,
    structuredOutputPackageUrl: LATTICE_STRUCTURED_OUTPUT_RUNTIME.packageUrl,
    structuredOutputRepository: LATTICE_STRUCTURED_OUTPUT_RUNTIME.repository,
    structuredOutputLicenseName: LATTICE_STRUCTURED_OUTPUT_RUNTIME.licenseName,
    structuredOutputLicenseUrl: LATTICE_STRUCTURED_OUTPUT_RUNTIME.licenseUrl,
    wasmRevision: LATTICE_WASM_REVISION,
    wasmRepository: LATTICE_WASM_REPOSITORY,
    wasmLicenseStatus: LOCAL_LATTICE_MODEL.wasmLicenseStatus,
  };
  assert.deepEqual(textToLatticeContract.implementation.generator, expectedGenerator);
  assert.deepEqual(textToLatticeContract.implementation.verifier, expectedVerifier);
  assert.deepEqual(textToLatticeContract.implementation.runtime, expectedRuntime);
  assert.equal(LOCAL_LATTICE_MODEL.models[0], LATTICE_MODEL_ROLES.generator);
  assert.equal(LOCAL_LATTICE_MODEL.models[1], LATTICE_MODEL_ROLES.verifier);

  const applicationId = `${new URL(textToLatticeContract.canonicalPath, "https://hah.dev").href}#application`;
  const application = graphById.get(applicationId);
  assert.ok(application, "the tool has a SoftwareApplication graph record");
  assert.equal(textToLatticeContract.name, "Text to Lattice");
  assert.equal(textToLatticeContract.id, "text-to-lattice");
  assert.equal(textToLatticeContract.canonicalPath, "/projects/lattice/text-to-lattice/");
  assert.equal(application.name, "Text to Lattice");
  assert.equal(application.creativeWorkStatus, latticeRecord.interactiveRelease);
  assert.equal(application["hah:interactiveRelease"], latticeRecord.interactiveRelease);
  assert.equal(
    application["hah:publicationMode"],
    latticeRecord.interactiveRelease === "enabled" ? "interactive-client" : "documentation-only",
  );
  assert.match(application.description, /public interactive client is held; this page publishes documentation only/iu);
  assert.equal(graphById.get(`${new URL(textToLatticeContract.canonicalPath, "https://hah.dev").href}#page`)?.description, application.description);
  assert.deepEqual(application["hah:generator"], expectedGenerator);
  assert.deepEqual(application["hah:verifier"], expectedVerifier);
  assert.deepEqual(application["hah:runtime"], expectedRuntime);
  assert.deepEqual(application["hah:securityAndPrivacy"], textToLatticeContract.securityAndPrivacy);

  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const webLlmPackage = JSON.parse(await readFile(new URL("../node_modules/@mlc-ai/web-llm/package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.dependencies["@mlc-ai/web-llm"], LATTICE_RUNTIME.version);
  assert.equal(packageJson.dependencies["@mlc-ai/web-tokenizers"], LATTICE_TOKENIZER_RUNTIME.version);
  assert.equal(webLlmPackage.devDependencies["@mlc-ai/web-xgrammar"], LATTICE_STRUCTURED_OUTPUT_RUNTIME.version);

  const [toolHtml, latticeMarkdown, completeText] = await Promise.all([
    request(textToLatticeContract.canonicalPath, "text/html").then((response) => response.text()),
    readFile(staticFileUrl("content/projects/lattice.md"), "utf8"),
    readFile(staticFileUrl("llms-full.txt"), "utf8"),
  ]);
  const machineValueLabel = (value) => {
    const words = value.replaceAll("-", " ");
    return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
  };
  for (const body of [renderProjectMarkdown("lattice"), latticeMarkdown]) {
    assert.ok(body.includes(`Interactive client release: ${machineValueLabel(latticeRecord.interactiveRelease)}`));
    assert.ok(body.includes(`Public client status: ${machineValueLabel(application["hah:interactiveRelease"])}`));
    assert.ok(body.includes(`Publication mode: ${machineValueLabel(application["hah:publicationMode"])}`));
    assert.match(body, /completed interactive client is not included in the public bundle[\s\S]*?does not make the conversion client available/iu);
  }
  const publicProvenance = [authoredDocument(toolHtml), latticeMarkdown];
  for (const body of publicProvenance) {
    for (const value of [
      expectedGenerator.name, expectedGenerator.revision, expectedGenerator.repository,
      expectedGenerator.inferenceSummary,
      expectedVerifier.name, expectedVerifier.revision, expectedVerifier.repository,
      expectedRuntime.name, expectedRuntime.version, expectedRuntime.tokenizerName,
      expectedRuntime.tokenizerVersion, expectedRuntime.structuredOutputName,
      expectedRuntime.structuredOutputVersion, expectedRuntime.wasmRevision,
    ]) assert.ok(body.includes(value), `public tool provenance includes ${value}`);
  }
  for (const body of [decodedText(toolHtml), latticeMarkdown, completeText]) {
    assert.match(body, /Text to Lattice/u);
    assert.doesNotMatch(body, /Text-to-Lattice/u);
    assert.match(body, /does not use a Hugging Face inference API/iu);
    assert.match(body, /source text.*never sent.*Hugging Face|entered text is never sent.*Hugging Face/iu);
    assert.match(body, /ordinary connection and download metadata/iu);
    assert.match(body, /credentials and referrers/iu);
    assert.match(body, /inert data/iu);
    assert.match(body, /distinct Cloudflare encrypted Worker secrets/iu);
    assert.match(body, /cannot prevent operating-system screenshots/iu);
    assert.match(body, /cannot guarantee.*unreadable to an AI system/iu);
  }
  for (const { url } of textToLatticeContract.securityAndPrivacy.huggingFace.sources) {
    assert.ok(toolHtml.includes(`href="${url}"`), `tool documentation links ${url}`);
    assert.ok(latticeMarkdown.includes(url), `project Markdown links ${url}`);
    assert.ok(completeText.includes(url), `llms-full includes ${url}`);
  }
  const upstreamUrls = new Set(textToLatticeContract.securityAndPrivacy.huggingFace.sources.map(({ url }) => url));
  for (const required of [
    "https://huggingface.co/privacy",
    "https://huggingface.co/docs/hub/security",
    "https://huggingface.co/docs/hub/models-downloading",
    "https://huggingface.co/docs/huggingface_hub/guides/download",
  ]) assert.ok(upstreamUrls.has(required), required);
  for (const id of ["securityAndPrivacy", "interactiveRelease", "publicationMode"]) {
    assert.ok(namespaceTerms.some((term) => term.id === id), `${id} has a vocabulary definition`);
  }
  assert.equal(SITE_CONTENT_VERSION, resumeManifest.version);
  assert.equal(SITE_CONTENT_UPDATED, resumeManifest.asOf);
});

test("project relationships and inherited requirements resolve in the graph", () => {
  const graphIds = knowledgeGraph["@graph"].map((node) => node["@id"]);
  assert.equal(new Set(graphIds).size, graphIds.length, "knowledge graph identifiers are unique");
  const resolvable = new Set(graphIds);
  for (const project of projectsManifest.projects) {
    assert.ok(resolvable.has(`${project.canonicalUrl}#work`), `${project.id} graph node exists`);
    for (const relationship of project.relationships) {
      assert.ok(resolvable.has(relationship.target), `${project.id} relationship target resolves`);
      assert.ok(relationship.predicate.length > 0 && relationship.scope.length > 0);
    }
    for (const requirement of project.inheritedRequirements) {
      assert.ok(resolvable.has(requirement), `${project.id} inherited requirement resolves`);
    }
  }
});

test("robots, sitemap, and llms discovery cover canonical public records", async () => {
  const [robots, sitemap, llms, resumeMarkdown, resumeJson, portfolioSource] = await Promise.all([
    readFile(staticFileUrl("robots.txt"), "utf8"),
    readFile(staticFileUrl("sitemap.xml"), "utf8"),
    readFile(staticFileUrl("llms.txt"), "utf8"),
    readFile(staticFileUrl("content/resume.md"), "utf8"),
    readFile(staticFileUrl("resume.json"), "utf8"),
    readFile(new URL("../app/semantic/portfolio.js", import.meta.url), "utf8"),
  ]);
  assert.match(robots, /^User-agent: \*$/mu);
  assert.match(robots, /^Allow: \/$/mu);
  assert.match(robots, /^Disallow: \/api\/text-to-lattice\/$/mu);
  assert.match(robots, /^Sitemap: https:\/\/hah\.dev\/sitemap\.xml$/mu);

  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
  assert.deepEqual(sitemapUrls, [
    ...canonicalHtmlRoutes.map(({ pathname }) => new URL(pathname, "https://hah.dev").href),
    ...projectDocuments.map(({ htmlUrl }) => htmlUrl),
  ]);
  for (const { markdownUrl } of projectDocuments) assert.equal(sitemapUrls.includes(markdownUrl), false);

  assert.match(resumeMarkdown, /## Lattice[\s\S]*?Interactive client: Held[\s\S]*?### Limitations[\s\S]*?completed interactive client remains held/iu);
  assert.equal(JSON.parse(resumeJson).projects.find(({ id }) => id === "lattice")?.interactiveRelease, "held");
  assert.match(llms, /The Text to Lattice interactive client is held/u);
  assert.match(portfolioSource, /const releaseBoundary = applicationReleaseStatus === "held"/u);
  assert.match(portfolioSource, /applicationReleaseStatus === "enabled"[\s\S]*?interactive client is enabled/u);
  for (const filename of [
    "TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md",
    "TEXT-TO-LATTICE-RELEASE-REGISTER.json",
    "LLAMA-USE-EVALUATION-CASES.json",
  ]) assert.ok(llms.includes(`https://hah.dev/documentation/text-to-lattice/${filename}`));

  const linked = [...llms.matchAll(/\]\((https:\/\/hah\.dev\/[^)]+)\)/gu)].map((match) => new URL(match[1]));
  assert.ok(linked.length >= 12);
  for (const url of linked) {
    let filename = url.pathname.slice(1);
    if (!filename) filename = "index.html";
    else if (filename.endsWith("/")) filename += "index.html";
    await assert.doesNotReject(readFile(staticFileUrl(filename), "utf8"), `${url.href} resolves in the static artifact`);
  }
});

test("semantic artifacts exclude transient Text to Lattice state", async () => {
  const semanticBodies = await Promise.all(semanticArtifactRoutes.map(({ output }) => readFile(staticFileUrl(output), "utf8")));
  const combined = semanticBodies.join("\n");
  for (const privateStateIdentifier of [
    "clarificationAnswers",
    "clarificationHistory",
    "latticeInput",
    "latticeResult",
    "latticeJobRef",
  ]) {
    assert.doesNotMatch(combined, new RegExp(privateStateIdentifier, "u"));
  }
  assert.match(combined, /transient browser (?:memory|state)/u);
});

test("semantic artifacts and supplied license records are directly present at their public paths", async () => {
  const publicPaths = new Set();
  for (const route of semanticArtifactRoutes) {
    assert.equal(route.output, route.pathname.replace(/^\//u, ""), `${route.pathname} is not hidden behind an index redirect`);
    assert.equal(publicPaths.has(route.pathname), false, `${route.pathname} is unique`);
    publicPaths.add(route.pathname);
    const body = await readFile(staticFileUrl(route.output));
    assert.ok(body.byteLength > 0, `${route.pathname} is a nonempty direct static file`);
  }

  for (const record of staticSourceCopies) {
    assert.equal(record.output, record.pathname.replace(/^\//u, ""), `${record.pathname} is copied to its direct public path`);
    assert.equal(publicPaths.has(record.pathname), false, `${record.pathname} is unique`);
    publicPaths.add(record.pathname);
    const [source, exported] = await Promise.all([
      readFile(new URL(`../${record.source}`, import.meta.url)),
      readFile(staticFileUrl(record.output)),
    ]);
    assert.deepEqual(exported, source, `${record.pathname} is an exact, non-generated source copy`);
  }

  const noticesHtml = await readFile(staticFileUrl("third-party-notices/index.html"), "utf8");
  const noticeLinks = internalAnchorPaths(noticesHtml, "/third-party-notices/");
  for (const record of staticSourceCopies.filter(({ pathname }) => /^(?:\/LICENSES\/|\/NOTICE$|\/THIRD_PARTY_)/u.test(pathname))) {
    assert.ok(noticeLinks.has(record.pathname), `the notices page links directly to ${record.pathname}`);
  }
});

test("a no-JavaScript anchor crawl from home reaches every canonical HTML record", async () => {
  const routeByPath = new Map(canonicalHtmlRoutes.map((route) => [route.pathname, route]));
  const reached = new Set(["/"]);
  const queue = ["/"];

  while (queue.length > 0) {
    const pathname = queue.shift();
    const route = routeByPath.get(pathname);
    assert.ok(route, `${pathname} is a declared canonical route`);
    const html = await readFile(staticFileUrl(route.output), "utf8");
    for (const target of internalAnchorPaths(html, pathname)) {
      if (!routeByPath.has(target) || reached.has(target)) continue;
      reached.add(target);
      queue.push(target);
    }
  }

  assert.deepEqual(
    [...routeByPath.keys()].filter((pathname) => !reached.has(pathname)),
    [],
    "all canonical documents are discoverable through authored HTML anchors",
  );
});

test("every static export matches its built server representation", async () => {
  for (const route of staticExportRoutes) {
    const [response, staticBody] = await Promise.all([
      request(route.pathname, route.accept),
      readFile(staticFileUrl(route.output), "utf8"),
    ]);
    const renderedBody = await response.text();
    assert.equal(response.status, route.expectedStatus, route.pathname);
    assert.match(response.headers.get("content-type") ?? "", new RegExp(`^${route.contentType.replace("+", "\\+")}`, "u"));
    assert.equal(staticBody, renderedBody, `${route.output} is an exact render of ${route.pathname}`);
  }
});
