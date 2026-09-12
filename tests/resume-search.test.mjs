import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resumeEducationOverview } from "../app/content/siteContent.js";
import { skillStacks, timeline } from "../app/data.ts";
import { normalizeSearchText, searchOntology } from "../app/search/ontologySearch.ts";
import { projects } from "../app/resume/projects.js";
import { resumeDetailList } from "../app/resume/resumeDetails.js";
import {
  RESUME_SEARCH_CLASS_ORDER,
  resumeSearchAttachmentCoverageContract,
  resumeSearchCoverage,
  resumeSearchIndex,
} from "../app/resume/resumeSearchOntology.ts";

const search = (query) => searchOntology(resumeSearchIndex, query);

test("Resume Search covers every canonical content class and preserves evidence provenance", () => {
  assert.deepEqual(resumeSearchCoverage, {
    projects: 12,
    experiences: 8,
    skills: 9,
    education: 5,
    evidence: 1672,
  });
  for (const indexed of resumeSearchIndex.records) {
    assert.ok(indexed.record.evidence.length > 0, indexed.record.id);
    for (const item of indexed.record.evidence) {
      assert.ok(item.sourcePath.startsWith("app/"));
      assert.ok(item.fieldPath);
    }
  }
  const evidenceText = new Set(resumeSearchIndex.records.flatMap(({ record }) => record.evidence.map(({ text }) => text)));
  for (const detail of resumeDetailList) {
    for (const text of [...detail.details, ...(detail.courses ?? [])]) assert.ok(evidenceText.has(text), text);
  }

  const evidencePaths = new Set(resumeSearchIndex.records.flatMap(({ record }) => record.evidence.map(
    ({ sourcePath, fieldPath }) => `${sourcePath}:${fieldPath}`,
  )));
  const expectPath = (sourcePath, fieldPath) => assert.ok(
    evidencePaths.has(`${sourcePath}:${fieldPath}`),
    `${sourcePath}:${fieldPath}`,
  );

  projects.forEach((project, projectIndex) => {
    for (const field of ["id", "slug", "name", "type", "canonicalPath", "url", "thesis", "status"]) {
      expectPath("app/resume/projects.js", `projects[${projectIndex}].${field}`);
    }
    for (const field of ["summary", "capabilities", "technologies", "evidence", "limitations", "emphasis"]) {
      project[field].forEach((_value, index) => expectPath("app/resume/projects.js", `projects[${projectIndex}].${field}[${index}]`));
    }
    project.relationships.forEach((_relationship, index) => {
      for (const field of ["relation", "target", "scope"]) expectPath("app/resume/projects.js", `projects[${projectIndex}].relationships[${index}].${field}`);
    });
    project.resources.forEach((resource, index) => {
      for (const field of ["id", "artifactId", "label", "title", "url", "markdownUrl", "htmlMediaType", "markdownMediaType", "scope"]) {
        if (typeof resource[field] === "string" && resource[field].trim()) {
          expectPath("app/resume/projects.js", `projects[${projectIndex}].resources[${index}].${field}`);
        }
      }
    });
    for (const field of ["label", "value", "start", "end", "precision"]) {
      if (typeof project.publication[field] !== "string") continue;
      expectPath("app/resume/projects.js", `projects[${projectIndex}].publication.${field}`);
    }
  });

  timeline.forEach((entry, timelineIndex) => {
    for (const field of ["role", "engagementKind", "organization", "period"]) {
      expectPath("app/data.ts", `timeline[${timelineIndex}].${field}`);
    }
    entry.details.forEach((_value, index) => expectPath("app/data.ts", `timeline[${timelineIndex}].details[${index}]`));
  });
  skillStacks.forEach((stack, stackIndex) => {
    expectPath("app/data.ts", `skillStacks[${stackIndex}].title`);
    stack.items.forEach((_value, index) => expectPath("app/data.ts", `skillStacks[${stackIndex}].items[${index}]`));
    stack.sections.forEach((section, sectionIndex) => {
      expectPath("app/data.ts", `skillStacks[${stackIndex}].sections[${sectionIndex}].label`);
      section.items.forEach((_value, itemIndex) => expectPath("app/data.ts", `skillStacks[${stackIndex}].sections[${sectionIndex}].items[${itemIndex}]`));
    });
  });
  expectPath("app/content/siteContent.js", "resumeEducationOverview.graduated");
  resumeEducationOverview.activities.forEach((_activity, index) => {
    expectPath("app/content/siteContent.js", `resumeEducationOverview.activities[${index}].label`);
    expectPath("app/content/siteContent.js", `resumeEducationOverview.activities[${index}].start`);
  });

  const corrections = resumeSearchIndex.records.find(
    ({ record }) => record.id === "resume-timeline-madison-correctional-facility-corrections-officer",
  )?.record;
  assert.ok(corrections);
  const authoredConditions = corrections.evidence.filter(
    ({ fieldPath }) => fieldPath.startsWith('TIMELINE_AUTHORED_SEARCH_METADATA["madison-correctional-facility-corrections-officer"]'),
  );
  assert.deepEqual(authoredConditions.map(({ text, fieldPath, strength, conceptIds }) => ({
    text,
    fieldPath,
    strength,
    conceptIds,
  })), [
    {
      text: "Shift work",
      fieldPath: "TIMELINE_AUTHORED_SEARCH_METADATA[\"madison-correctional-facility-corrections-officer\"][0]",
      strength: "curated",
      conceptIds: ["shift-work"],
    },
    {
      text: "Night shift",
      fieldPath: "TIMELINE_AUTHORED_SEARCH_METADATA[\"madison-correctional-facility-corrections-officer\"][1]",
      strength: "curated",
      conceptIds: ["night-shift"],
    },
    {
      text: "Long shifts",
      fieldPath: "TIMELINE_AUTHORED_SEARCH_METADATA[\"madison-correctional-facility-corrections-officer\"][2]",
      strength: "curated",
      conceptIds: ["long-shift"],
    },
    {
      text: "12-plus-hour shifts",
      fieldPath: "TIMELINE_AUTHORED_SEARCH_METADATA[\"madison-correctional-facility-corrections-officer\"][3]",
      strength: "curated",
      conceptIds: ["long-shift"],
    },
    {
      text: "Government service",
      fieldPath: "TIMELINE_AUTHORED_SEARCH_METADATA[\"madison-correctional-facility-corrections-officer\"][4]",
      strength: "curated",
      conceptIds: ["government", "government-service"],
    },
    {
      text: "First responder",
      fieldPath: "TIMELINE_AUTHORED_SEARCH_METADATA[\"madison-correctional-facility-corrections-officer\"][5]",
      strength: "curated",
      conceptIds: ["first-response"],
    },
    {
      text: "Thin Blue Line",
      fieldPath: "TIMELINE_AUTHORED_SEARCH_METADATA[\"madison-correctional-facility-corrections-officer\"][6]",
      strength: "curated",
      conceptIds: ["uniformed-public-safety"],
    },
    {
      text: "Institutional security, policy enforcement, and incident documentation",
      fieldPath: "TIMELINE_AUTHORED_SEARCH_METADATA[\"madison-correctional-facility-corrections-officer\"][7]",
      strength: "curated",
      conceptIds: ["institutional-security", "policy-enforcement", "incident-documentation"],
    },
    {
      text: "De-escalation, crisis communication, situational awareness, and conflict management",
      fieldPath: "TIMELINE_AUTHORED_SEARCH_METADATA[\"madison-correctional-facility-corrections-officer\"][8]",
      strength: "curated",
      conceptIds: ["de-escalation", "communications", "situational-awareness"],
    },
    {
      text: "High-pressure operations and real-time decision-making",
      fieldPath: "TIMELINE_AUTHORED_SEARCH_METADATA[\"madison-correctional-facility-corrections-officer\"][9]",
      strength: "curated",
      conceptIds: ["resilience", "resilient-systems", "high-consequence-systems"],
    },
    {
      text: "Public service",
      fieldPath: "TIMELINE_AUTHORED_SEARCH_METADATA[\"madison-correctional-facility-corrections-officer\"][10]",
      strength: "curated",
      conceptIds: ["public-service"],
    },
    {
      text: "Officer, corrections",
      fieldPath: "TIMELINE_AUTHORED_SEARCH_METADATA[\"madison-correctional-facility-corrections-officer\"][11]",
      strength: "curated",
      conceptIds: ["corrections"],
    },
  ]);

  const fogOfSea = resumeSearchIndex.records.find(
    ({ record }) => record.id === "resume-project-fog-of-sea",
  )?.record;
  assert.ok(fogOfSea);
  const fogAuthored = fogOfSea.evidence
    .filter(({ fieldPath }) => fieldPath.startsWith('PROJECT_AUTHORED_SEARCH_METADATA["fog-of-sea"]'))
    .map(({ text, strength, conceptIds }) => ({ text, strength, conceptIds }));
  assert.deepEqual(fogAuthored.slice(0, 4), [
    { text: "Naval wargaming", strength: "curated", conceptIds: ["wargaming"] },
    { text: "Decision-making under uncertainty", strength: "curated", conceptIds: ["decision-under-uncertainty"] },
    { text: "Human factors in command decisions", strength: "curated", conceptIds: ["human-factors"] },
    { text: "Human-computer interaction", strength: "curated", conceptIds: ["human-computer-interaction"] },
  ]);
  assert.ok(fogAuthored.every(({ strength }) => strength === "curated"));

  const recordIds = resumeSearchIndex.records.map(({ record }) => record.id);
  assert.equal(new Set(recordIds).size, 34, "expanded timeline details merge into canonical records");
  for (const { record } of resumeSearchIndex.records) {
    const normalizedEvidence = record.evidence.map(({ text }) => normalizeSearchText(text));
    for (const displayed of [record.title, record.subtitle].filter(Boolean)) {
      const normalizedDisplayed = normalizeSearchText(displayed);
      assert.ok(
        normalizedEvidence.some((item) => item.includes(normalizedDisplayed)),
        `${record.id} must index displayed value: ${displayed}`,
      );
    }
  }
});

