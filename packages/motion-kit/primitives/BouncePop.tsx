"use client";

/**
 * BouncePop — scales from 0.8 → 1 with a spring bounce on mount.
 * Use for UI moments that should feel delightful: a badge appearing,
 * a result card popping in, a character asset revealing itself.
 *
 * Props:
 *   delay     — ms before animation starts (default 0)
 *   className — forwarded to the wrapper div
 */

import { motion } from "motion/react";
import { useMotionGateStandalone } from "../gate";
import { easing } from "../tokens";

interface BouncePopProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function BouncePop({ children, delay = 0, className }: BouncePopProps) {
  const { shouldAnimate } = useMotionGateStandalone();

  if (!shouldAnimate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.82 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        delay: delay / 1000,
      }}
    >
      {children}
    </motion.div>
  );
}
