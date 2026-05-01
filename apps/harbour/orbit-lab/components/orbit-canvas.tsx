"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Orbiter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number }[];
}

const PLANET_RADIUS = 20;
const ORBITER_RADIUS = 4;
const MAX_TRAIL = 120;
const MAX_DISTANCE = 600;
const BASE_GM = 8000;

export default function OrbitCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitersRef = useRef<Orbiter[]>([]);
  const gravityRef = useRef(1);
  const [gravity, setGravity] = useState(1);
  const [count, setCount] = useState(0);
  const sizeRef = useRef({ w: 600, h: 400 });

  useEffect(() => {
    gravityRef.current = gravity;
  }, [gravity]);

  const getColours = useCallback(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      sienna: s.getPropertyValue("--wv-sienna").trim() || "#cb7858",
      champagne: s.getPropertyValue("--wv-champagne").trim() || "#ffebd2",
      cadet: s.getPropertyValue("--wv-cadet").trim() || "#273248",
      surface: s.getPropertyValue("--color-surface-raised").trim() || "#1e1e2e",
    };
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.min(w * 0.7, 500);
    canvas.width = w * devicePixelRatio;
    canvas.height = h * devicePixelRatio;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    sizeRef.current = { w, h };
  }, []);

  useEffect(() => {
    resize();
    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [resize]);

  // physics + render loop
  useEffect(() => {
    let animId: number;
    const loop = () => {
      animId = requestAnimationFrame(loop);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { w, h } = sizeRef.current;
      const dpr = devicePixelRatio;
      const cx = w / 2;
      const cy = h / 2;
      const colours = getColours();
      const GM = BASE_GM * gravityRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // background
      ctx.fillStyle = colours.cadet;
      ctx.fillRect(0, 0, w, h);

      // planet glow
      const glow = ctx.createRadialGradient(cx, cy, PLANET_RADIUS * 0.5, cx, cy, PLANET_RADIUS * 4);
      glow.addColorStop(0, colours.sienna + "80");
      glow.addColorStop(0.5, colours.sienna + "20");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, PLANET_RADIUS * 4, 0, Math.PI * 2);
      ctx.fill();

      // planet
      const planetGrad = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, PLANET_RADIUS);
      planetGrad.addColorStop(0, colours.champagne);
      planetGrad.addColorStop(1, colours.sienna);
      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, PLANET_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // update and draw orbiters
      const dt = 1 / 60;
      const toRemove: number[] = [];

      orbitersRef.current.forEach((orb, i) => {
        const dx = cx - orb.x;
        const dy = cy - orb.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        // remove if hit planet or too far
        if (dist < PLANET_RADIUS + ORBITER_RADIUS || dist > MAX_DISTANCE) {
          toRemove.push(i);
          return;
        }

        // gravity
        const force = GM / distSq;
        const ax = force * (dx / dist);
        const ay = force * (dy / dist);
        orb.vx += ax * dt;
        orb.vy += ay * dt;
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;

        // trail
        orb.trail.push({ x: orb.x, y: orb.y });
        if (orb.trail.length > MAX_TRAIL) orb.trail.shift();

        // draw trail
        if (orb.trail.length > 1) {
          for (let t = 1; t < orb.trail.length; t++) {
            const alpha = (t / orb.trail.length) * 0.6;
            ctx.strokeStyle = colours.champagne + Math.round(alpha * 255).toString(16).padStart(2, "0");
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(orb.trail[t - 1].x, orb.trail[t - 1].y);
            ctx.lineTo(orb.trail[t].x, orb.trail[t].y);
            ctx.stroke();
          }
        }

        // draw orbiter
        ctx.fillStyle = colours.champagne;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, ORBITER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      });

      // remove dead orbiters (reverse order)
      for (let i = toRemove.length - 1; i >= 0; i--) {
        orbitersRef.current.splice(toRemove[i], 1);
      }
      if (toRemove.length > 0) {
        setCount(orbitersRef.current.length);
      }
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [getColours]);

  const spawn = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const { w, h } = sizeRef.current;
    const cx = w / 2;
    const cy = h / 2;

    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < PLANET_RADIUS + 5) return;

    // velocity perpendicular to radial line, scaled for roughly circular orbit
    const orbitalSpeed = Math.sqrt(BASE_GM * gravityRef.current / dist) * 0.9;
    const nx = dx / dist;
    const ny = dy / dist;
    // perpendicular (counter-clockwise)
    const vx = -ny * orbitalSpeed;
    const vy = nx * orbitalSpeed;

    orbitersRef.current.push({ x, y, vx, vy, trail: [{ x, y }] });
    setCount(orbitersRef.current.length);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    spawn(e.clientX, e.clientY);
  };

  const handleTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0] || e.changedTouches[0];
    spawn(touch.clientX, touch.clientY);
  };

  const clearAll = () => {
    orbitersRef.current = [];
    setCount(0);
  };

  const btnClass =
    "px-3 py-1.5 text-sm rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-[var(--color-text-on-dark)] cursor-pointer";

  return (
    <div ref={containerRef} className="w-full">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button onClick={clearAll} className={btnClass}>
          clear all
        </button>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--color-text-on-dark-muted)]" htmlFor="gravity-slider">
            gravity:
          </label>
          <input
            id="gravity-slider"
            type="range"
            min="0.2"
            max="3"
            step="0.1"
            value={gravity}
            onChange={(e) => setGravity(parseFloat(e.target.value))}
            className="w-24 accent-[var(--wv-sienna)]"
          />
          <span className="text-xs text-[var(--color-text-on-dark-muted)] w-8">
            {gravity.toFixed(1)}x
          </span>
        </div>
        <span className="ml-auto text-sm text-[var(--color-text-on-dark-muted)]">
          orbiters: {count}
        </span>
      </div>

      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onTouchStart={handleTouch}
          className="w-full cursor-crosshair block"
          style={{ touchAction: "none" }}
        />
      </div>

      <p className="text-xs text-[var(--color-text-on-dark-muted)] mt-3 text-center">
        click or tap anywhere to launch an orbiter
      </p>
    </div>
  );
}
