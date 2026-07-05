// Cord SVG — updated to match the ChatGPT style-guide reference sheet (2026-07-05).
// Character: a simple square knot made of braided cotton rope.
// Anatomy: rounded knot body (torso), two arm-ears curving upward, two short legs hanging down.
// Texture: cross-hatch lines over golden rope fills, dark ink outline, soft blush shadow.
import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

// ── Palette ────────────────────────────────────────────────────────────────
const INK     = "#2a1f0e";   // warm dark brown (not pure black)
const ROPE    = "#c8973a";   // golden braided cotton
const ROPE_HI = "#e8c070";   // highlight strand
const ROPE_DK = "#7a5520";   // shadow strand / cross-hatch
const BLUSH   = "#e8b090";   // warm drop-shadow

// ── Cross-hatch pattern helper ─────────────────────────────────────────────
// Renders a small repeating diagonal hatch that sits over rope fills.
const HatchDefs: React.FC = () => (
  <defs>
    <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(40)">
      <line x1="0" y1="0" x2="0" y2="6" stroke={ROPE_DK} strokeWidth="0.8" opacity="0.35" />
    </pattern>
    <pattern id="hatch2" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(-40)">
      <line x1="0" y1="0" x2="0" y2="6" stroke={ROPE_DK} strokeWidth="0.8" opacity="0.22" />
    </pattern>
    <filter id="cord-grain" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="5" />
      <feDisplacementMap in="SourceGraphic" scale="1.6" />
    </filter>
  </defs>
);

// ── Rope segment (filled + hatched + outlined) ─────────────────────────────
// Uses a filled elliptical/rounded-rect approach so the hatch pattern clips to the shape.
// Each segment: blush shadow → rope fill → cross-hatch → ink outline.
const RopeSeg: React.FC<{
  d: string;
  sw?: number;
  shadow?: boolean;
  filter?: string;
}> = ({ d, sw = 16, shadow = true, filter }) => (
  <g>
    {shadow && (
      <path d={d} fill="none" stroke={BLUSH} strokeWidth={sw + 6}
        strokeLinecap="round" strokeLinejoin="round"
        transform="translate(2,4)" opacity={0.5} />
    )}
    {/* rope fill */}
    <path d={d} fill="none" stroke={ROPE} strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" filter={filter} />
    {/* highlight strand down the centre */}
    <path d={d} fill="none" stroke={ROPE_HI} strokeWidth={sw * 0.28}
      strokeLinecap="round" strokeLinejoin="round" opacity={0.55} filter={filter} />
    {/* cross-hatch texture */}
    <path d={d} fill="none" stroke="url(#hatch)" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" filter={filter} />
    <path d={d} fill="none" stroke="url(#hatch2)" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" filter={filter} />
    {/* ink outline */}
    <path d={d} fill="none" stroke={INK} strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" filter={filter} opacity={0.75} />
  </g>
);

// ── Frayed tip ─────────────────────────────────────────────────────────────
const FrayedTip: React.FC<{ cx: number; cy: number; angle: number }> = ({ cx, cy, angle }) => (
  <g transform={`translate(${cx},${cy}) rotate(${angle})`}>
    {[-10, -5, 0, 5, 10].map((off, i) => (
      <path
        key={i}
        d={`M ${off} 0 Q ${off + (i % 2 === 0 ? 3 : -3)} 10 ${off + (i % 2 === 0 ? 1 : -1)} 18`}
        fill="none"
        stroke={i === 2 ? ROPE_HI : i % 2 === 0 ? ROPE : ROPE_DK}
        strokeWidth={i === 2 ? 2 : 1.4}
        strokeLinecap="round"
        opacity={0.85}
      />
    ))}
  </g>
);

// ── Types ──────────────────────────────────────────────────────────────────
type Expression = "neutral" | "happy" | "curious" | "thinking" | "surprised" | "listening" | "excited";

type CordProps = {
  expression?: Expression;
  startFrame?: number;
  opacity?: number;
  size?: number;
};

