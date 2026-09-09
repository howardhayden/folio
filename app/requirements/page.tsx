import { SiteHeader } from "../components/SiteChrome";
import { practiceStandards, sharedRequirements } from "../content/siteContent.js";
import { JsonLd } from "../semantic/JsonLd";
import { semanticMetadata } from "../semantic/metadata";
import { jsonLdForPage } from "../semantic/portfolio.js";

export const metadata = semanticMetadata(
  "Requirements",
  "Shared public project requirements and practice standards.",
  "/requirements/",
);

export default function RequirementsPage() {
  return (
    <>
      <JsonLd value={jsonLdForPage("/requirements/")} />
      <SiteHeader />
      <main className="container mt-4 page-view semantic-page" data-page-view="requirements">
        <h1>Requirements and practice standards</h1>
        <p className="lead">Stable definitions inherited by hah.dev project records.</p>
        <section aria-labelledby="shared-requirements-title">
          <h2 id="shared-requirements-title">Shared requirements</h2>
          {sharedRequirements.map((item) => <article id={item.id} key={item.id}><h3>{item.label}</h3><p>{item.description}</p></article>)}
        </section>
        <section aria-labelledby="practice-standards-title">
          <h2 id="practice-standards-title">Practice standards</h2>
          {practiceStandards.map((item) => <article id={item.id} key={item.id}><h3>{item.label}</h3><p>{item.description}</p></article>)}
        </section>
        <p><a href="/ns/">hah.dev semantic vocabulary</a></p>
      </main>
    </>
  );
}
