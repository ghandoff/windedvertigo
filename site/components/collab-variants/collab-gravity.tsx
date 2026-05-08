"use client";
import { useEffect, useRef, useState } from "react";
import { COLLABORATORS } from "@/lib/collaborators";

/**
 * #11 — Gravitational Orbit (v3)
 *
 * Three concentric rings distribute 18 names evenly so no ring is
 * overcrowded. Ring assignment is by index thirds — pure visual
 * balance, not status. Current/past is shown only by colour
 * (champagne vs dim-white).
 *
 * Each particle orbits at its ring radius with slow anti-clockwise
 * tangential drift and light inter-particle repulsion. Boundary
 * padding accounts for actual text width so names never clip.
 *
 * Touch/hover strengthens the radial spring, tightening orbits.
 *
 * UDL: prefers-reduced-motion → static pill list.
 */

const CHAMPAGNE = "#ffebd2";
const DIM_WHITE  = "rgba(255,255,255,0.72)";

const RING_FRACTIONS = [0.30, 0.56, 0.82]; // of minHalf

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  name: string;
  current: boolean;
  targetR: number;
  textWidth: number;
  fontSize: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function CollabGravity() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const pRef       = useRef<Particle[]>([]);
  const hoveredRef = useRef(false);
  const rafRef     = useRef<number>(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  /* ── reduced-motion ────────────────────────────────────────────── */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  /* ── container measurement ─────────────────────────────────────── */
  useEffect(() => {
    const wrap = canvasRef.current?.parentElement;
    if (!wrap) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      // Taller canvas on narrow viewports so rings have breathing room
      const h = Math.max(340, Math.min(480, w * 0.9));
      setSize({ w, h });
    });
    obs.observe(wrap);
    return () => obs.disconnect();
  }, []);

  /* ── particle init ─────────────────────────────────────────────── */
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
    const minHalf = Math.min(cx, cy);
    const total   = COLLABORATORS.length;
    const fs = Math.max(11, Math.min(14, size.w / 28));

    document.fonts.ready.then(() => {
      ctx.font = `${fs}px "DM Mono", ui-monospace, monospace`;

      const rnd = seededRandom(13);

      pRef.current = COLLABORATORS.map((c, i) => {
        // Assign to one of three rings by position in list (even thirds)
        const ringIdx = Math.floor((i / total) * 3);
        const tR = minHalf * RING_FRACTIONS[ringIdx];

        // Evenly space within ring + small jitter
        const countOnRing = Math.round(total / 3);
        const posInRing   = i % countOnRing;
        const baseAngle   = (posInRing / countOnRing) * Math.PI * 2;
        const jitter      = (rnd() - 0.5) * 0.4;
        const angle       = baseAngle + jitter + (ringIdx * 0.6); // phase-shift rings
        const r           = tR + (rnd() - 0.5) * minHalf * 0.06;

        const tw = ctx.measureText(c.name).width;
        return {
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          vx: 0, vy: 0,
          name: c.name,
          current: c.current,
          targetR: tR,
          textWidth: tw,
          fontSize: fs,
        };
      });
    });
  }, [size, reducedMotion]);

  /* ── animation loop ────────────────────────────────────────────── */
  useEffect(() => {
    if (reducedMotion || size.w === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const cx = size.w / 2;
    const cy = size.h / 2;
    const minHalf = Math.min(cx, cy);

    const DAMPING       = 0.965;
    const RADIAL_K      = 0.004;
    const TANGENT       = 0.0014;
    const REPULSE_DIST  = 80;
    const REPULSE_K     = 0.20;
    const HOVER_K       = 0.008;

    const frame = () => {
      ctx.clearRect(0, 0, size.w * dpr, size.h * dpr);

      const particles = pRef.current;
      if (particles.length === 0) { rafRef.current = requestAnimationFrame(frame); return; }

      const fs = particles[0].fontSize;
      ctx.font = `${fs}px "DM Mono", ui-monospace, monospace`;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx   = p.x - cx;
        const dy   = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx   = dx / dist;
        const ny   = dy / dist;

        // Radial spring toward target ring
        const err = dist - p.targetR;
        p.vx -= nx * err * RADIAL_K;
        p.vy -= ny * err * RADIAL_K;

        // Slow tangential drift (anti-clockwise)
        p.vx += -ny * TANGENT * p.targetR * 0.015;
        p.vy +=  nx * TANGENT * p.targetR * 0.015;

        // Hover: compress all rings toward centre
        if (hoveredRef.current) {
          p.vx -= nx * HOVER_K * dist * 0.05;
          p.vy -= ny * HOVER_K * dist * 0.05;
        }

        // Push away from exact centre (singularity guard)
        if (dist < minHalf * 0.08) {
          p.vx -= nx * 0.4;
          p.vy -= ny * 0.4;
        }

        // Inter-particle repulsion — distance threshold is text-width aware
        // so long names like "education for sharing" repel at a larger radius
        for (let j = i + 1; j < particles.length; j++) {
          const q    = particles[j];
          const rdx  = p.x - q.x;
          const rdy  = p.y - q.y;
          const rd   = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
          // Minimum clear gap = half each text width + 14px breathing room
          const minClear = (p.textWidth + q.textWidth) / 2 + 14;
          const repDist  = Math.max(REPULSE_DIST, minClear);
          if (rd < repDist) {
            const f = (repDist - rd) / repDist * REPULSE_K;
            const fx = (rdx / rd) * f;
            const fy = (rdy / rd) * f;
            p.vx += fx; p.vy += fy;
            q.vx -= fx; q.vy -= fy;
          }
        }

        // Boundary: account for text width so names never clip at edges
        const hw = p.textWidth / 2 + 4;
        const hh = fs / 2 + 4;
        if (p.x - hw < 0)           p.vx += 0.5;
        if (p.x + hw > size.w)      p.vx -= 0.5;
        if (p.y - hh < 4)           p.vy += 0.5;
        if (p.y + hh > size.h - 4)  p.vy -= 0.5;

        p.vx *= DAMPING;
        p.vy *= DAMPING;
        p.x  += p.vx;
        p.y  += p.vy;

        // Draw
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha  = p.current ? 0.92 : 0.65;
        ctx.fillStyle    = p.current ? CHAMPAGNE : DIM_WHITE;
        ctx.fillText(p.name, p.x, p.y);
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [size, reducedMotion]);

  /* ── static fallback ───────────────────────────────────────────── */
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
      <div className="collab-gravity-field" style={{ height: size.h || 380 }}>
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
      <ul className="visually-hidden">
        {COLLABORATORS.map((c) => <li key={c.name}>{c.name}</li>)}
      </ul>
    </section>
  );
}
