"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { skillStacks, timeline } from "../data.ts";
import { searchOntology, type SearchHit } from "../search/ontologySearch.ts";
import { projects } from "./projects.js";
import { ResumeProjectCard } from "./ResumeProjects";
import {
  RESUME_SEARCH_CLASS_ORDER,
  resumeSearchIndex,
} from "./resumeSearchOntology.ts";
import { SkillStackCard } from "./SkillStacks";

type Surface =
  | "canonical"
  | "search-pre-in"
  | "search-results-in"
  | "search-in"
  | "search"
  | "search-pre-out"
  | "search-canonical-out"
  | "search-reopen"
  | "search-out";
type ResultPhase = "stable" | "outgoing" | "incoming";

const FROST_DURATION_MS = 500;
const RESULT_DURATION_MS = 180;

type ExitSearchOptions = Readonly<{
  destination?: URL;
  afterRestore?: () => void;
}>;

type FollowResult = (event: MouseEvent<HTMLAnchorElement>, href: string) => void;

const PROJECT_BY_SEARCH_ID: ReadonlyMap<string, (typeof projects)[number]> = new Map(
  projects.map((project) => [`resume-project-${project.id}`, project]),
);
const SKILL_BY_SEARCH_ID: ReadonlyMap<string, (typeof skillStacks)[number]> = new Map(
  skillStacks.map((stack) => [`resume-skill-${stack.id}`, stack]),
);
const TIMELINE_BY_SEARCH_ID: ReadonlyMap<string, (typeof timeline)[number]> = new Map(
  timeline.map((entry) => [`resume-timeline-${entry.id}`, entry]),
);

