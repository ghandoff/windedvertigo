// do-v2 sandbox — canonical content data (the copy lock).
// source of truth: docs/do-v2/profiles-problems-proof.md (§1.3b map).
// hooks are verbatim from the map (lowercased); offers are drafted plain-words
// summaries awaiting the team voice pass. wink lines are unfilled slots by
// design — sector in-jokes are team copy, not generated copy.
//
// familyWeights + axis affinities are PROVISIONAL, derived from the rubric's
// primary/secondary family mappings (P1: 1,7,6 / 2,4 · P2: 2,1 · P3: 3,6,5 ·
// P4: 4,7,5 · P5: 5). the fader axes themselves are the design plan's open
// question (a) — labels live in `axes` below so renaming is a one-line edit.

export const profiles = [
  {
    id: "p1",
    name: "the accountable programme leader",
    firstPersonLine: "i owe a funder an answer",
    familyWeights: { evidence: 3, storytelling: 3, inclusion: 3, platforms: 2, gatherings: 2, pd: 1, harbour: 1 },
  },
  {
    id: "p2",
    name: "the research & insights director",
    firstPersonLine: "my team is drowning in data",
    familyWeights: { platforms: 3, evidence: 3, storytelling: 1, inclusion: 1, gatherings: 1, pd: 1, harbour: 1 },
  },
  {
    id: "p3",
    name: "the educator-developer",
    firstPersonLine: "i need training that actually reaches classrooms",
    familyWeights: { pd: 3, inclusion: 3, harbour: 2, evidence: 1, storytelling: 1, gatherings: 1, platforms: 1 },
  },
  {
    id: "p4",
    name: "the community convener",
    firstPersonLine: "my convening deserves better than a zoom wall",
    familyWeights: { gatherings: 3, storytelling: 3, harbour: 2, evidence: 1, inclusion: 1, pd: 1, platforms: 1 },
  },
  {
    id: "p5",
    name: "the curious player",
    firstPersonLine: "i just want to play with the thinking first",
    familyWeights: { harbour: 3, pd: 1, evidence: 1, storytelling: 1, gatherings: 1, inclusion: 1, platforms: 1 },
  },
];

// fader axes — PLACEHOLDER SEMANTICS, flagged in the design plan (§9 open
// question a). three discrete positions each: 0 = left, 1 = middle, 2 = right.
export const axes = [
  { id: "a1", left: "people", right: "systems" },
  { id: "a2", left: "evidence", right: "play" },
  { id: "a3", left: "learn", right: "build" },
];

