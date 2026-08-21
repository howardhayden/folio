import Link from "next/link";
import { SiteHeader } from "./components/SiteChrome";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="container mt-5 page-view page-view--not-found" data-page-view="not-found">
        <h1>Page Not Found</h1>
        <p>The address may be outdated, or the page may never have existed.</p>
        <Link className="signal-fuzz" href="/">Return home</Link>
      </main>
    </>
  );
}
