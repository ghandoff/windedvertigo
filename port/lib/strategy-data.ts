/**
 * port/lib/strategy-data.ts
 *
 * Single source of truth for the /strategy page Phase 1 content.
 *
 * All content is hardcoded — extracted from .brain/memory/marketing/*.md
 * (Q2–Q3 2026 strategy). Phase 2 will migrate this to Supabase so the
 * CMO (Claude) can update it via the wv-claw agent without a redeploy.
 *
 * Conventions:
 *   - all strings lowercase per w.v brand voice
 *   - colours from the w.v palette (navy, redwood, sienna, champagne,
 *     teal, periwinkle, lavender)
 *   - icons reference lucide-react names; the consumer imports the
 *     specific component (we don't import here to keep this file pure
 *     data — components and JSX live in the tab modules).
 */

// ── brand palette ────────────────────────────────────────────────────────

export const WV_COLOURS = {
  navy: "#273248",
  redwood: "#b15043",
  sienna: "#cb7858",
  champagne: "#ffebd2",
  teal: "#43b187",
  periwinkle: "#5872cb",
  lavender: "#d5d2ff",
} as const;

// ── financials ───────────────────────────────────────────────────────────

// PRME 2026 contract: $145k total signed, $48,285 first invoice received
export const PRME_CONTRACT_TOTAL = 145_000;
export const PRME_RECEIVED = 48_285;

// Q2-Q3 revenue target (Sept 1 milestone)
export const REVENUE_TARGET = 500_000;

// Cash runway snapshot (May 2026)
export const CASH_ON_HAND = 34_000;
export const RUNWAY_MONTHS = 4;

// Pipeline math (revenue-marketing-alignment.md)
export const PIPELINE_MATH = {
  contractsNeeded: 10,
  averageContractValue: 50_000,
  contractsPerMonth: 2,
  proposalsPerMonth: 5,
  outreachTouchesPerWeek: 30,
  winRateTarget: 0.4,
} as const;

// ── revenue pipeline (concrete opportunities) ───────────────────────────

export interface PipelineRow {
  opportunity: string;
  stage: string;
  estValue: string;
  probability: number;
  timeline: string;
}

// NOTE: This array is the static FALLBACK only. The strategy pipeline tab
// first attempts to load live data from fetchActivePipelineOpportunities()
// (lib/marketing/rfp-analytics.ts). These rows render only if that fetch
// returns empty or fails — keeping a reasonable baseline when RFP Radar
// has no data yet.
export const REVENUE_PIPELINE: PipelineRow[] = [
  {
    opportunity: "PRME 2026",
    stage: "signed · invoicing",
    estValue: "$145,000",
    probability: 100,
    timeline: "$48k received · $97k outstanding",
  },
  {
    opportunity: "Nordic",
    stage: "finalizing contract",
    estValue: "$50k + retainer",
    probability: 80,
    timeline: "signing by june 2026",
  },
  {
    opportunity: "IDB El Salvador",
    stage: "in communication",
    estValue: "$50–100k",
    probability: 50,
    timeline: "decision by july 15",
  },
  {
    opportunity: "Ubongo",
    stage: "proposal submitted (may 22)",
    estValue: "$49,500",
    probability: 40,
    timeline: "decision by june",
  },
  {
    opportunity: "ICSP — Concern Worldwide",
    stage: "submitted (may 25)",
    estValue: "€28,800 (~$31,700)",
    probability: 45,
    timeline: "decision by july",
  },
  {
    opportunity: "Amna at 10",
    stage: "signed · scoping",
    estValue: "$25,000",
    probability: 100,
    timeline: "signed june 2026",
  },
  {
    opportunity: "UNICEF LTA",
    stage: "framework · early pursuit",
    estValue: "$20–40k (per task order)",
    probability: 25,
    timeline: "Q3 2026",
  },
];

// ── campaign architecture (6 strategic campaigns) ────────────────────────

export interface Campaign {
  /** stable id used by timeline + pulse-strip filtering */
  id: string;
  /** strategic campaign name (display) */
  name: string;
  /** keywords to fuzzy-match against existing CRM campaigns */
  matchKeywords: string[];
  objective: string;
  keyMetrics: string[];
  /** lower-cased team first names (matches TEAM[].name for filtering) */
  ownerNames: string[];
  /** human display string */
  ownerLabel: string;
  /** lucide-react icon name */
  iconName:
    | "Mail"
    | "Megaphone"
    | "Users"
    | "Calendar"
    | "FileText"
    | "RotateCcw";
}

