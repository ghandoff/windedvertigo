"use client";

/**
 * UnderlineDraw — animates an SVG underline drawing itself beneath text.
 * A brand-true way to highlight a word or phrase in headings/callouts.
 *
 * Renders an SVG with a slight hand-drawn-feeling wavy path that draws
 * from left to right using strokeDashoffset animation.
 *
 * Props:
 *   color     — stroke colour (default: var(--wv-redwood, #b15043))
 *   thickness — stroke width in px (default 3)
 *   delay     — ms before animation starts (default 80)
 *   duration  — how long the draw takes in ms (default 400)
 *   className — forwarded to the outer span wrapper
 *   children  — the text to underline (rendered inline)
 *
 * The SVG is positioned absolute beneath the text, so the parent
 * needs position: relative — the component adds inline-block to the wrapper.
 */

import { motion } from "motion/react";
import { useMotionGateStandalone } from "../gate";
import { duration as d, easing } from "../tokens";

interface UnderlineDrawProps {
  children: React.ReactNode;
  color?: string;
  thickness?: number;
  delay?: number;
  duration?: number;
  className?: string;
}

export function UnderlineDraw({
  children,
  color = "var(--wv-redwood, #b15043)",
  thickness = 3,
  delay = 80,
  duration = d.slow,
  className,
}: UnderlineDrawProps) {
  const { shouldAnimate } = useMotionGateStandalone();

  /* SVG path: a gentle wave sitting 2px below the text baseline */
  const pathD = "M2,4 Q25%,1 50%,4 Q75%,7 100%,4";

  if (!shouldAnimate) {
    return (
      <span
        className={className}
        style={{
          position: "relative",
          display: "inline-block",
          paddingBottom: 6,
        }}
      >
        {children}
        <svg
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: thickness + 6,
            overflow: "visible",
          }}
          preserveAspectRatio="none"
        >
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        paddingBottom: 6,
      }}
    >
      {children}
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: thickness + 6,
          overflow: "visible",
        }}
        preserveAspectRatio="none"
      >
        <motion.path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            pathLength: {
              duration: duration / 1000,
              delay: delay / 1000,
              ease: easing.enter,
            },
            opacity: { duration: 0.05, delay: delay / 1000 },
          }}
        />
      </svg>
    </span>
  );
}
