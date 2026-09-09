import { projects } from "./projects.js";
import ProjectDescriptionDisclosure from "./ProjectDescriptionDisclosure";

type ProjectIconName =
  | "airplane-engines"
  | "tree"
  | "diagram-3"
  | "bricks"
  | "backpack4"
  | "pen-fill"
  | "archive";

const PROJECT_ICON_PATHS: Readonly<Record<ProjectIconName, readonly string[]>> = Object.freeze({
  "airplane-engines": Object.freeze([
    "M8 0c-.787 0-1.292.592-1.572 1.151A4.35 4.35 0 0 0 6 3v3.691l-2 1V7.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.191l-1.17.585A1.5 1.5 0 0 0 0 10.618V12a.5.5 0 0 0 .582.493l1.631-.272.313.937a.5.5 0 0 0 .948 0l.405-1.214 2.21-.369.375 2.253-1.318 1.318A.5.5 0 0 0 5.5 16h5a.5.5 0 0 0 .354-.854l-1.318-1.318.375-2.253 2.21.369.405 1.214a.5.5 0 0 0 .948 0l.313-.937 1.63.272A.5.5 0 0 0 16 12v-1.382a1.5 1.5 0 0 0-.83-1.342L14 8.691V7.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v.191l-2-1V3c0-.568-.14-1.271-.428-1.849C9.292.591 8.787 0 8 0M7 3c0-.432.11-.979.322-1.401C7.542 1.159 7.787 1 8 1s.458.158.678.599C8.889 2.02 9 2.569 9 3v4a.5.5 0 0 0 .276.447l5.448 2.724a.5.5 0 0 1 .276.447v.792l-5.418-.903a.5.5 0 0 0-.575.41l-.5 3a.5.5 0 0 0 .14.437l.646.646H6.707l.647-.646a.5.5 0 0 0 .14-.436l-.5-3a.5.5 0 0 0-.576-.411L1 11.41v-.792a.5.5 0 0 1 .276-.447l5.448-2.724A.5.5 0 0 0 7 7z",
  ]),
  tree: Object.freeze([
    "M8.416.223a.5.5 0 0 0-.832 0l-3 4.5A.5.5 0 0 0 5 5.5h.098L3.076 8.735A.5.5 0 0 0 3.5 9.5h.191l-1.638 3.276a.5.5 0 0 0 .447.724H7V16h2v-2.5h4.5a.5.5 0 0 0 .447-.724L12.31 9.5h.191a.5.5 0 0 0 .424-.765L10.902 5.5H11a.5.5 0 0 0 .416-.777zM6.437 4.758A.5.5 0 0 0 6 4.5h-.066L8 1.401 10.066 4.5H10a.5.5 0 0 0-.424.765L11.598 8.5H11.5a.5.5 0 0 0-.447.724L12.69 12.5H3.309l1.638-3.276A.5.5 0 0 0 4.5 8.5h-.098l2.022-3.235a.5.5 0 0 0 .013-.507",
  ]),
  "diagram-3": Object.freeze([
    "M6 3.5A1.5 1.5 0 0 1 7.5 2h1A1.5 1.5 0 0 1 10 3.5v1A1.5 1.5 0 0 1 8.5 6v1H14a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 2 7h5.5V6A1.5 1.5 0 0 1 6 4.5zM8.5 5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5zM0 11.5A1.5 1.5 0 0 1 1.5 10h1A1.5 1.5 0 0 1 4 11.5v1A1.5 1.5 0 0 1 2.5 14h-1A1.5 1.5 0 0 1 0 12.5zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zm4.5.5A1.5 1.5 0 0 1 7.5 10h1a1.5 1.5 0 0 1 1.5 1.5v1A1.5 1.5 0 0 1 8.5 14h-1A1.5 1.5 0 0 1 6 12.5zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zm4.5.5a1.5 1.5 0 0 1 1.5-1.5h1a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5z",
  ]),
  bricks: Object.freeze([
    "M0 .5A.5.5 0 0 1 .5 0h15a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H14v2h1.5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H14v2h1.5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H.5a.5.5 0 0 1-.5-.5v-3a.5.5 0 0 1 .5-.5H2v-2H.5a.5.5 0 0 1-.5-.5v-3A.5.5 0 0 1 .5 6H2V4H.5a.5.5 0 0 1-.5-.5zM3 4v2h4.5V4zm5.5 0v2H13V4zM3 10v2h4.5v-2zm5.5 0v2H13v-2zM1 1v2h3.5V1zm4.5 0v2h5V1zm6 0v2H15V1zM1 7v2h3.5V7zm4.5 0v2h5V7zm6 0v2H15V7zM1 13v2h3.5v-2zm4.5 0v2h5v-2zm6 0v2H15v-2z",
  ]),
  backpack4: Object.freeze([
    "M4 9.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5zm1 .5v3h6v-3h-1v.5a.5.5 0 0 1-1 0V10z",
    "M8 0a2 2 0 0 0-2 2H3.5a2 2 0 0 0-2 2v1c0 .52.198.993.523 1.349A.5.5 0 0 0 2 6.5V14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6.5a.5.5 0 0 0-.023-.151c.325-.356.523-.83.523-1.349V4a2 2 0 0 0-2-2H10a2 2 0 0 0-2-2m0 1a1 1 0 0 0-1 1h2a1 1 0 0 0-1-1M3 14V6.937q.24.062.5.063h4v.5a.5.5 0 0 0 1 0V7h4q.26 0 .5-.063V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1m9.5-11a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
  ]),
  "pen-fill": Object.freeze([
    "m13.498.795.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001",
  ]),
  archive: Object.freeze([
    "M0 2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1v7.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 12.5V5a1 1 0 0 1-1-1zm2 3v7.5A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V5zm13-3H1v2h14zM5 7.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5",
  ]),
});

