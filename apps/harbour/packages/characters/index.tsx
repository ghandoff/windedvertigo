import type { ReactNode } from "react";

/**
 * CharacterSlot — inline SVG renderer for the Harbour character cast.
 *
 * Every material in the DB maps to a character host via form_primary
 * (see resolveCharacterFromForm). The cast IS the form taxonomy:
 *   Cord (flexible), Jugs (rigid/hollow), Twig (rigid/linear),
 *   Swatch (flat/soft), Crate (rigid/box), Mud (malleable), Drip (liquid)
 *
 * Characters implemented: cord, jugs, twig, swatch, crate, mud, drip. ALL 7 shipped.
 *
 * Geometry harvested from docs/explorations/{cord,jugs,twig,swatch,crate,mud,drip}-character.html
 * — kid-mode base pose for single-pose characters, and all 4 poses for
 * multi-pose characters (swatch, crate, mud, drip). Fully self-contained
 * — no external refs, no <defs> at document level. Filter IDs are
 * namespaced per character+variant so multiple instances coexist on one page.
 *
 * Set animate={false} when the parent already wobbles (e.g. MaterialPickerHero
 * tiles). Respects prefers-reduced-motion at the CSS level regardless.
 */

export type CharacterName = "cord" | "jugs" | "twig" | "swatch" | "crate" | "mud" | "drip";

export type SwatchPose = "base" | "cover" | "wrap" | "cushion";
export type CratePose = "base" | "contain" | "stack" | "fort";
export type MudPose = "base" | "shape" | "mould" | "stick";
export type DripPose = "base" | "pool" | "pour" | "soak";

export interface CharacterSlotProps {
  character: CharacterName;
  variant?: "kid" | "adult";
  size: number;
  animate?: boolean;
  /**
   * Optional pose name — character-specific. For Swatch:
   * "base" | "cover" | "wrap" | "cushion". Unknown values fall back
   * to the character's base pose. Other characters currently ignore
   * this prop until their pose vocabularies are built.
   */
  pose?: string;
}

/**
 * Resolves a character host from a material's form_primary + title.
 * form_primary takes precedence; title is fallback.
 *
 * Returns null if no keyword matches — caller should NOT fallback to emoji
 * (the cast is designed to cover every material in the DB). A null return
 * means the DB has a form_primary we haven't mapped yet.
 */
export function resolveCharacterFromForm(
  formPrimary: string | null | undefined,
  title: string | null | undefined,
): CharacterName | null {
  const hay = `${formPrimary ?? ""} ${title ?? ""}`.toLowerCase();
  if (!hay.trim()) return null;

  // Order matters — more specific matches first so "cardboard box" hits Crate
  // before Swatch's "cardboard" fallback on thin-sheet cardboard.
  // Crate: rigid boxes + construction modules
  if (/\b(module|construction|crate|carton|block|brick)\b/.test(hay)) return "crate";
  if (hay.includes("box")) return "crate";
  // Cord: flexible linear
  if (/\b(flexible|filament|rope|cord|cable|elastic|ribbon|thread|yarn|band|bungee)\b/.test(hay)) return "cord";
  if (/\blinear\b/.test(hay) && !/\brigid/.test(hay)) return "cord";
  // Twig: rigid linear, "found" objects
  if (/\b(found|evocative|artifact|stick|twig|branch|dowel|chopstick|skewer|pencil)\b/.test(hay)) return "twig";
  // Jugs: rigid hollow, vessels
  if (/\b(vessel|container|cylinder|jug|bottle|tube|cup|jar|pipe)\b/.test(hay)) return "jugs";
  // Drip: liquid
  if (/\b(liquid|water|paint|ink|glue|slime|juice|milk)\b/.test(hay)) return "drip";
  // Mud: malleable + granular
  if (/\b(malleable|volume|substrate|clay|dough|putty|plasticine|mud|silt|sand|granular|foam)\b/.test(hay)) return "mud";
  // Swatch: flat + soft — broad catch for sheets/fabrics/overlays
  if (/\b(sheet|surface|fabric|textile|cloth|scrap|paper|overlay|translucen|cellophane|tissue|foil|sail|shirt|cardboard)\b/.test(hay)) return "swatch";

  return null;
}

const INK = "#241c1e";
const BLUSH = "#e89b8a";

const ROPE = "#d89f3a";
const ROPE_DK = "#6e4a13";
const SAND = "#d9bf8a";
const SAND_DK = "#7d6a45";

const JUG = "#f0ecdf";
const JUG_LT = "#fdf7ec";
const SEAM = "#a89f85";
const REDWOOD = "#b15043";
const WATER = "#7aa9bf";

const BARK = "#8a5a32";
const BARK_LT = "#b78455";
const BARK_DK = "#5a3a1d";
const LEAF = "#8fa67a";

const SWATCH_BODY = "#f1e3c8";   // warm sand, matches paper tone across characters
const SWATCH_FOLD = "#cebb95";   // darker side — the dog-ear underside
const SWATCH_STITCH = "#a89a7a"; // hem stitch
const RUBBER_BAND = "#8b5d3a";   // warm rubber brown for the cover pose band

const KRAFT = "#c49a65";      // cardboard body (front face)
const KRAFT_DK = "#8c6635";   // darker — shadow / right face / interior
const KRAFT_LT = "#deb78a";   // highlight — top face / tape
const CRATE_SEAM = "#6e4e23"; // tape seam ink (not to be confused with jugs SEAM)

// Mud palette — warm earth-browns, matches docs/explorations/mud-character.html.
// MUD_SAND is a slightly cooler sand than the shared SAND constant (which
// tilts yellower); pebbles in the base-pose puddle are tuned to this value
// for visual parity with the tile design.
const MUD = "#a6794a";        // warm mid-brown body
const MUD_DK = "#6e4a20";     // thumbprint depression + under-belly shadow
const MUD_LT = "#c89a6d";     // top highlight crest
const MUD_DEEP = "#4f3414";   // thumbprint inner slot + ground-contact pool + wet pool
const MUD_SAND = "#d9cdb0";   // pebbles on the drier outer rim
const SKY = "#9dbbcf";        // sandcastle flag pennant

// Drip palette — cool blues, complement mud's warm earth tones.
// GLOSS is the character's silhouette-level tell: a white cartoon-water
// highlight that appears on every pose in roughly the same relative
// position. see docs/explorations/drip-character.html for reference.
const DRIP = "#5a9fc4";       // cornflower water blue (body)
const DRIP_LT = "#bde0f0";    // pale cyan (top highlights + bubbles)
const DRIP_DK = "#2b5e80";    // deep water blue (shadows)
const DRIP_DEEP = "#153a52";  // near-navy (deepest shadow + ground-contact)
const GLOSS = "#ffffff";      // the tell

const CORD_ANIMATIONS = `
  .cs-shimmy { animation: cs-shimmy 6s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes cs-shimmy {
    0%, 92%, 100% { transform: rotate(0deg); }
    94% { transform: rotate(-2deg); }
    96% { transform: rotate(3deg); }
    98% { transform: rotate(-1.5deg); }
  }
  .cs-breathe { animation: cs-breathe 4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes cs-breathe {
    0%, 100% { transform: scale(1) rotate(0deg); }
    50%      { transform: scale(1.012) rotate(0.5deg); }
  }
  .cs-blink { animation: cs-blink 5.2s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes cs-blink {
    0%, 96%, 100% { transform: scaleY(1); }
    98% { transform: scaleY(0.1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cs-shimmy, .cs-breathe, .cs-blink { animation: none; }
  }
`;

const JUGS_ANIMATIONS = `
  .cs-heft { animation: cs-heft 9s ease-in-out infinite; transform-origin: 100px 140px; transform-box: view-box; }
  @keyframes cs-heft {
    0%, 85%, 100% { transform: rotate(0deg); }
    88% { transform: rotate(-1.2deg); }
    92% { transform: rotate(1.8deg); }
    96% { transform: rotate(-0.6deg); }
  }
  .cs-settle { animation: cs-settle 5s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes cs-settle {
    0%, 100% { transform: translateY(0) scale(1); }
    50%      { transform: translateY(0.8px) scale(1.004); }
  }
  .cs-slowblink { animation: cs-slowblink 7s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes cs-slowblink {
    0%, 94%, 100% { transform: scaleY(1); }
    97% { transform: scaleY(0.15); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cs-heft, .cs-settle, .cs-slowblink { animation: none; }
  }
`;

const TWIG_ANIMATIONS = `
  .cs-twitch { animation: cs-twitch 7s ease-in-out infinite; transform-origin: 100px 130px; transform-box: view-box; }
  @keyframes cs-twitch {
    0%, 88%, 100% { transform: rotate(0deg); }
    90% { transform: rotate(3deg); }
    92% { transform: rotate(-4deg); }
    94% { transform: rotate(1deg); }
  }
  .cs-tap { animation: cs-tap 5s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes cs-tap {
    0%, 86%, 100% { transform: translate(0, 0); }
    88% { transform: translate(0, -1px); }
    91% { transform: translate(0, 0.5px); }
    94% { transform: translate(0, -0.5px); }
  }
  .cs-quickblink { animation: cs-quickblink 4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes cs-quickblink {
    0%, 92%, 100% { transform: scaleY(1); }
    94% { transform: scaleY(0.1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cs-twitch, .cs-tap, .cs-quickblink { animation: none; }
  }
`;

// Swatch: daydreamer — floats, catches wind, settles gently
const SWATCH_ANIMATIONS = `
  .cs-float { animation: cs-float 5s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes cs-float {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-2.5px); }
  }
  .cs-sway { animation: cs-sway 8s ease-in-out infinite; transform-origin: 100px 150px; transform-box: view-box; }
  @keyframes cs-sway {
    0%, 100% { transform: rotate(0deg); }
    30%      { transform: rotate(1.5deg); }
    70%      { transform: rotate(-1deg); }
  }
  .cs-softblink { animation: cs-softblink 4.5s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes cs-softblink {
    0%, 94%, 100% { transform: scaleY(1); }
    97% { transform: scaleY(0.1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cs-float, .cs-sway, .cs-softblink { animation: none; }
  }
`;

// Crate: builder-organiser — deliberate, step-by-step, satisfying thunks.
// Personality = stillness with brief decisive motion (not continuous like cord/swatch).
const CRATE_ANIMATIONS = `
  .cs-thunk { animation: cs-thunk 6.5s cubic-bezier(0.2, 0.6, 0.3, 1) infinite; transform-origin: center bottom; transform-box: fill-box; }
  @keyframes cs-thunk {
    0%, 86%, 100% { transform: translateY(0); }
    88%  { transform: translateY(-2px); }
    91%  { transform: translateY(1.5px); }
    93%  { transform: translateY(-0.6px); }
    95%  { transform: translateY(0.3px); }
  }
  .cs-crateblink { animation: cs-crateblink 5.5s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes cs-crateblink {
    0%, 93%, 100% { transform: scaleY(1); }
    96% { transform: scaleY(0.1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cs-thunk, .cs-crateblink { animation: none; }
  }
`;