test("Resume Search preserves every applicable term from the supplied metadata handoff", () => {
  assert.equal(resumeSearchAttachmentCoverageContract.length, 62);
  assert.equal(
    resumeSearchAttachmentCoverageContract.reduce((total, entry) => total + entry.terms.length, 0),
    829,
  );
  const records = new Map(resumeSearchIndex.records.map(({ record }) => [record.id, record]));
  for (const entry of resumeSearchAttachmentCoverageContract) {
    const record = records.get(entry.recordId);
    assert.ok(record, entry.recordId);
    const indexedTerms = new Set(record.evidence
      .filter(({ fieldPath }) => fieldPath.startsWith(`resumeSearchAttachmentCoverageContract.${entry.sourceId}.terms[`))
      .map(({ text }) => normalizeSearchText(text)));
    for (const term of entry.terms) assert.ok(indexedTerms.has(normalizeSearchText(term)), `${entry.sourceId}: ${term}`);
  }
});

test("Resume Search retrieves exact courses, recruiter vocabulary, typo variants, symbols, and time", () => {
  assert.ok(search("Technology Ethics Global Society").some(({ record }) => record.title === "Undergraduate Teaching Assistant"));
  assert.ok(search("technical writer").some(({ record }) => record.title === "Technical Documentation and Modeling"));
  assert.ok(search("accesibility").some(({ record }) => record.title === "Interaction and Service Design"));
  assert.deepEqual(search("C++").filter(({ record }) => record.class === "Skills").map(({ record }) => record.title), ["Software Development"]);
  assert.deepEqual(search("current").map(({ record }) => `${record.class}:${record.title}`), [
    "Projects:Medium",
    "Experiences:Corrections Officer",
    "Education:Continuing Education",
  ]);
  assert.equal(search("2026").filter(({ record }) => record.class === "Projects").length, 6);
  assert.ok(search("September 2026").some(({ record }) => record.title === "Lattice"));
  assert.ok(search("B.A. Computer Science").some(({ record }) => record.id === "resume-education-miami-university"));
  assert.ok(search("infrmation architecture").some(({ record }) => record.title === "Interaction and Service Design"));
  assert.deepEqual(
    search("sofwtare").map(({ record }) => record.id),
    search("software").map(({ record }) => record.id),
    "a typo shared by multiple Software concepts retains the corrected-prefix fanout",
  );
  assert.ok(search("informtion").some(({ record }) => record.title === "Interaction and Service Design"));
  assert.ok(search("accesib").some(({ record }) => record.title === "Interaction and Service Design"));
  assert.deepEqual(
    search("offcier").filter(({ record }) => record.class === "Experiences").map(({ record }) => record.title).sort(),
    ["Corrections Officer", "Officer Candidate"].sort(),
  );
  assert.equal(search("work").some(({ record }) => record.title === "Medium"), false);
  assert.equal(search("UX").some(({ record }) => record.title === "Officer Candidate"), false);
  assert.equal(search("Information Architecture").some(({ record }) => record.title === "Officer Candidate"), false);
  assert.equal(search("Information Architecture").some(({ record }) => record.title === "Evenward.rest"), false);
  assert.equal(search("Systems").some(({ record }) => record.title === "Volunteer"), false);
  assert.equal(search("Systems").some(({ record }) => record.subtitle === "American Public University System"), false);
  assert.equal(search("Systems Architecture").some(({ record }) => record.title === "Officer Candidate"), false);
  assert.equal(search("Requirements Engineering").some(({ record }) => record.title === "Officer Candidate"), false);
  assert.equal(search("Software Development").some(({ record }) => record.title === "Business Analysis and Operational Planning"), false);
  assert.equal(search("Teaching").some(({ record }) => record.title === "Business Analysis and Operational Planning"), false);
  assert.equal(search("Teaching").some(({ record }) => record.title === "Officer Candidate"), false);
  assert.equal(search("Business Analysis").some(({ record }) => record.title === "Continuing Education"), false);
  assert.ok(search("work").every(({ record }) => record.class === "Experiences"));
  assert.ok(search("Kettering Health Network").some(({ record }) => record.title === "Volunteer"));
  assert.ok(search("American Public University System").some(({ record }) => record.title === "Student"));
  assert.ok(search("training").some(({ record }) => record.title === "Officer Candidate"));
  assert.ok(search("work under pressure").some(({ record }) => record.title === "Medium"));
  assert.ok(search("knowledge").some(({ record }) => record.title === "Evenward.rest"));
  assert.ok(search("Risk Assessment").some(({ record }) => record.title === "Business Analysis and Operational Planning"));
  assert.ok(search("Proposal Development").some(({ record }) => record.title === "Business Analysis and Operational Planning"));
  assert.ok(search("Standards Compliance").some(({ record }) => record.title === "Officer Candidate"));
  assert.ok(resumeSearchIndex.records
    .filter(({ record }) => record.class === "Projects")
    .every(({ record }) => record.subtitle === undefined), "schema.org project types are search evidence, not display labels");
});