export const CAMPAIGNS: Campaign[] = [
  {
    id: "ppcs-harbour-funnel",
    name: "ppcs → harbour funnel",
    matchKeywords: ["ppcs", "harbour funnel", "ppcs harbour"],
    objective:
      "use PPCS sessions to warm PRME community for harbour launch",
    keyMetrics: [
      "500+ unique visitors by may 28",
      "150+ educator sign-ups",
      "5 harbour champions",
    ],
    ownerNames: ["lamis", "garrett"],
    ownerLabel: "lamis + garrett",
    iconName: "Mail",
  },
  {
    id: "harbour-launch",
    name: "harbour launch",
    matchKeywords: ["harbour launch", "harbour", "launch"],
    objective:
      "announce 19-game platform to PRME community + educator market simultaneously",
    keyMetrics: [
      "5,000+ visitors on launch day",
      "800+ sign-ups week 1",
      "100+ social mentions",
    ],
    ownerNames: ["payton", "garrett", "jamie"],
    ownerLabel: "payton + garrett + jamie",
    iconName: "Megaphone",
  },
  {
    id: "warm-network-activation",
    name: "warm network activation",
    matchKeywords: [
      "warm network",
      "warm network activation",
      "network activation",
    ],
    objective:
      "reactivate 50+ dormant relationships, land 2–3 new contract conversations",
    keyMetrics: [
      "50% response rate (25+ replies)",
      "3+ qualified opportunities by june 1",
      "10+ calls booked",
    ],
    ownerNames: ["garrett", "lamis", "maria"],
    ownerLabel: "garrett + lamis + maria",
    iconName: "Users",
  },
  {
    id: "conference-injection",
    name: "conference injection",
    matchKeywords: ["conference", "pedal", "iste", "ascd"],
    objective:
      "establish thought leadership at PEDAL, ISTE + ASCD — secure speaking + sales conversations",
    keyMetrics: [
      "1 speaking slot per conference",
      "15–20 direct sales conversations",
      "3–5 pipeline opps per event",
    ],
    ownerNames: ["payton", "garrett", "lamis"],
    ownerLabel: "payton + garrett + lamis",
    iconName: "Calendar",
  },
  {
    id: "content-engine",
    name: "content engine launch",
    matchKeywords: ["content engine", "substack", "newsletter"],
    objective:
      "establish winded.vertigo as content authority across substack, instagram, linkedin",
    keyMetrics: [
      "2,000 substack subscribers by sept",
      "2,000 instagram followers",
      "3+ guest posts",
    ],
    ownerNames: ["jamie", "payton", "garrett"],
    ownerLabel: "jamie + payton + garrett",
    iconName: "FileText",
  },
  {
    id: "cold-outreach-refresh",
    name: "cold outreach refresh",
    matchKeywords: ["cold outreach", "outreach refresh", "cold"],
    objective:
      "follow up on non-responders + send fresh batch to new prospect list",
    keyMetrics: [
      "20% response rate on follow-ups",
      "5+ new opps from new batch",
      "2+ closed deals",
    ],
    ownerNames: ["garrett", "payton"],
    ownerLabel: "garrett + payton",
    iconName: "RotateCcw",
  },
];

// ── 90-day phases (3 cards) ─────────────────────────────────────────────

export interface Phase {
  month: string;
  label: string;
  /** tailwind classes for tinted background */
  color: string;
  milestones: string[];
}

export const PHASES: Phase[] = [
  {
    month: "may",
    label: "activation",
    color: "bg-blue-500/10 border-blue-200/50 text-blue-700",
    milestones: [
      "ppcs → harbour curriculum integration",
      "50-contact warm network outreach",
      "harbour launch (may 28)",
      "substack post #1 live",
      "conference submissions (PEDAL + ISTE)",
    ],
  },
  {
    month: "june",
    label: "amplification",
    color: "bg-amber-500/10 border-amber-200/50 text-amber-700",
    milestones: [
      "PEDAL conference (speaking + networking)",
      "nordic naturals contract signed",
      "harbour community slack activated",
      "cold outreach batch #2 sent (30+ targets)",
      "guest post pitches to 5 publications",
    ],
  },
  {
    month: "july–sept",
    label: "scaling",
    color: "bg-emerald-500/10 border-emerald-200/50 text-emerald-700",
    milestones: [
      "ISTE + ASCD (june 28–july 1, orlando)",
      "IDB El Salvador decision + negotiation",
      "post-conference pipeline conversion",
      "august: nurture + close focus",
      "sept 1: $500k contract milestone check",
    ],
  },
];

// ── team & accountability ────────────────────────────────────────────────

export interface TeamMember {
  /** lower-case first name, used as filter key */
  name: string;
  /** display name (proper-case for headers) */
  displayName: string;
  role: string;
  /** colour from w.v palette — used as accent on member chips */
  colour: keyof typeof WV_COLOURS;
  responsibilities: string[];
}

export const TEAM: TeamMember[] = [
  {
    name: "garrett",
    displayName: "Garrett",
    role: "director",
    colour: "redwood",
    responsibilities: [
      "warm network outreach (50 calls)",
      "conference submissions + speaker prep",
      "sales conversation ownership",
      "crm pipeline health + weekly reviews",
    ],
  },
  {
    name: "payton",
    displayName: "Payton",
    role: "brand experiences",
    colour: "periwinkle",
    responsibilities: [
      "instagram + bluesky (3–4x/week)",
      "conference logistics + booth design",
      "email campaign design + send",
      "video clips + reels production",
    ],
  },
  {
    name: "lamis",
    displayName: "Lamis",
    role: "relationships",
    colour: "teal",
    responsibilities: [
      "ppcs → harbour curriculum integration",
      "substack co-author (collective practice)",
      "conference panel participation",
      "warm network co-outreach (30 contacts)",
    ],
  },
  {
    name: "maria",
    displayName: "Maria",
    role: "practitioner voice",
    colour: "sienna",
    responsibilities: [
      "cultural appropriateness QA gate",
      "practitioner guide development",
      "warm network co-outreach (30 contacts)",
      "client testimonial + case study sourcing",
    ],
  },
  {
    name: "jamie",
    displayName: "Jamie",
    role: "content strategist",
    colour: "lavender",
    responsibilities: [
      "substack primary author (bi-weekly)",
      "guest post pitch + outreach",
      "newsletter copywriting",
      "conference network activation",
    ],
  },
];

// ── budget ───────────────────────────────────────────────────────────────

export interface BudgetRow {
  category: string;
  amount: string;
  detail: string;
}