// Mud's personality: stillness is the rule, and even the motion is
// stillness-adjacent. No thunks, no twitches — just a faint, continuous
// shape-memory adjustment (slowshift) + the rare sleepy blink. Slower
// than crate (11s vs 6.5s) because mud takes its time.
const MUD_ANIMATIONS = `
  .cs-slowshift { animation: cs-slowshift 11s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes cs-slowshift {
    0%, 100% { transform: scale(1) rotate(0deg); }
    25%      { transform: scale(1.008, 0.994) rotate(-0.8deg); }
    50%      { transform: scale(0.994, 1.01) rotate(0.5deg); }
    75%      { transform: scale(1.006, 0.996) rotate(-0.3deg); }
  }
  .cs-sleepyblink { animation: cs-sleepyblink 7.5s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes cs-sleepyblink {
    0%, 92%, 100% { transform: scaleY(1); }
    96% { transform: scaleY(0.1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cs-slowshift, .cs-sleepyblink { animation: none; }
  }
`;

// Drip's personality: fluid adaptability. the body undulates gently like
// surface tension settling — faster and wavier than mud's slowshift
// (6s vs 11s), slower than cord's shimmy. Eyes wink (quick scaleY dip)
// rather than blink — drip is awake and observant.
const DRIP_ANIMATIONS = `
  .cs-flow { animation: cs-flow 6s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes cs-flow {
    0%, 100% { transform: scale(1, 1) rotate(0deg); }
    25%      { transform: scale(1.015, 0.985) rotate(-0.4deg); }
    50%      { transform: scale(0.99, 1.015) rotate(0.3deg); }
    75%      { transform: scale(1.005, 0.995) rotate(-0.2deg); }
  }
  .cs-wink { animation: cs-wink 5s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes cs-wink {
    0%, 94%, 100% { transform: scaleY(1); }
    97% { transform: scaleY(0.15); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cs-flow, .cs-wink { animation: none; }
  }
`;

function Splatter() {
  return (
    <g aria-hidden="true">
      <circle cx="14" cy="22" r="1.4" fill={INK} opacity="0.55" />
      <circle cx="24" cy="18" r="0.8" fill={INK} opacity="0.4" />
      <circle cx="180" cy="30" r="1.2" fill={INK} opacity="0.5" />
      <ellipse cx="188" cy="42" rx="0.9" ry="1.4" fill={INK} opacity="0.45" transform="rotate(30 188 42)" />
      <circle cx="10" cy="135" r="1.6" fill={INK} opacity="0.6" />
      <circle cx="22" cy="142" r="0.7" fill={INK} opacity="0.35" />
      <circle cx="170" cy="140" r="1.1" fill={BLUSH} opacity="0.7" />
      <ellipse cx="186" cy="132" rx="1.8" ry="0.7" fill={BLUSH} opacity="0.5" transform="rotate(-20 186 132)" />
      <circle cx="100" cy="8" r="0.8" fill={INK} opacity="0.3" />
      <circle cx="190" cy="90" r="0.6" fill={INK} opacity="0.35" />
    </g>
  );
}

const CORD_ROPE_PATH =
  "M 170 60 Q 175 30 130 30 Q 85 30 85 60 Q 85 90 120 90 Q 145 90 140 68 Q 138 58 120 60";

function CordKid({ filterId, animate }: { filterId: string; animate: boolean }) {
  const shimmy = animate ? "cs-shimmy" : undefined;
  const breathe = animate ? "cs-breathe" : undefined;
  const blink = animate ? "cs-blink" : undefined;

  return (
    <svg viewBox="-20 -20 240 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        <filter id={filterId} x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="9" />
          <feDisplacementMap in="SourceGraphic" scale="2.6" />
        </filter>
      </defs>
      <style>{CORD_ANIMATIONS}</style>
      <Splatter />
      <g className={shimmy}>
        <g className={breathe}>
          <path
            d={CORD_ROPE_PATH}
            fill="none"
            stroke={BLUSH}
            strokeWidth="22"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(4 5)"
          />
          <path
            d={CORD_ROPE_PATH}
            fill="none"
            stroke={INK}
            strokeWidth="26"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${filterId})`}
          />
          <path
            d={CORD_ROPE_PATH}
            fill="none"
            stroke={ROPE}
            strokeWidth="22"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g stroke={ROPE_DK} strokeWidth="1.1" strokeLinecap="round" opacity="0.5">
            <line x1="158.5" y1="45.0" x2="180.2" y2="48.7" />
            <line x1="142.1" y1="40.2" x2="156.6" y2="23.6" />
            <line x1="107.4" y1="42.5" x2="113.2" y2="21.3" />
            <line x1="94.2" y1="55.8" x2="81.4" y2="37.9" />
            <line x1="104.0" y1="78.5" x2="83.5" y2="86.5" />
            <line x1="133.8" y1="74.2" x2="141.2" y2="94.85" />
            <line x1="125.6" y1="68.1" x2="142.4" y2="53.9" />
            <line x1="96.5" y1="67.0" x2="78.5" y2="73.0" />
          </g>
          {/* FRAYED-END TELL — 5 thin strands radiating out of the
              cord's right-side cut end, distinguishing cord at silhouette
              level from a generic closed loop. */}
          <g stroke={ROPE_DK} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.85">
            <path d="M 174 54 Q 180 47 185 42" />
            <path d="M 176 58 Q 184 56 188 54" />
            <path d="M 178 62 Q 186 62 192 62" />
            <path d="M 176 66 Q 184 68 190 72" />
            <path d="M 174 70 Q 180 74 184 80" />
          </g>
          <g className={blink}>
            <circle cx="118" cy="58" r="3.4" fill={INK} />
            <circle cx="133" cy="58" r="3.4" fill={INK} />
            <circle cx="119.2" cy="56.8" r="0.9" fill="var(--wv-cream)" />
            <circle cx="134.2" cy="56.8" r="0.9" fill="var(--wv-cream)" />
          </g>
        </g>
      </g>
    </svg>
  );
}

function CordAdult({ filterId }: { filterId: string }) {
  return (
    <svg viewBox="-20 -20 240 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id={filterId} x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="9" />
          <feDisplacementMap in="SourceGraphic" scale="2.6" />
        </filter>
      </defs>
      <path
        d={CORD_ROPE_PATH}
        fill="none"
        stroke={INK}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={CORD_ROPE_PATH}
        fill="none"
        stroke={SAND}
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g stroke={SAND_DK} strokeWidth="1.6" strokeLinecap="round" opacity="0.8">
        <line x1="158.5" y1="45.0" x2="180.2" y2="48.7" />
        <line x1="142.1" y1="40.2" x2="156.6" y2="23.6" />
        <line x1="107.4" y1="42.5" x2="113.2" y2="21.3" />
        <line x1="94.2" y1="55.8" x2="81.4" y2="37.9" />
        <line x1="104.0" y1="78.5" x2="83.5" y2="86.5" />
        <line x1="133.8" y1="74.2" x2="141.2" y2="94.85" />
      </g>
      {/* frayed-end tell, muted adult palette */}
      <g stroke={SAND_DK} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.75">
        <path d="M 174 54 Q 180 47 185 42" />
        <path d="M 176 58 Q 184 56 188 54" />
        <path d="M 178 62 Q 186 62 192 62" />
        <path d="M 176 66 Q 184 68 190 72" />
        <path d="M 174 70 Q 180 74 184 80" />
      </g>
      <circle cx="119" cy="58" r="2" fill={INK} />
      <circle cx="133" cy="58" r="2" fill={INK} />
    </svg>
  );
}

const JUG_BODY_PATH =
  "M 88 14 L 112 14 L 112 32 Q 116 42 128 48 Q 142 50 142 62 L 142 128 Q 142 140 130 140 L 70 140 Q 58 140 58 128 L 58 62 Q 58 50 72 48 Q 84 42 88 32 Z " +
  "M 118 68 L 130 68 Q 134 68 134 72 L 134 98 Q 134 102 130 102 L 118 102 Q 114 102 114 98 L 114 72 Q 114 68 118 68 Z";

// Cap with CHIPPED-LIP TELL — small V-notch in the upper edge,
// slightly left of centre (x=91..97, depth 5). distinguishes jugs
// at silhouette level from a generic stoppered bottle.
const JUG_CAP_CHIPPED_PATH =
  "M 89 2 L 91 2 L 94 7 L 97 2 L 114 2 Q 117 2 117 5 L 117 10 Q 117 13 114 13 L 89 13 Q 86 13 86 10 L 86 5 Q 86 2 89 2 Z";

function JugsKid({ filterId, animate }: { filterId: string; animate: boolean }) {
  const heft = animate ? "cs-heft" : undefined;
  const settle = animate ? "cs-settle" : undefined;
  const slowblink = animate ? "cs-slowblink" : undefined;

  return (
    <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        <filter id={filterId} x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="11" />
          <feDisplacementMap in="SourceGraphic" scale="2.4" />
        </filter>
      </defs>
      <style>{JUGS_ANIMATIONS}</style>
      <Splatter />
      <g className={heft}>
        <g className={settle}>
          <g transform="translate(4 5)" opacity="0.5" fill={BLUSH}>
            <path fillRule="evenodd" d={JUG_BODY_PATH} />
          </g>
          <path
            fillRule="evenodd"
            d={JUG_BODY_PATH}
            fill={JUG}
            stroke={INK}
            strokeWidth="2.6"
            strokeLinejoin="round"
            filter={`url(#${filterId})`}
          />
          <path d={JUG_CAP_CHIPPED_PATH} fill={REDWOOD} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <line x1="88" y1="8" x2="112" y2="8" stroke={INK} strokeWidth="0.6" opacity="0.5" />
          <line x1="100" y1="52" x2="100" y2="135" stroke={SEAM} strokeWidth="1" strokeDasharray="1 3" opacity="0.5" />
          <ellipse cx="75" cy="70" rx="1.3" ry="1.8" fill={WATER} opacity="0.4" />
          <ellipse cx="80" cy="94" rx="1.1" ry="1.5" fill={WATER} opacity="0.35" />
          <ellipse cx="72" cy="115" rx="1.4" ry="1.9" fill={WATER} opacity="0.4" />
          <ellipse cx="100" cy="120" rx="1.1" ry="1.5" fill={WATER} opacity="0.3" />
          <rect x="70" y="112" width="42" height="14" rx="1.5" fill="none" stroke={INK} strokeWidth="0.9" opacity="0.28" />
          <path
            d="M 66 62 Q 64 92 68 126"
            fill="none"
            stroke={JUG_LT}
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.8"
          />
          <g className={slowblink}>
            <circle cx="86" cy="62" r="3.2" fill={INK} />
            <circle cx="98" cy="62" r="3.2" fill={INK} />
            <circle cx="87.2" cy="60.8" r="0.9" fill="var(--wv-cream)" />
            <circle cx="99.2" cy="60.8" r="0.9" fill="var(--wv-cream)" />
          </g>
        </g>
      </g>
    </svg>
  );
}

function JugsAdult() {
  return (
    <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        fillRule="evenodd"
        d={JUG_BODY_PATH}
        fill={SAND}
        stroke={INK}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d={JUG_CAP_CHIPPED_PATH} fill={SAND_DK} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <line x1="100" y1="52" x2="100" y2="135" stroke={SAND_DK} strokeWidth="1" opacity="0.5" />
      <circle cx="88" cy="62" r="2" fill={INK} />
      <circle cx="98" cy="62" r="2" fill={INK} />
    </svg>
  );
}

const TWIG_SPINE = "M 30 135 Q 80 100 110 82 Q 140 64 170 40";
const TWIG_FORK = "M 110 82 L 116 58";

