import { renderProjectMarkdown } from "../../../semantic/portfolio.js";
import { textArtifact } from "../../../semantic/response.js";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const file = (await params).file;
  if (!file.endsWith(".md")) return new Response("Not Found\n", { status: 404 });
  const markdown = renderProjectMarkdown(file.slice(0, -3));
  return markdown === null ? new Response("Not Found\n", { status: 404 }) : textArtifact(markdown, "text/markdown");
}
