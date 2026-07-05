/**
 * @windedvertigo/motion-kit
 *
 * Brand-tokened animation primitives for winded.vertigo apps.
 * Respects prefers-reduced-motion, .reduce-motion, and .calm-theme.
 *
 * Quick start:
 *   import '@windedvertigo/motion-kit/index.css';          // CSS tokens
 *   import { FadeIn, SlideUp, Stagger } from '@windedvertigo/motion-kit';
 *   import { useMotionGate } from '@windedvertigo/motion-kit/gate';
 *
 * Primitives: FadeIn · SlideUp · Stagger · BouncePop · UnderlineDraw
 * Gate:       useMotionGate (context) · useMotionGateStandalone (inline)
 * Tokens:     duration · easing · distance · stagger (JS constants)
 */

export * from "./primitives/index";
export { useMotionGate, useMotionGateStandalone, MotionGateProvider } from "./gate";
export * from "./tokens";
