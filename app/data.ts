export type Paper = {
  title: string;
  languages: string[];
  publishers: string[];
  date: string;
  authors: string[];
  collections: string[];
};

export const skillStacks = [
  {
    title: "Documentation, Systems and Software",
    description: "",
    items: [
      "Network Diagram",
      "Unified Modeling Language",
      "Entity-Relationship Diagram",
      "Data Flow Diagram",
      "Flowchart",
      "Mockup",
      "Wireframe",
      "User Manual",
    ],
  },
  {
    title: "Programming",
    description: "Systems and Software Languages.\nEmphasis on SOLID principles.",
    items: [
      "C++",
      "C#",
      "Java",
      "Python",
      "TypeScript",
      "JavaScript",
      "HTML",
      "CSS",
      "Bash",
    ],
  },
  {
    title: "Frameworks, Runtimes, and Tooling",
    description: "",
    items: [
      ".NET",
      "React",
      "Next.js",
      "Node.js",
      "Vite",
      "Bootstrap",
      "Git",
      "npm",
    ],
  },
  {
    title: "Data",
    description: "Databases, Database Scripting, Mining, and Analysis Languages.",
    items: ["Neo4j", "MongoDB", "ArangoDB", "SQLite", "MySQL", "SQL", "R"],
  },
  {
    title: "Fabrication and Production",
    description: "",
    items: [
      "Laser Cutting",
      "Machined Drilling",
      "Multi-Needle Embroidery",
      "3D Printing",
      "Sublimation Printing",
      "Soldering with 63Sn-37Pb Alloy",
    ],
  },
  {
    title: "Communications, Business",
    description: "",
    items: ["Business Process Model and Notation", "Gantt Chart", "Contract Analysis", "Proposal"],
  },
  {
    title: "Electrostatic Discharge",
    description: "",
    items: ["Smock", "Wrist Strap", "Continuous Monitor", "Grounding"],
  },
];

export const timeline = [
  {
    role: "Continuing Education",
    organization: "King’s College London",
    period: "June 2026 — present",
    details: [],
  },
  {
    role: "Officer Candidate",
    organization: "United States Navy",
    period: "December 2025 — June 2026",
    details: [
      "Pressurized Operations and Collaboration",
      "Operational, Informational Constraints / #FogOfWar",
      "High-Friction Institutional Environment",
      "Emergency Preparedness",
    ],
    featured: true,
  },
  {
    role: "Substitute Teacher",
    organization: "Madison Consolidated Schools",
    period: "August 2025 — November 2025",
    details: ["Instruction", "In-School Suspension Coordinator"],
  },
  {
    role: "Student",
    organization: "American Public University System",
    period: "July 2025 — August 2025",
    details: ["Readings in Military Philosophy"],
  },
  {
    role: "Continuing Education",
    organization: "iSchool, University of Wisconsin-Madison",
    period: "June 2024 — present",
    details: [
      "Basics of Archives",
      "Introduction to Digitization Projects",
      "Supporting the Business Community at the Library",
      "Digital Asset Management",
    ],
  },
  {
    role: "Library Assistant Intern",
    organization: "Germantown Public Library",
    period: "March 2024 — September 2024",
    details: [
      "Process and Data Architecture",
      "Technical Documentation",
      "Business Documentation Qualitative Review",
      "Library Operations Support",
    ],
  },
  {
    role: "Substitute Teacher",
    organization: "Dayton Area School Consortium",
    period: "November 2023 — March 2025",
    details: ["Instruction", "Exam Proctoring"],
  },
  {
    role: "Student Researcher, Student",
    organization: "University of Tartu",
    period: "July 2022 — February 2025",
    details: [
      "Building Digital Governments",
      "Diffusion and Impact of Internet Voting",
      "Cybersecurity Governance in the Digital Age: Insights from Estonia and Beyond",
    ],
  },
  {
    role: "OhioLINK Luminary",
    organization: "OhioLINK",
    period: "August 2021 — May 2023",
    details: [
      "Web development and digital-accessibility remediation",
      "Productivity and contract analysis",
      "Metadata, makerspace instruction, and course design",
      "People’s Choice poster award for strategic project management at ALAO 2022",
    ],
    featured: true,
  },
  {
    role: "Undergraduate Teaching Assistant",
    organization: "Miami University College of Engineering and Computing",
    period: "May 2022 — May 2023",
    details: ["Training and assessment", "Coordination and mediation", "Collection development"],
  },
  {
    role: "Volunteer",
    organization: "Kettering Health Network",
    period: "March 2019 — August 2019",
    details: [],
  },
];

