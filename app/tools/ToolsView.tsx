import { LegacyIcon, type LegacyIconName } from "../components/LegacyIcon";
import { TerminalBranchTree } from "../components/TerminalBranchTree";
import { tools } from "../data";
import { toolsSocial } from "../content/siteContent.js";

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
                    <a
                      href={tool.url ?? undefined}
                      title={tool.url ? tool.name : undefined}
                      className="tool-icon tools-card-accent signal-fuzz"
                      aria-label={tool.url ? `Visit ${tool.name}` : undefined}
                      aria-hidden={tool.url ? undefined : true}
                    >
                      {icon}
                    </a>
                  </div>
                  <h3 className="card-title tools-card-title tools-card-accent signal-fuzz row justify-content-center" id={`${toolId}-title`}>{tool.name}</h3>
                  {tool.category ? <p className="text-center"><small>{tool.category}</small></p> : null}
                  <figure
                    className={`tool-manifest${tool.kind === "provisions" ? " tool-manifest--provisions" : ""}`}
                    aria-labelledby={`${toolId}-title`}
                  >
                    {tool.summary ? <figcaption>{tool.summary}</figcaption> : null}
                    <TerminalBranchTree branches={branches} />
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