function TwigKid({ filterId, animate }: { filterId: string; animate: boolean }) {
  const twitch = animate ? "cs-twitch" : undefined;
  const tap = animate ? "cs-tap" : undefined;
  const quickblink = animate ? "cs-quickblink" : undefined;

  return (
    <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        <filter id={filterId} x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="17" />
          <feDisplacementMap in="SourceGraphic" scale="2.6" />
        </filter>
      </defs>
      <style>{TWIG_ANIMATIONS}</style>
      <Splatter />
      <g className={twitch}>
        <g className={tap}>
          <g transform="translate(4 5)" opacity="0.5">
            <path d={TWIG_SPINE} fill="none" stroke={BLUSH} strokeWidth="16" strokeLinecap="round" />
            <path d={TWIG_FORK} fill="none" stroke={BLUSH} strokeWidth="9" strokeLinecap="round" />
          </g>
          <path
            d={TWIG_FORK}
            fill="none"
            stroke={INK}
            strokeWidth="12"
            strokeLinecap="round"
            filter={`url(#${filterId})`}
          />
          <path d={TWIG_FORK} fill="none" stroke={BARK} strokeWidth="8" strokeLinecap="round" />
          <path
            d={TWIG_SPINE}
            fill="none"
            stroke={INK}
            strokeWidth="16"
            strokeLinecap="round"
            filter={`url(#${filterId})`}
          />
          <path d={TWIG_SPINE} fill="none" stroke={BARK} strokeWidth="12" strokeLinecap="round" />
          <path
            d="M 34 130 Q 80 96 108 80 Q 138 62 166 42"
            fill="none"
            stroke={BARK_LT}
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.65"
          />
          <circle cx="70" cy="113" r="2.3" fill={BARK_DK} opacity="0.85" />
          <circle cx="140" cy="66" r="2" fill={BARK_DK} opacity="0.85" />
          <circle cx="115" cy="66" r="1.6" fill={BARK_DK} opacity="0.7" />
          <ellipse
            cx="172"
            cy="36"
            rx="5"
            ry="3"
            fill={LEAF}
            stroke={INK}
            strokeWidth="1.5"
            transform="rotate(-30 172 36)"
          />
          <g className={quickblink}>
            <circle cx="126" cy="70" r="3" fill={INK} />
            <circle cx="136" cy="62" r="3" fill={INK} />
            <circle cx="127" cy="69" r="0.8" fill="var(--wv-cream)" />
            <circle cx="137" cy="61" r="0.8" fill="var(--wv-cream)" />
          </g>
        </g>
      </g>
    </svg>
  );
}

function TwigAdult({ filterId }: { filterId: string }) {
  return (
    <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id={filterId} x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="17" />
          <feDisplacementMap in="SourceGraphic" scale="2.6" />
        </filter>
      </defs>
      <path d={TWIG_FORK} fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d={TWIG_FORK} fill="none" stroke={SAND_DK} strokeWidth="6" strokeLinecap="round" />
      <path d={TWIG_SPINE} fill="none" stroke={INK} strokeWidth="13" strokeLinecap="round" />
      <path d={TWIG_SPINE} fill="none" stroke={SAND_DK} strokeWidth="9" strokeLinecap="round" />
      <circle cx="126" cy="70" r="2" fill={INK} />
      <circle cx="136" cy="62" r="2" fill={INK} />
    </svg>
  );
}

// Swatch — flat/soft daydreamer. Silhouette: a wavy rectangular sheet
// with a visible diagonal crease (brand tell: Crease-works) and a dog-ear
// fold at the top-right corner. Eyes on the upper-center, drifting slightly.
// ─────────────────────────────────────────────────────────────────────
// Swatch path constants — four function poses.
// Base: rectangular sheet with dog-ear peeled toward viewer.
// Cover: hourglass drape over coffee can, cinched by a rubber band.
// Wrap: cloth wrapped around a bowling pin (pin visible through cloth).
// Cushion: rolled bolster — spiral cross-section left, closed outer right.
// ─────────────────────────────────────────────────────────────────────

const SWATCH_BASE_PATH =
  "M 42 38 Q 100 30 135 36 L 158 58 L 158 130 Q 100 143 48 132 L 42 38 Z";
const SWATCH_DOGEAR_PATH = "M 135 36 L 158 58 L 144 54 Z";

const SWATCH_COVER_PATH =
  "M 22 118 Q 32 106 44 102 Q 56 96 62 90 Q 52 84 54 78 Q 58 72 62 66 L 138 66 Q 142 72 146 78 Q 148 84 138 90 Q 144 96 156 102 Q 168 106 178 118 Q 168 120 152 118 Q 140 116 132 120 Q 120 122 108 120 Q 96 118 84 122 Q 72 120 60 122 Q 48 118 36 122 Q 28 120 22 118 Z";
const SWATCH_CAN_BODY_PATH = "M 60 92 Q 100 95 140 92 L 140 142 Q 100 146 60 142 Z";
const SWATCH_CAN_LABEL_PATH = "M 62 108 Q 100 110 138 108 L 138 126 Q 100 128 62 126 Z";

const SWATCH_WRAP_PATH =
  "M 96 28 Q 113 28 114 36 Q 114 48 111 56 Q 104 62 104 66 Q 104 70 112 76 Q 128 92 128 116 Q 128 136 112 146 L 88 146 Q 72 136 72 116 Q 72 92 88 76 Q 96 70 96 66 Q 96 62 89 56 Q 86 48 86 36 Q 87 28 96 28 Z";
const SWATCH_PIN_PATH =
  "M 100 24 Q 109 24 109 34 Q 109 46 107 52 Q 100 58 100 62 Q 100 66 106 72 Q 122 88 122 112 Q 122 130 110 140 L 90 140 Q 78 130 78 112 Q 78 88 94 72 Q 100 66 100 62 Q 100 58 93 52 Q 91 46 91 34 Q 91 24 100 24 Z";

const SWATCH_CUSHION_PATH =
  "M 36 70 L 164 70 Q 176 70 176 95 Q 176 120 164 120 L 36 120 Q 24 120 24 95 Q 24 70 36 70 Z";

// Pose sub-components — extracted at module level so they aren't
// re-created on each render (avoids the rerender-no-inline-components
// anti-pattern). Each returns a fragment of SVG elements that drop
// inside SwatchKid's motion wrappers.

function SwatchBasePose({ filterId, softblink }: { filterId: string; softblink?: string }) {
  return (
    <>
      <g transform="translate(4 5)" opacity="0.5">
        <path d={SWATCH_BASE_PATH} fill={BLUSH} />
      </g>
      <path
        d={SWATCH_BASE_PATH}
        fill={SWATCH_BODY}
        stroke={INK}
        strokeWidth="2.6"
        strokeLinejoin="round"
        filter={`url(#${filterId})`}
      />
      <path d={SWATCH_DOGEAR_PATH} fill={SWATCH_FOLD} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M 120 42 Q 95 80 62 125" fill="none" stroke={BARK_DK} strokeWidth="1.3" strokeLinecap="round" opacity="0.45" />
      <path d="M 70 50 Q 82 85 98 122" fill="none" stroke={BARK_DK} strokeWidth="0.9" strokeLinecap="round" opacity="0.22" />
      <g stroke={SWATCH_STITCH} strokeWidth="0.8" strokeLinecap="round" opacity="0.55">
        <line x1="56" y1="136" x2="60" y2="136" />
        <line x1="70" y1="138" x2="74" y2="138" />
        <line x1="86" y1="139" x2="90" y2="139" />
        <line x1="102" y1="140" x2="106" y2="140" />
        <line x1="118" y1="139" x2="122" y2="139" />
        <line x1="134" y1="138" x2="138" y2="138" />
        <line x1="148" y1="136" x2="152" y2="136" />
      </g>
      <g className={softblink}>
        <circle cx="88" cy="72" r="3.2" fill={INK} />
        <circle cx="102" cy="72" r="3.2" fill={INK} />
        <circle cx="89.2" cy="70.8" r="0.9" fill="var(--wv-cream)" />
        <circle cx="103.2" cy="70.8" r="0.9" fill="var(--wv-cream)" />
      </g>
    </>
  );
}

function SwatchCoverPose({ filterId, softblink }: { filterId: string; softblink?: string }) {
  return (
    <>
      {/* coffee can (bg) */}
      <path d={SWATCH_CAN_BODY_PATH} fill={SAND} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <path d={SWATCH_CAN_LABEL_PATH} fill={SWATCH_FOLD} opacity="0.55" />
      <path d="M 60 108 Q 100 110 140 108" fill="none" stroke={INK} strokeWidth="0.8" opacity="0.5" />
      <path d="M 60 126 Q 100 128 140 126" fill="none" stroke={INK} strokeWidth="0.8" opacity="0.5" />
      <ellipse cx="100" cy="150" rx="38" ry="2.8" fill={INK} opacity="0.18" />

      {/* blush halo + cloth drape */}
      <g transform="translate(4 5)" opacity="0.5">
        <path d={SWATCH_COVER_PATH} fill={BLUSH} />
      </g>
      <path
        d={SWATCH_COVER_PATH}
        fill={SWATCH_BODY}
        stroke={INK}
        strokeWidth="2.4"
        strokeLinejoin="round"
        filter={`url(#${filterId})`}
      />

      {/* rim ellipse showing through + radial tension creases + brand crease */}
      <ellipse cx="100" cy="66" rx="40" ry="3.5" fill="none" stroke={BARK_DK} strokeWidth="0.9" strokeLinecap="round" opacity="0.45" />
      <g stroke={BARK_DK} strokeWidth="0.9" strokeLinecap="round" opacity="0.35" fill="none">
        <path d="M 68 72 L 60 92" />
        <path d="M 82 70 L 74 94" />
        <path d="M 100 70 L 100 94" />
        <path d="M 118 70 L 126 94" />
        <path d="M 132 72 L 140 92" />
      </g>
      <path d="M 52 94 Q 78 82 112 88" fill="none" stroke={BARK_DK} strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />

      {/* rubber band pinching cloth against the can */}
      <path d="M 62 86 Q 80 82 100 84 Q 120 86 138 84" fill="none" stroke={BARK_DK} strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
      <rect x="62" y="87.75" width="76" height="4.5" rx="2.25" ry="2.25" fill={RUBBER_BAND} stroke={INK} strokeWidth="1.4" />
      <path d="M 70 88.75 L 130 88.75" fill="none" stroke={SWATCH_BODY} strokeWidth="0.6" strokeLinecap="round" opacity="0.6" />
      <g stroke={INK} strokeWidth="0.5" strokeLinecap="round" opacity="0.55">
        <line x1="70" y1="88.25" x2="70" y2="91.75" />
        <line x1="82" y1="88.25" x2="82" y2="91.75" />
        <line x1="100" y1="88.25" x2="100" y2="91.75" />
        <line x1="118" y1="88.25" x2="118" y2="91.75" />
        <line x1="130" y1="88.25" x2="130" y2="91.75" />
      </g>
      <path d="M 62 96 Q 80 100 100 98 Q 120 96 138 100" fill="none" stroke={BARK_DK} strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />

      {/* eyes peeking over the rim */}
      <g className={softblink}>
        <circle cx="90" cy="78" r="3" fill={INK} />
        <circle cx="110" cy="78" r="3" fill={INK} />
        <circle cx="91" cy="77" r="0.8" fill="var(--wv-cream)" />
        <circle cx="111" cy="77" r="0.8" fill="var(--wv-cream)" />
      </g>
    </>
  );
}