test("Resume recruiter concepts retain precise shift, corrections, emergency, and interface boundaries", () => {
  const experienceTitles = (query) => search(query)
    .filter(({ record }) => record.class === "Experiences")
    .map(({ record }) => record.title);

  for (const query of [
    "shift work",
    "night",
    "night shift",
    "overnight work",
    "long shifts",
    "12-hour shift",
    "12 hr shifts",
    "twelve-hour shift",
    "12 plus hour shifts",
    "12+ hour shifts",
    "extended hours",
    "long hours",
  ]) {
    assert.ok(experienceTitles(query).includes("Corrections Officer"), query);
  }

  for (const query of ["corrections", "corections", "correctional services"]) {
    const titles = experienceTitles(query);
    assert.ok(titles.includes("Corrections Officer"), query);
    assert.equal(titles.includes("Officer Candidate"), false, query);
  }

  for (const query of ["shfit work", "night shfit", "long shfts", "12-hour shfts"]) {
    assert.ok(experienceTitles(query).includes("Corrections Officer"), query);
  }

  for (const query of ["night school", "long form", "shift UX", "shift work UX"]) {
    assert.equal(experienceTitles(query).includes("Corrections Officer"), false, query);
  }

  assert.ok(search("public safety").some(({ record }) => record.title === "Corrections Officer"));
  assert.ok(search("public safety").some(({ record }) => record.title === "Officer Candidate"));
  assert.ok(search("emergency operations").some(({ record }) => record.title === "Officer Candidate"));
  assert.equal(search("emergency operations").some(({ record }) => record.title === "Corrections Officer"), false);

  assert.equal(search("web").some(({ record }) => record.title === "Undergraduate Teaching Assistant"), false);
  assert.ok(search("UX").some(({ record }) => record.title === "Undergraduate Teaching Assistant"));
  assert.ok(search("user interface").some(({ record }) => record.title === "Undergraduate Teaching Assistant"));
});

