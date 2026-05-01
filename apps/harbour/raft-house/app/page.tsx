"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateRoomCode } from "@/lib/room-code";
import { GAME_REGISTRY } from "@/lib/games";
import type { AgeLevel, DisplayMode } from "@/lib/types";
import "./discover.css";

// ── game data ──────────────────────────────────────────────────────────────

type Energy = "contemplative" | "energized" | "playful";
type Social = "solo" | "collaborative" | "asymmetric";

// mechanical differentiation axes — loose strings because every game is unique
type InputMode = string;
type Agency = string;
type CoreLoop = string;
type Temporality = "real-time" | "turn-based" | "time-pressure" | "async" | "paced";

interface GameMechanics {
  input: InputMode;
  agency: Agency;
  coreLoop: CoreLoop;
  temporality: Temporality;
  verb: string;  // the one-word action verb shown on badges
  color: string; // badge accent color
}

interface Game {
  name: string;
  icon: string;
  disc: string;
  energy: Energy;
  social: Social;
  desc: string;
  mechanics: GameMechanics;
}

// agency verb → color mapping for visual variety
const VERB_COLORS: Record<string, string> = {
  fold: "#8b5cf6",
  manage: "#ef4444",
  wire: "#f59e0b",
  grow: "#22c55e",
  weave: "#06b6d4",
  sync: "#3b82f6",
  stack: "#f97316",
  diagram: "#0d9488",
  route: "#ec4899",
  solve: "#d97706",
  shift: "#6366f1",
  tend: "#22c55e",
  paint: "#3b82f6",
  orbit: "#8b5cf6",
  split: "#9333ea",
  steer: "#ef4444",
  decode: "#06b6d4",
  balance: "#f59e0b",
  trigger: "#ec4899",
  bond: "#9333ea",
  dance: "#f97316",
  trace: "#0d9488",
  trade: "#dc2626",
  vote: "#3b82f6",
  scale: "#d97706",
  model: "#6366f1",
  navigate: "#8b5cf6",
  anchor: "#ef4444",
  narrate: "#06b6d4",
  lens: "#ec4899",
  build: "#f59e0b",
  read: "#0d9488",
  inhabit: "#9333ea",
  cross: "#d97706",
  compose: "#3b82f6",
  polyphony: "#ec4899",
  map: "#6366f1",
  jam: "#f97316",
  see: "#22c55e",
  copaint: "#06b6d4",
  sketch: "#ef4444",
  haunt: "#8b5cf6",
  revise: "#0d9488",
  rewrite: "#d97706",
  survive: "#ef4444",
  predict: "#f59e0b",
  gaze: "#6366f1",
};

