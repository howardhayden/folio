import { projectsManifest } from "../semantic/portfolio.js";
import { jsonArtifact } from "../semantic/response.js";

export function GET() { return jsonArtifact(projectsManifest); }
