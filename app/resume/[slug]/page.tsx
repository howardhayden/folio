import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "../../components/SiteChrome";
import { resumeDetailBySlug, resumeDetailList } from "../resumeDetails.js";
import { JsonLd } from "../../semantic/JsonLd";
import { semanticMetadata } from "../../semantic/metadata";
import { jsonLdForPage } from "../../semantic/portfolio.js";

export function generateStaticParams() {
  return resumeDetailList.map(({ id }) => ({ slug: id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const detail = resumeDetailBySlug((await params).slug);
  if (!detail) return {};
  return semanticMetadata(detail.title, `${detail.title}${detail.subtitle ? `, ${detail.subtitle}` : ""}: ${detail.period}.`, detail.canonicalPath);
}

export default async function ResumeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const detail = resumeDetailBySlug((await params).slug);
  if (!detail) notFound();
  return (
    <>
      <JsonLd value={jsonLdForPage(detail.canonicalPath)} />
      <SiteHeader current="resume" />
      <main className="container mt-4 page-view semantic-page" data-page-view="resume-detail">
        <article data-resume-detail-id={detail.id}>
          <h1>{detail.title}</h1>
          {detail.subtitle ? <p className="lead">{detail.subtitle}</p> : null}
          <p>{detail.period}</p>
          <ul>{detail.details.map((item) => <li key={item}>{item}</li>)}</ul>
          {"courses" in detail && detail.courses.length ? <><h2>Courses supported</h2><ul>{detail.courses.map((course: string) => <li key={course}>{course}</li>)}</ul></> : null}
          <p><a href="/resume/">Return to the complete résumé</a></p>
        </article>
      </main>
    </>
  );
}