export const families = [
  {
    slug: "evidence",
    name: "evidence & research consulting",
    profiles: ["p1", "p2"],
    // axis affinity: which side of each axis this family leans toward (null = neutral)
    axisLean: { a1: "systems", a2: "evidence", a3: null },
    hooks: [
      { text: "a funder just asked “does this work?” — no defensible answer", profiles: ["p1", "p2"] },
      { text: "measurement that punishes your flexibility", profiles: ["p1"] },
      { text: "evaluation takes two years; your funding cycle doesn’t", profiles: ["p1"] },
      { text: "evidence scattered across reports nobody reads", profiles: ["p1", "p2"] },
      { text: "data collected, never cleaned or coded", profiles: ["p2"] },
    ],
    offer:
      "we build defensible evidence in weeks, not years. flexible measurement that fits how your programme actually runs, human-verified ai coding for the data nobody has touched, and evidence maps people actually read.",
    proof: [
      { label: "amna at 10 evidence map", stat: null, href: null, cleared: false },
      { label: "human-verified ai coding console", stat: null, href: null, cleared: false },
      { label: "peer-reviewed publications", stat: "19 publications", href: null, cleared: true },
    ],
    ladder: {
      play: { label: "explore a public evidence map", href: null },
      take: { label: "take the evidence-in-weeks explainer", href: null },
    },
  },
  {
    slug: "platforms",
    name: "ai platforms & agentic back-offices",
    profiles: ["p2", "p1"],
    axisLean: { a1: "systems", a2: null, a3: "build" },
    hooks: [
      { text: "your smartest people are doing data entry", profiles: ["p2", "p1"] },
      { text: "know ai matters, don’t know where to start", profiles: ["p1", "p2"] },
      { text: "chatgpt isn’t safe or citable for your data", profiles: ["p2"] },
      { text: "knowledge trapped in pdfs, inboxes, one person’s head", profiles: ["p1", "p2"] },
      { text: "competitors are adopting agents now", profiles: ["p2"] },
    ],
    offer:
      "we build working ai systems you own — grounded in your data, safe to cite, run by agents that do the ops your humans shouldn’t. built by a studio that runs itself on one.",
    proof: [
      { label: "pam dashboard — shared live with a client", stat: null, href: null, cleared: false },
      { label: "nordic research platform", stat: null, href: null, cleared: false },
      { label: "the port — our own agentic back-office", stat: null, href: null, cleared: false },
    ],
    ladder: {
      play: { label: "poke a working agent console", href: null },
      take: { label: "take the agentic back-office primer", href: null },
    },
  },
  {
    slug: "pd",
    name: "pd & certificates",
    profiles: ["p3", "p1"],
    axisLean: { a1: "people", a2: null, a3: "learn" },
    hooks: [
      { text: "you fund pd nobody finishes", profiles: ["p3", "p1"] },
      { text: "certificates without credibility", profiles: ["p3"] },
      { text: "can’t show what the training changed", profiles: ["p1", "p3"] },
      { text: "english-only pd, multilingual community", profiles: ["p3"] },
      { text: "workshops that evaporate by monday", profiles: ["p3"] },
    ],
    offer:
      "professional development people finish — credentialed, multilingual, and measured all the way to the classroom. certificates that carry evidence, not just a logo.",
    proof: [
      {
        label: "ppcs live impact dashboard",
        stat: "915 registrants · 68 countries · 710 certificates",
        href: "https://windedvertigo.com/portfolio/ppcs-2026-impact",
        cleared: true,
      },
    ],
    ladder: {
      play: { label: "open the live ppcs dashboard", href: "https://windedvertigo.com/portfolio/ppcs-2026-impact" },
      take: { label: "take the ppcs impact report", href: null },
    },
  },
  {
    slug: "gatherings",
    name: "conferences & gatherings",
    profiles: ["p4"],
    axisLean: { a1: "people", a2: "play", a3: null },
    hooks: [
      { text: "a zoom wall of talking heads", profiles: ["p4"] },
      { text: "attendees leave with notes, not commitments", profiles: ["p4"] },
      { text: "big spend, nothing to show for it", profiles: ["p4"] },
      { text: "want play without gimmicks", profiles: ["p4"] },
    ],
    offer:
      "convenings people participate in — designed interactions, live simulation, and documentation that shows what the room actually committed to.",
    proof: [
      { label: "ground truth 2026 live simulator", stat: null, href: null, cleared: false },
      { label: "press.play & neowise partnerships", stat: null, href: null, cleared: true },
    ],
    ladder: {
      play: { label: "try the conference experience demo", href: null },
      take: { label: "take the gathering design one-pager", href: null },
    },
  },
  {
    slug: "harbour",
    name: "harbour products",
    profiles: ["p5"],
    axisLean: { a1: null, a2: "play", a3: null },
    hooks: [
      { text: "want to try the thinking before a contract", profiles: ["p5", "p1"] },
      { text: "screen time that gives nothing back", profiles: ["p5"] },
      { text: "teachers need playful, low-prep activities", profiles: ["p5", "p3"] },
      { text: "programs need lightweight documentation of learning", profiles: ["p1", "p3"] },
    ],
    offer:
      "playable tools you can use today — games and activities that leave something behind: a perception shifted, a thing made, learning documented lightly.",
    proof: [
      { label: "values.auction", stat: null, href: "https://values.auction", cleared: true },
      { label: "crease.works", stat: null, href: "https://crease.works", cleared: true },
    ],
    ladder: {
      play: { label: "play values.auction", href: "https://values.auction" },
      take: { label: "take a low-prep classroom activity", href: null },
    },
  },
  {
    slug: "inclusion",
    name: "inclusion & safeguarding design",
    profiles: ["p3", "p1"],
    axisLean: { a1: "people", a2: "evidence", a3: "learn" },
    hooks: [
      { text: "inclusion policy stuck in a binder", profiles: ["p3", "p1"] },
      { text: "audit coming — goodwill but no evidence", profiles: ["p1"] },
      { text: "one-size-fits-all fails neurodivergent learners", profiles: ["p3"] },
      { text: "cpd staff endure rather than use", profiles: ["p3"] },
    ],
    offer:
      "inclusion that reaches the classroom — udl-grounded design, audit-ready evidence, and cpd your staff choose to use.",
    proof: [
      { label: "udl audit framework", stat: null, href: null, cleared: false },
      { label: "professionals reached", stat: "45k professionals", href: null, cleared: true },
      { label: "national cpd track record", stat: null, href: null, cleared: true },
    ],
    ladder: {
      play: { label: "sample the udl audit lens", href: null },
      take: { label: "take the inclusion evidence checklist", href: null },
    },
  },
  {
    slug: "storytelling",
    name: "storytelling & studio",
    profiles: ["p1", "p4"],
    axisLean: { a1: null, a2: "evidence", a3: "build" },
    hooks: [
      { text: "real impact, invisible", profiles: ["p1", "p4"] },
      { text: "an annual report nobody read", profiles: ["p1"] },
      { text: "data without story, story without data", profiles: ["p1", "p4"] },
      { text: "a dashboard that persuades no one", profiles: ["p1"] },
    ],
    offer:
      "we turn real work into things people actually look at — impact reports, dashboards, and public evidence maps where the proof is the headline, not the appendix.",
    proof: [
      {
        label: "ppcs impact dashboard",
        stat: null,
        href: "https://windedvertigo.com/portfolio/ppcs-2026-impact",
        cleared: true,
      },
      { label: "pam dashboard", stat: null, href: null, cleared: false },
      { label: "public evidence maps", stat: null, href: null, cleared: false },
    ],
    ladder: {
      play: { label: "open a live impact dashboard", href: "https://windedvertigo.com/portfolio/ppcs-2026-impact" },
      take: { label: "take the storytelling sampler", href: null },
    },
  },
];

// proof floor — legacy wordmarks, presented straight (no marquee, no counts).
export const proofFloor = ["LEGO Foundation", "UN Global Compact · PRME", "Amna", "Nordic Naturals"];

export const strings = {
  brand: "winded.vertigo",
  heroSub: "seven things we do. five kinds of people who need them. start with your problem.",
  browseNeed: "browse by what you need",
  browseWho: "browse by who you are",
  showEverything: "just show me everything",
  playDesk: "play the desk",
  plainVersion: "plain version",
  quietExit: "not sure which of these is you? bring us the problem — thirty minutes, no deck.",
  quietExitCta: "start that conversation",
  talkHref: "mailto:garrett@windedvertigo.com?subject=thirty%20minutes%2C%20no%20deck",
  proofFloorLine: "we’ve been doing this since before it was a website.",
  pendingNote: "pending public-link clearance",
};