const GAMES: Game[] = [
  // ── mathematics ──
  { name: "fold.space", icon: "\u{1F4D0}", disc: "mathematics", energy: "playful", social: "solo",
    desc: "gestural origami \u2014 drag-to-fold with crease physics, reveal hidden geometric structures",
    mechanics: { input: "gesture", agency: "you build", coreLoop: "fold\u2192crease\u2192reveal", temporality: "paced", verb: "fold", color: VERB_COLORS.fold } },
  { name: "infinity.hotel", icon: "\u{1F3E8}", disc: "mathematics", energy: "energized", social: "asymmetric",
    desc: "frantic logistics \u2014 drag guests between rooms under escalating arrivals. comedy management sim",
    mechanics: { input: "drag", agency: "you manage", coreLoop: "assign\u2192overflow\u2192rearrange", temporality: "time-pressure", verb: "manage", color: VERB_COLORS.manage } },
  { name: "variable.engine", icon: "\u2699\uFE0F", disc: "mathematics", energy: "energized", social: "collaborative",
    desc: "rube goldberg wiring \u2014 chain physical cause-effect machines with algebraic constraints",
    mechanics: { input: "drag", agency: "you wire", coreLoop: "chain\u2192trigger\u2192observe", temporality: "paced", verb: "wire", color: VERB_COLORS.wire } },
  { name: "proof.garden", icon: "\u{1F33F}", disc: "mathematics", energy: "contemplative", social: "solo",
    desc: "plant axiom seeds, drag to connect, watch proof trees bloom into theorems",
    mechanics: { input: "drag", agency: "you tend", coreLoop: "plant\u2192connect\u2192bloom", temporality: "paced", verb: "grow", color: VERB_COLORS.grow } },
  { name: "pattern.weave", icon: "\u{1F9F6}", disc: "mathematics", energy: "contemplative", social: "solo",
    desc: "click regions to find hidden patterns, reverse-engineer the rule, then compose new ones",
    mechanics: { input: "mouse/touch", agency: "you investigate", coreLoop: "find\u2192reverse\u2192compose", temporality: "paced", verb: "weave", color: VERB_COLORS.weave } },

  // ── computer science ──
  { name: "race.condition", icon: "\u{1F3C1}", disc: "cs", energy: "energized", social: "collaborative",
    desc: "PvP shared-resource race \u2014 two players cause real race conditions, not just observe them",
    mechanics: { input: "mouse/touch", agency: "you are the system", coreLoop: "grab\u2192conflict\u2192deadlock", temporality: "real-time", verb: "race", color: VERB_COLORS.sync } },
  { name: "type.tower", icon: "\u{1F5FC}", disc: "cs", energy: "playful", social: "solo",
    desc: "physical block-stacking \u2014 shaped blocks only fit compatible types. tactile tetris/jenga hybrid",
    mechanics: { input: "drag", agency: "you build", coreLoop: "stack\u2192check\u2192balance", temporality: "paced", verb: "stack", color: VERB_COLORS.stack } },
  { name: "state.craft", icon: "\u{1F916}", disc: "cs", energy: "contemplative", social: "solo",
    desc: "escape room \u2014 you're trapped inside a state machine. discover transitions to escape",
    mechanics: { input: "mouse/touch", agency: "you are the system", coreLoop: "explore\u2192trigger\u2192escape", temporality: "paced", verb: "escape", color: VERB_COLORS.diagram } },
  { name: "signal.flow", icon: "\u{1F4E1}", disc: "cs", energy: "energized", social: "collaborative",
    desc: "wire boxes together, observe signal propagation, rewire under pressure before overflow",
    mechanics: { input: "drag", agency: "you wire", coreLoop: "wire\u2192observe\u2192rewire", temporality: "real-time", verb: "route", color: VERB_COLORS.route } },
  { name: "code.weave", icon: "\u{1F9EC}", disc: "cs", energy: "energized", social: "solo",
    desc: "drag code blocks, step through execution, debug the weave when threads tangle",
    mechanics: { input: "drag", agency: "you build", coreLoop: "program\u2192run\u2192debug", temporality: "paced", verb: "debug", color: VERB_COLORS.solve } },

  // ── physics ──
  { name: "frame.shift", icon: "\u{1F30C}", disc: "physics", energy: "playful", social: "asymmetric",
    desc: "split-screen asymmetric co-op \u2014 same events, different reference frames. reconcile to solve",
    mechanics: { input: "mouse/touch", agency: "you are the system", coreLoop: "observe\u2192compare\u2192reconcile", temporality: "turn-based", verb: "shift", color: VERB_COLORS.shift } },
  { name: "entropy.garden", icon: "\u{1F331}", disc: "physics", energy: "contemplative", social: "solo",
    desc: "tamagotchi nurture \u2014 keep order alive against constant decay. emotional attachment, inevitable loss",
    mechanics: { input: "mouse/touch", agency: "you tend", coreLoop: "nurture\u2192decay\u2192grieve", temporality: "time-pressure", verb: "tend", color: VERB_COLORS.tend } },
  { name: "field.canvas", icon: "\u{1F9F2}", disc: "physics", energy: "playful", social: "collaborative",
    desc: "collaborative painting \u2014 place charges to paint with field lines. gallery mode, save & share",
    mechanics: { input: "drawing", agency: "you paint", coreLoop: "place\u2192paint\u2192share", temporality: "real-time", verb: "paint", color: VERB_COLORS.paint } },
  { name: "orbit.lab", icon: "\u{1FA90}", disc: "physics", energy: "playful", social: "solo",
    desc: "launch\u2192observe\u2192adjust: aim and thrust to design stable orbital systems",
    mechanics: { input: "mouse/touch", agency: "you build", coreLoop: "launch\u2192observe\u2192adjust", temporality: "real-time", verb: "orbit", color: VERB_COLORS.orbit } },
  { name: "time.prism", icon: "\u{1F52E}", disc: "physics", energy: "contemplative", social: "solo",
    desc: "branching narrative \u2014 read, decide, compare timelines. solo paced story",
    mechanics: { input: "mouse/touch", agency: "you are the system", coreLoop: "read\u2192decide\u2192compare", temporality: "paced", verb: "branch", color: VERB_COLORS.split } },

  // ── biology ──
  { name: "selection.pressure", icon: "\u{1F98E}", disc: "biology", energy: "energized", social: "collaborative",
    desc: "indirect environmental control \u2014 can't touch organisms, only shape terrain. the frustration IS the lesson",
    mechanics: { input: "slider", agency: "you shape the environment", coreLoop: "shape\u2192observe\u2192adapt", temporality: "real-time", verb: "steer", color: VERB_COLORS.steer } },
  { name: "express.ion", icon: "\u{1F9EC}", disc: "biology", energy: "playful", social: "asymmetric",
    desc: "lock-and-key molecular manipulation \u2014 fit transcription factors to promoters. combinatorial puzzle",
    mechanics: { input: "drag", agency: "you investigate", coreLoop: "fit\u2192test\u2192express", temporality: "turn-based", verb: "decode", color: VERB_COLORS.decode } },
  { name: "web.pulse", icon: "\u{1F578}\uFE0F", disc: "biology", energy: "contemplative", social: "collaborative",
    desc: "jenga-style species removal \u2014 pull species, see if the web holds or cascades. tension of each removal",
    mechanics: { input: "mouse/touch", agency: "you observe", coreLoop: "pull\u2192cascade\u2192dread", temporality: "turn-based", verb: "pull", color: VERB_COLORS.balance } },
  { name: "emerge.box", icon: "\u{1F4E6}", disc: "biology", energy: "energized", social: "solo",
    desc: "toggle cells, define rules, watch emergent behavior unfold in real time",
    mechanics: { input: "mouse/touch", agency: "you observe", coreLoop: "define\u2192observe\u2192emerge", temporality: "real-time", verb: "trigger", color: VERB_COLORS.trigger } },

  // ── chemistry ──
  { name: "bond.craft", icon: "\u269B\uFE0F", disc: "chemistry", energy: "playful", social: "solo",
    desc: "3D electron cloud sculpting \u2014 shape orbitals with gestures. spatial, artistic chemistry",
    mechanics: { input: "gesture", agency: "you build", coreLoop: "sculpt\u2192bond\u2192test", temporality: "paced", verb: "sculpt", color: VERB_COLORS.bond } },
  { name: "equilibrium.dance", icon: "\u{1FA69}", disc: "chemistry", energy: "energized", social: "collaborative",
    desc: "zoom-only mechanic \u2014 only interaction is zooming between macro stillness and micro chaos. the zoom IS the threshold",
    mechanics: { input: "gesture", agency: "you zoom", coreLoop: "zoom\u2192observe\u2192shift", temporality: "real-time", verb: "zoom", color: VERB_COLORS.dance } },
  { name: "reaction.path", icon: "\u{1F9EA}", disc: "chemistry", energy: "contemplative", social: "solo",
    desc: "marble-run platformer \u2014 you ARE the molecule navigating an energy landscape",
    mechanics: { input: "mouse/touch", agency: "you are the system", coreLoop: "traverse\u2192climb\u2192descend", temporality: "real-time", verb: "traverse", color: VERB_COLORS.trace } },

  // ── economics ──
  { name: "margin.call", icon: "\u{1F4B9}", disc: "economics", energy: "energized", social: "solo",
    desc: "rapid-fire binary decisions \u2014 'one more? yes/no' under time pressure. game-show pacing, no analysis time",
    mechanics: { input: "mouse/touch", agency: "you are the system", coreLoop: "decide\u2192reveal\u2192survive", temporality: "time-pressure", verb: "survive", color: VERB_COLORS.survive } },
  { name: "trade.winds", icon: "\u26F5", disc: "economics", energy: "playful", social: "asymmetric",
    desc: "async diplomacy \u2014 propose deals via messages, no direct resource control. negotiation, not allocation",
    mechanics: { input: "typing", agency: "you negotiate", coreLoop: "propose\u2192counter\u2192settle", temporality: "async", verb: "negotiate", color: VERB_COLORS.trade } },
  { name: "commons.game", icon: "\u{1F33E}", disc: "economics", energy: "contemplative", social: "collaborative",
    desc: "social deduction + institutional design \u2014 secret defectors, then design governance together",
    mechanics: { input: "mouse/touch", agency: "you negotiate", coreLoop: "betray\u2192detect\u2192govern", temporality: "turn-based", verb: "govern", color: VERB_COLORS.vote } },
  { name: "scale.shift", icon: "\u2696\uFE0F", disc: "economics", energy: "playful", social: "solo",
    desc: "zoom\u2192interact\u2192question: pinch and scroll between micro and macro economic scales",
    mechanics: { input: "gesture", agency: "you investigate", coreLoop: "zoom\u2192interact\u2192question", temporality: "paced", verb: "scale", color: VERB_COLORS.scale } },
  { name: "market.mind", icon: "\u{1F4C8}", disc: "economics", energy: "energized", social: "asymmetric",
    desc: "drag resources to allocate, trade with others, compare strategies. multiplayer competitive",
    mechanics: { input: "drag", agency: "you negotiate", coreLoop: "allocate\u2192trade\u2192compare", temporality: "turn-based", verb: "trade", color: VERB_COLORS.model } },

  // ── psychology ──
  { name: "mirror.maze", icon: "\u{1FA9E}", disc: "psychology", energy: "contemplative", social: "asymmetric",
    desc: "asymmetric perception co-op \u2014 each player sees different objects in the same room",
    mechanics: { input: "mouse/touch", agency: "you investigate", coreLoop: "see\u2192compare\u2192reconcile", temporality: "paced", verb: "perceive", color: VERB_COLORS.navigate } },
  { name: "anchor.drift", icon: "\u2693", disc: "psychology", energy: "energized", social: "collaborative",
    desc: "live multiplayer game show \u2014 audience polls, social comparison of biased answers",
    mechanics: { input: "mouse/touch", agency: "you perform", coreLoop: "guess\u2192compare\u2192cringe", temporality: "time-pressure", verb: "poll", color: VERB_COLORS.anchor } },
  { name: "story.self", icon: "\u{1F4D6}", disc: "psychology", energy: "playful", social: "asymmetric",
    desc: "card-game narrative \u2014 deal event cards, arrange into competing autobiographies",
    mechanics: { input: "drag", agency: "you narrate", coreLoop: "draft\u2192arrange\u2192defend", temporality: "turn-based", verb: "draft", color: VERB_COLORS.narrate } },
  { name: "bias.lens", icon: "\u{1F50D}", disc: "psychology", energy: "contemplative", social: "solo",
    desc: "choose a scenario, reveal hidden biases, reflect on what you missed. paced solo journey",
    mechanics: { input: "mouse/touch", agency: "you observe", coreLoop: "choose\u2192reveal\u2192reflect", temporality: "paced", verb: "lens", color: VERB_COLORS.lens } },
  { name: "pale.blue", icon: "\u{1F30D}", disc: "psychology", energy: "contemplative", social: "collaborative",
    desc: "altitude as metaphor \u2014 zoom out until borders dissolve. the overview effect as threshold crossing",
    mechanics: { input: "mouse/touch", agency: "you observe", coreLoop: "ascend\u2192shift\u2192return", temporality: "paced", verb: "gaze", color: VERB_COLORS.gaze } },

  // ── philosophy ──
  { name: "ought.machine", icon: "\u{1F914}", disc: "philosophy", energy: "energized", social: "solo",
    desc: "socratic debate engine \u2014 argue a position, AI exposes your hidden premises. adversarial dialogue",
    mechanics: { input: "typing", agency: "you build", coreLoop: "argue\u2192expose\u2192revise", temporality: "paced", verb: "argue", color: VERB_COLORS.build } },
  { name: "circle.read", icon: "\u{1F504}", disc: "philosophy", energy: "contemplative", social: "solo",
    desc: "detective noir investigation \u2014 each clue recontextualizes all previous clues. iterative reinterpretation",
    mechanics: { input: "mouse/touch", agency: "you investigate", coreLoop: "discover\u2192reread\u2192reframe", temporality: "paced", verb: "investigate", color: VERB_COLORS.read } },
  { name: "lens.shift", icon: "\u{1F453}", disc: "philosophy", energy: "playful", social: "solo",
    desc: "camera filter tool \u2014 literal visual filters that hide/reveal scene elements. swap lenses to see differently",
    mechanics: { input: "mouse/touch", agency: "you observe", coreLoop: "swap\u2192see\u2192compare", temporality: "paced", verb: "filter", color: VERB_COLORS.inhabit } },
  { name: "liminal.pass", icon: "\u{1F6AA}", disc: "philosophy", energy: "playful", social: "solo",
    desc: "mixed-mechanic meta-game \u2014 puzzle\u2192cross\u2192name. each level uses a different interaction",
    mechanics: { input: "mouse/touch", agency: "you are the system", coreLoop: "puzzle\u2192cross\u2192name", temporality: "paced", verb: "cross", color: VERB_COLORS.cross } },

  // ── music ──
  { name: "tone.field", icon: "\u{1F3B5}", disc: "music", energy: "contemplative", social: "collaborative",
    desc: "spatial audio walk \u2014 move through a sound field, your position determines the harmony",
    mechanics: { input: "mouse/touch", agency: "you paint", coreLoop: "move\u2192listen\u2192harmonize", temporality: "real-time", verb: "walk", color: VERB_COLORS.compose } },
  { name: "voice.weave", icon: "\u{1F3BC}", disc: "music", energy: "playful", social: "asymmetric",
    desc: "multiplayer live performance \u2014 each player sings/plays one voice in real-time. ensemble, social pressure",
    mechanics: { input: "voice", agency: "you perform", coreLoop: "listen\u2192enter\u2192blend", temporality: "real-time", verb: "ensemble", color: VERB_COLORS.polyphony } },
  { name: "sound.color", icon: "\u{1F3A8}", disc: "music", energy: "playful", social: "solo",
    desc: "synesthesia painting \u2014 paint visuals, hear what they sound like. cross-modal, artistic",
    mechanics: { input: "drawing", agency: "you paint", coreLoop: "paint\u2192hear\u2192adjust", temporality: "paced", verb: "synth", color: VERB_COLORS.map } },
  { name: "rhythm.lab", icon: "\u{1F3B6}", disc: "music", energy: "playful", social: "collaborative",
    desc: "layer\u2192subdivide\u2192groove: tap rhythms, build emergent beats from individual contributions",
    mechanics: { input: "rhythm", agency: "you perform", coreLoop: "layer\u2192subdivide\u2192groove", temporality: "real-time", verb: "jam", color: VERB_COLORS.jam } },

  // ── visual arts ──
  { name: "space.between", icon: "\u25FB\uFE0F", disc: "visual-arts", energy: "contemplative", social: "solo",
    desc: "photography/framing game \u2014 frame scenes to compose negative space. camera viewfinder mechanic",
    mechanics: { input: "mouse/touch", agency: "you observe", coreLoop: "frame\u2192compose\u2192reveal", temporality: "paced", verb: "frame", color: VERB_COLORS.see } },
  { name: "hue.shift", icon: "\u{1F308}", disc: "visual-arts", energy: "playful", social: "collaborative",
    desc: "speed matching under shifting context \u2014 match colors while surroundings change. reflex + perception",
    mechanics: { input: "mouse/touch", agency: "you perform", coreLoop: "match\u2192shift\u2192adapt", temporality: "time-pressure", verb: "match", color: VERB_COLORS.copaint } },
  { name: "grid.break", icon: "\u{1F4CF}", disc: "visual-arts", energy: "energized", social: "solo",
    desc: "before/after design challenge \u2014 design without grid, then with. the contrast is the lesson",
    mechanics: { input: "drawing", agency: "you build", coreLoop: "design\u2192constrain\u2192compare", temporality: "paced", verb: "contrast", color: VERB_COLORS.sketch } },

  // ── writing ──
  { name: "reader.ghost", icon: "\u{1F47B}", disc: "writing", energy: "playful", social: "solo",
    desc: "live AI audience \u2014 simulated readers react in real-time as you type. write into visible feedback",
    mechanics: { input: "typing", agency: "you perform", coreLoop: "type\u2192react\u2192adjust", temporality: "real-time", verb: "haunt", color: VERB_COLORS.haunt } },
  { name: "draft.loop", icon: "\u{1F501}", disc: "writing", energy: "contemplative", social: "solo",
    desc: "structural x-ray surgery \u2014 paragraph blocks become moveable, game finds buried thesis",
    mechanics: { input: "drag", agency: "you build", coreLoop: "rearrange\u2192reveal\u2192refine", temporality: "paced", verb: "surgery", color: VERB_COLORS.revise } },
  { name: "genre.shift", icon: "\u{1F4DD}", disc: "writing", energy: "energized", social: "asymmetric",
    desc: "constraint transformation \u2014 same facts forced into radically different templates. mad libs meets rhetoric",
    mechanics: { input: "typing", agency: "you narrate", coreLoop: "constrain\u2192transform\u2192compare", temporality: "time-pressure", verb: "transform", color: VERB_COLORS.rewrite } },
];

