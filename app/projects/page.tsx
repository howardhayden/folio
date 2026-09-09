import { SiteHeader } from "../components/SiteChrome";
import ProjectDescriptionDisclosure from "../resume/ProjectDescriptionDisclosure";
import { projects } from "../resume/projects.js";
import { JsonLd } from "../semantic/JsonLd";
import { semanticMetadata } from "../semantic/metadata";
import { jsonLdForPage } from "../semantic/portfolio.js";

export const metadata = semanticMetadata(
  "Projects",
  "Public projects and their explicit relationships, capabilities, evidence, and limitations.",
  "/projects/",
);

function DocumentationIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      className="bi bi-backpack4"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 9.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5zm1 .5v3h6v-3h-1v.5a.5.5 0 0 1-1 0V10z" />
      <path d="M8 0a2 2 0 0 0-2 2H3.5a2 2 0 0 0-2 2v1c0 .52.198.993.523 1.349A.5.5 0 0 0 2 6.5V14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6.5a.5.5 0 0 0-.023-.151c.325-.356.523-.83.523-1.349V4a2 2 0 0 0-2-2H10a2 2 0 0 0-2-2m0 1a1 1 0 0 0-1 1h2a1 1 0 0 0-1-1M3 14V6.937q.24.062.5.063h4v.5a.5.5 0 0 0 1 0V7h4q.26 0 .5-.063V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1m9.5-11a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    </svg>
  );
}

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
                <ProjectDescriptionDisclosure
                  hook={project.summary[0]}
                  paragraph={project.summary[1]}
                  projectId={`record-${project.id}`}
                  projectName={project.name}
                />
                <nav className="project-resources" aria-label={`${project.name} supporting materials`}>
                  <ul className="list-unstyled">
                    {project.resources.map((resource) => {
                      const opensInNewTab = resource.opensInNewTab === true;

                      return (
                        <li key={`${resource.label}-${resource.url}`}>
                          <a
                            className="signal-fuzz"
                            href={resource.url}
                            target={opensInNewTab ? "_blank" : undefined}
                            rel={opensInNewTab ? "noopener noreferrer" : undefined}
                            aria-label={
                              opensInNewTab
                                ? `${resource.label}, opens in a new tab`
                                : resource.label
                            }
                          >
                            <span aria-hidden="true"><DocumentationIcon /></span>{" "}
                            <span>{resource.label}</span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
                <p><strong>Status:</strong> {project.status}; <strong>publication:</strong> {project.publication.label}</p>
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
