import { SiteHeader } from "../components/SiteChrome";
import { textToLatticeContract } from "../content/textToLatticeContent.js";
import { projectBySlug } from "../resume/projects.js";
import { JsonLd } from "../semantic/JsonLd";
import { semanticMetadata } from "../semantic/metadata";
import { jsonLdForPage } from "../semantic/portfolio.js";

export const metadata = semanticMetadata(
  "Third-party notices",
  "Source, model, runtime, attribution, and license records for hah.dev and Text to Lattice.",
  "/third-party-notices/",
);

const documents = [
  {
    name: "Required notice",
    url: "/NOTICE",
    format: "text/plain",
    description: "The site notice, including required Text to Lattice attribution.",
  },
  {
    name: "Third-party notices",
    url: "/THIRD_PARTY_NOTICES.md",
    format: "text/markdown",
    description: "Pinned component versions, revisions, upstream sources, terms, and the binary-asset provenance boundary.",
  },
  {
    name: "Third-party license index",
    url: "/THIRD_PARTY_LICENSES.txt",
    format: "text/plain",
    description: "A concise index of the license texts supplied with this site.",
  },
] as const;

const licenseDocuments = [
  ["Apache License 2.0", "/LICENSES/Apache-2.0.txt"],
  ["MIT License for React and React DOM", "/LICENSES/MIT-React.txt"],
  ["MIT License for Vinext", "/LICENSES/MIT-vinext.txt"],
  ["MIT License for Bootstrap", "/LICENSES/MIT-Bootstrap.txt"],
  ["MIT License for loglevel", "/LICENSES/MIT-loglevel.txt"],
  ["Llama 3.2 Community License", "/LICENSES/Llama-3.2-Community-License.txt"],
  ["Llama 3.2 Acceptable Use Policy", "/LICENSES/Llama-3.2-Acceptable-Use-Policy.md"],
  ["PolyForm Noncommercial 1.0.0", "/LICENSES/PolyForm-Noncommercial-1.0.0.txt"],
  ["Hayden portfolio-content terms", "/LICENSES/LicenseRef-Hayden-Portfolio-Content.txt"],
] as const;

export default function ThirdPartyNoticesPage() {
  const { generator, verifier, runtime } = textToLatticeContract.implementation;
  const latticeProject = projectBySlug("lattice");
  const interactiveRelease = latticeProject && "interactiveRelease" in latticeProject
    ? latticeProject.interactiveRelease
    : "not-applicable";
  return (
    <>
      <JsonLd value={jsonLdForPage("/third-party-notices/")} />
      <SiteHeader />
      <main className="container mt-4 page-view semantic-page" data-page-view="third-party-notices">
        <article>
          <h1>Third-party notices</h1>
          <p className="lead">Source, model, runtime, attribution, and license records for hah.dev and Text to Lattice.</p>

          <h2>Text to Lattice implementation</h2>
          <dl className="paper-meta">
            <div className="paper-meta-item"><dt>Generator</dt><dd><a href={generator.repository}>{generator.name}</a>, revision {generator.revision}; {generator.inferenceSummary}</dd></div>
            <div className="paper-meta-item"><dt>Verifier</dt><dd><a href={verifier.repository}>{verifier.name}</a>, revision {verifier.revision}; deterministic decoding with fixed seed {verifier.inference.seed}</dd></div>
            <div className="paper-meta-item"><dt>Runtime</dt><dd><a href={runtime.packageUrl}>{runtime.name} {runtime.version}</a>; {runtime.tokenizerName} {runtime.tokenizerVersion}; <a href={runtime.wasmRepository}>WASM revision {runtime.wasmRevision}</a>. {runtime.wasmLicenseStatus}</dd></div>
          </dl>
          <p>{interactiveRelease === "held"
            ? "The completed client is held outside the public bundle while its release gates remain open. If a later qualified release is enabled, the browser is designed to download pinned model and WebAssembly assets from their public upstream hosts."
            : "When the interactive client is enabled, the browser downloads pinned model and WebAssembly assets from their public upstream hosts."} The models and runtime are third-party materials, not works authored by Hayden Howard.</p>
          <p>Built with Llama. Llama 3.2 is licensed under the <a href={verifier.licenseUrl}>Llama 3.2 Community License</a> and <a href={verifier.acceptableUseUrl}>Acceptable Use Policy</a>, Copyright © Meta Platforms, Inc. All Rights Reserved.</p>

          <h2>Notices and index</h2>
          <ul>
            {documents.map((document) => <li key={document.url}><a href={document.url}>{document.name}</a> — {document.description}</li>)}
          </ul>

          <h2>License texts</h2>
          <ul>
            {licenseDocuments.map(([name, url]) => <li key={url}><a href={url}>{name}</a></li>)}
          </ul>

          <p>Upstream model cards and terms remain controlling. No hah.dev record supersedes a third-party license, acceptable-use policy, attribution, or restriction.</p>
          <p><a href="/projects/lattice/text-to-lattice/">Text to Lattice contract</a>.</p>
        </article>
      </main>
    </>
  );
}
