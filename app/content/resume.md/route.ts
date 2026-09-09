import { renderResumeMarkdown } from "../../semantic/portfolio.js";
import { textArtifact } from "../../semantic/response.js";

export function GET() { return textArtifact(renderResumeMarkdown(), "text/markdown"); }
