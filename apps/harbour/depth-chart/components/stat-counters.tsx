"use client";

import { useEffect, useRef, useState } from "react";

const stats = [
  { value: 6, label: "cognitive levels", suffix: "" },
  { value: 11, label: "task formats", suffix: "" },
  { value: 4, label: "export formats", suffix: "" },
];

function useCountUp(target: number, active: boolean, duration = 800) {
  const [count, set_count] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      set_count(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);

  return count;
}

export default function StatCounters() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, set_visible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          set_visible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="flex items-center justify-center gap-8 sm:gap-12"
    >
      {stats.map((stat, i) => (
        <StatItem key={stat.label} stat={stat} active={visible} delay={i * 150} />
      ))}
    </div>
  );
}

function StatItem({
  stat,
  active,
  delay,
}: {
  stat: (typeof stats)[number];
  active: boolean;
  delay: number;
}) {
  const [started, set_started] = useState(false);
  const count = useCountUp(stat.value, started);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => set_started(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);

  return (
    <div className="text-center">
      <span className="text-2xl sm:text-3xl font-extrabold text-[var(--wv-champagne)] tabular-nums">
        {count}
        {stat.suffix}
      </span>
      <p className="text-[10px] text-[var(--color-text-on-dark-muted)] mt-0.5">
        {stat.label}
      </p>
    </div>
  );
}
