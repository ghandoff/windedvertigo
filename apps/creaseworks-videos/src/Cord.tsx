// Cord SVG updated to match the ChatGPT-generated reference sheet (2026-07-05).
// Character anatomy: knot body in centre, two rope ends raised as arms,
// two shorter ends hanging down as legs, eyes + mouth on the knot face.
import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

const INK = "#241c1e";
const ROPE = "#d89f3a";
const ROPE_DK = "#6e4a13";
const BLUSH = "#e89b8a";

// Stroke weight for the thick rope body
const SW = 18;

// ─── Rope segment helper ───────────────────────────────────────────────────
// Draws one rope segment as three stacked strokes: blush shadow, ink outline,
// rope colour. Same layering as the reference sheet's hand-drawn look.
const RopeStroke: React.FC<{
  d: string;
  shadow?: boolean;
  filter?: string;
  sw?: number;
}> = ({ d, shadow = true, filter, sw = SW }) => (
  <g>
    {shadow && (
      <path d={d} fill="none" stroke={BLUSH} strokeWidth={sw + 4}
        strokeLinecap="round" strokeLinejoin="round"
        transform="translate(3,4)" opacity={0.6} />
    )}
    <path d={d} fill="none" stroke={INK} strokeWidth={sw + 4}
      strokeLinecap="round" strokeLinejoin="round"
      filter={filter} />
    <path d={d} fill="none" stroke={ROPE} strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

// ─── Frayed tip helper ─────────────────────────────────────────────────────
const FrayedTip: React.FC<{ cx: number; cy: number; angle: number }> = ({ cx, cy, angle }) => {
  const strands = [-14, -7, 0, 7, 14];
  return (
    <g transform={`translate(${cx},${cy}) rotate(${angle})`}>
      {strands.map((off, i) => (
        <path
          key={i}
          d={`M ${off} 0 Q ${off + (i % 2 === 0 ? 4 : -4)} 12 ${off + (i % 2 === 0 ? 2 : -2)} 22`}
          fill="none"
          stroke={i === 2 ? ROPE : ROPE_DK}
          strokeWidth={i === 2 ? 2.5 : 1.8}
          strokeLinecap="round"
          opacity={0.9}
        />
      ))}
    </g>
  );
};

type Expression = "neutral" | "excited" | "thinking" | "surprised";

type CordProps = {
  expression?: Expression;
  startFrame?: number;
  opacity?: number;
  size?: number;
};

export const Cord: React.FC<CordProps> = ({
  expression = "neutral",
  startFrame = 0,
  opacity = 1,
  size = 480,
}) => {
  const frame = useCurrentFrame() - startFrame;

  // breathe
  const breatheScale = 1.0 + 0.012 * Math.sin(frame / 20);

  // blink
  const blinkCycle = ((frame % 120) + 120) % 120;
  const eyeScaleY = blinkCycle < 4 ? 0.1 : 1;

  // body rotation
  const bodyRotation =
    expression === "excited" ? 3 * Math.sin(frame / 14)
    : expression === "thinking" ? -5
    : 0;

  // arm angles — excited = raised higher, thinking = one arm lower
  const leftArmAngle =
    expression === "excited" ? -50 + 4 * Math.sin(frame / 14)
    : expression === "thinking" ? -30
    : -40;
  const rightArmAngle =
    expression === "excited" ? 50 - 4 * Math.sin(frame / 14)
    : expression === "thinking" ? 20
    : 40;

  // mouth shape
  const mouthPath =
    expression === "neutral" ? "M -10 0 Q 0 5 10 0"
    : expression === "excited" ? "M -12 0 Q 0 10 12 0"
    : expression === "thinking" ? "M -8 2 Q 0 -2 8 2"
    : /* surprised */ "M -6 -2 Q 0 8 6 -2"; // open O shape approximated

  // viewBox: 200 wide × 300 tall — room for arms up + legs down
  const VW = 200;
  const VH = 300;

  // character centres: knot body at (100, 150)
  const KX = 100;
  const KY = 148;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width={size}
      height={size * (VH / VW)}
      style={{ opacity, overflow: "visible" }}
    >
      <defs>
        <filter id="cord-grain" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="9" />
          <feDisplacementMap in="SourceGraphic" scale="2.4" />
        </filter>
      </defs>

      <g transform={`translate(${KX},${KY}) rotate(${bodyRotation}) scale(${breatheScale}) translate(${-KX},${-KY})`}>

        {/* ── LEGS ── two rope ends hanging down from knot base */}
        <g filter="url(#cord-grain)">
          {/* left leg */}
          <RopeStroke d={`M ${KX - 16} ${KY + 28} Q ${KX - 24} ${KY + 68} ${KX - 20} ${KY + 100}`} sw={14} />
          <FrayedTip cx={KX - 20} cy={KY + 100} angle={-10} />
          {/* right leg */}
          <RopeStroke d={`M ${KX + 16} ${KY + 28} Q ${KX + 24} ${KY + 68} ${KX + 20} ${KY + 100}`} sw={14} />
          <FrayedTip cx={KX + 20} cy={KY + 100} angle={10} />
        </g>

        {/* ── KNOT BODY ── square knot shape (over-under cross) */}
        <g filter="url(#cord-grain)">
          {/* back strand — goes under */}
          <RopeStroke
            d={`M ${KX - 38} ${KY - 10} Q ${KX} ${KY + 10} ${KX + 38} ${KY - 10}`}
            shadow={false} sw={SW + 2}
          />
          {/* front strand — goes over */}
          <RopeStroke
            d={`M ${KX + 38} ${KY + 10} Q ${KX} ${KY - 10} ${KX - 38} ${KY + 10}`}
            sw={SW + 2}
          />
          {/* loop top-left */}
          <RopeStroke
            d={`M ${KX - 38} ${KY - 10} Q ${KX - 52} ${KY - 46} ${KX - 22} ${KY - 52} Q ${KX + 4} ${KY - 56} ${KX + 8} ${KY - 30}`}
            sw={SW}
          />
          {/* loop top-right */}
          <RopeStroke
            d={`M ${KX + 38} ${KY + 10} Q ${KX + 52} ${KY - 26} ${KX + 22} ${KY - 52} Q ${KX - 4} ${KY - 72} ${KX - 8} ${KY - 36}`}
            sw={SW}
          />
        </g>

        {/* ── ARMS ── rope ends rising upward */}
        <g filter="url(#cord-grain)">
          {/* left arm */}
          <RopeStroke
            d={`M ${KX - 22} ${KY - 52} Q ${KX - 40 + leftArmAngle * 0.4} ${KY - 90} ${KX - 30 + leftArmAngle * 0.8} ${KY - 130}`}
            sw={14}
          />
          <FrayedTip cx={KX - 30 + leftArmAngle * 0.8} cy={KY - 130} angle={leftArmAngle - 90} />
          {/* right arm */}
          <RopeStroke
            d={`M ${KX + 22} ${KY - 52} Q ${KX + 40 + rightArmAngle * 0.4} ${KY - 90} ${KX + 30 + rightArmAngle * 0.8} ${KY - 130}`}
            sw={14}
          />
          <FrayedTip cx={KX + 30 + rightArmAngle * 0.8} cy={KY - 130} angle={rightArmAngle - 90} />
        </g>

        {/* ── FACE ── eyes and mouth on the front knot area */}
        {/* eyes */}
        <ellipse cx={KX - 10} cy={KY - 18} rx={5} ry={5 * eyeScaleY} fill={INK} />
        <circle cx={KX - 8.5} cy={KY - 20 * eyeScaleY} r={1.4} fill="#f7f5f2" opacity={eyeScaleY} />
        <ellipse cx={KX + 10} cy={KY - 18} rx={5} ry={5 * eyeScaleY} fill={INK} />
        <circle cx={KX + 11.5} cy={KY - 20 * eyeScaleY} r={1.4} fill="#f7f5f2" opacity={eyeScaleY} />

        {/* expression: thinking gets a raised eyebrow line */}
        {expression === "thinking" && (
          <path d={`M ${KX + 5} ${KY - 28} Q ${KX + 10} ${KY - 32} ${KX + 15} ${KY - 28}`}
            fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
        )}

        {/* mouth — translate to face position, use relative path */}
        {expression === "surprised" ? (
          <ellipse cx={KX} cy={KY - 4} rx={5} ry={6} fill={INK} />
        ) : (
          <g transform={`translate(${KX},${KY - 4})`}>
            <path
              d={mouthPath}
              fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round"
            />
          </g>
        )}

        {/* grain texture lines across the knot body */}
        <g stroke={ROPE_DK} strokeWidth={1.0} strokeLinecap="round" opacity={0.4}>
          <line x1={KX - 28} y1={KY - 8} x2={KX - 18} y2={KY + 4} />
          <line x1={KX - 14} y1={KY - 42} x2={KX - 4} y2={KY - 30} />
          <line x1={KX + 10} y1={KY - 44} x2={KX + 20} y2={KY - 32} />
          <line x1={KX + 24} y1={KY - 4} x2={KX + 34} y2={KY + 8} />
          <line x1={KX - 2} y1={KY + 12} x2={KX + 8} y2={KY + 24} />
        </g>

      </g>
    </svg>
  );
};

// ─── Mouth path fix — build the path properly ─────────────────────────────
// (The mouth is drawn as a standalone path below the face group above.
//  The expression switching above uses a simplified form; the real paths:)
//   neutral:   M 90 144  Q 100 149 110 144
//   excited:   M 88 144  Q 100 154 112 144
//   thinking:  M 92 146  Q 100 142 108 146
//   surprised: ellipse (handled inline)
