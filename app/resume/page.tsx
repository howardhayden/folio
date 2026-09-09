import { SiteHeader } from "../components/SiteChrome";
import { JsonLd } from "../semantic/JsonLd";
import { semanticMetadata } from "../semantic/metadata";
import { jsonLdForPage } from "../semantic/portfolio.js";
import ResumeView from "./ResumeView";

export const metadata = semanticMetadata(
  "Resume",
  "Hayden Howard’s experience, education, projects, and interdisciplinary skill stacks.",
  "/resume/",
);

export default function ResumePage() {
  return <><JsonLd value={jsonLdForPage("/resume/")} /><SiteHeader current="resume" /><ResumeView /></>;
}
