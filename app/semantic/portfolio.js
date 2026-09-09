import { papers, skillStacks, timeline, tools } from "../data.ts";
import { ASCII_CHARACTER_DESCRIPTION } from "../components/asciiCharacter.js";
import {
  homeIntroduction, homeQuestions, homeTitle, person, practiceStandards,
  resumeEducationOverview, sharedRequirements, shelfNotice,
  SITE_CONTENT_TERMS_URL, SITE_CONTENT_UPDATED, SITE_CONTENT_VERSION,
  SITE_ORIGIN, SITE_REPOSITORY, SITE_SOURCE_LICENSE_URL,
  toolsSocial,
} from "../content/siteContent.js";
import { textToLatticeContract } from "../content/textToLatticeContent.js";
import {
  PROJECT_DOCUMENTS_UPDATED, PROJECT_DOCUMENTS_VERSION, projectDocuments,
} from "../content/projectDocuments.js";
import {
  PROJECT_CONTENT_UPDATED, PROJECT_CONTENT_VERSION, projectBySlug, projects,
} from "../resume/projects.js";
import { resumeDetailBySlug, resumeDetailList } from "../resume/resumeDetails.js";
import { canonicalHtmlRoutes } from "./routes.js";

export const absoluteUrl = (pathname) => new URL(pathname, SITE_ORIGIN).href;
export const projectGraphId = (project) => `${absoluteUrl(project.canonicalPath)}#work`;
export const requirementGraphId = (id) => `${SITE_ORIGIN}/requirements/#${id}`;
export const namespaceGraphId = (id) => `${SITE_ORIGIN}/ns/#${id}`;

const requirementSetId = `${SITE_ORIGIN}/requirements/#set`;
const namespaceSetId = `${SITE_ORIGIN}/ns/#set`;
const resumeRecordsId = `${absoluteUrl("/resume/")}#records`;
const projectsListId = `${absoluteUrl("/projects/")}#items`;
const toolsListId = `${absoluteUrl("/tools/")}#items`;
const shelfListId = `${absoluteUrl("/shelf/")}#items`;
const thirdPartyDocumentsId = `${absoluteUrl("/third-party-notices/")}#documents`;
const applicationId = `${absoluteUrl(textToLatticeContract.canonicalPath)}#application`;
const applicationReleaseStatus = projectBySlug("lattice")?.interactiveRelease ?? "not-applicable";
const applicationPublicationMode = applicationReleaseStatus === "enabled" ? "interactive-client" : "documentation-only";
const applicationDescription = applicationReleaseStatus === "held"
  ? `${textToLatticeContract.purpose} The public interactive client is held; this page publishes documentation only.`
  : textToLatticeContract.purpose;
const provenance = (sourcePaths, version = SITE_CONTENT_VERSION, lastUpdated = SITE_CONTENT_UPDATED) => ({
  repository: SITE_REPOSITORY,
  sourcePaths: [...sourcePaths],
  version,
  lastUpdated,
});
const documentedList = (items) => ({ documented: items.length > 0, items: [...items] });
const skillStackRecord = (stack) => {
  const sections = [
    ...(stack.items.length > 0 ? [{ label: null, items: [...stack.items] }] : []),
    ...stack.sections.map((section) => ({ label: section.label, items: [...section.items] })),
  ];

  return {
    id: stack.id,
    title: stack.title,
    description: "",
    items: sections.flatMap((section) => section.items),
    sections,
  };
};

function documentationRecord(resource) {
  return {
    label: resource.label,
    url: resource.url,
    ...(resource.id ? { id: resource.id } : {}),
    ...(resource.artifactId ? { artifactId: resource.artifactId } : {}),
    ...(resource.title ? { title: resource.title } : {}),
    ...(resource.scope ? { scope: resource.scope } : {}),
    ...(resource.markdownUrl ? { markdownUrl: resource.markdownUrl } : {}),
    ...(resource.htmlMediaType ? { htmlMediaType: resource.htmlMediaType } : {}),
    ...(resource.markdownMediaType ? { markdownMediaType: resource.markdownMediaType } : {}),
  };
}

export const namespaceTerms = Object.freeze([
  ["ResumeRecord", "Résumé record", "A public résumé detail record authored for hah.dev.", "Class"],
  ["ProjectRelationship", "Project relationship", "A scoped, explicitly authored relationship between public project or requirement records.", "Class"],
  ["sourceCodeLicense", "source-code license", "The license governing site source code rather than authored portfolio content.", "Property"],
  ["inheritedRequirement", "inherited requirement", "A practice requirement inherited by a project.", "Property"],
  ["relationship", "project relationship", "A scoped relation asserted for a project.", "Property"],
  ["predicate", "relationship predicate", "The authored type of a project relationship.", "Property"],
  ["target", "relationship target", "The public graph record targeted by a relationship.", "Property"],
  ["scope", "relationship scope", "The bounded area in which a relationship applies.", "Property"],
  ["capability", "capability", "A documented project capability.", "Property"],
  ["technology", "technology", "A documented project technology.", "Property"],
  ["emphasis", "emphasis", "A project’s explicitly authored areas of emphasis.", "Property"],
  ["evidence", "evidence", "An authoritative public evidence link.", "Property"],
  ["limitation", "limitation", "A documented limitation or representation boundary.", "Property"],
  ["documentation", "documentation", "A labeled documentation record.", "Property"],
  ["publicationPrecision", "publication precision", "The stated precision of a publication display value.", "Property"],
  ["statusAsOf", "status as of", "The date on which a public project status was current.", "Property"],
  ["interactiveRelease", "interactive release", "The release status of a project’s or tool’s public interactive client: held, enabled, or not applicable.", "Property"],
  ["publicationMode", "publication mode", "The public scope currently published for an interactive tool, such as documentation-only.", "Property"],
  ["provenance", "provenance", "The repository, source paths, version, and update date behind a public record.", "Property"],
  ["projectLicenseDocumented", "project license documented", "Whether the external project record documents a project license.", "Property"],
  ["inputContract", "input contract", "The public input boundary of a tool.", "Property"],
  ["outputContract", "output contract", "The public output boundary of a tool.", "Property"],
  ["constraint", "constraint", "A public operational or representation constraint.", "Property"],
  ["usagePolicy", "usage policy", "The public purpose, quota, retention, and failure-mode contract for a bounded interactive demonstration.", "Property"],
  ["securityAndPrivacy", "security and privacy", "The documented input, upstream-service, API, and output-protection boundaries of a public tool.", "Property"],
  ["generator", "generator", "The model assigned to draft candidates.", "Property"],
  ["verifier", "verifier", "The independently trained model family assigned to check candidates.", "Property"],
  ["runtime", "runtime", "The local inference runtime and pinned implementation metadata.", "Property"],
  ["traits", "traits", "Documented traits of a tool.", "Property"],
  ["collection", "collection", "An authored shelf collection label.", "Property"],
  ["displayDate", "display date", "A publication-local date or era string preserved at its authored precision.", "Property"],
  ["heldBy", "held by", "The person whose résumé contains an engagement record.", "Property"],
  ["organization", "organization", "The organization associated with a résumé engagement without implying employment.", "Property"],
  ["engagementKind", "engagement kind", "The explicitly authored kind of résumé engagement.", "Property"],
  ["ongoing", "ongoing", "Whether an engagement is ongoing as of the record date.", "Property"],
  ["periodLabel", "period label", "The exact human-readable period shown for an engagement.", "Property"],
  ["detail", "detail", "An authored detail belonging to a public record.", "Property"],
].map(([id, label, description, kind]) => Object.freeze({ id, label, description, kind })));

function relationshipTargetId(target) {
  const project = projects.find(({ id }) => id === target);
  return project ? projectGraphId(project) : requirementGraphId(target);
}

