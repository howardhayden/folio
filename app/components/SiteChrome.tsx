const primaryRoutes = [
  { key: "home", href: "/#home", label: "Home" },
  { key: "resume", href: "/#resume", label: "Resume" },
  { key: "tools", href: "/#tools", label: "Tools" },
  { key: "shelf", href: "/#shelf", label: "Shelf" },
] as const;

export type SiteRouteKey = (typeof primaryRoutes)[number]["key"];

export function SiteHeader({
  current,
  shelfSearch,
}: {
  current?: SiteRouteKey;
  shelfSearch?: React.ReactNode;
}) {
  return (
    <nav className="navbar navbar-expand navbar-light bg-light site-header" aria-label="Primary navigation">
      {/* This is intentionally a same-document hash transition, not a route. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="navbar-brand" href="/#home">HAH</a>
      <div className="collapse navbar-collapse site-navigation" id="navbarNav">
        <ul className="navbar-nav">
          {primaryRoutes.map((route) => (
            <li className="nav-item" key={route.key}>
              <a
                className="nav-link"
                href={route.href}
                aria-current={current === route.key ? "page" : undefined}
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