test("Resume public-service and wargaming access points are precise, typo-tolerant, and record-scoped", () => {
  const ids = (query) => search(query).map(({ record }) => record.id);
  const corrections = "resume-timeline-madison-correctional-facility-corrections-officer";
  const officerCandidate = "resume-timeline-united-states-navy-officer-candidate";
  const tartu = "resume-timeline-university-of-tartu-student-researcher";
  const fog = "resume-project-fog-of-sea";
  const kings = "resume-timeline-kings-college-london-grand-strategy";

  for (const query of ["first responder", "frist responder", "thin blue line", "thni blue line"]) {
    assert.deepEqual(ids(query), [corrections], query);
  }
  for (const query of ["government", "goverment"]) {
    assert.deepEqual(ids(query), [corrections, officerCandidate, tartu], query);
  }
  for (const query of ["wargaming", "war gaming", "wargming"]) {
    assert.deepEqual(ids(query), [fog, kings], query);
  }

  assert.deepEqual(ids("government service"), [corrections, officerCandidate]);
  assert.deepEqual(ids("digital government"), [tartu]);
  assert.deepEqual(ids("first response time"), []);
  assert.deepEqual(ids("blue line railway"), []);
  assert.deepEqual(ids("government UX"), []);
  assert.equal(ids("government").some((id) => id.includes("substitute-teacher") || id.includes("public-library")), false);
  assert.equal(ids("wargaming").includes("resume-project-chorus"), false);
  assert.equal(ids("wargaming").includes("resume-timeline-american-public-university-system-student"), false);
});