function projectRecord(project) {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    kind: project.type,
    thesis: project.thesis,
    summary: [...project.summary],
    emphasis: [...project.emphasis],
    purpose: { documented: true, items: [project.thesis] },
    problem: { documented: false, items: [] },
    users: { documented: false, items: [] },
    invariants: { documented: true, items: sharedRequirements.map(({ id }) => requirementGraphId(id)) },
    capabilities: documentedList(project.capabilities),
    technologies: documentedList(project.technologies),
    evidence: project.evidence.map((url) => ({ type: "authoritative-link", url })),
    limitations: documentedList(project.limitations),
    status: { value: project.status, asOf: PROJECT_CONTENT_UPDATED },
    publication: { ...project.publication },
    interactiveRelease: project.interactiveRelease ?? "not-applicable",
    canonicalUrl: absoluteUrl(project.canonicalPath),
    externalUrl: project.url,
    documentation: (project.resources ?? []).map(documentationRecord),
    relationships: project.relationships.map(({ relation, target, scope }) => ({
      predicate: relation,
      target: relationshipTargetId(target),
      scope,
    })),
    inheritedRequirements: sharedRequirements.map(({ id }) => requirementGraphId(id)),
    provenance: provenance([
      "app/resume/projects.js",
      ...(projectDocuments.some(({ projectId }) => projectId === project.id) ? ["app/content/projectDocuments.js"] : []),
    ], PROJECT_CONTENT_VERSION, PROJECT_CONTENT_UPDATED),
    license: { documented: false, value: null },
  };
}

export const projectsManifest = {
  schema: absoluteUrl("/schemas/projects-v2.schema.json"),
  version: PROJECT_CONTENT_VERSION,
  asOf: PROJECT_CONTENT_UPDATED,
  canonicalUrl: absoluteUrl("/projects/"),
  sharedRequirements: sharedRequirements.map((item) => ({ ...item, graphId: requirementGraphId(item.id) })),
  practiceStandards: practiceStandards.map((item) => ({ ...item, graphId: requirementGraphId(item.id) })),
  projects: projects.map(projectRecord),
};

export const resumeManifest = {
  version: SITE_CONTENT_VERSION,
  asOf: SITE_CONTENT_UPDATED,
  canonicalUrl: absoluteUrl("/resume/"),
  person: { id: person.id, name: person.name },
  educationOverview: {
    graduated: resumeEducationOverview.graduated,
    activities: resumeEducationOverview.activities.map((item) => ({ ...item })),
  },
  experience: timeline.map((entry) => ({
    id: entry.id,
    role: entry.role,
    engagementKind: entry.engagementKind,
    organization: { name: entry.organization },
    period: entry.period,
    start: entry.start,
    end: entry.end,
    ongoing: entry.ongoing,
    details: [...entry.details],
    featured: entry.featured === true,
  })),
  expandedDetails: resumeDetailList.map((detail) => ({
    id: detail.id,
    title: detail.title,
    subtitle: detail.subtitle,
    period: detail.period,
    details: [...detail.details],
    courses: [...(detail.courses ?? [])],
    canonicalUrl: absoluteUrl(detail.canonicalPath),
  })),
  skillStacks: skillStacks.map(skillStackRecord),
  projects: projects.map((project) => {
    const { id, name, canonicalUrl, thesis, summary, status, publication, interactiveRelease, documentation, limitations } = projectRecord(project);
    return {
      id, name, canonicalUrl, thesis, summary: [...summary], status: { ...status }, publication: { ...publication },
      interactiveRelease,
      documentation: documentation.map((item) => ({ ...item })),
      limitations: { documented: limitations.documented, items: [...limitations.items] },
    };
  }),
  provenance: provenance(["app/data.ts", "app/resume/resumeDetails.js", "app/resume/projects.js", "app/content/siteContent.js"]),
};

export const toolsManifest = {
  version: SITE_CONTENT_VERSION,
  asOf: SITE_CONTENT_UPDATED,
  canonicalUrl: absoluteUrl("/tools/"),
  tools: tools.map((tool) => ({ ...tool, traits: [...tool.traits] })),
  social: toolsSocial.map(({ name, title, url }) => ({ name, title, url })),
  provenance: provenance(["app/data.ts", "app/content/siteContent.js"]),
};

export const shelfManifest = {
  version: SITE_CONTENT_VERSION,
  asOf: SITE_CONTENT_UPDATED,
  canonicalUrl: absoluteUrl("/shelf/"),
  notice: shelfNotice,
  items: papers.map((paper, index) => ({
    id: `shelf-${String(index + 1).padStart(2, "0")}`,
    ...paper,
    languages: [...paper.languages],
    publishers: [...paper.publishers],
    authors: [...paper.authors],
    collections: [...paper.collections],
  })),
  provenance: provenance(["app/data.ts", "app/content/siteContent.js"]),
};

function pageNode(pathname, name, description, type = "WebPage", mainEntity = null) {
  return {
    "@id": `${absoluteUrl(pathname)}#page`,
    "@type": type,
    url: absoluteUrl(pathname),
    name,
    description,
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
    ...(mainEntity ? { mainEntity: { "@id": mainEntity } } : {}),
  };
}

function projectJsonLdNode(project) {
  const record = projectRecord(project);
  const documentation = projectDocuments.filter(({ projectId }) => projectId === project.id);
  return {
    "@id": projectGraphId(project),
    "@type": project.type,
    name: project.name,
    description: project.thesis,
    abstract: project.summary.join("\n\n"),
    url: record.canonicalUrl,
    sameAs: project.url,
    datePublished: project.publication.value,
    creativeWorkStatus: project.status,
    author: { "@id": person.id },
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
    mainEntityOfPage: { "@id": `${record.canonicalUrl}#page` },
    "hah:capability": record.capabilities.items,
    "hah:technology": record.technologies.items,
    "hah:emphasis": record.emphasis,
    "hah:evidence": record.evidence.map(({ url }) => url),
    "hah:limitation": record.limitations.items,
    "hah:documentation": record.documentation,
    ...(documentation.length ? { hasPart: documentation.map(({ htmlUrl }) => ({ "@id": htmlUrl })) } : {}),
    "hah:publicationPrecision": record.publication.precision,
    "hah:statusAsOf": record.status.asOf,
    "hah:interactiveRelease": record.interactiveRelease,
    "hah:provenance": record.provenance,
    "hah:projectLicenseDocumented": record.license.documented,
    "hah:inheritedRequirement": record.inheritedRequirements.map((id) => ({ "@id": id })),
    "hah:relationship": record.relationships.map((relationship) => ({
      "@type": "hah:ProjectRelationship",
      "hah:predicate": relationship.predicate,
      "hah:target": { "@id": relationship.target },
      "hah:scope": relationship.scope,
    })),
  };
}

const graphContext = {
  "@vocab": "https://schema.org/",
  hah: "https://hah.dev/ns/#",
  "hah:inheritedRequirement": { "@type": "@id" },
  "hah:target": { "@type": "@id" },
  "hah:heldBy": { "@type": "@id" },
};

const experienceNodes = resumeManifest.experience.map((entry) => ({
  "@id": `${absoluteUrl("/resume/")}#${entry.id}`,
  "@type": "Role",
  roleName: entry.role,
  startDate: entry.start,
  ...(entry.end ? { endDate: entry.end } : {}),
  description: entry.details.join("; "),
  "hah:periodLabel": entry.period,
  "hah:heldBy": { "@id": person.id },
  "hah:organization": { "@type": "Organization", name: entry.organization.name },
  "hah:engagementKind": entry.engagementKind,
  "hah:ongoing": entry.ongoing,
  "hah:detail": entry.details,
}));

const detailNodes = resumeManifest.expandedDetails.map((detail) => ({
  "@id": `${detail.canonicalUrl}#record`,
  "@type": ["CreativeWork", "hah:ResumeRecord"],
  name: detail.title,
  ...(detail.subtitle ? { alternateName: detail.subtitle } : {}),
  temporalCoverage: detail.period,
  url: detail.canonicalUrl,
  author: { "@id": person.id },
  mainEntityOfPage: { "@id": `${detail.canonicalUrl}#page` },
  "hah:detail": [...detail.details, ...detail.courses],
}));

