# @windedvertigo/motion-kit

A shared animation library [package] for harbour apps and the main site. It exists to keep three things consistent across every surface we build:

1. **A single reduced-motion gate** — one place that checks all four preference signals, so no animation ever fires when someone has asked for less motion.
2. **Brand tokens** — duration, easing, and distance values live here, not scattered across component files.
3. **Five ready-to-use primitives** — drop-in wrappers that animate children without you writing `motion.div` from scratch.

---

## The reduced-motion gate

The gate (`useMotionGate` / `useMotionGateStandalone`) returns `shouldAnimate: false` when **any one** of these four signals is active:

| Signal | What sets it | Who it's for |
|---|---|---|
| OS `prefers-reduced-motion` | User's system accessibility settings | Everyone |
| `.reduce-motion` class on `<html>` | creaseworks in-app toggle | Kids/parents who prefer less movement |
| `.calm-theme` class on `<html>` | creaseworks sensory sensitivity mode | Sensory sensitivity |
| `data-still` attribute on `<html>` | wv-site `AnimationProvider` kill switch | Site-wide off switch |

All four are observed live — switching any one of them off mid-session stops animations immediately, no page reload needed.

---

## Quick start

**Step 1 — import the CSS tokens** (once, in your app's root layout or global stylesheet):

```ts
import '@windedvertigo/motion-kit/index.css';
```

**Step 2 — use a primitive** in any React component:

```tsx
import { Stagger } from '@windedvertigo/motion-kit';

export function MyGrid({ items }: { items: string[] }) {
  return (
    <Stagger className="my-grid">
      {items.map((item) => (
        <div key={item} className="my-card">{item}</div>
      ))}
    </Stagger>
  );
}
```

The component automatically checks the gate — if the user prefers reduced motion, it renders the children as-is with no animation.

**Step 3 (optional) — read the gate directly** in your own logic:

```tsx
import { useMotionGateStandalone } from '@windedvertigo/motion-kit/gate';

const { shouldAnimate } = useMotionGateStandalone();
if (!shouldAnimate) return <StaticVersion />;
```

---

## Primitive reference

| Primitive | What it does | Key props |
|---|---|---|
| `FadeIn` | Fades children from 0 → 1 opacity on mount | `duration`, `delay`, `className` |
| `SlideUp` | Slides children up from a small offset while fading in | `duration`, `delay`, `distance`, `className` |
| `Stagger` | Wraps a list and staggers the entrance of each child — great for grids and card lists | `staggerMs` (delay between items), `itemDelay` (before first item), `itemClass` |
| `BouncePop` | A spring-based scale pop — draws the eye to new items or confirmations | `delay`, `className` |
| `UnderlineDraw` | Draws a coloured underline left-to-right on mount — for headlines and emphasis | `color`, `height`, `delay`, `className` |

All primitives are `"use client"` components and safe to use inside Next.js app router page trees.

---

## Library choice

- **Motion (`motion/react` v12)** for React components — best fit for React 19 concurrent rendering, first-class `AnimatePresence` for exit animations, and an AI kit for coding agents. MIT licence, zero cost.
- **GSAP** for vanilla JS / demo pages — the full toolkit (ScrollTrigger, Flip, etc.) is free for non-commercial use. Used in `/tools/motion-kit/`.

---

## Demo page

Live at `/tools/motion-kit/` — shows all five primitives side by side with a toggle to simulate reduced-motion mode.

Source: `site/app/tools/motion-kit/page.tsx` (or equivalent in the windedvertigo repo).
