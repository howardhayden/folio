import { SiteHeader } from "../components/SiteChrome";
import { projects } from "../resume/projects.js";
import { JsonLd } from "../semantic/JsonLd";
import { semanticMetadata } from "../semantic/metadata";
import { jsonLdForPage } from "../semantic/portfolio.js";

export const metadata = semanticMetadata(
  "Projects",
  "Public projects and their explicit relationships, capabilities, evidence, and limitations.",
  "/projects/",
);

export default function ProjectsPage() {
  return (
    <>
      <JsonLd value={jsonLdForPage("/projects/")} />
      <SiteHeader />
      <main className="container mt-4 page-view semantic-page" data-page-view="projects">
        <h1 className="text-center">Projects</h1>
        <p className="lead text-center">Canonical project records behind the résumé’s stateful project cards.</p>
        <div className="folio-card-grid">
          {projects.map((project) => (
            <article className="card" data-project-id={project.id} key={project.id}>
              <div className="card-body">
                <h2 className="card-title"><a className="signal-fuzz" href={project.canonicalPath}>{project.name}</a></h2>
                {project.summary.map((paragraph) => <p className="card-text" key={paragraph}>{paragraph}</p>)}
                <p><strong>Status:</strong> {project.status}; <strong>publication:</strong> {project.publication.label}</p>
                <p><a href={project.url}>Authoritative external source</a></p>
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