const DISC_COLORS: Record<string, string> = {
  mathematics: "#d97706",
  cs: "#3b82f6",
  physics: "#6366f1",
  biology: "#22c55e",
  chemistry: "#9333ea",
  economics: "#dc2626",
  psychology: "#ec4899",
  philosophy: "#8b5cf6",
  music: "#f97316",
  "visual-arts": "#0d9488",
  writing: "#6366f1",
};

const DISC_LABELS: Record<string, string> = {
  mathematics: "mathematics",
  cs: "computer science",
  physics: "physics",
  biology: "biology",
  chemistry: "chemistry",
  economics: "economics",
  psychology: "psychology",
  philosophy: "philosophy",
  music: "music",
  "visual-arts": "visual arts",
  writing: "writing",
};

const DISC_LIST = [
  "mathematics",
  "cs",
  "physics",
  "biology",
  "chemistry",
  "economics",
  "psychology",
  "philosophy",
  "music",
  "visual-arts",
  "writing",
];

const CLUSTERS: Record<
  string,
  {
    cx: number;
    cy: number;
    color: string;
    bg: string;
    shore: string;
    size: number;
  }
> = {
  mathematics: {
    cx: 350,
    cy: 250,
    color: "#d97706",
    bg: "#7a5a20",
    shore: "#a8842e",
    size: 130,
  },
  cs: {
    cx: 950,
    cy: 220,
    color: "#3b82f6",
    bg: "#2a4a3a",
    shore: "#3d6b52",
    size: 140,
  },
  physics: {
    cx: 200,
    cy: 620,
    color: "#6366f1",
    bg: "#4a3d28",
    shore: "#6b5a3a",
    size: 140,
  },
  biology: {
    cx: 780,
    cy: 530,
    color: "#22c55e",
    bg: "#2d5a25",
    shore: "#4a8a3a",
    size: 120,
  },
  chemistry: {
    cx: 1300,
    cy: 400,
    color: "#9333ea",
    bg: "#3a3040",
    shore: "#5a4a60",
    size: 110,
  },
  economics: {
    cx: 480,
    cy: 950,
    color: "#dc2626",
    bg: "#5a3020",
    shore: "#8a5030",
    size: 140,
  },
  psychology: {
    cx: 1100,
    cy: 780,
    color: "#ec4899",
    bg: "#4a2838",
    shore: "#6b3a50",
    size: 120,
  },
  philosophy: {
    cx: 300,
    cy: 1280,
    color: "#8b5cf6",
    bg: "#3a3548",
    shore: "#5a5060",
    size: 120,
  },
  music: {
    cx: 850,
    cy: 1100,
    color: "#f97316",
    bg: "#5a3a1a",
    shore: "#8a6030",
    size: 120,
  },
  "visual-arts": {
    cx: 1250,
    cy: 1150,
    color: "#0d9488",
    bg: "#1a4a40",
    shore: "#2a6a58",
    size: 110,
  },
  writing: {
    cx: 550,
    cy: 1500,
    color: "#6366f1",
    bg: "#3a3848",
    shore: "#5a5560",
    size: 110,
  },
};

