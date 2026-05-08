"use client";
import { useEffect, useRef, useState } from "react";
import { COLLABORATORS } from "@/lib/collaborators";

/**
 * #11 — Gravitational Orbit (revised)
 *
 * Each particle orbits at a target ring radius — current partners on the
 * inner ring, past partners on the outer ring. A tangential drift force
 * creates slow anti-clockwise rotation. A radial spring pulls each particle
 * back toward its ring if it strays. Light inter-particle repulsion keeps
 * names from piling up.
 *
 * Touch/hover pulls all particles toward the centre briefly.
 *
 * UDL: prefers-reduced-motion → static scattered list.
 */

const CHAMPAGNE = "#ffebd2";
const DIM_WHITE  = "rgba(255,255,255,0.75)";

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  name: string;
  current: boolean;
  targetR: number;   // orbital radius
  angle: number;     // initial angle (radians)
  textWidth: number;
  fontSize: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function CollabGravity() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const pRef        = useRef<Particle[]>([]);
  const hoveredRef  = useRef(false);
  const rafRef      = useRef<number>(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  /* ── reduced-motion detection ─────────────────────────────────── */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  /* ── container measurement ────────────────────────────────────── */
  useEffect(() => {
    const wrap = canvasRef.current?.parentElement;
    if (!wrap) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      // Taller on narrow viewports so rings have room
      const h = Math.max(320, Math.min(460, w * 0.85));
      setSize({ w, h });
    });
    obs.observe(wrap);
    return () => obs.disconnect();
  }, []);

  /* ── particle initialisation ──────────────────────────────────── */
  useEffect(() => {
    if (reducedMotion || size.w === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width  = size.w + "px";
    canvas.style.height = size.h + "px";
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const cx = size.w / 2;
    const cy = size.h / 2;
    // Rings: inner = ~35% of min(cx,cy), outer = ~72%
    const minHalf = Math.min(cx, cy);
    const innerR  = minHalf * 0.36;
    const outerR  = minHalf * 0.78;

    // font size: legible on mobile (~375px → 12px, desktop → 14px)
    const fs = Math.max(11, Math.min(14, size.w / 28));

    // Wait for web fonts before measuring
    document.fonts.ready.then(() => {
      ctx.font = `${fs}px "DM Mono", ui-monospace, monospace`;

      const rnd = seededRandom(7);
      pRef.current = COLLABORATORS.map((c, i) => {
        // Spread evenly around ring with slight jitter
        const count      = COLLABORATORS.length;
        const baseAngle  = (i / count) * Math.PI * 2;
        const jitter     = (rnd() - 0.5) * 0.35;
        const angle      = baseAngle + jitter;
        const tR         = c.current ? innerR : outerR;
        // Small random offset from ring so particles aren't perfectly aligned
        const r = tR + (rnd() - 0.5) * minHalf * 0.08;

        const tw = ctx.measureText(c.name).width;
        return {
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          vx: 0, vy: 0,
          name: c.name,
          current: c.current,
          targetR: tR,
          angle,
          textWidth: tw,
          fontSize: fs,
        };
      });
    });
  }, [size, reducedMotion]);

  /* ── animation loop ───────────────────────────────────────────── */
  useEffect(() => {
    if (reducedMotion || size.w === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    const cx = size.w / 2;
    const cy = size.h / 2;
    const minHalf = Math.min(cx, cy);
    const DAMPING          = 0.96;
    const RADIAL_K         = 0.003;  // spring constant toward ring
    const TANGENT_SPEED    = 0.0012; // slow anti-clockwise drift
    const REPULSE_DIST     = 55;     // pixels — inter-particle repulsion
    const REPULSE_FORCE    = 0.18;
    const HOVER_PULL       = 0.006;  // extra pull toward centre on hover

    const frame = () => {
      ctx.clearRect(0, 0, size.w * dpr, size.h * dpr);

      const particles = pRef.current;
      if (particles.length === 0) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      const fs = particles[0].fontSize;
      ctx.font = `${fs}px "DM Mono", ui-monospace, monospace`;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        // 1. Radial spring: pull toward targetR
        const err = dist - p.targetR;
        p.vx -= nx * err * RADIAL_K;
        p.vy -= ny * err * RADIAL_K;

        // 2. Tangential drift (anti-clockwise rotation)
        p.vx += -ny * TANGENT_SPEED * p.targetR;
        p.vy +=  nx * TANGENT_SPEED * p.targetR;

        // 3. Hover: additional pull toward centre
        if (hoveredRef.current) {
          p.vx -= nx * HOVER_PULL * dist;
          p.vy -= ny * HOVER_PULL * dist;
        }

        // 4. Inter-particle repulsion (avoid text overlap)
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const rdx = p.x - q.x;
          const rdy = p.y - q.y;
          const rdist = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
          if (rdist < REPULSE_DIST) {
            const force = (REPULSE_DIST - rdist) / REPULSE_DIST * REPULSE_FORCE;
            const rfx = (rdx / rdist) * force;
            const rfy = (rdy / rdist) * force;
            p.vx += rfx; p.vy += rfy;
            q.vx -= rfx; q.vy -= rfy;
          }
        }

        // 5. Soft boundary — stay inside canvas with margin
        const pad = fs + 4;
        if (p.x < pad)              p.vx += 0.4;
        if (p.x > size.w - pad)     p.vx -= 0.4;
        if (p.y < pad)              p.vy += 0.4;
        if (p.y > size.h - pad)     p.vy -= 0.4;
        // Also push away from exact centre (avoid singularity)
        if (dist < minHalf * 0.1) {
          p.vx += nx * -0.3;
          p.vy += ny * -0.3;
        }

        p.vx *= DAMPING;
        p.vy *= DAMPING;
        p.x += p.vx;
        p.y += p.vy;

        // Draw
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha  = p.current ? 0.92 : 0.62;
        ctx.fillStyle    = p.current ? CHAMPAGNE : DIM_WHITE;
        ctx.fillText(p.name, p.x, p.y);
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [size, reducedMotion]);

  /* ── reduced-motion fallback ──────────────────────────────────── */
  if (reducedMotion) {
    return (
      <section className="collab-variant collab-gravity--static" aria-label="organisations we play with">
        <p className="collab-variant-label">organisations we play with</p>
        <ul className="collab-gravity-static-list">
          {COLLABORATORS.map((c) => (
            <li key={c.name} className={c.current ? "tw-current" : "tw-past"}>{c.name}</li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section
      className="collab-variant collab-gravity"
      aria-label="organisations we play with"
      onMouseEnter={() => { hoveredRef.current = true;  }}
      onMouseLeave={() => { hoveredRef.current = false; }}
      onTouchStart={() => { hoveredRef.current = true;  }}
      onTouchEnd={()   => { hoveredRef.current = false; }}
    >
      <p className="collab-variant-label">organisations we play with</p>
      <div className="collab-gravity-field" style={{ height: size.h || 360 }}>
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
      {/* SR-only list */}
      <ul className="visually-hidden">
        {COLLABORATORS.map((c) => <li key={c.name}>{c.name}</li>)}
      </ul>
    </section>
  );
}
