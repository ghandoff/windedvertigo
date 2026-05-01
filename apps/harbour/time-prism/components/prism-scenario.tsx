"use client";

import { useState, useCallback } from "react";

type Stage =
  | "intro"
  | "decision1"
  | "decision2"
  | "decision3"
  | "reveal";

const STAGES: Stage[] = ["intro", "decision1", "decision2", "decision3", "reveal"];

interface Choices {
  d1: "launch" | "delay" | null;
  d2: "accept" | "override" | null;
  d3: "proceed" | "scrub" | null;
}

function ProgressDots({ stage }: { stage: Stage }) {
  if (stage === "intro" || stage === "reveal") return null;
  const current = stage === "decision1" ? 1 : stage === "decision2" ? 2 : 3;
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center gap-2">
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
        decision {current} of 3
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

function ContextItem({ text }: { text: string }) {
  return (
    <li className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-[var(--color-text-on-dark)]">
      {text}
    </li>
  );
}

function ChoiceButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 px-6 py-4 rounded-lg border border-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:bg-[var(--wv-sienna)]/20 transition-colors text-left sm:text-center"
    >
      {label}
    </button>
  );
}

const ACTUAL: Record<string, string> = {
  d1: "managers proceeded despite the warning",
  d2: "NASA accepted thiokol\u2019s revised recommendation to launch",
  d3: "the launch proceeded",
};