export const BUDGET: BudgetRow[] = [
  {
    category: "paid social (test)",
    amount: "$1,000",
    detail: "instagram ads to educator audience, $200/mo × 5",
  },
  {
    category: "conference attendance",
    amount: "$8,000",
    detail: "ISTE booth ($3k) + flights + hotel for 2 ($5k)",
  },
  {
    category: "tools",
    amount: "$1,500",
    detail: "mailchimp + substack paid tiers, zoom pro (amortised)",
  },
  {
    category: "content production",
    amount: "$2,000",
    detail: "video editing, podcast/audio equipment",
  },
  {
    category: "press outreach",
    amount: "$500",
    detail: "press release distribution, media lists",
  },
  {
    category: "giveaways / lead magnets",
    amount: "$1,000",
    detail: "harbour premium access offers, substack bonuses",
  },
  {
    category: "contingency",
    amount: "$2,000",
    detail: "unplanned opportunities, freelance writer if needed",
  },
];

export const BUDGET_TOTAL = "$16,000";

// ── campaign timelines (drives the gantt) ───────────────────────────────

export interface CampaignTimeline {
  /** matches Campaign.id */
  id: string;
  /** display label (matches Campaign.name) */
  label: string;
  /** hex colour for the bar */
  colour: string;
  /** if true, the bar is light enough that text needs to be dark */
  darkText?: boolean;
  /** YYYY-MM-DD inclusive */
  start: string;
  /** YYYY-MM-DD inclusive */
  end: string;
  milestones: { date: string; label: string }[];
}

export const CAMPAIGN_TIMELINES: CampaignTimeline[] = [
  {
    id: "ppcs-harbour-funnel",
    label: "ppcs → harbour funnel",
    colour: WV_COLOURS.teal,
    start: "2026-05-01",
    end: "2026-06-15",
    milestones: [
      { date: "2026-05-28", label: "harbour launch" },
      { date: "2026-06-01", label: "first cohort" },
    ],
  },
  {
    id: "harbour-launch",
    label: "harbour launch",
    colour: WV_COLOURS.periwinkle,
    start: "2026-05-15",
    end: "2026-07-15",
    milestones: [
      { date: "2026-05-28", label: "soft launch" },
      { date: "2026-06-15", label: "public" },
      { date: "2026-07-01", label: "first retention data" },
    ],
  },
  {
    id: "conference-injection",
    label: "conference injection",
    colour: WV_COLOURS.sienna,
    start: "2026-05-01",
    end: "2026-09-30",
    milestones: [
      { date: "2026-06-15", label: "ISTE" },
      { date: "2026-07-15", label: "learning impact" },
      { date: "2026-08-15", label: "devlearn" },
    ],
  },
  {
    id: "warm-network-activation",
    label: "warm network activation",
    colour: WV_COLOURS.redwood,
    start: "2026-05-01",
    end: "2026-06-30",
    milestones: [
      { date: "2026-05-15", label: "first round" },
      { date: "2026-06-01", label: "follow-up round" },
    ],
  },
  {
    id: "content-engine",
    label: "content engine",
    colour: WV_COLOURS.lavender,
    start: "2026-05-01",
    end: "2026-09-30",
    milestones: [
      { date: "2026-05-15", label: "rhythm established" },
      { date: "2026-06-30", label: "first viral target" },
      { date: "2026-08-31", label: "1000 subscribers" },
    ],
  },
  {
    id: "cold-outreach-refresh",
    label: "cold outreach refresh",
    colour: WV_COLOURS.champagne,
    darkText: true,
    start: "2026-06-01",
    end: "2026-09-30",
    milestones: [
      { date: "2026-06-15", label: "new messaging live" },
      { date: "2026-07-31", label: "A/B results" },
      { date: "2026-08-31", label: "scale" },
    ],
  },
];

export const TIMELINE_RANGE = {
  start: "2026-05-01",
  end: "2026-09-30",
  /** total days inclusive — used for percentage math in the gantt */
  totalDays: 153,
} as const;

// ── channels (6 from channels.md) ───────────────────────────────────────

export interface Channel {
  id: string;
  name: string;
  iconName:
    | "Briefcase"
    | "Camera"
    | "AtSign"
    | "Mail"
    | "FileText"
    | "Calendar";
  purpose: string;
  cadence: string;
  tone: string;
  /** lower-case team names matching TEAM[].name */
  ownerNames: string[];
  ownerLabel: string;
  kpis: string[];
}