const requirementNodes = [
  ...sharedRequirements.map((item) => ({ "@id": requirementGraphId(item.id), "@type": "DefinedTerm", name: item.label, description: item.description, inDefinedTermSet: { "@id": requirementSetId } })),
  ...practiceStandards.map((item) => ({ "@id": requirementGraphId(item.id), "@type": "DefinedTerm", name: item.label, description: item.description, inDefinedTermSet: { "@id": requirementSetId } })),
];
const namespaceNodes = namespaceTerms.map((item) => ({
  "@id": namespaceGraphId(item.id), "@type": "DefinedTerm", name: item.label,
  description: item.description, termCode: item.id, inDefinedTermSet: { "@id": namespaceSetId },
}));
const shelfDate = (value) => /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/u.test(value) ? { datePublished: value } : {};
const thirdPartyDocuments = Object.freeze([
  ["Required notice", "/NOTICE", "text/plain", "The site notice, including required Text to Lattice attribution."],
  ["Third-party notices", "/THIRD_PARTY_NOTICES.md", "text/markdown", "Pinned component versions, revisions, upstream sources, terms, and the binary-asset provenance boundary."],
  ["Third-party license index", "/THIRD_PARTY_LICENSES.txt", "text/plain", "An index of the license texts supplied with hah.dev."],
  ["Apache License 2.0", "/LICENSES/Apache-2.0.txt", "text/plain", "License text supplied for identified Apache-licensed components."],
  ["MIT License for React and React DOM", "/LICENSES/MIT-React.txt", "text/plain", "License text supplied for the React application framework."],
  ["MIT License for Vinext", "/LICENSES/MIT-vinext.txt", "text/plain", "License text supplied for the Vinext application runtime."],
  ["MIT License for Bootstrap", "/LICENSES/MIT-Bootstrap.txt", "text/plain", "License text supplied for the Bootstrap presentation framework."],
  ["MIT License for loglevel", "/LICENSES/MIT-loglevel.txt", "text/plain", "License text supplied for loglevel."],
  ["Llama 3.2 Community License", "/LICENSES/Llama-3.2-Community-License.txt", "text/plain", "Agreement text supplied for the Llama 3.2 verifier."],
  ["Llama 3.2 Acceptable Use Policy", "/LICENSES/Llama-3.2-Acceptable-Use-Policy.md", "text/markdown", "Acceptable-use policy snapshot supplied for the Llama 3.2 verifier."],
  ["PolyForm Noncommercial 1.0.0", "/LICENSES/PolyForm-Noncommercial-1.0.0.txt", "text/plain", "License text governing the original site source code."],
  ["Hayden portfolio-content terms", "/LICENSES/LicenseRef-Hayden-Portfolio-Content.txt", "text/plain", "Terms governing owner-authored portfolio content."],
].map(([name, pathname, encodingFormat, description]) => Object.freeze({ name, pathname, encodingFormat, description })));
const thirdPartyDocumentNodes = thirdPartyDocuments.map((document) => ({
  "@id": absoluteUrl(document.pathname),
  "@type": "DigitalDocument",
  name: document.name,
  url: absoluteUrl(document.pathname),
  encodingFormat: document.encodingFormat,
  description: document.description,
  isPartOf: { "@id": thirdPartyDocumentsId },
}));
const projectDocumentNodes = projectDocuments.map((document) => ({
  "@id": document.htmlUrl,
  "@type": "DigitalDocument",
  name: document.title,
  url: document.htmlUrl,
  encodingFormat: document.htmlMediaType,
  version: PROJECT_DOCUMENTS_VERSION,
  dateModified: PROJECT_DOCUMENTS_UPDATED,
  about: { "@id": projectGraphId(projectBySlug(document.projectId)) },
  isPartOf: { "@id": projectGraphId(projectBySlug(document.projectId)) },
  encoding: {
    "@type": "MediaObject",
    contentUrl: document.markdownUrl,
    encodingFormat: document.markdownMediaType,
  },
}));

export const knowledgeGraph = {
  "@context": graphContext,
  "@graph": [
    {
      "@id": `${SITE_ORIGIN}/#website`, "@type": "WebSite", url: `${SITE_ORIGIN}/`, name: "hah.dev",
      description: person.headline, author: { "@id": person.id }, dateModified: SITE_CONTENT_UPDATED,
      license: SITE_CONTENT_TERMS_URL, "hah:sourceCodeLicense": SITE_SOURCE_LICENSE_URL,
    },
    {
      "@id": person.id, "@type": "Person", name: person.name, givenName: person.givenName,
      familyName: person.familyName, description: person.headline,
      homeLocation: { "@type": "Place", name: person.homeLocation }, sameAs: [...person.profiles],
    },
    pageNode("/", "hah.dev", person.headline, "ProfilePage", person.id),
    pageNode("/resume/", "Resume", "Hayden Howard’s experience, education, projects, and interdisciplinary skill stacks.", "ProfilePage", resumeRecordsId),
    pageNode("/tools/", "Tools", "A considered productivity and technology stack used by Hayden Howard.", "CollectionPage", toolsListId),
    pageNode("/shelf/", "Shelf", shelfManifest.notice, "CollectionPage", shelfListId),
    pageNode("/projects/", "Projects", "Public projects and their explicit relationships, capabilities, evidence, and limitations.", "CollectionPage", projectsListId),
    pageNode("/requirements/", "Requirements", "Shared public project requirements and practice standards.", "CollectionPage", requirementSetId),
    pageNode("/ns/", "hah.dev semantic vocabulary", "Definitions for the hah.dev JSON-LD extension terms.", "CollectionPage", namespaceSetId),
    pageNode("/third-party-notices/", "Third-party notices", "Source, model, runtime, attribution, and license records for hah.dev and Text to Lattice.", "WebPage", thirdPartyDocumentsId),
    ...projects.map((project) => pageNode(project.canonicalPath, project.name, project.thesis, "WebPage", projectGraphId(project))),
    pageNode(textToLatticeContract.canonicalPath, textToLatticeContract.name, applicationDescription, "WebPage", applicationId),
    ...resumeDetailList.map((detail) => pageNode(detail.canonicalPath, detail.title, `${detail.title}${detail.subtitle ? `, ${detail.subtitle}` : ""}: ${detail.period}.`, "WebPage", `${absoluteUrl(detail.canonicalPath)}#record`)),
    { "@id": requirementSetId, "@type": "DefinedTermSet", name: "hah.dev project requirements and practice standards", url: absoluteUrl("/requirements/") },
    ...requirementNodes,
    { "@id": namespaceSetId, "@type": "DefinedTermSet", name: "hah.dev semantic vocabulary", url: absoluteUrl("/ns/") },
    ...namespaceNodes,
    {
      "@id": thirdPartyDocumentsId,
      "@type": "ItemList",
      name: "hah.dev notices and license documents",
      url: absoluteUrl("/third-party-notices/"),
      itemListElement: thirdPartyDocumentNodes.map((node, index) => ({
        "@type": "ListItem", position: index + 1, item: { "@id": node["@id"] },
      })),
    },
    ...thirdPartyDocumentNodes,
    ...projectDocumentNodes,
    ...projects.map(projectJsonLdNode),
    { "@id": projectsListId, "@type": "ItemList", name: "Projects", itemListElement: projects.map((project, index) => ({ "@type": "ListItem", position: index + 1, item: { "@id": projectGraphId(project) } })) },
    {
      "@id": applicationId, "@type": "SoftwareApplication", name: textToLatticeContract.name,
      description: applicationDescription,
      url: absoluteUrl(textToLatticeContract.canonicalPath),
      applicationCategory: "Portfolio demonstration", operatingSystem: "Secure browser with WebGPU",
      creativeWorkStatus: applicationReleaseStatus,
      isPartOf: { "@id": projectGraphId(projectBySlug("lattice")) },
      mainEntityOfPage: { "@id": `${absoluteUrl(textToLatticeContract.canonicalPath)}#page` },
      "hah:interactiveRelease": applicationReleaseStatus,
      "hah:publicationMode": applicationPublicationMode,
      "hah:inputContract": textToLatticeContract.input, "hah:outputContract": textToLatticeContract.output,
      "hah:constraint": [...textToLatticeContract.constraints],
      "hah:usagePolicy": textToLatticeContract.usagePolicy,
      "hah:securityAndPrivacy": textToLatticeContract.securityAndPrivacy,
      "hah:generator": textToLatticeContract.implementation.generator,
      "hah:verifier": textToLatticeContract.implementation.verifier,
      "hah:runtime": textToLatticeContract.implementation.runtime,
    },
    ...experienceNodes,
    ...detailNodes,
    { "@id": resumeRecordsId, "@type": "ItemList", name: "Résumé records", itemListElement: [...experienceNodes, ...detailNodes].map((node, index) => ({ "@type": "ListItem", position: index + 1, item: { "@id": node["@id"] } })) },
    {
      "@id": toolsListId, "@type": "ItemList", name: "Tools",
      itemListElement: toolsManifest.tools.map((tool, index) => ({
        "@type": "ListItem", position: index + 1,
        item: { "@type": "SoftwareApplication", name: tool.name, url: tool.url, description: tool.summary, applicationCategory: tool.category, "hah:traits": tool.traits },
      })),
      "hah:detail": toolsManifest.social,
    },
    {
      "@id": shelfListId, "@type": "ItemList", name: "Shelf", description: shelfManifest.notice,
      itemListElement: shelfManifest.items.map((item, index) => ({
        "@type": "ListItem", position: index + 1,
        item: {
          "@type": "CreativeWork", name: item.title, ...shelfDate(item.date), "hah:displayDate": item.date,
          inLanguage: item.languages, publisher: item.publishers.map((name) => ({ "@type": "Organization", name })),
          author: item.authors.map((name) => ({ "@type": "Person", name })), "hah:collection": item.collections,
        },
      })),
    },
  ],
};

