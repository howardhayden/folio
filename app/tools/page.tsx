import { SiteHeader } from "../components/SiteChrome";
import { JsonLd } from "../semantic/JsonLd";
import { semanticMetadata } from "../semantic/metadata";
import { jsonLdForPage } from "../semantic/portfolio.js";
import ToolsView from "./ToolsView";

export const metadata = semanticMetadata(
  "Tools",
  "A considered productivity and technology stack used by Hayden Howard.",
  "/tools/",
);

export default function ToolsPage() {
  return <><JsonLd value={jsonLdForPage("/tools/")} /><SiteHeader current="tools" /><ToolsView /></>;
}
