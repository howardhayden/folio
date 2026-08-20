import type { Metadata } from "next";
import { BranchLead, BranchReturn, SiteHeader } from "../components/SiteChrome";
import { LegacyIcon, type LegacyIconName } from "../components/LegacyIcon";
import { skillStacks } from "../data";
import ResumeExperience from "./ResumeExperience";
import ResumeProjects from "./ResumeProjects";

export const metadata: Metadata = {
  title: "Resume",
  description: "Hayden Howard’s experience, education, and interdisciplinary skill stacks.",
};

export default function ResumePage() {
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
    <>
      <SiteHeader current="resume" />
      <main className="site-main site-branch site-branch--resume" id="main-content" tabIndex={-1}>
        <div className="container">
          <BranchLead
            current="resume"
            title="Resume"
            description="Hayden Howard’s experience, education, projects, and interdisciplinary skill stacks."
          />
        </div>
        <div className="container">
          <h2 className="text-center skill-stack-heading">Skill Stacks</h2>
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
                  <ul>{stack.items.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </article>
            ))}
          </div>
        </div>
        <ResumeProjects />
        <ResumeExperience />
        <div className="container"><BranchReturn current="resume" /></div>
      </main>
    </>
  );
}
