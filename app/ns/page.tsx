import { SiteHeader } from "../components/SiteChrome";
import { JsonLd } from "../semantic/JsonLd";
import { semanticMetadata } from "../semantic/metadata";
import { jsonLdForPage, namespaceTerms } from "../semantic/portfolio.js";

export const metadata = semanticMetadata(
  "Semantic vocabulary",
  "Definitions for the hah.dev JSON-LD extension terms.",
  "/ns/",
);

export default function NamespacePage() {
  return (
    <>
      <JsonLd value={jsonLdForPage("/ns/")} />
      <SiteHeader />
      <main className="container mt-4 page-view semantic-page" data-page-view="semantic-vocabulary">
        <h1>hah.dev semantic vocabulary</h1>
        <p className="lead">Public definitions for extension terms used alongside Schema.org in the knowledge graph.</p>
        <dl className="semantic-vocabulary">
          {namespaceTerms.map((term) => (
            <div id={term.id} key={term.id}><dt>{term.label} <small>({term.kind})</small></dt><dd>{term.description}</dd></div>
          ))}
        </dl>
        <p><a href="/requirements/">Project requirements and practice standards</a></p>
      </main>
    </>
  );
}
