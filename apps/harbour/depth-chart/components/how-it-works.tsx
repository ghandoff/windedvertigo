"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  {
    step: "1",
    title: "upload",
    desc: "paste or upload your lesson plan, syllabus, or course outline",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M12 16V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    step: "2",
    title: "parse",
    desc: "we extract learning objectives and classify them on Bloom's taxonomy",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    step: "3",
    title: "generate",
    desc: "each objective gets a constructively aligned assessment task with rubric",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    step: "4",
    title: "scaffold",
    desc: "every task includes an evaluative judgment scaffold for student self-assessment",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 4L12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, set_visible] = useState<boolean[]>(new Array(steps.length).fill(false));

  useEffect(() => {
    if (!ref.current) return;
    const cards = ref.current.querySelectorAll("[data-step]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.step);
            set_visible((prev) => {
              const next = [...prev];
              next[idx] = true;
              return next;
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative max-w-2xl mx-auto">
      {/* connecting line */}
      <div className="absolute left-6 top-0 bottom-0 w-px bg-white/10 hidden sm:block" />

      <div className="space-y-6">
        {steps.map((item, i) => (
          <div
            key={item.step}
            data-step={i}
            className="relative flex gap-5 items-start transition-all duration-700 ease-out"
            style={{
              opacity: visible[i] ? 1 : 0,
              transform: visible[i] ? "translateY(0)" : "translateY(24px)",
              transitionDelay: `${i * 120}ms`,
            }}
          >
            {/* step circle on the line */}
            <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-white/5 border border-white/15 flex items-center justify-center text-[var(--wv-champagne)]">
              {item.icon}
            </div>

            <div className="pt-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[var(--wv-champagne)] tracking-wider">
                  {item.step.padStart(2, "0")}
                </span>
                <h3 className="text-sm font-semibold text-[var(--color-text-on-dark)]">
                  {item.title}
                </h3>
              </div>
              <p className="text-xs text-[var(--color-text-on-dark-muted)] leading-relaxed max-w-sm">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
