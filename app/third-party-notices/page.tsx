import { SiteHeader } from "../components/SiteChrome";
import { textToLatticeContract } from "../content/textToLatticeContent.js";
import { projectBySlug } from "../resume/projects.js";
import { JsonLd } from "../semantic/JsonLd";
import { semanticMetadata } from "../semantic/metadata";
import { jsonLdForPage } from "../semantic/portfolio.js";

export const metadata = semanticMetadata(
  "Legal and third-party notices",
  "Current Owner terms, historical license records, and third-party attribution for hah.dev and Text to Lattice.",
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
    description: "Active provider details, upstream sources and terms, plus clearly separated historical binary-asset provenance.",
  },
  {
    name: "Third-party license index",
    url: "/THIRD_PARTY_LICENSES.txt",
    format: "text/plain",
    description: "A concise index of the license texts supplied with this site.",
  },
] as const;

const ownerTermsDocuments = [
  ["Hayden proprietary product and source terms", "/LICENSES/LicenseRef-Hayden-Proprietary-1.1.txt"],
  ["Hayden portfolio-content terms", "/LICENSES/LicenseRef-Hayden-Portfolio-Content.txt"],
] as const;

const historicalOwnerLicenseDocuments = [
  ["Hayden Proprietary Product and Source License 1.0 — historical", "/LICENSES/HISTORICAL/LicenseRef-Hayden-Proprietary-1.0.txt"],
  ["PolyForm Noncommercial 1.0.0 — historical", "/LICENSES/HISTORICAL/PolyForm-Noncommercial-1.0.0.txt"],
] as const;

const thirdPartyLicenseDocuments = [
  ["Apache License 2.0", "/LICENSES/Apache-2.0.txt"],
  ["MIT License for React and React DOM", "/LICENSES/MIT-React.txt"],
  ["MIT License for Vinext", "/LICENSES/MIT-vinext.txt"],
  ["MIT License for Bootstrap", "/LICENSES/MIT-Bootstrap.txt"],
  ["SIL Open Font License 1.1 for Jost", "/LICENSES/OFL-1.1-Jost.txt"],
  ["MIT License for loglevel", "/LICENSES/MIT-loglevel.txt"],
  ["Llama 3.2 Community License", "/LICENSES/Llama-3.2-Community-License.txt"],
  ["Llama 3.2 Acceptable Use Policy", "/LICENSES/Llama-3.2-Acceptable-Use-Policy.md"],
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
          <h1>Legal and third-party notices</h1>
          <p className="lead">Current Owner terms, historical license records, and third-party attribution for hah.dev and Text to Lattice.</p>

          <h2>Text to Lattice implementation</h2>
          <dl className="paper-meta">
            <div className="paper-meta-item"><dt>Generator</dt><dd><a href={generator.repository}>{generator.name}</a>, model <code>{generator.modelId}</code>; {generator.revision}; {generator.inferenceSummary}</dd></div>
            <div className="paper-meta-item"><dt>Verifier</dt><dd><a href={verifier.repository}>{verifier.name}</a>, model <code>{verifier.modelId}</code>; {verifier.revision}; configured request seed {verifier.inference.seed}</dd></div>
            <div className="paper-meta-item"><dt>Runtime</dt><dd><a href={runtime.packageUrl}>{runtime.name} {runtime.version}</a>; {runtime.tokenizerName} {runtime.tokenizerVersion}; {runtime.structuredOutputName} {runtime.structuredOutputVersion}</dd></div>
          </dl>
          <p>{String(interactiveRelease) === "held"
            ? "When the machine release record contains an open blocker, the client stays outside the public bundle and makes no transformation submission. If enabled, the capability submits only after explicit confirmation."
            : "The enabled capability submits only after the visitor explicitly chooses Process with external service."} The enabled browser flow first sends one content-free cookie setup <code>POST /api/lattice</code> with no body or Content-Type, then exactly one content-bearing <code>POST /api/lattice</code> whose JSON body contains exactly <code>{"{text, requested_mode, schema_version: 1}"}</code>. Only the second request includes submitted text or can initiate external-provider processing. The server uses the fixed Qwen generator and Llama verifier through Hugging Face Inference Providers and Featherless AI.</p>
          <p>hah.dev application code does not store source, prompts, candidates, provider bodies, or results; write raw-content logs; cache or queue that content; or send it to analytics. The browser does not retry automatically, and the server does not fall back to another provider or model. Text nevertheless leaves hah.dev for external processing under Hugging Face, Featherless AI, and their infrastructure policies. Do not submit classified, controlled, privileged, export-controlled, operationally sensitive, or otherwise restricted information.</p>
          <p>The former browser-local WebLLM/MLC runtime and bodyless lease, renewal, release, and Turnstile-attestation controls are historical and inactive. Their pinned model and WebAssembly records remain below as provenance only and do not identify the provider-served runtime byte for byte. {runtime.wasmLicenseStatus}</p>
          <p>The models and provider runtime are third-party materials, not works authored by Hayden Howard. Qwen3-4B is published under the <a href={generator.licenseUrl}>{generator.licenseName}</a>. Upstream service terms and model cards remain controlling.</p>
          <p>Built with Llama. Llama 3.2 is licensed under the <a href={verifier.licenseUrl}>Llama 3.2 Community License</a> and <a href={verifier.acceptableUseUrl}>Acceptable Use Policy</a>, Copyright © Meta Platforms, Inc. All Rights Reserved.</p>

          <h2>Notices and index</h2>
          <ul>
            {documents.map((document) => <li key={document.url}><a href={document.url}>{document.name}</a> — {document.description}</li>)}
          </ul>

          <h2>Current Owner terms</h2>
          <ul>
            {ownerTermsDocuments.map(([name, url]) => <li key={url}><a href={url}>{name}</a></li>)}
          </ul>

          <h2>Historical Owner license records</h2>
          <p>These records preserve evidence of terms and permissions attached to earlier distributed copies. They do not automatically attach to later copies or grant rights over new Owner-controlled material first published under the current proprietary terms.</p>
          <ul>
            {historicalOwnerLicenseDocuments.map(([name, url]) => <li key={url}><a href={url}>{name}</a></li>)}
          </ul>

          <h2>Third-party license texts</h2>
          <ul>
            {thirdPartyLicenseDocuments.map(([name, url]) => <li key={url}><a href={url}>{name}</a></li>)}
          </ul>

          <p>Upstream model cards and terms remain controlling. No hah.dev record supersedes a third-party license, acceptable-use policy, attribution, or restriction.</p>
          <p><a href="/projects/lattice/text-to-lattice/">Text to Lattice contract</a>.</p>
        </article>
      </main>
    </>
  );
}
