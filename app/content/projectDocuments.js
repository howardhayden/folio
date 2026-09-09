export const PROJECT_DOCUMENTS_VERSION = "hah-portfolio-project-documents.v1";
export const PROJECT_DOCUMENTS_UPDATED = "2026-09-08";

const documentationRoot = "https://hah.dev/documentation/text-to-lattice/";

export const projectDocuments = Object.freeze([
  Object.freeze({
    id: "lattice-concept-map",
    artifactId: "DOC-CONCEPT",
    projectId: "lattice",
    scope: "method-and-ecosystem",
    label: "Concept Map",
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
    label: "Skill Map",
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
    label: "Service Blueprint",
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
    label: "Security Model",
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
