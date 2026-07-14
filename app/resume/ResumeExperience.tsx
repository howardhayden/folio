"use client";

import { useEffect, useMemo, useState } from "react";
import { LegacyIcon, type LegacyIconName } from "../components/LegacyIcon";
import { timeline } from "../data";

type ModalId = "officer" | "ohiolink" | "undergrad" | "teaching" | null;

const modalContent = {
  officer: {
    title: "Officer Candidate",
    subtitle: "#ForgedInIce",
    period: "December 2025 – June 2026",
    details: [
      "Military Discipline, Professional Bearing, Basic Naval Indoctrination",
      "Physical Readiness, Mental Resilience",
      "Attention to Detail, Performance, Standards Compliance, Execution in High-Stress and Minimally-Informative Environments",
      "Collaborative Cohesion",
      "Close-Order Drill, Precision Formations",
      "Water Survival, Swim Qualification",
      "Shipboard Engineering Principles, Propulsion Systems",
      "Naval Weapons Systems, Combat Systems Fundamentals",
      "Marine Navigation, Seamanship, Shiphandling, Rules of the Road",
      "Shipboard Damage Control, Firefighting Operations",
      "Naval Network Infrastructure, Cyber Warfare Awareness",
    ],
  },
  ohiolink: {
    title: "Luminary",
    subtitle: "OhioLINK",
    period: "August 2021 – May 2023",
    details: [
      "Web Development",
      "Digital Accessibility Remediation",
      "Productivity Analysis",
      "Contract Analysis and CLM",
      "Course Design, Mentorship",
      "Metadata",
      "Makerspace Instruction",
      "Won Poster, People’s Choice for Strategic Project Management in the OhioLINK Luminaries Program at ALAO 2022 in Dublin, OH.",
    ],
  },
  undergrad: {
    title: "Miami University",
    subtitle: "",
    period: "August 2019 – May 2023",
    details: [],
  },
  teaching: {
    title: "Teaching Assistant",
    subtitle: "College of Engineering and Computing",
    period: "May 2022 – May 2023",
    details: ["Training, Assessment", "Coordination, Mediation", "Collection Development"],
  },
} as const;

const timelineIcons: Record<string, LegacyIconName> = {
  "King’s College London": "floppy2",
  "United States Navy": "arrows-move",
  "Madison Consolidated Schools": "clipboard-check",
  "American Public University System": "mortarboard",
  "iSchool, University of Wisconsin-Madison": "floppy2",
  "Germantown Public Library": "book-half",
  "Dayton Area School Consortium": "clipboard-check",
  "University of Tartu": "body-text",
};

