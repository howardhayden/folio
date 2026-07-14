import type { Metadata } from "next";
import { papers } from "../data";
import ShelfExplorer from "./ShelfExplorer";

export const metadata: Metadata = {
  title: "Shelf",
  description: "Hayden Howard’s filterable shelf of books, games, film, and other influential works.",
};

export default function ShelfPage() {
  return <ShelfExplorer papers={papers} />;
}
