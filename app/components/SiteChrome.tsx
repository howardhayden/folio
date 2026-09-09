import type { MouseEvent, ReactNode } from "react";

const primaryRoutes = [
  { key: "home", href: "/", label: "Home" },
  { key: "resume", href: "/resume/", label: "Resume" },
  { key: "tools", href: "/tools/", label: "Tools" },
  { key: "shelf", href: "/shelf/", label: "Shelf" },
] as const;

export type SiteRouteKey = (typeof primaryRoutes)[number]["key"];

export function SiteHeader({
  current,
  shelfSearch,
  onNavigate,
}: {
  current?: SiteRouteKey;
  shelfSearch?: ReactNode;
  onNavigate?: (route: SiteRouteKey, event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <nav className="navbar navbar-expand navbar-light bg-light site-header" aria-label="Primary navigation">
      <a className="navbar-brand" href="/" onClick={onNavigate ? (event) => onNavigate("home", event) : undefined}>HAH</a>
      <div className="collapse navbar-collapse site-navigation" id="navbarNav">
        <ul className="navbar-nav">
          {primaryRoutes.map((route) => (
            <li className="nav-item" key={route.key}>
              <a
                className="nav-link"
                href={route.href}
                aria-current={current === route.key ? "page" : undefined}
                onClick={onNavigate ? (event) => onNavigate(route.key, event) : undefined}
              >
                <span className="signal-fuzz signal-fuzz--nav">
                  {route.label}
                </span>
              </a>
            </li>
          ))}
          {shelfSearch}
        </ul>
      </div>
    </nav>
  );
}