function SwatchWrapPose({ filterId, softblink }: { filterId: string; softblink?: string }) {
  return (
    <>
      {/* bowling pin silhouette showing through the cloth */}
      <path
        d={SWATCH_PIN_PATH}
        fill={SAND}
        stroke={BARK_DK}
        strokeWidth="0.9"
        strokeDasharray="2 3"
        strokeLinejoin="round"
        opacity="0.5"
      />

      {/* blush halo + cloth wrap */}
      <g transform="translate(4 5)" opacity="0.45">
        <path d={SWATCH_WRAP_PATH} fill={BLUSH} />
      </g>
      <path
        d={SWATCH_WRAP_PATH}
        fill={SWATCH_BODY}
        stroke={INK}
        strokeWidth="2.4"
        strokeLinejoin="round"
        filter={`url(#${filterId})`}
      />

      {/* tension cinches at the neck */}
      <g stroke={BARK_DK} strokeWidth="1.1" strokeLinecap="round" opacity="0.55" fill="none">
        <path d="M 84 58 Q 100 64 116 58" />
        <path d="M 86 62 Q 100 68 114 62" />
      </g>

      {/* overlap seam */}
      <path
        d="M 109 34 Q 114 60 118 100 Q 122 130 112 140"
        fill="none"
        stroke={BARK_DK}
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="3 2"
        opacity="0.45"
      />

      {/* top tuck at the tied crown */}
      <path d="M 104 28 L 109 24 L 109 32 Z" fill={SWATCH_FOLD} stroke={INK} strokeWidth="1.2" />

      {/* eyes on the body bulge */}
      <g className={softblink}>
        <circle cx="92" cy="104" r="3" fill={INK} />
        <circle cx="108" cy="104" r="3" fill={INK} />
        <circle cx="93" cy="103" r="0.8" fill="var(--wv-cream)" />
        <circle cx="109" cy="103" r="0.8" fill="var(--wv-cream)" />
      </g>
    </>
  );
}

function SwatchCushionPose({ filterId, softblink }: { filterId: string; softblink?: string }) {
  return (
    <>
      {/* blush halo + bolster body */}
      <g transform="translate(4 5)" opacity="0.5">
        <path d={SWATCH_CUSHION_PATH} fill={BLUSH} />
      </g>
      <path
        d={SWATCH_CUSHION_PATH}
        fill={SWATCH_BODY}
        stroke={INK}
        strokeWidth="2.6"
        strokeLinejoin="round"
        filter={`url(#${filterId})`}
      />

      {/* length-wise soft crease */}
      <path d="M 40 95 Q 100 98 160 95" fill="none" stroke={BARK_DK} strokeWidth="1" strokeLinecap="round" opacity="0.3" />

      {/* LEFT end — spiral cross-section showing rolled layers */}
      <ellipse cx="36" cy="95" rx="12" ry="25" fill={SWATCH_FOLD} stroke={INK} strokeWidth="1.4" />
      <ellipse cx="37" cy="95" rx="8" ry="18" fill="none" stroke={INK} strokeWidth="1.4" opacity="0.85" />
      <ellipse cx="38" cy="95" rx="5" ry="11" fill="none" stroke={INK} strokeWidth="1.4" opacity="0.7" />
      <ellipse cx="38" cy="95" rx="2" ry="5" fill="none" stroke={INK} strokeWidth="1.4" opacity="0.55" />

      {/* RIGHT end — body's rounded corner IS the closed outer face;
          just a small finishing-edge tuck where the roll ended */}
      <path d="M 160 76 Q 168 82 166 92" fill="none" stroke={BARK_DK} strokeWidth="1" strokeLinecap="round" opacity="0.55" />

      {/* top cloth edge where the roll finishes */}
      <path d="M 60 68 Q 80 64 100 66 Q 120 68 140 66" fill="none" stroke={BARK_DK} strokeWidth="0.9" strokeLinecap="round" opacity="0.4" />

      {/* z's — soft sleeping cue */}
      <g fill={BARK_DK} opacity="0.4" fontFamily="Fraunces, serif" fontWeight="700" fontStyle="italic">
        <text x="40" y="58" fontSize="10">z</text>
        <text x="52" y="48" fontSize="13">z</text>
        <text x="66" y="40" fontSize="8">z</text>
      </g>

      {/* sleepy eyes */}
      <g className={softblink}>
        <circle cx="92" cy="90" r="3" fill={INK} />
        <circle cx="108" cy="90" r="3" fill={INK} />
        <circle cx="93" cy="89" r="0.8" fill="var(--wv-cream)" />
        <circle cx="109" cy="89" r="0.8" fill="var(--wv-cream)" />
      </g>
    </>
  );
}

function SwatchKid({ filterId, animate, pose }: { filterId: string; animate: boolean; pose?: string }) {
  const sway = animate ? "cs-sway" : undefined;
  const float = animate ? "cs-float" : undefined;
  const softblink = animate ? "cs-softblink" : undefined;
  const normalizedPose: SwatchPose =
    pose === "cover" || pose === "wrap" || pose === "cushion" ? pose : "base";

  return (
    <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        <filter id={filterId} x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="22" />
          <feDisplacementMap in="SourceGraphic" scale="2.4" />
        </filter>
      </defs>
      <style>{SWATCH_ANIMATIONS}</style>
      <Splatter />
      <g className={sway}>
        <g className={float}>
          {normalizedPose === "base" && <SwatchBasePose filterId={filterId} softblink={softblink} />}
          {normalizedPose === "cover" && <SwatchCoverPose filterId={filterId} softblink={softblink} />}
          {normalizedPose === "wrap" && <SwatchWrapPose filterId={filterId} softblink={softblink} />}
          {normalizedPose === "cushion" && <SwatchCushionPose filterId={filterId} softblink={softblink} />}
        </g>
      </g>
    </svg>
  );
}

