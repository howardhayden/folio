import Link from "next/link";

const primaryRoutes = [
  { key: "home", href: "/", label: "Home" },
  { key: "resume", href: "/resume", label: "Resume" },
  { key: "tools", href: "/tools", label: "Tools" },
  { key: "shelf", href: "/shelf", label: "Shelf" },
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
      <Link className="navbar-brand" href="/">HAH</Link>
      <div className="collapse navbar-collapse site-navigation" id="navbarNav">
        <ul className="navbar-nav">
          {primaryRoutes.map((route) => (
            <li className="nav-item" key={route.key}>
              <Link
                className="nav-link"
                href={route.href}
                aria-current={current === route.key ? "page" : undefined}
              >
                <span className="signal-fuzz signal-fuzz--nav">
                  {route.label}
                </span>
              </Link>
            </li>
          ))}
          {shelfSearch}
        </ul>
      </div>
    </nav>
  );
}