export default function PrismScenario() {
  const [stage, setStage] = useState<Stage>("intro");
  const [choices, setChoices] = useState<Choices>({
    d1: null,
    d2: null,
    d3: null,
  });

  const next = useCallback(() => {
    const idx = STAGES.indexOf(stage);
    if (idx < STAGES.length - 1) setStage(STAGES[idx + 1]);
  }, [stage]);

  const choose = (key: keyof Choices, value: string) => {
    setChoices((prev) => ({ ...prev, [key]: value }));
    next();
  };

  return (
    <div className="space-y-6">
      <ProgressDots stage={stage} />

      {/* ── intro ── */}
      {stage === "intro" && (
        <Card>
          <h2 className="text-lg font-semibold mb-2 text-[var(--wv-champagne)]">
            the challenger launch decision
          </h2>
          <p className="text-sm text-[var(--color-text-on-dark-muted)] mb-2">
            28 january 1986
          </p>
          <p className="mb-4 text-[var(--color-text-on-dark)]">
            you are a NASA manager responsible for the space shuttle programme.
            you will face three decisions about whether to launch the shuttle
            challenger.
          </p>
          <p className="mb-6 text-sm text-[var(--color-text-on-dark-muted)]">
            you will only see the information that was available at the time.
            no hindsight. no outcome knowledge. just the data and the pressure.
          </p>
          <button
            onClick={next}
            className="px-6 py-3 rounded-lg bg-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:opacity-90 transition-opacity"
          >
            begin
          </button>
        </Card>
      )}

      {/* ── decision 1 ── */}
      {stage === "decision1" && (
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-[var(--color-text-on-dark)]">
            decision 1 &mdash; the evening before launch
          </h2>
          <p className="mb-4 text-[var(--color-text-on-dark)]">
            engineers from morton thiokol (the company that makes the solid
            rocket boosters) call an emergency meeting. they warn that the
            O-ring seals may not work properly in cold weather. the temperature
            tomorrow is forecast at &minus;1&deg;C (30&deg;F) &mdash; colder
            than any previous launch.
          </p>
          <p className="mb-3 text-[var(--color-text-on-dark)]">
            the engineers recommend delaying the launch. however:
          </p>
          <ul className="space-y-2 mb-6">
            <ContextItem text="the launch has already been delayed 6 times" />
            <ContextItem text="the president is expected to mention it in tonight\u2019s state of the union address" />
            <ContextItem text="no O-ring has ever actually failed during a launch" />
            <ContextItem text="some of the data is ambiguous \u2014 not all cold-weather launches showed problems" />
          </ul>
          <div className="flex flex-col sm:flex-row gap-3">
            <ChoiceButton
              label="approve the launch"
              onClick={() => choose("d1", "launch")}
            />
            <ChoiceButton
              label="delay the launch"
              onClick={() => choose("d1", "delay")}
            />
          </div>
        </Card>
      )}

      {/* ── decision 2 ── */}
      {stage === "decision2" && (
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-[var(--color-text-on-dark)]">
            decision 2 &mdash; the room divides
          </h2>
          <p className="mb-4 text-[var(--color-text-on-dark)]">
            thiokol&apos;s own management is now pushing back against their
            engineers. they ask the engineers to &ldquo;take off their
            engineering hats and put on their management hats.&rdquo; the room
            is divided.
          </p>
          <p className="mb-6 text-[var(--color-text-on-dark)]">
            you ask thiokol to make a final recommendation.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <ChoiceButton
              label="accept thiokol&apos;s recommendation to launch"
              onClick={() => choose("d2", "accept")}
            />
            <ChoiceButton
              label="override and delay regardless"
              onClick={() => choose("d2", "override")}
            />
          </div>
        </Card>
      )}

      {/* ── decision 3 ── */}
      {stage === "decision3" && (
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-[var(--color-text-on-dark)]">
            decision 3 &mdash; launch morning
          </h2>
          <p className="mb-4 text-[var(--color-text-on-dark)]">
            it&apos;s launch morning. the temperature is even colder than
            forecast. ice has formed on the launch pad. the ice team reports no
            concerns about the vehicle itself.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <ChoiceButton
              label="proceed with launch"
              onClick={() => choose("d3", "proceed")}
            />
            <ChoiceButton
              label="scrub the launch"
              onClick={() => choose("d3", "scrub")}
            />
          </div>
        </Card>
      )}

      {/* ── reveal ── */}
      {stage === "reveal" && (
        <Card>
          <h2 className="text-xl font-semibold mb-4 text-[var(--wv-champagne)]">
            what actually happened
          </h2>
          <p className="mb-6 text-[var(--color-text-on-dark)]">
            73 seconds after launch, challenger broke apart. all seven crew
            members were killed. the cause was exactly what the engineers had
            warned about: the O-ring seals failed in the cold.
          </p>

          <div className="space-y-3 mb-6">
            {(
              [
                {
                  key: "d1" as const,
                  label: "decision 1",
                  yours:
                    choices.d1 === "launch"
                      ? "approve the launch"
                      : "delay the launch",
                },
                {
                  key: "d2" as const,
                  label: "decision 2",
                  yours:
                    choices.d2 === "accept"
                      ? "accept recommendation to launch"
                      : "override and delay",
                },
                {
                  key: "d3" as const,
                  label: "decision 3",
                  yours:
                    choices.d3 === "proceed"
                      ? "proceed with launch"
                      : "scrub the launch",
                },
              ] as const
            ).map((d) => (
              <div
                key={d.key}
                className="p-4 rounded-lg bg-white/5 border border-white/10"
              >
                <p className="text-xs font-semibold text-[var(--wv-sienna)] mb-1 uppercase tracking-wider">
                  {d.label}
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
                  <span className="text-[var(--color-text-on-dark)]">
                    <span className="text-[var(--color-text-on-dark-muted)]">
                      you:
                    </span>{" "}
                    {d.yours}
                  </span>
                  <span className="hidden sm:inline text-white/20">|</span>
                  <span className="text-[var(--color-text-on-dark)]">
                    <span className="text-[var(--color-text-on-dark-muted)]">
                      actual:
                    </span>{" "}
                    {ACTUAL[d.key]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-lg bg-white/5 border border-[var(--wv-sienna)]/30 mb-6">
            <p className="text-[var(--color-text-on-dark)]">
              the managers who approved the launch were not evil or stupid. they
              were working with ambiguous data under enormous pressure. this is
              what historical empathy means &mdash; understanding decisions in
              context, without the benefit of knowing what happened next.
            </p>
          </div>

          <button
            onClick={() => {
              setStage("intro");
              setChoices({ d1: null, d2: null, d3: null });
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
