export const portfolioViewKeys = ["home", "resume", "tools", "shelf"] as const;

export type PortfolioView = (typeof portfolioViewKeys)[number];

export const portfolioViewMetadata: Record<PortfolioView, { title: string; description: string }> = {
  home: {
    title: "hah.dev",
    description: "Hayden Howard develops and operates resilient systems that people can trust under pressure.",
  },
  resume: {
    title: "Resume | hah.dev.",
    description: "Hayden Howard’s experience, education, and interdisciplinary skill stacks.",
  },
  tools: {
    title: "Tools | hah.dev.",
    description: "A considered productivity and technology stack used by Hayden Howard.",
  },
  shelf: {
    title: "Shelf | hah.dev.",
    description: "Hayden Howard’s filterable shelf of books, games, film, and other influential works.",
  },
};

export function normalizePortfolioView(value: unknown): PortfolioView | null {
  return typeof value === "string" && portfolioViewKeys.includes(value as PortfolioView)
    ? value as PortfolioView
    : null;
}

export function portfolioViewFromHash(hash: string): PortfolioView | null {
  return normalizePortfolioView(hash.replace(/^#\/?/, "").split(/[?&]/, 1)[0].toLowerCase());
}