test("Resume subject ontology exposes high-value occupational paths without adjacent-domain leakage", () => {
  const ids = (query) => search(query).map(({ record }) => record.id);
  const fog = "resume-project-fog-of-sea";
  const chorus = "resume-project-chorus";
  const inKeeping = "resume-project-in-keeping";
  const lattice = "resume-project-lattice";
  const evenward = "resume-project-evenward";
  const officerCandidate = "resume-timeline-united-states-navy-officer-candidate";
  const corrections = "resume-timeline-madison-correctional-facility-corrections-officer";
  const kings = "resume-timeline-kings-college-london-grand-strategy";
  const tartu = "resume-timeline-university-of-tartu-student-researcher";
  const germantown = "resume-timeline-germantown-public-library-intern";
  const ohioLink = "resume-timeline-ohiolink-luminary";
  const wisconsin = "resume-timeline-uw-madison-ischool-continuing-education";
  const systems = "resume-skill-systems-architecture";
  const security = "resume-skill-security-and-verification";
  const data = "resume-skill-data-architecture-and-interoperability";
  const miami = "resume-education-miami-university";
  const chromebook = "resume-project-chromebook-management";
  const freedomSummer = "resume-project-finding-freedom-summer-traveling-exhibit";
  const comparativeDatabases = "resume-project-comparative-database-design-and-data-analytics";

  const matrices = [
    [["strategic communications", "strategic comms", "StratCom", "information operations", "narrative influence"], [chorus, kings]],
    [["decision-making under uncertainty"], [fog, chorus, officerCandidate, kings]],
    [["scenario design", "adjudication", "decision support"], [fog, kings]],
    [["multi-agent", "multi agent", "agent-based simulation"], [chorus, systems]],
    [["library technology"], [chromebook, freedomSummer, inKeeping, germantown, ohioLink, wisconsin]],
    [["systems librarian"], [inKeeping, germantown, ohioLink, wisconsin]],
    [["web services librarian"], [freedomSummer, inKeeping, ohioLink]],
    [["digital preservation", "archive continuity", "digitization", "DAM"], [inKeeping, wisconsin]],
    [["metadata"], [inKeeping, ohioLink, germantown, data, wisconsin]],
    [["information retrieval"], [inKeeping, germantown, ohioLink]],
    [["data governance", "information governance"], [inKeeping, data, tartu]],
    [["provenance"], [inKeeping, lattice, chorus]],
    [["national security"], [fog, officerCandidate, kings]],
    [["national security AI", "defense AI"], [kings]],
    [["statecraft", "sanctions", "deterrence"], [kings]],
    [["human factors", "HCI"], [fog, evenward]],
    [["resilient systems"], [inKeeping, fog, chorus, evenward, corrections, officerCandidate, tartu]],
    [["high consequence systems"], [inKeeping, fog, chorus, corrections, officerCandidate, tartu]],
    [["threat modeling"], [inKeeping, fog, chorus, security]],
    [["red teaming"], [lattice, inKeeping, fog, chorus, evenward]],
    [["privacy"], [fog, evenward, inKeeping, chorus]],
    [["NLP", "LLM", "generative AI", "semantic transformation", "linguistic register", "API wrapper", "CSP", "WebGPU"], [lattice]],
    [["WebGL"], [fog, evenward]],
    [["MARC", "RIS", "BibTeX", "parser hardening", "rollback"], [inKeeping]],
    [["hostile imports"], [inKeeping, fog]],
    [["database", "databases"], [comparativeDatabases, data, miami]],
  ];

  for (const [queries, expected] of matrices) {
    for (const query of queries) assert.deepEqual(ids(query), expected, query);
  }

  assert.equal(ids("library technology").includes("resume-timeline-miami-university-undergraduate-teaching-assistant"), false);
  assert.equal(ids("strategic communications").includes(officerCandidate), false);
  assert.equal(ids("multi-agent").includes(fog) || ids("multi-agent").includes(kings), false);
  assert.equal(ids("resilient systems").includes("resume-project-medium"), false);
  assert.equal(ids("high consequence systems").includes(evenward) || ids("high consequence systems").includes("resume-project-medium"), false);
  assert.equal(ids("database").includes(germantown), false);
  assert.equal(ids("WebGL").includes(lattice), false);
});

