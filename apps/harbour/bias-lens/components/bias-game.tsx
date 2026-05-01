"use client";

import { useState, useCallback } from "react";

type Stage =
  | "intro"
  | "scenario1"
  | "reveal1"
  | "scenario2"
  | "reveal2"
  | "scenario3"
  | "reveal3"
  | "summary";

const STAGES: Stage[] = [
  "intro",
  "scenario1",
  "reveal1",
  "scenario2",
  "reveal2",
  "scenario3",
  "reveal3",
  "summary",
];

function scenarioIndex(stage: Stage): number {
  if (stage.includes("1")) return 1;
  if (stage.includes("2")) return 2;
  if (stage.includes("3")) return 3;
  return 0;
}

function ProgressDots({ stage }: { stage: Stage }) {
  const idx = STAGES.indexOf(stage);
  if (idx <= 0 || stage === "summary") return null;
  const current = scenarioIndex(stage) || 1;
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="flex items-center gap-2"
        >
          <div
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              n < current
                ? "bg-[var(--wv-sienna)]"
                : n === current
                ? "bg-[var(--wv-champagne)]"
                : "bg-white/20"
            }`}
          />
          {n < 3 && <div className="w-6 h-px bg-white/10" />}
        </div>
      ))}
      <span className="ml-3 text-xs text-[var(--color-text-on-dark-muted)]">
        {current} of 3
      </span>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-[var(--color-surface-raised)] p-6 sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
}

export default function BiasGame() {
  const [stage, setStage] = useState<Stage>("intro");
  const [donation, setDonation] = useState(100);
  const [confidence, setConfidence] = useState(3);
  const [sunkChoice, setSunkChoice] = useState<string | null>(null);

  const next = useCallback(() => {
    const idx = STAGES.indexOf(stage);
    if (idx < STAGES.length - 1) setStage(STAGES[idx + 1]);
  }, [stage]);

  return (
    <div className="space-y-6">
      <ProgressDots stage={stage} />

      {/* ── intro ── */}
      {stage === "intro" && (
        <Card>
          <p className="text-lg mb-4 text-[var(--color-text-on-dark)]">
            you&apos;re about to play three short scenarios. each one is
            designed to reveal a cognitive bias through your own choices.
          </p>
          <p className="text-sm text-[var(--color-text-on-dark-muted)] mb-6">
            there are no wrong answers. the point is to notice what your brain
            does without asking you first.
          </p>
          <button
            onClick={next}
            className="px-6 py-3 rounded-lg bg-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:opacity-90 transition-opacity"
          >
            begin
          </button>
        </Card>
      )}

      {/* ── scenario 1: anchoring ── */}
      {stage === "scenario1" && (
        <Card>
          <h2 className="text-xl font-semibold mb-4 text-[var(--color-text-on-dark)]">
            scenario 1
          </h2>
          <p className="mb-4 text-[var(--color-text-on-dark)]">
            a charity asks you to donate. before you decide, they mention that
            the average donation is{" "}
            <span className="font-bold text-[var(--wv-champagne)]">
              &pound;500
            </span>
            .
          </p>
          <p className="mb-6 text-[var(--color-text-on-dark-muted)]">
            how much would you donate?
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={500}
                step={5}
                value={donation}
                onChange={(e) => setDonation(Number(e.target.value))}
                className="flex-1 accent-[var(--wv-sienna)] h-2"
                aria-label="donation amount in pounds"
              />
              <span className="text-xl font-bold min-w-[5rem] text-right text-[var(--wv-champagne)]">
                &pound;{donation}
              </span>
            </div>
            <button
              onClick={next}
              className="px-6 py-3 rounded-lg bg-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:opacity-90 transition-opacity"
            >
              submit
            </button>
          </div>
        </Card>
      )}

      {/* ── reveal 1 ── */}
      {stage === "reveal1" && (
        <Card>
          <h2 className="text-xl font-semibold mb-2 text-[var(--wv-champagne)]">
            anchoring bias
          </h2>
          <p className="mb-3 text-[var(--color-text-on-dark)]">
            you chose{" "}
            <span className="font-bold text-[var(--wv-champagne)]">
              &pound;{donation}
            </span>
            .
          </p>
          <p className="mb-4 text-[var(--color-text-on-dark)]">
            the &pound;500 figure was made up. in a version of this scenario
            without the anchor, most people donate around{" "}
            <span className="font-semibold">&pound;20&ndash;50</span>. the
            number you saw changed your number.
          </p>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 mb-6">
            <p className="text-sm text-[var(--color-text-on-dark-muted)]">
              <span className="font-semibold text-[var(--wv-sienna)]">
                anchoring bias
              </span>{" "}
              &mdash; we rely too heavily on the first piece of information we
              encounter (the &ldquo;anchor&rdquo;) when making decisions, even
              when that information is arbitrary.
            </p>
          </div>
          <button
            onClick={next}
            className="px-6 py-3 rounded-lg bg-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:opacity-90 transition-opacity"
          >
            next scenario
          </button>
        </Card>
      )}

      {/* ── scenario 2: confirmation bias ── */}
      {stage === "scenario2" && (
        <Card>
          <h2 className="text-xl font-semibold mb-4 text-[var(--color-text-on-dark)]">
            scenario 2
          </h2>
          <p className="mb-4 text-[var(--color-text-on-dark)]">
            consider this claim:{" "}
            <span className="font-bold text-[var(--wv-champagne)]">
              &ldquo;people who drink coffee live longer.&rdquo;
            </span>
          </p>
          <p className="mb-4 text-sm text-[var(--color-text-on-dark-muted)]">
            here are four research findings:
          </p>
          <ul className="space-y-3 mb-6">
            {[
              {
                emoji: "\u2705",
                text: "a 2018 study of 500,000 adults found coffee drinkers had a 10-15% lower risk of death over 10 years.",
              },
              {
                emoji: "\u274C",
                text: "a 2020 meta-analysis found no statistically significant link between coffee consumption and longevity when controlling for lifestyle factors.",
              },
              {
                emoji: "\u2705",
                text: "research from the NIH showed that drinking 3+ cups daily was associated with reduced risk of heart disease.",
              },
              {
                emoji: "\u274C",
                text: "a longitudinal study found that the apparent longevity benefit disappeared entirely when accounting for the fact that coffee drinkers tend to be wealthier.",
              },
            ].map((item, i) => (
              <li
                key={i}
                className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-[var(--color-text-on-dark)]"
              >
                <span className="mr-2">{item.emoji}</span>
                {item.text}
              </li>
            ))}
          </ul>
          <p className="mb-3 text-[var(--color-text-on-dark)]">
            how confident are you that the claim is true?
          </p>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-xs text-[var(--color-text-on-dark-muted)]">
              not at all
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="flex-1 accent-[var(--wv-sienna)] h-2"
              aria-label="confidence level from 1 to 5"
            />
            <span className="text-xs text-[var(--color-text-on-dark-muted)]">
              very confident
            </span>
          </div>
          <p className="text-center text-lg font-bold mb-6 text-[var(--wv-champagne)]">
            {confidence} / 5
          </p>
          <button
            onClick={next}
            className="px-6 py-3 rounded-lg bg-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:opacity-90 transition-opacity"
          >
            submit
          </button>
        </Card>
      )}

      {/* ── reveal 2 ── */}
      {stage === "reveal2" && (
        <Card>
          <h2 className="text-xl font-semibold mb-2 text-[var(--wv-champagne)]">
            confirmation bias
          </h2>
          <p className="mb-3 text-[var(--color-text-on-dark)]">
            you rated your confidence at{" "}
            <span className="font-bold text-[var(--wv-champagne)]">
              {confidence} / 5
            </span>
            .
          </p>
          <p className="mb-4 text-[var(--color-text-on-dark)]">
            which findings did you pay most attention to? two of them supported
            the claim and two contradicted it. if you already believed the
            claim, you probably weighted the supporting evidence more heavily.
            if you were sceptical, the opposite.
          </p>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 mb-6">
            <p className="text-sm text-[var(--color-text-on-dark-muted)]">
              <span className="font-semibold text-[var(--wv-sienna)]">
                confirmation bias
              </span>{" "}
              &mdash; we tend to search for, interpret, and remember information
              in a way that confirms our pre-existing beliefs, while giving less
              attention to evidence that contradicts them.
            </p>
          </div>
          <button
            onClick={next}
            className="px-6 py-3 rounded-lg bg-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:opacity-90 transition-opacity"
          >
            next scenario
          </button>
        </Card>
      )}

      {/* ── scenario 3: sunk cost ── */}
      {stage === "scenario3" && (
        <Card>
          <h2 className="text-xl font-semibold mb-4 text-[var(--color-text-on-dark)]">
            scenario 3
          </h2>
          <p className="mb-4 text-[var(--color-text-on-dark)]">
            you&apos;ve paid{" "}
            <span className="font-bold text-[var(--wv-champagne)]">
              &pound;80
            </span>{" "}
            for theatre tickets. on the night, you feel ill and exhausted. the
            weather is terrible. a friend offers to let you stay in and watch a
            film.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setSunkChoice("theatre");
                next();
              }}
              className="flex-1 px-6 py-4 rounded-lg border border-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:bg-[var(--wv-sienna)]/20 transition-colors"
            >
              go to the theatre
            </button>
            <button
              onClick={() => {
                setSunkChoice("home");
                next();
              }}
              className="flex-1 px-6 py-4 rounded-lg border border-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:bg-[var(--wv-sienna)]/20 transition-colors"
            >
              stay home
            </button>
          </div>
        </Card>
      )}

      {/* ── reveal 3 ── */}
      {stage === "reveal3" && (
        <Card>
          <h2 className="text-xl font-semibold mb-2 text-[var(--wv-champagne)]">
            sunk cost fallacy
          </h2>
          <p className="mb-3 text-[var(--color-text-on-dark)]">
            you chose to{" "}
            <span className="font-bold text-[var(--wv-champagne)]">
              {sunkChoice === "theatre"
                ? "go to the theatre"
                : "stay home"}
            </span>
            .
          </p>
          <p className="mb-4 text-[var(--color-text-on-dark)]">
            the &pound;80 is already spent regardless of what you choose. your
            decision should be based only on which evening you&apos;d enjoy more
            right now.{" "}
            {sunkChoice === "theatre"
              ? "if the tickets influenced your decision, you experienced the sunk cost fallacy."
              : "well done \u2014 you made the rational choice. but most people don\u2019t. the pull of \u2018but I already paid\u2019 is remarkably strong."}
          </p>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 mb-6">
            <p className="text-sm text-[var(--color-text-on-dark-muted)]">
              <span className="font-semibold text-[var(--wv-sienna)]">
                sunk cost fallacy
              </span>{" "}
              &mdash; we continue an endeavour because of previously invested
              resources (time, money, effort) rather than evaluating the current
              and future value of continuing.
            </p>
          </div>
          <button
            onClick={next}
            className="px-6 py-3 rounded-lg bg-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:opacity-90 transition-opacity"
          >
            see summary
          </button>
        </Card>
      )}

      {/* ── summary ── */}
      {stage === "summary" && (
        <Card>
          <h2 className="text-xl font-semibold mb-4 text-[var(--wv-champagne)]">
            three biases, one brain
          </h2>
          <div className="space-y-3 mb-6">
            {[
              {
                name: "anchoring bias",
                detail: `you donated \u00a3${donation} after seeing a \u00a3500 anchor`,
              },
              {
                name: "confirmation bias",
                detail: `you rated your confidence at ${confidence}/5 on balanced evidence`,
              },
              {
                name: "sunk cost fallacy",
                detail: `you chose to ${
                  sunkChoice === "theatre"
                    ? "go to the theatre"
                    : "stay home"
                }`,
              },
            ].map((b, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-white/5 border border-white/10"
              >
                <p className="font-semibold text-[var(--wv-sienna)] text-sm">
                  {b.name}
                </p>
                <p className="text-sm text-[var(--color-text-on-dark-muted)]">
                  {b.detail}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[var(--color-text-on-dark)] mb-6">
            you&apos;ve just experienced three cognitive biases. the
            uncomfortable truth: knowing about them doesn&apos;t make you
            immune.
          </p>
          <button
            onClick={() => {
              setStage("intro");
              setDonation(100);
              setConfidence(3);
              setSunkChoice(null);
            }}
            className="px-6 py-3 rounded-lg border border-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:bg-[var(--wv-sienna)]/20 transition-colors"
          >
            play again
          </button>
        </Card>
      )}
    </div>
  );
}
