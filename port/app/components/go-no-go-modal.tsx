"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WvFitScore } from "@/lib/notion/types";

// ── scoring rubric ────────────────────────────────────────

interface Factor {
  key: string;
  label: string;
  descriptions: [string, string, string]; // 1, 2, 3
}

const FACTORS: Factor[] = [
  {
    key: "budget",
    label: "budget fit",
    descriptions: [
      "too small or unknown",
      "reasonable budget",
      "strong budget",
    ],
  },
  {
    key: "capability",
    label: "capability match",
    descriptions: [
      "stretch — limited experience",
      "good match",
      "direct hit — demonstrated experience",
    ],
  },
  {
    key: "relationship",
    label: "relationship warmth",
    descriptions: [
      "cold — no connection",
      "some connection",
      "warm — champion inside",
    ],
  },
  {
    key: "strategy",
    label: "strategic alignment",
    descriptions: [
      "off-strategy",
      "adjacent to priority sector",
      "core priority sector",
    ],
  },
  {
    key: "competition",
    label: "competition level",
    descriptions: [
      "many strong competitors",
      "some competition",
      "likely to stand out",
    ],
  },
];

function computeFitScore(total: number): WvFitScore {
  if (total >= 13) return "high fit";
  if (total >= 9) return "medium fit";
  return "low fit";
}

const FIT_BADGE_COLORS: Record<WvFitScore, string> = {
  "high fit": "bg-green-100 text-green-700 border-green-200",
  "medium fit": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "low fit": "bg-gray-100 text-gray-600 border-gray-200",
  "TBD": "bg-blue-50 text-blue-600 border-blue-200",
};

// ── score button group ────────────────────────────────────

function ScoreButtonGroup({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={[
            "w-8 h-8 rounded border text-xs font-medium transition-colors",
            value === n
              ? "bg-foreground text-background border-foreground"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
          ].join(" ")}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// ── modal ─────────────────────────────────────────────────

export interface GoNoGoModalProps {
  open: boolean;
  rfpName: string;
  onConfirm: (score: WvFitScore) => void;
  onCancel: () => void;
}

export function GoNoGoModal({ open, rfpName, onConfirm, onCancel }: GoNoGoModalProps) {
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(FACTORS.map((f) => [f.key, 2])),
  );

  const total = Object.values(scores).reduce((sum, v) => sum + v, 0);
  const fitScore = computeFitScore(total);

  function setScore(key: string, value: number) {
    setScores((prev) => ({ ...prev, [key]: value }));
  }

  function handleConfirm() {
    onConfirm(fitScore);
    // reset for next use
    setScores(Object.fromEntries(FACTORS.map((f) => [f.key, 2])));
  }

  function handleCancel() {
    onCancel();
    setScores(Object.fromEntries(FACTORS.map((f) => [f.key, 2])));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>go / no-go scorecard</DialogTitle>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">
            {rfpName}
          </p>
        </DialogHeader>

        {/* Factor rows */}
        <div className="space-y-4 py-1">
          {FACTORS.map((factor) => {
            const score = scores[factor.key];
            return (
              <div key={factor.key} className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{factor.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {factor.descriptions[score - 1]}
                  </p>
                </div>
                <ScoreButtonGroup
                  value={score}
                  onChange={(v) => setScore(factor.key, v)}
                />
              </div>
            );
          })}
        </div>

        {/* Running total */}
        <div className="flex items-center justify-between pt-3 border-t">
          <span className="text-xs text-muted-foreground">
            total: <span className="font-semibold text-foreground">{total}</span> / 15
          </span>
          <Badge
            variant="outline"
            className={`text-[11px] font-medium ${FIT_BADGE_COLORS[fitScore]}`}
          >
            {fitScore}
          </Badge>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>cancel</Button>
          <Button onClick={handleConfirm}>confirm score</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