export const CHANNELS: Channel[] = [
  {
    id: "linkedin",
    name: "linkedin",
    iconName: "Briefcase",
    purpose:
      "establish garrett as a thought leader in learning design + position w.v as a trusted institutional partner.",
    cadence: "2–3 posts/week · daily engagement · 1–2 articles/month",
    tone: "authoritative but approachable · evidence-based · honest about trade-offs",
    ownerNames: ["payton", "garrett"],
    ownerLabel: "payton (execution) · garrett (voice)",
    kpis: [
      "monthly: 2k–5k impressions, 6–10% engagement, 20–30 net new followers",
      "quarterly: inbound leads via port crm + speaking invitations",
    ],
  },
  {
    id: "instagram",
    name: "instagram",
    iconName: "Camera",
    purpose:
      "build community with parents, teachers, creative educators · drive email capture · brand loyalty.",
    cadence: "4–5 posts/week + reels 2–3x · daily stories during campaigns",
    tone: "warm · permission-giving · visual · celebrates messiness",
    ownerNames: ["payton"],
    ownerLabel: "payton",
    kpis: [
      "weekly: 1k–3k reach, 8–12% engagement, saves",
      "monthly: 50–100 new followers + email signups via bio link",
    ],
  },
  {
    id: "bluesky",
    name: "bluesky",
    iconName: "AtSign",
    purpose:
      "participate in the emerging educator community · build early-adopter credibility.",
    cadence: "3–4 posts/week (shorter, conversational)",
    tone: "conversational · curious · less polished than linkedin",
    ownerNames: ["garrett", "payton"],
    ownerLabel: "garrett (voice) · payton (scheduling)",
    kpis: [
      "weekly: reply count, thread engagement",
      "monthly: 20–40 new followers, 10–15% engagement",
    ],
  },
  {
    id: "substack",
    name: "substack",
    iconName: "FileText",
    purpose:
      "long-form thought leadership + direct-to-reader email list · authority for ppcs + research labs.",
    cadence: "2 essays/month (1500–2500 words) · consistent day/time",
    tone: "authoritative · narrative · substantive · honest about limitations",
    ownerNames: ["garrett", "jamie", "payton"],
    ownerLabel: "garrett (writing) · payton (editorial)",
    kpis: [
      "monthly: 200–400 net new subs, 45–55% open rate, 15–20% ctr",
      "quarterly: conversion to whirlpool + crm leads",
    ],
  },
  {
    id: "email",
    name: "email (resend + port crm)",
    iconName: "Mail",
    purpose:
      "nurture educators, designers, institutional contacts · curated resources · convert to whirlpool + workshops.",
    cadence: "weekly digest thursdays · campaigns on launch/event windows",
    tone: "warm · authentic · practical · clear ctas",
    ownerNames: ["payton", "jamie"],
    ownerLabel: "payton (execution) · jamie (content)",
    kpis: [
      "weekly: 35–45% open, 8–12% ctr, <0.3% unsubscribe",
      "monthly: subscriber growth + segmentation health",
    ],
  },
  {
    id: "conferences",
    name: "conferences & speaking",
    iconName: "Calendar",
    purpose:
      "establish w.v expertise at key venues · build relationships with practitioners + buyers · generate leads.",
    cadence: "4–6 speaking engagements/year · quarterly cfp scouting",
    tone: "expert but accessible · evidence-based · interactive",
    ownerNames: ["garrett", "payton", "jamie"],
    ownerLabel: "garrett (strategy) · payton (logistics) · jamie (decks)",
    kpis: [
      "per session: attendance, 4.5+/5 feedback score, q&a engagement",
      "quarterly: leads generated · partnership enquiries",
    ],
  },
];

// ── audience segments (6 from audience-segments.md) ─────────────────────

export interface AudienceSegment {
  id: string;
  name: string;
  priority: "high" | "medium";
  whoTheyAre: string;
  painPoints: string[];
  whereTheyEngage: string[];
  productsThatMap: { name: string; href?: string }[];
}

export const AUDIENCE_SEGMENTS: AudienceSegment[] = [
  {
    id: "k12-educators",
    name: "k–12 educators",
    priority: "high",
    whoTheyAre:
      "classroom teachers, curriculum leads, school librarians, art/design specialists in public + independent schools. usually 10–25 years in role. seeking practical, implementable tools for student-centred learning.",
    painPoints: [
      "curriculum crowding: too many mandates, not enough time",
      "limited PD budget + assessment pressure vs. teaching for depth",
      "imposter syndrome around 'modern' methods + tech adoption fatigue",
    ],
    whereTheyEngage: [
      "pinterest",
      "teachers pay teachers",
      "bluesky edu",
      "ASCD / NSTA",
      "regional PLCs",
    ],
    productsThatMap: [
      { name: "creaseworks" },
      { name: "whirlpool" },
      { name: "depth-chart" },
      { name: "play & fair labs" },
    ],
  },
  {
    id: "higher-ed-faculty",
    name: "higher ed faculty",
    priority: "high",
    whoTheyAre:
      "tenured + early-career faculty in education, business, design, international development, psychology. teaching 100–300 students/semester. under pressure to innovate pedagogy while maintaining research credibility.",
    painPoints: [
      "tension between content coverage + depth",
      "accreditation requirements (AACSB, PRME) without clear roadmap",
      "scepticism about edtech that oversimplifies learning",
    ],
    whereTheyEngage: [
      "AERA",
      "AASHE",
      "the chronicle",
      "linkedin",
      "PRME networks",
    ],
    productsThatMap: [
      { name: "PPCS" },
      { name: "whirlpool" },
      { name: "depth-chart" },
    ],
  },
  {
    id: "learning-designers",
    name: "learning designers",
    priority: "high",
    whoTheyAre:
      "corporate L&D, edtech, freelance instructional designers. 3–15 years in field. building courses + programmes across sectors. pragmatic but want evidence behind their choices.",
    painPoints: [
      "pressure to deliver fast (ADDIE → rapid prototyping)",
      "isolation — freelancers especially lack peer networks",
      "tools that don't integrate; data silos",
    ],
    whereTheyEngage: [
      "linkedin",
      "substack",
      "eLearning guild",
      "IDOL",
      "slack communities",
    ],
    productsThatMap: [
      { name: "creaseworks" },
      { name: "depth-chart" },
      { name: "PPCS" },
      { name: "harbour" },
    ],
  },
  {
    id: "institutional-buyers",
    name: "institutional buyers (UN · foundations · gov)",
    priority: "high",
    whoTheyAre:
      "programme officers at UN agencies (UNICEF, Global Compact), foundations, ministries of education, development banks (IDB). decision by committee; 6–18 month procurement cycles.",
    painPoints: [
      "impact measurement + attribution",
      "scale vs. depth in marginalised populations",
      "vendor fatigue + budget cycle approval timelines",
    ],
    whereTheyEngage: [
      "RFPs + vendor platforms",
      "sector reports",
      "convenings + working groups",
      "peer referrals",
    ],
    productsThatMap: [
      { name: "PPCS" },
      { name: "harbour + depth-chart" },
      { name: "play & fair labs" },
    ],
  },
  {
    id: "parents-families",
    name: "parents & families",
    priority: "medium",
    whoTheyAre:
      "parents 25–55, across income + geography. some homeschooling, most in traditional schools. interested in SEL, play-based learning, digital wellbeing. often anxious about 'what's normal?'",
    painPoints: [
      "overwhelm: conflicting advice + instagram mom culture",
      "guilt about screen time + structured vs. unstructured time",
      "limited support networks; pressure to optimise learning",
    ],
    whereTheyEngage: [
      "instagram",
      "tiktok",
      "podcasts",
      "facebook groups",
      "school parent workshops",
    ],
    productsThatMap: [
      { name: "creaseworks" },
      { name: "eddyy" },
      { name: "play & fair labs" },
    ],
  },
  {
    id: "edtech-pms",
    name: "edtech PMs + founders",
    priority: "medium",
    whoTheyAre:
      "edtech founders, product managers, UX researchers. building tools + platforms. seeking partnership, distribution, thought-leadership alignment.",
    painPoints: [
      "competing on features, not pedagogy",
      "proof of learning impact + ROI",
      "user acquisition costs + churn",
    ],
    whereTheyEngage: [
      "linkedin",
      "edsurge",
      "ISTE",
      "SXSW edu",
      "VC + demo day networks",
    ],
    productsThatMap: [
      { name: "harbour" },
      { name: "PPCS" },
      { name: "research outputs" },
    ],
  },
];

