const projects = [
  {
    name: "Evenward.rest",
    url: "https://evenward.rest/",
    summary: "Privacy-first, client-side web app for self-regulation.",
    publication: "July 2026",
  },
];

function TreeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      className="bi bi-tree"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M8.416.223a.5.5 0 0 0-.832 0l-3 4.5A.5.5 0 0 0 5 5.5h.098L3.076 8.735A.5.5 0 0 0 3.5 9.5h.191l-1.638 3.276a.5.5 0 0 0 .447.724H7V16h2v-2.5h4.5a.5.5 0 0 0 .447-.724L12.31 9.5h.191a.5.5 0 0 0 .424-.765L10.902 5.5H11a.5.5 0 0 0 .416-.777zM6.437 4.758A.5.5 0 0 0 6 4.5h-.066L8 1.401 10.066 4.5H10a.5.5 0 0 0-.424.765L11.598 8.5H11.5a.5.5 0 0 0-.447.724L12.69 12.5H3.309l1.638-3.276A.5.5 0 0 0 4.5 8.5h-.098l2.022-3.235a.5.5 0 0 0 .013-.507" />
    </svg>
  );
}

export default function ResumeProjects() {
  return (
    <section className="container" aria-labelledby="projects-title">
      <h2 className="text-center skill-stack-heading" id="projects-title">
        Projects
      </h2>
      <div className="card-columns folio-card-grid">
        {projects.map((project) => (
          <article className="card" key={project.name}>
            <div className="card-body">
              <div className="row justify-content-center">
                <a
                  href={project.url}
                  title={project.name}
                  className="tool-icon"
                  aria-label={`Visit ${project.name}`}
                >
                  <TreeIcon />
                </a>
              </div>
              <h5 className="card-title tools-card-title row justify-content-center">
                <a href={project.url}>{project.name}</a>
              </h5>
              <p className="card-text">{project.summary}</p>
              <p className="card-text">
                <small>{project.publication}</small>
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
