export const SITE_ORIGIN = "https://hah.dev";
export const SITE_CONTENT_VERSION = "hah-portfolio.v1";
export const SITE_CONTENT_UPDATED = "2026-09-09";
export const SITE_REPOSITORY = "https://github.com/howardhayden/folio";
export const SITE_SOURCE_LICENSE_URL = "https://polyformproject.org/licenses/noncommercial/1.0.0/";
export const SITE_CONTENT_TERMS_URL = `${SITE_REPOSITORY}/blob/main/LICENSES/LicenseRef-Hayden-Portfolio-Content.txt`;
export const homeTitle = "Yes, my initials spell \"hah.\"";

export const person = Object.freeze({
  id: `${SITE_ORIGIN}/#hayden-howard`,
  name: "Hayden Howard",
  givenName: "Hayden",
  familyName: "Howard",
  homeLocation: "Dayton",
  headline: "Hayden Howard develops and operates resilient systems that people can trust under pressure.",
  repository: SITE_REPOSITORY,
  profiles: Object.freeze([
    "https://www.linkedin.com/in/howardhayden/",
    "https://medium.com/@howardhayden",
  ]),
});

export const homeIntroduction = Object.freeze([
  "I’m Hayden Howard, a techie from Dayton. I develop and operate resilient systems that people can trust under pressure.",
  "I live for good cold brew, meaningful work, and passionate people.",
]);

export const resumeEducationOverview = Object.freeze({
  graduated: "May 2023",
  activities: Object.freeze([
    Object.freeze({ label: "Digital Humanities Forum Committee", start: "August 2021" }),
    Object.freeze({ label: "Diversity, Equity, and Inclusion Committee", start: "August 2022" }),
  ]),
});

export const toolsSocial = Object.freeze([
  Object.freeze({ name: "LinkedIn", title: "LinkedIn Profile", url: "https://www.linkedin.com/in/howardhayden/", icon: "linkedin" }),
  Object.freeze({ name: "Duolingo", title: "Duolingo Profile", url: "https://duolingo.com/profile/hahdev", icon: "feather" }),
]);

export const shelfNotice = "The following materials contain insightful value per their associated collections. They do not reflect my views or those of any employers or associated organizations.";

export const homeQuestions = Object.freeze([
  Object.freeze({
    question: "What is your favorite programming language?",
    answer: "C++, though it didn't usurp Java until my second Systems course, wherein I adopted some of Professor \"DJ\" Rao's passion for it. Today, it's my go-to language for scripting and general coding practice. I admire its efficiency, versatility, and integrative capacity.",
    column: 2,
  }),
  Object.freeze({
    question: "Do you prefer in-person or remote work?",
    answer: "I prefer a hybrid approach. Working remotely helps me focus and get into a productive flow, while in-person collaboration allows for faster and more efficient teamwork.",
    column: 2,
  }),
  Object.freeze({
    question: "What is your favorite music genre?",
    answer: "I listen most often to big band swing, finding it especially easy to slip into a flow state with. I also play acoustic guitar and flute.",
    column: 2,
  }),
  Object.freeze({ question: "Dogs or cats?", answer: "Cats.", column: 2 }),
  Object.freeze({ question: "Why USN Officer Candidate School?", answer: "Type three fun.", column: 2 }),
  Object.freeze({
    question: "What is your favorite latte?",
    answer: "Naoki fragrant yame blend matcha with traditionally processed whole milk, grade B maple syrup, and either cinnamon or peppermint extract.",
    column: 1,
  }),
  Object.freeze({
    question: "What have you learned during your education and GLAM-sector \"gap\"?",
    answer: Object.freeze([
      "How to command attention and order while maintaining both high energy and clarity of thought for several hours at a time.",
      "I learn best while teaching others.",
      "How to translate ideas presented with moderate formality into extremely informal language so as to reach audiences with differing levels of literacy.",
    ]),
    column: 1,
  }),
  Object.freeze({
    question: "What enticed you into the world of coding, data, and analysis?",
    answer: "I discovered during self-study of pathophysiology while taking an anatomy and physiology course that I truly enjoy the systematic nature of physiology. My directive became transparent.",
    column: 1,
  }),
]);

export const sharedRequirements = Object.freeze([
  Object.freeze({ id: "accessibility", label: "Accessibility", description: "Public interfaces and information are designed to remain perceivable and operable across access needs." }),
  Object.freeze({ id: "privacy", label: "Privacy", description: "Public systems minimize disclosure and keep transient user material out of published semantic artifacts." }),
  Object.freeze({ id: "traceability", label: "Requirements traceability", description: "Claims, requirements, relationships, and representations remain linked to their authoritative public records." }),
  Object.freeze({ id: "evidence", label: "Evidence", description: "Public claims distinguish authored evidence from inference and identify limitations explicitly." }),
]);

export const practiceStandards = Object.freeze([
  Object.freeze({
    id: "provenance-continuity",
    label: "Provenance and continuity",
    description: "Custody, integrity, dependencies, decisions, recovery paths, and handoff remain explicit across disruption and change.",
  }),
]);