test("Resume ontology keeps engineering, institutional, and domain aliases inside their evidence boundaries", () => {
  const ids = (query) => search(query).map(({ record }) => record.id);
  const lattice = "resume-project-lattice";
  const inKeeping = "resume-project-in-keeping";
  const fog = "resume-project-fog-of-sea";
  const chorus = "resume-project-chorus";
  const evenward = "resume-project-evenward";
  const corrections = "resume-timeline-madison-correctional-facility-corrections-officer";
  const officerCandidate = "resume-timeline-united-states-navy-officer-candidate";
  const madisonTeacher = "resume-timeline-madison-consolidated-schools-substitute-teacher";
  const germantown = "resume-timeline-germantown-public-library-intern";
  const daytonTeacher = "resume-timeline-dayton-area-school-consortium-substitute-teacher";
  const ohioLink = "resume-timeline-ohiolink-luminary";
  const teachingAssistant = "resume-timeline-miami-university-undergraduate-teaching-assistant";
  const kettering = "resume-timeline-kettering-health-network-volunteer";
  const kings = "resume-timeline-kings-college-london-grand-strategy";
  const tartu = "resume-timeline-university-of-tartu-student-researcher";
  const systems = "resume-skill-systems-architecture";
  const security = "resume-skill-security-and-verification";
  const data = "resume-skill-data-architecture-and-interoperability";
  const documentation = "resume-skill-technical-documentation-and-modeling";
  const business = "resume-skill-business-analysis-and-operational-planning";
  const software = "resume-skill-software-development";
  const frameworks = "resume-skill-frameworks-platforms-and-delivery";
  const fabrication = "resume-skill-fabrication-and-electronics";
  const miami = "resume-education-miami-university";
  const comparativeDatabases = "resume-project-comparative-database-design-and-data-analytics";

  assert.deepEqual(ids("escalation"), [fog, kings]);
  assert.deepEqual(ids("de-escalation"), [corrections, madisonTeacher]);
  assert.equal(ids("escalation").includes(corrections), false, "de-escalation cannot satisfy escalation");

  assert.deepEqual(ids("software engineering"), [
    lattice, inKeeping, fog, chorus, evenward, teachingAssistant, software, miami,
  ]);
  assert.deepEqual(ids("systems thinking"), [
    lattice, inKeeping, fog, chorus, evenward, teachingAssistant, tartu,
  ]);
  for (const excluded of ["resume-project-medium", kings, tartu, corrections]) {
    assert.equal(ids("engineering").includes(excluded), false, `engineering excludes ${excluded}`);
  }
  assert.deepEqual(ids("strategy"), [fog, kings, "resume-timeline-american-public-university-system-student"]);
  assert.deepEqual(ids("risk modeling"), [fog]);

  assert.deepEqual(ids("continuity"), [inKeeping, ohioLink, security, business, tartu]);
  for (const query of ["compellence", "coercive diplomacy"]) assert.deepEqual(ids(query), [kings], query);
  assert.deepEqual(ids("adversarial testing"), [lattice, inKeeping, fog, chorus, evenward, security]);
  assert.deepEqual(ids("controlled language"), [lattice]);
  assert.deepEqual(ids("accessibility"), [
    lattice, fog, inKeeping, chorus, evenward, ohioLink, "resume-skill-interaction-and-service-design",
  ]);

  for (const query of ["relational database", "NoSQL", "graph database"]) {
    assert.deepEqual(ids(query), [comparativeDatabases, data, miami], query);
    assert.equal(ids(query).includes(germantown), false, query);
  }
  assert.deepEqual(ids("fog of war"), [fog, officerCandidate]);
  assert.deepEqual(ids("public service"), [
    corrections, officerCandidate, madisonTeacher, germantown, daytonTeacher, kettering,
  ]);
  assert.deepEqual(ids("information environments"), [fog, chorus, kings, tartu]);
  assert.deepEqual(ids("cybersecurity"), [inKeeping, officerCandidate, security, tartu, kings]);
  for (const excluded of [lattice, fog, chorus, corrections]) assert.equal(ids("cybersecurity").includes(excluded), false);
  for (const query of ["disinformation", "influence", "foreign influence"]) {
    assert.deepEqual(ids(query), [chorus, kings], query);
  }

  const skillAliases = [
    ["ERD", data],
    ["DFD", documentation],
    ["software modeling", documentation],
    ["contract review", business],
    ["CPP", software],
    ["CSharp", software],
    ["source control", frameworks],
    ["FDM printing", fabrication],
  ];
  for (const [query, expected] of skillAliases) assert.deepEqual(ids(query), [expected], query);
  assert.ok(ids("multi-agent").includes(systems));
});

test("Resume Search tracks project evidence for languages, frameworks, runtimes, and delivery tools", () => {
  const projectIds = (query) => search(query)
    .map(({ record }) => record)
    .filter(({ class: recordClass }) => recordClass === "Projects")
    .map(({ id }) => id);

  const lattice = "resume-project-lattice";
  const inKeeping = "resume-project-in-keeping";
  const fog = "resume-project-fog-of-sea";
  const chorus = "resume-project-chorus";
  const evenward = "resume-project-evenward";

  assert.deepEqual(projectIds("TypeScript"), [inKeeping, fog, chorus, evenward]);
  assert.deepEqual(projectIds("TypScript"), [inKeeping, fog, chorus, evenward]);
  assert.deepEqual(projectIds("React"), [inKeeping, fog, chorus, evenward]);
  assert.deepEqual(projectIds("Next.js"), [chorus, evenward]);
  assert.deepEqual(projectIds("Three.js"), [fog, evenward]);
  assert.deepEqual(projectIds("Vite"), [inKeeping, fog, chorus]);
  assert.deepEqual(projectIds("Vtie"), [inKeeping, fog, chorus]);
  assert.deepEqual(projectIds("WebGL"), [fog, evenward]);
  assert.deepEqual(projectIds("WebGPU"), [lattice]);
  assert.deepEqual(projectIds("Cloudflare Workers"), [lattice, inKeeping, fog, chorus]);
  assert.deepEqual(projectIds("Wrangler"), [lattice, inKeeping, fog, chorus]);
  assert.deepEqual(search("React").map(({ record }) => record.id), [
    inKeeping, fog, chorus, evenward, "resume-skill-frameworks-platforms-and-delivery",
  ]);
  assert.equal(projectIds("TypeScript").includes("resume-project-medium"), false);
});