/**
 * Return the bounded JSON-LD graph for one public page.
 * @param {string} pathname
 * @param {ReturnType<typeof projectBySlug>} project
 */
export function jsonLdForPage(pathname, project = null) {
  const graph = knowledgeGraph["@graph"];
  const ids = new Set([`${SITE_ORIGIN}/#website`, person.id, `${absoluteUrl(pathname)}#page`]);
  const page = graph.find((node) => node["@id"] === `${absoluteUrl(pathname)}#page`);
  if (page?.mainEntity?.["@id"]) ids.add(page.mainEntity["@id"]);
  if (pathname === "/resume/") [...experienceNodes, ...detailNodes].forEach((node) => ids.add(node["@id"]));
  if (pathname === "/projects/") projects.forEach((item) => ids.add(projectGraphId(item)));
  if (pathname === "/requirements/") {
    ids.add(requirementSetId);
    requirementNodes.forEach((node) => ids.add(node["@id"]));
  }
  if (pathname === "/ns/") {
    ids.add(namespaceSetId);
    namespaceNodes.forEach((node) => ids.add(node["@id"]));
  }
  if (pathname === "/third-party-notices/") {
    ids.add(thirdPartyDocumentsId);
    thirdPartyDocumentNodes.forEach((node) => ids.add(node["@id"]));
  }
  if (project) {
    ids.add(projectGraphId(project));
    projectDocuments
      .filter(({ projectId }) => projectId === project.id)
      .forEach(({ htmlUrl }) => ids.add(htmlUrl));
    project.relationships.forEach(({ target }) => ids.add(relationshipTargetId(target)));
    sharedRequirements.forEach(({ id }) => ids.add(requirementGraphId(id)));
  }
  if (pathname === textToLatticeContract.canonicalPath) {
    ids.add(projectGraphId(projectBySlug("lattice")));
    ids.add(applicationId);
    projectDocuments
      .filter(({ projectId }) => projectId === "lattice")
      .forEach(({ htmlUrl }) => ids.add(htmlUrl));
  }
  const detail = resumeDetailBySlug(pathname.match(/^\/resume\/([^/]+)\/$/u)?.[1] ?? "");
  if (detail) ids.add(`${absoluteUrl(detail.canonicalPath)}#record`);
  return { "@context": graphContext, "@graph": graph.filter((node) => ids.has(node["@id"])) };
}

const heading = (text) => text.replace(/[\r\n]+/gu, " ").trim();
const machineValueLabel = (value) => {
  const words = heading(value).replaceAll("-", " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};
const bullets = (items, empty = "Not documented.") => items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${empty}`;
const documentationMarkdownLine = (document) => document.markdownUrl
  ? `${document.label}: HTML ${document.url}; Markdown ${document.markdownUrl}`
  : `${document.label}: ${document.url}`;

export function renderAboutMarkdown() {
  const questions = homeQuestions.map(({ question, answer }) => {
    const rendered = Array.isArray(answer) ? answer.map((item) => `1. ${item}`).join("\n") : answer;
    return `## ${heading(question)}\n\n${rendered}`;
  }).join("\n\n");
  return `# ${homeTitle}\n\nHayden Howard\n\nCanonical URL: ${SITE_ORIGIN}/\n\nVisual: ${ASCII_CHARACTER_DESCRIPTION}\n\n${homeIntroduction.join("\n\n")}\n\n${questions}\n`;
}

export function renderResumeMarkdown() {
  const experience = resumeManifest.experience.map((entry) => `## ${heading(entry.role)} — ${heading(entry.organization.name)}\n\n- Engagement: ${entry.engagementKind}\n- Period: ${entry.period}\n\n${bullets(entry.details, "No additional details are stated.")}`).join("\n\n");
  const details = resumeManifest.expandedDetails.map((detail) => `## ${heading(detail.title)}${detail.subtitle ? ` — ${heading(detail.subtitle)}` : ""}\n\nCanonical URL: ${detail.canonicalUrl}\n\n${detail.period}\n\n${bullets([...detail.details, ...detail.courses])}`).join("\n\n");
  const skills = resumeManifest.skillStacks.map((stack) => {
    const sections = stack.sections.map((section) => (
      `${section.label ? `### ${heading(section.label)}\n\n` : ""}${bullets(section.items)}`
    )).join("\n\n");
    return `## ${heading(stack.title)}\n\n${sections}`;
  }).join("\n\n");
  const activities = resumeManifest.educationOverview.activities.map(({ label, start }) => `- ${label} — ${start}`).join("\n");
  const projectCards = resumeManifest.projects.map((project) => `## ${heading(project.name)}\n\nCanonical URL: ${project.canonicalUrl}${project.interactiveRelease === "not-applicable" ? "" : `\n\nInteractive client: ${heading(project.interactiveRelease)}`}\n\n${project.summary.join("\n\n")}\n\n### Documentation\n\n${bullets(project.documentation.map(documentationMarkdownLine))}\n\n### Limitations\n\n${bullets(project.limitations.items)}`).join("\n\n");
  return `# Resume\n\nCanonical URL: ${resumeManifest.canonicalUrl}\n\n## University\n\nGraduated ${resumeManifest.educationOverview.graduated}\n\n${activities}\n\n# Experience and education\n\n${experience}\n\n# Expanded résumé details\n\n${details}\n\n# Projects\n\n${projectCards}\n\n# Skill stacks\n\n${skills}\n`;
}

function relationshipLabel(item) {
  const targetProject = projects.find((project) => projectGraphId(project) === item.target);
  const targetStandard = [...sharedRequirements, ...practiceStandards].find((standard) => requirementGraphId(standard.id) === item.target);
  return `${item.predicate} → ${targetProject?.name ?? targetStandard?.label ?? item.target} (${item.scope})`;
}