function SwatchAdult() {
  return (
    <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d={SWATCH_DOGEAR_PATH} fill={SAND_DK} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" opacity="0.7" />
      <path d={SWATCH_BASE_PATH} fill={SAND} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M 120 42 Q 95 80 62 125" fill="none" stroke={SAND_DK} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <circle cx="89" cy="72" r="2" fill={INK} />
      <circle cx="101" cy="72" r="2" fill={INK} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Crate path constants — four function poses.
// Base: closed 3D cardboard box with dented top-left corner.
// Contain: portrait box, open top, shoe + mug overflowing.
// Stack: two crates stacked (combined outline traces top crate's FRONT-left edge at x=68).
// Fort: 3D box with arched doorway cut into the front face.
// ─────────────────────────────────────────────────────────────────────

const CRATE_BASE_PATH =
  "M 44 60 L 58 50 L 174 50 L 174 130 L 160 140 L 30 140 L 30 72 Q 42 66 44 60 Z";
const CRATE_CONTAIN_PATH =
  "M 60 50 L 70 43 L 150 43 L 150 143 L 140 150 L 60 150 Z";
const CRATE_FORT_PATH =
  "M 30 50 L 44 40 L 184 40 L 184 132 L 170 142 L 30 142 Z";

// Pose sub-components extracted at module level (avoids re-creating
// component identities per render, matches the Swatch pattern).

function CrateBasePose({ filterId, crateblink }: { filterId: string; crateblink?: string }) {
  return (
    <>
      <g transform="translate(4 5)" opacity="0.5">
        <path d={CRATE_BASE_PATH} fill={BLUSH} />
      </g>
      <path d="M 44 60 L 58 50 L 174 50 L 160 60 Z" fill={KRAFT_LT} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" filter={`url(#${filterId})`} />
      <line x1="102" y1="60" x2="116" y2="50" stroke={CRATE_SEAM} strokeWidth="0.9" opacity="0.55" />
      <path d="M 160 60 L 174 50 L 174 130 L 160 140 Z" fill={KRAFT_DK} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" filter={`url(#${filterId})`} />
      <path d={CRATE_BASE_PATH} fill={KRAFT} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" filter={`url(#${filterId})`} />
      <path d="M 33 70 Q 40 66 43 62" fill="none" stroke={KRAFT_DK} strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
      <path d="M 95 60 L 109 50 L 117 50 L 103 60 Z" fill={KRAFT_LT} opacity="0.4" />
      <rect x="95" y="60" width="8" height="80" fill={KRAFT_LT} opacity="0.75" />
      <line x1="95" y1="60" x2="95" y2="140" stroke={CRATE_SEAM} strokeWidth="0.8" opacity="0.6" />
      <line x1="103" y1="60" x2="103" y2="140" stroke={CRATE_SEAM} strokeWidth="0.8" opacity="0.6" />
      <g stroke={KRAFT_DK} strokeWidth="0.5" opacity="0.2">
        <line x1="50" y1="70" x2="50" y2="138" />
        <line x1="65" y1="70" x2="65" y2="138" />
        <line x1="80" y1="70" x2="80" y2="138" />
        <line x1="120" y1="70" x2="120" y2="138" />
        <line x1="135" y1="70" x2="135" y2="138" />
        <line x1="150" y1="70" x2="150" y2="138" />
      </g>
      <g transform="translate(50 100) rotate(-6)">
        <rect x="0" y="0" width="28" height="22" rx="2" fill="none" stroke={REDWOOD} strokeWidth="1.4" opacity="0.75" />
        <path d="M 14 4 L 14 18 M 9 9 L 14 4 L 19 9" fill="none" stroke={REDWOOD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
      </g>
      <g className={crateblink}>
        <circle cx="125" cy="98" r="3.2" fill={INK} />
        <circle cx="145" cy="98" r="3.2" fill={INK} />
        <circle cx="126.2" cy="96.8" r="0.9" fill="var(--wv-cream)" />
        <circle cx="146.2" cy="96.8" r="0.9" fill="var(--wv-cream)" />
      </g>
    </>
  );
}

function CrateContainPose({ filterId, crateblink }: { filterId: string; crateblink?: string }) {
  return (
    <>
      <g transform="translate(4 5)" opacity="0.5">
        <path d={CRATE_CONTAIN_PATH} fill={BLUSH} />
      </g>
      {/* BACK INTERIOR WALL — extended to y=50 to re-paint over silhouette's kraft at the top-face area, revealing the opening */}
      <rect x="70" y="16" width="80" height="34" fill={KRAFT_DK} opacity="0.88" />
      <line x1="70" y1="43" x2="150" y2="43" stroke={INK} strokeWidth="1.4" opacity="0.9" />
      <path d="M 60 50 L 70 43 L 70 50 Z" fill={KRAFT_LT} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M 140 50 L 150 43 L 150 50 Z" fill={KRAFT_LT} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      {/* SHOE */}
      <g>
        <path d="M 64 50 L 100 50 L 100 42 Q 96 34 89 32 L 77 32 Q 72 32 70 38 L 68 42 L 66 46 L 64 48 L 64 50 Z" fill={SAND} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
        <rect x="62" y="48" width="40" height="3" fill={INK} opacity="0.55" />
        <line x1="75" y1="36" x2="87" y2="42" stroke={INK} strokeWidth="0.8" opacity="0.7" />
        <line x1="75" y1="42" x2="87" y2="36" stroke={INK} strokeWidth="0.8" opacity="0.7" />
      </g>
      {/* MUG */}
      <g>
        <path d="M 106 18 L 134 18 L 135 50 L 105 50 Z" fill={KRAFT_LT} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
        <ellipse cx="120" cy="18" rx="14" ry="2.5" fill={KRAFT_DK} stroke={INK} strokeWidth="1.5" />
        <path d="M 134 24 Q 146 26 146 32 Q 146 38 134 40" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      {/* FRONT FACE */}
      <path d="M 60 50 L 140 50 L 140 150 L 60 150 Z" fill={KRAFT} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" filter={`url(#${filterId})`} />
      {/* RIGHT SIDE FACE */}
      <path d="M 140 50 L 150 43 L 150 143 L 140 150 Z" fill={KRAFT_DK} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="96" y="50" width="8" height="100" fill={KRAFT_LT} opacity="0.7" />
      <line x1="96" y1="50" x2="96" y2="150" stroke={CRATE_SEAM} strokeWidth="0.8" opacity="0.6" />
      <line x1="104" y1="50" x2="104" y2="150" stroke={CRATE_SEAM} strokeWidth="0.8" opacity="0.6" />
      <g transform="translate(68 96) rotate(-6)">
        <rect x="0" y="0" width="20" height="14" rx="2" fill="none" stroke={REDWOOD} strokeWidth="1.1" opacity="0.7" />
        <path d="M 10 3 L 10 11 M 6 7 L 10 3 L 14 7" fill="none" stroke={REDWOOD} strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
      </g>
      <g className={crateblink}>
        <circle cx="92" cy="125" r="3.2" fill={INK} />
        <circle cx="108" cy="125" r="3.2" fill={INK} />
        <circle cx="93.2" cy="123.8" r="0.9" fill="var(--wv-cream)" />
        <circle cx="109.2" cy="123.8" r="0.9" fill="var(--wv-cream)" />
      </g>
    </>
  );
}

function CrateStackPose({ filterId, crateblink }: { filterId: string; crateblink?: string }) {
  return (
    <>
      {/* BOTTOM CRATE */}
      <g transform="translate(4 5)" opacity="0.5">
        <path d="M 30 80 L 44 70 L 184 70 L 184 132 L 170 142 L 30 142 Z" fill={BLUSH} />
      </g>
      <path d="M 30 80 L 44 70 L 184 70 L 170 80 Z" fill={KRAFT_LT} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" filter={`url(#${filterId})`} />
      <line x1="102" y1="80" x2="116" y2="70" stroke={CRATE_SEAM} strokeWidth="0.9" opacity="0.55" />
      <path d="M 170 80 L 184 70 L 184 132 L 170 142 Z" fill={KRAFT_DK} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" filter={`url(#${filterId})`} />
      <path d="M 30 80 L 170 80 L 170 142 L 30 142 Z" fill={KRAFT} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" filter={`url(#${filterId})`} />
      <rect x="95" y="80" width="8" height="62" fill={KRAFT_LT} opacity="0.7" />
      <line x1="95" y1="80" x2="95" y2="142" stroke={CRATE_SEAM} strokeWidth="0.8" opacity="0.6" />
      <line x1="103" y1="80" x2="103" y2="142" stroke={CRATE_SEAM} strokeWidth="0.8" opacity="0.6" />
      <g stroke={KRAFT_DK} strokeWidth="0.5" opacity="0.2">
        <line x1="50" y1="90" x2="50" y2="138" />
        <line x1="65" y1="90" x2="65" y2="138" />
        <line x1="80" y1="90" x2="80" y2="138" />
        <line x1="120" y1="90" x2="120" y2="138" />
        <line x1="135" y1="90" x2="135" y2="138" />
        <line x1="150" y1="90" x2="150" y2="138" />
      </g>
      <g transform="translate(46 106) rotate(-6)">
        <rect x="0" y="0" width="24" height="18" rx="2" fill="none" stroke={REDWOOD} strokeWidth="1.2" opacity="0.7" />
        <path d="M 12 3 L 12 15 M 8 7 L 12 3 L 16 7" fill="none" stroke={REDWOOD} strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      </g>
      {/* TOP CRATE */}
      <g transform="translate(4 5)" opacity="0.45">
        <path d="M 68 40 L 78 32 L 146 32 L 146 70 L 132 78 L 68 78 Z" fill={BLUSH} />
      </g>
      <path d="M 68 40 L 78 32 L 146 32 L 132 40 Z" fill={KRAFT_LT} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="98" y1="40" x2="108" y2="32" stroke={CRATE_SEAM} strokeWidth="0.7" opacity="0.55" />
      <path d="M 132 40 L 146 32 L 146 70 L 132 78 Z" fill={KRAFT_DK} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 68 40 L 132 40 L 132 78 L 68 78 Z" fill={KRAFT} stroke={INK} strokeWidth="2" strokeLinejoin="round" filter={`url(#${filterId})`} />
      <rect x="96" y="40" width="8" height="38" fill={KRAFT_LT} opacity="0.65" />
      <line x1="96" y1="40" x2="96" y2="78" stroke={CRATE_SEAM} strokeWidth="0.7" opacity="0.55" />
      <line x1="104" y1="40" x2="104" y2="78" stroke={CRATE_SEAM} strokeWidth="0.7" opacity="0.55" />
      <g className={crateblink}>
        <circle cx="125" cy="115" r="3.2" fill={INK} />
        <circle cx="145" cy="115" r="3.2" fill={INK} />
        <circle cx="126.2" cy="113.8" r="0.9" fill="var(--wv-cream)" />
        <circle cx="146.2" cy="113.8" r="0.9" fill="var(--wv-cream)" />
      </g>
    </>
  );
}

function CrateFortPose({ filterId, crateblink }: { filterId: string; crateblink?: string }) {
  return (
    <>
      <g transform="translate(4 5)" opacity="0.5">
        <path d={CRATE_FORT_PATH} fill={BLUSH} />
      </g>
      <path d="M 30 50 L 44 40 L 184 40 L 170 50 Z" fill={KRAFT_LT} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" filter={`url(#${filterId})`} />
      <line x1="102" y1="50" x2="116" y2="40" stroke={CRATE_SEAM} strokeWidth="0.9" opacity="0.55" />
      <path d="M 170 50 L 184 40 L 184 132 L 170 142 Z" fill={KRAFT_DK} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" filter={`url(#${filterId})`} />
      {/* front face with arched doorway cutout (fill-rule evenodd) */}
      <path fillRule="evenodd" d="M 30 50 L 170 50 L 170 142 L 30 142 Z M 85 142 L 85 108 Q 85 90 100 90 Q 115 90 115 108 L 115 142 Z" fill={KRAFT} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" filter={`url(#${filterId})`} />
      <path d="M 85 142 L 85 108 Q 85 90 100 90 Q 115 90 115 108 L 115 142 Z" fill={KRAFT_DK} opacity="0.85" />
      <line x1="85" y1="140" x2="115" y2="140" stroke={INK} strokeWidth="0.6" opacity="0.4" />
      <g stroke={KRAFT_DK} strokeWidth="0.5" opacity="0.2">
        <line x1="50" y1="60" x2="50" y2="138" />
        <line x1="65" y1="60" x2="65" y2="138" />
        <line x1="135" y1="60" x2="135" y2="138" />
        <line x1="150" y1="60" x2="150" y2="138" />
      </g>
      {/* flag */}
      <line x1="160" y1="44" x2="160" y2="20" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 160 20 L 176 26 L 160 32 Z" fill={REDWOOD} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <g transform="translate(40 104) rotate(-6)">
        <rect x="0" y="0" width="22" height="16" rx="2" fill="none" stroke={REDWOOD} strokeWidth="1.1" opacity="0.7" />
        <path d="M 11 3 L 11 13 M 7 7 L 11 3 L 15 7" fill="none" stroke={REDWOOD} strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
      </g>
      <g className={crateblink}>
        <circle cx="132" cy="78" r="3.2" fill={INK} />
        <circle cx="152" cy="78" r="3.2" fill={INK} />
        <circle cx="133.2" cy="76.8" r="0.9" fill="var(--wv-cream)" />
        <circle cx="153.2" cy="76.8" r="0.9" fill="var(--wv-cream)" />
      </g>
    </>
  );
}

function CrateKid({ filterId, animate, pose }: { filterId: string; animate: boolean; pose?: string }) {
  const thunk = animate ? "cs-thunk" : undefined;
  const crateblink = animate ? "cs-crateblink" : undefined;
  const normalizedPose: CratePose =
    pose === "contain" || pose === "stack" || pose === "fort" ? pose : "base";

  return (
    <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        <filter id={filterId} x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="31" />
          <feDisplacementMap in="SourceGraphic" scale="2" />
        </filter>
      </defs>
      <style>{CRATE_ANIMATIONS}</style>
      <Splatter />
      <g className={thunk}>
        {normalizedPose === "base" && <CrateBasePose filterId={filterId} crateblink={crateblink} />}
        {normalizedPose === "contain" && <CrateContainPose filterId={filterId} crateblink={crateblink} />}
        {normalizedPose === "stack" && <CrateStackPose filterId={filterId} crateblink={crateblink} />}
        {normalizedPose === "fort" && <CrateFortPose filterId={filterId} crateblink={crateblink} />}
      </g>
    </svg>
  );
}

function CrateAdult() {
  return (
    <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M 44 60 L 58 50 L 174 50 L 160 60 Z" fill={SAND} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M 160 60 L 174 50 L 174 130 L 160 140 Z" fill={SAND_DK} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" opacity="0.75" />
      <path d={CRATE_BASE_PATH} fill={SAND} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <line x1="99" y1="60" x2="99" y2="140" stroke={SAND_DK} strokeWidth="0.9" opacity="0.55" />
      <circle cx="125" cy="98" r="2" fill={INK} />
      <circle cx="145" cy="98" r="2" fill={INK} />
    </svg>
  );
}

// ── Mud ─────────────────────────────────────────────────────────────
// Four poses: base (puddle), shape (pinched rabbit), mould (sandcastle),
// stick (marshmallow-straw bridge). Geometry harvested from
// docs/explorations/mud-character.html.

// Shared sleepy-eye primitive — Q-curve lid over a small filled dot.
// Mud's signature "contemplative, not asleep" eyes. width param lets
// individual poses tune the lid span (shape uses 8, others use 10).
function SleepyEye({ cx, cy, width = 10 }: { cx: number; cy: number; width?: number }) {
  const hw = width / 2;
  return (
    <>
      <path
        d={`M ${cx - hw} ${cy} Q ${cx} ${cy - 2} ${cx + hw} ${cy}`}
        fill="none"
        stroke={INK}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy + 1} r="1.3" fill={INK} />
    </>
  );
}

// Shared thumbprint-tell primitive — 3-layer composition: outer --mud-dk
// oval, inner --mud-deep slot, and a --mud-lt rim path on the lower edge
// for the "pressed by a thumb" shadow. The small variant is ~75% scale
// and is used on the stick pose (smaller body blob).
function MudThumbprint({ cx, cy, small = false }: { cx: number; cy: number; small?: boolean }) {
  const rx = small ? 5 : 6.5;
  const ry = small ? 3.3 : 4.2;
  const innerRx = small ? 2.5 : 3.5;
  const innerRy = small ? 1.7 : 2.2;
  const rimOffset = small ? 2 : 3;
  const rimHalfW = small ? 4 : 5;
  const rimLift = small ? 2 : 2;
  const rimStroke = small ? 0.6 : 0.7;
  const rot = `rotate(-12 ${cx} ${cy})`;
  const rimY = cy + rimOffset;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={MUD_DK} opacity="0.7" transform={rot} />
      <ellipse cx={cx} cy={cy} rx={innerRx} ry={innerRy} fill={MUD_DEEP} opacity="0.75" transform={rot} />
      <path
        d={`M ${cx - rimHalfW} ${rimY} Q ${cx} ${rimY + rimLift} ${cx + rimHalfW} ${rimY}`}
        fill="none"
        stroke={MUD_LT}
        strokeWidth={rimStroke}
        strokeLinecap="round"
        opacity="0.6"
      />
    </g>
  );
}

const MUD_PUDDLE_PATH =
  "M 22 112 Q 12 124 16 136 Q 22 150 42 151 Q 86 153 122 151 Q 162 148 180 138 Q 192 126 184 112 Q 168 102 140 104 Q 100 98 62 104 Q 32 102 22 112 Z";

const MUD_RABBIT_PATH =
  "M 30 144 Q 18 128 24 108 Q 30 90 42 84 Q 28 80 22 72 Q 26 64 42 62 Q 38 52 42 44 Q 46 26 54 22 Q 60 28 58 44 Q 62 50 66 52 Q 68 34 74 24 Q 82 22 84 42 Q 86 54 92 62 Q 140 56 176 72 Q 190 82 192 108 Q 194 128 188 138 Q 182 144 160 145 Q 100 147 50 145 Q 34 144 30 144 Z";

const MUD_MOULD_BASE_PATH =
  "M 28 140 Q 18 130 26 122 Q 54 116 100 118 Q 146 116 174 122 Q 182 130 172 140 Q 140 144 100 144 Q 60 144 28 140 Z";

// Combined castle silhouette path (puddle base + 3 towers) for the
// blush misregister halo on the mould pose — matches the tile's halo
// which covers the whole composition, not just the puddle.
const MUD_MOULD_HALO_PATH =
  "M 28 140 Q 18 130 26 122 Q 40 120 42 118 L 42 96 Q 42 90 48 90 L 74 90 Q 80 90 80 96 L 80 118 Q 82 118 84 118 L 84 70 Q 84 64 90 64 L 110 64 Q 116 64 116 70 L 116 118 Q 118 118 120 118 L 120 96 Q 120 90 126 90 L 152 90 Q 158 90 158 96 L 158 118 Q 160 120 174 122 Q 182 130 172 140 Q 140 144 100 144 Q 60 144 28 140 Z";

const MUD_MOULD_LEFT_TURRET =
  "M 42 120 Q 40 118 42 114 L 42 96 Q 40 90 46 90 L 76 90 Q 82 90 80 96 L 80 114 Q 82 118 78 120 Z";
const MUD_MOULD_CENTRAL_TOWER =
  "M 82 120 Q 80 118 82 114 L 82 70 Q 80 64 86 64 L 114 64 Q 120 64 118 70 L 118 114 Q 120 118 116 120 Z";
const MUD_MOULD_RIGHT_TURRET =
  "M 122 120 Q 120 118 122 114 L 122 96 Q 120 90 126 90 L 156 90 Q 162 90 160 96 L 160 114 Q 162 118 158 120 Z";

const MUD_STICK_BODY_PATH =
  "M 78 78 Q 70 84 76 92 Q 88 98 106 96 Q 124 94 126 86 Q 124 76 110 74 Q 90 72 78 78 Z";

function MudBasePose({ filterId, sleepyblink }: { filterId: string; sleepyblink?: string }) {
  return (
    <>
      {/* 6 grass tufts peeking over the back edges */}
      <g stroke={LEAF} strokeWidth="1.4" strokeLinecap="round" fill="none">
        <path d="M 12 108 Q 10 100 12 92" />
        <path d="M 18 106 Q 20 98 16 92" />
        <path d="M 24 108 Q 22 100 26 94" />
        <path d="M 176 104 Q 174 96 176 90" />
        <path d="M 182 104 Q 184 96 180 90" />
        <path d="M 188 106 Q 186 98 192 92" />
      </g>
      {/* blush misregister halo */}
      <g transform="translate(4 5)" opacity="0.5">
        <path d={MUD_PUDDLE_PATH} fill={BLUSH} />
      </g>
      {/* puddle outer silhouette */}
      <path d={MUD_PUDDLE_PATH} fill={MUD} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" filter={`url(#${filterId})`} />
      {/* wet inner pool — darker reflective centre */}
      <path
        d="M 42 124 Q 34 134 48 140 Q 84 144 118 142 Q 148 142 160 134 Q 160 124 142 120 Q 100 116 70 120 Q 46 120 42 124 Z"
        fill={MUD_DEEP}
        opacity="0.85"
      />
      {/* 3 thin reflections — light bouncing off the pool surface */}
      <ellipse cx="70" cy="128" rx="10" ry="1.2" fill={MUD_LT} opacity="0.55" />
      <ellipse cx="118" cy="132" rx="8" ry="1" fill={MUD_LT} opacity="0.45" />
      <ellipse cx="94" cy="136" rx="6" ry="0.8" fill={MUD_LT} opacity="0.4" />
      {/* 5 sand pebbles scattered on the drier outer rim */}
      <ellipse cx="36" cy="126" rx="3.5" ry="2.3" fill={MUD_SAND} stroke={INK} strokeWidth="0.8" />
      <ellipse cx="56" cy="112" rx="3" ry="2" fill={MUD_SAND} stroke={INK} strokeWidth="0.7" />
      <ellipse cx="166" cy="120" rx="4" ry="2.5" fill={MUD_SAND} stroke={INK} strokeWidth="0.8" />
      <ellipse cx="148" cy="110" rx="2.5" ry="1.7" fill={MUD_SAND} stroke={INK} strokeWidth="0.6" />
      <ellipse cx="96" cy="110" rx="2.2" ry="1.5" fill={MUD_SAND} stroke={INK} strokeWidth="0.6" />
      {/* thumbprint on the drier upper-left rim */}
      <MudThumbprint cx={72} cy={108} />
      {/* sleepy eyes on the upper-right rim — peering out of the puddle */}
      <g className={sleepyblink}>
        <SleepyEye cx={115} cy={108} />
        <SleepyEye cx={135} cy={108} />
      </g>
    </>
  );
}

function MudShapePose({ filterId, sleepyblink }: { filterId: string; sleepyblink?: string }) {
  return (
    <>
      {/* blush halo — single rabbit path */}
      <g transform="translate(4 5)" opacity="0.5">
        <path d={MUD_RABBIT_PATH} fill={BLUSH} />
      </g>
      {/* ground-contact pool */}
      <ellipse cx="102" cy="146" rx="80" ry="4" fill={MUD_DEEP} opacity="0.28" />
      {/* pinched-and-pulled rabbit — single continuous outline */}
      <path d={MUD_RABBIT_PATH} fill={MUD} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" filter={`url(#${filterId})`} />
      {/* inner-ear shading nested inside each pulled peak */}
      <ellipse cx="54" cy="34" rx="2.4" ry="8" fill={MUD_DK} opacity="0.55" transform="rotate(-8 54 34)" />
      <ellipse cx="76" cy="34" rx="2.4" ry="8" fill={MUD_DK} opacity="0.55" transform="rotate(6 76 34)" />
      {/* back highlight — light on the arched top */}
      <path d="M 100 68 Q 140 64 176 78" fill="none" stroke={MUD_LT} strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      {/* head highlight — small glint between the ears */}
      <path d="M 46 50 Q 58 46 72 52" fill="none" stroke={MUD_LT} strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
      {/* under-belly shadow */}
      <path d="M 50 144 Q 110 147 170 144" fill="none" stroke={MUD_DK} strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      {/* tiny nose dot at the pulled-out tip of the face */}
      <circle cx="26" cy="72" r="1.6" fill={MUD_DEEP} />
      {/* thumbprint on the body flank */}
      <MudThumbprint cx={120} cy={108} />
      {/* sleepy eyes on the face — narrower (width 8) because face is small */}
      <g className={sleepyblink}>
        <SleepyEye cx={38} cy={58} width={8} />
        <SleepyEye cx={52} cy={56} width={8} />
      </g>
    </>
  );
}

function MudMouldPose({ filterId, sleepyblink }: { filterId: string; sleepyblink?: string }) {
  return (
    <>
      {/* ground-contact pool (tighter than other poses — castle is centred) */}
      <ellipse cx="100" cy="142" rx="76" ry="4" fill={MUD_DEEP} opacity="0.28" />
      {/* blush halo of the whole castle silhouette */}
      <g transform="translate(4 5)" opacity="0.5">
        <path d={MUD_MOULD_HALO_PATH} fill={BLUSH} />
      </g>
      {/* puddle base — remaining mud below the castle */}
      <path d={MUD_MOULD_BASE_PATH} fill={MUD} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" filter={`url(#${filterId})`} />
      {/* LEFT BATTLEMENT */}
      <path d={MUD_MOULD_LEFT_TURRET} fill={MUD} stroke={INK} strokeWidth="2" strokeLinejoin="round" filter={`url(#${filterId})`} />
      {/* CENTRAL TOWER */}
      <path d={MUD_MOULD_CENTRAL_TOWER} fill={MUD} stroke={INK} strokeWidth="2" strokeLinejoin="round" filter={`url(#${filterId})`} />
      {/* RIGHT BATTLEMENT */}
      <path d={MUD_MOULD_RIGHT_TURRET} fill={MUD} stroke={INK} strokeWidth="2" strokeLinejoin="round" filter={`url(#${filterId})`} />
      {/* block highlights — soft upper-left shine arc on each */}
      <path d="M 48 94 Q 58 92 70 94" fill="none" stroke={MUD_LT} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M 88 68 Q 100 66 112 68" fill="none" stroke={MUD_LT} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M 128 94 Q 140 92 152 94" fill="none" stroke={MUD_LT} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      {/* 6 press lines — faint vertical creases showing each block was moulded */}
      <g stroke={MUD_DK} strokeWidth="0.6" opacity="0.35">
        <line x1="48" y1="98" x2="48" y2="114" />
        <line x1="74" y1="98" x2="74" y2="114" />
        <line x1="88" y1="72" x2="88" y2="114" />
        <line x1="112" y1="72" x2="112" y2="114" />
        <line x1="128" y1="98" x2="128" y2="114" />
        <line x1="154" y1="98" x2="154" y2="114" />
      </g>
      {/* flag atop the central tower */}
      <line x1="100" y1="64" x2="100" y2="42" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M 100 42 L 118 48 L 100 54 Z" fill={SKY} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      {/* thumbprint on the puddle apron */}
      <MudThumbprint cx={50} cy={132} />
      {/* sleepy eyes on central tower face */}
      <g className={sleepyblink}>
        <SleepyEye cx={94} cy={96} />
        <SleepyEye cx={108} cy={96} />
      </g>
    </>
  );
}

function MudStickPose({ filterId, sleepyblink }: { filterId: string; sleepyblink?: string }) {
  return (
    <>
      {/* 2 ground-contact pools, one under each truss */}
      <ellipse cx="40" cy="140" rx="30" ry="3.5" fill={MUD_DEEP} opacity="0.25" />
      <ellipse cx="160" cy="140" rx="30" ry="3.5" fill={MUD_DEEP} opacity="0.25" />
      {/* sticks — each drawn as 2 strokes: outer dark contour (10px) + inner
          sand fill (6px), so they read as "sticks with a dark outline" */}
      <g strokeLinecap="round">
        {/* LEFT TRUSS (A-frame): base + 2 slopes */}
        <line x1="20" y1="130" x2="60" y2="130" stroke={MUD_DEEP} strokeWidth="10" />
        <line x1="20" y1="130" x2="60" y2="130" stroke={SAND_DK} strokeWidth="6" />
        <line x1="20" y1="130" x2="40" y2="90" stroke={MUD_DEEP} strokeWidth="10" />
        <line x1="20" y1="130" x2="40" y2="90" stroke={SAND_DK} strokeWidth="6" />
        <line x1="60" y1="130" x2="40" y2="90" stroke={MUD_DEEP} strokeWidth="10" />
        <line x1="60" y1="130" x2="40" y2="90" stroke={SAND_DK} strokeWidth="6" />
        {/* RIGHT TRUSS: base + 2 slopes */}
        <line x1="140" y1="130" x2="180" y2="130" stroke={MUD_DEEP} strokeWidth="10" />
        <line x1="140" y1="130" x2="180" y2="130" stroke={SAND_DK} strokeWidth="6" />
        <line x1="140" y1="130" x2="160" y2="90" stroke={MUD_DEEP} strokeWidth="10" />
        <line x1="140" y1="130" x2="160" y2="90" stroke={SAND_DK} strokeWidth="6" />
        <line x1="180" y1="130" x2="160" y2="90" stroke={MUD_DEEP} strokeWidth="10" />
        <line x1="180" y1="130" x2="160" y2="90" stroke={SAND_DK} strokeWidth="6" />
        {/* DECK — horizontal stick spanning the two truss apexes */}
        <line x1="30" y1="90" x2="170" y2="90" stroke={MUD_DEEP} strokeWidth="10" />
        <line x1="30" y1="90" x2="170" y2="90" stroke={SAND_DK} strokeWidth="6" />
      </g>
      {/* 6 mud-blob joints — the "glue" where sticks meet */}
      <g fill={MUD} stroke={INK} strokeLinejoin="round">
        <path strokeWidth="1.3" d="M 14 126 Q 12 132 18 134 Q 26 134 26 128 Q 24 122 18 122 Q 14 124 14 126 Z" />
        <path strokeWidth="1.3" d="M 54 126 Q 52 132 58 134 Q 66 134 66 128 Q 64 122 60 122 Q 54 124 54 126 Z" />
        <path strokeWidth="1.5" d="M 30 84 Q 26 92 32 96 Q 42 98 48 94 Q 52 88 48 84 Q 44 80 40 82 Q 34 80 30 84 Z" />
        <path strokeWidth="1.5" d="M 152 84 Q 148 92 154 96 Q 164 98 170 94 Q 174 88 170 84 Q 166 80 162 82 Q 156 80 152 84 Z" />
        <path strokeWidth="1.3" d="M 134 126 Q 132 132 138 134 Q 146 134 146 128 Q 144 122 138 122 Q 134 124 134 126 Z" />
        <path strokeWidth="1.3" d="M 174 126 Q 172 132 178 134 Q 186 134 186 128 Q 184 122 180 122 Q 174 124 174 126 Z" />
      </g>
      {/* main central mud — character's body gripping the deck */}
      <g transform="translate(4 5)" opacity="0.45">
        <path d={MUD_STICK_BODY_PATH} fill={BLUSH} />
      </g>
      <path d={MUD_STICK_BODY_PATH} fill={MUD} stroke={INK} strokeWidth="2" strokeLinejoin="round" filter={`url(#${filterId})`} />
      {/* small drip hanging off the main mud — shows it's sticky */}
      <path d="M 90 94 Q 88 100 92 104 Q 96 100 94 94" fill={MUD} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      {/* highlight arc on the top of the main blob */}
      <path d="M 84 78 Q 100 76 118 80" fill="none" stroke={MUD_LT} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      {/* thumbprint — smaller because the blob is smaller */}
      <MudThumbprint cx={86} cy={82} small />
      {/* sleepy eyes on main mud, right-of-centre */}
      <g className={sleepyblink}>
        <SleepyEye cx={109} cy={86} />
        <SleepyEye cx={122} cy={86} />
      </g>
    </>
  );
}

function MudKid({ filterId, animate, pose }: { filterId: string; animate: boolean; pose?: string }) {
  const slowshift = animate ? "cs-slowshift" : undefined;
  const sleepyblink = animate ? "cs-sleepyblink" : undefined;
  const normalizedPose: MudPose =
    pose === "shape" || pose === "mould" || pose === "stick" ? pose : "base";

  return (
    <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        <filter id={filterId} x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="44" />
          <feDisplacementMap in="SourceGraphic" scale="2.2" />
        </filter>
      </defs>
      <style>{MUD_ANIMATIONS}</style>
      <Splatter />
      <g className={slowshift}>
        {normalizedPose === "base" && <MudBasePose filterId={filterId} sleepyblink={sleepyblink} />}
        {normalizedPose === "shape" && <MudShapePose filterId={filterId} sleepyblink={sleepyblink} />}
        {normalizedPose === "mould" && <MudMouldPose filterId={filterId} sleepyblink={sleepyblink} />}
        {normalizedPose === "stick" && <MudStickPose filterId={filterId} sleepyblink={sleepyblink} />}
      </g>
    </svg>
  );
}

function MudAdult() {
  return (
    <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* ground shadow */}
      <ellipse cx="100" cy="140" rx="62" ry="3" fill={SAND_DK} opacity="0.25" />
      {/* body — same amorphous low-blob silhouette, muted sand palette */}
      <path
        d="M 40 108 Q 32 90 46 76 Q 62 58 88 56 Q 116 52 140 64 Q 162 74 164 94 Q 166 114 152 124 Q 130 138 100 140 Q 70 142 52 132 Q 40 124 40 108 Z"
        fill={SAND}
        stroke={INK}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* subtle thumbprint — tell still present, muted */}
      <ellipse cx="82" cy="86" rx="5" ry="3" fill={SAND_DK} opacity="0.55" transform="rotate(-12 82 86)" />
      {/* eyes fully open as dots — adult reads as "focused", not "dreaming" */}
      <circle cx="116" cy="100" r="2" fill={INK} />
      <circle cx="138" cy="100" r="2" fill={INK} />
    </svg>
  );
}