test("historical project records preserve supplied dates, collaborators, qualifications, and technical metadata", () => {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const expectedPublications = {
    "lms-reimplementation-proposal": ["February 2023", "2023-02", undefined],
    "chromebook-management": ["August 2022 – November 2022", "2022-08", "2022-11"],
    "finding-freedom-summer-traveling-exhibit": ["October 2021 – December 2021", "2021-10", "2021-12"],
    "information-studies-and-digital-citizenship": ["May 2021", "2021-05", undefined],
    "comparative-database-design-and-data-analytics": ["August 2021 – May 2022", "2021-08", "2022-05"],
    "ux-optimization-case-study": ["August 2021 – December 2022", "2021-08", "2022-12"],
  };

  for (const [id, [label, start, end]] of Object.entries(expectedPublications)) {
    const project = byId.get(id);
    assert.ok(project, id);
    assert.equal(project.publication.label, label);
    assert.equal(project.publication.start ?? project.publication.value, start);
    assert.equal(project.publication.end, end);
    assert.equal(project.status, "completed");
  }

  assert.deepEqual(byId.get("chromebook-management").technologies, [
    "Jekyll", "Ruby on Rails", "Google Cloud Platform", "Node.js", "Sierra ILS",
  ]);
  assert.deepEqual(byId.get("finding-freedom-summer-traveling-exhibit").resources.map(({ label }) => label), [
    "Finding Freedom Summer Traveling Exhibit contributor: Ken Irwin",
    "Finding Freedom Summer Traveling Exhibit contributor: Meng Qu",
    "Finding Freedom Summer Traveling Exhibit contributor: Jerry Yarnetsky",
  ]);
  assert.match(byId.get("information-studies-and-digital-citizenship").summary.join(" "), /Jaclynn Spraetz/u);
  for (const id of ["comparative-database-design-and-data-analytics", "ux-optimization-case-study"]) {
    assert.match(byId.get(id).limitations.join(" "), /non-concurrent, non-sequential, interdepartmental undergraduate courses/u);
  }

  const projectIds = (query) => search(query)
    .filter(({ record }) => record.class === "Projects")
    .map(({ record }) => record.id);
  assert.deepEqual(projectIds("Google Cloud Platform"), ["resume-project-chromebook-management"]);
  assert.deepEqual(projectIds("Sierra ILS"), [
    "resume-project-chromebook-management", "resume-project-finding-freedom-summer-traveling-exhibit",
  ]);
  assert.equal(projectIds("BigQuery")[0], "resume-project-comparative-database-design-and-data-analytics");
  assert.equal(projectIds("Wireshark")[0], "resume-project-ux-optimization-case-study");
});

test("Resume result ordering never lets a lower class leapfrog an upper class", () => {
  const rank = new Map(RESUME_SEARCH_CLASS_ORDER.map((name, index) => [name, index]));
  for (const query of ["systems", "naval", "metadata", "strategy", "education"]) {
    const hits = search(query);
    const ranks = hits.map(({ record }) => rank.get(record.class));
    assert.deepEqual(ranks, [...ranks].sort((left, right) => left - right), query);
  }
});

