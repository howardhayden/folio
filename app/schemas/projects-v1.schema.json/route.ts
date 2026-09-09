import { projectsSchemaV1 } from "../../semantic/portfolio.js";
import { jsonArtifact } from "../../semantic/response.js";

export function GET() { return jsonArtifact(projectsSchemaV1, "application/schema+json"); }