function ProjectIcon({ icon }: { icon: ProjectIconName }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      className={`bi bi-${icon}`}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      {PROJECT_ICON_PATHS[icon].map((path, index) => (
        <path
          d={path}
          fillRule={icon === "diagram-3" ? "evenodd" : undefined}
          key={`${icon}-${index}`}
        />
      ))}
    </svg>
  );
}

function projectHeadingId(name: string) {
  return `project-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

export default function ResumeProjectsHeld() {
  return (
    <section className="container" aria-labelledby="projects-title">
      <h2 className="text-center skill-stack-heading" id="projects-title">
        Projects
      </h2>

      <div className="folio-card-grid">
        {projects.map((project) => {
          const headingId = projectHeadingId(project.name);

          return (
            <article className="card" key={project.id} aria-labelledby={headingId}>
              <div className="card-body">
                <div className="row justify-content-center">
                  {project.id === "lattice" ? (
                    <a
                      className="tool-icon project-modal-trigger signal-fuzz"
                      href="/projects/lattice/text-to-lattice/"
                      aria-label="Read Text to Lattice release status"
                    >
                      <ProjectIcon icon={project.icon as ProjectIconName} />
                    </a>
                  ) : (
                    <span className="tool-icon signal-fuzz" aria-hidden="true">
                      <ProjectIcon icon={project.icon as ProjectIconName} />
                    </span>
                  )}
                </div>

                <h3
                  className="card-title tools-card-title row justify-content-center"
                  id={headingId}
                >
                  <a className="signal-fuzz" href={project.canonicalPath}>
                    {project.name}
                  </a>
                </h3>

                <ProjectDescriptionDisclosure
                  hook={project.summary[0]}
                  paragraph={project.summary[1]}
                  projectId={project.id}
                  projectName={project.name}
                />

                {project.id === "lattice" ? (
                  <p className="card-text lattice-noscript-note">
                    Text to Lattice is unavailable when the machine release record contains an
                    open blocker. Accepted model, WebAssembly, accessibility, capacity, and
                    privacy residuals remain documented; Lattice itself and every mapped document
                    remain available.
                  </p>
                ) : null}

                {project.resources.length ? (
                  <nav
                    className="project-resources"
                    aria-label={`${project.name} supporting materials`}
                  >
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
                              <span aria-hidden="true">
                                <ProjectIcon icon={resource.icon as ProjectIconName} />
                              </span>{" "}
                              <span>{resource.label}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                ) : null}

                <p className="card-text">
                  <small>{project.publication.label}</small>
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <p className="project-record-link">
        <a href="/projects/">All canonical project records</a>
      </p>
    </section>
  );
}