test("Resume Search keeps one compact control row and reverses Shelf's five-pixel fog without retaining hidden scroll height", async () => {
  const [source, css, view] = await Promise.all([
    readFile(new URL("../app/resume/ResumeSearch.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/resume/ResumeView.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(view, /<ResumeSearch>[\s\S]*?<ResumeProjects \/>[\s\S]*?<SkillStacks \/>[\s\S]*?<ResumeExperience \/>/u);
  assert.match(source, /className="form-control shelf-search-entry resume-search-input px-2"/u);
  assert.match(source, /placeholder="Search"/u);
  assert.match(source, /inert=\{canonicalInert \? true : undefined\}/u);
  assert.match(source, /inert=\{resultsInert \? true : undefined\}/u);
  assert.match(source, /aria-label="Close Resume search"[\s\S]*?aria-hidden=\{closeVisible \? undefined : "true"\}[\s\S]*?disabled=\{!closeInteractive\}[\s\S]*?>\s*Close\s*</u);
  assert.doesNotMatch(source, /\{active \? \(\s*<button[^>]+resume-search-close/u, "the close control stays mounted and cannot shift the page");
  assert.match(source, /event\.defaultPrevented[\s\S]*?event\.button !== 0[\s\S]*?event\.metaKey[\s\S]*?event\.ctrlKey[\s\S]*?event\.shiftKey[\s\S]*?event\.altKey/u);
  assert.match(source, /surfaceRef\.current = nextSurface;\s*setSurface\(nextSurface\)/u, "the transition ref updates in the same event as React state");
  assert.match(source, /changeSurface\("search-pre-in"\)[\s\S]*?requestAnimationFrame[\s\S]*?changeSurface\("search-results-in"\)[\s\S]*?setTimer\(surfaceTimer, frostCanonical, FROST_DURATION_MS\)/u);
  assert.match(source, /const frostCanonical = \(\) => \{\s*changeSurface\("search-in"\);\s*setTimer\(surfaceTimer, \(\) => changeSurface\("search"\), FROST_DURATION_MS\)/u);
  assert.match(source, /changeSurface\("search-pre-out"\)[\s\S]*?requestAnimationFrame[\s\S]*?changeSurface\("search-canonical-out"\)[\s\S]*?setTimer\(surfaceTimer, \(\) => \{\s*changeSurface\("search-out"\);\s*setTimer\(surfaceTimer, finish, FROST_DURATION_MS\)/u);
  assert.match(source, /startingSurface === "search-canonical-out"[\s\S]*?changeSurface\("search-reopen"\)/u);
  assert.match(source, /startingSurface === "search-out"[\s\S]*?changeSurface\("search-results-in"\)/u);
  assert.match(source, /surfaceRef\.current[\s\S]*?startingSurface === "search-pre-in"/u);
  assert.match(source, /onPointerDown=\{activate\}[\s\S]*?onFocus=\{activate\}/u);
  assert.match(source, /if \(suppressFocusActivation\.current\) return;/u);
  assert.match(source, /suppressFocusActivation\.current = true;[\s\S]*?inputRef\.current\?\.focus\(\{ preventScroll: true \}\);[\s\S]*?suppressFocusActivation\.current = false;/u);
  assert.match(source, /changeSurface\("canonical"\);[\s\S]*?focusSearchInputWithoutOpening\(\);/u);
  assert.match(source, /event\.preventDefault\(\);[\s\S]*?exitSearch\(\{ destination \}\)/u);
  assert.match(source, /window\.history\.pushState[\s\S]*?target\.focus[\s\S]*?target\.scrollIntoView/u);
  assert.doesNotMatch(source, /matches\.map|record\.evidence/u, "curated aliases and evidence are not placed in accessible result copy");
  assert.doesNotMatch(source, /Search is ready\.|Searching the Resume/u);
  assert.match(source, /<ResumeProjectCard[\s\S]*?onLatticeLaunch=/u);
  assert.match(source, /<SkillStackCard stack=\{stack\}/u);
  assert.match(source, /classList\.contains\("resume-modal-open"\)/u);
  assert.match(source, /resume-search-canonical \[data-lattice-launch=/u);
  const resultsSection = source.slice(source.indexOf('<section\n          className={`container resume-search-surface resume-search-results'), source.indexOf("</section>", source.indexOf('id="resume-search-results"')));
  assert.doesNotMatch(resultsSection, /aria-live=/u, "complex result cards are not one giant live region");
  assert.match(source, /prefers-reduced-motion[\s\S]*?prefers-reduced-transparency[\s\S]*?forced-colors/u);
  assert.match(source, /const RESULT_DURATION_MS = 180/u);
  assert.match(source, /canonicalOverlay[\s\S]*?resume-search-surface--overlay/u);
  assert.match(source, /const canonicalDormant = surface === "search"[\s\S]*?resume-search-surface--dormant/u);
  assert.match(source, /resultsOverlay[\s\S]*?resume-search-surface--overlay/u);
  assert.match(source, /className=\{`resume-search-stage\$\{canonicalOverlay \? " resume-search-stage--clip-canonical" : ""\}`\}/u);
  assert.match(source, /resume-search-results--replacing/u);
  assert.match(css, /\.resume-search-controls \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) clamp\(11rem, 16\.666vw, 18rem\) minmax\(0, 1fr\)/u);
  assert.match(css, /\.resume-search-close \{[\s\S]*?grid-column: 3;[\s\S]*?transition: filter \.5s ease, opacity \.5s ease/u);
  assert.match(css, /\.resume-search-close--hidden \{[\s\S]*?filter: blur\(5px\);[\s\S]*?opacity: 0;[\s\S]*?pointer-events: none/u);
  const baseStageRule = css.match(/\.resume-search-stage \{([\s\S]*?)\n\}/u)?.[1] ?? "";
  assert.match(baseStageRule, /position: relative/u);
  assert.doesNotMatch(baseStageRule, /overflow/u, "canonical mode must not clip fixed modal descendants");
  assert.match(css, /\.resume-search-stage--clip-canonical \{[\s\S]*?overflow: hidden;[\s\S]*?overflow: clip/u);
  assert.match(css, /\.resume-search-surface--overlay \{[\s\S]*?inset: 0;[\s\S]*?position: absolute/u);
  assert.match(css, /\.resume-search-surface--dormant \{[\s\S]*?visibility: hidden/u);
  assert.match(css, /\.resume-search-surface \{[\s\S]*?transition: filter \.5s ease, opacity \.5s ease/u);
  assert.match(css, /\.resume-search-surface--frosted \{[\s\S]*?filter: blur\(5px\)/u);
  assert.match(css, /\.resume-search-results\.resume-search-surface--frosted \{[\s\S]*?opacity: 0/u);
  assert.match(css, /\.resume-search-results--replacing \{[\s\S]*?transition-duration: \.18s/u);
  assert.match(css, /\.resume-modal-open \.resume-search-canonical > \.container,[\s\S]*?\.resume-modal-open \.resume-search-results \{ filter: blur\(5px\); \}/u);
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)[\s\S]*?\.resume-search-surface--frosted \{[\s\S]*?filter: none/u);
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)[\s\S]*?\.resume-search-close--hidden \{[\s\S]*?opacity: 0/u);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*?\.resume-search-surface--frosted \{[\s\S]*?filter: none/u);
});
