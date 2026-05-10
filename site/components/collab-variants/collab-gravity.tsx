"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { COLLABORATORS } from "@/lib/collaborators";

/**
 * #11 — Gravitational Swarm (v4)
 *
 * Logos drift in a loose swarm pulled gently toward the canvas center
 * (gravity well). On hover/touch, the cursor acts as a repulsive mass —
 * logos scatter outward then slowly drift back. Each logo also has a tiny
 * random walk so the swarm is never static.
 *
 * No rigid rings. The motion should feel biological — like a murmuration
 * that has one loose attractor.
 *
 * WCAG:
 * - 2.2.2: visible pause button (auto-playing loop)
 * - prefers-reduced-motion: static logo grid
 * - sr-only list for screen readers
 * - Logos drawn as white silhouettes via canvas filter (consistent with tide)
 */

const ICON_R      = 20;    // logo circle radius (40px diameter)
const DAMPING     = 0.978;
// Soft orbit zone: logos are repelled from center if too close, attracted if too far.
// This prevents collapse — logos swarm within a visible toroidal band.
const ORBIT_MIN   = 80;   // px from center: inside this → push outward
const ORBIT_MAX_F = 0.70; // fraction of canvas half-width: outside this → pull inward
const ORBIT_K     = 0.007;
const SEP_MIN     = 62;   // min center-to-center gap before repulsion
const SEP_K       = 0.40;
const WANDER      = 0.018;
const SPEED_MAX   = 1.6;
const MOUSE_R     = 150;
const MOUSE_K     = 0.16;

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  current: boolean;
  img: HTMLImageElement;
  name: string;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function CollabGravity() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const pRef         = useRef<Particle[]>([]);
  const rafRef       = useRef<number>(0);
  const mouseRef     = useRef({ x: 0, y: 0, active: false });
  const isPausedRef  = useRef(false);
  const wanderRng    = useRef(seededRandom(77));
  const [paused, setPaused]             = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [size, setSize]                 = useState({ w: 0, h: 0 });

  const togglePause = useCallback(() => {
    setPaused(p => { isPausedRef.current = !p; return !p; });
  }, []);

  /* ── reduced-motion ──────────────────────────────────────────── */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  /* ── container measurement ───────────────────────────────────── */
  useEffect(() => {
    const wrap = canvasRef.current?.parentElement;
    if (!wrap) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const h = Math.max(440, Math.min(580, w * 1.05));
      setSize({ w, h });
    });
    obs.observe(wrap);
    return () => obs.disconnect();
  }, []);

  /* ── particle init ───────────────────────────────────────────── */
  useEffect(() => {
    if (reducedMotion || size.w === 0) return;
    const rng = seededRandom(42);
    const cx = size.w / 2;
    const cy = size.h / 2;
    // Distribute logos evenly around a ring at ~55% canvas half-width so they
    // start spread out. Small jitter prevents perfect symmetry.
    const baseR  = Math.min(cx, cy) * 0.62;
    const total  = COLLABORATORS.length;

    pRef.current = COLLABORATORS.map((c, i) => {
      const angle = (i / total) * Math.PI * 2 + (rng() - 0.5) * 0.4;
      const r     = baseR + (rng() - 0.5) * baseR * 0.35;
      const img   = new Image();
      if (c.logoPath) img.src = c.logoPath;
      // Give each logo a slight tangential kick so the swarm starts moving
      const tx = -Math.sin(angle) * (0.4 + rng() * 0.5);
      const ty =  Math.cos(angle) * (0.4 + rng() * 0.5);
      return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: tx,
        vy: ty,
        current: c.current,
        img,
        name: c.name,
      };
    });
    wanderRng.current = seededRandom(77);
  }, [size, reducedMotion]);

  /* ── animation loop ──────────────────────────────────────────── */
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

    const cx  = size.w / 2;
    const cy  = size.h / 2;
    const rng = wanderRng.current;

    const frame = () => {
      ctx.clearRect(0, 0, size.w, size.h);
      const ps = pRef.current;
      if (!ps.length) { rafRef.current = requestAnimationFrame(frame); return; }

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];

        if (!isPausedRef.current) {
          // Soft orbit zone: repel if too close to center, attract if too far.
          // Zero net force inside the comfortable band — prevents collapse.
          const dx = cx - p.x;
          const dy = cy - p.y;
          const dc = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = dx / dc;
          const ny = dy / dc;
          const orbitMax = Math.min(cx, cy) * ORBIT_MAX_F;
          if (dc < ORBIT_MIN) {
            // Inside minimum radius → push outward
            p.vx -= nx * ORBIT_K * (ORBIT_MIN - dc);
            p.vy -= ny * ORBIT_K * (ORBIT_MIN - dc);
          } else if (dc > orbitMax) {
            // Outside maximum radius → pull inward
            p.vx += nx * ORBIT_K * (dc - orbitMax);
            p.vy += ny * ORBIT_K * (dc - orbitMax);
          }

          // Mouse/touch repulsion — scatter on hover
          const m = mouseRef.current;
          if (m.active) {
            const mdx = p.x - m.x;
            const mdy = p.y - m.y;
            const md = Math.sqrt(mdx * mdx + mdy * mdy) || 1;
            if (md < MOUSE_R) {
              const f = ((MOUSE_R - md) / MOUSE_R) ** 2 * MOUSE_K;
              p.vx += (mdx / md) * f;
              p.vy += (mdy / md) * f;
            }
          }

          // Inter-logo separation
          for (let j = i + 1; j < ps.length; j++) {
            const q   = ps[j];
            const rdx = p.x - q.x;
            const rdy = p.y - q.y;
            const rd  = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
            if (rd < SEP_MIN) {
              const f  = (SEP_MIN - rd) / SEP_MIN * SEP_K;
              const fx = (rdx / rd) * f;
              const fy = (rdy / rd) * f;
              p.vx += fx; p.vy += fy;
              q.vx -= fx; q.vy -= fy;
            }
          }

          // Random wander
          p.vx += (rng() - 0.5) * WANDER;
          p.vy += (rng() - 0.5) * WANDER;

          // Speed cap
          const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (spd > SPEED_MAX) { p.vx = p.vx / spd * SPEED_MAX; p.vy = p.vy / spd * SPEED_MAX; }

          // Damping + soft boundary bounce
          p.vx *= DAMPING; p.vy *= DAMPING;
          const pad = ICON_R + 8;
          if (p.x < pad)           p.vx += 0.5;
          if (p.x > size.w - pad)  p.vx -= 0.5;
          if (p.y < pad)           p.vy += 0.5;
          if (p.y > size.h - pad)  p.vy -= 0.5;

          p.x += p.vx;
          p.y += p.vy;
        }

        // Draw logo as white silhouette circle
        ctx.save();
        ctx.globalAlpha = p.current ? 0.80 : 0.46;
        if (p.img.complete && p.img.naturalWidth > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, ICON_R, 0, Math.PI * 2);
          ctx.clip();
          ctx.filter = "brightness(0) invert(1)";
          ctx.drawImage(p.img, p.x - ICON_R, p.y - ICON_R, ICON_R * 2, ICON_R * 2);
          ctx.filter = "none";
        } else {
          // Placeholder dot while image loads
          ctx.beginPath();
          ctx.arc(p.x, p.y, ICON_R * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = p.current ? "rgba(255,235,210,0.5)" : "rgba(255,255,255,0.3)";
          ctx.fill();
        }
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [size, reducedMotion]);

  /* ── static fallback ─────────────────────────────────────────── */
  if (reducedMotion) {
    return (
      <section className="collab-variant collab-gravity--static" aria-label="organisations we play with">
        <p className="collab-variant-label">organisations we play with</p>
        <ul className="collab-gravity-static-list">
          {COLLABORATORS.map((c) => (
            <li key={c.name} className={c.current ? "tw-current" : "tw-past"}>
              {c.logoPath
                ? <img src={c.logoPath} alt={c.name} className="gravity-static-logo" />
                : c.name}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section
      className="collab-variant collab-gravity"
      aria-label="organisations we play with"
      onMouseMove={e => {
        const r = e.currentTarget.getBoundingClientRect();
        mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top, active: true };
      }}
      onMouseLeave={() => { mouseRef.current.active = false; }}
      onTouchMove={e => {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        mouseRef.current = { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top, active: true };
      }}
      onTouchEnd={() => { mouseRef.current.active = false; }}
    >
      <p className="collab-variant-label">organisations we play with</p>
      <div className="collab-gravity-field" style={{ height: size.h || 480 }}>
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
      <div className="gravity-controls">
        <button
          className={`gravity-pause-btn${paused ? " gravity-pause-btn--paused" : ""}`}
          onClick={togglePause}
          aria-label={paused ? "resume animation" : "pause animation"}
          aria-pressed={paused}
        >
          {paused ? "▶ resume" : "⏸ pause"}
        </button>
      </div>
      <ul className="visually-hidden">
        {COLLABORATORS.map(c => <li key={c.name}>{c.name}</li>)}
      </ul>
    </section>
  );
}
