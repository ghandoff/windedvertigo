"use client";

/**
 * Stagger — wraps a list and staggers the entrance of each direct child.
 * Each child slides up with a delay offset — great for grids, card lists,
 * step sequences.
 *
 * Props:
 *   staggerMs  — delay between each child (default: 60ms 'base')
 *   itemDelay  — base delay before first item (default 0)
 *   className  — forwarded to the wrapper div
 *   itemClass  — applied to each motion wrapper around a child
 *
 * Children must be renderable React nodes — the component wraps each in a
 * motion.div so they don't need to be motion-compatible themselves.
 */

import { motion } from "motion/react";
import React from "react";
import { useMotionGateStandalone } from "../gate";
import { duration as d, easing, distance as dist, stagger as staggerTokens } from "../tokens";

interface StaggerProps {
  children: React.ReactNode;
  staggerMs?: number;
  itemDelay?: number;
  duration?: number;
  className?: string;
  itemClass?: string;
}

export function Stagger({
  children,
  staggerMs = staggerTokens.base,
  itemDelay = 0,
  duration = d.base,
  className,
  itemClass,
}: StaggerProps) {
  const { shouldAnimate } = useMotionGateStandalone();
  const items = React.Children.toArray(children);

  if (!shouldAnimate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className}>
      {items.map((child, i) => (
        <motion.div
          key={i}
          className={itemClass}
          initial={{ opacity: 0, y: dist.sm }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: duration / 1000,
            delay: (itemDelay + i * staggerMs) / 1000,
            ease: easing.enter,
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
