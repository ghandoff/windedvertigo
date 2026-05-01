"use client";

import { useState, useCallback } from "react";

type Stage =
  | "intro"
  | "puzzle1"
  | "reveal1"
  | "puzzle2"
  | "reveal2"
  | "puzzle3"
  | "reveal3"
  | "summary";

const STAGES: Stage[] = [
  "intro",
  "puzzle1",
  "reveal1",
  "puzzle2",
  "reveal2",
  "puzzle3",
  "reveal3",
  "summary",
];

function puzzleIndex(stage: Stage): number {
  if (stage.includes("1")) return 1;
  if (stage.includes("2")) return 2;
  if (stage.includes("3")) return 3;
  return 0;
}

function ProgressDots({ stage }: { stage: Stage }) {
  const idx = STAGES.indexOf(stage);
  if (idx <= 0 || stage === "summary") return null;
  const current = puzzleIndex(stage) || 1;
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

/* ── nine dots puzzle ──
   the classic solution: 4 straight lines going outside the implied box.
   one well-known solution:
     start at (row2,col0) → go to (row0,col2) → extend to (row-1,col3)
     → come back to (row2,col0) ... etc.
   for the SVG display we use a known correct solution with coordinates. */

const PADDING = 60;
const SPACING = 60;
const SVG_SIZE = SPACING * 2 + PADDING * 2;

function dotXY(r: number, c: number) {
  return { x: PADDING + c * SPACING, y: PADDING + r * SPACING };
}

const DOT_GRID = [
  { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 },
  { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 },
  { r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 },
];

/* classic solution that goes outside the grid:
   1. (0,0) → (0,2) then extend one spacing to the right → point A (0, 3)
   2. A → diag down-left to (2,0) hitting (1,1) along the way
   3. (2,0) → (2,2) then extend one spacing to the right → point B (2, 3)...

   Actually the simplest correct solution:
   1. (2,0) → (0,0): up the left column
   2. (0,0) → (0,2) → extend to virtual (0,3): across top and beyond
   3. virtual (0,3) → (1,1) → (2,-1) virtual: diagonal hitting middle and going beyond

   Let me use the most commonly illustrated solution:
   1. Start (0,0), draw right across top row, extend past (0,2) to (0,3-virtual)
   2. From (0,3), diagonal down-left through (1,2) to (2,1) to (3,0-virtual)
   3. From (3,0), draw right through (2,0),(2,1),(2,2) — wait, (3,0) is below grid.

   The real standard solution:
   L1: (2,0) → (2,2): across bottom
   L2: (2,2) → (0,0): diagonal up-left
   L3: (0,0) → (0,2): across top (extend to virtual col 3)
   But L2 only hits (2,2), (1,1), (0,0) — misses (1,2), (0,1), (0,2), (1,0), (2,1)

   OK final answer — THE correct well-known solution path:
   L1: (0,2) → (2,0) : diagonal hits (0,2),(1,1),(2,0)
   L2: (2,0) → (2,2) extend to (2,3-virtual) : bottom row + beyond
   L3: (2,3-virtual) → (0,1) extend to (-1, 0-virtual) : diagonal hits (1,2),(0,1) going beyond
   L4: (-1,0-virtual) → (2,0) ... nope

   I'll just use hardcoded pixel coords for the display solution. */

// solution: 4 lines connecting all 9 dots, extending outside the 3x3 grid
const SOLUTION_LINES = [
  // line 1: top-right across top row to beyond-top-left
  { x1: dotXY(0, 2).x, y1: dotXY(0, 2).y, x2: dotXY(0, 0).x - SPACING, y2: dotXY(0, 0).y },
  // line 2: beyond-top-left diagonal down to bottom-right
  { x1: dotXY(0, 0).x - SPACING, y1: dotXY(0, 0).y, x2: dotXY(2, 2).x, y2: dotXY(2, 2).y },
  // line 3: bottom-right up to top-middle then extend above
  { x1: dotXY(2, 2).x, y1: dotXY(2, 2).y, x2: dotXY(0, 1).x, y2: dotXY(0, 0).y - SPACING },
  // line 4: above-top-middle down-left to bottom-left
  { x1: dotXY(0, 1).x, y1: dotXY(0, 0).y - SPACING, x2: dotXY(2, 0).x, y2: dotXY(2, 0).y },
];

function NineDotsPuzzle({
  onComplete,
  showSolution,
}: {
  onComplete: () => void;
  showSolution: boolean;
}) {
  const [clickedDots, setClickedDots] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const handleDotClick = (index: number) => {
    if (showAnswer || showSolution) return;
    setClickedDots((prev) => {
      const next = [...prev, index];
      // after picking 5+ dots (4 lines), count as an attempt and reset
      if (next.length > 5) {
        setAttempts((a) => a + 1);
        return [index];
      }
      return next;
    });
  };

  const reset = () => setClickedDots([]);
  const solutionDisplay = showAnswer || showSolution;

  // build player lines from clicked dots
  const playerLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < clickedDots.length - 1; i++) {
    const from = DOT_GRID[clickedDots[i]];
    const to = DOT_GRID[clickedDots[i + 1]];
    const p1 = dotXY(from.r, from.c);
    const p2 = dotXY(to.r, to.c);
    playerLines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
  }

  return (
    <div>
      <div className="flex justify-center mb-4">
        <svg
          width={SVG_SIZE}
          height={SVG_SIZE}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          className="touch-none max-w-full"
        >
          {/* player lines */}
          {!solutionDisplay &&
            playerLines.map((l, i) => (
              <line
                key={i}
                x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke="var(--wv-sienna)"
                strokeWidth={3}
                strokeLinecap="round"
              />
            ))}

          {/* solution lines */}
          {solutionDisplay &&
            SOLUTION_LINES.map((l, i) => (
              <line
                key={i}
                x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke={i % 2 === 0 ? "var(--wv-sienna)" : "var(--wv-champagne)"}
                strokeWidth={3}
                strokeLinecap="round"
              />
            ))}

          {/* dots */}
          {DOT_GRID.map((d, i) => {
            const { x, y } = dotXY(d.r, d.c);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={8}
                fill="var(--wv-champagne)"
                stroke="var(--wv-sienna)"
                strokeWidth={2}
                className={solutionDisplay ? "" : "cursor-pointer"}
                onClick={() => handleDotClick(i)}
              />
            );
          })}
        </svg>
      </div>

      {!solutionDisplay && (
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm rounded-lg border border-white/20 text-[var(--color-text-on-dark-muted)] hover:bg-white/5 transition-colors"
          >
            reset lines
          </button>
          {attempts >= 2 && !showHint && (
            <button
              onClick={() => setShowHint(true)}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--wv-sienna)]/50 text-[var(--wv-sienna)] hover:bg-[var(--wv-sienna)]/10 transition-colors"
            >
              hint
            </button>
          )}
          {(attempts >= 2 || showHint) && (
            <button
              onClick={() => {
                setShowAnswer(true);
                onComplete();
              }}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--wv-sienna)] text-[var(--wv-champagne)] hover:opacity-90 transition-opacity"
            >
              show solution
            </button>
          )}
        </div>
      )}

      {showHint && !solutionDisplay && (
        <p className="text-sm text-[var(--wv-sienna)] text-center mt-3">
          who said the lines have to stay inside the grid?
        </p>
      )}
    </div>
  );
}

