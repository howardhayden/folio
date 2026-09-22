import { LegacyIcon, type LegacyIconName } from "../components/LegacyIcon";
import { tools, type ToolBranch } from "../data";
import { toolsSocial } from "../content/siteContent.js";

function branchPrefix(ancestorContinues: readonly boolean[], isLast: boolean) {
  const ancestors = ancestorContinues
    .map((continues) => (continues ? "│  " : "   "))
    .join("");

  return `${ancestors}${isLast ? "└─ " : "├─ "}`;
}

function notePrefix(ancestorContinues: readonly boolean[], branchContinues: boolean) {
  return [...ancestorContinues, branchContinues]
    .map((continues) => (continues ? "│  " : "   "))
    .join("");
}

function ToolBranchTree({
  branches,
  ancestorContinues = [],
}: Readonly<{
  branches: readonly ToolBranch[];
  ancestorContinues?: readonly boolean[];
}>) {
  const nested = ancestorContinues.length > 0;

  return (
    <ul className={nested ? "tool-branch-children" : "tool-branch-list"}>
      {branches.map((branch, index) => {
        const isLast = index === branches.length - 1;
        const continues = !isLast;

        return (
          <li className="tool-branch-node" key={`${branch.label}-${index}`}>
            <div className="tool-branch-line">
              <span className="tool-branch-prefix" aria-hidden="true">
                {branchPrefix(ancestorContinues, isLast)}
              </span>
              <span className="tool-branch-label">{branch.label}</span>
            </div>

            {branch.notes?.length ? (
              <ul className="tool-branch-notes" aria-label={`${branch.label} details`}>
                {branch.notes.map((note, noteIndex) => (
                  <li className="tool-branch-note" key={`${branch.label}-note-${noteIndex}`}>
                    <div className="tool-branch-line tool-branch-note-line">
                      <span className="tool-branch-prefix" aria-hidden="true">
                        {notePrefix(ancestorContinues, continues)}
                      </span>
                      <span className="tool-branch-label">{note}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {branch.children?.length ? (
              <ToolBranchTree
                branches={branch.children}
                ancestorContinues={[...ancestorContinues, continues]}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default function ToolsView() {
  const iconByTool: Record<string, LegacyIconName> = {
    AppFlowy: "calendar-week",
    Newsflow: "newspaper",
    Firefox: "browser-firefox",
    VSCodium: "laptop",
    Tuta: "mailbox2",
    SearXNG: "search",
    Provisions: "tools",
  };

  return (
    <main className="page-view page-view--tools" data-page-view="tools" id="view-tools" tabIndex={-1}>
      <div className="container"><h1 className="text-center tools-title">Tools</h1></div>
      <section className="container" aria-labelledby="productivity-title">
        <h2 className="lead text-center tools-subtitle" id="productivity-title">General Productivity Stack</h2>
        <div className="card-columns" id="papershelf">
          {tools.map((tool) => {
            const toolId = `tool-${tool.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            const branches = tool.branches ?? tool.traits.map((label) => ({ label }));
            const icon = <LegacyIcon name={iconByTool[tool.name]} />;

            return (
              <article className="card" id={toolId} key={tool.name}>
                <div className="card-body">
                  <div className="row justify-content-center">
                    {tool.url ? (
                      <a href={tool.url} title={tool.name} className="tool-icon tools-card-accent signal-fuzz" aria-label={`Visit ${tool.name}`}>
                        {icon}
                      </a>
                    ) : (
                      <span className="tool-icon tools-card-accent signal-fuzz" aria-hidden="true">{icon}</span>
                    )}
                  </div>
                  <h3 className="card-title tools-card-title tools-card-accent signal-fuzz row justify-content-center" id={`${toolId}-title`}>{tool.name}</h3>
                  {tool.category ? <p className="text-center"><small>{tool.category}</small></p> : null}
                  <figure
                    className={`tool-manifest${tool.kind === "provisions" ? " tool-manifest--provisions" : ""}`}
                    aria-labelledby={`${toolId}-title`}
                  >
                    {tool.summary ? <figcaption>{tool.summary}</figcaption> : null}
                    <ToolBranchTree branches={branches} />
                  </figure>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="container tools-social" aria-labelledby="social-title">
        <h2 className="lead text-center" id="social-title">Social</h2>
        <div className="row justify-content-center">
          <div className="col-auto">
            {toolsSocial.map((profile) => (
              <a href={profile.url} title={profile.title} aria-label={profile.name} className="social-link social-icon signal-fuzz" key={profile.name}><LegacyIcon name={profile.icon as LegacyIconName} /></a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
