import gamesData from "@/data/games.json";
import { ScrollReveal } from "./scroll-reveal";

export interface Game {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  color: string;          // tailwind bg gradient from
  accentColor: string;    // pill/badge color
  icon: string;           // emoji or short text for the card icon
  features: string[];
  href: string;
  status: "live" | "coming-soon";
}

/** Games loaded from Notion-synced JSON. Sorted by `order` field. */
export const GAMES: Game[] = gamesData as Game[];

function GameCard({ game, index }: { game: Game; index: number }) {
  // Alternate layout direction for visual rhythm
  const isEven = index % 2 === 0;

  return (
    <section
      id={game.slug}
      aria-label={game.name}
      className="flex items-center py-10 sm:py-14"
    >
      <div
        className={`w-full max-w-6xl mx-auto px-6 flex flex-col ${
          isEven ? "lg:flex-row" : "lg:flex-row-reverse"
        } gap-6 lg:gap-10 items-center`}
      >
        {/* Visual card */}
        <ScrollReveal className="w-full lg:w-5/12 flex-shrink-0">
          <a
            href={game.href}
            className={`game-card block rounded-3xl bg-gradient-to-br ${game.color} p-8 sm:p-10 aspect-[4/3] flex flex-col justify-between border border-white/5 shadow-2xl no-underline`}
          >
            <div>
              <span className="text-5xl sm:text-6xl block mb-4">
                {game.icon}
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-on-dark)] mb-2 tracking-tight">
                {game.name}
              </h3>
              <p className="text-sm font-medium text-[var(--color-text-on-dark-muted)] tracking-wider uppercase">
                {game.tagline}
              </p>
            </div>
            <div className="flex items-center justify-between mt-8">
              {game.status === "live" ? (
                <span
                  className={`${game.accentColor} text-[var(--color-text-on-dark)] text-xs font-semibold px-3 py-1 rounded-full`}
                >
                  play now
                </span>
              ) : (
                <span className="bg-white/10 text-[var(--color-text-on-dark-muted)] text-xs font-semibold px-3 py-1 rounded-full">
                  coming soon
                </span>
              )}
              <span className="text-[var(--color-text-on-dark-muted)] text-sm">&rarr;</span>
            </div>
          </a>
        </ScrollReveal>

        {/* Description */}
        <ScrollReveal className="w-full lg:w-7/12">
          <div className="max-w-lg">
            <p className="text-lg sm:text-xl leading-relaxed text-[var(--color-text-on-dark)] mb-6">
              {game.description}
            </p>
            <ul className="space-y-3">
              {game.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 text-[var(--color-text-on-dark-muted)] text-sm sm:text-base"
                >
                  <span
                    className={`${game.accentColor} w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0`}
                  />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export function GameShowcase() {
  return (
    <div className="divide-y divide-white/5">
      {GAMES.map((game, i) => (
        <GameCard key={game.slug} game={game} index={i} />
      ))}
    </div>
  );
}
