"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { LegacyIcon, type LegacyIconName } from "../components/LegacyIcon";
import { timeline } from "../data";
import { resumeEducationOverview } from "../content/siteContent.js";
import { resumeDetails } from "./resumeDetails.js";

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

      <div className={`container${blurred}`}>
        <h2 className="text-red text-center signal-fuzz" style={{ marginTop: "-3vh" }}>
          <LegacyIcon name="graduation-cap" /> &nbsp;University&nbsp; <LegacyIcon name="graduation-cap" />
        </h2>
        <p className="lead text-center" style={{ marginBottom: "9vh" }}>Graduated {resumeEducationOverview.graduated}</p>
        {resumeEducationOverview.activities.map((activity, index) => (
          <Progress label={activity.label} start={activity.start} width={index === 0 ? "49%" : "22%"} key={activity.label} />
        ))}
        <Progress label="OhioLINK Luminary" start="August 2021" width="49%" href={resumeDetails.ohiolink.canonicalPath} onClick={(trigger) => openModal("ohiolink", trigger)} />
        <Progress label="B.A. Computer Science – Miami University" start="August 2019" width="100%" href={resumeDetails.undergrad.canonicalPath} gradient onClick={(trigger) => openModal("undergrad", trigger)} />
        <Progress label="Teaching Assistant" start="May 2022" width="29%" href={resumeDetails.teaching.canonicalPath} onClick={(trigger) => openModal("teaching", trigger)} />
      </div>

      <div className={`container${blurred}`}>
        <section className="design-section-container" aria-label="Earlier experience">
          <div className="timeline">
            <article className="timeline-entry right" data-record-id="kettering-health-network-volunteer">
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

function Progress({ label, start, width, gradient = false, href, onClick }: { label: string; start: string; width: string; gradient?: boolean; href?: string; onClick?: (trigger: HTMLAnchorElement) => void }) {
  const className = `progress-bar-fill ml-auto ${gradient ? "background-gradient-green-blue" : ""}`;
  return (
    <div className="progress-container">
      <div className="progress-bar-wrapper rounded-0">
        {onClick && href ? (
          <a
            aria-label={`${label}, beginning ${start}`}
            className={`${className} button-reset`}
            style={{ width }}
            href={href}
            onClick={(event) => {
              if (!shouldInterceptResumeModalLink(event)) return;
              event.preventDefault();
              onClick(event.currentTarget);
            }}
          ><span className="progress-value" aria-hidden="true">{start}</span></a>
        ) : (
          <div className={className} style={{ width, cursor: "auto" }}><span className="progress-value">{start}</span></div>
        )}
      </div>
      <div className="progress-label">{label}</div>
    </div>
  );
}

function CourseChart() {
  return (
    <div className="progress-container">
      <svg viewBox="0 0 36 36" className="circular-chart signal-fuzz" aria-label="Courses supported">
        <circle className="circle-background" cx="18" cy="18" r="15.9155" fill="none" stroke="#efefef" strokeWidth="2" />
        <circle className="circle-3" cx="18" cy="18" r="15.9155" fill="none" stroke="#950F22" strokeWidth="2" strokeDasharray="73, 27" strokeDashoffset="0" />
        <circle className="circle-2" cx="18" cy="18" r="15.9155" fill="none" stroke="#077995" strokeWidth="2" strokeDasharray="17, 83" strokeDashoffset="17.5" />
        <circle className="circle-1" cx="18" cy="18" r="15.9155" fill="none" stroke="#6c757d" strokeWidth="2" strokeDasharray="10, 90" strokeDashoffset="26.5" />
      </svg>
      <div className="labelContainer small">
        {resumeDetails.teaching.courses.map((course, index) => (
          <span className={`label ${["text-blue", "text-red", "text-secondary"][index]} signal-fuzz`} key={course}>
            {course}{index < resumeDetails.teaching.courses.length - 1 ? <br /> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