// ── pipeline funnel (5 stages from revenue-marketing-alignment.md) ──────

export interface FunnelStage {
  id: string;
  name: string;
  definition: string;
  marketingRole: string;
  duration: string;
  /** target throughput indicator */
  target: string;
  /** width as % — used by the funnel viz */
  widthPct: number;
  colour: keyof typeof WV_COLOURS;
}

/**
 * Per-stage tracking values (Prompt 1 — pipeline progress bars).
 * `current` is nullable until Garrett or Payton fills in real numbers.
 * When null, the UI shows an "awaiting first input" pill.
 */
export interface StageProgress {
  /** matches FunnelStage.id */
  id: string;
  /** weekly or monthly count of the metric being tracked */
  current: number | null;
  /** target count over the same period */
  target: number;
  /** display unit ("touches this week", "pieces this month", etc.) */
  unitLabel: string;
}

export const PIPELINE_PROGRESS: StageProgress[] = [
  {
    id: "awareness",
    current: null,
    target: 30,
    unitLabel: "outreach touches this week",
  },
  {
    id: "engagement",
    current: null,
    target: 4,
    unitLabel: "content pieces this month",
  },
  {
    id: "conversation",
    current: null,
    target: 8,
    unitLabel: "meaningful conversations this month",
  },
  {
    id: "proposal",
    current: 3,
    target: 5,
    unitLabel: "proposals in flight (IDB, Amna, ISTE)",
  },
  {
    id: "contract",
    current: 2,
    target: 3,
    unitLabel: "active contracts (PRME 2026, PRME pedagogy)",
  },
];

/**
 * Revenue progress tracker (Prompt 1 — top of pipeline tab).
 * Numbers are hardcoded for Phase 1; Phase 2 pulls from Supabase.
 *
 * Status confidence ladder (used by deriveRevenueTiers + the strategy-hero bar):
 *   "signed"        — contract executed, payment may or may not have landed
 *   "in-progress"   — verbal commit / SOW pending (Nordic Budget A)
 *   "negotiation"   — actively negotiating, terms still moving (Nordic Budget B)
 *   "documentation" — proposal submitted, awaiting decision (IDB)
 *
 * As of May 2026: PRME signed at $145k. Nordic split across two budgets
 * (Budget A = $50k platform build; Budget B = $54k retainer Apr–Dec).
 * IDB El Salvador proposal out at $75k. Add new contracts here as they
 * land in the pipeline.
 */
export const REVENUE_PROGRESS = {
  /** signed/contracted dollar value year-to-date */
  signedYtd: 145_000,
  /** annual target */
  target: 500_000,
  /** breakdown for the tooltip / detail view */
  breakdown: [
    { client: "PRME 2026", amount: 145_000, status: "signed" as const, receivedAmount: 48_285 },
    {
      client: "Nordic — Budget A",
      detail: "PCS + SQR-RCT platform build",
      amount: 50_000,
      status: "in-progress" as const,
    },
    {
      client: "Nordic — Budget B",
      detail: "retainer · $6k/mo · apr–dec 2026",
      amount: 54_000,
      status: "negotiation" as const,
    },
    {
      client: "IDB El Salvador",
      amount: 75_000,
      status: "documentation" as const,
    },
    {
      client: "Ubongo",
      detail: "10-year impact & learnings report",
      amount: 49_500,
      status: "documentation" as const,
    },
    {
      client: "ICSP — Concern Worldwide",
      detail: "GCE evaluation · ireland · submitted 25 may",
      amount: 31_700,
      status: "documentation" as const,
    },
    {
      client: "Amna",
      detail: "refugee education network · at 10",
      amount: 25_000,
      status: "signed" as const,
    },
    {
      client: "Additional pipeline",
      detail: "unallocated · awaiting composition",
      amount: 52_300,
      status: "documentation" as const,
    },
  ],
} as const;

