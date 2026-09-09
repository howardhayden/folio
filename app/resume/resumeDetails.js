export const resumeDetails = Object.freeze({
  officer: Object.freeze({
    id: "officer-candidate",
    canonicalPath: "/resume/officer-candidate/",
    title: "Officer Candidate",
    subtitle: "#ForgedInIce",
    period: "December 2025 – June 2026",
    details: Object.freeze([
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
    ]),
  }),
  ohiolink: Object.freeze({
    id: "ohiolink-luminary",
    canonicalPath: "/resume/ohiolink-luminary/",
    title: "Luminary",
    subtitle: "OhioLINK",
    period: "August 2021 – May 2023",
    details: Object.freeze([
      "Web Development",
      "Digital Accessibility Remediation",
      "Productivity Analysis",
      "Contract Analysis and CLM",
      "Course Design, Mentorship",
      "Metadata",
      "Makerspace Instruction",
      "Won Poster, People’s Choice for Strategic Project Management in the OhioLINK Luminaries Program at ALAO 2022 in Dublin, OH.",
    ]),
  }),
  undergrad: Object.freeze({
    id: "miami-university",
    canonicalPath: "/resume/miami-university/",
    title: "Miami University",
    subtitle: "",
    period: "August 2019 – May 2023",
    details: Object.freeze([
      "Bachelor of Arts",
      "Major in Computer Science",
      "Minor in Commerce",
      "Thematic Sequence of LUX 3",
      "European Culture and Society",
    ]),
  }),
  teaching: Object.freeze({
    id: "undergraduate-teaching-assistant",
    canonicalPath: "/resume/undergraduate-teaching-assistant/",
    title: "Teaching Assistant",
    subtitle: "College of Engineering and Computing",
    period: "May 2022 – May 2023",
    details: Object.freeze(["Training, Assessment", "Coordination, Mediation", "Collection Development"]),
    courses: Object.freeze([
      "Technology, Ethics, and Global Society",
      "Software Engineering for User Interface and User Experience Design",
      "Introduction to Software Engineering",
    ]),
  }),
});

export const resumeDetailList = Object.freeze(Object.values(resumeDetails));

export function resumeDetailBySlug(slug) {
  return resumeDetailList.find((detail) => detail.id === slug) ?? null;
}
