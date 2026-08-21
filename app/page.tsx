import PortfolioShell from "./components/PortfolioShell";
import { normalizePortfolioView } from "./components/portfolioViews";

export default async function IndexPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const view = (await searchParams).view;
  const requestedView = Array.isArray(view) ? view[0] : view;

  return <PortfolioShell initialView={normalizePortfolioView(requestedView) ?? "home"} />;
}