// ── Drip ────────────────────────────────────────────────────────────
// Four poses: base (single teardrop), pool (spread flat), pour (flowing
// stream into catch-pool), soak (watercolour bleed stain on a porous
// sponge substrate). Geometry from docs/explorations/drip-character.html.
// The GLOSS tell (white cartoon-water crescent) appears in every pose as
// the silhouette-level character signature — always in the upper-left
// body area, scaled and oriented to the pose's specific shape.

const DRIP_BASE_PATH =
  "M 100 30 Q 86 55 80 95 Q 76 130 100 140 Q 124 130 120 95 Q 114 55 100 30 Z";
const DRIP_POOL_PATH =
  "M 30 102 Q 20 116 26 128 Q 36 138 60 140 Q 100 142 140 140 Q 164 138 174 128 Q 180 116 170 102 Q 148 96 120 100 Q 100 92 80 100 Q 52 96 30 102 Z";
const DRIP_POUR_PATH =
  "M 92 18 Q 88 50 90 80 Q 88 100 84 116 Q 76 128 46 136 Q 28 140 28 146 Q 28 152 52 152 Q 100 154 148 152 Q 172 152 172 146 Q 172 140 154 136 Q 124 128 116 116 Q 112 100 110 80 Q 112 50 108 18 Q 100 16 92 18 Z";
