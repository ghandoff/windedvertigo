"use client";

/**
 * SlideUp — slides children up from below while fading in.
 * The most common entry animation for cards, panels, and list items.
 *
 * Props:
 *   distance  — how far to travel (default: 'md' = 16px)
 *   delay     — ms before animation starts (default 0)
 *   duration  — override default base duration (240ms)
 *   className — forwarded to the wrapper div
 */

import { motion } from "motion/react";
import { useMotionGateStandalone } from "../gate";
import { duration as d, easing, distance as dist } from "../tokens";

interface SlideUpProps {
  children: React.ReactNode;
  distance?: keyof typeof dist;
  delay?: number;
  duration?: number;
  className?: string;
}

export function SlideUp({
  children,
  distance: distanceKey = "md",
  delay = 0,
  duration = d.base,
  className,
}: SlideUpProps) {
  const { shouldAnimate } = useMotionGateStandalone();

  if (!shouldAnimate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: dist[distanceKey] }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: duration / 1000,
        delay: delay / 1000,
        ease: easing.enter,
      }}
    >
      {children}
    </motion.div>
  );
}
