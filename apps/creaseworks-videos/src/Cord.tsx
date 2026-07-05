import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

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
};

export const Cord: React.FC<CordProps> = ({
  expression = "neutral",
  startFrame = 0,
  opacity = 1,
}) => {
  const frame = useCurrentFrame() - startFrame;
  const breatheScale = 1.0 + 0.015 * Math.sin(frame / 20);
  const blinking = frame % 120 < 4;
  const eyeScaleY = blinking ? 0.1 : 1;

  let rotation = 0;
  if (expression === "excited") {
    rotation = 5 * Math.sin(frame / 20);
  } else if (expression === "thinking") {
    rotation = -3;
  }

  return (
    <svg
      viewBox="0 0 200 160"
      width={200}
      height={160}
      style={{ opacity }}
    >
      <defs>
        <filter id="cord-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={4}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={2}
          />
        </filter>
      </defs>
      <g
        transform={`translate(100, 80) rotate(${rotation}) scale(${breatheScale}) translate(-100, -80)`}
        filter="url(#cord-grain)"
      >
        {/* shadow */}
        <path
          d={CORD_ROPE_PATH}
          fill={BLUSH}
          stroke="none"
          transform="translate(4,5)"
        />
        {/* ink outline */}
        <path
          d={CORD_ROPE_PATH}
          fill="none"
          stroke={INK}
          strokeWidth={4}
        />
        {/* rope fill */}
        <path d={CORD_ROPE_PATH} fill={ROPE} stroke="none" />
        {/* grain lines */}
        <line
          x1="95"
          y1="45"
          x2="105"
          y2="75"
          stroke={ROPE_DK}
          strokeWidth={1.5}
          opacity={0.6}
        />
        <line
          x1="110"
          y1="35"
          x2="125"
          y2="65"
          stroke={ROPE_DK}
          strokeWidth={1.5}
          opacity={0.6}
        />
        <line
          x1="150"
          y1="40"
          x2="160"
          y2="65"
          stroke={ROPE_DK}
          strokeWidth={1.5}
          opacity={0.6}
        />
        {/* eyes */}
        <circle
          cx={125}
          cy={50}
          r={4}
          fill={INK}
          transform={`scale(1, ${eyeScaleY})`}
          style={{ transformOrigin: "125px 50px" }}
        />
        <circle
          cx={140}
          cy={48}
          r={4}
          fill={INK}
          transform={`scale(1, ${eyeScaleY})`}
          style={{ transformOrigin: "140px 48px" }}
        />
      </g>
    </svg>
  );
};