// Soak uses a two-layer bloom: outer feathered (drip-lt, no stroke) sits
// under the inner saturated bloom (drip + ink stroke). Both share the
// same centre — the offset gives the watercolour "wet halo" read.
const DRIP_SOAK_OUTER_BLOOM_PATH =
  "M 100 48 Q 138 54 146 78 Q 152 102 130 114 Q 108 122 84 118 Q 56 110 54 84 Q 52 62 72 52 Q 86 48 100 48 Z";
const DRIP_SOAK_INNER_BLOOM_PATH =
  "M 100 58 Q 128 64 132 80 Q 136 98 118 106 Q 100 112 86 108 Q 72 102 70 86 Q 70 72 84 64 Q 92 58 100 58 Z";

// Drip's round eye with cream catchlight — same primitive as cord/jugs/
// twig/swatch/crate, not sleepy like mud. kept inline rather than a
// helper because the exact cream offset (cx+1.2, cy-1.2) is the shared
// pattern across all non-mud characters.
function DripEyes({ coords, blink }: { coords: [number, number][]; blink?: string }) {
  return (
    <g className={blink}>
      {coords.map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="3.2" fill={INK} />
          <circle cx={cx + 1.2} cy={cy - 1.2} r="0.9" fill="var(--wv-cream)" />
        </g>
      ))}
    </g>
  );
}

function DripBasePose({ filterId, wink }: { filterId: string; wink?: string }) {
  return (
    <>
      {/* ground-contact pool (small — drop barely touches down) */}
      <ellipse cx="100" cy="146" rx="26" ry="2.5" fill={DRIP_DEEP} opacity="0.28" />
      {/* blush halo */}
      <g transform="translate(4 5)" opacity="0.5">
        <path d={DRIP_BASE_PATH} fill={BLUSH} />
      </g>
      {/* teardrop body */}
      <path d={DRIP_BASE_PATH} fill={DRIP} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" filter={`url(#${filterId})`} />
      {/* inner shadow on lower-right curve — volume suggestion */}
      <path d="M 108 92 Q 118 110 114 130 Q 108 136 100 136" fill="none" stroke={DRIP_DK} strokeWidth="3" strokeLinecap="round" opacity="0.45" />
      {/* top-edge highlight following the narrow neck */}
      <path d="M 96 40 Q 90 58 87 76" fill="none" stroke={DRIP_LT} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* GLOSS TELL — white crescent on upper-left body */}
      <ellipse cx="84" cy="80" rx="4" ry="14" fill={GLOSS} opacity="0.78" transform="rotate(-14 84 80)" />
      {/* secondary sparkle below main gloss */}
      <ellipse cx="88" cy="106" rx="2" ry="5" fill={GLOSS} opacity="0.55" transform="rotate(-10 88 106)" />
      {/* eyes on round bottom */}
      <DripEyes coords={[[93, 108], [107, 108]]} blink={wink} />
      {/* tiny smile */}
      <path d="M 94 120 Q 100 124 106 120" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
}

