import PortfolioShell from "./components/PortfolioShell";
import { normalizePortfolioView, portfolioViewMetadata, type PortfolioView } from "./components/portfolioViews";
import { JsonLd } from "./semantic/JsonLd";
import { jsonLdForPage } from "./semantic/portfolio.js";
import type { Metadata } from "next";
import { semanticMetadata } from "./semantic/metadata";

const viewPath: Record<PortfolioView, string> = { home: "/", resume: "/resume/", tools: "/tools/", shelf: "/shelf/" };
const viewTitle: Record<PortfolioView, string> = { home: "hah.dev", resume: "Resume", tools: "Tools", shelf: "Shelf" };

function requestedPortfolioView(value: string | string[] | undefined): PortfolioView {
  return normalizePortfolioView(Array.isArray(value) ? value[0] : value) ?? "home";
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }): Promise<Metadata> {
  const view = requestedPortfolioView((await searchParams).view);
  const metadata = semanticMetadata(viewTitle[view], portfolioViewMetadata[view].description, viewPath[view]);
  return view === "home" ? { ...metadata, title: { absolute: "hah.dev" } } : metadata;
}

export default async function IndexPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const view = requestedPortfolioView((await searchParams).view);

  return <><JsonLd value={jsonLdForPage(viewPath[view])} /><PortfolioShell initialView={view} /></>;
}