function ResumeSearchResultCard({
  hit,
  followResult,
  followLatticeResult,
}: {
  hit: SearchHit;
  followResult: FollowResult;
  followLatticeResult: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { record } = hit;
  const project = PROJECT_BY_SEARCH_ID.get(record.id);
  if (project) {
    return (
      <ResumeProjectCard
        project={project}
        headingPrefix="resume-search-project"
        disclosureId={`resume-search-${project.id}`}
        onLatticeLaunch={project.id === "lattice" ? followLatticeResult : undefined}
        onNavigate={followResult}
      />
    );
  }

  const stack = SKILL_BY_SEARCH_ID.get(record.id);
  if (stack) return <SkillStackCard stack={stack} idPrefix="resume-search-skill-stack" />;

  const entry = TIMELINE_BY_SEARCH_ID.get(record.id);
  const headingId = `resume-search-card-${record.id}`;
  return (
    <article className="card resume-search-record-card" aria-labelledby={headingId}>
      <div className="card-body">
        <h3 className="card-title tools-card-title row justify-content-center" id={headingId}>
          <a className="signal-fuzz" href={record.href} onClick={(event) => followResult(event, record.href)}>
            {record.title}
          </a>
        </h3>
        {record.summary ? <p className="text-center resume-search-record-date"><small>{record.summary}</small></p> : null}
        {record.subtitle ? <p className="text-center">{record.subtitle}</p> : null}
        {entry?.details.length ? (
          <p><small>{entry.details.map((detail) => <span key={detail}>{detail}<br /></span>)}</small></p>
        ) : null}
      </div>
    </article>
  );
}

function motionDuration(milliseconds: number) {
  return [
    "(prefers-reduced-motion: reduce)",
    "(prefers-reduced-transparency: reduce)",
    "(forced-colors: active)",
  ].some((query) => window.matchMedia(query).matches) ? 0 : milliseconds;
}

function canonicalRoutePath(pathname: string) {
  const withoutIndex = pathname.replace(/index\.html$/u, "").replace(/\/$/u, "");
  return `${withoutIndex}/`;
}

function setTimer(target: { current: number | null }, callback: () => void, milliseconds: number) {
  if (target.current !== null) window.clearTimeout(target.current);
  target.current = window.setTimeout(() => {
    target.current = null;
    callback();
  }, motionDuration(milliseconds));
}

function cancelFrame(target: { current: number | null }) {
  if (target.current === null) return;
  window.cancelAnimationFrame(target.current);
  target.current = null;
}

export default function ResumeSearch({ children }: { children: ReactNode }) {
  const [surface, setSurface] = useState<Surface>("canonical");
  const [query, setQuery] = useState("");
  const [displayedQuery, setDisplayedQuery] = useState("");
  const [hits, setHits] = useState<readonly SearchHit[]>([]);
  const [resultPhase, setResultPhase] = useState<ResultPhase>("stable");
  const [searching, setSearching] = useState(false);
  const [failure, setFailure] = useState("");
  const surfaceTimer = useRef<number | null>(null);
  const surfaceFrame = useRef<number | null>(null);
  const resultTimer = useRef<number | null>(null);
  const requestSequence = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const surfaceRef = useRef<Surface>(surface);
  const suppressFocusActivation = useRef(false);

  const changeSurface = useCallback((nextSurface: Surface) => {
    // Transition callbacks and input events can land before React commits the
    // preceding state. Keep the imperative state machine current immediately
    // so a quick close/reopen always reverses the transition that is actually
    // running rather than the last rendered one.
    surfaceRef.current = nextSurface;
    setSurface(nextSurface);
  }, []);

  const active = surface !== "canonical";
  const resultsVisible = surface !== "canonical";
  const canonicalInert = surface !== "canonical";
  const resultsInert = surface !== "search" || resultPhase !== "stable";
  const canonicalFrosted = ["search-in", "search", "search-pre-out", "search-reopen"].includes(surface);
  const canonicalDormant = surface === "search";
  const resultsFrosted = surface === "search-pre-in"
    || surface === "search-out"
    || resultPhase === "outgoing";
  const canonicalOverlay = ["search-in", "search", "search-pre-out", "search-canonical-out", "search-reopen"].includes(surface);
  const resultsOverlay = ["search-pre-in", "search-results-in", "search-out"].includes(surface);
  const closing = ["search-pre-out", "search-canonical-out", "search-out"].includes(surface);
  const closeVisible = active && surface !== "search-out";
  const closeInteractive = active && !closing;

  const activate = useCallback(() => {
    if (suppressFocusActivation.current) return;
    const startingSurface = surfaceRef.current;
    if (!["canonical", "search-pre-out", "search-canonical-out", "search-out"].includes(startingSurface)) return;
    if (surfaceTimer.current !== null) {
      window.clearTimeout(surfaceTimer.current);
      surfaceTimer.current = null;
    }
    cancelFrame(surfaceFrame);

    if (motionDuration(FROST_DURATION_MS) === 0) {
      changeSurface("search");
      return;
    }

    if (startingSurface === "search-pre-out") {
      changeSurface("search");
      return;
    }
    if (startingSurface === "search-canonical-out") {
      changeSurface("search-reopen");
      setTimer(surfaceTimer, () => changeSurface("search"), FROST_DURATION_MS);
      return;
    }

    const frostCanonical = () => {
      changeSurface("search-in");
      setTimer(surfaceTimer, () => changeSurface("search"), FROST_DURATION_MS);
    };

    if (startingSurface === "search-out") {
      // Reverse the outgoing result fog from its computed value, then restore
      // the canonical frost only after the result surface is fully visible.
      changeSurface("search-results-in");
      setTimer(surfaceTimer, frostCanonical, FROST_DURATION_MS);
      return;
    }

    // Match Shelf's choreography in two real, painted stages: reveal Search
    // through the five-pixel fog, then frost the Resume beneath it.
    changeSurface("search-pre-in");
    surfaceFrame.current = window.requestAnimationFrame(() => {
      surfaceFrame.current = null;
      changeSurface("search-results-in");
      setTimer(surfaceTimer, frostCanonical, FROST_DURATION_MS);
    });
  }, [changeSurface]);

  const focusSearchInputWithoutOpening = useCallback(() => {
    // Focus events fire synchronously when focus() moves the active element.
    // Suppress only that restoration event so closing Search can return focus
    // to its control without immediately opening Search again.
    suppressFocusActivation.current = true;
    try {
      inputRef.current?.focus({ preventScroll: true });
    } finally {
      suppressFocusActivation.current = false;
    }
  }, []);

  const exitSearch = useCallback((options: ExitSearchOptions = {}) => {
    const startingSurface = surfaceRef.current;
    if (startingSurface === "canonical") return;
    if (["search-pre-out", "search-canonical-out", "search-out"].includes(startingSurface)) return;
    requestSequence.current += 1;
    setSearching(false);
    setFailure("");
    setResultPhase("stable");
    // The input is outside both animated surfaces. Move focus there before the
    // results become inert, then move it to a destination after restoration.
    focusSearchInputWithoutOpening();
    if (surfaceTimer.current !== null) {
      window.clearTimeout(surfaceTimer.current);
      surfaceTimer.current = null;
    }
    cancelFrame(surfaceFrame);

    const finish = () => {
      setDisplayedQuery("");
      setHits([]);
      setQuery("");
      setResultPhase("stable");
      changeSurface("canonical");
      if (!options.destination && !options.afterRestore) {
        focusSearchInputWithoutOpening();
        return;
      }
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (options.afterRestore) {
          options.afterRestore();
          return;
        }
        const destination = options.destination;
        if (!destination) return;
        window.history.pushState(null, "", `${destination.pathname}${destination.search}${destination.hash}`);
        const target = document.getElementById(decodeURIComponent(destination.hash.slice(1)));
        if (!target) return;
        if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "start" });
      }));
    };

    if (motionDuration(FROST_DURATION_MS) === 0) {
      finish();
      return;
    }
    if (startingSurface === "search-pre-in") {
      changeSurface("search-out");
      surfaceFrame.current = window.requestAnimationFrame(() => {
        surfaceFrame.current = null;
        finish();
      });
      return;
    }
    if (startingSurface === "search-results-in") {
      changeSurface("search-out");
      setTimer(surfaceTimer, finish, FROST_DURATION_MS);
      return;
    }
    // Exact reverse: restore the Resume through its five-pixel frost first,
    // then fog Search away. Flow ownership changes only while the opaque
    // Search surface masks it, so neither document can extend the other's
    // stable scroll height.
    changeSurface("search-pre-out");
    surfaceFrame.current = window.requestAnimationFrame(() => {
      surfaceFrame.current = null;
      changeSurface("search-canonical-out");
      setTimer(surfaceTimer, () => {
        changeSurface("search-out");
        setTimer(surfaceTimer, finish, FROST_DURATION_MS);
      }, FROST_DURATION_MS);
    });
  }, [changeSurface, focusSearchInputWithoutOpening]);

  const closeSearch = useCallback(() => exitSearch(), [exitSearch]);

  const followResult = useCallback((event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return;
    const destination = new URL(href, window.location.href);
    const currentPath = canonicalRoutePath(window.location.pathname);
    const destinationPath = canonicalRoutePath(destination.pathname);
    if (!destination.hash || currentPath !== destinationPath) return;
    event.preventDefault();
    exitSearch({ destination });
  }, [exitSearch]);

  const followLatticeResult = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return;
    event.preventDefault();
    exitSearch({
      afterRestore: () => document.querySelector<HTMLAnchorElement>(
        '.resume-search-canonical [data-lattice-launch="text-to-lattice"]',
      )?.click(),
    });
  }, [exitSearch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape"
        && !event.defaultPrevented
        && active
        && !document.body.classList.contains("resume-modal-open")
      ) {
        event.preventDefault();
        closeSearch();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, closeSearch]);

  useEffect(() => () => {
    if (surfaceTimer.current !== null) window.clearTimeout(surfaceTimer.current);
    if (resultTimer.current !== null) window.clearTimeout(resultTimer.current);
    cancelFrame(surfaceFrame);
  }, []);

  useEffect(() => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    if (!query.trim() || query === displayedQuery) return;
    const delay = displayedQuery ? RESULT_DURATION_MS : 0;
    setTimer(resultTimer, () => {
      window.queueMicrotask(() => {
        if (sequence !== requestSequence.current) return;
        try {
          const nextHits = searchOntology(resumeSearchIndex, query);
          if (sequence !== requestSequence.current) return;
          setHits(nextHits);
          setDisplayedQuery(query);
          setSearching(false);
          setResultPhase("incoming");
          setTimer(resultTimer, () => setResultPhase("stable"), RESULT_DURATION_MS);
        } catch {
          if (sequence !== requestSequence.current) return;
          setHits([]);
          setDisplayedQuery(query);
          setSearching(false);
          setFailure("Search could not complete. Shorten the query and try again.");
          setResultPhase("incoming");
          setTimer(resultTimer, () => setResultPhase("stable"), RESULT_DURATION_MS);
        }
      });
    }, delay);
  }, [displayedQuery, query]);

  const updateQuery = (nextQuery: string) => {
    requestSequence.current += 1;
    if (resultTimer.current !== null) {
      window.clearTimeout(resultTimer.current);
      resultTimer.current = null;
    }
    setQuery(nextQuery);
    setFailure("");
    if (!nextQuery.trim()) {
      setSearching(false);
      setDisplayedQuery("");
      setHits([]);
      setResultPhase("stable");
      return;
    }
    if (nextQuery === displayedQuery) {
      setSearching(false);
      setResultPhase("stable");
      return;
    }
    setSearching(true);
    if (displayedQuery) setResultPhase("outgoing");
  };

  const groupedHits = new Map(RESUME_SEARCH_CLASS_ORDER.map((recordClass) => [
    recordClass,
    hits.filter(({ record }) => record.class === recordClass),
  ]));
  const status = failure
    || (!searching && displayedQuery && hits.length === 0
      ? `No Resume records match “${displayedQuery}”.`
      : "");

  return (
    <>
      <section className="container resume-search" aria-label="Search Resume">
        <div className="resume-search-controls">
          <label className="resume-search-label" htmlFor="resume-search-input">Search Resume</label>
          <input
            ref={inputRef}
            type="search"
            className="form-control shelf-search-entry resume-search-input px-2"
            id="resume-search-input"
            placeholder="Search"
            value={query}
            aria-controls="resume-search-results"
            aria-busy={searching}
            autoComplete="off"
            spellCheck="false"
            onPointerDown={activate}
            onFocus={activate}
            onChange={(event) => {
              updateQuery(event.target.value);
              activate();
            }}
          />
          <button
            type="button"
            className={`button-reset resume-search-close signal-fuzz${closeVisible ? "" : " resume-search-close--hidden"}`}
            aria-label="Close Resume search"
            aria-hidden={closeVisible ? undefined : "true"}
            disabled={!closeInteractive}
            tabIndex={closeInteractive ? 0 : -1}
            onClick={closeSearch}
          >
            Close
          </button>
        </div>
      </section>

      <div className={`resume-search-stage${canonicalOverlay ? " resume-search-stage--clip-canonical" : ""}`}>
        <div
          className={`resume-search-surface resume-search-canonical${canonicalFrosted ? " resume-search-surface--frosted" : ""}${canonicalOverlay ? " resume-search-surface--overlay" : ""}${canonicalDormant ? " resume-search-surface--dormant" : ""}`}
          inert={canonicalInert ? true : undefined}
          aria-hidden={canonicalInert ? "true" : undefined}
        >
          {children}
        </div>

        <section
          className={`container resume-search-surface resume-search-results${resultsFrosted ? " resume-search-surface--frosted" : ""}${resultsOverlay ? " resume-search-surface--overlay" : ""}${resultPhase !== "stable" ? " resume-search-results--replacing" : ""}`}
          id="resume-search-results"
          aria-label="Resume search results"
          aria-busy={searching}
          hidden={!resultsVisible}
          inert={resultsInert ? true : undefined}
          aria-hidden={resultsInert ? "true" : undefined}
        >
          {status ? <p className="resume-search-status" role="status">{status}</p> : null}
          {!failure && displayedQuery ? RESUME_SEARCH_CLASS_ORDER.map((recordClass) => {
            const classHits = groupedHits.get(recordClass) ?? [];
            if (!classHits.length) return null;
            return (
              <section className="resume-search-group" aria-labelledby={`resume-search-${recordClass.toLocaleLowerCase("en-US")}`} key={recordClass}>
                <h2 className="text-center" id={`resume-search-${recordClass.toLocaleLowerCase("en-US")}`}>{recordClass}</h2>
                <div className={recordClass === "Skills" ? "skill-stack-grid" : "folio-card-grid"}>
                  {classHits.map((hit) => (
                    <ResumeSearchResultCard
                      hit={hit}
                      followResult={followResult}
                      followLatticeResult={followLatticeResult}
                      key={hit.record.id}
                    />
                  ))}
                </div>
              </section>
            );
          }) : null}
        </section>
      </div>
    </>
  );
}
