import React from "react";
import { useCurrentFrame } from "remotion";

// Rope path traces the center line of the knot — rendered as a thick stroke,
// NOT a fill. Filling this bezier produces a blob; stroking it makes a rope.
const CORD_ROPE_PATH =
  "M 170 60 Q 175 30 130 30 Q 85 30 85 60 Q 85 90 120 90 Q 145 90 140 68 Q 138 58 120 60";
const INK = "#241c1e";
const ROPE = "#d89f3a";
const ROPE_DK = "#6e4a13";
const BLUSH = "#e89b8a";

type CordProps = {
  expression?: "neutral" | "excited" | "thinking";
  startFrame?: number;
  opacity?: number;
  // px — should be large enough to fill the panel; default 480 suits 40%-of-1920
  size?: number;
};

export const Cord: React.FC<CordProps> = ({
  expression = "neutral",
  startFrame = 0,
  opacity = 1,
  size = 480,
}) => {
  const frame = useCurrentFrame() - startFrame;

  // breathe: gentle scale oscillation via sine — no CSS animations
  const breatheScale = 1.0 + 0.012 * Math.sin(frame / 20);

  // blink: squish eyes for 4 frames every 120
  const blinkCycle = ((frame % 120) + 120) % 120;
  const eyeScaleY = blinkCycle < 4 ? 0.1 : 1;

  // expression tilt — excited wiggles, thinking tilts
  const rotation =
    expression === "excited"
      ? 4 * Math.sin(frame / 14)
      : expression === "thinking"
      ? -4
      : 0;

  // viewBox: -20 -20 240 200 matches the original harbour-apps character coordinate space
  const vbW = 240;
  const vbH = 200;
  const cx = vbW / 2; // 120 — centre for transform-origin
  const cy = vbH / 2; // 100

  return (
    <svg
      viewBox="-20 -20 240 200"
      width={size}
      height={size * (vbH / vbW)}
      style={{ opacity, overflow: "visible" }}
    >
      <defs>
        <filter id="cord-tex" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="9" />
          <feDisplacementMap in="SourceGraphic" scale="2.8" />
        </filter>
      </defs>

      {/* everything scales from the character's centre */}
      <g transform={`translate(${cx},${cy}) rotate(${rotation}) scale(${breatheScale}) translate(${-cx},${-cy})`}>

        {/* blush shadow — thick stroke shifted down-right */}
        <path
          d={CORD_ROPE_PATH}
          fill="none"
          stroke={BLUSH}
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="translate(4,5)"
        />

        {/* ink outline with grain displacement */}
        <path
          d={CORD_ROPE_PATH}
          fill="none"
          stroke={INK}
          strokeWidth="26"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#cord-tex)"
        />

        {/* rope colour — sits on top of the ink outline */}
        <path
          d={CORD_ROPE_PATH}
          fill="none"
          stroke={ROPE}
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* grain lines along the rope */}
        <g stroke={ROPE_DK} strokeWidth="1.2" strokeLinecap="round" opacity="0.5">
          <line x1="158" y1="45" x2="180" y2="49" />
          <line x1="142" y1="40" x2="157" y2="24" />
          <line x1="107" y1="43" x2="113" y2="22" />
          <line x1="94" y1="56" x2="81" y2="38" />
          <line x1="104" y1="79" x2="83" y2="87" />
          <line x1="134" y1="74" x2="141" y2="95" />
          <line x1="126" y1="68" x2="142" y2="54" />
        </g>

        {/* frayed end strands */}
        <g stroke={ROPE_DK} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.85">
          <path d="M 174 54 Q 180 47 185 42" />
          <path d="M 176 58 Q 184 56 188 54" />
          <path d="M 178 62 Q 186 62 192 62" />
          <path d="M 176 66 Q 184 68 190 72" />
          <path d="M 174 70 Q 180 74 184 80" />
        </g>

        {/* eyes — blink by scaleY */}
        <g transform={`translate(0,0)`}>
          {/* left eye */}
          <ellipse
            cx="118" cy="58" rx="3.4" ry={3.4 * eyeScaleY}
            fill={INK}
          />
          <circle cx="119.2" cy={58 - 1.2 * eyeScaleY} r="0.9" fill="#f7f5f2" opacity={eyeScaleY} />
          {/* right eye */}
          <ellipse
            cx="133" cy="58" rx="3.4" ry={3.4 * eyeScaleY}
            fill={INK}
          />
          <circle cx="134.2" cy={58 - 1.2 * eyeScaleY} r="0.9" fill="#f7f5f2" opacity={eyeScaleY} />
        </g>

      </g>
    </svg>
  );
};
