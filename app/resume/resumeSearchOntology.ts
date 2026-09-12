import { resumeEducationOverview } from "../content/siteContent.js";
import { skillStacks, timeline } from "../data.ts";
import {
  compileSearchOntology,
  normalizeSearchText,
  type SearchConceptDefinition,
  type SearchEvidence,
  type SearchEvidenceStrength,
  type SearchOntologyDefinition,
  type SearchRecord,
} from "../search/ontologySearch.ts";
import { projects } from "./projects.js";
import { resumeDetails } from "./resumeDetails.js";

export const RESUME_SEARCH_ONTOLOGY_VERSION = "hah-resume-search.v5";
export const RESUME_SEARCH_CLASS_ORDER = Object.freeze(["Projects", "Experiences", "Skills", "Education"] as const);

type ProjectResource = Readonly<{
  id?: string;
  artifactId?: string;
  label: string;
  title?: string;
  url: string;
  markdownUrl?: string;
  htmlMediaType?: string;
  markdownMediaType?: string;
  scope?: string;
}>;

type ProjectSource = Readonly<{
  id: string;
  slug: string;
  name: string;
  type: string;
  canonicalPath: string;
  url: string;
  thesis: string;
  summary: readonly string[];
  capabilities: readonly string[];
  technologies: readonly string[];
  evidence: readonly string[];
  limitations: readonly string[];
  emphasis: readonly string[];
  relationships: readonly Readonly<{ relation: string; target: string; scope: string }>[];
  resources: readonly ProjectResource[];
  publication: Readonly<{ label: string; value: string; precision: string }>;
  status: string;
}>;

type AuthoredSearchMetadata = Readonly<{
  text: string;
  conceptIds: readonly string[];
  strength?: SearchEvidenceStrength;
}>;

export type ResumeSearchAttachmentCoverageEntry = Readonly<{
  sourceId: string;
  recordId: string;
  terms: readonly string[];
}>;

