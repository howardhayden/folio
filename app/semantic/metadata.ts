import type { Metadata } from "next";
import { absoluteUrl } from "./portfolio.js";

function machineAlternates(pathname: string) {
  const markdown = pathname === "/" ? "/content/about.md"
    : pathname === "/resume/" || pathname.startsWith("/resume/") ? "/content/resume.md"
      : pathname === "/tools/" ? "/content/tools.md"
        : pathname === "/shelf/" ? "/content/shelf.md"
          : pathname === "/projects/" ? "/content/projects.md"
            : pathname.startsWith("/projects/")
              ? `/content/projects/${pathname.split("/").filter(Boolean)[1]}.md`
              : null;
  const manifest = pathname === "/resume/" || pathname.startsWith("/resume/") ? "/resume.json"
    : pathname === "/tools/" ? "/tools.json"
      : pathname === "/shelf/" ? "/shelf.json"
        : pathname.startsWith("/projects/") || pathname === "/projects/" ? "/projects.json"
          : null;
  return {
    ...(markdown ? { "text/markdown": absoluteUrl(markdown) } : {}),
    "application/ld+json": absoluteUrl("/knowledge-graph.jsonld"),
    "text/plain": absoluteUrl("/llms.txt"),
    ...(manifest ? { "application/json": absoluteUrl(manifest) } : {}),
  };
}

export function semanticMetadata(title: string, description: string, pathname: string): Metadata {
  const canonical = absoluteUrl(pathname);
  return {
    title,
    description,
    alternates: { canonical, types: machineAlternates(pathname) },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "hah.dev",
      title: `${title} | hah.dev.`,
      description,
    },
    twitter: {
      card: "summary",
      title: `${title} | hah.dev.`,
      description,
    },
  };
}
