"use client";

import { useEffect, useRef, useState } from "react";
import { SiteHeader, type SiteRouteKey } from "../components/SiteChrome";
import type { Paper } from "../data";
import { arrangeShelfPapers, randomShelfSeed } from "./shelfLogic.js";
import { shelfNotice } from "../content/siteContent.js";

const MONTH_CODES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const formatDate = (value: string) => {
  const sourceDate = value.trim();
  const fullDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sourceDate);
  if (fullDate) {
    const [, year, monthText, dayText] = fullDate;
    const month = Number(monthText);
    const day = Number(dayText);
    const candidate = new Date(Date.UTC(Number(year), month - 1, day));
    const isValid = candidate.getUTCFullYear() === Number(year)
      && candidate.getUTCMonth() === month - 1
      && candidate.getUTCDate() === day;

    return isValid ? `${dayText} ${MONTH_CODES[month - 1]} ${year}` : sourceDate;
  }

  const monthDate = /^(\d{4})-(\d{2})$/.exec(sourceDate);
  if (monthDate) {
    const [, year, monthText] = monthDate;
    const month = Number(monthText);
    return month >= 1 && month <= 12 ? `${MONTH_CODES[month - 1]} ${year}` : sourceDate;
  }

  // Years, eras, ranges, approximate dates, and publication-local times are
  // archival display values. Preserve their stated precision and wording.
  return sourceDate;
};

export default function ShelfExplorer({ papers, onNavigate }: { papers: Paper[]; onNavigate?: (route: SiteRouteKey, event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState({ language: "", publisher: "", author: "", collection: "" });
  const [filtered, setFiltered] = useState(papers);
  const menuRef = useRef<HTMLLIElement>(null);
  const filtersRef = useRef(filters);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFiltered((current) => arrangeShelfPapers(
        papers,
        filtersRef.current,
        randomShelfSeed(),
        current.map((paper) => paper.title),
      ));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [papers]);

  useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      if (open && menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const changeFilter = (field: keyof typeof filters, value: string) => {
    const nextFilters = { ...filtersRef.current, [field]: value };
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    setFiltered((current) => arrangeShelfPapers(
      papers,
      nextFilters,
      randomShelfSeed(),
      current.map((paper) => paper.title),
    ));
  };

  const searchItem = (
    <li className={`nav-item dropdown ${open ? "show" : ""}`} ref={menuRef}>
      <button type="button" className="nav-btn nav-link dropdown-toggle" id="navbarDropdown" aria-haspopup="true" aria-expanded={open} onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}>
        <span className="signal-fuzz signal-fuzz--nav">Search</span>
      </button>
      <div className={`dropdown-menu dropdown-menu-right ${open ? "show" : ""}`} aria-labelledby="navbarDropdown">
        <form onSubmit={(event) => event.preventDefault()}>
          <SearchField id="languageInput" label="Language" placeholder=" Search Language" value={filters.language} onChange={(value) => changeFilter("language", value)} />
          <SearchField id="publisherInput" label="Search Publisher" placeholder=" Search Publisher" value={filters.publisher} onChange={(value) => changeFilter("publisher", value)} />
          <SearchField id="authorInput" label="Search Author" placeholder=" Search Author" value={filters.author} onChange={(value) => changeFilter("author", value)} />
          <SearchField id="collectionInput" label="Search Collection" placeholder=" Search Collection" value={filters.collection} onChange={(value) => changeFilter("collection", value)} />
        </form>
      </div>
    </li>
  );

  return (
    <>
      <noscript dangerouslySetInnerHTML={{ __html: "<style>.nav-btn#navbarDropdown{display:none}</style>" }} />
      <SiteHeader current="shelf" shelfSearch={searchItem} onNavigate={onNavigate} />
      <main
        className={open
          ? "container mt-4 shelf-page page-view page-view--shelf shelf-page-is-blurred"
          : "container mt-4 shelf-page page-view page-view--shelf"}
        data-page-view="shelf"
        id="view-shelf"
        tabIndex={-1}
      >
        <div className="row">
          <aside className="col-lg-3 shelf-intro">
            <h1 className="text-center">Shelf</h1>
            <p>{shelfNotice}</p>
          </aside>
          <section className="col-lg-9" aria-label={`${filtered.length} shelf results`}>
            <div id="papershelf" className="card-columns">
              {filtered.map((paper) => (
                <article className="card" key={paper.title}>
                  <div className="card-body">
                    <h2 className="card-title">{paper.title}</h2>
                    <dl className="paper-meta">
                      <Meta label="Language" value={paper.languages.join(", ")} />
                      <Meta label="Publisher" value={paper.publishers.join(", ")} />
                      <Meta label="Date" value={formatDate(paper.date)} />
                      <Meta label="Author(s)" value={paper.authors.join(", ")} />
                      <Meta label="Collection(s)" value={paper.collections.join(", ")} />
                    </dl>
                  </div>
                </article>
              ))}
            </div>
            {filtered.length === 0 && <p className="text-center shelf-empty" role="status">No materials match all four fields.</p>}
          </section>
        </div>
      </main>
    </>
  );
}

function SearchField({ id, label, placeholder, value, onChange }: { id: string; label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <input type="text" className="form-control shelf-search-entry px-0 px-sm-2" id={id} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="paper-meta-item"><dt>{label}</dt><dd>{value}</dd></div>;
}