function implementationMarkdown() {
  const { generator, verifier, runtime } = textToLatticeContract.implementation;
  return `### Implementation provenance\n\n- Generator: ${generator.name} (${generator.modelId}), revision ${generator.revision}; ${generator.inferenceSummary}; pinned artifact ${generator.revisionUrl}; base model ${generator.baseModelRepository}; ${generator.licenseName}: ${generator.licenseUrl}\n- Verifier: ${verifier.name} (${verifier.modelId}), revision ${verifier.revision}; deterministic decoding with fixed seed ${verifier.inference.seed}; pinned artifact ${verifier.revisionUrl}; base model ${verifier.baseModelRepository}\n- Runtime: ${runtime.name} ${runtime.version}; documentation ${runtime.documentationUrl}; source ${runtime.repository}; tokenizer ${runtime.tokenizerName} ${runtime.tokenizerVersion}; constrained JSON via ${runtime.structuredOutputName} ${runtime.structuredOutputVersion}; model-library WASM revision ${runtime.wasmRevision}; ${runtime.wasmRepository}\n- Structured-output runtime: ${runtime.structuredOutputRepository}; ${runtime.structuredOutputLicenseName}: ${runtime.structuredOutputLicenseUrl}\n- Model-library WASM license status: ${runtime.wasmLicenseStatus}\n- Llama license: ${verifier.licenseUrl}\n- Llama acceptable-use policy: ${verifier.acceptableUseUrl}`;
}

function usagePolicyMarkdown() {
  const policy = textToLatticeContract.usagePolicy;
  return [
    "### Usage policy",
    "",
    `- Purpose: ${policy.purpose}`,
    `- Endpoint: ${absoluteUrl(policy.endpoint)}`,
    `- Request body: ${policy.requestBody}; source transmission: ${policy.sourceTransmission}`,
    `- Pseudonymous browser: ${policy.visitor.limit} grants per rolling ${policy.visitor.windowSeconds}-second window; identity: ${policy.visitor.identity}; application-visible retention target: ${policy.visitor.applicationRetentionTargetSeconds} seconds`,
    `- Exact shared request admission: ${policy.globalRequests.limit} validated public POST, PATCH, or DELETE requests per rolling ${policy.globalRequests.windowSeconds}-second window; ${policy.globalRequests.scope}; application-visible retention target: ${policy.globalRequests.applicationRetentionTargetSeconds} seconds`,
    `- Exact shared daily request budget: ${policy.globalDailyRequests.limit} actionable public POST, PATCH, or DELETE requests per ${policy.globalDailyRequests.window}; ${policy.globalDailyRequests.scope}; application-visible retention target: ${policy.globalDailyRequests.applicationRetentionTargetSeconds} seconds`,
    `- Shared grant attempts: ${policy.globalAttempts.limit} otherwise grant-eligible acquisitions per rolling ${policy.globalAttempts.windowSeconds}-second window; application-visible retention target: ${policy.globalAttempts.applicationRetentionTargetSeconds} seconds`,
    `- Shared grants: ${policy.globalGrants.limit} per rolling ${policy.globalGrants.windowSeconds}-second window; application-visible retention target: ${policy.globalGrants.applicationRetentionTargetSeconds} seconds`,
    `- Concurrent leases: ${policy.activeLeases.limit} service-wide and ${policy.activeLeases.perVisitorLimit} per pseudonymous browser; idle expiry: ${policy.activeLeases.ttlSeconds} seconds; client renewal interval: ${policy.activeLeases.renewalIntervalSeconds} seconds; minimum accepted renewal interval: ${policy.activeLeases.minimumRenewalIntervalSeconds} seconds; absolute lifetime: ${policy.activeLeases.maximumLifetimeSeconds} seconds; inactive retention target: ${policy.activeLeases.applicationRetentionTargetSeconds} seconds; maximum active retention target: ${policy.activeLeases.maximumApplicationRetentionTargetSeconds} seconds`,
    `- Enforcement authority: ${policy.enforcement.authority}`,
    `- Exact request admission: ${policy.enforcement.exactRequestAdmission.limit} per ${policy.enforcement.exactRequestAdmission.windowSeconds} seconds ${policy.enforcement.exactRequestAdmission.scope}; evaluated after ${policy.enforcement.exactRequestAdmission.evaluatedAfter}; evaluated before ${policy.enforcement.exactRequestAdmission.evaluatedBefore}; ${policy.enforcement.exactRequestAdmission.role}`,
    `- Exact daily request admission: ${policy.enforcement.exactDailyRequestAdmission.limit} per ${policy.enforcement.exactDailyRequestAdmission.window}; ${policy.enforcement.exactDailyRequestAdmission.scope}; evaluated before ${policy.enforcement.exactDailyRequestAdmission.evaluatedBefore}; ${policy.enforcement.exactDailyRequestAdmission.role}`,
    `- Earliest ingress shaper: ${policy.enforcement.ingressLocationShaper.limit} exact-route calls per ${policy.enforcement.ingressLocationShaper.windowSeconds} seconds ${policy.enforcement.ingressLocationShaper.scope}; evaluated after ${policy.enforcement.ingressLocationShaper.evaluatedAfter}; evaluated before ${policy.enforcement.ingressLocationShaper.evaluatedBefore}; ${policy.enforcement.ingressLocationShaper.role}`,
    `- Combined location shaper: ${policy.enforcement.pathLocationShaper.limit} POST, PATCH, or DELETE calls per ${policy.enforcement.pathLocationShaper.windowSeconds} seconds ${policy.enforcement.pathLocationShaper.scope}; ${policy.enforcement.pathLocationShaper.role}`,
    `- Lease credential: ${policy.enforcement.leaseCredential.format}; ${policy.enforcement.leaseCredential.validation}; ${policy.enforcement.leaseCredential.storage}; replay boundary: ${policy.enforcement.leaseCredential.replayBoundary}`,
    `- Acquisition admission: ${policy.enforcement.humanAttestation.provider}; real-profile action constraint: ${policy.enforcement.humanAttestation.action}; real-profile hostname constraint: ${policy.enforcement.humanAttestation.hostname}; ${policy.enforcement.humanAttestation.browserIsolation}; message boundary: ${policy.enforcement.humanAttestation.messageBoundary}; source transmission: ${policy.enforcement.humanAttestation.sourceTransmission}`,
    `- Acquisition shaper: ${policy.enforcement.locationShaper.limit} ${policy.enforcement.locationShaper.method} calls per ${policy.enforcement.locationShaper.windowSeconds} seconds in ${policy.enforcement.locationShaper.scope}; ${policy.enforcement.locationShaper.role}`,
    `- Renewal shaper: ${policy.enforcement.renewalLocationShaper.limit} ${policy.enforcement.renewalLocationShaper.method} calls per ${policy.enforcement.renewalLocationShaper.windowSeconds} seconds in ${policy.enforcement.renewalLocationShaper.scope}; ${policy.enforcement.renewalLocationShaper.role}`,
    `- Release shaper: ${policy.enforcement.releaseLocationShaper.limit} ${policy.enforcement.releaseLocationShaper.method} calls per ${policy.enforcement.releaseLocationShaper.windowSeconds} seconds in ${policy.enforcement.releaseLocationShaper.scope}; ${policy.enforcement.releaseLocationShaper.role}`,
    `- Per-lease renewal shaper: ${policy.enforcement.renewalLeaseLocationShaper.limit} ${policy.enforcement.renewalLeaseLocationShaper.method} calls per ${policy.enforcement.renewalLeaseLocationShaper.windowSeconds} seconds in ${policy.enforcement.renewalLeaseLocationShaper.scope}; evaluated before ${policy.enforcement.renewalLeaseLocationShaper.evaluatedBefore}; ${policy.enforcement.renewalLeaseLocationShaper.role}`,
    `- Per-lease release shaper: ${policy.enforcement.releaseLeaseLocationShaper.limit} ${policy.enforcement.releaseLeaseLocationShaper.method} calls per ${policy.enforcement.releaseLeaseLocationShaper.windowSeconds} seconds in ${policy.enforcement.releaseLeaseLocationShaper.scope}; evaluated before ${policy.enforcement.releaseLeaseLocationShaper.evaluatedBefore}; ${policy.enforcement.releaseLeaseLocationShaper.role}`,
    `- Required edge rule: ${policy.enforcement.edgeFloodProtection.plan}; exact path ${policy.enforcement.edgeFloodProtection.path}; count by ${policy.enforcement.edgeFloodProtection.characteristic}; ${policy.enforcement.edgeFloodProtection.limit} calls per ${policy.enforcement.edgeFloodProtection.windowSeconds} seconds; block for ${policy.enforcement.edgeFloodProtection.mitigationSeconds} seconds; ${policy.enforcement.edgeFloodProtection.role}; worst documented legitimate same-IP burst: ${policy.enforcement.legitimateBurstBasis.maximumColdStartPosts} cold-start POSTs + ${policy.enforcement.legitimateBurstBasis.maximumReleaseCalls} DELETEs + ${policy.enforcement.legitimateBurstBasis.maximumConcurrentRenewalCalls} PATCHes = ${policy.enforcement.legitimateBurstBasis.maximumPathCalls} calls, leaving ${policy.enforcement.edgeFloodProtection.limit - policy.enforcement.legitimateBurstBasis.maximumPathCalls} calls of margin`,
    `- Public GET paths: ${policy.enforcement.publicGetPaths}`,
    `- Free-tier basis as of ${policy.freeTierBasis.asOf}: ${policy.freeTierBasis.workerRequestsPerDay} Worker requests/day, ${policy.freeTierBasis.durableObjectRequestsPerDay} Durable Object requests/day, ${policy.freeTierBasis.durableObjectRowsReadPerDay} SQLite rows read/day, ${policy.freeTierBasis.durableObjectRowsWrittenPerDay} SQLite rows written/day, and ${policy.freeTierBasis.durableObjectGigabyteSecondsPerDay} Durable Object GB-s/day. Eight continuously occupied slots admit at most ${policy.freeTierBasis.maximumAcceptedRenewalsPerUtcDayAtActiveCap} renewals per UTC day; with grants and releases, the concurrency-tight protocol ceiling is ${policy.freeTierBasis.maximumProtocolLifecycleActionsPerUtcDay} lifecycle actions and ${policy.freeTierBasis.maximumProtocolDirectDurableObjectRequestsPerUtcDay} direct Durable Object calls. Under the nominal single-location configured rates, the ${policy.globalDailyRequests.limit}-admission budget and ${policy.enforcement.pathLocationShaper.limit}-per-minute combined local shaper budget ${policy.freeTierBasis.maximumBudgetedDurableObjectRequestsPerDay} service-wide Durable Object requests, ${policy.freeTierBasis.maximumBudgetedDurableObjectRowsReadPerDay} rows read, and ${policy.freeTierBasis.maximumBudgetedDurableObjectRowsWrittenPerDay} rows written. This includes ${policy.freeTierBasis.maximumBudgetedAlarmInvocationsPerUtcDay} alarm invocations after ${policy.freeTierBasis.alarmMaximumRetriesPerEvent} retries per event and prior-day retry spill, preserving ${policy.freeTierBasis.durableObjectRequestHeadroomPerDay} request, ${policy.freeTierBasis.durableObjectRowsReadHeadroomPerDay} row-read, and ${policy.freeTierBasis.durableObjectRowsWrittenHeadroomPerDay} row-write headroom. One ${policy.freeTierBasis.durableObjectMemoryGigabytes}-GB (${policy.freeTierBasis.durableObjectMemoryMegabytes}-MB) singleton active for all ${policy.freeTierBasis.secondsPerUtcDay} seconds would use ${policy.freeTierBasis.maximumSingletonDurationGigabyteSecondsPerDay} GB-s and preserve ${policy.freeTierBasis.durableObjectDurationHeadroomGigabyteSecondsPerDay} GB-s. This is not an aggregate Worker-request or distributed-abuse guarantee: in-Worker denials are already billed, and distributed hostile traffic plus permissive-counter overshoot remain additional. The dedicated verification frame adds ${policy.freeTierBasis.verificationFrameWorkerCallsForDailyGrants} Worker calls under its static-only hosting contract: ${policy.freeTierBasis.verificationFrameHosting}. ${policy.freeTierBasis.exhaustionMode}; ${policy.freeTierBasis.workerLimitsUrl}; ${policy.freeTierBasis.staticAssetsBillingUrl}; ${policy.freeTierBasis.durableObjectPricingUrl}; ${policy.freeTierBasis.durableObjectAlarmsUrl}`,
    `- Provider-managed recovery history: up to ${policy.providerRecoveryHistoryDays} days`,
    `- Failure mode: ${policy.failureMode}`,
  ].join("\n");
}

