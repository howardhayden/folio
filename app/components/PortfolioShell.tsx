"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import ResumeView from "../resume/ResumeView";
import ShelfExplorer from "../shelf/ShelfExplorer";
import ToolsView from "../tools/ToolsView";
import { papers } from "../data";
import HomeView from "./HomeView";
import { SiteHeader, type SiteRouteKey } from "./SiteChrome";
import {
  normalizePortfolioView,
  portfolioViewFromHash,
  portfolioViewMetadata,
  type PortfolioView,
} from "./portfolioViews";

function viewFromLocation(fallback: PortfolioView): PortfolioView {
  const hashView = portfolioViewFromHash(window.location.hash);
  if (hashView) return hashView;

  const queryView = normalizePortfolioView(new URLSearchParams(window.location.search).get("view"));
  return queryView ?? fallback;
}

export default function PortfolioShell({ initialView = "home" }: { initialView?: PortfolioView }) {
  const [activeView, setActiveView] = useState<PortfolioView>(initialView);
  const hasMountedRef = useRef(false);

  const navigateToView = useCallback((route: SiteRouteKey, event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey
    ) return;

    event.preventDefault();
    const nextLocation = `/#${route}`;
    const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentLocation !== nextLocation) window.history.pushState(null, "", nextLocation);
    setActiveView(route);
  }, []);

  useEffect(() => {
    const synchronizeView = () => setActiveView(viewFromLocation(initialView));
    synchronizeView();
    window.addEventListener("hashchange", synchronizeView);
    window.addEventListener("popstate", synchronizeView);

    return () => {
      window.removeEventListener("hashchange", synchronizeView);
      window.removeEventListener("popstate", synchronizeView);
    };
  }, [initialView]);

  useEffect(() => {
    const metadata = portfolioViewMetadata[activeView];
    document.title = metadata.title;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute("content", metadata.description);

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    window.scrollTo(0, 0);
    const focusFrame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`main[data-page-view="${activeView}"]`)
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [activeView]);

  return (
    <div className="portfolio-shell" data-portfolio-shell="true" data-active-view={activeView}>
      {activeView === "shelf" ? (
        <ShelfExplorer papers={papers} onNavigate={navigateToView} />
      ) : (
        <>
          <SiteHeader current={activeView} onNavigate={navigateToView} />
          {activeView === "resume" ? <ResumeView /> : null}
          {activeView === "tools" ? <ToolsView /> : null}
          {activeView === "home" ? <HomeView /> : null}
        </>
      )}
    </div>
  );
}
