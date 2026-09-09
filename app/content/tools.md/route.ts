import { renderToolsMarkdown } from "../../semantic/portfolio.js";
import { textArtifact } from "../../semantic/response.js";

export function GET() { return textArtifact(renderToolsMarkdown(), "text/markdown"); }
