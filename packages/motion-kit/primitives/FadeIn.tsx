"use client";

/**
 * FadeIn — fades children from 0 → 1 opacity on mount.
 *
 * Props:
 *   delay     — ms before animation starts (default 0)
 *   duration  — override default base duration (240ms)
 *   className — forwarded to the wrapper div
 */

import { motion, AnimatePresence } from "motion/react";
import { useMotionGateStandalone } from "../gate";
import { duration as d, easing } from "../tokens";

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeIn({
  children,
  delay = 0,
  duration = d.base,
  className,
}: FadeInProps) {
  const { shouldAnimate } = useMotionGateStandalone();

  if (!shouldAnimate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
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
