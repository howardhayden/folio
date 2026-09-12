"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { LegacyIcon, type LegacyIconName } from "../components/LegacyIcon";
import { timeline } from "../data";
import { resumeEducationOverview } from "../content/siteContent.js";
import { resumeDetails } from "./resumeDetails.js";
import {
  deriveUniversityChronologyGeometry,
  universityChronology,
  universityChronologyPercent,
  type UniversityChronologyRecord,
} from "./universityChronology";

type ModalKey = keyof typeof resumeDetails;
type ModalId = ModalKey | null;

const timelineIcons: Record<string, LegacyIconName> = {
  "King’s College London": "floppy2",
  "United States Navy": "arrows-move",
  "Madison Correctional Facility": "camera-video-off-fill",
  "Madison Consolidated Schools": "clipboard-check",
  "American Public University System": "mortarboard",
  "iSchool, University of Wisconsin-Madison": "floppy2",
  "Germantown Public Library": "book-half",
  "Dayton Area School Consortium": "clipboard-check",
  "University of Tartu": "body-text",
};

function shouldInterceptResumeModalLink(event: ReactMouseEvent<HTMLAnchorElement>) {
  return !event.defaultPrevented
    && event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey;
}

export default function ResumeExperience() {
  const [selected, setSelected] = useState<ModalId>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const mainTimeline = useMemo(() => timeline.filter((entry) => !["OhioLINK Luminary", "Undergraduate Teaching Assistant", "Volunteer"].includes(entry.role)), []);
  const blurred = selected ? " resume-content-is-blurred" : "";

  const openModal = (modal: Exclude<ModalId, null>, trigger: HTMLElement) => {
    returnFocusRef.current = trigger;
    setSelected(modal);
  };

  const closeModal = () => setSelected(null);

  useEffect(() => {
    document.body.classList.toggle("resume-modal-open", Boolean(selected));
    if (!selected) return () => document.body.classList.remove("resume-modal-open");

    const dialog = dialogRef.current;
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
      "[contenteditable='true']",
    ].join(",");
    const focusableElements = () => Array.from(dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
      .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const elements = focusableElements();

      if (elements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (dialog && !dialog.contains(event.target as Node)) {
        (focusableElements()[0] ?? dialog).focus();
      }
    };

    dialog?.focus({ preventScroll: true });
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.body.classList.remove("resume-modal-open");
      const returnFocus = returnFocusRef.current;
      returnFocusRef.current = null;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
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
              const detailLink = entry.role === "Officer Candidate" ? {
                href: resumeDetails.officer.canonicalPath,
                label: "Open Officer Candidate details",
                onActivate: (trigger: HTMLAnchorElement) => openModal("officer", trigger),
              } : undefined;

              return (
                <article className={className} data-record-id={entry.id} id={entry.id} key={`${entry.period}-${entry.organization}`}>
                  <TimelineEntry
                    entry={entry}
                    icon={timelineIcons[entry.organization]}
                    index={index}
                    detailLink={detailLink}
                  />
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <section className={`container university-section${blurred}`} aria-labelledby="resume-university-title">
        <h2 className="text-red text-center signal-fuzz" id="resume-university-title">
          <LegacyIcon name="graduation-cap" /> &nbsp;University&nbsp; <LegacyIcon name="graduation-cap" />
        </h2>
        <p className="lead text-center university-graduation">
          Graduated <time dateTime="2023-05">{resumeEducationOverview.graduated}</time>
        </p>
        <div className="university-chronology">
          <ol className="university-quarter-scale" aria-label="Four equal quarters of the degree">
            {[1, 2, 3, 4].map((quarter) => (
              <li aria-label={`Degree quarter ${quarter}`} data-degree-quarter={quarter} key={quarter}>
                <span aria-hidden="true">Q{quarter}</span>
              </li>
            ))}
          </ol>
          <ul className="university-chronology-list" aria-label="University degree, roles, and activities">
            {universityChronology.map((record) => (
              <UniversityChronologyEntry
                key={record.id}
                onActivate={record.detail ? (trigger) => openModal(record.detail!, trigger) : undefined}
                record={record}
              />
            ))}
          </ul>
        </div>
      </section>

      <div className={`container${blurred}`}>
        <section className="design-section-container" aria-label="Earlier experience">
          <div className="timeline">
            <article className="timeline-entry right" data-record-id="kettering-health-network-volunteer" id="kettering-health-network-volunteer">
              <h3>Volunteer</h3>
              <p>March 2019 – August 2019<br />Kettering Health Network</p>
              <LegacyIcon name="capsule" className="rotate-left timeline-icon signal-fuzz" />
            </article>
          </div>
        </section>
      </div>

      {(Object.entries(resumeDetails) as [ModalKey, (typeof resumeDetails)[ModalKey]][]).map(([id, content]) => (
        <div className="modal resume-modal" role="presentation" onPointerDown={closeModal} hidden={selected !== id} key={id}>
          <div ref={selected === id ? dialogRef : undefined} className="modal-content" id={`resume-modal-${id}`} role="dialog" aria-modal="true" aria-labelledby={`resume-modal-title-${id}`} aria-keyshortcuts="Escape" tabIndex={-1} onPointerDown={(event) => event.stopPropagation()}>
            <h3 id={`resume-modal-title-${id}`}>{content.title}</h3>
            {content.subtitle && <p className="lead text-center">{content.subtitle}</p>}
            <p className="small text-center">{content.period}</p>
            {id === "undergrad" ? <UndergraduateDetails /> : content.details.map((detail) => (
              <p key={detail}>{id === "ohiolink" && detail.startsWith("Won Poster") ? <small>{detail}</small> : detail}</p>
            ))}
            {id === "teaching" && <CourseChart />}
          </div>
        </div>
      ))}
    </>
  );
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

function TimelineEntry({
  entry,
  icon,
  index,
  detailLink,
}: {
  entry: (typeof timeline)[number];
  icon: LegacyIconName;
  index: number;
  detailLink?: {
    href: string;
    label: string;
    onActivate: (trigger: HTMLAnchorElement) => void;
  };
}) {
  const timelineIcon = (
    <LegacyIcon
      name={icon}
      className={`${index % 2 ? "rotate-right" : "rotate-left"} timeline-icon${detailLink ? "" : " signal-fuzz"}`}
    />
  );

  return (
    <>
      <h3>{entry.role}</h3>
      <p>{entry.period}<br />{entry.organization}</p>
      {entry.details.length > 0 && <p><small>{entry.details.map((detail) => <span key={detail}>{detail}<br /></span>)}</small></p>}
      {detailLink ? (
        <a
          className="timeline-icon-trigger signal-fuzz"
          aria-controls="resume-modal-officer"
          aria-haspopup="dialog"
          aria-label={detailLink.label}
          href={detailLink.href}
          onClick={(event) => {
            if (!shouldInterceptResumeModalLink(event)) return;
            event.preventDefault();
            detailLink.onActivate(event.currentTarget);
          }}
        >
          {timelineIcon}
        </a>
      ) : timelineIcon}
    </>
  );
}

function UniversityChronologyEntry({
  record,
  onActivate,
}: {
  record: UniversityChronologyRecord;
  onActivate?: (trigger: HTMLAnchorElement) => void;
}) {
  const geometry = deriveUniversityChronologyGeometry(record);
  const detail = record.detail ? resumeDetails[record.detail] : null;
  const titleId = `university-chronology-title-${record.id}`;
  const trackStyle = {
    "--university-start": universityChronologyPercent(geometry.startPercent),
    "--university-span": universityChronologyPercent(geometry.spanPercent),
  } as CSSProperties;
  const quarterLabel = geometry.endQuarter && geometry.endQuarter !== geometry.startQuarter
    ? `Q${geometry.startQuarter}–Q${geometry.endQuarter}`
    : `Q${geometry.startQuarter}`;
  const title = detail && onActivate ? (
    <a
      aria-controls={`resume-modal-${record.detail}`}
      aria-haspopup="dialog"
      href={detail.canonicalPath}
      onClick={(event) => {
        if (!shouldInterceptResumeModalLink(event)) return;
        event.preventDefault();
        onActivate(event.currentTarget);
      }}
    >
      {record.label}
    </a>
  ) : record.label;

  return (
    <li
      className={`university-chronology-entry${detail ? " university-chronology-entry--interactive" : ""}`}
      data-chronology-kind={geometry.kind}
      data-degree-quarter={geometry.startQuarter}
    >
      <article aria-labelledby={titleId}>
        <div className="university-chronology-heading">
          <h3 className="progress-label" id={titleId}>{title}</h3>
          <p className="university-chronology-period">
            <time dateTime={record.start}>{record.startLabel}</time>
            {record.end && record.endLabel ? (
              <> – <time dateTime={record.end}>{record.endLabel}</time></>
            ) : null}
            <span className="university-quarter-label" aria-label={`Degree ${quarterLabel}`}>
              {quarterLabel}
            </span>
          </p>
        </div>
        <div className="progress-bar-wrapper university-progress-track" aria-hidden="true">
          {geometry.kind === "interval" ? (
            <span
              className={`progress-bar-fill university-progress-span${record.gradient ? " background-gradient-green-blue" : ""}`}
              style={trackStyle}
            >
              <span className="progress-value">{record.startLabel}</span>
            </span>
          ) : (
            <span className="university-progress-point" style={trackStyle} />
          )}
        </div>
      </article>
    </li>
  );
}

function CourseChart() {
  const courses = [
    { label: resumeDetails.teaching.courses[0], manifest: "technology-ethics-global-society", percent: 20, tone: "red-orange" },
    { label: resumeDetails.teaching.courses[1], manifest: "software-engineering-ui-ux", percent: 34, tone: "blue-green" },
    { label: resumeDetails.teaching.courses[2], manifest: "introduction-software-engineering", percent: 46, tone: "storm-gray" },
  ] as const;

  return (
    <figure className="teaching-manifest" aria-labelledby="teaching-manifest-title">
      <figcaption id="teaching-manifest-title">
        <span aria-hidden="true">teaching.support</span>
        <span className="sr-only">Courses supported and their share of the Teaching Assistant appointment</span>
      </figcaption>
      <ol className="teaching-manifest-list">
        {courses.map((course, index) => (
          <li className={`teaching-manifest-entry teaching-manifest-entry--${course.tone}`} key={course.manifest}>
            <div className="teaching-manifest-line">
              <span className="teaching-manifest-branch" aria-hidden="true">{index === courses.length - 1 ? "└─" : "├─"}</span>
              <span className="teaching-manifest-key" aria-hidden="true">{course.manifest}</span>
              <span className="sr-only">{course.label}</span>
              <span className="teaching-manifest-percent">{course.percent}%</span>
            </div>
            <div className="teaching-manifest-track" aria-hidden="true">
              <span className="teaching-manifest-fill" style={{ "--teaching-support": `${course.percent}%` } as CSSProperties}>
                <span className="teaching-manifest-caret" />
              </span>
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}
