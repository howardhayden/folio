import Link from "next/link";

export function SiteHeader({ shelfSearch }: { shelfSearch?: React.ReactNode }) {
  return (
    <nav className="navbar navbar-expand navbar-light bg-light" aria-label="Primary navigation">
      <a className="navbar-brand" href="#">HAH</a>
      <div className="collapse navbar-collapse" id="navbarNav">
        <ul className="navbar-nav">
          <li className="nav-item"><Link className="nav-link" href="/">Home</Link></li>
          <li className="nav-item"><Link className="nav-link" href="/resume">Resume</Link></li>
          <li className="nav-item"><Link className="nav-link" href="/tools">Tools</Link></li>
          <li className="nav-item"><Link className="nav-link" href="/shelf">Shelf</Link></li>
          {shelfSearch}
        </ul>
      </div>
    </nav>
  );
}
