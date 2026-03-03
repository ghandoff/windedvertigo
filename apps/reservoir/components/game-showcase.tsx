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
  badge?: string;         // custom badge text (defaults to "play now")
}

const GAMES: Game[] = [
  {
    slug: "creaseworks",
    name: "creaseworks",
    tagline: "co-design playdates",
    description:
      "a platform where facilitators and participants co-create playful learning experiences together. run playdates, collect real-time evidence of engagement, and iterate designs based on what actually happens when people play.",
    color: "from-[#cb7858] to-[#a86244]",
    accentColor: "bg-[var(--wv-redwood)]",
    icon: "\uD83C\uDFA8",
    features: [
      "guided playdate facilitation",
      "real-time evidence collection",
      "co-play reflection tools",
      "design iteration workflows",
    ],
    href: "/reservoir/creaseworks",
    status: "live",
  },
  {
    slug: "vertigo-vault",
    name: "vertigo.vault",
    tagline: "curated group energizers",
    description:
      "a growing collection of group activities, ice-breakers, and energizers \u2014 curated from years of facilitation across cultures and contexts. find the right activity for any group size, energy level, or learning goal.",
    color: "from-[#b15043] to-[#8c3e33]",
    accentColor: "bg-[var(--wv-sienna)]",
    icon: "\u26A1",
    features: [
      "searchable activity library",
      "tagged by group size and energy",
      "field-tested across cultures",
      "continuously growing collection",
    ],
    href: "/reservoir/vertigo-vault",
    status: "live",
  },
  {
    slug: "deep-deck",
    name: "deep.deck",
    tagline: "conversations that connect",
    description:
      "a digital card game that helps teachers and parents break through \"today was fine\" and connect with children ages 6\u201314 through layered conversation prompts, playful mini-games, and wild-card modifiers that lower the stakes of vulnerable questions. try the free sampler or unlock the full 128-card deck.",
    color: "from-[#273248] to-[#1c2438]",
    accentColor: "bg-[var(--wv-redwood)]",
    icon: "\uD83C\uDCCF",
    features: [
      "free sampler with 36 cards across all age bands",
      "full deck: 128 cards + 32 wild modifiers",
      "deep \u2192 deeper \u2192 deepest progression",
      "4 age bands: 6\u20138, 9\u201310, 11\u201312, 13\u201314",
    ],
    href: "/reservoir/deep-deck",
    status: "live",
    badge: "try free",
  },
];

function GameCard({ game, index }: { game: Game; index: number }) {
  // Alternate layout direction for visual rhythm
  const isEven = index % 2 === 0;

  return (
    <section
      id={game.slug}
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
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                {game.name}
              </h3>
              <p className="text-sm font-medium text-white/60 tracking-wider uppercase">
                {game.tagline}
              </p>
            </div>
            <div className="flex items-center justify-between mt-8">
              {game.status === "live" ? (
                <span
                  className={`${game.accentColor} text-white text-xs font-semibold px-3 py-1 rounded-full`}
                >
                  {game.badge || "play now"}
                </span>
              ) : (
                <span className="bg-white/10 text-white/50 text-xs font-semibold px-3 py-1 rounded-full">
                  coming soon
                </span>
              )}
              <span className="text-white/40 text-sm">&rarr;</span>
            </div>
          </a>
        </ScrollReveal>

        {/* Description */}
        <ScrollReveal className="w-full lg:w-7/12">
          <div className="max-w-lg">
            <p className="text-lg sm:text-xl leading-relaxed text-white mb-6">
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
            <a
              href={game.href}
              className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-full bg-[var(--color-accent)] text-white text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors no-underline"
            >
              explore {game.name}
              <span aria-hidden="true">&rarr;</span>
            </a>
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
