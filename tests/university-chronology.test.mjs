import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  UNDERGRADUATE_INTERVAL,
  deriveUniversityChronologyGeometry,
  universityChronology,
} from "../app/resume/universityChronology.ts";

const record = (id) => {
  const match = universityChronology.find((candidate) => candidate.id === id);
  assert.ok(match, `chronology record ${id} exists`);
  return match;
};

test("RTD-015: University chronology derives four-quarter placement from verified dates", () => {
  assert.deepEqual(UNDERGRADUATE_INTERVAL, { start: "2019-08", end: "2023-05" });

  const degree = deriveUniversityChronologyGeometry(record("miami-university-degree"));
  assert.equal(degree.kind, "interval");
  assert.equal(degree.startPercent, 0);
  assert.equal(degree.spanPercent, 100);
  assert.equal(degree.startQuarter, 1);
  assert.equal(degree.endQuarter, 4);

  const digitalHumanities = deriveUniversityChronologyGeometry(record("digital-humanities-forum-committee"));
  assert.equal(digitalHumanities.kind, "interval");
  assert.equal(digitalHumanities.spanPercent, 25);
  assert.equal(digitalHumanities.startPercent, 50);
  assert.equal(digitalHumanities.startQuarter, 3, "August 2021 begins in the degree's third quarter");
  assert.equal(digitalHumanities.endQuarter, 3);

  const diversity = deriveUniversityChronologyGeometry(record("diversity-equity-inclusion-committee"));
  assert.equal(diversity.kind, "interval");
  assert.equal(diversity.spanPercent, 25);
  assert.equal(diversity.startPercent, 75);
  assert.equal(diversity.startQuarter, 4);
  assert.equal(diversity.endQuarter, 4);

  const ohiolink = deriveUniversityChronologyGeometry(record("ohiolink-luminary"));
  assert.equal(ohiolink.kind, "interval");
  assert.equal(ohiolink.startPercent, 50);
  assert.equal(ohiolink.spanPercent, 50);
  assert.equal(ohiolink.startQuarter, 3);
  assert.equal(ohiolink.endQuarter, 4);
  assert.equal(record("ohiolink-luminary").gradient, true, "Luminary retains the blue-green rill");

  const teaching = deriveUniversityChronologyGeometry(record("miami-university-undergraduate-teaching-assistant"));
  assert.equal(teaching.kind, "interval");
  assert.equal(teaching.startPercent, 33 / 46 * 100);
  assert.equal(teaching.spanPercent, 13 / 46 * 100);
  assert.equal(teaching.startQuarter, 3);
  assert.equal(teaching.endQuarter, 4);
});

test("GATE-D09: date geometry fails closed instead of drawing indefensible spans", () => {
  assert.throws(
    () => deriveUniversityChronologyGeometry({ start: "August 2021", end: null }),
    /YYYY-MM/u,
  );
  assert.throws(
    () => deriveUniversityChronologyGeometry({ start: "2019-07", end: null }),
    /inside the degree interval/u,
  );
  assert.throws(
    () => deriveUniversityChronologyGeometry({ start: "2021-08", end: "2021-07" }),
    /cannot precede/u,
  );
  assert.throws(
    () => deriveUniversityChronologyGeometry({ start: "2021-08", end: "2023-06" }),
    /cannot exceed/u,
  );
  assert.throws(
    () => deriveUniversityChronologyGeometry(
      { start: "2021-08", end: null },
      { start: "2023-05", end: "2019-08" },
    ),
    /positive duration/u,
  );
  assert.throws(
    () => deriveUniversityChronologyGeometry({ start: "2021-08", end: "2022-05", displayQuarters: [4, 3] }),
    /display quarter cannot precede/u,
  );
});

test("the modernized University view keeps semantic time, disclosure, and visual contracts", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/resume/ResumeExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /<section className=\{`container university-section\$\{blurred\}`\} aria-labelledby="resume-university-title">/u);
  assert.match(source, /<ol className="university-quarter-scale" aria-label="Four equal quarters of the degree">/u);
  assert.match(source, /<li aria-label=\{`Degree quarter \$\{quarter\}`\} data-degree-quarter=\{quarter\} key=\{quarter\}>[\s\S]*?<span aria-hidden="true">Q\{quarter\}<\/span>/u);
  assert.match(source, /<ul className="university-chronology-list" aria-label="University degree, roles, and activities">/u);
  assert.match(source, /<time dateTime="2023-05">\{resumeEducationOverview\.graduated\}<\/time>/u);
  assert.match(source, /<time dateTime=\{record\.start\}>\{record\.startLabel\}<\/time>/u);
  assert.match(source, /<time dateTime=\{record\.end\}>\{record\.endLabel\}<\/time>/u);
  assert.match(source, /data-chronology-kind=\{geometry\.kind\}/u);
  assert.match(source, /data-degree-quarter=\{geometry\.startQuarter\}/u);
  assert.match(source, /const quarterLabel = geometry\.endQuarter && geometry\.endQuarter !== geometry\.startQuarter/u);
  assert.match(source, /aria-label=\{`Degree \$\{quarterLabel\}`\}/u);
  assert.match(source, /geometry\.kind === "interval"[\s\S]*?university-progress-span[\s\S]*?: \([\s\S]*?university-progress-point/u);
  assert.match(source, /aria-controls=\{`resume-modal-\$\{record\.detail\}`\}[\s\S]*?aria-haspopup="dialog"[\s\S]*?href=\{detail\.canonicalPath\}/u);
  assert.doesNotMatch(source, /width=\{(?:"49%"|"22%"|"29%"|"100%")\}/u, "manual chronology widths stay retired");

  assert.match(css, /\.university-quarter-scale \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/u);
  assert.match(css, /\.university-progress-track \{[\s\S]*?background-color: transparent;[\s\S]*?height: 20px;/u);
  assert.match(css, /\.university-progress-span \{[\s\S]*?display: block;[\s\S]*?left: var\(--university-start\);[\s\S]*?width: var\(--university-span\);/u);
  assert.match(css, /\.university-progress-span\.background-gradient-green-blue \{[\s\S]*?position: absolute;/u);
  assert.match(css, /\.university-progress-span\.background-gradient-green-blue::before \{[\s\S]*?background-size: 3px 3px, 3px 3px, 6px 6px, 6px 6px, 12px 12px, 12px 12px;[\s\S]*?opacity: \.2;/u);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\.university-progress-span\.background-gradient-green-blue::before \{\s*animation: static \.1s steps\(20\) infinite;/u);
  assert.match(css, /\.university-progress-point \{[\s\S]*?left: var\(--university-start\);[\s\S]*?transform: translateX\(-50%\);/u);
  assert.match(css, /\.university-chronology-entry \.progress-label \{[\s\S]*?text-align: right;/u);
  assert.match(css, /\.university-chronology-entry \.progress-label a \{[\s\S]*?display: inline-flex;[\s\S]*?min-height: 24px;/u);
  assert.match(source, /background-gradient-green-blue/u, "the degree retains the established gradient language");
});