export const tools = [
  {
    name: "AppFlowy",
    url: "https://appflowy.io",
    category: "Workspace",
    summary: "Productivity manager.",
    traits: ["Open-source", "Full native, offline support", "No account required", "Data privacy", "Community-driven"],
  },
  {
    name: "Newsflow",
    url: "https://apps.microsoft.com/store/detail/newsflow/9NBLGGH58S5R",
    category: "Reading",
    summary: "RSS reader.",
    traits: ["Local, offline storage", "RSS, ATOM, RDF support", "Categorization", "Extended readability", "Customizable"],
  },
  {
    name: "Firefox",
    url: "https://www.mozilla.org/firefox/",
    category: "Browser",
    summary: "Internet browser.",
    traits: ["Open-source", "Enhanced tracking protection", "Developer tools", "Mozilla community involvement", "Customizable"],
  },
  {
    name: "VSCodium",
    url: "https://vscodium.com",
    category: "Development",
    summary: "VSCode fork.",
    traits: ["MIT license", "No telemetry, no tracking", "Simple distribution", "Community-driven", "Inherited extensibility"],
  },
  {
    name: "Tuta",
    url: "https://tuta.com",
    category: "Communication",
    summary: "Email host.",
    traits: ["Open-source codebase", "E2EE", "Zero-knowledge architecture", "No tracking, no logging", "Private business model; ad-free", "Cross-platform"],
  },
  {
    name: "SearXNG",
    url: "https://searx.space",
    category: "Search",
    summary: "Metasearch engine.",
    traits: ["Open-source", "Decentralized", "Non-tracking", "Proxying", "Self-hostable", "Priority customization", "Non-tailored results", "Integration-supportive"],
  },
];

