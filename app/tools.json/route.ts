import { toolsManifest } from "../semantic/portfolio.js";
import { jsonArtifact } from "../semantic/response.js";

export function GET() { return jsonArtifact(toolsManifest); }
