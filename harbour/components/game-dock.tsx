"use client";

import { useState, useEffect, useRef } from "react";
import type { Game } from "./game-showcase";

interface GameDockProps {
  games: Game[];
}

function DockCard({
  game,
  isActive,
  onClick,
  index,
}: {
  game: Game;
  isActive: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-expanded={isActive}
      aria-controls={`dock-detail-${game.slug}`}
      className={`game-card dock-card group relative rounded-2xl overflow-hidden ${game.image ? "" : `bg-gradient-to-br ${game.color}`} p-6 sm:p-8 border text-left transition-all duration-300 flex flex-col justify-between aspect-[5/3] ${
        isActive
          ? "border-white/20 shadow-2xl ring-2 ring-white/10 scale-[1.02]"
          : "border-white/5 shadow-lg hover:border-white/10"
      }`}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      {game.image && (
        <>
          <img
            src={game.image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40" />
        </>
      )}
      <div className="relative z-10">
        {game.icon && <span className="text-3xl sm:text-4xl block mb-3">{game.icon}</span>}
        <h3 className="text-lg sm:text-xl font-bold text-[var(--color-text-on-dark)] tracking-tight mb-1">
          {game.name}
        </h3>
        <p className="text-xs sm:text-sm text-[var(--color-text-on-dark-muted)] tracking-wider">
          {game.tagline}
        </p>
      </div>
      <div className="relative z-10 flex items-center justify-end">
        <span
          className={`text-[var(--color-text-on-dark-muted)] text-sm transition-transform duration-200 ${
            isActive ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </div>
    </button>
  );
}

function DockDetail({ game, isOpen }: { game: Game; isOpen: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      id={`dock-detail-${game.slug}`}
      role="region"
      aria-label={`${game.name} details`}
      className="overflow-hidden transition-[max-height,opacity] duration-500 ease-out"
      style={{
        maxHeight: isOpen ? `${ref.current?.scrollHeight ?? 600}px` : "0px",
        opacity: isOpen ? 1 : 0,
      }}
    >
      <div ref={ref} className="pt-6 pb-2">
        <div className="max-w-4xl mx-auto flex flex-col lg:flex-row gap-6 lg:gap-10">
          <p className="text-lg leading-relaxed text-[var(--color-text-on-dark)] lg:w-1/2">
            {game.description}
          </p>
          <div className="lg:w-1/2">
            <ul className="space-y-2.5">
              {game.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 text-[var(--color-text-on-dark-muted)] text-sm"
                >
                  <span
                    className={`${game.accentColor} w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0`}
                  />
                  {feature}
                </li>
              ))}
            </ul>
            {game.status === "live" && (
              <a
                href={game.href}
                className={`inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-full ${game.accentColor} text-[var(--color-text-on-dark)] text-sm font-semibold hover:brightness-110 transition-all no-underline`}
              >
                open {game.name}
                <span aria-hidden="true">&rarr;</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GameDock({ games }: GameDockProps) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  // staggered entrance
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) {
      el.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toggle = (slug: string) =>
    setActiveSlug((prev) => (prev === slug ? null : slug));

  const activeGame = games.find((g) => g.slug === activeSlug);

  return (
    <div
      ref={dockRef}
      className="dock-entrance max-w-5xl mx-auto px-6 py-16 sm:py-20"
    >
      <p className="text-sm text-[var(--color-text-on-dark-muted)] text-center mb-6">
        tap a card to see what&apos;s inside.
      </p>

      {/* 2x2 grid on desktop, 2-col on tablet, stacked on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {games.map((game, i) => (
          <DockCard
            key={game.slug}
            game={game}
            isActive={activeSlug === game.slug}
            onClick={() => toggle(game.slug)}
            index={i}
          />
        ))}
      </div>

      {/* expanded detail panel — sits below the grid */}
      {games.map((game) => (
        <DockDetail
          key={game.slug}
          game={game}
          isOpen={activeSlug === game.slug}
        />
      ))}
    </div>
  );
}