export const papers: Paper[] = [
  { title: "Ethical Machines", languages: ["English"], publishers: ["Harvard Business Review Press"], date: "2022-09-20", authors: ["Reid Blackman"], collections: ["Business", "Technology"] },
  { title: "Getting to Maybe: How to Excel on Law School Exams", languages: ["English"], publishers: ["Carolina Academic Press"], date: "1999-05-26", authors: ["Richard Fischl", "Jeremy Paul"], collections: ["Business"] },
  { title: "Modern Grantmaking: A Guide for Funders Who Believe Better Is Possible", languages: ["English"], publishers: ["Modern Grantmaking"], date: "2022-05-22", authors: ["Gemma Bull", "Tom Steinberg"], collections: ["Business"] },
  { title: "Brief: Make a Bigger Impact by Saying Less", languages: ["English"], publishers: ["Wiley"], date: "2014-02-10", authors: ["Joseph McCormack"], collections: ["Lifestyle", "Business"] },
  { title: "Managing Data for Patron Privacy: Comprehensive Strategies for Libraries", languages: ["English"], publishers: ["ALA Editions"], date: "2022-08-08", authors: ["Kristin Briney", "Becky Yoose"], collections: ["Civil"] },
  { title: "Anonymity", languages: ["English"], publishers: ["ALA Neal-Schuman"], date: "2019-05-21", authors: ["Alison Macrina", "Talya Cooper"], collections: ["Civil"] },
  { title: "A Short Hike", languages: ["English", "Spanish — Latin America", "French", "Japanese", "Portuguese — Brazil"], publishers: ["Whippoorwill"], date: "2019-04-05", authors: ["Adam Robinson-Yu", "Adamgryu"], collections: ["Entertainment"] },
  { title: "Grit: The Power of Passion and Perseverance", languages: ["English"], publishers: ["Simon & Schuster"], date: "2016-05-03", authors: ["Angela Duckworth"], collections: ["Lifestyle", "Personal Resilience"] },
  { title: "The Life-Changing Magic of Tidying Up", languages: ["English"], publishers: ["Clarkson Potter/Ten Speed"], date: "2014-10-14", authors: ["Marie Kondo"], collections: ["Lifestyle"] },
  { title: "The Food of Sichuan", languages: ["English"], publishers: ["W. W. Norton & Company"], date: "2019-10-15", authors: ["Fuchsia Dunlop"], collections: ["Lifestyle"] },
  { title: "Never Eat Alone, Expanded and Updated: And Other Secrets to Success, One Relationship at a Time", languages: ["English"], publishers: ["Crown Publishing Group"], date: "2014-06-03", authors: ["Keith Ferrazzi", "Tahl Raz"], collections: ["Lifestyle"] },
  { title: "Poor Charlie’s Almanack: The Essential Wit and Wisdom of Charles T. Munger", languages: ["English"], publishers: ["Stripe Matter, Inc."], date: "2023-12-05", authors: ["Charles T. Munger"], collections: ["Lifestyle"] },
  { title: "The Ivy Portfolio: How to Invest Like the Top Endowments and Avoid Bear Markets", languages: ["English"], publishers: ["Wiley"], date: "2011-04-05", authors: ["Mebane T. Faber", "Eric W. Richardson"], collections: ["Lifestyle"] },
  { title: "The Wind Rises", languages: ["Japanese", "English"], publishers: ["Studio Ghibli"], date: "2013-07-20", authors: ["Hayao Miyazaki", "Toshio Suzuki"], collections: ["Entertainment", "Technology", "Societal Resilience"] },
  { title: "Meditations", languages: ["English"], publishers: ["N/A"], date: "180 C.E.", authors: ["Marcus Aurelius"], collections: ["Lifestyle", "Personal Resilience"] },
  { title: "Mastery", languages: ["English"], publishers: ["Penguin Books"], date: "2013-10-29", authors: ["Robert Greene"], collections: ["Lifestyle"] },
  { title: "On Liberty", languages: ["English"], publishers: ["John W. Parker and Son"], date: "1859", authors: ["John Stuart Mill"], collections: ["Civil"] },
  { title: "Individualism and the Economic Order", languages: ["English"], publishers: ["Routledge Press"], date: "1947", authors: ["Friedrich Hayek"], collections: ["Civil"] },
  { title: "Self-Reliance", languages: ["English"], publishers: ["James Munroe and Company"], date: "1841", authors: ["Ralph Waldo Emerson"], collections: ["Lifestyle"] },
  { title: "Orb: On the Movements of the Earth", languages: ["Japanese", "English", "Spanish — Latin America", "French", "German", "Italian", "Portuguese — Brazil", "Polish", "Arabic", "Simplified Chinese", "Traditional Chinese"], publishers: ["Studio Madhouse", "Netflix"], date: "2025-03-15", authors: ["Shingo Irie", "Kenichi Shimizu", "Tetsuya Nakatake"], collections: ["Entertainment", "Personal Resilience", "Societal Resilience"] },
  { title: "Terror in Resonance", languages: ["Japanese", "English", "Spanish — Latin America", "Spanish — Spain", "French", "German", "Italian", "Portuguese — Brazil", "Russian", "Arabic", "Czech", "Hungarian"], publishers: ["MAPPA", "Aniplex"], date: "2014-09-25", authors: ["Shinichirō Watanabe", "Koji Yamamoto", "Takamitsu Inoue"], collections: ["Entertainment", "Civil", "Societal Resilience"] },
  { title: "Psycho-Pass", languages: ["Japanese", "English", "Spanish — Latin America", "Spanish — Spain", "French", "German", "Italian", "Portuguese — Brazil", "Russian"], publishers: ["Production I.G.", "Fuji TV"], date: "2013-03-22", authors: ["Gen Urobuchi", "Katsuyuki Motohiro", "Naoyoshi Shiotani", "Makoto Fukami", "Tow Ubukata"], collections: ["Entertainment", "Technology", "Civil", "Societal Resilience"] },
  { title: "Where the Water Tastes Like Wine", languages: ["English", "French", "German", "Russian", "Simplified Chinese"], publishers: ["Dim Bulb Games", "Serenity Forge"], date: "2018-02-28", authors: ["Johnnemann Nordhagen", "Rami Ismael", "Cara Ellison", "Leigh Alexander", "Ryan Ike"], collections: ["Entertainment", "Societal Resilience"] },
  { title: "Kentucky Route Zero", languages: ["English", "French", "Italian", "German", "Spanish — Spain", "Japanese", "Korean", "Portuguese — Brazil", "Russian", "Simplified Chinese", "Traditional Chinese", "Turkish", "Czech", "Hungarian", "Polish", "Romanian"], publishers: ["Cardboard Computer", "Annapurna Interactive"], date: "2020-01-28", authors: ["Jake Elliott", "Tamas Kemenczy", "Hussein Neemat", "Ben Babbitt"], collections: ["Entertainment", "Societal Resilience"] },
  { title: "Becoming Bulletproof: Protect Yourself, Read People, Influence Situations, and Live Fearlessly", languages: ["English"], publishers: ["Atria Books"], date: "2020-04-21", authors: ["Evy Poumpouras"], collections: ["Lifestyle", "Personal Resilience"] },
  { title: "Frostpunk 2", languages: ["English", "French", "Italian", "German", "Spanish — Spain", "Japanese", "Korean", "Polish", "Portuguese — Brazil", "Russian", "Simplified Chinese", "Turkish", "Traditional Chinese", "Ukrainian"], publishers: ["11 bit studios"], date: "2024-09-20", authors: ["Alexandre Boiret", "Jakub Dzierżykraj-Stokalski", "Łukasz Juszczyk"], collections: ["Entertainment", "Civil", "Societal Resilience"] },
  { title: "The Apothecary Diaries", languages: ["Japanese", "English", "Spanish — Latin America", "French", "German", "Italian", "Portuguese — Brazil", "Arabic", "Hindi", "Indonesian", "Malay", "Thai", "Vietnamese"], publishers: ["Toho Animation Studio", "OLM", "Crunchyroll"], date: "2023-10-21", authors: ["Natsu Hyūga", "Touko Shino", "Norihiro Naganuma"], collections: ["Entertainment", "Civil", "Personal Resilience"] },
  { title: "Night in the Woods", languages: ["English", "French", "German", "Spanish — Spain", "Italian", "Portuguese — Brazil", "Russian", "Japanese", "Simplified Chinese"], publishers: ["Infinite Fall", "Finji"], date: "2017-02-21", authors: ["Scott Benson", "Bethany Hockenberry", "Alec Holowka"], collections: ["Entertainment", "Civil", "Personal Resilience", "Societal Resilience"] },
  { title: "Ascendance of a Bookworm", languages: ["Japanese", "English", "Spanish — Latin America", "French", "German", "Italian", "Portuguese — Brazil", "Russian", "Arabic"], publishers: ["Ajia-do Animation Works", "Crunchyroll"], date: "2019-10-03", authors: ["Miya Kazuki", "You Shiina", "Mitsuru Hongo"], collections: ["Entertainment", "Technology", "Business", "Personal Resilience", "Societal Resilience"] },
];