// Local, immutable transcription of the applicable Resume Search metadata
// supplied in the September 2026 editorial handoff. Sections that have no
// canonical on-page card are intentionally excluded rather than emitted as
// search-only results. Each retained term remains independently attributable.
export const resumeSearchAttachmentCoverageContract: readonly ResumeSearchAttachmentCoverageEntry[] = Object.freeze([
  Object.freeze({
    sourceId: "projects[\"fog-of-sea\"]",
    recordId: "resume-project-fog-of-sea",
    terms: Object.freeze([
      "wargaming",
      "naval wargaming",
      "maritime wargaming",
      "serious games",
      "strategy games",
      "simulation",
      "deterministic simulation",
      "operational simulation",
      "military simulation",
      "naval strategy",
      "maritime strategy",
      "operational art",
      "decision-making under uncertainty",
      "decision support",
      "strategic decision-making",
      "contingent choice",
      "scenario design",
      "scenario development",
      "adjudication",
      "rules design",
      "game systems",
      "systems modeling",
      "integrated state",
      "state modeling",
      "procedural scenarios",
      "incomplete information",
      "fog of war",
      "information asymmetry",
      "situational awareness",
      "detection",
      "contact",
      "readiness",
      "logistics",
      "supply",
      "escalation",
      "risk",
      "risk modeling",
      "operational uncertainty",
      "adversarial behavior",
      "human-system interaction",
      "command decisions",
      "after-action analysis",
      "local-first",
      "client-side",
      "offline-capable",
      "privacy-preserving",
      "accessibility engineering",
      "schema migration",
      "hostile imports",
      "validation",
      "progressive disclosure",
      "3D visualization",
      "WebGL",
      "GLSL",
      "software engineering",
      "requirements engineering",
      "requirements traceability",
      "adversarial testing",
      "red teaming",
      "documentation",
      "war game",
      "war gaming",
      "wargame",
      "wargames",
      "kriegsspiel",
      "naval game",
      "naval simulation",
      "military game",
      "strategy simulation",
      "fog of war simulation",
      "operational game",
    ]),
  }),
  Object.freeze({
    sourceId: "projects[\"chorus\"]",
    recordId: "resume-project-chorus",
    terms: Object.freeze([
      "social simulation",
      "multi-agent systems",
      "multi-agent simulation",
      "agent-based simulation",
      "social systems",
      "social networks",
      "information propagation",
      "information diffusion",
      "disinformation",
      "misinformation",
      "influence",
      "social influence",
      "collective belief",
      "belief formation",
      "collective behavior",
      "distributed sensemaking",
      "epistemic systems",
      "information environments",
      "algorithmic amplification",
      "social capital",
      "institutional response",
      "network effects",
      "networked actors",
      "mental models",
      "mismatched mental models",
      "rumors",
      "scapegoating",
      "polarization",
      "ideology",
      "botnets",
      "foreign influence",
      "information operations",
      "strategic communications",
      "narrative influence",
      "cross-scenario state",
      "distributed state",
      "procedural scenarios",
      "state modeling",
      "coherence validation",
      "explainability",
      "provenance",
      "local-first",
      "privacy-preserving",
      "accessibility engineering",
      "systems modeling",
      "software engineering",
      "simulation design",
      "social sim",
      "agent simulation",
      "agentic simulation",
      "belief simulation",
      "disinformation simulation",
      "influence simulation",
      "social influence model",
      "multi agent",
      "multiagent",
    ]),
  }),
  Object.freeze({
    sourceId: "projects[\"in-keeping\"]",
    recordId: "resume-project-in-keeping",
    terms: Object.freeze([
      "library technology",
      "library systems",
      "library software",
      "information systems",
      "information management",
      "information stewardship",
      "digital preservation",
      "digital continuity",
      "archival continuity",
      "records continuity",
      "business continuity",
      "institutional continuity",
      "records management",
      "metadata",
      "metadata management",
      "metadata normalization",
      "metadata crosswalks",
      "schema design",
      "schema mapping",
      "custom schemas",
      "catalog data",
      "archival data",
      "data migration",
      "data validation",
      "data integrity",
      "data provenance",
      "provenance",
      "chain of custody",
      "audit trail",
      "integrity-linked revisions",
      "revision history",
      "SHA-256",
      "hash chains",
      "tamper evidence",
      "hostile imports",
      "parser security",
      "parser hardening",
      "bounded parsing",
      "fail closed",
      "MARC",
      "RIS",
      "BibTeX",
      "XML",
      "quarantine",
      "reconciliation",
      "rollback",
      "recovery",
      "backup",
      "incident response",
      "continuity planning",
      "institutional handoff",
      "saved-state verification",
      "local-first",
      "offline-capable",
      "privacy-preserving",
      "no telemetry",
      "data governance",
      "information governance",
      "runbooks",
      "postmortems",
      "technical documentation",
      "systems librarian",
      "web services librarian",
      "inkeeping",
      "in keeping",
      "library continuity",
      "archive continuity",
      "digital archives",
      "library data",
      "library metadata",
      "catalog migration",
      "metadata migration",
      "records system",
    ]),
  }),
  Object.freeze({
    sourceId: "projects[\"lattice\"]",
    recordId: "resume-project-lattice",
    terms: Object.freeze([
      "semantic transformation",
      "text transformation",
      "language systems",
      "writing systems",
      "controlled language",
      "semantic decomposition",
      "semantic atoms",
      "semantic fidelity",
      "linguistic register",
      "register transformation",
      "natural language",
      "language processing",
      "structured writing",
      "information architecture",
      "content architecture",
      "content design",
      "interface copy",
      "instructional copy",
      "technical writing",
      "layered explanation",
      "progressive disclosure",
      "cognitive accessibility",
      "cognitive hospitality",
      "accessible language",
      "semantic equivalence",
      "deterministic transformation",
      "requirements engineering",
      "provenance",
      "evidence",
      "systems thinking",
      "epistemic rigor",
      "institutional causality",
      "text rewriting",
      "rewriting engine",
      "writing engine",
      "language engine",
      "semantic engine",
      "text processing",
      "copy system",
    ]),
  }),
  Object.freeze({
    sourceId: "projects[\"text-to-lattice\"]",
    recordId: "resume-project-lattice",
    terms: Object.freeze([
      "Lattice",
      "semantic transformation",
      "text transformation",
      "natural language processing",
      "NLP",
      "generative AI",
      "AI",
      "large language models",
      "LLM",
      "API integration",
      "API wrapper",
      "web API",
      "serverless API",
      "Cloudflare Workers",
      "edge computing",
      "input validation",
      "request validation",
      "fail-closed design",
      "security boundaries",
      "content security policy",
      "CSP",
      "production deployment",
      "release engineering",
      "frontend-backend integration",
      "semantic fidelity",
      "accessible language",
      "text2lattice",
      "text to lattice",
      "Lattice demo",
      "Lattice API",
      "AI writing",
      "AI rewriting",
      "LLM wrapper",
    ]),
  }),
  Object.freeze({
    sourceId: "projects[\"evenward\"]",
    recordId: "resume-project-evenward",
    terms: Object.freeze([
      "human-computer interaction",
      "HCI",
      "interaction design",
      "embodied interaction",
      "embodied computing",
      "human-centered design",
      "user experience",
      "UX",
      "accessibility",
      "accessibility engineering",
      "inclusive design",
      "motion design",
      "cadenced interaction",
      "physically situated interaction",
      "3D",
      "3D rendering",
      "real-time rendering",
      "WebGL",
      "GLSL",
      "shader programming",
      "rendering lifecycle",
      "avatar systems",
      "character rendering",
      "body modeling",
      "animation",
      "environmental rendering",
      "camera systems",
      "interaction states",
      "state modeling",
      "local-first",
      "privacy-preserving",
      "progressive disclosure",
      "mobile-first",
      "responsive design",
      "visual accessibility",
      "non-visual accessibility",
      "keyboard accessibility",
      "software architecture",
      "software engineering",
      "embodied UX",
      "3d interaction",
      "avatar engine",
      "movement trainer",
      "motion system",
      "human factors",
    ]),
  }),
  Object.freeze({
    sourceId: "education[\"kcl-grand-strategy\"]",
    recordId: "resume-timeline-kings-college-london-grand-strategy",
    terms: Object.freeze([
      "King's College London",
      "KCL",
      "grand strategy",
      "strategy",
      "national security",
      "international security",
      "security studies",
      "defense",
      "defence",
      "war studies",
      "statecraft",
      "strategic decision-making",
      "geopolitics",
      "international affairs",
      "foreign policy",
      "wargaming",
      "strategic communications",
      "sanctions",
      "artificial intelligence",
      "AI",
    ]),
  }),
  Object.freeze({
    sourceId: "education[\"kcl-wargaming-and-strategy\"]",
    recordId: "resume-timeline-kings-college-london-grand-strategy",
    terms: Object.freeze([
      "wargaming",
      "war games",
      "wargame design",
      "strategy",
      "strategic analysis",
      "strategic decision-making",
      "decision-making under uncertainty",
      "contingent choice",
      "scenario design",
      "player interaction",
      "adjudication",
      "game design",
      "assumption testing",
      "forecasting",
      "decision support",
      "conflict",
      "competition",
      "government wargaming",
      "professional wargaming",
      "Wargaming and Strategy",
      "war gaming",
      "wargames",
      "kriegsspiel",
      "strategic gaming",
    ]),
  }),
  Object.freeze({
    sourceId: "education[\"kcl-ai-national-security\"]",
    recordId: "resume-timeline-kings-college-london-grand-strategy",
    terms: Object.freeze([
      "artificial intelligence",
      "AI",
      "AI in national security",
      "national security",
      "defense AI",
      "defence AI",
      "military AI",
      "intelligence",
      "autonomy",
      "autonomous systems",
      "surveillance",
      "data",
      "military technology",
      "emerging technology",
      "decision-making",
      "tactical decision-making",
      "strategic decision-making",
      "AI ethics",
      "AI governance",
      "AI regulation",
      "autonomous weapons",
      "accountability",
      "international law",
      "deterrence",
      "escalation",
      "future warfare",
      "Artificial Intelligence in National Security",
      "AI security",
      "national security AI",
      "military artificial intelligence",
    ]),
  }),
  Object.freeze({
    sourceId: "education[\"kcl-sanctions-statecraft\"]",
    recordId: "resume-timeline-kings-college-london-grand-strategy",
    terms: Object.freeze([
      "sanctions",
      "economic sanctions",
      "statecraft",
      "economic statecraft",
      "coercive diplomacy",
      "coercion",
      "deterrence",
      "compellence",
      "foreign policy",
      "international relations",
      "international security",
      "diplomacy",
      "targeted sanctions",
      "multilateral sanctions",
      "unilateral sanctions",
      "sanctions regimes",
      "sanctions evasion",
      "economic warfare",
      "Sanctions and Statecraft",
      "economic coercion",
      "coercive statecraft",
    ]),
  }),
  Object.freeze({
    sourceId: "education[\"kcl-strategic-communications\"]",
    recordId: "resume-timeline-kings-college-london-grand-strategy",
    terms: Object.freeze([
      "strategic communications",
      "strategic communication",
      "communications strategy",
      "narrative",
      "narrative strategy",
      "persuasion",
      "influence",
      "public perception",
      "discourse",
      "discourse analysis",
      "complexity theory",
      "storytelling",
      "collective memory",
      "political communication",
      "political power",
      "state actors",
      "non-state actors",
      "insurgency",
      "protest",
      "decentralized networks",
      "information environment",
      "international affairs",
      "StratCom",
      "Strat Comm",
      "strategic comms",
      "strategic messaging",
      "narrative influence",
    ]),
  }),
  Object.freeze({
    sourceId: "education[\"amu-military-history\"]",
    recordId: "resume-timeline-american-public-university-system-student",
    terms: Object.freeze([
      "military history",
      "military philosophy",
      "war",
      "warfare",
      "military studies",
      "strategy",
      "strategic thought",
      "history",
      "defense studies",
      "defence studies",
    ]),
  }),
  Object.freeze({
    sourceId: "education[\"uw-library-archives\"]",
    recordId: "resume-timeline-uw-madison-ischool-continuing-education",
    terms: Object.freeze([
      "library science",
      "information science",
      "library and archives",
      "archives",
      "archival practice",
      "digitization",
      "digitization projects",
      "digital collections",
      "digital asset management",
      "DAM",
      "metadata",
      "digital preservation",
      "library services",
      "business services",
      "business community",
      "public libraries",
      "UW Madison",
      "UW-Madison",
      "Wisconsin",
      "Library and Archives Assisting",
      "digital assets",
    ]),
  }),
  Object.freeze({
    sourceId: "education[\"tartu-digital-governance\"]",
    recordId: "resume-timeline-university-of-tartu-student-researcher",
    terms: Object.freeze([
      "digital governance",
      "digital government",
      "e-government",
      "e-governance",
      "government technology",
      "GovTech",
      "public-sector technology",
      "technology adoption",
      "digital transformation",
      "internet voting",
      "i-voting",
      "electronic voting",
      "cybersecurity governance",
      "cyber governance",
      "data governance",
      "Estonia",
      "public-private integration",
      "sectoral process integration",
      "trust",
      "institutional trust",
      "high-consequence systems",
      "technology policy",
    ]),
  }),
  Object.freeze({
    sourceId: "education[\"miami-computer-science\"]",
    recordId: "resume-education-miami-university",
    terms: Object.freeze([
      "computer science",
      "CS",
      "software",
      "software engineering",
      "programming",
      "databases",
      "advanced databases",
      "commerce",
      "business",
      "public speaking",
      "communication",
      "human anatomy",
      "physiology",
    ]),
  }),
  Object.freeze({
    sourceId: "experiences[\"corrections-officer\"]",
    recordId: "resume-timeline-madison-correctional-facility-corrections-officer",
    terms: Object.freeze([
      "corrections",
      "correctional officer",
      "correctional operations",
      "institutional security",
      "public safety",
      "security",
      "policy enforcement",
      "policy compliance",
      "incident documentation",
      "incident reporting",
      "records",
      "de-escalation",
      "crisis communication",
      "situational awareness",
      "high-pressure operations",
      "real-time decision-making",
      "shift work",
      "night shift",
      "overnight shift",
      "12-hour shifts",
      "long shifts",
      "extended shifts",
      "work nights",
      "endurance",
      "attention to detail",
      "standards compliance",
      "professional boundaries",
      "controlled environment",
      "conflict management",
      "public service",
      "CO",
      "correction officer",
      "prison officer",
      "corrections work",
      "night work",
      "overnights",
      "long hours",
    ]),
  }),
  Object.freeze({
    sourceId: "experiences[\"navy-officer-candidate\"]",
    recordId: "resume-timeline-united-states-navy-officer-candidate",
    terms: Object.freeze([
      "United States Navy",
      "US Navy",
      "USN",
      "Navy",
      "Officer Candidate School",
      "OCS",
      "officer candidate",
      "military",
      "military training",
      "leadership",
      "command voice",
      "situational awareness",
      "procedural awareness",
      "standards compliance",
      "attention to detail",
      "high-pressure operations",
      "pressurized operations",
      "limited information",
      "information constraints",
      "fog of war",
      "teamwork",
      "collaboration",
      "independence",
      "stress management",
      "resilience",
      "endurance",
      "fitness",
      "physical fitness",
      "physical readiness",
      "16-hour days",
      "17-hour days",
      "long days",
      "long shifts",
      "7 days a week",
      "concurrent obligations",
      "multiple simultaneous obligations",
      "busy schedule",
      "emergency response",
      "firefighting",
      "damage control",
      "shipboard damage control",
      "water survival",
      "swim qualification",
      "roving",
      "roving watch",
      "watchstanding",
      "mailroom",
      "mail operations",
      "mail processing",
      "information security",
      "sensitive information",
      "confidential information",
      "Secret clearance",
      "DoD Secret clearance",
      "security clearance",
      "boot shining",
      "shoe shining",
      "leather care",
      "uniform maintenance",
      "Navy OCS",
      "USN OCS",
      "OCS Newport",
      "military officer training",
      "17 hour shifts",
      "17 hour days",
      "long hours",
      "seven days a week",
    ]),
  }),
  Object.freeze({
    sourceId: "experiences[\"madison-substitute-teacher\"]",
    recordId: "resume-timeline-madison-consolidated-schools-substitute-teacher",
    terms: Object.freeze([
      "teaching",
      "education",
      "substitute teaching",
      "instruction",
      "classroom management",
      "behavior management",
      "In-School Suspension",
      "ISS",
      "In-School Suspension Coordinator",
      "de-escalation",
      "redirection",
      "policy enforcement",
      "incident documentation",
      "procedural compliance",
      "staff coordination",
      "communication",
      "public service",
    ]),
  }),
  Object.freeze({
    sourceId: "experiences[\"dayton-substitute-teacher\"]",
    recordId: "resume-timeline-dayton-area-school-consortium-substitute-teacher",
    terms: Object.freeze([
      "teaching",
      "education",
      "substitute teaching",
      "instruction",
      "classroom management",
      "exam proctoring",
      "test proctoring",
      "procedural compliance",
      "situational awareness",
      "audience adaptation",
      "communication",
      "redirection",
    ]),
  }),
  Object.freeze({
    sourceId: "experiences[\"germantown-library\"]",
    recordId: "resume-timeline-germantown-public-library-intern",
    terms: Object.freeze([
      "library",
      "public library",
      "library assistant",
      "library operations",
      "information services",
      "records management",
      "metadata",
      "data entry",
      "reference support",
      "technical writing",
      "technical documentation",
      "process documentation",
      "process mapping",
      "data-flow analysis",
      "data-flow diagnostics",
      "policy review",
      "policy interpretation",
      "by-laws",
      "standards compliance",
      "procedural accuracy",
      "information organization",
      "information retrieval",
      "library technology",
    ]),
  }),
  Object.freeze({
    sourceId: "experiences[\"ohiolink-miami-libraries\"]",
    recordId: "resume-timeline-ohiolink-luminary",
    terms: Object.freeze([
      "OhioLINK",
      "Miami University Libraries",
      "academic libraries",
      "library technology",
      "library systems",
      "metadata",
      "information organization",
      "information retrieval",
      "vendor licenses",
      "license analysis",
      "contract analysis",
      "fiscal analysis",
      "productivity analysis",
      "contingency planning",
      "operational decision-making",
      "web development",
      "digital accessibility",
      "accessibility remediation",
      "makerspace",
      "makerspace instruction",
      "course design",
      "project management",
      "strategic project management",
      "ALAO",
      "People's Choice",
    ]),
  }),
  Object.freeze({
    sourceId: "experiences[\"miami-undergraduate-assistant\"]",
    recordId: "resume-timeline-miami-university-undergraduate-teaching-assistant",
    terms: Object.freeze([
      "teaching assistant",
      "undergraduate teaching assistant",
      "technical support",
      "instruction",
      "training",
      "assessment",
      "office hours",
      "diagnostics",
      "troubleshooting",
      "technical documentation",
      "reference materials",
      "software engineering",
      "user experience",
      "UX",
      "technology ethics",
      "systems thinking",
      "user-centered communication",
      "coordination",
      "mediation",
      "international coordination",
      "time-zone coordination",
      "collection development",
    ]),
  }),
  Object.freeze({
    sourceId: "experiences[\"kettering-health\"]",
    recordId: "resume-timeline-kettering-health-network-volunteer",
    terms: Object.freeze([
      "healthcare",
      "hospital",
      "patient support",
      "patient services",
      "communication",
      "liaison",
      "customer service",
      "public service",
      "staff communication",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Unified Modeling Language\"]",
    recordId: "resume-skill-technical-documentation-and-modeling",
    terms: Object.freeze([
      "Unified Modeling Language",
      "UML",
      "software modeling",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Entity-Relationship Diagram\"]",
    recordId: "resume-skill-data-architecture-and-interoperability",
    terms: Object.freeze([
      "Entity-Relationship Diagram",
      "ERD",
      "ER diagram",
      "entity relationship",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Data Flow Diagram\"]",
    recordId: "resume-skill-technical-documentation-and-modeling",
    terms: Object.freeze([
      "Data Flow Diagram",
      "DFD",
      "data-flow diagram",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Network Diagram\"]",
    recordId: "resume-skill-technical-documentation-and-modeling",
    terms: Object.freeze([
      "Network Diagram",
      "network topology",
      "network mapping",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Business Process Model and Notation\"]",
    recordId: "resume-skill-business-analysis-and-operational-planning",
    terms: Object.freeze([
      "Business Process Model and Notation",
      "BPMN",
      "business process modeling",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Gantt Chart\"]",
    recordId: "resume-skill-business-analysis-and-operational-planning",
    terms: Object.freeze([
      "Gantt Chart",
      "Gantt",
      "project scheduling",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Contract Analysis\"]",
    recordId: "resume-skill-business-analysis-and-operational-planning",
    terms: Object.freeze([
      "Contract Analysis",
      "contract review",
      "license analysis",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Proposal\"]",
    recordId: "resume-skill-business-analysis-and-operational-planning",
    terms: Object.freeze([
      "Proposal",
      "proposal writing",
      "business proposal",
      "project proposal",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"TypeScript\"]",
    recordId: "resume-skill-software-development",
    terms: Object.freeze([
      "TypeScript",
      "TS",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"JavaScript\"]",
    recordId: "resume-skill-software-development",
    terms: Object.freeze([
      "JavaScript",
      "JS",
      "ECMAScript",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Python\"]",
    recordId: "resume-skill-software-development",
    terms: Object.freeze([
      "Python",
      "py",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"C++\"]",
    recordId: "resume-skill-software-development",
    terms: Object.freeze([
      "C++",
      "cpp",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"C#\"]",
    recordId: "resume-skill-software-development",
    terms: Object.freeze([
      "C#",
      "csharp",
      "C Sharp",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"HTML\"]",
    recordId: "resume-skill-software-development",
    terms: Object.freeze([
      "HTML",
      "HTML5",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"CSS\"]",
    recordId: "resume-skill-software-development",
    terms: Object.freeze([
      "CSS",
      "CSS3",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Bash\"]",
    recordId: "resume-skill-software-development",
    terms: Object.freeze([
      "Bash",
      "shell",
      "shell scripting",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"React\"]",
    recordId: "resume-skill-frameworks-platforms-and-delivery",
    terms: Object.freeze([
      "React",
      "React.js",
      "ReactJS",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Next.js\"]",
    recordId: "resume-skill-frameworks-platforms-and-delivery",
    terms: Object.freeze([
      "Next.js",
      "NextJS",
      "Next",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Node.js\"]",
    recordId: "resume-skill-frameworks-platforms-and-delivery",
    terms: Object.freeze([
      "Node.js",
      "Node",
      "NodeJS",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Vite\"]",
    recordId: "resume-skill-frameworks-platforms-and-delivery",
    terms: Object.freeze([
      "Vite",
      "Vite.js",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Git\"]",
    recordId: "resume-skill-frameworks-platforms-and-delivery",
    terms: Object.freeze([
      "Git",
      "version control",
      "source control",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"npm\"]",
    recordId: "resume-skill-frameworks-platforms-and-delivery",
    terms: Object.freeze([
      "npm",
      "Node package manager",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Neo4j\"]",
    recordId: "resume-skill-data-architecture-and-interoperability",
    terms: Object.freeze([
      "Neo4j",
      "graph database",
      "graph DB",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"ArangoDB\"]",
    recordId: "resume-skill-data-architecture-and-interoperability",
    terms: Object.freeze([
      "ArangoDB",
      "multi-model database",
      "graph database",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"MongoDB\"]",
    recordId: "resume-skill-data-architecture-and-interoperability",
    terms: Object.freeze([
      "MongoDB",
      "Mongo",
      "document database",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"MySQL\"]",
    recordId: "resume-skill-data-architecture-and-interoperability",
    terms: Object.freeze([
      "MySQL",
      "relational database",
      "RDBMS",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"SQLite\"]",
    recordId: "resume-skill-data-architecture-and-interoperability",
    terms: Object.freeze([
      "SQLite",
      "embedded database",
      "relational database",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"SQL\"]",
    recordId: "resume-skill-data-architecture-and-interoperability",
    terms: Object.freeze([
      "SQL",
      "structured query language",
      "database querying",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"R\"]",
    recordId: "resume-skill-data-architecture-and-interoperability",
    terms: Object.freeze([
      "R",
      "R language",
      "statistical programming",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Laser Cutting\"]",
    recordId: "resume-skill-fabrication-and-electronics",
    terms: Object.freeze([
      "Laser Cutting",
      "laser cutter",
      "digital fabrication",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Machined Drilling\"]",
    recordId: "resume-skill-fabrication-and-electronics",
    terms: Object.freeze([
      "Machined Drilling",
      "machining",
      "drill press",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Multi-Needle Embroidery\"]",
    recordId: "resume-skill-fabrication-and-electronics",
    terms: Object.freeze([
      "Multi-Needle Embroidery",
      "machine embroidery",
      "embroidery machine",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"3D Printing\"]",
    recordId: "resume-skill-fabrication-and-electronics",
    terms: Object.freeze([
      "3D Printing",
      "additive manufacturing",
      "FDM printing",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Sublimation Printing\"]",
    recordId: "resume-skill-fabrication-and-electronics",
    terms: Object.freeze([
      "Sublimation Printing",
      "dye sublimation",
      "sublimation",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Soldering with 63Sn-37Pb Alloy\"]",
    recordId: "resume-skill-fabrication-and-electronics",
    terms: Object.freeze([
      "Soldering with 63Sn-37Pb Alloy",
      "soldering",
      "electronics soldering",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Smock\"]",
    recordId: "resume-skill-fabrication-and-electronics",
    terms: Object.freeze([
      "Smock",
      "ESD smock",
      "anti-static smock",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Wrist Strap\"]",
    recordId: "resume-skill-fabrication-and-electronics",
    terms: Object.freeze([
      "Wrist Strap",
      "ESD wrist strap",
      "anti-static wrist strap",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Continuous Monitor\"]",
    recordId: "resume-skill-fabrication-and-electronics",
    terms: Object.freeze([
      "Continuous Monitor",
      "ESD monitor",
      "ground monitor",
    ]),
  }),
  Object.freeze({
    sourceId: "skillAliases[\"Grounding\"]",
    recordId: "resume-skill-fabrication-and-electronics",
    terms: Object.freeze([
      "Grounding",
      "ESD grounding",
      "electrostatic grounding",
    ]),
  }),
]);


export const resumeSearchConcepts: readonly SearchConceptDefinition[] = Object.freeze([
  Object.freeze({ id: "work-experience", label: "Work Experience", aliases: Object.freeze(["Work", "Employment", "Professional Experience", "Job"]) }),
  Object.freeze({ id: "engineering", label: "Engineering" }),
  Object.freeze({ id: "systems", label: "Systems", related: Object.freeze(["engineering"]) }),
  Object.freeze({ id: "systems-thinking", label: "Systems Thinking", aliases: Object.freeze(["Systems Approach"]), related: Object.freeze(["systems"]) }),
  Object.freeze({ id: "systems-architecture", label: "Systems Architecture", aliases: Object.freeze(["Solution Architecture", "Systems Architect", "Solution Architect"]), broader: Object.freeze(["systems"]) }),
  Object.freeze({ id: "software-development", label: "Software Development", aliases: Object.freeze(["Software Developer"]), broader: Object.freeze(["engineering"]), related: Object.freeze(["web-development", "devops", "software-engineering"]) }),
  Object.freeze({ id: "software-engineering", label: "Software Engineering", aliases: Object.freeze(["Software Engineer", "Application Engineering"]), broader: Object.freeze(["software-development"]), related: Object.freeze(["systems-architecture", "requirements"]) }),
  Object.freeze({ id: "web-development", label: "Web Development", aliases: Object.freeze(["Frontend Development", "Front-end Development", "Frontend Engineer"]), broader: Object.freeze(["software-development"]), related: Object.freeze(["interaction-design"]) }),
  Object.freeze({ id: "programming", label: "Programming", aliases: Object.freeze(["Coding"]), broader: Object.freeze(["software-development"]) }),
  Object.freeze({ id: "devops", label: "DevOps", aliases: Object.freeze(["Platform Engineering", "Release Engineering", "Build and Delivery"]), abbreviations: Object.freeze(["CI/CD"]), broader: Object.freeze(["software-development"]) }),
  Object.freeze({ id: "version-control", label: "Version Control", aliases: Object.freeze(["Source Control"]), related: Object.freeze(["devops", "software-development"]) }),
  Object.freeze({ id: "data", label: "Data", broader: Object.freeze(["systems"]) }),
  Object.freeze({ id: "data-architecture", label: "Data Architecture", aliases: Object.freeze(["Data Engineering", "Data Architect", "Database Architecture"]), broader: Object.freeze(["data"]), related: Object.freeze(["metadata", "information-architecture"]) }),
  Object.freeze({ id: "database-systems", label: "Database", aliases: Object.freeze(["Databases", "Database Systems", "Database Engineering", "Database Management Systems", "Relational Database", "Relational Databases", "NoSQL", "Graph Database", "Graph Databases", "Document Database", "Document Databases"]), abbreviations: Object.freeze(["DBMS", "RDBMS"]), broader: Object.freeze(["data-architecture"]) }),
  Object.freeze({ id: "metadata", label: "Metadata", aliases: Object.freeze(["Metadata Management"]), broader: Object.freeze(["data"]) }),
  Object.freeze({ id: "information-governance", label: "Information Governance", aliases: Object.freeze(["Data Governance", "Data Stewardship"]), related: Object.freeze(["data", "information-architecture", "metadata"]) }),
  Object.freeze({ id: "information-retrieval", label: "Information Retrieval", aliases: Object.freeze(["Search and Retrieval"]), related: Object.freeze(["information-architecture", "library"]) }),
  Object.freeze({ id: "information-architecture", label: "Information Architecture", aliases: Object.freeze(["Information Architect", "IA"]), broader: Object.freeze(["systems"]), related: Object.freeze(["interaction-design", "metadata"]) }),
  Object.freeze({ id: "interaction-design", label: "Interaction Design", aliases: Object.freeze(["User Experience Design", "UX Design", "UX Designer", "Service Design"]), broader: Object.freeze(["systems"]), related: Object.freeze(["accessibility"]) }),
  Object.freeze({ id: "accessibility", label: "Accessibility", aliases: Object.freeze(["Digital Accessibility", "Accessibility Engineering", "Accessibility Specialist"]), related: Object.freeze(["interaction-design", "verification"]) }),
  Object.freeze({ id: "security", label: "Security", aliases: Object.freeze(["Security Engineering", "Security Engineer"]), broader: Object.freeze(["systems"]), related: Object.freeze(["verification", "privacy", "cybersecurity"]) }),
  Object.freeze({ id: "cybersecurity", label: "Cybersecurity", aliases: Object.freeze(["Cyber Security", "Cyber Defence", "Cyber Defense"]), broader: Object.freeze(["security"]) }),
  Object.freeze({ id: "threat-modeling", label: "Threat Modeling", aliases: Object.freeze(["Threat Analysis"]), broader: Object.freeze(["security"]), related: Object.freeze(["verification"]) }),
  Object.freeze({ id: "verification", label: "Verification", aliases: Object.freeze(["Quality Assurance", "Software Testing", "QA Engineer", "Test Engineer"],), broader: Object.freeze(["engineering"]), related: Object.freeze(["security"]) }),
  Object.freeze({ id: "red-teaming", label: "Red Teaming", aliases: Object.freeze(["Red-Teaming", "Adversarial Review"]), broader: Object.freeze(["verification"]), related: Object.freeze(["security"]) }),
  Object.freeze({ id: "adversarial-testing", label: "Adversarial Testing", aliases: Object.freeze(["Adversarial Test", "Abuse-Case Testing"]), broader: Object.freeze(["verification"]), related: Object.freeze(["red-teaming", "security"]) }),
  Object.freeze({ id: "content-security-policy", label: "Content Security Policy", abbreviations: Object.freeze(["CSP"]), broader: Object.freeze(["security"]) }),
  Object.freeze({ id: "privacy", label: "Privacy", aliases: Object.freeze(["Privacy Engineering"]), related: Object.freeze(["local-first", "security"]) }),
  Object.freeze({ id: "local-first", label: "Local-First", aliases: Object.freeze(["Offline-First", "Local First"]), broader: Object.freeze(["systems-architecture"]), related: Object.freeze(["privacy", "resilience"]) }),
  Object.freeze({ id: "resilience", label: "Resilience", broader: Object.freeze(["systems"]), related: Object.freeze(["continuity", "incident-response"]) }),
  Object.freeze({ id: "resilient-systems", label: "Resilient Systems", aliases: Object.freeze(["System Resilience"]), broader: Object.freeze(["systems"]), related: Object.freeze(["resilience", "continuity"]) }),
  Object.freeze({ id: "high-consequence-systems", label: "High-Consequence Systems", aliases: Object.freeze(["High Consequence Systems", "High-Stakes Systems", "Mission-Critical Systems"]), broader: Object.freeze(["systems"]), related: Object.freeze(["resilience", "security"]) }),
  Object.freeze({ id: "continuity", label: "Continuity", aliases: Object.freeze(["Business Continuity", "Continuity Planning", "Disaster Recovery"]), broader: Object.freeze(["resilience"]), related: Object.freeze(["provenance"]) }),
  Object.freeze({ id: "incident-response", label: "Incident Response", aliases: Object.freeze(["Emergency Preparedness"]), broader: Object.freeze(["resilience"]), related: Object.freeze(["security"]) }),
  Object.freeze({ id: "provenance", label: "Provenance", aliases: Object.freeze(["Chain of Custody", "Data Lineage"]), broader: Object.freeze(["information-architecture"]), related: Object.freeze(["continuity", "metadata"]) }),
  Object.freeze({ id: "documentation", label: "Technical Documentation", aliases: Object.freeze(["Documentation", "Technical Writing", "Technical Writer", "Documentation Engineer"]), related: Object.freeze(["information-architecture"]) }),
  Object.freeze({ id: "modeling", label: "Modeling", aliases: Object.freeze(["Systems Modeling", "Simulation Modeling"]), broader: Object.freeze(["systems"]), related: Object.freeze(["simulation"]) }),
  Object.freeze({ id: "software-modeling", label: "Software Modeling", related: Object.freeze(["modeling", "software-engineering"]) }),
  Object.freeze({ id: "simulation", label: "Simulation", aliases: Object.freeze(["Deterministic Simulation"]), broader: Object.freeze(["systems"]), related: Object.freeze(["strategy"]) }),
  Object.freeze({ id: "wargaming", label: "Wargaming", aliases: Object.freeze(["War Gaming", "Wargame", "Wargames", "War Game", "War Games", "Kriegsspiel", "Naval Wargaming", "Maritime Wargaming", "Professional Wargaming"]), broader: Object.freeze(["simulation"]), related: Object.freeze(["strategy"]) }),
  Object.freeze({ id: "wargame-design", label: "Wargame Design", aliases: Object.freeze(["Scenario Design", "Scenario Development", "Adjudication", "Decision Support", "Assumption Testing"]), broader: Object.freeze(["wargaming"]) }),
  Object.freeze({ id: "artificial-intelligence", label: "Artificial Intelligence", aliases: Object.freeze(["Machine Learning"]), abbreviations: Object.freeze(["AI"]), related: Object.freeze(["software-development"]) }),
  Object.freeze({ id: "natural-language-processing", label: "Natural Language Processing", aliases: Object.freeze(["Language Processing"]), abbreviations: Object.freeze(["NLP"]), broader: Object.freeze(["artificial-intelligence"]), related: Object.freeze(["semantic-transformation"]) }),
  Object.freeze({ id: "large-language-models", label: "Large Language Models", aliases: Object.freeze(["Large Language Model", "Generative AI"]), abbreviations: Object.freeze(["LLM", "LLMs"]), broader: Object.freeze(["artificial-intelligence"]), related: Object.freeze(["natural-language-processing"]) }),
  Object.freeze({ id: "national-security-ai", label: "National Security AI", aliases: Object.freeze(["AI in National Security", "Defense AI", "Defence AI", "Military AI"]), broader: Object.freeze(["artificial-intelligence"]), related: Object.freeze(["military", "strategy"]) }),
  Object.freeze({ id: "semantic-transformation", label: "Semantic Transformation", aliases: Object.freeze(["Text Transformation", "Semantic Engine", "Semantic Decomposition"]), related: Object.freeze(["information-architecture", "natural-language-processing"]) }),
  Object.freeze({ id: "linguistic-register", label: "Linguistic Register", aliases: Object.freeze(["Register Transformation", "Writing Register"]), related: Object.freeze(["semantic-transformation", "documentation"]) }),
  Object.freeze({ id: "controlled-language", label: "Controlled Language", aliases: Object.freeze(["Controlled Natural Language", "Structured Writing"]), related: Object.freeze(["linguistic-register", "documentation"]) }),
  Object.freeze({ id: "api-integration", label: "API Integration", aliases: Object.freeze(["Web API", "Serverless API"]), related: Object.freeze(["systems-architecture", "web-development"]) }),
  Object.freeze({ id: "api-wrapper", label: "API Wrapper", aliases: Object.freeze(["Model API Wrapper", "LLM Wrapper"]), broader: Object.freeze(["api-integration"]) }),
  Object.freeze({ id: "webgpu", label: "WebGPU", broader: Object.freeze(["web-development"]), related: Object.freeze(["human-computer-interaction"]) }),
  Object.freeze({ id: "webgl", label: "WebGL", broader: Object.freeze(["web-development"]), related: Object.freeze(["human-computer-interaction"]) }),
  Object.freeze({ id: "business-analysis", label: "Business Analysis", aliases: Object.freeze(["Business Analyst", "Process Analysis"]), related: Object.freeze(["requirements", "project-management"]) }),
  Object.freeze({ id: "requirements", label: "Requirements Engineering", aliases: Object.freeze(["Requirements Analysis", "Traceability"]), broader: Object.freeze(["systems-architecture"]), related: Object.freeze(["business-analysis", "documentation"]) }),
  Object.freeze({ id: "project-management", label: "Project Management", aliases: Object.freeze(["Project Manager", "Program Management", "Program Manager"]), related: Object.freeze(["business-analysis", "strategy"]) }),
  Object.freeze({ id: "strategy", label: "Strategy", aliases: Object.freeze(["Strategic Planning", "Grand Strategy"]), related: Object.freeze(["communications", "simulation"]) }),
  Object.freeze({ id: "statecraft", label: "Statecraft", aliases: Object.freeze(["Economic Statecraft"]), broader: Object.freeze(["strategy"]) }),
  Object.freeze({ id: "sanctions", label: "Sanctions", aliases: Object.freeze(["Economic Sanctions", "Sanctions Policy", "Sanctions Regimes"]), broader: Object.freeze(["statecraft"]) }),
  Object.freeze({ id: "coercive-statecraft", label: "Coercive Statecraft", aliases: Object.freeze(["Coercive Diplomacy", "Compellence", "Coercion"]), broader: Object.freeze(["statecraft"]) }),
  Object.freeze({ id: "communications", label: "Communications", aliases: Object.freeze(["Communication", "Communication Skills"]), related: Object.freeze(["leadership"]) }),
  Object.freeze({ id: "strategic-communications", label: "Strategic Communications", aliases: Object.freeze(["Strategic Communication", "Strategic Comms", "StratCom", "Information Operations", "Narrative Influence"]), broader: Object.freeze(["communications"]), related: Object.freeze(["strategy"]) }),
  Object.freeze({ id: "leadership", label: "Leadership", aliases: Object.freeze(["Team Leadership", "People Leadership"]), related: Object.freeze(["teaching", "military"]) }),
  Object.freeze({ id: "government", label: "Government", aliases: Object.freeze(["Public Sector"]), related: Object.freeze(["strategy"]) }),
  Object.freeze({ id: "government-service", label: "Government Service", aliases: Object.freeze(["Government Employment", "Public-Sector Service"]), broader: Object.freeze(["government"]), related: Object.freeze(["public-safety"]) }),
  Object.freeze({ id: "public-service", label: "Public Service", aliases: Object.freeze(["Community Service"]), related: Object.freeze(["government", "government-service"]) }),
  Object.freeze({ id: "digital-government", label: "Digital Government", aliases: Object.freeze(["Digital Governments", "Digital Governance", "E-Government", "E-Governance", "Electronic Government", "Government Technology", "Public-Sector Technology", "GovTech"]), broader: Object.freeze(["government"]), related: Object.freeze(["data", "security"]) }),
  Object.freeze({ id: "information-environments", label: "Information Environments", aliases: Object.freeze(["Information Environment"]), related: Object.freeze(["information-architecture", "strategy"]) }),
  Object.freeze({ id: "disinformation", label: "Disinformation", aliases: Object.freeze(["Misinformation"]), related: Object.freeze(["information-environments", "strategic-communications"]) }),
  Object.freeze({ id: "influence", label: "Influence", aliases: Object.freeze(["Foreign Influence", "Social Influence"]), related: Object.freeze(["information-environments", "strategic-communications"]) }),
  Object.freeze({ id: "education", label: "Education", aliases: Object.freeze(["Continuing Education", "Professional Development"]), related: Object.freeze(["teaching"]) }),
  Object.freeze({ id: "computer-science", label: "Computer Science", abbreviations: Object.freeze(["CS"]), broader: Object.freeze(["education"]), related: Object.freeze(["software-development", "data"]) }),
  Object.freeze({ id: "business-studies", label: "Business", aliases: Object.freeze(["Business Studies"]), broader: Object.freeze(["education"]), related: Object.freeze(["business-analysis"]) }),
  Object.freeze({ id: "training-participation", label: "Training Participation", aliases: Object.freeze(["Training", "Professional Training", "Candidate Training"]), related: Object.freeze(["education", "teaching"]) }),
  Object.freeze({ id: "teaching", label: "Teaching", aliases: Object.freeze(["Instruction", "Training", "Mentorship", "Instructor", "Educator"]), related: Object.freeze(["education", "leadership"]) }),
  Object.freeze({ id: "library", label: "Library", aliases: Object.freeze(["Libraries", "Library Science", "GLAM"]), related: Object.freeze(["archives", "metadata"]) }),
  Object.freeze({ id: "archives", label: "Archives", aliases: Object.freeze(["Archival"]), related: Object.freeze(["library", "provenance"]) }),
  Object.freeze({ id: "library-technology", label: "Library Technology", aliases: Object.freeze(["Library Systems", "Library Software", "Library IT"]), broader: Object.freeze(["library"]), related: Object.freeze(["information-architecture", "metadata", "software-development", "systems"]) }),
  Object.freeze({ id: "digital-preservation", label: "Digital Preservation", aliases: Object.freeze(["Digital Stewardship", "Digital Preservation Systems", "Archive Continuity", "Archival Continuity", "Digitization", "Digital Asset Management"]), abbreviations: Object.freeze(["DAM"]), broader: Object.freeze(["archives"]), related: Object.freeze(["continuity", "provenance", "metadata"]) }),
  Object.freeze({ id: "web-services-librarianship", label: "Web Services Librarian", aliases: Object.freeze(["Web Services Librarianship", "Library Web Services"]), broader: Object.freeze(["library-technology"]), related: Object.freeze(["web-development"]) }),
  Object.freeze({ id: "systems-librarianship", label: "Systems Librarian", aliases: Object.freeze(["Systems Librarianship", "Library Systems Librarian"]), broader: Object.freeze(["library-technology"]), related: Object.freeze(["systems-architecture"]) }),
  Object.freeze({ id: "bibliographic-formats", label: "Bibliographic Data Formats", aliases: Object.freeze(["BibTeX"]), abbreviations: Object.freeze(["MARC", "RIS"]), broader: Object.freeze(["metadata"]), related: Object.freeze(["library-technology"]) }),
  Object.freeze({ id: "parser-hardening", label: "Parser Hardening", aliases: Object.freeze(["Parser Security", "Bounded Parsing", "Fail Closed"]), related: Object.freeze(["security", "verification"]) }),
  Object.freeze({ id: "recovery-operations", label: "Recovery Operations", aliases: Object.freeze(["Rollback", "Reconciliation", "Quarantine"]), broader: Object.freeze(["continuity"]) }),
  Object.freeze({ id: "hostile-imports", label: "Hostile Imports", aliases: Object.freeze(["Hostile Import", "Malicious Imports"]), related: Object.freeze(["parser-hardening", "security"]) }),
  Object.freeze({ id: "military", label: "Military", aliases: Object.freeze(["Defense"]), related: Object.freeze(["naval", "strategy", "leadership"]) }),
  Object.freeze({ id: "national-security", label: "National Security", aliases: Object.freeze(["National Defence", "National Defense"]), related: Object.freeze(["military", "strategy"]) }),
  Object.freeze({ id: "naval", label: "Naval", aliases: Object.freeze(["Navy", "Maritime"],), broader: Object.freeze(["military"]) }),
  Object.freeze({ id: "public-safety", label: "Public Safety", related: Object.freeze(["incident-response", "leadership"]) }),
  Object.freeze({ id: "corrections", label: "Corrections", aliases: Object.freeze(["Correctional Operations", "Correctional Services"]), broader: Object.freeze(["public-safety"]) }),
  Object.freeze({ id: "first-response", label: "First Responder", aliases: Object.freeze(["First Responders", "First Response"]), broader: Object.freeze(["public-safety"]), related: Object.freeze(["incident-response"]) }),
  Object.freeze({ id: "uniformed-public-safety", label: "Uniformed Public Safety", aliases: Object.freeze(["Thin Blue Line"]), broader: Object.freeze(["public-safety"]) }),
  Object.freeze({ id: "institutional-security", label: "Institutional Security", aliases: Object.freeze(["Facility Security"]), broader: Object.freeze(["security"]), related: Object.freeze(["corrections"]) }),
  Object.freeze({ id: "policy-enforcement", label: "Policy Enforcement", aliases: Object.freeze(["Policy Compliance"]), broader: Object.freeze(["public-safety"]) }),
  Object.freeze({ id: "incident-documentation", label: "Incident Documentation", aliases: Object.freeze(["Incident Report", "Incident Reporting"]), broader: Object.freeze(["documentation"]), related: Object.freeze(["public-safety"]) }),
  Object.freeze({ id: "de-escalation", label: "De-escalation", aliases: Object.freeze(["Deescalation", "Crisis De-escalation"]), related: Object.freeze(["communications", "public-safety"]) }),
  Object.freeze({ id: "escalation", label: "Escalation", aliases: Object.freeze(["Escalation Dynamics"]), related: Object.freeze(["strategy", "incident-response"]) }),
  Object.freeze({ id: "situational-awareness", label: "Situational Awareness", aliases: Object.freeze(["Operational Awareness"]), related: Object.freeze(["incident-response", "public-safety"]) }),
  Object.freeze({ id: "emergency-operations", label: "Emergency Operations", aliases: Object.freeze(["Emergency Preparedness", "Emergency Response"]), broader: Object.freeze(["public-safety"]), related: Object.freeze(["incident-response"]) }),
  Object.freeze({ id: "shift-work", label: "Shift Work", aliases: Object.freeze(["Shiftwork"]), broader: Object.freeze(["work-experience"]) }),
  Object.freeze({ id: "night-shift", label: "Night Shift", aliases: Object.freeze(["Night Shifts", "Night Work", "Overnight Shift", "Overnight Shifts", "Overnight Work", "Overnights"]), broader: Object.freeze(["shift-work"]) }),
  Object.freeze({ id: "long-shift", label: "Long Shift", aliases: Object.freeze(["Long Shifts", "12-Hour Shift", "12-Hour Shifts", "12 Hour Shift", "12 Hour Shifts", "12 Hr Shift", "12 Hr Shifts", "Twelve-Hour Shift", "Twelve-Hour Shifts", "12-Plus-Hour Shift", "12-Plus-Hour Shifts", "12+ Hour Shift", "12+ Hour Shifts"]), broader: Object.freeze(["shift-work"]) }),
  Object.freeze({ id: "decision-under-uncertainty", label: "Decision-Making Under Uncertainty", aliases: Object.freeze(["Decision Making Under Uncertainty", "Decisions Under Uncertainty", "Decision Support Under Uncertainty", "Uncertain Decision Making", "Contingent Choice"]), related: Object.freeze(["strategy", "simulation", "situational-awareness"]) }),
  Object.freeze({ id: "risk-modeling", label: "Risk Modeling", aliases: Object.freeze(["Risk Modelling"]), related: Object.freeze(["modeling", "strategy"]) }),
  Object.freeze({ id: "fog-of-war", label: "Fog of War", aliases: Object.freeze(["Information Fog"]), related: Object.freeze(["military", "wargaming", "information-environments"]) }),
  Object.freeze({ id: "deterrence", label: "Deterrence", aliases: Object.freeze(["Strategic Deterrence"]), broader: Object.freeze(["strategy"]) }),
  Object.freeze({ id: "human-factors", label: "Human Factors", aliases: Object.freeze(["Human Factors Engineering", "Ergonomics"]), related: Object.freeze(["human-computer-interaction", "interaction-design", "accessibility"]) }),
  Object.freeze({ id: "human-computer-interaction", label: "Human-Computer Interaction", aliases: Object.freeze(["Human Computer Interaction"]), abbreviations: Object.freeze(["HCI"]), related: Object.freeze(["human-factors", "interaction-design", "accessibility"]) }),
  Object.freeze({ id: "multi-agent-systems", label: "Multi-Agent Systems", aliases: Object.freeze(["Multi Agent Systems", "Multi-Agent", "Multi Agent", "Multiagent", "Multi-Agent Simulation", "Multi Agent Simulation", "Agent-Based Systems", "Agent-Based Simulation", "Agentic Simulation"]), broader: Object.freeze(["systems"]), related: Object.freeze(["simulation", "modeling"]) }),
  Object.freeze({ id: "war-studies", label: "War Studies", aliases: Object.freeze(["War", "Warfare", "Military History", "Military Studies", "Defense Studies", "Defence Studies"]), broader: Object.freeze(["military"]), related: Object.freeze(["strategy", "national-security"]) }),
  Object.freeze({ id: "nextjs", label: "Next.js", aliases: Object.freeze(["NextJS", "Next"]), broader: Object.freeze(["web-development"]) }),
  Object.freeze({ id: "nodejs", label: "Node.js", aliases: Object.freeze(["NodeJS", "Node"]), broader: Object.freeze(["software-development"]) }),
  Object.freeze({ id: "fabrication", label: "Fabrication", aliases: Object.freeze(["Digital Fabrication", "Makerspace"]), broader: Object.freeze(["engineering"]) }),
  Object.freeze({ id: "electronics", label: "Electronics", aliases: Object.freeze(["Soldering", "Electrostatic Discharge Controls"]), abbreviations: Object.freeze(["ESD"]), broader: Object.freeze(["engineering"]) }),
]);

const EXACT_CONCEPT_IDS_BY_TERM: ReadonlyMap<string, readonly string[]> = (() => {
  const owners = new Map<string, string[]>();
  for (const concept of resumeSearchConcepts) {
    for (const term of [concept.label, ...(concept.aliases ?? []), ...(concept.abbreviations ?? [])]) {
      const normalized = normalizeSearchText(term);
      const ids = owners.get(normalized) ?? [];
      if (!ids.includes(concept.id)) ids.push(concept.id);
      owners.set(normalized, ids);
    }
  }
  return new Map(Array.from(owners, ([term, ids]) => [term, Object.freeze(ids)] as const));
})();

type ConceptPattern = Readonly<{
  id: string;
  pattern: RegExp;
  fieldPattern?: RegExp;
  excludedFieldPattern?: RegExp;
}>;

const CONCEPT_PATTERNS: readonly ConceptPattern[] = Object.freeze([
  // This deliberately classifies only the typed engagement-kind field. A
  // prose phrase containing "work" is not evidence of employment.
  { id: "work-experience", pattern: /^(?:employment|internship)$/iu, fieldPattern: /\.engagementKind$/u },
  // Generic organization names such as "Health Network" are identity
  // evidence, not proof of systems practice. Network language is classified
  // only when the surrounding phrase carries a systems meaning.
  { id: "systems", pattern: /\b(?:systems?|ecosystems?|architecture)\b|\bnetwork(?:-scale| (?:architecture|diagrams?|infrastructure))\b/iu, excludedFieldPattern: /\.organization$/u },
  { id: "systems-thinking", pattern: /\bsystems thinking\b|\bsystems approach\b/iu },
  // Adjacent disciplines retain their own ontology nodes: Data Architecture
  // and Information Architecture are not silently collapsed into Systems
  // Architecture merely because their labels share one word.
  { id: "systems-architecture", pattern: /\b(?:systems?|solution) architecture\b|\blocal.first architecture\b|\bboundary design\b|\bstate modeling\b/iu },
  // "Development" alone is not software evidence (for example, proposal or
  // collection development). Require an explicit software/application phrase,
  // a development discipline, or a named programming technology.
  { id: "software-development", pattern: /\bsoftware(?:application|sourcecode)?\b|\bsource code\b|\b(?:web|front-?end|application) development\b|\bapplication frameworks?\b|\b(?:react|next\.js|node\.js|typescript|javascript|python|c#|c\+\+|java|bash|glsl)\b/iu },
  { id: "software-engineering", pattern: /\bsoftware engineer(?:ing)?\b|\bapplication engineering\b/iu },
  { id: "web-development", pattern: /\bweb\b|front-?end/iu },
  { id: "programming", pattern: /programming|coding|typescript|javascript|python|c#|c\+\+|java\b|bash|glsl/iu },
  // Generic delivery, release, and change-management language is not enough
  // to establish DevOps; require the discipline or a named delivery tool.
  { id: "devops", pattern: /\bdevops\b|\b(?:software|build) delivery\b|\brelease engineering\b|\bgithub actions\b|\bcontinuous integration\b|\bci\/cd\b|\bcloudflare(?: workers)?\b|\bwrangler\b|\bvite\b|\bnpm\b|\bgit\b/iu },
  { id: "version-control", pattern: /\b(?:version|source) control\b/iu },
  { id: "data", pattern: /\bdata\b|database|schema|sql|neo4j|mongodb|arangodb|indexeddb/iu },
  { id: "data-architecture", pattern: /data architecture|schema|entity.relationship|database|sql|neo4j|mongodb|arangodb|indexeddb/iu },
  { id: "database-systems", pattern: /\bdatabases?\b|\bdatabase (?:systems?|engineering|management)\b|\b(?:relational|graph|document) databases?\b|\bnosql\b|\b(?:dbms|rdbms)\b|\b(?:sql|sqlite|mysql|neo4j|mongodb|arangodb|indexeddb)\b/iu },
  { id: "metadata", pattern: /metadata|crosswalk/iu },
  { id: "information-governance", pattern: /\b(?:information|data) governance\b|\bdata stewardship\b/iu },
  { id: "information-retrieval", pattern: /\binformation retrieval\b|\bsearch and retrieval\b/iu },
  // Knowledge as subject matter is not itself Information Architecture.
  // Require an explicit IA access path, semantic structure, or ontology cue.
  { id: "information-architecture", pattern: /\binformation architecture\b|\baccess paths?\b|\bsemantic(?:s| atoms?| atomization| fidelity| layer| model(?:ing)?| vocabulary)\b|\bontolog(?:y|ies|ical)\b/iu },
  { id: "interaction-design", pattern: /interaction|user experience|service design|interface/iu },
  { id: "accessibility", pattern: /accessib|screen reader|inclusive/iu },
  { id: "security", pattern: /security|cyber|threat|adversarial|attack/iu },
  { id: "cybersecurity", pattern: /\bcyber ?security\b|\bcyber (?:warfare|governance|defen[cs]e)\b/iu },
  { id: "threat-modeling", pattern: /\bthreat model(?:ing)?\b|\bthreat analysis\b/iu },
  { id: "verification", pattern: /verification|validation|testing|testable|quality|regression|codeql|playwright|fidelity|integrity/iu },
  { id: "red-teaming", pattern: /\bred[ -]?team(?:ing)?\b|\badversarial review\b/iu },
  { id: "adversarial-testing", pattern: /\badversarial test(?:ing)?\b|\babuse.case testing\b/iu },
  { id: "content-security-policy", pattern: /\bcontent security policy\b|\bcsp\b/iu },
  { id: "privacy", pattern: /privacy|private/iu },
  { id: "local-first", pattern: /local.first|offline/iu },
  { id: "resilience", pattern: /resilien|recovery|disruption|pressure|high.friction|high.stress|survival/iu },
  { id: "resilient-systems", pattern: /\bresilient systems?\b|\bsystem resilience\b/iu },
  { id: "high-consequence-systems", pattern: /\bhigh[ -](?:consequence|stakes) systems?\b|\bmission[ -]critical systems?\b/iu },
  { id: "continuity", pattern: /continuity|recovery|handoff/iu },
  { id: "incident-response", pattern: /incident response|emergency|damage control|firefighting/iu },
  { id: "provenance", pattern: /provenance|custody|fixity|lineage/iu },
  { id: "documentation", pattern: /documentation|technical guide|manual|diagram/iu },
  { id: "modeling", pattern: /modeling|model |model$|uml|bpmn|diagram|matrix/iu },
  { id: "software-modeling", pattern: /\bsoftware modeling\b/iu },
  { id: "simulation", pattern: /simulation|stochastic|deterministic|wargaming|procedural scenario/iu },
  { id: "wargaming", pattern: /\bwar ?gam(?:e|es|ing)\b|\bwargam(?:e|es|ing)\b|\bkriegsspiel\b/iu },
  { id: "wargame-design", pattern: /\bwargame design\b|\bscenario (?:design|development)\b|\badjudication\b|\bdecision support\b|\bassumption testing\b/iu },
  { id: "artificial-intelligence", pattern: /artificial intelligence|machine learning|\bai\b/iu },
  { id: "natural-language-processing", pattern: /\bnatural language processing\b|\blanguage processing\b|\bnlp\b/iu },
  { id: "large-language-models", pattern: /\blarge language models?\b|\bgenerative ai\b|\bllms?\b/iu },
  { id: "national-security-ai", pattern: /\b(?:national security|defen[cs]e|military) ai\b|\bai in national security\b/iu },
  { id: "semantic-transformation", pattern: /\bsemantic transformation\b|\btext transformation\b|\bsemantic (?:engine|decomposition)\b/iu },
  { id: "linguistic-register", pattern: /\blinguistic register\b|\bregister transformation\b|\bwriting register\b/iu },
  { id: "controlled-language", pattern: /\bcontrolled (?:natural )?language\b|\bstructured writing\b/iu },
  { id: "api-integration", pattern: /\bapi (?:integration|wrapper)\b|\bweb api\b|\bserverless api\b/iu },
  { id: "api-wrapper", pattern: /\b(?:model |llm )?api wrapper\b|\bllm wrapper\b/iu },
  { id: "webgpu", pattern: /\bwebgpu\b/iu },
  { id: "webgl", pattern: /\bwebgl\b/iu },
  // "Business" and "process" are too broad on their own; the compound must
  // identify an analysis practice rather than merely a community or activity.
  { id: "business-analysis", pattern: /\bbusiness analysis\b|\bbusiness process\b|\b(?:contract|productivity|process) analysis\b|\bqualitative review\b/iu },
  // Standards compliance is evidence of conformance, not evidence that the
  // person performed requirements engineering.
  { id: "requirements", pattern: /\brequirements(?: engineering| analysis)?\b|\btraceability\b/iu },
  { id: "project-management", pattern: /project management|project scheduling|gantt|program management|release and change/iu },
  { id: "strategy", pattern: /\bstrategy\b|\bstatecraft\b|\bwargaming\b|\btactical (?:planning|decision.making)\b/iu },
  { id: "statecraft", pattern: /\b(?:economic )?statecraft\b/iu },
  { id: "sanctions", pattern: /\b(?:economic )?sanctions?\b|\bsanctions (?:policy|regimes?)\b/iu },
  { id: "coercive-statecraft", pattern: /\bcoercive (?:statecraft|diplomacy)\b|\bcompellence\b|\bcoercion\b/iu },
  { id: "communications", pattern: /communication|collaboration|mediation|subtext/iu },
  { id: "strategic-communications", pattern: /\bstrategic comm(?:unication)?s?\b|\bstratcom\b|\binformation operations?\b|\bnarrative influence\b/iu },
  { id: "leadership", pattern: /leadership|officer|cohesion|coordination|mentorship|bearing|discipline/iu },
  { id: "government", pattern: /\bgovernments?\b|\bpublic sector\b/iu },
  { id: "public-service", pattern: /\bpublic service\b|\bcommunity service\b/iu },
  { id: "digital-government", pattern: /\bdigital governments?\b|\be.govern(?:ment|ance)\b|\belectronic government\b|\bgovernment technology\b|\bgovtech\b/iu },
  { id: "information-environments", pattern: /\binformation environments?\b/iu },
  { id: "disinformation", pattern: /\b(?:dis|mis)information\b/iu },
  { id: "influence", pattern: /\b(?:foreign|social) influence\b|\binfluence\b/iu },
  { id: "education", pattern: /education|student|course|certificate|university|college|school|learning|qualification/iu },
  // Participation in training and delivery of teaching are different search
  // intents. The typed engagement kind retains the former without claiming
  // that a candidate was the instructor.
  { id: "training-participation", pattern: /^training$/iu, fieldPattern: /\.engagementKind$/u },
  // Risk assessment is not teaching. Assessment counts only when its local
  // wording establishes a learning or instructional activity.
  { id: "teaching", pattern: /\b(?:teach(?:ing|er)?|instruction|course design|mentorship|proctor(?:ing)?)\b|\b(?:student|course|learning|instructional) assessment\b/iu },
  { id: "library", pattern: /librar|ohiolink|collection development|makerspace/iu },
  { id: "archives", pattern: /archive|digitization|digital asset management/iu },
  { id: "library-technology", pattern: /\blibrary (?:technology|systems?|software)\b/iu },
  { id: "digital-preservation", pattern: /\bdigital (?:preservation|stewardship|asset management)\b|\b(?:digital preservation|preservation) systems?\b|\barchiv(?:e|al) continuity\b|\bdigitization\b|\bdam\b/iu },
  { id: "web-services-librarianship", pattern: /\bweb services librarianship\b|\bweb services librarian\b|\blibrary web services\b/iu },
  { id: "systems-librarianship", pattern: /\bsystems librarianship\b|\bsystems librarian\b|\blibrary systems librarian\b/iu },
  { id: "bibliographic-formats", pattern: /\bbibliographic data formats?\b|\bbibtex\b|\bmarc\b|\bris\b/iu },
  { id: "parser-hardening", pattern: /\bparser (?:hardening|security)\b|\bbounded parsing\b|\bfail closed\b/iu },
  { id: "recovery-operations", pattern: /\brecovery operations?\b|\brollback\b|\breconciliation\b|\bquarantine\b/iu },
  { id: "hostile-imports", pattern: /\bhostile imports?\b|\bmalicious imports?\b/iu },
  { id: "military", pattern: /military|national security|combat|weapons|fogofwar|naval|shipboard|marine navigation/iu },
  { id: "national-security", pattern: /\bnational (?:security|defen[cs]e)\b/iu },
  { id: "naval", pattern: /naval|navy|shipboard|seamanship|shiphandling|marine navigation/iu },
  { id: "public-safety", pattern: /\bpublic safety\b/iu },
  { id: "corrections", pattern: /\bcorrection(?:s|al)?\b/iu },
  { id: "first-response", pattern: /\bfirst respond(?:er|ers)\b|\bfirst response\b/iu },
  { id: "uniformed-public-safety", pattern: /\bthin blue line\b|\buniformed public safety\b/iu },
  { id: "institutional-security", pattern: /\binstitutional security\b|\bfacility security\b/iu },
  { id: "policy-enforcement", pattern: /\bpolicy enforcement\b|\bpolicy compliance\b/iu },
  { id: "incident-documentation", pattern: /\bincident (?:documentation|reports?|reporting)\b/iu },
  { id: "de-escalation", pattern: /\bde[ -]?escalation\b/iu },
  { id: "escalation", pattern: /(?<!de[ -])\bescalation(?: dynamics)?\b/iu },
  { id: "situational-awareness", pattern: /\b(?:situational|operational) awareness\b/iu },
  { id: "emergency-operations", pattern: /\bemergency(?: preparedness| operations?| response)?\b|\bdamage control\b|\bfirefighting\b/iu },
  { id: "decision-under-uncertainty", pattern: /\bdecision.making under uncertainty\b|\buncertain decision.making\b|\bcontingent choice\b/iu },
  { id: "risk-modeling", pattern: /\brisk modell?ing\b/iu },
  { id: "fog-of-war", pattern: /\bfog of war\b|\bfogofwar\b|\binformation fog\b/iu },
  { id: "deterrence", pattern: /\b(?:strategic )?deterrence\b/iu },
  { id: "human-factors", pattern: /\bhuman factors(?: engineering)?\b|\bergonomics\b/iu },
  { id: "human-computer-interaction", pattern: /\bhuman.computer interaction\b|\bhci\b/iu },
  { id: "multi-agent-systems", pattern: /\bmulti.agent(?: systems?| simulation)?\b|\bmultiagent\b|\bagent.based simulation\b|\bagentic simulation\b/iu },
  { id: "fabrication", pattern: /fabrication|laser cutting|drilling|embroidery|3d printing|sublimation|makerspace/iu },
  { id: "electronics", pattern: /electronic|solder|electrostatic|esd|wrist strap|grounding/iu },
]);

function conceptsFor(text: string, fieldPath: string) {
  return Object.freeze(CONCEPT_PATTERNS.filter(({ pattern, fieldPattern, excludedFieldPattern }) => (
    (!fieldPattern || fieldPattern.test(fieldPath))
    && (!excludedFieldPattern || !excludedFieldPattern.test(fieldPath))
    && pattern.test(text)
  )).map(({ id }) => id));
}

function evidence(
  text: string,
  sourcePath: string,
  fieldPath: string,
  strength: SearchEvidenceStrength = "explicit",
): SearchEvidence {
  return Object.freeze({ text, sourcePath, fieldPath, strength, conceptIds: conceptsFor(text, fieldPath) });
}

function pushText(
  target: SearchEvidence[],
  value: unknown,
  sourcePath: string,
  fieldPath: string,
  strength: SearchEvidenceStrength = "explicit",
) {
  if (typeof value === "string" && value.trim()) target.push(evidence(value, sourcePath, fieldPath, strength));
}

function appendAttachmentSearchMetadata(target: SearchEvidence[], recordId: string) {
  for (const entry of resumeSearchAttachmentCoverageContract) {
    if (entry.recordId !== recordId) continue;
    entry.terms.forEach((text, index) => {
      target.push(Object.freeze({
        text,
        sourcePath: "app/resume/resumeSearchOntology.ts",
        fieldPath: `resumeSearchAttachmentCoverageContract.${entry.sourceId}.terms[${index}]`,
        strength: "curated",
        // Exact ontology lexemes own their corresponding single-intent query.
        // Other handoff terms remain direct, record-scoped evidence instead of
        // acquiring every broader word that happens to occur in the phrase.
        conceptIds: EXACT_CONCEPT_IDS_BY_TERM.get(normalizeSearchText(text)) ?? Object.freeze([]),
      }));
    });
  }
}

// Search-only access points remain separate from card copy. Each item is a
// bounded editorial assertion attached to one canonical record, so recruiter
// vocabulary can expand without turning the project corpus into an
// unstructured bag of tags.
const PROJECT_AUTHORED_SEARCH_METADATA: Readonly<Record<string, readonly AuthoredSearchMetadata[]>> = Object.freeze({
  lattice: Object.freeze([
    Object.freeze({ text: "Transformation provenance", conceptIds: Object.freeze(["provenance"]) }),
    Object.freeze({ text: "Natural language processing", conceptIds: Object.freeze(["natural-language-processing"]) }),
    Object.freeze({ text: "Large language models", conceptIds: Object.freeze(["large-language-models"]) }),
    Object.freeze({ text: "Semantic transformation", conceptIds: Object.freeze(["semantic-transformation"]) }),
    Object.freeze({ text: "Linguistic register", conceptIds: Object.freeze(["linguistic-register"]) }),
    Object.freeze({ text: "API wrapper", conceptIds: Object.freeze(["api-wrapper"]) }),
    Object.freeze({ text: "Content Security Policy", conceptIds: Object.freeze(["content-security-policy"]) }),
    Object.freeze({ text: "Red teaming", conceptIds: Object.freeze(["red-teaming"]) }),
    Object.freeze({ text: "Adversarial testing", conceptIds: Object.freeze(["adversarial-testing"]) }),
    Object.freeze({ text: "Controlled language", conceptIds: Object.freeze(["controlled-language"]) }),
    Object.freeze({ text: "Software engineering", conceptIds: Object.freeze(["software-engineering"]) }),
    Object.freeze({ text: "Systems thinking", conceptIds: Object.freeze(["systems-thinking"]) }),
  ]),
  "in-keeping": Object.freeze([
    Object.freeze({ text: "Library technology", conceptIds: Object.freeze(["library-technology"]) }),
    Object.freeze({ text: "Digital preservation", conceptIds: Object.freeze(["digital-preservation"]) }),
    Object.freeze({ text: "Web services librarianship", conceptIds: Object.freeze(["web-services-librarianship"]) }),
    Object.freeze({ text: "Systems librarianship", conceptIds: Object.freeze(["systems-librarianship"]) }),
    Object.freeze({ text: "Information retrieval", conceptIds: Object.freeze(["information-retrieval"]) }),
    Object.freeze({ text: "Information governance", conceptIds: Object.freeze(["information-governance"]) }),
    Object.freeze({ text: "Resilient systems", conceptIds: Object.freeze(["resilient-systems"]) }),
    Object.freeze({ text: "High-consequence systems", conceptIds: Object.freeze(["high-consequence-systems"]) }),
    Object.freeze({ text: "Threat modeling", conceptIds: Object.freeze(["threat-modeling"]) }),
    Object.freeze({ text: "Red teaming", conceptIds: Object.freeze(["red-teaming"]) }),
    Object.freeze({ text: "Bibliographic data formats", conceptIds: Object.freeze(["bibliographic-formats"]) }),
    Object.freeze({ text: "Parser hardening", conceptIds: Object.freeze(["parser-hardening"]) }),
    Object.freeze({ text: "Recovery operations", conceptIds: Object.freeze(["recovery-operations"]) }),
    Object.freeze({ text: "Hostile imports", conceptIds: Object.freeze(["hostile-imports"]) }),
    Object.freeze({ text: "Privacy-preserving local operation", conceptIds: Object.freeze(["privacy", "local-first"]) }),
    Object.freeze({ text: "Cybersecurity", conceptIds: Object.freeze(["cybersecurity"]) }),
    Object.freeze({ text: "Adversarial testing", conceptIds: Object.freeze(["adversarial-testing"]) }),
    Object.freeze({ text: "Accessibility engineering", conceptIds: Object.freeze(["accessibility"]) }),
    Object.freeze({ text: "Software engineering", conceptIds: Object.freeze(["software-engineering"]) }),
    Object.freeze({ text: "Systems thinking", conceptIds: Object.freeze(["systems-thinking"]) }),
  ]),
  "fog-of-sea": Object.freeze([
    Object.freeze({ text: "Naval wargaming", conceptIds: Object.freeze(["wargaming"]) }),
    Object.freeze({ text: "Decision-making under uncertainty", conceptIds: Object.freeze(["decision-under-uncertainty"]) }),
    Object.freeze({ text: "Human factors in command decisions", conceptIds: Object.freeze(["human-factors"]) }),
    Object.freeze({ text: "Human-computer interaction", conceptIds: Object.freeze(["human-computer-interaction"]) }),
    Object.freeze({ text: "Scenario design, adjudication, and decision support", conceptIds: Object.freeze(["wargame-design"]) }),
    Object.freeze({ text: "Resilient systems", conceptIds: Object.freeze(["resilient-systems"]) }),
    Object.freeze({ text: "High-consequence systems", conceptIds: Object.freeze(["high-consequence-systems"]) }),
    Object.freeze({ text: "Threat modeling", conceptIds: Object.freeze(["threat-modeling"]) }),
    Object.freeze({ text: "Red teaming", conceptIds: Object.freeze(["red-teaming"]) }),
    Object.freeze({ text: "Hostile imports", conceptIds: Object.freeze(["hostile-imports"]) }),
    Object.freeze({ text: "WebGL", conceptIds: Object.freeze(["webgl"]) }),
    Object.freeze({ text: "National security", conceptIds: Object.freeze(["national-security"]) }),
    Object.freeze({ text: "Adversarial testing", conceptIds: Object.freeze(["adversarial-testing"]) }),
    Object.freeze({ text: "Software engineering", conceptIds: Object.freeze(["software-engineering"]) }),
    Object.freeze({ text: "Systems thinking", conceptIds: Object.freeze(["systems-thinking"]) }),
    Object.freeze({ text: "Risk modeling", conceptIds: Object.freeze(["risk-modeling"]) }),
    Object.freeze({ text: "Fog of war", conceptIds: Object.freeze(["fog-of-war"]) }),
    Object.freeze({ text: "Information environment", conceptIds: Object.freeze(["information-environments"]) }),
    Object.freeze({ text: "Escalation dynamics", conceptIds: Object.freeze(["escalation"]) }),
  ]),
  chorus: Object.freeze([
    Object.freeze({ text: "Strategic communications", conceptIds: Object.freeze(["strategic-communications"]) }),
    Object.freeze({ text: "State-transition provenance", conceptIds: Object.freeze(["provenance"]) }),
    Object.freeze({ text: "Decision-making under uncertainty", conceptIds: Object.freeze(["decision-under-uncertainty"]), strength: "derived" }),
    Object.freeze({ text: "Resilient systems", conceptIds: Object.freeze(["resilient-systems"]) }),
    Object.freeze({ text: "High-consequence systems", conceptIds: Object.freeze(["high-consequence-systems"]) }),
    Object.freeze({ text: "Threat modeling", conceptIds: Object.freeze(["threat-modeling"]) }),
    Object.freeze({ text: "Red teaming", conceptIds: Object.freeze(["red-teaming"]) }),
    Object.freeze({ text: "Local-first", conceptIds: Object.freeze(["local-first"]) }),
    Object.freeze({ text: "Privacy-preserving", conceptIds: Object.freeze(["privacy"]) }),
    Object.freeze({ text: "Adversarial testing", conceptIds: Object.freeze(["adversarial-testing"]) }),
    Object.freeze({ text: "Accessibility engineering", conceptIds: Object.freeze(["accessibility"]) }),
    Object.freeze({ text: "Software engineering", conceptIds: Object.freeze(["software-engineering"]) }),
    Object.freeze({ text: "Systems thinking", conceptIds: Object.freeze(["systems-thinking"]) }),
    Object.freeze({ text: "Information environment", conceptIds: Object.freeze(["information-environments"]) }),
    Object.freeze({ text: "Disinformation", conceptIds: Object.freeze(["disinformation"]) }),
    Object.freeze({ text: "Foreign influence", conceptIds: Object.freeze(["influence"]) }),
  ]),
  evenward: Object.freeze([
    Object.freeze({ text: "Human factors", conceptIds: Object.freeze(["human-factors"]) }),
    Object.freeze({ text: "Human-computer interaction", conceptIds: Object.freeze(["human-computer-interaction"]) }),
    Object.freeze({ text: "Resilient systems", conceptIds: Object.freeze(["resilient-systems"]) }),
    Object.freeze({ text: "Red teaming", conceptIds: Object.freeze(["red-teaming"]) }),
    Object.freeze({ text: "Local-first", conceptIds: Object.freeze(["local-first"]) }),
    Object.freeze({ text: "WebGL", conceptIds: Object.freeze(["webgl"]) }),
    Object.freeze({ text: "Adversarial testing", conceptIds: Object.freeze(["adversarial-testing"]) }),
    Object.freeze({ text: "Accessibility engineering", conceptIds: Object.freeze(["accessibility"]) }),
    Object.freeze({ text: "Software engineering", conceptIds: Object.freeze(["software-engineering"]) }),
    Object.freeze({ text: "Systems thinking", conceptIds: Object.freeze(["systems-thinking"]) }),
  ]),
});

function projectRecords(): SearchRecord[] {
  return (projects as unknown as readonly ProjectSource[]).map((project, order) => {
    const items: SearchEvidence[] = [];
    pushText(items, project.id, "app/resume/projects.js", `projects[${order}].id`);
    pushText(items, project.slug, "app/resume/projects.js", `projects[${order}].slug`);
    pushText(items, project.name, "app/resume/projects.js", `projects[${order}].name`);
    pushText(items, project.type, "app/resume/projects.js", `projects[${order}].type`);
    pushText(items, project.canonicalPath, "app/resume/projects.js", `projects[${order}].canonicalPath`);
    pushText(items, project.thesis, "app/resume/projects.js", `projects[${order}].thesis`);
    pushText(items, project.url, "app/resume/projects.js", `projects[${order}].url`);
    project.summary.forEach((value, index) => pushText(items, value, "app/resume/projects.js", `projects[${order}].summary[${index}]`));
    project.capabilities.forEach((value, index) => pushText(items, value, "app/resume/projects.js", `projects[${order}].capabilities[${index}]`));
    project.technologies.forEach((value, index) => pushText(items, value, "app/resume/projects.js", `projects[${order}].technologies[${index}]`));
    project.evidence.forEach((value, index) => pushText(items, value, "app/resume/projects.js", `projects[${order}].evidence[${index}]`));
    project.limitations.forEach((value, index) => pushText(items, value, "app/resume/projects.js", `projects[${order}].limitations[${index}]`));
    project.emphasis.forEach((value, index) => pushText(items, value, "app/resume/projects.js", `projects[${order}].emphasis[${index}]`));
    project.relationships.forEach((relationship, index) => {
      pushText(items, relationship.relation, "app/resume/projects.js", `projects[${order}].relationships[${index}].relation`);
      pushText(items, relationship.target, "app/resume/projects.js", `projects[${order}].relationships[${index}].target`);
      pushText(items, relationship.scope, "app/resume/projects.js", `projects[${order}].relationships[${index}].scope`);
    });
    project.resources.forEach((resource, index) => {
      for (const key of ["id", "artifactId", "label", "title", "url", "markdownUrl", "htmlMediaType", "markdownMediaType", "scope"] as const) {
        pushText(items, resource[key], "app/resume/projects.js", `projects[${order}].resources[${index}].${key}`);
      }
    });
    pushText(items, project.publication.label, "app/resume/projects.js", `projects[${order}].publication.label`);
    pushText(items, project.publication.value, "app/resume/projects.js", `projects[${order}].publication.value`);
    pushText(items, project.publication.precision, "app/resume/projects.js", `projects[${order}].publication.precision`);
    pushText(items, project.status, "app/resume/projects.js", `projects[${order}].status`);
    (PROJECT_AUTHORED_SEARCH_METADATA[project.id] ?? []).forEach((item, index) => {
      items.push(Object.freeze({
        text: item.text,
        sourcePath: "app/resume/resumeSearchOntology.ts",
        fieldPath: `PROJECT_AUTHORED_SEARCH_METADATA["${project.id}"][${index}]`,
        strength: item.strength ?? "curated",
        conceptIds: item.conceptIds,
      }));
    });
    appendAttachmentSearchMetadata(items, `resume-project-${project.id}`);
    const ongoing = project.status === "ongoing" || project.publication.precision === "open-range";
    return Object.freeze({
      id: `resume-project-${project.id}`,
      class: "Projects",
      order,
      title: project.name,
      href: project.canonicalPath,
      summary: project.thesis,
      interval: Object.freeze({
        start: project.publication.value,
        end: ongoing ? null : project.publication.value,
        ongoing,
      }),
      evidence: Object.freeze(items),
    });
  });
}

const DETAIL_BY_TIMELINE_ID = Object.freeze({
  "united-states-navy-officer-candidate": resumeDetails.officer,
  "ohiolink-luminary": resumeDetails.ohiolink,
  "miami-university-undergraduate-teaching-assistant": resumeDetails.teaching,
} as const);

// These record-scoped access points describe verified work conditions without
// adding them to the visible timeline. Keeping them here makes their editorial
// provenance explicit and prevents a generic word such as "shift" from
// classifying unrelated Resume records.
const TIMELINE_AUTHORED_SEARCH_METADATA: Readonly<Record<string, readonly AuthoredSearchMetadata[]>> = Object.freeze({
  "madison-correctional-facility-corrections-officer": Object.freeze([
    Object.freeze({ text: "Shift work", conceptIds: Object.freeze(["shift-work"]) }),
    Object.freeze({ text: "Night shift", conceptIds: Object.freeze(["night-shift"]) }),
    Object.freeze({ text: "Long shifts", conceptIds: Object.freeze(["long-shift"]) }),
    Object.freeze({ text: "12-plus-hour shifts", conceptIds: Object.freeze(["long-shift"]) }),
    Object.freeze({ text: "Government service", conceptIds: Object.freeze(["government", "government-service"]) }),
    Object.freeze({ text: "First responder", conceptIds: Object.freeze(["first-response"]) }),
    Object.freeze({ text: "Thin Blue Line", conceptIds: Object.freeze(["uniformed-public-safety"]) }),
    Object.freeze({ text: "Institutional security, policy enforcement, and incident documentation", conceptIds: Object.freeze(["institutional-security", "policy-enforcement", "incident-documentation"]) }),
    Object.freeze({ text: "De-escalation, crisis communication, situational awareness, and conflict management", conceptIds: Object.freeze(["de-escalation", "communications", "situational-awareness"]) }),
    Object.freeze({ text: "High-pressure operations and real-time decision-making", conceptIds: Object.freeze(["resilience", "resilient-systems", "high-consequence-systems"]) }),
    Object.freeze({ text: "Public service", conceptIds: Object.freeze(["public-service"]) }),
    Object.freeze({ text: "Officer, corrections", conceptIds: Object.freeze(["corrections"]) }),
  ]),
  "kings-college-london-grand-strategy": Object.freeze([
    Object.freeze({ text: "Decision-making under uncertainty", conceptIds: Object.freeze(["decision-under-uncertainty"]) }),
    Object.freeze({ text: "Deterrence and coercive statecraft", conceptIds: Object.freeze(["deterrence"]) }),
    Object.freeze({ text: "Scenario design, adjudication, and decision support", conceptIds: Object.freeze(["wargame-design"]) }),
    Object.freeze({ text: "National security AI", conceptIds: Object.freeze(["national-security-ai"]) }),
    Object.freeze({ text: "Coercive diplomacy and compellence", conceptIds: Object.freeze(["coercive-statecraft"]) }),
    Object.freeze({ text: "Information environment", conceptIds: Object.freeze(["information-environments"]) }),
    Object.freeze({ text: "Disinformation", conceptIds: Object.freeze(["disinformation"]) }),
    Object.freeze({ text: "Foreign influence", conceptIds: Object.freeze(["influence"]) }),
    Object.freeze({ text: "Escalation dynamics", conceptIds: Object.freeze(["escalation"]) }),
    Object.freeze({ text: "Cybersecurity", conceptIds: Object.freeze(["cybersecurity"]) }),
  ]),
  "united-states-navy-officer-candidate": Object.freeze([
    Object.freeze({ text: "Government service", conceptIds: Object.freeze(["government", "government-service"]) }),
    Object.freeze({ text: "Decision-making under uncertainty", conceptIds: Object.freeze(["decision-under-uncertainty"]) }),
    Object.freeze({ text: "Situational awareness", conceptIds: Object.freeze(["situational-awareness"]) }),
    Object.freeze({ text: "Resilient systems", conceptIds: Object.freeze(["resilient-systems"]) }),
    Object.freeze({ text: "High-consequence systems", conceptIds: Object.freeze(["high-consequence-systems"]) }),
    Object.freeze({ text: "National security", conceptIds: Object.freeze(["national-security"]) }),
    Object.freeze({ text: "Fog of war", conceptIds: Object.freeze(["fog-of-war"]) }),
    Object.freeze({ text: "Cybersecurity", conceptIds: Object.freeze(["cybersecurity"]) }),
    Object.freeze({ text: "Public service", conceptIds: Object.freeze(["public-service"]) }),
  ]),
  "madison-consolidated-schools-substitute-teacher": Object.freeze([
    Object.freeze({ text: "Public service", conceptIds: Object.freeze(["public-service"]) }),
    Object.freeze({ text: "De-escalation", conceptIds: Object.freeze(["de-escalation"]) }),
  ]),
  "uw-madison-ischool-continuing-education": Object.freeze([
    Object.freeze({ text: "Library technology", conceptIds: Object.freeze(["library-technology"]) }),
    Object.freeze({ text: "Digital preservation", conceptIds: Object.freeze(["digital-preservation"]) }),
    Object.freeze({ text: "Metadata", conceptIds: Object.freeze(["metadata"]) }),
    Object.freeze({ text: "Systems librarianship", conceptIds: Object.freeze(["systems-librarianship"]) }),
  ]),
  "germantown-public-library-intern": Object.freeze([
    Object.freeze({ text: "Library technology", conceptIds: Object.freeze(["library-technology"]) }),
    Object.freeze({ text: "Metadata", conceptIds: Object.freeze(["metadata"]) }),
    Object.freeze({ text: "Information retrieval", conceptIds: Object.freeze(["information-retrieval"]) }),
    Object.freeze({ text: "Systems librarianship", conceptIds: Object.freeze(["systems-librarianship"]) }),
    Object.freeze({ text: "Public service", conceptIds: Object.freeze(["public-service"]) }),
  ]),
  "dayton-area-school-consortium-substitute-teacher": Object.freeze([
    Object.freeze({ text: "Public service", conceptIds: Object.freeze(["public-service"]) }),
  ]),
  "ohiolink-luminary": Object.freeze([
    Object.freeze({ text: "Library technology", conceptIds: Object.freeze(["library-technology"]) }),
    Object.freeze({ text: "Web services librarianship", conceptIds: Object.freeze(["web-services-librarianship"]) }),
    Object.freeze({ text: "Information retrieval", conceptIds: Object.freeze(["information-retrieval"]) }),
    Object.freeze({ text: "Systems librarianship", conceptIds: Object.freeze(["systems-librarianship"]) }),
    Object.freeze({ text: "Continuity", conceptIds: Object.freeze(["continuity"]) }),
  ]),
  "university-of-tartu-student-researcher": Object.freeze([
    Object.freeze({ text: "Information governance", conceptIds: Object.freeze(["information-governance"]) }),
    Object.freeze({ text: "Resilient systems", conceptIds: Object.freeze(["resilient-systems"]) }),
    Object.freeze({ text: "High-consequence systems", conceptIds: Object.freeze(["high-consequence-systems"]) }),
    Object.freeze({ text: "Continuity", conceptIds: Object.freeze(["continuity"]) }),
    Object.freeze({ text: "Information environment", conceptIds: Object.freeze(["information-environments"]) }),
    Object.freeze({ text: "Cybersecurity", conceptIds: Object.freeze(["cybersecurity"]) }),
    Object.freeze({ text: "Systems thinking", conceptIds: Object.freeze(["systems-thinking"]) }),
  ]),
  "miami-university-undergraduate-teaching-assistant": Object.freeze([
    Object.freeze({ text: "Systems thinking", conceptIds: Object.freeze(["systems-thinking"]) }),
  ]),
  "kettering-health-network-volunteer": Object.freeze([
    Object.freeze({ text: "Public service", conceptIds: Object.freeze(["public-service"]) }),
  ]),
});

function timelineRecords() {
  return timeline.map((entry, order): SearchRecord => {
    const items: SearchEvidence[] = [];
    const source = "app/data.ts";
    pushText(items, entry.role, source, `timeline[${order}].role`);
    pushText(items, entry.engagementKind, source, `timeline[${order}].engagementKind`);
    pushText(items, entry.organization, source, `timeline[${order}].organization`);
    pushText(items, entry.period, source, `timeline[${order}].period`);
    entry.details.forEach((value, index) => pushText(items, value, source, `timeline[${order}].details[${index}]`));

    (TIMELINE_AUTHORED_SEARCH_METADATA[entry.id] ?? []).forEach((item, index) => {
      items.push(Object.freeze({
        text: item.text,
        sourcePath: "app/resume/resumeSearchOntology.ts",
        fieldPath: `TIMELINE_AUTHORED_SEARCH_METADATA["${entry.id}"][${index}]`,
        strength: item.strength ?? "curated",
        conceptIds: item.conceptIds,
      }));
    });
    appendAttachmentSearchMetadata(items, `resume-timeline-${entry.id}`);

    const detail = DETAIL_BY_TIMELINE_ID[entry.id as keyof typeof DETAIL_BY_TIMELINE_ID];
    if (detail) {
      pushText(items, detail.title, "app/resume/resumeDetails.js", `${detail.id}.title`);
      pushText(items, detail.subtitle, "app/resume/resumeDetails.js", `${detail.id}.subtitle`);
      pushText(items, detail.period, "app/resume/resumeDetails.js", `${detail.id}.period`);
      detail.details.forEach((value, index) => pushText(items, value, "app/resume/resumeDetails.js", `${detail.id}.details[${index}]`));
      if ("courses" in detail) detail.courses.forEach((value, index) => pushText(items, value, "app/resume/resumeDetails.js", `${detail.id}.courses[${index}]`));
    }

    return Object.freeze({
      id: `resume-timeline-${entry.id}`,
      class: entry.engagementKind === "education" ? "Education" : "Experiences",
      order,
      title: entry.role,
      href: detail?.canonicalPath ?? `/resume/#${entry.id}`,
      subtitle: entry.organization,
      summary: entry.period,
      interval: Object.freeze({ start: entry.start, end: entry.end, ongoing: entry.ongoing }),
      evidence: Object.freeze(items),
    });
  });
}

const SKILL_AUTHORED_SEARCH_METADATA: Readonly<Record<string, readonly AuthoredSearchMetadata[]>> = Object.freeze({
  "security-and-verification": Object.freeze([
    Object.freeze({ text: "Cybersecurity", conceptIds: Object.freeze(["cybersecurity"]) }),
  ]),
  "data-architecture-and-interoperability": Object.freeze([
    ...["ERD", "ER diagram", "Entity relationship", "Graph DB", "Mongo", "Structured query language", "Database querying"].map((text) => Object.freeze({ text, conceptIds: Object.freeze([]) })),
  ]),
  "technical-documentation-and-modeling": Object.freeze([
    Object.freeze({ text: "Software modeling", conceptIds: Object.freeze(["software-modeling"]) }),
    ...["DFD", "Data-flow diagram", "Network topology", "Network mapping"].map((text) => Object.freeze({ text, conceptIds: Object.freeze([]) })),
  ]),
  "business-analysis-and-operational-planning": Object.freeze([
    ...["Business process modeling", "Gantt", "Contract review", "License analysis", "Proposal writing", "Business proposal", "Project proposal"].map((text) => Object.freeze({ text, conceptIds: Object.freeze([]) })),
  ]),
  "software-development": Object.freeze([
    Object.freeze({ text: "Software engineering", conceptIds: Object.freeze(["software-engineering"]) }),
    ...["TS", "JS", "ECMAScript", "Py", "CPP", "CSharp", "C Sharp", "Shell", "Shell scripting"].map((text) => Object.freeze({ text, conceptIds: Object.freeze([]) })),
  ]),
  "frameworks-platforms-and-delivery": Object.freeze([
    Object.freeze({ text: "Version control", conceptIds: Object.freeze(["version-control"]) }),
    Object.freeze({ text: "Source control", conceptIds: Object.freeze(["version-control"]) }),
    ...["React.js", "ReactJS", "NextJS", "Next", "Node", "NodeJS", "Vite.js", "Node package manager"].map((text) => Object.freeze({ text, conceptIds: Object.freeze([]) })),
  ]),
  "fabrication-and-electronics": Object.freeze([
    ...["Laser cutter", "Additive manufacturing", "FDM printing", "Dye sublimation", "Electronics soldering", "Anti-static smock", "ESD wrist strap", "Ground monitor", "Electrostatic grounding"].map((text) => Object.freeze({ text, conceptIds: Object.freeze([]) })),
  ]),
});

function skillRecords(): SearchRecord[] {
  return skillStacks.map((stack, order) => {
    const items: SearchEvidence[] = [];
    pushText(items, stack.title, "app/data.ts", `skillStacks[${order}].title`);
    stack.items.forEach((value, index) => pushText(items, value, "app/data.ts", `skillStacks[${order}].items[${index}]`));
    stack.sections.forEach((section, sectionIndex) => {
      pushText(items, section.label, "app/data.ts", `skillStacks[${order}].sections[${sectionIndex}].label`);
      section.items.forEach((value, itemIndex) => pushText(items, value, "app/data.ts", `skillStacks[${order}].sections[${sectionIndex}].items[${itemIndex}]`));
    });
    (SKILL_AUTHORED_SEARCH_METADATA[stack.id] ?? []).forEach((item, index) => {
      items.push(Object.freeze({
        text: item.text,
        sourcePath: "app/resume/resumeSearchOntology.ts",
        fieldPath: `SKILL_AUTHORED_SEARCH_METADATA["${stack.id}"][${index}]`,
        strength: item.strength ?? "curated",
        conceptIds: item.conceptIds,
      }));
    });
    appendAttachmentSearchMetadata(items, `resume-skill-${stack.id}`);
    return Object.freeze({
      id: `resume-skill-${stack.id}`,
      class: "Skills",
      order,
      title: stack.title,
      href: `/resume/#skill-stack-${stack.id}`,
      summary: [...stack.items, ...stack.sections.flatMap(({ items: sectionItems }) => sectionItems)].slice(0, 3).join(" · "),
      evidence: Object.freeze(items),
    });
  });
}

function undergraduateRecord(order: number): SearchRecord {
  const detail = resumeDetails.undergrad;
  const subtitle = "B.A. Computer Science";
  const items: SearchEvidence[] = [];
  pushText(items, detail.title, "app/resume/resumeDetails.js", "undergrad.title");
  pushText(items, detail.period, "app/resume/resumeDetails.js", "undergrad.period");
  detail.details.forEach((value, index) => pushText(items, value, "app/resume/resumeDetails.js", `undergrad.details[${index}]`));
  pushText(items, resumeEducationOverview.graduated, "app/content/siteContent.js", "resumeEducationOverview.graduated");
  pushText(items, subtitle, "app/resume/ResumeExperience.tsx", "universityProgress.miami.subtitle");
  resumeEducationOverview.activities.forEach((activity, index) => {
    pushText(items, activity.label, "app/content/siteContent.js", `resumeEducationOverview.activities[${index}].label`);
    pushText(items, activity.start, "app/content/siteContent.js", `resumeEducationOverview.activities[${index}].start`);
  });
  items.push(Object.freeze({
    text: "Advanced databases",
    sourcePath: "app/resume/resumeSearchOntology.ts",
    fieldPath: "UNDERGRADUATE_AUTHORED_SEARCH_METADATA.advancedDatabases",
    strength: "curated",
    conceptIds: Object.freeze(["database-systems"]),
  }));
  appendAttachmentSearchMetadata(items, "resume-education-miami-university");
  items.push(Object.freeze({
    text: "Software engineering",
    sourcePath: "app/resume/resumeSearchOntology.ts",
    fieldPath: "UNDERGRADUATE_AUTHORED_SEARCH_METADATA.softwareEngineering",
    strength: "curated",
    conceptIds: Object.freeze(["software-engineering"]),
  }));
  return Object.freeze({
    id: "resume-education-miami-university",
    class: "Education",
    order,
    title: detail.title,
    href: detail.canonicalPath,
    subtitle,
    summary: detail.period,
    interval: Object.freeze({ start: "2019-08", end: "2023-05", ongoing: false }),
    evidence: Object.freeze(items),
  });
}

const timelineSearchRecords = timelineRecords();
const resumeSearchRecords = Object.freeze([
  ...projectRecords(),
  ...timelineSearchRecords,
  ...skillRecords(),
  undergraduateRecord(timelineSearchRecords.length),
]);

export const resumeSearchDefinition: SearchOntologyDefinition = Object.freeze({
  version: RESUME_SEARCH_ONTOLOGY_VERSION,
  classOrder: RESUME_SEARCH_CLASS_ORDER,
  concepts: resumeSearchConcepts,
  records: resumeSearchRecords,
  policy: Object.freeze({ minimumAtomScore: 0.54, maximumQueryGraphemes: 160, maximumQueryAtoms: 12 }),
});

export const resumeSearchIndex = compileSearchOntology(resumeSearchDefinition);

export const resumeSearchCoverage = Object.freeze({
  projects: resumeSearchRecords.filter(({ class: recordClass }) => recordClass === "Projects").length,
  experiences: resumeSearchRecords.filter(({ class: recordClass }) => recordClass === "Experiences").length,
  skills: resumeSearchRecords.filter(({ class: recordClass }) => recordClass === "Skills").length,
  education: resumeSearchRecords.filter(({ class: recordClass }) => recordClass === "Education").length,
  evidence: resumeSearchRecords.reduce((total, record) => total + record.evidence.length, 0),
});
