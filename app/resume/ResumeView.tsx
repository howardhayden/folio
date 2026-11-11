import ResumeExperience from "./ResumeExperience";
import ResumeProjects from "./ResumeProjects";
import ResumeSearch from "./ResumeSearch";
import SkillStacks from "./SkillStacks";

export default function ResumeView() {
  return (
    <main className="page-view page-view--resume" data-page-view="resume" id="view-resume" tabIndex={-1}>
      <div className="container"><h1 className="text-center resume-title">Resume</h1></div>
      <ResumeSearch>
        <ResumeProjects />
        <SkillStacks />
        <ResumeExperience />
      </ResumeSearch>
    </main>
  );
}
