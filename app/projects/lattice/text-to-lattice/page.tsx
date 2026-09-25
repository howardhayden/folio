import { SiteHeader } from "../../../components/SiteChrome";
import { textToLatticeContract } from "../../../content/textToLatticeContent.js";
import { LATTICE_DOCUMENTATION_RESOURCES, projectBySlug } from "../../../resume/projects.js";
import { JsonLd } from "../../../semantic/JsonLd";
import { semanticMetadata } from "../../../semantic/metadata";
import { jsonLdForPage } from "../../../semantic/portfolio.js";

export const metadata = semanticMetadata(
  textToLatticeContract.name,
  textToLatticeContract.purpose,
  textToLatticeContract.canonicalPath,
);

export default function TextToLatticePage() {
  const security = textToLatticeContract.securityAndPrivacy;
  const latticeProject = projectBySlug("lattice");
  const interactiveRelease = latticeProject && "interactiveRelease" in latticeProject
    ? latticeProject.interactiveRelease
    : "not-applicable";
  const releaseHeld = String(interactiveRelease) === "held";

  return (
    <>
      <JsonLd value={jsonLdForPage(textToLatticeContract.canonicalPath)} />
      <SiteHeader />
      <main className="container mt-4 page-view semantic-page" data-page-view="text-to-lattice">
        <article data-tool-id={textToLatticeContract.id}>
          <h1>{textToLatticeContract.name}</h1>
          <p className="lead">{textToLatticeContract.purpose}</p>

          <section className="lattice-release-hold" aria-labelledby="text-to-lattice-release-status">
            <h2 id="text-to-lattice-release-status">Release status: {interactiveRelease}</h2>
            {releaseHeld ? (
              <>
                <p>The interactive client is unavailable whenever the machine release record contains an open blocker. Model-behavior, provenance, accessibility, capacity, and privacy gaps remain visible as accepted residuals or bounded post-deployment verification; they are not represented as completed evidence.</p>
                <p>This rollback state preserves the implementation without representing source controls as deployed proof.</p>
              </>
            ) : (
              <>
                <p>The interactive client’s availability follows the machine-checked release record for this build.</p>
                <p>Text is submitted only after explicit confirmation through the same-origin <code>/api/lattice</code> capability. The server uses fixed Nscale-served Qwen and DeepInfra-served Llama roles through the Hugging Face router; hah.dev application code does not retain the source or result, write raw-content logs, or send content to analytics.</p>
                <p><a href="/resume/#text-to-lattice">Use Text to Lattice</a></p>
              </>
            )}
            <ul>
              <li><a href="/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md">Read the release qualification</a></li>
              <li><a href="/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json">Inspect the machine-readable release register</a></li>
            </ul>
          </section>

          <h2>Documentation maps</h2>
          <p>Read the method and the demonstrator at their own boundaries.</p>
          <ul>
            {LATTICE_DOCUMENTATION_RESOURCES.map(({ label, url }) => (
              <li key={url}><a href={url}>{label}</a></li>
            ))}
          </ul>

          <h2>Input</h2>
          <p>{textToLatticeContract.input}</p>

          <h2>Output</h2>
          <p>{textToLatticeContract.output}</p>

          <h2>Process</h2>
          <ol>{textToLatticeContract.process.map((item) => <li key={item}>{item}</li>)}</ol>

          <h2>Constraints and limitations</h2>
          <ul>{textToLatticeContract.constraints.map((item) => <li key={item}>{item}</li>)}</ul>

          <section aria-labelledby="text-to-lattice-privacy-heading" id="text-to-lattice-privacy">
            <h2 id="text-to-lattice-privacy-heading">Privacy and external processing</h2>
            <p>{security.huggingFace.summary}</p>
            <ul>{security.huggingFace.protections.map((item) => <li key={item}>{item}</li>)}</ul>
            <p>{security.huggingFace.residualDisclosure}</p>
            <h3>Hugging Face policies and documentation</h3>
            <ul>
              {security.huggingFace.sources.map((source) => (
                <li key={source.url}><a href={source.url}>{source.label}</a></li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="text-to-lattice-hardening">
            <h2 id="text-to-lattice-hardening">Input and model hardening</h2>
            <p>{security.inputHardening.summary}</p>
            <h3>Hard limits</h3>
            <ul>{security.inputHardening.limits.map((item) => <li key={item}>{item}</li>)}</ul>
            <h3>Isolation and validation</h3>
            <ul>{security.inputHardening.isolation.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>

          <section aria-labelledby="text-to-lattice-usage-heading" id="text-to-lattice-usage">
            <h2 id="text-to-lattice-usage-heading">Remote capability and limits</h2>
            <p>{security.api.summary}</p>
            <dl className="paper-meta">
              <div className="paper-meta-item"><dt>Browser destination</dt><dd>Same-origin <code>POST /api/lattice</code>; no query string, redirect, or provider origin; one browser-owned API-scoped quota cookie</dd></div>
              <div className="paper-meta-item"><dt>Exact request</dt><dd><code>{"{text, requested_mode, schema_version: 1}"}</code>; requested mode is auto, operative, or experiential</dd></div>
              <div className="paper-meta-item"><dt>Server-side roles</dt><dd>Qwen3-4B-Instruct-2507 generates through Nscale; Llama 3.1 8B Instruct verifies through DeepInfra; both are fixed through Hugging Face Inference Providers</dd></div>
              <div className="paper-meta-item"><dt>Retention</dt><dd>No hah.dev application storage, raw-content logging, caching, queueing, or analytics for the source, prompts, candidates, or result</dd></div>
              <div className="paper-meta-item"><dt>Failure</dt><dd>Bounded machine-readable error; no browser retry and no provider or model fallback</dd></div>
            </dl>

            <details className="project-readme text-to-lattice-technical">
              <summary>Capability enforcement and failure boundary</summary>
              <div className="project-readme-copy">
                <ul>{security.api.rules.map((item) => <li key={item}>{item}</li>)}</ul>
                <dl className="paper-meta">
                  <div className="paper-meta-item"><dt>Request deadline</dt><dd>240 seconds for the complete API request and client wait</dd></div>
                  <div className="paper-meta-item"><dt>Daily availability</dt><dd>30 accepted transformations globally per UTC day; 3 per ordinary persistent browser cookie jar per UTC day</dd></div>
                  <div className="paper-meta-item"><dt>Quota identity</dt><dd>One opaque, signed, HttpOnly cookie scoped to <code>/api/lattice</code> until the next UTC day; no submitted content, IP identity, or browser fingerprint</dd></div>
                  <div className="paper-meta-item"><dt>Provider-call deadline</dt><dd>60 seconds for each bounded call to the fixed Hugging Face router</dd></div>
                  <div className="paper-meta-item"><dt>Secret boundary</dt><dd>The Hugging Face token is an encrypted server-side Worker secret and never enters the browser or response</dd></div>
                  <div className="paper-meta-item"><dt>Correction boundary</dt><dd>A schema-correction or repair pass may call the same fixed role model within the pipeline budget; it never switches provider or model</dd></div>
                  <div className="paper-meta-item"><dt>Historical controls</dt><dd>The WebLLM/MLC download path, bodyless quota lease, Turnstile attestation frame, renewal, and release protocol are inactive and retained only as provenance.</dd></div>
                </dl>
                <p>{security.api.limitation}</p>
                <ul>{security.api.sources.map((source) => <li key={source.url}><a href={source.url}>{source.label}</a></li>)}</ul>
                <p>This text leaves hah.dev for external processing only after the visitor chooses Process with external service. Do not submit classified, controlled, privileged, export-controlled, operationally sensitive, or otherwise restricted information. Hugging Face, Nscale, DeepInfra, and their infrastructure process submitted content under their own policies.</p>
              </div>
            </details>
          </section>

          <section aria-labelledby="text-to-lattice-output-handling">
            <h2 id="text-to-lattice-output-handling">Output handling</h2>
            <p>{security.outputProtection.summary}</p>
            <ul>{security.outputProtection.controls.map((item) => <li key={item}>{item}</li>)}</ul>
            <p>{security.outputProtection.limitation}</p>
          </section>

          <section aria-labelledby="text-to-lattice-availability" data-tool-availability="progressive-enhancement">
            <h2 id="text-to-lattice-availability">Availability and fallback</h2>
            <p>{releaseHeld
              ? "The interactive converter is an optional enhancement unavailable whenever the machine release record contains an open blocker."
              : "The interactive converter is an optional progressive enhancement."} The Lattice project title remains a native link to the canonical Lattice project record. Its icon leads to this contract when JavaScript is unavailable; in an enabled JavaScript release, that icon alone opens the converter.</p>
            <ul>
              <li>{releaseHeld
                ? "Without JavaScript—and with JavaScript while this release is held—the project title remains an ordinary link to Lattice and its icon links to this contract; no text-entry interface is published."
                : "Without JavaScript, the project title remains an ordinary link to Lattice and its icon links to this contract; no text-entry interface is rendered."}</li>
              <li>{releaseHeld ? "When a later release is enabled, absence" : "Absence"} of JavaScript or the secure same-origin capability leaves the documentation available but prevents conversion.</li>
              <li>Provider unavailability, timeout, rate limit, or malformed output terminates explicitly; no automatic retry or fallback presents the source as transformed text.</li>
            </ul>
            <p>The portfolio’s public HTML, <a href="/projects.json">project manifest</a>, <a href="/knowledge-graph.jsonld">knowledge graph</a>, and <a href="/content/projects/lattice.md">canonical project Markdown</a> do not depend on the remote inference service.</p>
            <noscript><p className="lattice-noscript-note">JavaScript is disabled. The complete public contract remains on this page.</p></noscript>
          </section>

          <h2>Server-side implementation provenance</h2>
          <dl className="paper-meta">
            <div className="paper-meta-item"><dt>Generator</dt><dd><a href={textToLatticeContract.implementation.generator.repository}>{textToLatticeContract.implementation.generator.name}</a>, model <code>{textToLatticeContract.implementation.generator.modelId}</code>; {textToLatticeContract.implementation.generator.revision}; {textToLatticeContract.implementation.generator.inferenceSummary}</dd></div>
            <div className="paper-meta-item"><dt>Verifier</dt><dd><a href={textToLatticeContract.implementation.verifier.repository}>{textToLatticeContract.implementation.verifier.name}</a>, model <code>{textToLatticeContract.implementation.verifier.modelId}</code>; {textToLatticeContract.implementation.verifier.revision}; request seed {textToLatticeContract.implementation.verifier.inference.seed}</dd></div>
            <div className="paper-meta-item"><dt>Runtime</dt><dd><a href={textToLatticeContract.implementation.runtime.documentationUrl}>{textToLatticeContract.implementation.runtime.name} {textToLatticeContract.implementation.runtime.version}</a>; {textToLatticeContract.implementation.runtime.tokenizerName} {textToLatticeContract.implementation.runtime.tokenizerVersion}; <a href={textToLatticeContract.implementation.runtime.structuredOutputPackageUrl}>{textToLatticeContract.implementation.runtime.structuredOutputName} {textToLatticeContract.implementation.runtime.structuredOutputVersion}</a>.</dd></div>
          </dl>
          <p>{textToLatticeContract.implementation.runtime.wasmLicenseStatus}</p>
          <p>Model-assisted result design: Qwen drafts and Llama 3.1 checks on the server through the configured external service. These checks can miss altered, omitted, biased, or unsafe meaning; every result requires review before reliance. Built with Llama. Llama 3.1 is licensed under the <a href={textToLatticeContract.implementation.verifier.licenseUrl}>Llama 3.1 Community License</a> and <a href={textToLatticeContract.implementation.verifier.acceptableUseUrl}>Acceptable Use Policy</a>, Copyright © Meta Platforms, Inc. All Rights Reserved.</p>
          <p><a href="/third-party-notices/">Legal, historical, and third-party notices</a>.</p>
          <p><a href="/resume/#projects-title">Return to the Lattice project card</a>.</p>
          <p><a href="/projects/lattice/">Read the canonical Lattice project record</a>.</p>
        </article>
      </main>
    </>
  );
}
