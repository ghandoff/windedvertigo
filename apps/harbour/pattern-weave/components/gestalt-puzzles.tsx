"use client";

import { useState } from "react";

interface Puzzle {
  id: number;
  render: (answered: boolean, answer: string) => React.ReactNode;
  question: string;
  options: string[];
  explanation: string;
}

function VaseFaces({ answered }: { answered: boolean }) {
  return (
    <div className="flex justify-center my-6">
      <svg
        viewBox="0 0 200 200"
        width="200"
        height="200"
        role="img"
        aria-label="ambiguous image: vase or two faces"
      >
        {/* left face profile (creates vase negative space) */}
        <path
          d="M 30,20 Q 70,50 70,100 Q 70,150 30,180"
          fill="none"
          stroke="var(--wv-champagne)"
          strokeWidth="4"
        />
        {/* right face profile (mirrored) */}
        <path
          d="M 170,20 Q 130,50 130,100 Q 130,150 170,180"
          fill="none"
          stroke="var(--wv-champagne)"
          strokeWidth="4"
        />
        {/* top rim of vase */}
        <line x1="30" y1="20" x2="170" y2="20" stroke="var(--wv-champagne)" strokeWidth="2" />
        {/* bottom base of vase */}
        <line x1="30" y1="180" x2="170" y2="180" stroke="var(--wv-champagne)" strokeWidth="2" />
        {/* face details — left */}
        <circle cx="48" cy="80" r="3" fill="var(--wv-champagne)" opacity={answered ? 0.6 : 0} style={{ transition: "opacity 0.5s" }} />
        <line x1="55" y1="110" x2="65" y2="105" stroke="var(--wv-champagne)" strokeWidth="2" opacity={answered ? 0.6 : 0} style={{ transition: "opacity 0.5s" }} />
        {/* face details — right */}
        <circle cx="152" cy="80" r="3" fill="var(--wv-champagne)" opacity={answered ? 0.6 : 0} style={{ transition: "opacity 0.5s" }} />
        <line x1="145" y1="110" x2="135" y2="105" stroke="var(--wv-champagne)" strokeWidth="2" opacity={answered ? 0.6 : 0} style={{ transition: "opacity 0.5s" }} />
      </svg>
    </div>
  );
}

function ClosureCircles() {
  const r = 30;
  const positions = [
    { cx: 50, cy: 50, rotation: 45 },
    { cx: 150, cy: 50, rotation: 135 },
    { cx: 50, cy: 150, rotation: -45 },
    { cx: 150, cy: 150, rotation: -135 },
  ];
  return (
    <div className="flex justify-center my-6">
      <svg
        viewBox="0 0 200 200"
        width="200"
        height="200"
        role="img"
        aria-label="four pac-man shapes creating illusory square"
      >
        {positions.map(({ cx, cy, rotation }, i) => (
          <path
            key={i}
            d={`M ${cx} ${cy} L ${cx + r * Math.cos((rotation * Math.PI) / 180)} ${cy + r * Math.sin((rotation * Math.PI) / 180)} A ${r} ${r} 0 1 0 ${cx + r * Math.cos(((rotation + 90) * Math.PI) / 180)} ${cy + r * Math.sin(((rotation + 90) * Math.PI) / 180)} Z`}
            fill="var(--wv-champagne)"
          />
        ))}
      </svg>
    </div>
  );
}

function ProximityDots() {
  const leftDots = [
    [30, 70], [50, 50], [70, 70], [30, 110], [50, 130], [70, 110],
  ];
  const rightDots = [
    [130, 70], [150, 50], [170, 70], [130, 110], [150, 130], [170, 110],
  ];
  return (
    <div className="flex justify-center my-6">
      <svg
        viewBox="0 0 200 200"
        width="200"
        height="200"
        role="img"
        aria-label="twelve dots arranged in two groups"
      >
        {[...leftDots, ...rightDots].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="8"
            fill="var(--wv-champagne)"
          />
        ))}
      </svg>
    </div>
  );
}

const PUZZLES: Puzzle[] = [
  {
    id: 1,
    render: (answered) => <VaseFaces answered={answered} />,
    question: "what do you see?",
    options: ["a vase", "two faces"],
    explanation:
      "both. the same image contains two interpretations. your brain chose one first — but once you see both, you can switch between them. this is figure-ground reversal.",
  },
  {
    id: 2,
    render: () => <ClosureCircles />,
    question: "is there a square in this image?",
    options: ["yes", "no"],
    explanation:
      "there is no square — only four circles with wedges removed. your brain 'closes' the gaps to see a shape that isn't there. this is the gestalt principle of closure.",
  },
  {
    id: 3,
    render: () => <ProximityDots />,
    question: "how many groups do you see?",
    options: ["one", "two", "twelve"],
    explanation:
      "there are 12 individual dots, but your brain groups them by proximity. you see two groups because closeness implies relationship. this is the gestalt principle of proximity.",
  },
];

export default function GestaltPuzzles() {
  const [current, setCurrent] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");

  const puzzle = PUZZLES[current];

  const handleAnswer = (option: string) => {
    setUserAnswer(option);
    setAnswered(true);
  };

  const goTo = (idx: number) => {
    setCurrent(idx);
    setAnswered(false);
    setUserAnswer("");
  };

  return (
    <div>
      {/* illustration */}
      {puzzle.render(answered, userAnswer)}

      {/* question */}
      <p className="text-center text-lg font-semibold mb-4">{puzzle.question}</p>

      {/* options */}
      {!answered && (
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {puzzle.options.map((opt) => (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all border"
              style={{
                background: "rgba(255,255,255,0.05)",
                borderColor: "rgba(255,255,255,0.1)",
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* explanation */}
      {answered && (
        <div
          className="rounded-xl border px-5 py-4 mb-6 text-sm leading-relaxed"
          style={{
            background: "rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          <p className="text-[var(--color-text-on-dark-muted)]">{puzzle.explanation}</p>
        </div>
      )}

      {/* navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
          className="px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-30"
          style={{
            background: "var(--color-surface-raised)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          back
        </button>

        {/* progress dots */}
        <div className="flex gap-2">
          {PUZZLES.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-colors"
              style={{
                background: i === current ? "var(--wv-champagne)" : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>

        <button
          onClick={() => goTo(current + 1)}
          disabled={current === PUZZLES.length - 1}
          className="px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-30"
          style={{
            background: "var(--color-surface-raised)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          next
        </button>
      </div>
    </div>
  );
}
