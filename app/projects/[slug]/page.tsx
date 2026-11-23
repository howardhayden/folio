import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "../../components/SiteChrome";
import { practiceStandards, sharedRequirements, SITE_CONTENT_TERMS_URL } from "../../content/siteContent.js";
import { latticeReadingGuide, projectDocuments } from "../../content/projectDocuments.js";
import { projectBySlug, projects } from "../../resume/projects.js";
import { JsonLd } from "../../semantic/JsonLd";
import { semanticMetadata } from "../../semantic/metadata";
import { jsonLdForPage, projectsManifest } from "../../semantic/portfolio.js";

export function generateStaticParams() {
  return projects.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const project = projectBySlug((await params).slug);
  if (!project) return {};
  return semanticMetadata(project.name, project.thesis, project.canonicalPath);
}

function LatticeSection({ field }: { field: "emphasis" | "capabilities" | "technologies" }) {
  return latticeReadingGuide.subjects.map((subject) => (
    <section key={subject.id} aria-labelledby={`${subject.id}-${field}`}>
      <h3 id={`${subject.id}-${field}`}>{subject.name}</h3>
      <ul>{subject[field].map((item) => <li key={item}>{item}</li>)}</ul>
      {field === "capabilities" ? <p><a href={`${latticeReadingGuide.evidenceUrl}#${subject.id}`}>Evidence for {subject.name}</a></p> : null}
    </section>
  ));
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const project = projectBySlug((await params).slug);
  if (!project) notFound();

  const projectTargets = new Map<string, (typeof projects)[number]>(projects.map((item) => [item.id, item]));
  const requirementTargets = [...sharedRequirements, ...practiceStandards];
  const record = projectsManifest.projects.find(({ id }) => id === project.id)!;
  const overview = record.readingGuide ? [record.thesis, record.readingGuide.introduction] : record.summary;
  return (
    <>
      <JsonLd value={jsonLdForPage(project.canonicalPath, project)} />
      <SiteHeader />
      <main className="container mt-4 page-view semantic-page" data-page-view="project">
        <article data-project-id={project.id}>
          <h1>{project.name}</h1>
          <p className="lead">{overview[0]}</p>
          {overview.slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <dl className="paper-meta">
            <div className="paper-meta-item"><dt>Status</dt><dd>{project.status}</dd></div>
            <div className="paper-meta-item"><dt>Publication</dt><dd>{project.publication.label}</dd></div>
            <div className="paper-meta-item"><dt>{record.readingGuide ? "Public reference" : "Authoritative source"}</dt><dd>{record.readingGuide
              ? <a href={record.readingGuide.documentation}>Lattice documentation</a> : <a href={project.url}>{project.url}</a>}</dd></div>
          </dl>
          <h2 id="emphasis">Emphasis</h2>
          {project.id === "lattice" ? <LatticeSection field="emphasis" /> : <ul>{project.emphasis.map((item) => <li key={item}>{item}</li>)}</ul>}
          <h2 id="capabilities">Capabilities</h2>
          {project.id === "lattice" ? <LatticeSection field="capabilities" /> : project.capabilities.length ? <ul>{project.capabilities.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Not documented.</p>}
          <h2 id="technologies">Technologies</h2>
          {project.id === "lattice" ? <LatticeSection field="technologies" /> : project.technologies.length ? <ul>{project.technologies.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Not documented.</p>}
          <h2 id="evidence-and-documentation">Evidence and documentation</h2>
          {project.id === "lattice" ? (
            <ul>
              <li><a href={latticeReadingGuide.documentationUrl}>Documentation</a> explains the meaning contract, candidate selection, service path and privacy controls.</li>
              <li><a href={latticeReadingGuide.evidenceUrl}>Evidence</a> links the method to a wording illustration and the API to implementation evidence, browser observations and production receipts.</li>
              {projectDocuments.map((doc) => <li key={doc.id}><a href={doc.htmlUrl}>{doc.label}</a></li>)}
              <li><a href={latticeReadingGuide.jsonUrl}>Reading guide (JSON)</a> connects subjects, claims, documents and primary sources by stable identifiers.</li>
            </ul>
          ) : <ul>
            {project.evidence.map((url) => <li key={url}><a href={url}>{url}</a></li>)}
            {(project.resources ?? []).filter(({ url }) => !project.evidence.includes(url)).map((resource) => {
              const contributorName = "kind" in resource
                && resource.kind === "contributor"
                && "contributorName" in resource
                ? resource.contributorName
                : null;

              return (
                <li key={`${resource.label}-${resource.url}`}>
                  {contributorName ? (
                    <>
                      Contributor:{" "}
                      <a
                        href={resource.url}
                        target={resource.opensInNewTab ? "_blank" : undefined}
                        rel={resource.opensInNewTab ? "noopener noreferrer" : undefined}
                      >
                        {contributorName}
                      </a>
                    </>
                  ) : (
                    <a href={resource.url}>{resource.label}</a>
                  )}
                </li>
              );
            })}
          </ul>}
          <h2>Limitations</h2>
          {project.limitations.length ? <ul>{project.limitations.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None are documented in this portfolio record.</p>}
          <h2>Relationships</h2>
          {project.relationships.length ? (
            <ul>{project.relationships.map(({ relation, target, scope }) => {
              const targetProject = projectTargets.get(target);
              const targetRequirement = requirementTargets.find(({ id }) => id === target);
              const href = targetProject?.canonicalPath ?? (targetRequirement ? `/requirements/#${target}` : "/requirements/");
              return <li key={`${relation}-${target}`}>{relation}: <a href={href}>{targetProject?.name ?? targetRequirement?.label ?? target}</a>; scope: {scope}.</li>;
            })}</ul>
          ) : <p>None are documented in this portfolio record.</p>}
          <h2>Inherited requirements</h2>
          <ul>{sharedRequirements.map((requirement) => <li key={requirement.id}><a href={`/requirements/#${requirement.id}`}>{requirement.label}</a>: {requirement.description}</li>)}</ul>
          <h2>Provenance and terms</h2>
          <dl className="paper-meta">
            <div className="paper-meta-item"><dt>Repository</dt><dd><a href={record.provenance.repository}>{record.provenance.repository}</a></dd></div>
            <div className="paper-meta-item"><dt>Source path</dt><dd>{record.provenance.sourcePaths.join(", ")}</dd></div>
            <div className="paper-meta-item"><dt>Record version</dt><dd>{record.provenance.version}</dd></div>
            <div className="paper-meta-item"><dt>Last updated</dt><dd>{record.provenance.lastUpdated}</dd></div>
            <div className="paper-meta-item"><dt>External project license</dt><dd>Not documented in this portfolio record.</dd></div>
            <div className="paper-meta-item"><dt>Portfolio record terms</dt><dd><a href={SITE_CONTENT_TERMS_URL}>Authored portfolio-content terms</a></dd></div>
          </dl>
          {project.id === "lattice" ? <p><a href="/projects/lattice/text-to-lattice/">Text to Lattice tool contract</a></p> : null}
        </article>
      </main>
    </>
  );
}
