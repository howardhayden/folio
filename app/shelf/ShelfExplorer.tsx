"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "../components/SiteChrome";
import type { Paper } from "../data";

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

const shuffle = <T,>(items: T[]) => {
  const shuffled = [...items];
  for (let currentIndex = shuffled.length; currentIndex > 0;) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
  }
  return shuffled;
};

export default function ShelfExplorer({ papers }: { papers: Paper[] }) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState("");
  const [publisher, setPublisher] = useState("");
  const [author, setAuthor] = useState("");
  const [collection, setCollection] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const menuRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setHydrated(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

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

  const filtered = useMemo(() => {
    const includes = (values: string[], needle: string) => !needle || values.join(", ").toLowerCase().includes(needle.toLowerCase());
    const matches = papers.filter((paper) => includes(paper.languages, language) && includes(paper.publishers, publisher) && includes(paper.authors, author) && includes(paper.collections, collection));
    return hydrated ? shuffle(matches) : matches;
  }, [author, collection, hydrated, language, papers, publisher]);

  const searchItem = (
    <li className={`nav-item dropdown ${open ? "show" : ""}`} ref={menuRef}>
      <button type="button" className="nav-btn nav-link dropdown-toggle" id="navbarDropdown" aria-haspopup="true" aria-expanded={open} onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}>
        Search
      </button>
      <div className={`dropdown-menu dropdown-menu-right ${open ? "show" : ""}`} aria-labelledby="navbarDropdown">
        <form onSubmit={(event) => event.preventDefault()}>
          <SearchField id="languageInput" label="Language" placeholder=" Search Language" value={language} onChange={setLanguage} />
          <SearchField id="publisherInput" label="Search Publisher" placeholder=" Search Publisher" value={publisher} onChange={setPublisher} />
          <SearchField id="authorInput" label="Search Author" placeholder=" Search Author" value={author} onChange={setAuthor} />
          <SearchField id="collectionInput" label="Search Collection" placeholder=" Search Collection" value={collection} onChange={setCollection} />
        </form>
      </div>
    </li>
  );

  return (
    <>
      <noscript dangerouslySetInnerHTML={{ __html: "<style>.nav-btn#navbarDropdown{display:none}</style>" }} />
      <SiteHeader shelfSearch={searchItem} />
      <main className={open ? "container mt-4 shelf-page shelf-page-is-blurred" : "container mt-4 shelf-page"}>
        <div className="row">
          <aside className="col-lg-3 shelf-intro">
            <h1 className="text-center">Shelf</h1>
            <p>The following materials contain insightful value per their associated collections. They do not reflect my views or those of any employers or associated organizations.</p>
          </aside>
          <section className="col-lg-9" aria-label={`${filtered.length} shelf results`}>
            <div id="papershelf" className="card-columns">
              {filtered.map((paper) => (
                <article className="card" key={paper.title}>
                  <div className="card-body">
                    <h5 className="card-title">{paper.title}</h5>
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
      <input type="text" className="form-control px-0 px-sm-2" id={id} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="paper-meta-item"><dt>{label}</dt><dd>{value}</dd></div>;
}
