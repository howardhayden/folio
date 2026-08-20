import { BranchLead, BranchReturn, SiteHeader } from "./components/SiteChrome";

export default function NotFound() {
  return (
    <>
      <SiteHeader current={null} />
      <main className="container mt-5 site-main site-branch site-branch--not-found" id="main-content" tabIndex={-1}>
        <BranchLead index="404" title="Page Not Found" />
        <p>The address may be outdated, or the page may never have existed.</p>
        <BranchReturn index="404" label="Return home" />
      </main>
    </>
  );
}