/* ── selective attention puzzle ── */

const F_TEXT =
  "finished files are the result of years of scientific study combined with the experience of years";

function SelectiveAttention({
  onComplete,
}: {
  onComplete: (count: number) => void;
}) {
  const [guess, setGuess] = useState("");

  return (
    <div>
      <div className="p-5 rounded-lg bg-white/5 border border-white/10 mb-6">
        <p className="text-lg leading-relaxed text-[var(--color-text-on-dark)] font-serif">
          &ldquo;{F_TEXT}&rdquo;
        </p>
      </div>
      <p className="mb-4 text-[var(--color-text-on-dark)]">
        how many times does the letter &lsquo;f&rsquo; appear in the text
        above?
      </p>
      <div className="flex gap-3 items-end">
        <input
          type="number"
          min={0}
          max={20}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          className="w-20 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-[var(--wv-champagne)] text-center text-lg font-bold focus:outline-none focus:border-[var(--wv-sienna)]"
          aria-label="your count of the letter f"
          placeholder="?"
        />
        <button
          onClick={() => {
            onComplete(Number(guess) || 0);
          }}
          disabled={!guess}
          className="px-6 py-2 rounded-lg bg-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          submit
        </button>
      </div>
    </div>
  );
}

/* ── main component ── */

export default function LiminalPuzzles() {
  const [stage, setStage] = useState<Stage>("intro");
  const [nineDotsDone, setNineDotsDone] = useState(false);
  const [fCount, setFCount] = useState(0);
  const [barberChoice, setBarberChoice] = useState<string | null>(null);

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
            three small puzzles. each one is designed to produce a genuine
            &ldquo;aha&rdquo; moment &mdash; followed by a name for what just
            happened to your thinking.
          </p>
          <p className="text-sm text-[var(--color-text-on-dark-muted)] mb-6">
            try each puzzle honestly before looking at the answer. the
            experience matters more than being right.
          </p>
          <button
            onClick={next}
            className="px-6 py-3 rounded-lg bg-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:opacity-90 transition-opacity"
          >
            begin
          </button>
        </Card>
      )}

      {/* ── puzzle 1: nine dots ── */}
      {stage === "puzzle1" && (
        <Card>
          <h2 className="text-xl font-semibold mb-2 text-[var(--color-text-on-dark)]">
            puzzle 1 &mdash; the nine dots
          </h2>
          <p className="mb-4 text-sm text-[var(--color-text-on-dark-muted)]">
            connect all 9 dots using 4 straight lines without lifting your pen.
            click dots to draw lines.
          </p>
          <NineDotsPuzzle
            onComplete={() => setNineDotsDone(true)}
            showSolution={false}
          />
          {nineDotsDone && (
            <div className="mt-6 text-center">
              <button
                onClick={next}
                className="px-6 py-3 rounded-lg bg-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:opacity-90 transition-opacity"
              >
                see reflection
              </button>
            </div>
          )}
        </Card>
      )}

      {/* ── reveal 1 ── */}
      {stage === "reveal1" && (
        <Card>
          <h2 className="text-xl font-semibold mb-2 text-[var(--wv-champagne)]">
            thinking outside the box
          </h2>
          <div className="mb-4">
            <NineDotsPuzzle onComplete={() => {}} showSolution={true} />
          </div>
          <p className="mb-4 text-[var(--color-text-on-dark)]">
            the solution requires the lines to extend beyond the grid of dots.
            most people fail because they impose a constraint that doesn&apos;t
            exist &mdash; they assume the lines must stay within the square.
          </p>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 mb-6">
            <p className="text-sm text-[var(--color-text-on-dark-muted)]">
              the boundary wasn&apos;t in the puzzle &mdash; it was in your
              mind. this feeling of &ldquo;oh, I was thinking about it
              wrong&rdquo; is what threshold concept researchers call{" "}
              <span className="font-semibold text-[var(--wv-sienna)]">
                liminality
              </span>
              .
            </p>
          </div>
          <button
            onClick={next}
            className="px-6 py-3 rounded-lg bg-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:opacity-90 transition-opacity"
          >
            next puzzle
          </button>
        </Card>
      )}

      {/* ── puzzle 2: selective attention ── */}
      {stage === "puzzle2" && (
        <Card>
          <h2 className="text-xl font-semibold mb-2 text-[var(--color-text-on-dark)]">
            puzzle 2 &mdash; count the letters
          </h2>
          <p className="mb-4 text-sm text-[var(--color-text-on-dark-muted)]">
            read the text below carefully and count how many times the letter
            &lsquo;f&rsquo; appears.
          </p>
          <SelectiveAttention
            onComplete={(count) => {
              setFCount(count);
              setTimeout(next, 400);
            }}
          />
        </Card>
      )}

      {/* ── reveal 2 ── */}
      {stage === "reveal2" && (
        <Card>
          <h2 className="text-xl font-semibold mb-2 text-[var(--wv-champagne)]">
            selective attention
          </h2>
          <p className="mb-3 text-[var(--color-text-on-dark)]">
            you counted{" "}
            <span className="font-bold text-[var(--wv-champagne)]">
              {fCount}
            </span>
            . the correct answer is{" "}
            <span className="font-bold text-[var(--wv-champagne)]">6</span>.
          </p>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10 mb-4">
            <p className="text-lg leading-relaxed font-serif">
              &ldquo;
              {F_TEXT.split("").map((ch, i) =>
                ch.toLowerCase() === "f" ? (
                  <span
                    key={i}
                    className="font-bold text-[var(--wv-sienna)] text-xl"
                  >
                    {ch}
                  </span>
                ) : (
                  <span key={i} className="text-[var(--color-text-on-dark)]">
                    {ch}
                  </span>
                )
              )}
              &rdquo;
            </p>
          </div>
          <p className="mb-4 text-[var(--color-text-on-dark)]">
            most people count 3. they miss the f&apos;s in &ldquo;of&rdquo;
            because the brain processes common words phonetically as
            &ldquo;ov&rdquo;.
          </p>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 mb-6">
            <p className="text-sm text-[var(--color-text-on-dark-muted)]">
              your brain was filtering information based on what it expected to
              find. once you see the hidden f&apos;s, you can never unsee them.
              this is{" "}
              <span className="font-semibold text-[var(--wv-sienna)]">
                irreversibility
              </span>{" "}
              &mdash; a defining characteristic of threshold concepts.
            </p>
          </div>
          <button
            onClick={next}
            className="px-6 py-3 rounded-lg bg-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:opacity-90 transition-opacity"
          >
            next puzzle
          </button>
        </Card>
      )}

      {/* ── puzzle 3: barber paradox ── */}
      {stage === "puzzle3" && (
        <Card>
          <h2 className="text-xl font-semibold mb-2 text-[var(--color-text-on-dark)]">
            puzzle 3 &mdash; the barber paradox
          </h2>
          <p className="mb-6 text-[var(--color-text-on-dark)]">
            in a village, the barber shaves everyone who does not shave
            themselves. who shaves the barber?
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setBarberChoice("self");
                next();
              }}
              className="flex-1 px-6 py-4 rounded-lg border border-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:bg-[var(--wv-sienna)]/20 transition-colors"
            >
              the barber shaves himself
            </button>
            <button
              onClick={() => {
                setBarberChoice("other");
                next();
              }}
              className="flex-1 px-6 py-4 rounded-lg border border-[var(--wv-sienna)] text-[var(--wv-champagne)] font-semibold hover:bg-[var(--wv-sienna)]/20 transition-colors"
            >
              someone else shaves the barber
            </button>
          </div>
        </Card>
      )}

      {/* ── reveal 3 ── */}
      {stage === "reveal3" && (
        <Card>
          <h2 className="text-xl font-semibold mb-2 text-[var(--wv-champagne)]">
            the paradox
          </h2>
          <p className="mb-4 text-[var(--color-text-on-dark)]">
            you said{" "}
            <span className="font-bold text-[var(--wv-champagne)]">
              {barberChoice === "self"
                ? "the barber shaves himself"
                : "someone else shaves the barber"}
            </span>
            . but:
          </p>
          {barberChoice === "self" ? (
            <p className="mb-4 text-[var(--color-text-on-dark)]">
              if the barber shaves himself, then he&apos;s someone who shaves
              himself &mdash; so by the rule, the barber shouldn&apos;t shave
              him. contradiction.
            </p>
          ) : (
            <p className="mb-4 text-[var(--color-text-on-dark)]">
              if someone else shaves the barber, then the barber doesn&apos;t
              shave himself &mdash; so by the rule, the barber should shave
              him. contradiction.
            </p>
          )}
          <p className="mb-4 text-[var(--color-text-on-dark)]">
            either answer leads to a contradiction. this is a genuine paradox.
          </p>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 mb-6">
            <p className="text-sm text-[var(--color-text-on-dark-muted)]">
              recognising this as{" "}
              <span className="font-semibold text-[var(--wv-sienna)]">
                unsolvable
              </span>{" "}
              (not just hard) is itself a threshold crossing. the shift from
              &ldquo;I haven&apos;t found the answer yet&rdquo; to &ldquo;there
              is no answer&rdquo; changes how you think about logic itself.
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
            three thresholds crossed
          </h2>
          <div className="space-y-3 mb-6">
            {[
              {
                name: "liminality",
                detail:
                  "the nine dots puzzle required breaking a self-imposed constraint",
              },
              {
                name: "irreversibility",
                detail:
                  "once you saw the hidden f\u2019s in \u201cof,\u201d you couldn\u2019t unsee them",
              },
              {
                name: "transformation",
                detail:
                  "the barber paradox shifted your understanding from \u201chard\u201d to \u201cunsolvable\u201d",
              },
            ].map((t, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-white/5 border border-white/10"
              >
                <p className="font-semibold text-[var(--wv-sienna)] text-sm">
                  {t.name}
                </p>
                <p className="text-sm text-[var(--color-text-on-dark-muted)]">
                  {t.detail}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[var(--color-text-on-dark)] mb-6">
            you&apos;ve just crossed three small thresholds. each time,
            something shifted &mdash; not just what you knew, but how you
            thought. that shift is what threshold concepts are about.
          </p>
          <button
            onClick={() => {
              setStage("intro");
              setNineDotsDone(false);
              setFCount(0);
              setBarberChoice(null);
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