export const PIPELINE_FUNNEL: FunnelStage[] = [
  {
    id: "awareness",
    name: "awareness",
    definition: "prospect knows w.v exists",
    marketingRole: "content, social, conference presence, PR",
    duration: "ongoing",
    target: "10k+ touches/month",
    widthPct: 100,
    colour: "lavender",
  },
  {
    id: "engagement",
    name: "engagement",
    definition: "prospect interacts with content or product",
    marketingRole: "harbour signups · substack subs · whirlpool guests",
    duration: "1–4 weeks",
    target: "200+ signals/month",
    widthPct: 80,
    colour: "periwinkle",
  },
  {
    id: "conversation",
    name: "conversation",
    definition: "direct dialogue initiated",
    marketingRole: "warm intro · cold reply · inbound · event follow-up",
    duration: "1–2 weeks",
    target: "8 meaningful/month",
    widthPct: 55,
    colour: "teal",
  },
  {
    id: "proposal",
    name: "proposal",
    definition: "w.v submits a formal proposal or SOW",
    marketingRole: "proposal generator · case studies · references",
    duration: "1–4 weeks",
    target: "5/month",
    widthPct: 32,
    colour: "sienna",
  },
  {
    id: "contract",
    name: "contract",
    definition: "signed agreement + PO",
    marketingRole: "— (finance/ops)",
    duration: "1–2 weeks",
    target: "2/month",
    widthPct: 16,
    colour: "redwood",
  },
];

// ── weekly KPIs (drives the predictive-metrics table) ───────────────────

export interface WeeklyKpi {
  metric: string;
  target: string;
  why: string;
  type: "leading" | "lagging";
}

export const WEEKLY_KPIS: WeeklyKpi[] = [
  // leading
  {
    metric: "substack subscribers",
    target: "+50/month",
    why: "email list = future pipeline",
    type: "leading",
  },
  {
    metric: "linkedin connections (decision-makers)",
    target: "+20/month",
    why: "B2B network growth",
    type: "leading",
  },
  {
    metric: "harbour signups",
    target: "+100/month (post-launch)",
    why: "product-led awareness",
    type: "leading",
  },
  {
    metric: "inbound enquiries",
    target: "3–5/month",
    why: "conversion-ready leads",
    type: "leading",
  },
  {
    metric: "outreach sent (cold + warm)",
    target: "20/week",
    why: "top-of-funnel volume",
    type: "leading",
  },
  {
    metric: "outreach reply rate",
    target: ">15% cold · >40% warm",
    why: "message quality signal",
    type: "leading",
  },
  {
    metric: "content pieces published",
    target: "4/month (1 substack + 3 social)",
    why: "consistency signal",
    type: "leading",
  },
  // lagging
  {
    metric: "proposals sent",
    target: "4–6/month",
    why: "pipeline velocity",
    type: "lagging",
  },
  {
    metric: "proposal win rate",
    target: ">40%",
    why: "pricing + fit quality",
    type: "lagging",
  },
  {
    metric: "contracts signed",
    target: "2–3/month",
    why: "revenue",
    type: "lagging",
  },
  {
    metric: "total pipeline value",
    target: ">$300k at any time",
    why: "runway confidence",
    type: "lagging",
  },
  {
    metric: "average contract value",
    target: "$40–60k",
    why: "sizing signal",
    type: "lagging",
  },
];

// ── distribution matrix (12 projects, derived from team responsibilities) ─

export interface DistributionProject {
  id: string;
  name: string;
  /** primary owner — lower-case first name (matches TEAM[].name) */
  owner: string;
  /** supporting team members (lower-case names) */
  support: string[];
  nextAction: string;
  deadline: string;
  /** optional campaign id this project rolls up to */
  campaignId?: string;
  /** Supabase notion_page_id of the corresponding PM project, if one exists.
   *  When set, the distribution row name becomes a link to /projects/[id].
   *  Also used by the project detail page to surface strategic context. */
  linkedProjectId?: string;
}

export const DISTRIBUTION: DistributionProject[] = [
  {
    id: "warm-outreach-50",
    name: "warm network outreach (50 calls)",
    owner: "garrett",
    support: ["lamis", "maria"],
    nextAction: "send first 25 emails this week",
    deadline: "may 31",
    campaignId: "warm-network-activation",
  },
  {
    id: "harbour-launch-week",
    name: "harbour launch (may 28)",
    owner: "payton",
    support: ["garrett", "jamie"],
    nextAction: "finalize launch-day social schedule + email",
    deadline: "may 28",
    campaignId: "harbour-launch",
  },
  {
    id: "ppcs-curriculum-integration",
    name: "ppcs → harbour curriculum integration",
    owner: "lamis",
    support: ["garrett"],
    nextAction: "draft integration map for first cohort",
    deadline: "may 25",
    campaignId: "ppcs-harbour-funnel",
  },
  {
    id: "conference-submissions",
    name: "conference submissions (PEDAL + ISTE + ASCD)",
    owner: "garrett",
    support: ["payton", "jamie"],
    nextAction: "submit PEDAL abstract + ISTE rapid-fire",
    deadline: "may 12",
    campaignId: "conference-injection",
  },
  {
    id: "iste-booth-design",
    name: "ISTE booth design + logistics",
    owner: "payton",
    support: ["jamie"],
    nextAction: "finalize booth quote ($3k) + travel",
    deadline: "june 14",
    campaignId: "conference-injection",
  },
  {
    id: "substack-author-cadence",
    name: "substack author cadence (bi-weekly)",
    owner: "jamie",
    support: ["lamis", "garrett"],
    nextAction: "publish post #1 + queue post #2",
    deadline: "may 15 (post #1)",
    campaignId: "content-engine",
  },
  {
    id: "instagram-reels",
    name: "instagram + reels production",
    owner: "payton",
    support: [],
    nextAction: "produce 3 reels for harbour launch teaser",
    deadline: "may 21",
    campaignId: "content-engine",
  },
  {
    id: "cold-batch-2",
    name: "cold outreach batch #2 (30 targets)",
    owner: "garrett",
    support: ["payton"],
    nextAction: "rebuild target list + draft new opener",
    deadline: "june 15",
    campaignId: "cold-outreach-refresh",
  },
  {
    id: "guest-post-pitches",
    name: "guest post pitches (5 publications)",
    owner: "jamie",
    support: ["payton"],
    nextAction: "draft pitch templates + identify outlets",
    deadline: "june 30",
    campaignId: "content-engine",
  },
  {
    id: "case-study-sourcing",
    name: "client testimonials + case studies",
    owner: "maria",
    support: ["garrett"],
    nextAction: "outreach to 3 PPCS leads + IDB Salvador team",
    deadline: "june 30",
  },
  {
    id: "weekly-cmo-review",
    name: "weekly CMO review (wed)",
    owner: "garrett",
    support: ["payton"],
    nextAction: "automated review runs wed 9am · review output",
    deadline: "weekly",
  },
  {
    id: "cultural-qa-gate",
    name: "cultural appropriateness QA gate (all deliverables)",
    owner: "maria",
    support: ["garrett"],
    nextAction: "review harbour launch copy + landing page",
    deadline: "rolling",
  },
];