function securityAndPrivacyMarkdown() {
  const security = textToLatticeContract.securityAndPrivacy;
  const upstreamLinks = security.huggingFace.sources
    .map(({ label, url }) => `- ${label}: ${url}`)
    .join("\n");
  const apiLinks = security.api.sources
    .map(({ label, url }) => `- ${label}: ${url}`)
    .join("\n");
  return [
    "### Security and privacy",
    "",
    "#### Input and model hardening",
    "",
    security.inputHardening.summary,
    "",
    bullets(security.inputHardening.limits),
    "",
    bullets(security.inputHardening.isolation),
    "",
    "#### Hugging Face boundary",
    "",
    security.huggingFace.summary,
    "",
    bullets(security.huggingFace.protections),
    "",
    security.huggingFace.residualDisclosure,
    "",
    upstreamLinks,
    "",
    "#### Quota API",
    "",
    security.api.summary,
    "",
    bullets(security.api.rules),
    "",
    security.api.limitation,
    "",
    apiLinks,
    "",
    "#### Output handling",
    "",
    security.outputProtection.summary,
    "",
    bullets(security.outputProtection.controls),
    "",
    security.outputProtection.limitation,
  ].join("\n");
}

export function renderProjectMarkdown(slug) {
  const project = projectsManifest.projects.find((item) => item.slug === slug);
  if (!project) return null;
  const releaseStatus = project.interactiveRelease === "not-applicable"
    ? ""
    : `\n\nInteractive client release: ${machineValueLabel(project.interactiveRelease)}`;
  const applicationAvailability = applicationReleaseStatus === "held"
    ? "The completed interactive client is not included in the public bundle while its sole open blocker—the live lease, verification-origin, and response-policy boundary—remains unestablished. This section documents the client contract and accepted residuals; it does not make the conversion client available."
    : applicationReleaseStatus === "enabled"
      ? "The public interactive client is included in the public bundle."
      : "No public interactive client is represented as available.";
  const tool = slug === "lattice" ? `\n\n## ${textToLatticeContract.name}\n\nCanonical URL: ${absoluteUrl(textToLatticeContract.canonicalPath)}\n\nPublic client status: ${machineValueLabel(applicationReleaseStatus)}\n\nPublication mode: ${machineValueLabel(applicationPublicationMode)}. ${applicationAvailability}\n\n${textToLatticeContract.purpose}\n\n### Input\n\n${textToLatticeContract.input}\n\n### Output\n\n${textToLatticeContract.output}\n\n### Process\n\n${bullets(textToLatticeContract.process)}\n\n### Constraints\n\n${bullets(textToLatticeContract.constraints)}\n\n${securityAndPrivacyMarkdown()}\n\n${usagePolicyMarkdown()}\n\n${implementationMarkdown()}` : "";
  return `# ${heading(project.name)}\n\nCanonical URL: ${project.canonicalUrl}\n\nExternal URL: ${project.externalUrl}\n\nStatus: ${project.status.value} as of ${project.status.asOf}\n\nPublication: ${project.publication.label} (${project.publication.precision})${releaseStatus}\n\n${project.summary.join("\n\n")}\n\n## Emphasis\n\n${bullets(project.emphasis)}\n\n## Capabilities\n\n${bullets(project.capabilities.items)}\n\n## Technologies\n\n${bullets(project.technologies.items)}\n\n## Evidence\n\n${bullets(project.evidence.map(({ url }) => url))}\n\n## Documentation\n\n${bullets(project.documentation.map(documentationMarkdownLine))}\n\n## Limitations\n\n${bullets(project.limitations.items)}\n\n## Relationships\n\n${bullets(project.relationships.map(relationshipLabel))}\n\n## Inherited requirements\n\n${bullets(sharedRequirements.map(({ label, id }) => `${label}: ${absoluteUrl(`/requirements/#${id}`)}`))}\n\n## Provenance\n\n- Repository: ${project.provenance.repository}\n- Sources: ${project.provenance.sourcePaths.join(", ")}\n- Version: ${project.provenance.version}\n- Last updated: ${project.provenance.lastUpdated}\n- External project license: not documented in this portfolio record.\n- This portfolio record’s authored content: ${SITE_CONTENT_TERMS_URL}.${tool}\n`;
}

