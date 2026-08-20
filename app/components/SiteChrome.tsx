import type { ReactNode } from "react";
import Link from "next/link";

export const SITE_ROUTES = [
  {
    key: "home",
    index: "00",
    href: "/",
    navLabel: "Home",
    branchLabel: "Index",
    description: "Orientation and questions.",
  },
  {
    key: "resume",
    index: "01",
    href: "/resume",
    navLabel: "Resume",
    branchLabel: "Resume",
    description: "Experience, systems, projects, and education.",
  },
  {
    key: "tools",
    index: "02",
    href: "/tools",
    navLabel: "Tools",
    branchLabel: "Tools",
    description: "The working stack behind the practice.",
  },
  {
    key: "shelf",
    index: "03",
    href: "/shelf",
    navLabel: "Shelf",
    branchLabel: "Shelf",
    description: "Books, games, film, and other influences.",
  },
] as const;

export type SiteRouteKey = (typeof SITE_ROUTES)[number]["key"];

type SiteHeaderProps = {
  current: SiteRouteKey | null;
  shelfSearch?: ReactNode;
};

export function SiteHeader({ current, shelfSearch }: SiteHeaderProps) {
  const currentRoute = SITE_ROUTES.find((route) => route.key === current);

  return (
    <>
      <a className="site-skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="site-chrome">
        <nav className="navbar site-nav" aria-label="Primary navigation">
          <Link className="navbar-brand site-wordmark" href="/" aria-label="hah.dev home">
            <span className="site-wordmark-name">HAH</span>
            <span className="site-wordmark-location" aria-hidden="true">
              {currentRoute?.index ?? "--"} / {currentRoute?.branchLabel ?? "Elsewhere"}
            </span>
          </Link>
          <div className="site-nav-map" id="navbarNav">
            <ul className="navbar-nav">
              {SITE_ROUTES.map((route) => {
                const isCurrent = route.key === current;

                return (
                  <li className={`nav-item site-nav-node${isCurrent ? " is-current" : ""}`} key={route.key}>
                    <Link className="nav-link" href={route.href} aria-current={isCurrent ? "page" : undefined}>
                      <span className="site-nav-index" aria-hidden="true">{route.index}</span>
                      <span>{route.navLabel}</span>
                    </Link>
                  </li>
                );
              })}
              {shelfSearch}
            </ul>
          </div>
        </nav>
      </header>
    </>
  );
}

export function BranchLead({
  current,
  index,
  title,
  description,
}: {
  current?: SiteRouteKey;
  index?: string;
  title: string;
  description?: string;
}) {
  const route = SITE_ROUTES.find((candidate) => candidate.key === current);
  const branchIndex = index ?? route?.index ?? "--";
  const branchLabel = route?.branchLabel ?? title;

  return (
    <header className="branch-lead">
      <span className="branch-lead-index" aria-hidden="true">{branchIndex}</span>
      <div className="branch-lead-copy">
        <p className="branch-path">
          <Link href="/">hah.dev</Link>
          <span aria-hidden="true"> / </span>
          <span>{branchLabel}</span>
        </p>
        <h1>{title}</h1>
        {description ? <p className="branch-description">{description}</p> : null}
      </div>
    </header>
  );
}

export function BranchReturn({
  current,
  index,
  label,
}: {
  current?: SiteRouteKey;
  index?: string;
  label?: string;
}) {
  const route = SITE_ROUTES.find((candidate) => candidate.key === current);
  const branchIndex = index ?? route?.index ?? "--";

  return (
    <footer className="branch-return">
      <span className="branch-return-marker" aria-hidden="true">{branchIndex}</span>
      <Link href="/">
        <span aria-hidden="true">00 / </span>{label ?? "Return to index"}
      </Link>
    </footer>
  );
}