// ── weekly cadence (meetings + reviews) ─────────────────────────────────

export interface CadenceRow {
  when: string;
  what: string;
}

export const WEEKLY_CADENCE: CadenceRow[] = [
  {
    when: "mon 10am pt",
    what: "marketing standup — garrett + payton + lamis",
  },
  {
    when: "tue 6pm utc",
    what: "garrett + maria — outreach updates + ops",
  },
  {
    when: "weekly async",
    what: "payton + garrett slack — social + content calendar",
  },
  {
    when: "qbr may 28",
    what: "harbour launch metrics + pipeline review",
  },
  {
    when: "qbr june 30",
    what: "PEDAL + ISTE readiness + pipeline pace",
  },
  {
    when: "qbr july 31",
    what: "post-ISTE results + $500k forecast",
  },
];

// ── shared helpers ──────────────────────────────────────────────────────

export function probabilityClass(p: number): string {
  if (p >= 70) return "text-emerald-700 bg-emerald-50 border-emerald-200/50";
  if (p >= 40) return "text-amber-700 bg-amber-50 border-amber-200/50";
  return "text-red-700 bg-red-50 border-red-200/50";
}

export function pct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

// ── revenue tier derivation ─────────────────────────────────────────────
//
// The strategy hero shows revenue progress as a 5-tier confidence ladder:
//   paid        (cash in bank)
//   signed      (contract executed, payment pending)
//   advanced    (verbal commit / SOW pending — almost-guaranteed)
//   negotiation (actively negotiating, terms still moving)
//   open        (proposal submitted, awaiting decision)
//
// `breakdown[].status` is the existing string taxonomy. Mapping:
//   "signed"        → splits across (paid, signedUnpaid) using PRME_RECEIVED
//                     for any contract whose total equals PRME_CONTRACT_TOTAL.
//                     Future contracts can override by carrying their own
//                     `received` field once the type is widened in Phase 2.
//   "in-progress"   → advanced tier
//   "negotiation"   → negotiation tier
//   "documentation" → open tier
//
// Centralised here so a future Supabase migration only touches this helper.

/** Default win-probability by confidence tier. Weights the pipeline (non-signed)
 * portion of the revenue bar so it reflects *expected* value rather than full
 * potential — a submitted proposal is not worth its sticker price. Signed/paid
 * are contractually locked (1.0). Tunable by Mo as the book of business matures. */
export const TIER_PROBABILITY = {
  paid: 1,
  signed: 1,
  advanced: 0.8, // verbal commit / SOW pending
  negotiation: 0.6, // terms moving, both sides engaged
  open: 0.3, // proposal submitted, awaiting a decision
} as const;

export interface RevenueTiers {
  paid: number;
  signedUnpaid: number;
  advanced: number;
  negotiation: number;
  open: number;
  /** signed = paid + signedUnpaid (matches Tile B's "signedYtd" today) */
  signed: number;
  /** sum of every breakdown row, regardless of tier */
  totalBooked: number;
  /** probability-weighted expected value: signed at full + pipeline × TIER_PROBABILITY */
  expected: number;
  /** target − totalBooked, floored at 0 */
  gap: number;
  /** the configured target value (mirrored for convenience) */
  target: number;
}

/** Structural shape of the revenue-progress source. Loosened from
 * `typeof REVENUE_PROGRESS` so callers can pass either the hardcoded const
 * (today) or a Supabase-loaded record (Phase 2) without TS literal-narrowing
 * the per-row branches into `never`. */
export interface RevenueProgressInput {
  target: number;
  breakdown: ReadonlyArray<{
    client: string;
    amount: number;
    status: string;
    /** Cash already received for this contract. Non-zero only for signed deals
     *  where partial payment has landed. Drives the paid/signedUnpaid split in
     *  the hero bar. When absent the row is treated as fully unpaid (no split). */
    receivedAmount?: number;
    /** Optional scope blurb shown on the chip — disambiguates two budgets under
     *  the same client (e.g. Nordic Budget A vs B). */
    detail?: string;
  }>;
}