const BLOBS = [
  "42% 58% 55% 45% / 48% 40% 60% 52%",
  "55% 45% 40% 60% / 52% 55% 45% 48%",
  "48% 52% 58% 42% / 45% 48% 52% 55%",
  "60% 40% 45% 55% / 42% 58% 42% 58%",
  "45% 55% 52% 48% / 55% 42% 58% 42%",
  "52% 48% 42% 58% / 58% 45% 55% 45%",
  "38% 62% 50% 50% / 50% 38% 62% 50%",
  "62% 38% 48% 52% / 40% 55% 45% 55%",
  "50% 50% 42% 58% / 58% 42% 52% 48%",
  "44% 56% 60% 40% / 50% 44% 56% 50%",
  "58% 42% 44% 56% / 46% 52% 48% 52%",
];

// ── helpers ────────────────────────────────────────────────────────────────

function mixColor(c1: string, c2: string, t: number): string {
  const hex2rgb = (h: string) => {
    const v = h.replace("#", "");
    return [
      parseInt(v.substring(0, 2), 16),
      parseInt(v.substring(2, 4), 16),
      parseInt(v.substring(4, 6), 16),
    ];
  };
  const a = hex2rgb(c1),
    b = hex2rgb(c2);
  const r = Math.round(a[0] * (1 - t) + b[0] * t);
  const g = Math.round(a[1] * (1 - t) + b[1] * t);
  const bl = Math.round(a[2] * (1 - t) + b[2] * t);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}

function shuffle<T>(arr: T[]): T[] {
  const b = arr.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// ── SVG icons ──────────────────────────────────────────────────────────────

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="check-svg"
      viewBox="0 0 12 12"
      fill="none"
      stroke="white"
      strokeWidth="2"
    >
      <path d="M2 6l3 3 5-5" />
    </svg>
  );
}

function DiscoverIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function JoinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3"
      />
    </svg>
  );
}

// ── wave lines ─────────────────────────────────────────────────────────────

const WAVE_LINES = Array.from({ length: 8 }, (_, i) => ({
  top: `${20 + i * 10}%`,
  dur: `${14 + Math.random() * 10}s`,
  delay: `${-Math.random() * 10}s`,
  opacity: 0.3 + Math.random() * 0.5,
}));

// ── component ──────────────────────────────────────────────────────────────

type Screen = "welcome" | "q1" | "q2" | "q3" | "thinking" | "results";
type Mode = "discover" | "browse";

