"use client";

import { useRouter } from "next/navigation";
import type { AgeBand, PackId } from "@/lib/types";
import { AGE_BAND_LABELS } from "@/lib/types";
import { PACKS, formatPrice } from "@/lib/packs";
import { getDeckSize, getTotalDeckSize } from "@/lib/deck";
import { useAccess } from "@/lib/use-access";
import { PackCard } from "@/components/pack-card";

const AGE_BANDS: AgeBand[] = ["6-8", "9-10", "11-12", "13-14"];

export default function HomePage() {
  const router = useRouter();
  const { entitlements, hasFullDeck, isSamplerOnly } = useAccess();

  function handlePackSelect(packId: PackId) {
    if (packId === "sampler") {
      router.push("/play/pick");
    } else {
      router.push("/checkout");
    }
  }

  function handlePlayNow(band: AgeBand) {
    router.push(`/play?band=${band}`);
  }

  return (
    <div className="min-h-screen">
      {/* ── Hero ── */}
      <section className="relative px-4 pt-10 pb-16 sm:pt-20 sm:pb-24 text-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 20%, var(--dd-redwood) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-full bg-[var(--dd-redwood)] flex items-center justify-center">
              <span className="text-2xl font-bold text-white">DD</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-[var(--dd-cadet)]">
              deep.deck
            </h1>
          </div>

          <p className="text-lg sm:text-xl text-[var(--dd-cadet)]/70 leading-relaxed max-w-xl mx-auto mb-4">
            A digital card game that breaks through &ldquo;today was fine&rdquo;
            and helps you connect with children ages 6&ndash;14 through layered
            conversations, playful games, and wild-card surprises.
          </p>

          <p className="text-sm text-[var(--dd-cadet)]/50 mb-8">
            Designed by developmental psychologists and learning scientists
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            {hasFullDeck ? (
              <button
                onClick={() => router.push("/play/pick")}
                className="px-8 py-3 rounded-xl text-sm font-semibold bg-[var(--dd-redwood)] text-white hover:bg-[var(--dd-redwood)]/90 transition-colors"
              >
                Play Now
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.push("/play/pick")}
                  className="px-6 py-3 rounded-xl text-sm font-semibold bg-[var(--dd-cadet)] text-white hover:bg-[var(--dd-cadet)]/90 transition-colors"
                >
                  Try Free Sampler
                </button>
                <button
                  onClick={() => {
                    document.getElementById("packs")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-6 py-3 rounded-xl text-sm font-semibold bg-[var(--dd-redwood)] text-white hover:bg-[var(--dd-redwood)]/90 transition-colors"
                >
                  Get the Full Deck &mdash; {formatPrice(PACKS.full.priceCents)}
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-4 py-16 sm:py-20 bg-white/60">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--dd-cadet)] text-center mb-12">
            How it works
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Pick an age band",
                desc: "Choose from ages 6\u20138, 9\u201310, 11\u201312, or 13\u201314. Each band has cards designed for that developmental stage.",
              },
              {
                step: "2",
                title: "Flip & explore",
                desc: "Tap a card to reveal a prompt. Go Deep, Deeper, or Deepest \u2014 follow the conversation wherever it goes.",
              },
              {
                step: "3",
                title: "Play wild cards",
                desc: "Wild cards turn vulnerable questions into play \u2014 answer in an animal voice, draw your answer, or swap roles.",
              },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[var(--dd-redwood)] text-white text-lg font-bold flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-[var(--dd-cadet)] mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-[var(--dd-cadet)]/60 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Age bands ── */}
      <section className="px-4 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--dd-cadet)] text-center mb-4">
            4 age bands, 128 cards
          </h2>
          <p className="text-center text-[var(--dd-cadet)]/60 mb-12 max-w-lg mx-auto">
            Every card is developmentally-sequenced for its age band &mdash; the
            same concept adapts to meet children where they are.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {AGE_BANDS.map((band) => {
              const { grades, label } = AGE_BAND_LABELS[band];
              const samplerSize = getDeckSize(band, ["sampler"]);
              const fullSize = getDeckSize(band, ["sampler", "full"]);

              return (
                <button
                  key={band}
                  onClick={() => handlePlayNow(band)}
                  className="bg-white rounded-2xl border border-[var(--dd-cadet)]/10 p-5 text-left hover:border-[var(--dd-redwood)]/40 hover:shadow-md transition-all"
                >
                  <p className="text-lg font-bold text-[var(--dd-cadet)]">
                    {label}
                  </p>
                  <p className="text-xs text-[var(--dd-cadet)]/50 mt-1">
                    Grades {grades}
                  </p>
                  <p className="text-xs text-[var(--dd-redwood)] font-medium mt-3">
                    {isSamplerOnly ? `${samplerSize} free cards` : `${fullSize} cards`}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Packs / pricing ── */}
      {isSamplerOnly && (
        <section id="packs" className="px-4 py-16 sm:py-20 bg-white/60">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--dd-cadet)] text-center mb-4">
              Choose your deck
            </h2>
            <p className="text-center text-[var(--dd-cadet)]/60 mb-12 max-w-lg mx-auto">
              Start free with the sampler, or unlock the complete deep.deck
              experience with every card across all age bands.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <PackCard
                packId="sampler"
                isOwned={false}
                onSelect={handlePackSelect}
              />
              <PackCard
                packId="full"
                isOwned={false}
                onSelect={handlePackSelect}
                featured
              />
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
