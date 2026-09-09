import { LegacyIcon, type LegacyIconName } from "../components/LegacyIcon";
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
  };

  return (
    <main className="page-view page-view--tools" data-page-view="tools" id="view-tools" tabIndex={-1}>
      <div className="container"><h1 className="text-center tools-title">Tools</h1></div>
      <section className="container" aria-labelledby="productivity-title">
        <h2 className="lead text-center tools-subtitle" id="productivity-title">General Productivity Stack</h2>
        <div className="card-columns" id="papershelf">
          {tools.map((tool) => (
            <article className="card" key={tool.name}>
              <div className="card-body">
                <div className="row justify-content-center">
                  <a href={tool.url} title={tool.name} className="tool-icon signal-fuzz" aria-label={`Visit ${tool.name}`}><LegacyIcon name={iconByTool[tool.name]} /></a>
                </div>
                <h3 className="card-title tools-card-title row justify-content-center">{tool.name}</h3>
                <p className="text-center"><small>{tool.category}</small></p>
                <p className="card-text">{tool.summary}</p>
                <ul>{tool.traits.map((trait) => <li key={trait}>{trait}</li>)}</ul>
              </div>
            </article>
          ))}
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