export default function DiscoverPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("discover");
  const [screen, setScreen] = useState<Screen>("welcome");
  const [screenHistory, setScreenHistory] = useState<Screen[]>([]);
  const [energy, setEnergy] = useState<Energy | null>(null);
  const [social, setSocial] = useState<Social | null>(null);
  const [disc, setDisc] = useState<string | null>(null);
  const [detailGame, setDetailGame] = useState<Game | null>(null);
  const [sessionAgeLevel, setSessionAgeLevel] = useState<AgeLevel>("professional");
  const [sessionDisplayMode, setSessionDisplayMode] = useState<DisplayMode>("screenless");
  const [results, setResults] = useState<{
    matches: Game[];
    wildcard: Game;
    surprise: boolean;
  } | null>(null);
  const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // pan/zoom state
  const mapRef = useRef<HTMLDivElement>(null);
  const archRef = useRef<HTMLDivElement>(null);
  const mapState = useRef({
    x: 0,
    y: 0,
    scale: 0.8,
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastDist: 0,
    startX: 0,
    startY: 0,
    // touch gesture tracking
    touches: 0,
    pinching: false,
  });

  // ── screen transitions ──

  const screenClass = useCallback(
    (id: Screen) => {
      if (id === screen) return "screen s-active";
      const screens: Screen[] = [
        "welcome",
        "q1",
        "q2",
        "q3",
        "thinking",
        "results",
      ];
      const cur = screens.indexOf(screen);
      const target = screens.indexOf(id);
      return target < cur ? "screen s-hidden-left" : "screen s-hidden-right";
    },
    [screen],
  );

  const goTo = useCallback(
    (next: Screen) => {
      setScreenHistory((h) => [...h, screen]);
      setScreen(next);
    },
    [screen],
  );

  const goBack = useCallback(() => {
    setScreenHistory((h) => {
      const copy = [...h];
      const prev = copy.pop();
      if (prev) setScreen(prev);
      return copy;
    });
  }, []);

  const isQuestionScreen = ["q1", "q2", "q3"].includes(screen);

  // ── serendipity flow ──

  const selectEnergy = useCallback(
    (v: Energy) => {
      setEnergy(v);
      setTimeout(() => goTo("q2"), 420);
    },
    [goTo],
  );

  const selectSocial = useCallback(
    (v: Social) => {
      setSocial(v);
      setTimeout(() => goTo("q3"), 420);
    },
    [goTo],
  );

  const computeResults = useCallback(
    (surprise: boolean) => {
      let matches: Game[];
      let wildcard: Game;

      if (surprise) {
        const s = shuffle(GAMES);
        matches = s.slice(0, 3);
        wildcard = s[3];
      } else {
        let pool = GAMES.filter(
          (g) =>
            (!energy || g.energy === energy) &&
            (!social || g.social === social) &&
            (!disc || g.disc === disc),
        );
        if (pool.length < 3)
          pool = GAMES.filter(
            (g) =>
              (!energy || g.energy === energy) &&
              (!social || g.social === social),
          );
        if (pool.length < 3)
          pool = GAMES.filter((g) => !energy || g.energy === energy);
        if (pool.length < 3) pool = GAMES.slice();

        const s = shuffle(pool);
        matches = s.slice(0, 3);
        const matchNames = new Set(matches.map((g) => g.name));
        const remaining = GAMES.filter((g) => !matchNames.has(g.name));
        wildcard = remaining[Math.floor(Math.random() * remaining.length)];
      }

      setResults({ matches, wildcard, surprise });
      setVisibleCards(new Set());

      // stagger card reveal
      setTimeout(() => {
        [0, 1, 2, 3].forEach((i) => {
          setTimeout(
            () => setVisibleCards((s) => new Set([...s, i])),
            i * 120,
          );
        });
      }, 50);
    },
    [energy, social, disc],
  );

  const selectDisc = useCallback(
    (v: string | null) => {
      setDisc(v);
      setTimeout(() => {
        goTo("thinking");
        setTimeout(() => {
          computeResults(false);
          setScreenHistory((h) => [...h, "thinking"]);
          setScreen("results");
        }, 900);
      }, 400);
    },
    [goTo, computeResults],
  );

  const surpriseMe = useCallback(() => {
    setEnergy(null);
    setSocial(null);
    setDisc(null);
    goTo("thinking");
    setTimeout(() => {
      computeResults(true);
      setScreenHistory((h) => [...h, "thinking"]);
      setScreen("results");
    }, 900);
  }, [goTo, computeResults]);

  const tryAgain = useCallback(() => {
    setEnergy(null);
    setSocial(null);
    setDisc(null);
    setScreenHistory([]);
    setScreen("q1");
  }, []);

  // ── archipelago data ──

  const gamesByDisc = useMemo(() => {
    const groups: Record<string, Game[]> = {};
    GAMES.forEach((g) => {
      if (!groups[g.disc]) groups[g.disc] = [];
      groups[g.disc].push(g);
    });
    return groups;
  }, []);

  // ── pan/zoom ──

  const applyTransform = useCallback(() => {
    if (!mapRef.current) return;
    const { x, y, scale } = mapState.current;
    mapRef.current.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
  }, []);

  useEffect(() => {
    // center map on mount
    const vw = window.innerWidth;
    mapState.current.x = vw / 2 - 700 * mapState.current.scale;
    mapState.current.y = -50;
    applyTransform();
  }, [applyTransform]);

  useEffect(() => {
    const el = archRef.current;
    if (!el) return;
    const ms = mapState.current;

    // ── mouse / pointer (desktop only) ──────────────────────────
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // handled by touch events
      if ((e.target as HTMLElement).closest(".fchip")) return;
      if ((e.target as HTMLElement).closest(".raft")) return;
      ms.dragging = true;
      ms.startX = e.clientX;
      ms.startY = e.clientY;
      ms.lastX = e.clientX;
      ms.lastY = e.clientY;
      el.classList.add("dragging");
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (!ms.dragging) return;
      ms.x += e.clientX - ms.lastX;
      ms.y += e.clientY - ms.lastY;
      ms.lastX = e.clientX;
      ms.lastY = e.clientY;
      applyTransform();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      ms.dragging = false;
      el.classList.remove("dragging");
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const ns = Math.max(0.3, Math.min(2, ms.scale * delta));
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left,
        my = e.clientY - rect.top;
      ms.x = mx - (mx - ms.x) * (ns / ms.scale);
      ms.y = my - (my - ms.y) * (ns / ms.scale);
      ms.scale = ns;
      applyTransform();
    };

    // ── touch (mobile) ──────────────────────────────────────────
    // unified handler: 1 finger = pan, 2 fingers = pinch-zoom + pan
    const onTouchStart = (e: TouchEvent) => {
      ms.touches = e.touches.length;
      if (e.touches.length === 1) {
        if ((e.target as HTMLElement).closest(".fchip")) return;
        if ((e.target as HTMLElement).closest(".raft")) return;
        ms.dragging = true;
        ms.pinching = false;
        ms.lastX = e.touches[0].clientX;
        ms.lastY = e.touches[0].clientY;
        ms.startX = ms.lastX;
        ms.startY = ms.lastY;
        el.classList.add("dragging");
      } else if (e.touches.length === 2) {
        // transition from pan to pinch — stop pan, start pinch
        ms.dragging = false;
        ms.pinching = true;
        ms.lastDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        ms.lastX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        ms.lastY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // prevent page scroll/bounce

      if (e.touches.length === 1 && ms.dragging) {
        // single-finger pan
        const dx = e.touches[0].clientX - ms.lastX;
        const dy = e.touches[0].clientY - ms.lastY;
        ms.x += dx;
        ms.y += dy;
        ms.lastX = e.touches[0].clientX;
        ms.lastY = e.touches[0].clientY;
        applyTransform();
      } else if (e.touches.length === 2 && ms.pinching) {
        // two-finger pinch-zoom + simultaneous pan
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        // zoom around pinch center
        if (ms.lastDist > 0) {
          const d = dist / ms.lastDist;
          const ns = Math.max(0.3, Math.min(2, ms.scale * d));
          const rect = el.getBoundingClientRect();
          const ox = cx - rect.left;
          const oy = cy - rect.top;
          ms.x = ox - (ox - ms.x) * (ns / ms.scale);
          ms.y = oy - (oy - ms.y) * (ns / ms.scale);
          ms.scale = ns;
        }

        // pan with pinch center movement
        ms.x += cx - ms.lastX;
        ms.y += cy - ms.lastY;

        ms.lastDist = dist;
        ms.lastX = cx;
        ms.lastY = cy;
        applyTransform();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      ms.touches = e.touches.length;
      if (e.touches.length === 0) {
        ms.dragging = false;
        ms.pinching = false;
        ms.lastDist = 0;
        el.classList.remove("dragging");
      } else if (e.touches.length === 1 && ms.pinching) {
        // went from 2 fingers to 1 — resume pan from current finger
        ms.pinching = false;
        ms.dragging = true;
        ms.lastX = e.touches[0].clientX;
        ms.lastY = e.touches[0].clientY;
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [applyTransform]);

  // center on filtered island
  const filterArch = useCallback(
    (id: string | null) => {
      setActiveFilter(id);
      if (id && CLUSTERS[id]) {
        const cl = CLUSTERS[id];
        const vw = window.innerWidth,
          vh = window.innerHeight;
        const ms = mapState.current;
        ms.x = vw / 2 - cl.cx * ms.scale;
        ms.y = vh / 2 - cl.cy * ms.scale;
        applyTransform();
      }
    },
    [applyTransform],
  );

  // ── render helpers ──

  const resultsSub = results?.surprise
    ? "a fresh deal \u2014 no questions asked"
    : [
        energy,
        social,
        disc ? DISC_LABELS[disc] || disc : null,
      ]
        .filter(Boolean)
        .join(" \u00B7 ") || "your perfect match";

  return (
    <>
      {/* water background */}
      <div className="discover-water" />
      <div className="discover-water-shine" />
      {WAVE_LINES.map((w, i) => (
        <div
          key={i}
          className="discover-wave-line"
          style={
            {
              top: w.top,
              "--dur": w.dur,
              animationDelay: w.delay,
              opacity: w.opacity,
            } as React.CSSProperties
          }
        />
      ))}

      <div className="discover-app">
        {/* ═══ SERENDIPITY ═══ */}
        <div
          className={`mode-view serendipity ${mode === "discover" ? "active" : "hidden-left"}`}
        >
          {/* progress dots */}
          <div
            className={`progress-bar ${isQuestionScreen ? "" : "hidden"}`}
          >
            {[0, 1, 2].map((i) => {
              const qIdx = ["q1", "q2", "q3"].indexOf(screen);
              let cls = "pdot";
              if (i < qIdx) cls += " done";
              else if (i === qIdx) cls += " active";
              return <div key={i} className={cls} />;
            })}
          </div>

          {/* back button */}
          <button
            className={`back-nav ${isQuestionScreen ? "" : "hidden"}`}
            onClick={goBack}
          >
            <BackIcon /> back
          </button>

          {/* welcome */}
          <div className={screenClass("welcome")}>
            <div className="welcome-brand">
              {"\u{1F6F6}"} raft.house
            </div>
            <h1 className="welcome-heading">
              what are you in
              <br />
              the mood for?
            </h1>
            <p className="welcome-sub">
              answer 3 quick questions and we&apos;ll find your perfect
              session
            </p>
            <div className="welcome-actions">
              <button
                className="btn btn-primary"
                onClick={() => goTo("q1")}
              >
                let&apos;s go <ArrowIcon />
              </button>
              <button
                className="btn btn-outline"
                onClick={surpriseMe}
              >
                {"\u{1F3B2}"} surprise me
              </button>
            </div>
          </div>

          {/* Q1: energy */}
          <div className={screenClass("q1")}>
            <div className="question-screen">
              <div className="question-label">question 1 of 3</div>
              <h2 className="question-heading">
                how much energy does your group have?
              </h2>
              <div className="option-cards">
                {(
                  [
                    {
                      emoji: "\u{1F30A}",
                      label: "contemplative",
                      desc: "we want to think deeply",
                      value: "contemplative" as Energy,
                    },
                    {
                      emoji: "\u26A1",
                      label: "energized",
                      desc: "we're ready to compete",
                      value: "energized" as Energy,
                    },
                    {
                      emoji: "\u{1F3AD}",
                      label: "playful",
                      desc: "we want to explore and create",
                      value: "playful" as Energy,
                    },
                  ] as const
                ).map((opt) => (
                  <div
                    key={opt.value}
                    className={`option-card ${energy === opt.value ? "selected" : ""}`}
                    onClick={() => selectEnergy(opt.value)}
                  >
                    <div className="option-emoji">{opt.emoji}</div>
                    <div className="option-content">
                      <span className="option-label">
                        {opt.label}
                      </span>
                      <span className="option-desc">{opt.desc}</span>
                    </div>
                    <div className="option-check">
                      <CheckIcon />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Q2: social */}
          <div className={screenClass("q2")}>
            <div className="question-screen">
              <div className="question-label">question 2 of 3</div>
              <h2 className="question-heading">
                how will your group work?
              </h2>
              <div className="option-cards">
                {(
                  [
                    {
                      emoji: "\u{1F464}",
                      label: "solo",
                      desc: "everyone works independently",
                      value: "solo" as Social,
                    },
                    {
                      emoji: "\u{1F91D}",
                      label: "collaborative",
                      desc: "we'll work together",
                      value: "collaborative" as Social,
                    },
                    {
                      emoji: "\u{1F9E9}",
                      label: "asymmetric",
                      desc: "different roles, different info",
                      value: "asymmetric" as Social,
                    },
                  ] as const
                ).map((opt) => (
                  <div
                    key={opt.value}
                    className={`option-card ${social === opt.value ? "selected" : ""}`}
                    onClick={() => selectSocial(opt.value)}
                  >
                    <div className="option-emoji">{opt.emoji}</div>
                    <div className="option-content">
                      <span className="option-label">
                        {opt.label}
                      </span>
                      <span className="option-desc">{opt.desc}</span>
                    </div>
                    <div className="option-check">
                      <CheckIcon />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Q3: discipline */}
          <div className={screenClass("q3")}>
            <div className="question-screen">
              <div className="question-label">question 3 of 3</div>
              <h2 className="question-heading">
                what world do you want to explore?
              </h2>
              <div className="disc-scroll">
                <div className="disc-grid">
                  <div
                    className={`disc-pill disc-pill-anything ${disc === null && screen === "q3" ? "" : ""}`}
                    style={
                      { "--disc-color": "#17858a" } as React.CSSProperties
                    }
                    onClick={() => selectDisc(null)}
                  >
                    <div className="disc-dot" />
                    <span className="disc-name">
                      anything {"\u2726"}
                    </span>
                  </div>
                  {DISC_LIST.map((id) => (
                    <div
                      key={id}
                      className={`disc-pill ${disc === id ? "selected" : ""}`}
                      style={
                        {
                          "--disc-color":
                            DISC_COLORS[id] || "#17858a",
                        } as React.CSSProperties
                      }
                      onClick={() => selectDisc(id)}
                    >
                      <div className="disc-dot" />
                      <span className="disc-name">
                        {DISC_LABELS[id]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* thinking */}
          <div className={screenClass("thinking")}>
            <div className="thinking-screen">
              <div className="thinking-dots">
                <div className="thinking-dot" />
                <div className="thinking-dot" />
                <div className="thinking-dot" />
              </div>
              <div className="thinking-text">
                finding your games...
              </div>
            </div>
          </div>

          {/* results */}
          <div className={screenClass("results")}>
            <div className="results-screen">
              <div className="results-scroll">
                <div className="results-heading">
                  we found your games
                </div>
                <div className="results-sub">{resultsSub}</div>
                <div className="results-section-label">
                  your matches
                </div>
                <div className="game-cards">
                  {results?.matches.map((g, i) => (
                    <GameCard
                      key={g.name}
                      game={g}
                      wildcard={false}
                      visible={visibleCards.has(i)}
                      onOpen={setDetailGame}
                    />
                  ))}
                </div>
                <div className="results-section-label">
                  {"\u{1F3B2}"} wildcard
                </div>
                <div className="game-cards">
                  {results?.wildcard && (
                    <GameCard
                      game={results.wildcard}
                      wildcard
                      visible={visibleCards.has(3)}
                      onOpen={setDetailGame}
                    />
                  )}
                </div>
              </div>
              <div className="results-footer">
                <button
                  className="btn btn-outline try-again-btn"
                  onClick={tryAgain}
                >
                  not feeling it? try again
                </button>
                <button
                  className="random-link"
                  onClick={surpriseMe}
                >
                  deal me a random game
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ ARCHIPELAGO ═══ */}
        <div
          ref={archRef}
          className={`mode-view archipelago ${mode === "browse" ? "active" : "hidden-right"}`}
        >
          {/* filter bar */}
          <div className="arch-filter-bar">
            <button
              className={`fchip ${activeFilter === null ? "active" : ""}`}
              onClick={() => filterArch(null)}
            >
              all
            </button>
            {DISC_LIST.map((id) => (
              <button
                key={id}
                className={`fchip ${activeFilter === id ? "active" : ""}`}
                onClick={() => filterArch(id)}
              >
                {DISC_LABELS[id]}
              </button>
            ))}
          </div>

          {/* map world */}
          <div ref={mapRef} className="map-world">
            {DISC_LIST.map((discId, discIdx) => {
              const games = gamesByDisc[discId];
              if (!games) return null;
              if (activeFilter && discId !== activeFilter) return null;

              const cluster = CLUSTERS[discId];
              const islandSize = cluster.size;
              const blobShape = BLOBS[discIdx % BLOBS.length];
              const n = games.length;
              const angleStart =
                ((discIdx * 137.5 * Math.PI) / 180) %
                (Math.PI * 2);
              const mooringRadius = islandSize / 2 + 40;

              return (
                <div key={discId}>
                  {/* the island */}
                  <div
                    className="map-island"
                    style={{
                      left: cluster.cx - islandSize / 2,
                      top: cluster.cy - islandSize / 2,
                      width: islandSize,
                      height: islandSize,
                    }}
                  >
                    {[0, 1, 2].map((r) => (
                      <div
                        key={r}
                        className="map-island-ripple"
                        style={{ borderRadius: blobShape }}
                      />
                    ))}
                    <div
                      className="map-island-shallows"
                      style={{ borderRadius: blobShape }}
                    />
                    <div
                      className="map-island-shore"
                      style={{ borderRadius: blobShape }}
                    />
                    <div
                      className="map-island-body"
                      style={{
                        borderRadius: blobShape,
                        background: `radial-gradient(ellipse 90% 80% at 38% 32%, ${mixColor(cluster.bg, "#8aad6a", 0.25)} 0%, ${mixColor(cluster.bg, "#5a7a3a", 0.15)} 30%, ${cluster.bg} 60%, ${mixColor(cluster.bg, "#1a2a1e", 0.5)} 100%)`,
                      }}
                    >
                      <div className="map-island-name">
                        {DISC_LABELS[discId]}
                      </div>
                    </div>
                  </div>

                  {/* mooring lines + rafts */}
                  {games.map((game, i) => {
                    const angle =
                      angleStart + (i / n) * Math.PI * 2;
                    const jitter = ((i % 3) - 1) * 12;
                    const rx =
                      cluster.cx +
                      Math.cos(angle) *
                        (mooringRadius + jitter);
                    const ry =
                      cluster.cy +
                      Math.sin(angle) *
                        (mooringRadius + jitter);

                    // mooring line endpoints
                    const x1 =
                      cluster.cx +
                      Math.cos(angle) * (islandSize / 2 - 5);
                    const y1 =
                      cluster.cy +
                      Math.sin(angle) * (islandSize / 2 - 5);
                    const minX = Math.min(x1, rx) - 5;
                    const minY = Math.min(y1, ry) - 5;
                    const maxX = Math.max(x1, rx) + 5;
                    const maxY = Math.max(y1, ry) + 5;
                    const w = maxX - minX;
                    const h = maxY - minY;

                    const mech = game.mechanics;
                    const bobDur = 3.5 + ((i * 7) % 25) / 10;
                    const bobDelay = -((i * 13) % 50) / 10;

                    return (
                      <div key={game.name}>
                        {/* mooring line */}
                        <svg
                          className="mooring-svg"
                          style={{
                            left: minX,
                            top: minY,
                            width: w,
                            height: h,
                          }}
                          viewBox={`0 0 ${w} ${h}`}
                          fill="none"
                        >
                          <line
                            x1={x1 - minX}
                            y1={y1 - minY}
                            x2={rx - minX}
                            y2={ry - minY}
                            stroke="rgba(160,130,80,0.25)"
                            strokeWidth="1.5"
                            strokeDasharray="4 3"
                          />
                        </svg>

                        {/* raft */}
                        <div
                          className="raft"
                          style={{
                            left: rx - 28,
                            top: ry - 19,
                            ["--raft-accent" as string]:
                              cluster.shore,
                            animation: `bob ${bobDur}s ease-in-out ${bobDelay}s infinite`,
                          }}
                          onClick={() =>
                            setDetailGame(game)
                          }
                        >
                          <div className="raft-wake" />
                          <div className="raft-deck">
                            <span className="raft-icon">
                              {game.icon}
                            </span>
                          </div>
                          <div className="raft-label">
                            {game.name}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="compass">N</div>
        </div>
      </div>

      {/* ═══ MODE BAR ═══ */}
      <div className="mode-bar">
        <div className="mode-toggle">
          <button
            className={`mode-tab ${mode === "discover" ? "active" : ""}`}
            onClick={() => setMode("discover")}
          >
            <DiscoverIcon /> discover
          </button>
          <button
            className={`mode-tab ${mode === "browse" ? "active" : ""}`}
            onClick={() => setMode("browse")}
          >
            <GlobeIcon /> explore map
          </button>
          <Link
            href="/join"
            className="mode-tab"
          >
            <JoinIcon /> join session
          </Link>
        </div>
      </div>

      {/* ═══ DETAIL SHEET ═══ */}
      <div
        className={`detail-overlay ${detailGame ? "visible" : ""}`}
      >
        <div
          className="detail-backdrop"
          onClick={() => setDetailGame(null)}
        />
        {detailGame && (
          <div className="detail-sheet">
            <div className="detail-handle" />
            <div className="detail-icon">{detailGame.icon}</div>
            <div className="detail-name">{detailGame.name}</div>
            <div
              className="detail-disc"
              style={{
                color:
                  DISC_COLORS[detailGame.disc] || "#7dd3d8",
              }}
            >
              {DISC_LABELS[detailGame.disc] || detailGame.disc}
            </div>
            <div className="detail-desc">{detailGame.desc}</div>
            <div className="detail-tags">
              <span className="detail-tag">
                {detailGame.energy}
              </span>
              <span className="detail-tag">
                {detailGame.social}
              </span>
              <span
                className="detail-mechanic-tag"
                style={{
                  color: detailGame.mechanics.color,
                  borderColor: detailGame.mechanics.color + "44",
                  background: detailGame.mechanics.color + "18",
                }}
              >
                {detailGame.mechanics.verb}
              </span>
              <span className="detail-tag">{detailGame.mechanics.input}</span>
              <span className="detail-tag">{detailGame.mechanics.temporality}</span>
            </div>
            <div className="detail-mechanics">
              <div className="detail-mech-row">
                <span className="detail-mech-label">agency</span>
                <span className="detail-mech-value">{detailGame.mechanics.agency}</span>
              </div>
              <div className="detail-mech-row">
                <span className="detail-mech-label">loop</span>
                <span className="detail-mech-value">{detailGame.mechanics.coreLoop}</span>
              </div>
            </div>
            {/* ── session config ─────────────────── */}
            <div className="detail-config">
              <div className="detail-config-row">
                <span className="detail-config-label">play mode</span>
                <div className="detail-config-options">
                  <button
                    className={`detail-config-btn${sessionDisplayMode === "screenless" ? " active" : ""}`}
                    onClick={() => setSessionDisplayMode("screenless")}
                  >
                    📱 phones
                  </button>
                  <button
                    className={`detail-config-btn${sessionDisplayMode === "shared-screen" ? " active" : ""}`}
                    onClick={() => setSessionDisplayMode("shared-screen")}
                  >
                    🔥 campfire
                  </button>
                </div>
              </div>
              <div className="detail-config-row">
                <span className="detail-config-label">audience</span>
                <div className="detail-config-options">
                  <button
                    className={`detail-config-btn${sessionAgeLevel === "kids" ? " active" : ""}`}
                    onClick={() => setSessionAgeLevel("kids")}
                  >
                    🌱 kids
                  </button>
                  <button
                    className={`detail-config-btn${sessionAgeLevel === "highschool" ? " active" : ""}`}
                    onClick={() => setSessionAgeLevel("highschool")}
                  >
                    🌿 teens
                  </button>
                  <button
                    className={`detail-config-btn${sessionAgeLevel === "professional" ? " active" : ""}`}
                    onClick={() => setSessionAgeLevel("professional")}
                  >
                    🌳 pro
                  </button>
                </div>
              </div>
            </div>
            <button
              className="detail-play"
              onClick={() => {
                const code = generateRoomCode();
                const factory = GAME_REGISTRY[detailGame.name];
                const activities = factory ? factory() : [];
                sessionStorage.setItem(
                  `raft:${code}`,
                  JSON.stringify({
                    code,
                    activities,
                    sessionName: detailGame.name,
                    template: detailGame.name,
                    ageLevel: sessionAgeLevel,
                    displayMode: sessionDisplayMode,
                    createdAt: Date.now(),
                  }),
                );
                router.push(`/facilitate/live/${code}`);
              }}
            >
              start session <ArrowIcon />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── GameCard component ─────────────────────────────────────────────────────

function GameCard({
  game,
  wildcard,
  visible,
  onOpen,
}: {
  game: Game;
  wildcard: boolean;
  visible: boolean;
  onOpen: (g: Game) => void;
}) {
  const discColor = DISC_COLORS[game.disc] || "#7dd3d8";
  const mech = game.mechanics;

  return (
    <div
      className={`game-card ${wildcard ? "wildcard" : ""} ${visible ? "visible" : ""}`}
      onClick={() => onOpen(game)}
    >
      <div className="game-card-icon">{game.icon}</div>
      <div className="game-card-main">
        <div className="game-card-header">
          <span className="game-name">{game.name}</span>
          {wildcard ? (
            <span
              className="game-badge"
              style={{
                color: "#7dd3d8",
                borderColor: "rgba(125,211,216,0.3)",
                background: "rgba(125,211,216,0.1)",
              }}
            >
              {"\u{1F3B2}"} wildcard
            </span>
          ) : (
            <span
              className="game-badge"
              style={{
                color: discColor,
                borderColor: discColor + "44",
                background: discColor + "18",
              }}
            >
              {DISC_LABELS[game.disc] || game.disc}
            </span>
          )}
          <span
            className="game-mechanic-badge"
            style={{
              color: mech.color,
              borderColor: mech.color + "33",
              background: mech.color + "12",
            }}
          >
            {mech.verb}
          </span>
          <span className="game-mechanic-badge">
            {mech.temporality}
          </span>
        </div>
        <div className="game-desc">{game.desc}</div>
      </div>
      <button
        className="game-play-btn"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(game);
        }}
      >
        <ArrowIcon />
      </button>
    </div>
  );
}