export function renderProjectsMarkdown() {
  return `# Projects\n\nCanonical URL: ${absoluteUrl("/projects/")}\n\n${projects.map(({ slug }) => renderProjectMarkdown(slug)).join("\n\n---\n\n")}`;
}

export function renderToolsMarkdown() {
  const records = toolsManifest.tools.map((tool) => `## ${heading(tool.name)}\n\n- Category: ${tool.category}\n- URL: ${tool.url}\n- Summary: ${tool.summary}\n\n### Traits\n\n${bullets(tool.traits)}`).join("\n\n");
  const social = toolsManifest.social.map((profile) => `- ${profile.name}: ${profile.url}`).join("\n");
  return `# Tools\n\nCanonical URL: ${toolsManifest.canonicalUrl}\n\n${records}\n\n## Social\n\n${social}\n`;
}

export function renderShelfMarkdown() {
  const records = shelfManifest.items.map((item) => `## ${heading(item.title)}\n\n- Language: ${item.languages.join(", ")}\n- Publisher: ${item.publishers.join(", ")}\n- Date: ${item.date}\n- Author(s): ${item.authors.join(", ")}\n- Collection(s): ${item.collections.join(", ")}`).join("\n\n");
  return `# Shelf\n\nCanonical URL: ${shelfManifest.canonicalUrl}\n\n${shelfManifest.notice}\n\n${records}\n`;
}

export function renderLlmsTxt() {
  const documentation = projectDocuments
    .flatMap((document) => [
      `- [${document.title} — interactive HTML](${document.htmlUrl})`,
      `- [${document.title} — Markdown](${document.markdownUrl})`,
    ])
    .join("\n");
  const releaseEvidence = [
    ["Text to Lattice release qualification", "TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md"],
    ["Text to Lattice machine release register", "TEXT-TO-LATTICE-RELEASE-REGISTER.json"],
    ["Llama-use evaluation cases", "LLAMA-USE-EVALUATION-CASES.json"],
  ].map(([label, filename]) => `- [${label}](${absoluteUrl(`/documentation/text-to-lattice/${filename}`)})`).join("\n");
  const releaseBoundary = applicationReleaseStatus === "held"
    ? "The Text to Lattice interactive client is held."
    : applicationReleaseStatus === "enabled"
      ? "The Text to Lattice interactive client is enabled."
      : "No Text to Lattice interactive client is represented as available.";
  return `# hah.dev\n\n> ${person.headline}\n\nAuthoritative public portfolio map. ${releaseBoundary} Source and results remain transient and are never included in these files.\n\n## Primary pages\n\n- [About](${SITE_ORIGIN}/)\n- [Resume](${absoluteUrl("/resume/")})\n- [Projects](${absoluteUrl("/projects/")})\n- [Requirements](${absoluteUrl("/requirements/")})\n- [Semantic vocabulary](${absoluteUrl("/ns/")})\n- [Third-party notices](${absoluteUrl("/third-party-notices/")})\n- [Tools](${absoluteUrl("/tools/")})\n- [Shelf](${absoluteUrl("/shelf/")})\n\n## Lattice documentation\n\n${documentation}\n\n### Text to Lattice release evidence\n\n${releaseEvidence}\n\n## Structured records\n\n- [Project manifest](${absoluteUrl("/projects.json")})\n- [Resume manifest](${absoluteUrl("/resume.json")})\n- [Tools manifest](${absoluteUrl("/tools.json")})\n- [Shelf manifest](${absoluteUrl("/shelf.json")})\n- [Knowledge graph](${absoluteUrl("/knowledge-graph.jsonld")})\n- [Project schema, current v2](${absoluteUrl("/schemas/projects-v2.schema.json")})\n- [Project schema, archived v1](${absoluteUrl("/schemas/projects-v1.schema.json")})\n\n## Canonical text\n\n- [About Markdown](${absoluteUrl("/content/about.md")})\n- [Resume Markdown](${absoluteUrl("/content/resume.md")})\n- [Projects Markdown](${absoluteUrl("/content/projects.md")})\n- [Tools Markdown](${absoluteUrl("/content/tools.md")})\n- [Shelf Markdown](${absoluteUrl("/content/shelf.md")})\n- [Complete authoritative text](${absoluteUrl("/llms-full.txt")})\n\n## Provenance and terms\n\n- [Portfolio repository](${SITE_REPOSITORY})\n- Site content version: ${SITE_CONTENT_VERSION}\n- Last updated: ${SITE_CONTENT_UPDATED}\n- [Source-code license](${SITE_SOURCE_LICENSE_URL})\n- [Authored portfolio-content terms](${SITE_CONTENT_TERMS_URL})\n- [Third-party notices and supplied license texts](${absoluteUrl("/third-party-notices/")})\n`;
}

export function renderLlmsFull() {
  const requirements = [...sharedRequirements, ...practiceStandards].map((item) => `- ${item.label}: ${item.description} (${requirementGraphId(item.id)})`).join("\n");
  const vocabulary = namespaceTerms.map((item) => `- ${item.id}: ${item.description}`).join("\n");
  return `# hah.dev — complete authoritative portfolio text\n\nAs of: ${SITE_CONTENT_UPDATED}\nVersion: ${SITE_CONTENT_VERSION}\nRepository: ${SITE_REPOSITORY}\nSite source-code license: ${SITE_SOURCE_LICENSE_URL}\nAuthored portfolio-content terms: ${SITE_CONTENT_TERMS_URL}\n\n## Representation boundary\n\nThis file contains owner-authored public portfolio information. Text entered into Text to Lattice, generated candidates, clarification answers, findings, and results remain transient browser state and are never incorporated here.\n\n## Requirements and practice standards\n\n${requirements}\n\n## Semantic vocabulary\n\n${vocabulary}\n\n---\n\n${renderAboutMarkdown()}\n\n---\n\n${renderResumeMarkdown()}\n\n---\n\n${renderProjectsMarkdown()}\n\n---\n\n${renderToolsMarkdown()}\n\n---\n\n${renderShelfMarkdown()}`;
}