function DripPoolPose({ filterId, wink }: { filterId: string; wink?: string }) {
  return (
    <>
      {/* ground-contact pool (wide — puddle sits heavy) */}
      <ellipse cx="100" cy="150" rx="78" ry="3" fill={DRIP_DEEP} opacity="0.28" />
      {/* blush halo */}
      <g transform="translate(4 5)" opacity="0.5">
        <path d={DRIP_POOL_PATH} fill={BLUSH} />
      </g>
      {/* puddle body */}
      <path d={DRIP_POOL_PATH} fill={DRIP} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" filter={`url(#${filterId})`} />
      {/* wet inner pool — darker reflective centre */}
      <path d="M 46 118 Q 40 128 54 134 Q 90 138 126 136 Q 152 134 160 126 Q 160 118 142 116 Q 100 112 72 116 Q 50 116 46 118 Z" fill={DRIP_DK} opacity="0.4" />
      {/* GLOSS TELL — horizontal crescents on upper surface */}
      <ellipse cx="78" cy="108" rx="18" ry="1.8" fill={GLOSS} opacity="0.78" />
      <ellipse cx="128" cy="110" rx="10" ry="1.4" fill={GLOSS} opacity="0.65" />
      {/* thin reflection lines across the pool */}
      <ellipse cx="100" cy="124" rx="40" ry="0.9" fill={DRIP_LT} opacity="0.55" />
      <ellipse cx="100" cy="132" rx="26" ry="0.7" fill={DRIP_LT} opacity="0.45" />
      {/* 4 satellite droplets floating around the pool */}
      <path d="M 16 92 Q 12 98 15 102 Q 20 100 19 96 Q 18 92 16 92 Z" fill={DRIP} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      <path d="M 184 86 Q 180 92 183 96 Q 188 94 187 90 Q 186 86 184 86 Z" fill={DRIP} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      <path d="M 48 80 Q 44 88 48 92 Q 54 90 52 84 Q 50 80 48 80 Z" fill={DRIP} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      <path d="M 160 72 Q 156 80 160 84 Q 166 82 164 76 Q 162 72 160 72 Z" fill={DRIP} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      {/* eyes peering up through the surface */}
      <DripEyes coords={[[88, 122], [104, 122]]} blink={wink} />
      {/* content smile */}
      <path d="M 88 132 Q 96 136 104 132" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
}

function DripPourPose({ filterId, wink }: { filterId: string; wink?: string }) {
  return (
    <>
      {/* ground-contact pool */}
      <ellipse cx="100" cy="158" rx="70" ry="2.5" fill={DRIP_DEEP} opacity="0.28" />
      {/* blush halo */}
      <g transform="translate(4 5)" opacity="0.5">
        <path d={DRIP_POUR_PATH} fill={BLUSH} />
      </g>
      {/* pour body — column descending into catch-pool */}
      <path d={DRIP_POUR_PATH} fill={DRIP} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" filter={`url(#${filterId})`} />
      {/* stream interior shadow on right side */}
      <path d="M 106 28 Q 108 70 104 112" fill="none" stroke={DRIP_DK} strokeWidth="3" strokeLinecap="round" opacity="0.45" />
      {/* GLOSS TELL — vertical sliver down the stream's front */}
      <path d="M 98 24 Q 96 60 97 100" fill="none" stroke={GLOSS} strokeWidth="2.5" strokeLinecap="round" opacity="0.78" />
      {/* secondary sparkles on the pool */}
      <ellipse cx="74" cy="142" rx="14" ry="1.6" fill={GLOSS} opacity="0.7" />
      <ellipse cx="126" cy="144" rx="10" ry="1.3" fill={GLOSS} opacity="0.6" />
      {/* bubbles rising in the stream */}
      <circle cx="94" cy="66" r="2" fill={DRIP_LT} stroke={INK} strokeWidth="0.7" opacity="0.85" />
      <circle cx="102" cy="48" r="1.4" fill={DRIP_LT} stroke={INK} strokeWidth="0.6" opacity="0.8" />
      <circle cx="100" cy="92" r="1.6" fill={DRIP_LT} stroke={INK} strokeWidth="0.7" opacity="0.85" />
      {/* ripples where stream hits pool */}
      <ellipse cx="100" cy="120" rx="18" ry="1.2" fill={DRIP_LT} opacity="0.55" />
      <ellipse cx="100" cy="126" rx="26" ry="1" fill={DRIP_LT} opacity="0.4" />
      {/* secondary drop about to fall from the faucet (above frame) */}
      <path d="M 100 6 Q 96 12 98 18 Q 102 18 102 12 Q 101 6 100 6 Z" fill={DRIP} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      {/* eyes in the pool — body's "soul" lives there */}
      <g className={wink}>
        <circle cx="70" cy="144" r="3" fill={INK} />
        <circle cx="71" cy="143" r="0.8" fill="var(--wv-cream)" />
        <circle cx="130" cy="144" r="3" fill={INK} />
        <circle cx="131" cy="143" r="0.8" fill="var(--wv-cream)" />
      </g>
    </>
  );
}

function DripSoakPose({ filterId, wink }: { filterId: string; wink?: string }) {
  return (
    <>
      {/* SPONGE SUBSTRATE — warm cream rounded rectangle, the porous
          material doing the absorbing. y=45 (not 40) so the sponge
          center aligns with the bleed halo centre and drip's eye-line
          — halo reads as centred within the sponge's top/bottom. */}
      <rect x="20" y="45" width="160" height="80" rx="10" fill="#f4e0b4"
            stroke={INK} strokeWidth="1.4" strokeLinejoin="round" filter={`url(#${filterId})`} />
      {/* sponge pore holes scattered across the dry substrate */}
      <g fill={SAND_DK} opacity="0.35">
        <circle cx="38" cy="63" r="2.5" />
        <circle cx="52" cy="77" r="3.5" />
        <circle cx="72" cy="60" r="2" />
        <circle cx="162" cy="67" r="2.6" />
        <circle cx="158" cy="105" r="3" />
        <circle cx="42" cy="110" r="2.4" />
        <circle cx="148" cy="55" r="2" />
        <circle cx="172" cy="93" r="1.8" />
      </g>
      {/* spatter dots — stray bleed landed on dry sponge edges */}
      <circle cx="44" cy="97" r="1.6" fill={DRIP} opacity="0.6" />
      <circle cx="156" cy="75" r="1.8" fill={DRIP} opacity="0.55" />
      <circle cx="158" cy="115" r="1.3" fill={DRIP} opacity="0.5" />
      <circle cx="48" cy="65" r="1.2" fill={DRIP} opacity="0.55" />
      {/* blush misregister halo around the outer bloom */}
      <g transform="translate(4 5)" opacity="0.5">
        <path d={DRIP_SOAK_OUTER_BLOOM_PATH} fill={BLUSH} />
      </g>
      {/* outer feathered bloom — drip-lt, softens the stain's edge */}
      <path d={DRIP_SOAK_OUTER_BLOOM_PATH} fill={DRIP_LT} opacity="0.65" />
      {/* inner saturated bloom — the main character body, ink-wobbled */}
      <path d={DRIP_SOAK_INNER_BLOOM_PATH} fill={DRIP} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" filter={`url(#${filterId})`} />
      {/* wet-area darker pore holes — drip-deep visible through the
          saturated centre (where paper is most wetted) */}
      <circle cx="88" cy="78" r="2" fill={DRIP_DEEP} opacity="0.6" />
      <circle cx="114" cy="88" r="2.4" fill={DRIP_DEEP} opacity="0.6" />
      <circle cx="102" cy="72" r="1.6" fill={DRIP_DEEP} opacity="0.55" />
      {/* GLOSS TELL — small crescent on the upper-left of the wet zone */}
      <ellipse cx="86" cy="72" rx="4" ry="2" fill={GLOSS} opacity="0.55" transform="rotate(-12 86 72)" />
      {/* eyes — centred in the saturated bloom */}
      <DripEyes coords={[[92, 88], [108, 88]]} blink={wink} />
    </>
  );
}

function DripKid({ filterId, animate, pose }: { filterId: string; animate: boolean; pose?: string }) {
  const flow = animate ? "cs-flow" : undefined;
  const wink = animate ? "cs-wink" : undefined;
  const normalizedPose: DripPose =
    pose === "pool" || pose === "pour" || pose === "soak" ? pose : "base";

  return (
    <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        <filter id={filterId} x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="77" />
          <feDisplacementMap in="SourceGraphic" scale="2" />
        </filter>
      </defs>
      <style>{DRIP_ANIMATIONS}</style>
      <Splatter />
      <g className={flow}>
        {normalizedPose === "base" && <DripBasePose filterId={filterId} wink={wink} />}
        {normalizedPose === "pool" && <DripPoolPose filterId={filterId} wink={wink} />}
        {normalizedPose === "pour" && <DripPourPose filterId={filterId} wink={wink} />}
        {normalizedPose === "soak" && <DripSoakPose filterId={filterId} wink={wink} />}
      </g>
    </svg>
  );
}

function DripAdult() {
  return (
    <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* ground shadow */}
      <ellipse cx="100" cy="144" rx="32" ry="2.5" fill={SAND_DK} opacity="0.25" />
      {/* flat teardrop body — muted sand palette */}
      <path
        d="M 100 36 Q 88 58 82 96 Q 78 128 100 136 Q 122 128 118 96 Q 112 58 100 36 Z"
        fill={SAND}
        stroke={INK}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* muted gloss tell — present but quiet in adult register */}
      <ellipse cx="86" cy="84" rx="2.5" ry="10" fill="var(--wv-cream)" opacity="0.55" transform="rotate(-14 86 84)" />
      {/* open eyes, no catchlights (focused, not sparkly) */}
      <circle cx="93" cy="108" r="2" fill={INK} />
      <circle cx="107" cy="108" r="2" fill={INK} />
    </svg>
  );
}

const ARIA_LABELS: Record<CharacterName, string> = {
  cord: "a rope character named cord",
  jugs: "a jug character named jugs",
  twig: "a stick character named twig",
  swatch: "a cloth character named swatch",
  crate: "a box character named crate",
  mud: "a clay character named mud",
  drip: "a water character named drip",
};

export default function CharacterSlot({
  character,
  variant = "kid",
  size,
  animate = true,
  pose,
}: CharacterSlotProps) {
  const filterId = `cs-wobble-${character}-${variant}`;

  let inner: ReactNode;

  if (character === "cord") {
    inner =
      variant === "kid" ? <CordKid filterId={filterId} animate={animate} /> : <CordAdult filterId={filterId} />;
  } else if (character === "jugs") {
    inner = variant === "kid" ? <JugsKid filterId={filterId} animate={animate} /> : <JugsAdult />;
  } else if (character === "twig") {
    inner =
      variant === "kid" ? <TwigKid filterId={filterId} animate={animate} /> : <TwigAdult filterId={filterId} />;
  } else if (character === "swatch") {
    inner = variant === "kid" ? <SwatchKid filterId={filterId} animate={animate} pose={pose} /> : <SwatchAdult />;
  } else if (character === "crate") {
    inner = variant === "kid" ? <CrateKid filterId={filterId} animate={animate} pose={pose} /> : <CrateAdult />;
  } else if (character === "mud") {
    inner = variant === "kid" ? <MudKid filterId={filterId} animate={animate} pose={pose} /> : <MudAdult />;
  } else if (character === "drip") {
    inner = variant === "kid" ? <DripKid filterId={filterId} animate={animate} pose={pose} /> : <DripAdult />;
  } else {
    // all 7 characters shipped — this branch is unreachable given
    // the CharacterName type is a closed union. kept as a safety net.
    return null;
  }

  return (
    <span
      role="img"
      aria-label={ARIA_LABELS[character]}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <span style={{ display: "block", width: size, height: size }}>{inner}</span>
    </span>
  );
}
