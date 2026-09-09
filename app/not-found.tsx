import { SiteHeader } from "./components/SiteChrome";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="container mt-5 page-view page-view--not-found" data-page-view="not-found">
        <h1>Page Not Found</h1>
        <p>The address may be outdated, or the page may never have existed.</p>
        <a className="signal-fuzz" href="/">Return home</a>
      </main>
    </>
  );
}