const xmlEscape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
export function renderSitemap() {
  const urls = [
    ...canonicalHtmlRoutes.map(({ pathname }) => absoluteUrl(pathname)),
    ...projectDocuments.map(({ htmlUrl }) => htmlUrl),
  ];
  const rows = urls.map((url) => `  <url>\n    <loc>${xmlEscape(url)}</loc>\n    <lastmod>${SITE_CONTENT_UPDATED}</lastmod>\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}
export function renderRobots() {
  return `User-agent: *\nAllow: /\nDisallow: /api/text-to-lattice/\n\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`;
}

const projectKinds = [...new Set(projects.map(({ type }) => type))];
const projectStatuses = [...new Set(projects.map(({ status }) => status))];
const publicationPrecisions = [...new Set(projects.map(({ publication }) => publication.precision))];
const interactiveReleaseStatuses = ["held", "enabled", "not-applicable"];
const relationshipPredicates = [...new Set(projects.flatMap(({ relationships }) => relationships.map(({ relation }) => relation)))];
const relationshipTargets = [
  ...projects.map(projectGraphId),
  ...sharedRequirements.map(({ id }) => requirementGraphId(id)),
  ...practiceStandards.map(({ id }) => requirementGraphId(id)),
];

export const projectsSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": absoluteUrl("/schemas/projects-v2.schema.json"),
  title: "hah.dev project manifest",
  type: "object",
  additionalProperties: false,
  required: ["schema", "version", "asOf", "canonicalUrl", "sharedRequirements", "practiceStandards", "projects"],
  properties: {
    schema: { const: absoluteUrl("/schemas/projects-v2.schema.json") },
    version: { "$ref": "#/$defs/nonEmptyString" },
    asOf: { type: "string", format: "date" },
    canonicalUrl: { const: absoluteUrl("/projects/") },
    sharedRequirements: { type: "array", items: { "$ref": "#/$defs/standard" } },
    practiceStandards: { type: "array", items: { "$ref": "#/$defs/standard" } },
    projects: { type: "array", minItems: 1, items: { "$ref": "#/$defs/project" } },
  },
  "$defs": {
    nonEmptyString: { type: "string", minLength: 1 },
    uri: { type: "string", format: "uri", pattern: "^https://" },
    stringList: {
      type: "object", additionalProperties: false, required: ["documented", "items"],
      properties: { documented: { type: "boolean" }, items: { type: "array", items: { "$ref": "#/$defs/nonEmptyString" } } },
      allOf: [
        { if: { properties: { documented: { const: false } }, required: ["documented"] }, then: { properties: { items: { type: "array", maxItems: 0 } } } },
        { if: { properties: { documented: { const: true } }, required: ["documented"] }, then: { properties: { items: { type: "array", minItems: 1 } } } },
      ],
    },
    standard: {
      type: "object", additionalProperties: false, required: ["id", "label", "description", "graphId"],
      properties: {
        id: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }, label: { "$ref": "#/$defs/nonEmptyString" },
        description: { "$ref": "#/$defs/nonEmptyString" },
        graphId: { type: "string", enum: relationshipTargets.filter((value) => value.includes("/requirements/")) },
      },
    },
    evidence: { type: "object", additionalProperties: false, required: ["type", "url"], properties: { type: { const: "authoritative-link" }, url: { "$ref": "#/$defs/uri" } } },
    status: { type: "object", additionalProperties: false, required: ["value", "asOf"], properties: { value: { type: "string", enum: projectStatuses }, asOf: { type: "string", format: "date" } } },
    publication: {
      type: "object", additionalProperties: false, required: ["label", "value", "precision"],
      properties: { label: { "$ref": "#/$defs/nonEmptyString" }, value: { type: "string", pattern: "^\\d{4}-\\d{2}$" }, precision: { type: "string", enum: publicationPrecisions } },
    },
    documentation: {
      type: "object",
      additionalProperties: false,
      required: ["label", "url"],
      properties: {
        id: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
        artifactId: { type: "string", pattern: "^DOC-[A-Z]+$" },
        label: { "$ref": "#/$defs/nonEmptyString" },
        title: { "$ref": "#/$defs/nonEmptyString" },
        scope: { type: "string", enum: ["method", "method-and-ecosystem", "wrapper"] },
        url: { "$ref": "#/$defs/uri" },
        markdownUrl: { "$ref": "#/$defs/uri" },
        htmlMediaType: { const: "text/html" },
        markdownMediaType: { const: "text/markdown" },
      },
      allOf: [{
        if: { properties: { markdownUrl: true }, required: ["markdownUrl"] },
        then: {
          properties: {
            id: true, artifactId: true, title: true, scope: true,
            htmlMediaType: true, markdownMediaType: true,
          },
          required: ["id", "artifactId", "title", "scope", "htmlMediaType", "markdownMediaType"],
        },
      }],
    },
    relationship: {
      type: "object", additionalProperties: false, required: ["predicate", "target", "scope"],
      properties: { predicate: { type: "string", enum: relationshipPredicates }, target: { type: "string", enum: relationshipTargets }, scope: { "$ref": "#/$defs/nonEmptyString" } },
    },
    provenance: {
      type: "object", additionalProperties: false, required: ["repository", "sourcePaths", "version", "lastUpdated"],
      properties: {
        repository: { const: SITE_REPOSITORY }, sourcePaths: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", minLength: 1, pattern: "^(?![/~])" } },
        version: { "$ref": "#/$defs/nonEmptyString" }, lastUpdated: { type: "string", format: "date" },
      },
    },
    license: {
      type: "object", additionalProperties: false, required: ["documented", "value"],
      properties: { documented: { type: "boolean" }, value: { type: ["string", "null"] } },
      oneOf: [
        { properties: { documented: { const: false }, value: { type: "null" } } },
        { properties: { documented: { const: true }, value: { "$ref": "#/$defs/uri" } } },
      ],
    },
    project: {
      type: "object", additionalProperties: false,
      required: ["id", "slug", "name", "kind", "thesis", "summary", "emphasis", "purpose", "problem", "users", "invariants", "capabilities", "technologies", "evidence", "limitations", "status", "publication", "interactiveRelease", "canonicalUrl", "externalUrl", "documentation", "relationships", "inheritedRequirements", "provenance", "license"],
      properties: {
        id: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }, slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
        name: { "$ref": "#/$defs/nonEmptyString" }, kind: { type: "string", enum: projectKinds }, thesis: { "$ref": "#/$defs/nonEmptyString" },
        summary: { type: "array", minItems: 1, items: { "$ref": "#/$defs/nonEmptyString" } }, emphasis: { type: "array", minItems: 1, uniqueItems: true, items: { "$ref": "#/$defs/nonEmptyString" } },
        purpose: { "$ref": "#/$defs/stringList" }, problem: { "$ref": "#/$defs/stringList" }, users: { "$ref": "#/$defs/stringList" }, invariants: { "$ref": "#/$defs/stringList" },
        capabilities: { "$ref": "#/$defs/stringList" }, technologies: { "$ref": "#/$defs/stringList" }, evidence: { type: "array", minItems: 1, items: { "$ref": "#/$defs/evidence" } },
        limitations: { "$ref": "#/$defs/stringList" }, status: { "$ref": "#/$defs/status" }, publication: { "$ref": "#/$defs/publication" },
        interactiveRelease: { type: "string", enum: interactiveReleaseStatuses },
        canonicalUrl: { type: "string", pattern: "^https://hah\\.dev/projects/[a-z0-9-]+/$" }, externalUrl: { "$ref": "#/$defs/uri" },
        documentation: { type: "array", items: { "$ref": "#/$defs/documentation" } }, relationships: { type: "array", items: { "$ref": "#/$defs/relationship" } },
        inheritedRequirements: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", enum: sharedRequirements.map(({ id }) => requirementGraphId(id)) } },
        provenance: { "$ref": "#/$defs/provenance" }, license: { "$ref": "#/$defs/license" },
      },
    },
  },
};

export const projectsSchemaV1 = (() => {
  const schema = structuredClone(projectsSchema);
  schema.$id = absoluteUrl("/schemas/projects-v1.schema.json");
  schema.properties.schema.const = schema.$id;
  schema.$defs.project.required = schema.$defs.project.required.filter((name) => name !== "interactiveRelease");
  delete schema.$defs.project.properties.interactiveRelease;
  return schema;
})();
