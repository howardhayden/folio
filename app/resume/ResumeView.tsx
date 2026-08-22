import { LegacyIcon, type LegacyIconName } from "../components/LegacyIcon";
import { skillStacks } from "../data";
import ResumeExperience from "./ResumeExperience";
import ResumeProjects from "./ResumeProjects";

export default function ResumeView() {
  const iconByTitle: Record<string, LegacyIconName> = {
    "Electrostatic Discharge": "lightning-charge",
    "Fabrication and Production": "tools",
    "Documentation, Systems and Software": "map",
    "Frameworks, Runtimes, and Tooling": "laptop",
    "Communications, Business": "stopwatch",
    Programming: "app-indicator",
    Data: "bar-chart-steps",
  };
  const originalOrder = [
    "Electrostatic Discharge",
    "Fabrication and Production",
    "Documentation, Systems and Software",
    "Communications, Business",
    "Programming",
    "Frameworks, Runtimes, and Tooling",
    "Data",
  ];
  const orderedStacks = [...skillStacks].sort((a, b) => originalOrder.indexOf(a.title) - originalOrder.indexOf(b.title));

  return (
    <main className="page-view page-view--resume" data-page-view="resume" id="view-resume" tabIndex={-1}>
      <div className="container"><h1 className="text-center resume-title">Resume</h1></div>
      <ResumeProjects />
      <section className="container" aria-labelledby="skill-stacks-title">
        <h2 className="text-center skill-stack-heading" id="skill-stacks-title">Skill Stacks</h2>
        <div className="card-columns" id="papershelf">
          {orderedStacks.map((stack) => (
            <article className="card" key={stack.title}>
              <div className="card-body">
                <div className="row justify-content-center stack-icon"><LegacyIcon name={iconByTitle[stack.title]} /></div>
                <h5 className="card-title tools-card-title row justify-content-center">{stack.title}</h5>
                {stack.description && (
                  stack.title === "Programming" ? (
                    <p className="card-text">Systems and Software Languages.<br /><small>Emphasis on SOLID principles.</small></p>
                  ) : <p className="card-text">{stack.description}</p>
                )}
                <details className="skill-stack-disclosure">
                  <summary aria-label={`${stack.title} skills`}>Skills</summary>
                  <ul>{stack.items.map((item) => <li key={item}>{item}</li>)}</ul>
                </details>
              </div>
            </article>
          ))}
        </div>
      </section>
      <ResumeExperience />
    </main>
  );
}
