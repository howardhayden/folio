import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "../../components/SiteChrome";
import { practiceStandards, sharedRequirements, SITE_CONTENT_TERMS_URL } from "../../content/siteContent.js";
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

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const project = projectBySlug((await params).slug);
  if (!project) notFound();

  const projectTargets = new Map<string, (typeof projects)[number]>(projects.map((item) => [item.id, item]));
  const requirementTargets = [...sharedRequirements, ...practiceStandards];
  const record = projectsManifest.projects.find(({ id }) => id === project.id)!;
  return (
    <>
      <JsonLd value={jsonLdForPage(project.canonicalPath, project)} />
      <SiteHeader />
      <main className="container mt-4 page-view semantic-page" data-page-view="project">
        <article data-project-id={project.id}>
          <h1>{project.name}</h1>
          <p className="lead">{project.summary[0]}</p>
          {project.summary.slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <dl className="paper-meta">
            <div className="paper-meta-item"><dt>Status</dt><dd>{project.status}</dd></div>
            <div className="paper-meta-item"><dt>Publication</dt><dd>{project.publication.label}</dd></div>
            <div className="paper-meta-item"><dt>Authoritative source</dt><dd><a href={project.url}>{project.url}</a></dd></div>
          </dl>
          <h2>Emphasis</h2>
          <ul>{project.emphasis.map((item) => <li key={item}>{item}</li>)}</ul>
          <h2>Capabilities</h2>
          {project.capabilities.length ? <ul>{project.capabilities.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Not documented.</p>}
          <h2>Technologies</h2>
          {project.technologies.length ? <ul>{project.technologies.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Not documented.</p>}
          <h2>Evidence and documentation</h2>
          <ul>
            {project.evidence.map((url) => <li key={url}><a href={url}>{url}</a></li>)}
            {(project.resources ?? []).filter(({ url }) => !project.evidence.includes(url)).map(({ label, url }) => <li key={`${label}-${url}`}><a href={url}>{label}</a></li>)}
          </ul>
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