// ── Cord ───────────────────────────────────────────────────────────────────
export const Cord: React.FC<CordProps> = ({
  expression = "neutral",
  startFrame = 0,
  opacity = 1,
  size = 480,
}) => {
  const frame = useCurrentFrame() - startFrame;

  // breathe — gentle sine scale on the whole body
  const breatheScale = 1.0 + 0.010 * Math.sin(frame / 22);

  // blink — every 120 frames, squish eyeScaleY for 4 frames
  const blinkCycle = ((frame % 120) + 120) % 120;
  const eyeScaleY = blinkCycle < 4 ? 0.08 : 1;

  // body sway
  const bodyRot =
    expression === "excited"  ? 4 * Math.sin(frame / 12)
    : expression === "happy"  ? 2 * Math.sin(frame / 18)
    : expression === "curious" ? -3
    : 0;

  // arm angles — arms are the "ears" curving up like the reference sheet
  const leftArmSwing =
    expression === "excited"   ? -55 + 5 * Math.sin(frame / 10)
    : expression === "happy"   ? -50 + 3 * Math.sin(frame / 16)
    : expression === "curious" ? -35
    : expression === "thinking"? -28
    : expression === "listening"? -42
    : -45; // neutral

  const rightArmSwing =
    expression === "excited"   ? 55 - 5 * Math.sin(frame / 10)
    : expression === "happy"   ? 50 - 3 * Math.sin(frame / 16)
    : expression === "curious" ? 50
    : expression === "thinking"? 22
    : expression === "listening"? 42
    : 45; // neutral

  // mouth path (relative, translated to face position)
  const mouthPath =
    expression === "happy" || expression === "excited"
      ? "M -11 0 Q 0 9 11 0"
    : expression === "curious"
      ? "M -8 0 Q 0 5 8 0"
    : expression === "thinking"
      ? "M -7 2 Q 0 -1 7 2"
    : expression === "listening"
      ? "M -9 0 Q 0 6 9 0"
    : "M -9 0 Q 0 5 9 0"; // neutral

  // viewBox: 200 × 300
  const VW = 200;
  const VH = 300;
  const KX = 100; // knot centre x
  const KY = 150; // knot centre y

  // arm tip endpoints — curved bunny-ear shape matching reference sheet
  const leftTipX  = KX - 28 + leftArmSwing  * 0.7;
  const leftTipY  = KY - 120;
  const rightTipX = KX + 28 + rightArmSwing * 0.7;
  const rightTipY = KY - 120;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width={size}
      height={size * (VH / VW)}
      style={{ opacity, overflow: "visible" }}
    >
      <HatchDefs />

      <g transform={`translate(${KX},${KY}) rotate(${bodyRot}) scale(${breatheScale}) translate(${-KX},${-KY})`}>

        {/* ── LEGS ── short rounded rope ends hanging down */}
        <g filter="url(#cord-grain)">
          <RopeSeg d={`M ${KX - 14} ${KY + 30} Q ${KX - 20} ${KY + 62} ${KX - 17} ${KY + 90}`} sw={13} />
          <FrayedTip cx={KX - 17} cy={KY + 90} angle={-8} />
          <RopeSeg d={`M ${KX + 14} ${KY + 30} Q ${KX + 20} ${KY + 62} ${KX + 17} ${KY + 90}`} sw={13} />
          <FrayedTip cx={KX + 17} cy={KY + 90} angle={8} />
        </g>

        {/* ── KNOT BODY ── two interlocked rope loops forming the square-knot torso */}
        <g filter="url(#cord-grain)">
          {/* back loop (goes under front) */}
          <RopeSeg
            d={`M ${KX - 36} ${KY - 8} Q ${KX} ${KY + 14} ${KX + 36} ${KY - 8}`}
            sw={20} shadow={false}
          />
          {/* front loop (goes over) */}
          <RopeSeg
            d={`M ${KX + 36} ${KY + 8} Q ${KX} ${KY - 14} ${KX - 36} ${KY + 8}`}
            sw={20}
          />
          {/* left shoulder loop */}
          <RopeSeg
            d={`M ${KX - 36} ${KY - 8} Q ${KX - 54} ${KY - 44} ${KX - 22} ${KY - 54} Q ${KX + 2} ${KY - 60} ${KX + 6} ${KY - 34}`}
            sw={17}
          />
          {/* right shoulder loop */}
          <RopeSeg
            d={`M ${KX + 36} ${KY + 8} Q ${KX + 54} ${KY - 24} ${KX + 22} ${KY - 54} Q ${KX - 2} ${KY - 70} ${KX - 6} ${KY - 40}`}
            sw={17}
          />
        </g>

        {/* ── ARMS (ear-arms) ── curve upward from shoulders, inward at tips */}
        <g filter="url(#cord-grain)">
          {/* left arm — curves up and slightly inward */}
          <RopeSeg
            d={`M ${KX - 22} ${KY - 54} Q ${KX - 44 + leftArmSwing * 0.3} ${KY - 86} ${leftTipX + 8} ${leftTipY}`}
            sw={12}
          />
          <FrayedTip cx={leftTipX + 8} cy={leftTipY} angle={leftArmSwing - 85} />
          {/* right arm */}
          <RopeSeg
            d={`M ${KX + 22} ${KY - 54} Q ${KX + 44 + rightArmSwing * 0.3} ${KY - 86} ${rightTipX - 8} ${rightTipY}`}
            sw={12}
          />
          <FrayedTip cx={rightTipX - 8} cy={rightTipY} angle={rightArmSwing - 95} />
        </g>

        {/* ── FACE ── dot eyes + tiny mouth on the knot centre */}

        {/* eyes */}
        <ellipse
          cx={KX - 9} cy={KY - 16}
          rx={4.5} ry={4.5 * eyeScaleY}
          fill={INK}
        />
        <ellipse
          cx={KX + 9} cy={KY - 16}
          rx={4.5} ry={4.5 * eyeScaleY}
          fill={INK}
        />

        {/* curious gets a tilted eyebrow on the right */}
        {expression === "curious" && (
          <path
            d={`M ${KX + 5} ${KY - 27} Q ${KX + 10} ${KY - 31} ${KX + 15} ${KY - 26}`}
            fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round"
          />
        )}
        {/* thinking gets a raised left eyebrow */}
        {expression === "thinking" && (
          <path
            d={`M ${KX - 14} ${KY - 28} Q ${KX - 9} ${KY - 33} ${KX - 4} ${KY - 27}`}
            fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round"
          />
        )}

        {/* mouth */}
        {expression === "surprised" ? (
          <ellipse cx={KX} cy={KY - 3} rx={5} ry={6.5} fill={INK} />
        ) : (
          <g transform={`translate(${KX},${KY - 3})`}>
            <path d={mouthPath} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
          </g>
        )}

        {/* rosy cheek dots — happy + excited only */}
        {(expression === "happy" || expression === "excited") && (
          <>
            <circle cx={KX - 15} cy={KY - 8} r={5} fill={BLUSH} opacity={0.45} />
            <circle cx={KX + 15} cy={KY - 8} r={5} fill={BLUSH} opacity={0.45} />
          </>
        )}

      </g>
    </svg>
  );
};
