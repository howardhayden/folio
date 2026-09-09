import { papers } from "../data";
import { JsonLd } from "../semantic/JsonLd";
import { semanticMetadata } from "../semantic/metadata";
import { jsonLdForPage } from "../semantic/portfolio.js";
import ShelfExplorer from "./ShelfExplorer";

export const metadata = semanticMetadata(
  "Shelf",
  "Hayden Howard’s filterable shelf of books, games, film, and other influential works.",
  "/shelf/",
);

export default function ShelfPage() {
  return <><JsonLd value={jsonLdForPage("/shelf/")} /><ShelfExplorer papers={papers} /></>;
}
