import Link from "next/link";
import { SiteHeader } from "./components/SiteChrome";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="container mt-5">
        <h1>Page Not Found</h1>
        <p>The address may be outdated, or the page may never have existed.</p>
        <Link href="/">Return home</Link>
      </main>
    </>
  );
}
