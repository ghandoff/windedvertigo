"use client";
import { useEffect, useRef, useState } from "react";
import { COLLABORATORS } from "@/lib/collaborators";

/**
 * #11 — Gravitational Orbit
 *
 * Each collaborator is a particle floating in a contained field. A spring
 * force pulls particles toward the centre; damping prevents collapse.
 * Hovering the section strengthens gravity, pulling everything inward.
 * Current partners orbit closer (heavier mass → stronger pull back).
 *
 * Rendered on a Canvas for performance (no DOM thrashing per frame).
 * Names rendered via Canvas 2D text — no images in this variant.
 *
 * UDL: prefers-reduced-motion → static scattered layout via CSS.
 */

const CHAMPAGNE = "#ffebd2";
const DIM_WHITE = "rgba(255,255,255,0.38)";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  name: string;
  current: boolean;
  homeX: number;
  homeY: number;
  textWidth: number;
}

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function CollabGravity() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const hoveredRef = useRef(false);
  const rafRef = useRef<number>(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 300 });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Measure container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      const h = Math.max(280, Math.min(400, width * 0.75));
      setSize({ w: width, h });
    });
    obs.observe(canvas.parentElement!);
    return () => obs.disconnect();
  }, []);

  // Init particles when size is known
  useEffect(() => {
    if (reducedMotion || size.w === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = size.w + "px";
    canvas.style.height = size.h + "px";
    ctx.scale(dpr, dpr);

    const fontSize = Math.max(11, Math.min(14, size.w / 30));
    ctx.font = `${fontSize}px "DM Mono", monospace`;

    const rnd = seedRandom(42);
    const cx = size.w / 2;
    const cy = size.h / 2;

    particlesRef.current = COLLABORATORS.map((c) => {
      const angle = rnd() * Math.PI * 2;
      // Current partners: inner ring; past: outer ring
      const maxR = Math.min(cx, cy) * (c.current ? 0.45 : 0.82);
      const r = maxR * (0.6 + rnd() * 0.4);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      const tw = ctx.measureText(c.name).width;
      return {
        x, y,
        vx: (rnd() - 0.5) * 0.4,
        vy: (rnd() - 0.5) * 0.4,
        name: c.name,
        current: c.current,
        homeX: x,
        homeY: y,
        textWidth: tw,
      };
    });
  }, [size, reducedMotion]);

  // Animation loop
  useEffect(() => {
    if (reducedMotion || size.w === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    const fontSize = Math.max(11, Math.min(14, size.w / 30));
    const cx = size.w / 2;
    const cy = size.h / 2;

    const draw = () => {
      ctx.clearRect(0, 0, size.w * dpr, size.h * dpr);
      ctx.font = `${fontSize}px "DM Mono", monospace`;

      const gravity = hoveredRef.current ? 0.025 : 0.006;
      const damping = 0.985;
      const wanderForce = 0.03;

      for (const p of particlesRef.current) {
        // Spring toward home position (simulates orbit returning)
        const dx = cx - p.x;
        const dy = cy - p.y;
        p.vx += dx * gravity;
        p.vy += dy * gravity;

        // Tiny random wander
        p.vx += (Math.random() - 0.5) * wanderForce;
        p.vy += (Math.random() - 0.5) * wanderForce;

        // Damping
        p.vx *= damping;
        p.vy *= damping;

        // Clamp to canvas
        const pad = 8;
        if (p.x < pad || p.x > size.w - pad) p.vx *= -0.5;
        if (p.y < pad || p.y > size.h - pad) p.vy *= -0.5;

        p.x += p.vx;
        p.y += p.vy;

        // Draw
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = p.current ? CHAMPAGNE : DIM_WHITE;
        ctx.globalAlpha = p.current ? 0.9 : 0.45;
        ctx.fillText(p.name, p.x, p.y);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [size, reducedMotion]);

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
      onMouseEnter={() => { hoveredRef.current = true; }}
      onMouseLeave={() => { hoveredRef.current = false; }}
      onTouchStart={() => { hoveredRef.current = true; }}
      onTouchEnd={() => { hoveredRef.current = false; }}
    >
      <p className="collab-variant-label">organisations we play with</p>
      <div className="collab-gravity-field" style={{ height: size.h || 300 }}>
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
      {/* SR-only list for accessibility */}
      <ul className="visually-hidden">
        {COLLABORATORS.map((c) => <li key={c.name}>{c.name}</li>)}
      </ul>
    </section>
  );
}