export function deriveRevenueTiers(
  progress: RevenueProgressInput,
): RevenueTiers {
  let paid = 0;
  let signedUnpaid = 0;
  let advanced = 0;
  let negotiation = 0;
  let open = 0;

  for (const row of progress.breakdown) {
    const amount = row.amount;
    if (row.status === "signed") {
      // Use receivedAmount when present to split paid vs signedUnpaid.
      // Falls back to 0 (entire amount is signedUnpaid) for contracts where
      // no payment has landed yet.
      const recv = row.receivedAmount ?? 0;
      paid += recv;
      signedUnpaid += amount - recv;
    } else if (row.status === "in-progress") {
      advanced += amount;
    } else if (row.status === "negotiation") {
      negotiation += amount;
    } else if (row.status === "documentation") {
      open += amount;
    }
    // No `else` — any future status falls out of the tier sums and shows
    // up in the gap. Add a new branch when a new status appears.
  }

  const signed = paid + signedUnpaid;
  const totalBooked = signed + advanced + negotiation + open;
  const expected =
    signed +
    advanced * TIER_PROBABILITY.advanced +
    negotiation * TIER_PROBABILITY.negotiation +
    open * TIER_PROBABILITY.open;
  const gap = Math.max(0, progress.target - totalBooked);

  return {
    paid,
    signedUnpaid,
    advanced,
    negotiation,
    open,
    signed,
    totalBooked,
    expected,
    gap,
    target: progress.target,
  };
}

// ── deal update entry points (no UI yet — document the pattern) ────────────
//
// Three ways a deal record gets updated in Supabase:
//
// 1. Verbal / conversation stage
//    → direct entry via the Supabase dashboard, or a future admin route in port.
//    → set revenue_tier, origin_type, estimated value.
//
// 2. Contract signed
//    → update stage → 'won', set contracted_amount, set revenue_tier = 'signed'.
//    → insert a deal_events row: event_type 'contract_signed',
//      new_value { contracted_amount, effective_date }.
//
// 3. Payment received
//    → update received_amount to match the QBO invoice paid amount.
//    → insert a deal_events row: event_type 'payment_received',
//      new_value { received_amount, payment_date, invoice_ref }.
//
// The deal_events table gives a full audit trail for the CMO dashboard.
// Future: wire a PATCH /api/deals/[id]/events route that records these
// programmatically as the CMO updates status via the strategy page.

// ── live revenue summary (Task 4) ──────────────────────────────────────────

/** Aggregated revenue summary from Supabase — origin-type and tier breakdown.
 * Distinct from RevenueProgressInput (which drives the hero bar) — this is
 * the CMO-level summary: how much is contracted vs received, and where did
 * the pipeline come from. */
export interface RevenueProgress {
  /** Sum of contracted_amount across all revenue-pipeline deals. */
  totalContracted: number;
  /** Sum of received_amount (cash already in) across all revenue-pipeline deals. */
  totalReceived: number;
  /** Contracted amount broken down by sourcing channel. */
  byOriginType: {
    rfp: number;
    warm_outreach: number;
    legacy: number;
    product: number;
  };
  /** Contracted amount broken down by revenue tier (signed / advanced / negotiation / open). */
  byRevenueTier: Record<string, number>;
}

/**
 * Fetch live revenue aggregates from Supabase.
 *
 * Queries all revenue-pipeline deals (revenue_tier IS NOT NULL, stage != 'lost')
 * and returns the totals and breakdowns the CMO needs.
 *
 * Falls back gracefully — the caller should wrap with `.catch(() => fallback)`.
 */
export async function getRevenueProgress(): Promise<RevenueProgress> {
  // Dynamic import keeps this module importable in non-server contexts at
  // build time (the Proxy throws only on first method call, not on import).
  const { supabase } = await import("@/lib/supabase/client");

  const { data, error } = await supabase
    .from("deals")
    .select("contracted_amount, received_amount, origin_type, revenue_tier")
    .not("revenue_tier", "is", null)
    .neq("stage", "lost");

  if (error) throw new Error(`[strategy-data] getRevenueProgress: ${error.message}`);

  const rows = (data ?? []) as Array<{
    contracted_amount: number | null;
    received_amount: number | null;
    origin_type: string | null;
    revenue_tier: string | null;
  }>;

  const byOriginType = { rfp: 0, warm_outreach: 0, legacy: 0, product: 0 };
  const byRevenueTier: Record<string, number> = {};
  let totalContracted = 0;
  let totalReceived = 0;

  for (const row of rows) {
    const contracted = row.contracted_amount ?? 0;
    const received = row.received_amount ?? 0;
    if (row.contracted_amount !== null) totalContracted += contracted;
    if (received > 0) totalReceived += received;

    if (row.origin_type && row.origin_type in byOriginType) {
      byOriginType[row.origin_type as keyof typeof byOriginType] += contracted;
    }

    const tier = row.revenue_tier ?? "unset";
    byRevenueTier[tier] = (byRevenueTier[tier] ?? 0) + contracted;
  }

  return { totalContracted, totalReceived, byOriginType, byRevenueTier };
}

/**
 * Match a strategic campaign against existing CRM campaigns.
 * Returns an array of CRM campaigns whose name fuzzy-matches any keyword.
 */
export function matchCrmCampaigns(
  keywords: string[],
  crmCampaigns: { id: string; name: string; status: string }[],
): { id: string; name: string; status: string }[] {
  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  return crmCampaigns.filter((c) => {
    const lowerName = c.name.toLowerCase();
    return lowerKeywords.some((k) => lowerName.includes(k));
  });
}
