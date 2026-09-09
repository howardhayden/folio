import { projects } from "../resume/projects.js";
import { resumeDetailList } from "../resume/resumeDetails.js";

const htmlRecord = (pathname, output, expectedStatus = 200) => Object.freeze({ pathname, output, accept: "text/html", contentType: "text/html", expectedStatus });
const artifactRecord = (pathname, output, accept, contentType) => Object.freeze({ pathname, output, accept, contentType, expectedStatus: 200 });
const sourceCopyRecord = (pathname, source, output, contentType) => Object.freeze({ pathname, source, output, contentType });

export const canonicalHtmlRoutes = Object.freeze([
  htmlRecord("/", "index.html"),
  htmlRecord("/resume/", "resume/index.html"),
  htmlRecord("/tools/", "tools/index.html"),
  htmlRecord("/shelf/", "shelf/index.html"),
  htmlRecord("/projects/", "projects/index.html"),
  htmlRecord("/requirements/", "requirements/index.html"),
  htmlRecord("/ns/", "ns/index.html"),
  htmlRecord("/third-party-notices/", "third-party-notices/index.html"),
  ...projects.map(({ slug }) => htmlRecord(`/projects/${slug}/`, `projects/${slug}/index.html`)),
  htmlRecord("/projects/lattice/text-to-lattice/", "projects/lattice/text-to-lattice/index.html"),
  ...resumeDetailList.map(({ id }) => htmlRecord(`/resume/${id}/`, `resume/${id}/index.html`)),
]);

export const semanticArtifactRoutes = Object.freeze([
  artifactRecord("/projects.json", "projects.json", "application/json", "application/json"),
  artifactRecord("/resume.json", "resume.json", "application/json", "application/json"),
  artifactRecord("/tools.json", "tools.json", "application/json", "application/json"),
  artifactRecord("/shelf.json", "shelf.json", "application/json", "application/json"),
  artifactRecord("/knowledge-graph.jsonld", "knowledge-graph.jsonld", "application/ld+json", "application/ld+json"),
  artifactRecord("/schemas/projects-v1.schema.json", "schemas/projects-v1.schema.json", "application/schema+json", "application/schema+json"),
  artifactRecord("/content/about.md", "content/about.md", "text/markdown", "text/markdown"),
  artifactRecord("/content/resume.md", "content/resume.md", "text/markdown", "text/markdown"),
  artifactRecord("/content/projects.md", "content/projects.md", "text/markdown", "text/markdown"),
  ...projects.map(({ slug }) => artifactRecord(`/content/projects/${slug}.md`, `content/projects/${slug}.md`, "text/markdown", "text/markdown")),
  artifactRecord("/content/tools.md", "content/tools.md", "text/markdown", "text/markdown"),
  artifactRecord("/content/shelf.md", "content/shelf.md", "text/markdown", "text/markdown"),
  artifactRecord("/llms.txt", "llms.txt", "text/plain", "text/plain"),
  artifactRecord("/llms-full.txt", "llms-full.txt", "text/plain", "text/plain"),
  artifactRecord("/sitemap.xml", "sitemap.xml", "application/xml", "application/xml"),
  artifactRecord("/robots.txt", "robots.txt", "text/plain", "text/plain"),
]);

export const staticSourceCopies = Object.freeze([
  sourceCopyRecord("/NOTICE", "NOTICE", "NOTICE", "text/plain"),
  sourceCopyRecord("/THIRD_PARTY_NOTICES.md", "THIRD_PARTY_NOTICES.md", "THIRD_PARTY_NOTICES.md", "text/markdown"),
  sourceCopyRecord("/THIRD_PARTY_LICENSES.txt", "THIRD_PARTY_LICENSES.txt", "THIRD_PARTY_LICENSES.txt", "text/plain"),
  sourceCopyRecord("/LICENSES/Apache-2.0.txt", "LICENSES/Apache-2.0.txt", "LICENSES/Apache-2.0.txt", "text/plain"),
  sourceCopyRecord("/LICENSES/LicenseRef-Hayden-Portfolio-Content.txt", "LICENSES/LicenseRef-Hayden-Portfolio-Content.txt", "LICENSES/LicenseRef-Hayden-Portfolio-Content.txt", "text/plain"),
  sourceCopyRecord("/LICENSES/Llama-3.2-Acceptable-Use-Policy.md", "LICENSES/Llama-3.2-Acceptable-Use-Policy.md", "LICENSES/Llama-3.2-Acceptable-Use-Policy.md", "text/markdown"),
  sourceCopyRecord("/LICENSES/Llama-3.2-Community-License.txt", "LICENSES/Llama-3.2-Community-License.txt", "LICENSES/Llama-3.2-Community-License.txt", "text/plain"),
  sourceCopyRecord("/LICENSES/MIT-Bootstrap.txt", "LICENSES/MIT-Bootstrap.txt", "LICENSES/MIT-Bootstrap.txt", "text/plain"),
  sourceCopyRecord("/LICENSES/MIT-React.txt", "LICENSES/MIT-React.txt", "LICENSES/MIT-React.txt", "text/plain"),
  sourceCopyRecord("/LICENSES/MIT-loglevel.txt", "LICENSES/MIT-loglevel.txt", "LICENSES/MIT-loglevel.txt", "text/plain"),
  sourceCopyRecord("/LICENSES/MIT-vinext.txt", "LICENSES/MIT-vinext.txt", "LICENSES/MIT-vinext.txt", "text/plain"),
  sourceCopyRecord("/LICENSES/PolyForm-Noncommercial-1.0.0.txt", "LICENSES/PolyForm-Noncommercial-1.0.0.txt", "LICENSES/PolyForm-Noncommercial-1.0.0.txt", "text/plain"),
]);

export const staticExportRoutes = Object.freeze([
  ...canonicalHtmlRoutes,
  htmlRecord("/not-found/", "404.html", 404),
  ...semanticArtifactRoutes,
]);