export default function ResumeExperience() {
  const [selected, setSelected] = useState<ModalId>(null);
  const mainTimeline = useMemo(() => timeline.filter((entry) => !["OhioLINK Luminary", "Undergraduate Teaching Assistant", "Volunteer"].includes(entry.role)), []);
  const blurred = selected ? " resume-content-is-blurred" : "";

  useEffect(() => {
    document.body.classList.toggle("resume-modal-open", Boolean(selected));
    if (!selected) return () => document.body.classList.remove("resume-modal-open");
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSelected(null);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.body.classList.remove("resume-modal-open");
    };
  }, [selected]);

  return (
    <>
      <div className={`container${blurred}`}>
        <h2 className="text-center" style={{ marginBottom: "-6vh" }}>Timeline</h2>
        <section className="design-section-container" aria-label="Career timeline">
          <div className="timeline">
            {mainTimeline.map((entry, index) => {
              const className = `timeline-entry ${index % 2 ? "left" : "right"}`;
              return entry.role === "Officer Candidate" ? (
                <div className={`${className} timeline-button`} role="button" tabIndex={0} onClick={() => setSelected("officer")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected("officer"); } }} key={`${entry.period}-${entry.organization}`}>
                  <TimelineEntry entry={entry} icon={timelineIcons[entry.organization]} index={index} />
                </div>
              ) : (
                <article className={className} key={`${entry.period}-${entry.organization}`}>
                  <TimelineEntry entry={entry} icon={timelineIcons[entry.organization]} index={index} />
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <div className={`container${blurred}`}>
        <h2 className="text-red text-center" style={{ marginTop: "-3vh" }}>
          <LegacyIcon name="graduation-cap" /> &nbsp;University&nbsp; <LegacyIcon name="graduation-cap" />
        </h2>
        <p className="lead text-center" style={{ marginBottom: "9vh" }}>Graduated May 2023</p>
        <Progress label="Digital Humanities Forum Committee" start="August 2021" width="49%" />
        <Progress label="Diversity, Equity, and Inclusion Committee" start="August 2022" width="22%" />
        <Progress label="OhioLINK Luminary" start="August 2021" width="49%" onClick={() => setSelected("ohiolink")} />
        <Progress label="B.A. Computer Science – Miami University" start="August 2019" width="100%" gradient onClick={() => setSelected("undergrad")} />
        <Progress label="Teaching Assistant" start="May 2022" width="29%" onClick={() => setSelected("teaching")} />
        <NoScriptUniversityDetails />
      </div>

      <div className={`container${blurred}`}>
        <section className="design-section-container" aria-label="Earlier experience">
          <div className="timeline">
            <article className="timeline-entry right">
              <h3>Volunteer</h3>
              <p>March 2019 – August 2019<br />Kettering Health Network</p>
              <LegacyIcon name="capsule" className="rotate-left timeline-icon" />
            </article>
          </div>
        </section>
      </div>

      {selected && (
        <div className="modal resume-modal" role="presentation" onPointerDown={() => setSelected(null)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="resume-modal-title" onPointerDown={(event) => event.stopPropagation()}>
            <h3 id="resume-modal-title">{modalContent[selected].title}</h3>
            {modalContent[selected].subtitle && <p className="lead text-center">{modalContent[selected].subtitle}</p>}
            <p className="small text-center">{modalContent[selected].period}</p>
            {selected === "undergrad" ? <UndergraduateDetails /> : modalContent[selected].details.map((detail) => (
              <p key={detail}>{selected === "ohiolink" && detail.startsWith("Won Poster") ? <small>{detail}</small> : detail}</p>
            ))}
            {selected === "teaching" && <CourseChart />}
          </div>
        </div>
      )}
    </>
  );
}

function NoScriptUniversityDetails() {
  const html = `<style>.progress-bar-fill:hover{cursor:auto}</style>
    <div class="resume-noscript-degree">
      <p class="text-center">Bachelor of <kbd>Arts</kbd></p>
      <p class="text-center">Major in <kbd>Computer Science</kbd></p>
      <p class="text-center">Minor in <kbd>Commerce</kbd></p>
      <p class="text-center">Thematic Sequence of <kbd>LUX 3</kbd><br><small>*European Culture and Society</small></p>
    </div>
    <section class="design-section-container" aria-label="University experience details"><div class="timeline">
      <article class="timeline-entry left"><h3>Luminary</h3><p>August 2021 – May 2023<br>OhioLINK</p>
        <p><small>Web Development; Digital Accessibility Remediation; Metadata</small></p>
        <p><small>Productivity Analysis; Contract Analysis and CLM</small></p>
        <p><small>Course Design, Mentorship; Makerspace Instruction</small></p>
        <p><small>Won Poster, People's Choice for Strategic Project Management in the OhioLINK Luminaries Program at ALAO 2022 in Dublin, OH.</small></p></article>
      <article class="timeline-entry right"><h3>Undergraduate Teaching Assistant</h3><p>May 2022 – May 2023<br>Miami University College of Engineering and Computing</p>
        <p><small>Training; Assessment</small></p><p><small>Coordination; Mediation</small></p><p><small>Collection Development</small></p></article>
    </div></section>`;
  return <noscript dangerouslySetInnerHTML={{ __html: html }} />;
}

function UndergraduateDetails() {
  return (
    <>
      <p>Bachelor of <kbd>Arts</kbd></p>
      <p>Major in <kbd>Computer Science</kbd></p>
      <p>Minor in <kbd>Commerce</kbd></p>
      <p>Thematic Sequence of <kbd>LUX 3</kbd></p>
      <p className="small">*European Culture and Society</p>
    </>
  );
}

function TimelineEntry({ entry, icon, index }: { entry: (typeof timeline)[number]; icon: LegacyIconName; index: number }) {
  return (
    <>
      <h3>{entry.role}</h3>
      <p>{entry.period}<br />{entry.organization}</p>
      {entry.details.length > 0 && <p><small>{entry.details.map((detail) => <span key={detail}>{detail}<br /></span>)}</small></p>}
      <LegacyIcon name={icon} className={`${index % 2 ? "rotate-right" : "rotate-left"} timeline-icon`} />
    </>
  );
}

function Progress({ label, start, width, gradient = false, onClick }: { label: string; start: string; width: string; gradient?: boolean; onClick?: () => void }) {
  const className = `progress-bar-fill ml-auto ${gradient ? "background-gradient-green-blue" : ""}`;
  return (
    <div className="progress-container">
      <div className="progress-bar-wrapper rounded-0">
        {onClick ? (
          <button className={`${className} button-reset`} style={{ width }} onClick={onClick} type="button"><span className="progress-value">&nbsp;{start}</span></button>
        ) : (
          <div className={className} style={{ width, cursor: "auto" }}><span className="progress-value">&nbsp;{start}</span></div>
        )}
      </div>
      <label>{label}</label>
    </div>
  );
}

function CourseChart() {
  return (
    <div className="progress-container">
      <svg viewBox="0 0 36 36" className="circular-chart" aria-label="Courses supported">
        <circle className="circle-background" cx="18" cy="18" r="15.9155" fill="none" stroke="#efefef" strokeWidth="2" />
        <circle className="circle-3" cx="18" cy="18" r="15.9155" fill="none" stroke="#950F22" strokeWidth="2" strokeDasharray="73, 27" strokeDashoffset="0" />
        <circle className="circle-2" cx="18" cy="18" r="15.9155" fill="none" stroke="#077995" strokeWidth="2" strokeDasharray="17, 83" strokeDashoffset="17.5" />
        <circle className="circle-1" cx="18" cy="18" r="15.9155" fill="none" stroke="#6c757d" strokeWidth="2" strokeDasharray="10, 90" strokeDashoffset="26.5" />
      </svg>
      <div className="labelContainer small">
        <span className="label text-blue">Technology, Ethics, and Global Society</span><br />
        <span className="label text-red">Software Engineering for User Interface and User Experience Design</span><br />
        <span className="label text-secondary">Introduction to Software Engineering</span>
      </div>
    </div>
  );
}
