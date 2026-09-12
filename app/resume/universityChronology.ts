import { resumeEducationOverview } from "../content/siteContent.js";
import { timeline } from "../data.ts";
import { resumeDetails } from "./resumeDetails.js";

export const UNDERGRADUATE_INTERVAL = Object.freeze({
  start: "2019-08",
  end: "2023-05",
});

export type UniversityChronologyRecord = Readonly<{
  id: string;
  label: string;
  start: string;
  startLabel: string;
  end: string | null;
  endLabel: string | null;
  detail: keyof typeof resumeDetails | null;
  gradient?: boolean;
  displayQuarters?: readonly [1 | 2 | 3 | 4, 1 | 2 | 3 | 4];
}>;

export type UniversityChronologyGeometry = Readonly<{
  kind: "interval" | "point";
  startPercent: number;
  spanPercent: number;
  startQuarter: 1 | 2 | 3 | 4;
  endQuarter: 1 | 2 | 3 | 4 | null;
}>;

function timelineRecord(id: string) {
  const record = timeline.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`Missing University chronology source: ${id}`);
  return record;
}

function activityRecord(label: string) {
  const record = resumeEducationOverview.activities.find((candidate) => candidate.label === label);
  if (!record) throw new Error(`Missing University chronology activity: ${label}`);
  return record;
}

const digitalHumanities = activityRecord("Digital Humanities Forum Committee");
const diversityEquityInclusion = activityRecord("Diversity, Equity, and Inclusion Committee");
const ohiolink = timelineRecord("ohiolink-luminary");
const teaching = timelineRecord("miami-university-undergraduate-teaching-assistant");

export const universityChronology = Object.freeze<readonly UniversityChronologyRecord[]>([
  Object.freeze({
    id: "miami-university-degree",
    label: "B.A. Computer Science – Miami University",
    start: UNDERGRADUATE_INTERVAL.start,
    startLabel: "August 2019",
    end: UNDERGRADUATE_INTERVAL.end,
    endLabel: "May 2023",
    detail: "undergrad",
    gradient: true,
    displayQuarters: Object.freeze([1, 4] as const),
  }),
  Object.freeze({
    id: "digital-humanities-forum-committee",
    label: digitalHumanities.label,
    start: "2021-08",
    startLabel: digitalHumanities.start,
    end: "2022-05",
    endLabel: "May 2022",
    detail: null,
    displayQuarters: Object.freeze([3, 3] as const),
  }),
  Object.freeze({
    id: ohiolink.id,
    label: ohiolink.role,
    start: ohiolink.start,
    startLabel: "August 2021",
    end: ohiolink.end,
    endLabel: "May 2023",
    detail: "ohiolink",
    gradient: true,
    displayQuarters: Object.freeze([3, 4] as const),
  }),
  Object.freeze({
    id: teaching.id,
    label: "Teaching Assistant",
    start: teaching.start,
    startLabel: "May 2022",
    end: teaching.end,
    endLabel: "May 2023",
    detail: "teaching",
  }),
  Object.freeze({
    id: "diversity-equity-inclusion-committee",
    label: diversityEquityInclusion.label,
    start: "2022-08",
    startLabel: diversityEquityInclusion.start,
    end: "2023-05",
    endLabel: "May 2023",
    detail: null,
    displayQuarters: Object.freeze([4, 4] as const),
  }),
]);

function monthIndex(value: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/u.exec(value);
  if (!match) throw new TypeError(`Expected a YYYY-MM date, received ${value}`);
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function deriveUniversityChronologyGeometry(
  record: Pick<UniversityChronologyRecord, "start" | "end" | "displayQuarters">,
  interval = UNDERGRADUATE_INTERVAL,
): UniversityChronologyGeometry {
  const intervalStart = monthIndex(interval.start);
  const intervalEndExclusive = monthIndex(interval.end) + 1;
  const duration = intervalEndExclusive - intervalStart;
  if (duration <= 0) throw new RangeError("The University chronology interval must have a positive duration");

  const recordStart = monthIndex(record.start);
  if (recordStart < intervalStart || recordStart >= intervalEndExclusive) {
    throw new RangeError("A University chronology start must fall inside the degree interval");
  }

  const startOffset = recordStart - intervalStart;
  const startPercent = startOffset / duration * 100;
  const startQuarter = clamp(Math.floor(startPercent / 25) + 1, 1, 4) as 1 | 2 | 3 | 4;

  if (record.end === null) {
    if (record.displayQuarters) {
      throw new RangeError("A point event cannot claim a University chronology display interval");
    }
    return Object.freeze({ kind: "point", startPercent, spanPercent: 0, startQuarter, endQuarter: null });
  }

  const recordEnd = monthIndex(record.end);
  if (recordEnd < recordStart) {
    throw new RangeError("A University chronology end cannot precede its start");
  }
  if (recordEnd >= intervalEndExclusive) {
    throw new RangeError("A University chronology end cannot exceed the degree interval");
  }

  if (record.displayQuarters) {
    const [displayStartQuarter, displayEndQuarter] = record.displayQuarters;
    if (displayEndQuarter < displayStartQuarter) {
      throw new RangeError("A University chronology display quarter cannot precede its start quarter");
    }
    return Object.freeze({
      kind: "interval",
      startPercent: (displayStartQuarter - 1) * 25,
      spanPercent: (displayEndQuarter - displayStartQuarter + 1) * 25,
      startQuarter: displayStartQuarter,
      endQuarter: displayEndQuarter,
    });
  }

  const endOffset = recordEnd + 1 - intervalStart;
  const endQuarter = clamp(Math.ceil(endOffset / duration * 4), 1, 4) as 1 | 2 | 3 | 4;
  return Object.freeze({
    kind: "interval",
    startPercent,
    spanPercent: (endOffset - startOffset) / duration * 100,
    startQuarter,
    endQuarter,
  });
}

export function universityChronologyPercent(value: number) {
  return `${Number(value.toFixed(4))}%`;
}
