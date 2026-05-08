"use client";

/**
 * BidNoBidModal — fires when the user drags an RFP from "reviewing" to
 * "pursuing" in the kanban. The commit-to-bid gate.
 *
 * Five weighted yes/no questions following the Loopio / Responsive go-no-go
 * framework. Score → recommendation. User picks the final decision; if
 * "no-bid", reason is captured for win/loss learning.
 *
 * On submit:
 *   - POST /api/rfp-radar/[id]/bid-decision
 *   - On bid: status moves to pursuing, milestones generated server-side
 *   - On no-bid: status stays in reviewing (kanban transition cancelled),
 *     reason persisted
 *   - On deferred: kanban transition cancelled, no follow-on actions
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

interface BidNoBidScorecard {
  strategicFit: boolean;
  capacityAvailable: boolean;
  teamHasExpertise: boolean;
  budgetAcceptable: boolean;
  timelineWorkable: boolean;
}

const WEIGHTS = {
  strategicFit:      25,
  capacityAvailable: 20,
  teamHasExpertise:  25,
  budgetAcceptable:  15,
  timelineWorkable:  15,
};

const QUESTIONS: Array<{ key: keyof BidNoBidScorecard; label: string; help: string }> = [
  {
    key: "strategicFit",
    label: "strategic fit",
    help: "this RFP aligns with w.v's positioning + builds toward the funder relationships we want.",
  },
  {
    key: "capacityAvailable",
    label: "capacity available",
    help: "the team has bandwidth in the window between now and submission deadline.",
  },
  {
    key: "teamHasExpertise",
    label: "team has expertise",
    help: "the named contributors have the substantive expertise this RFP requires (not generic).",
  },
  {
    key: "budgetAcceptable",
    label: "budget acceptable",
    help: "the budget ceiling (or expected range) is workable at w.v's calibrated rates.",
  },
  {
    key: "timelineWorkable",
    label: "timeline workable",
    help: "the response window is long enough to do the work properly without compromising quality.",
  },
];

interface BidNoBidModalProps {
  open: boolean;
  rfpId: string;
  rfpName: string;
  /** Called after a successful submit. The kanban refreshes via router.refresh(). */
  onClose: (decision: "bid" | "no-bid" | "deferred" | "cancelled") => void;
}

export function BidNoBidModal({ open, rfpId, rfpName, onClose }: BidNoBidModalProps) {
  const [scorecard, setScorecard] = useState<BidNoBidScorecard>({
    strategicFit: false,
    capacityAvailable: false,
    teamHasExpertise: false,
    budgetAcceptable: false,
    timelineWorkable: false,
  });
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const score = Object.entries(scorecard).reduce(
    (sum, [k, v]) => sum + (v ? WEIGHTS[k as keyof BidNoBidScorecard] : 0),
    0,
  );
  const recommendation: "bid" | "no-bid" | "borderline" =
    score >= 70 ? "bid" : score < 50 ? "no-bid" : "borderline";

  function toggle(key: keyof BidNoBidScorecard) {
    setScorecard((s) => ({ ...s, [key]: !s[key] }));
  }

  async function submit(decision: "bid" | "no-bid" | "deferred") {
    setErrorMsg(null);
    if (decision === "no-bid" && !reason.trim()) {
      setErrorMsg("reason is required for no-bid decisions");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rfp-radar/${rfpId}/bid-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, score, reason: reason.trim() || undefined, scorecard }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.detail || j?.error || `HTTP ${res.status}`);
      }
      onClose(decision);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) onClose("cancelled"); }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>bid / no-bid decision — {rfpName}</DialogTitle>
          <DialogDescription>
            committing to pursue this RFP triggers proposal generation + milestone scheduling.
            answer the 5 strategic questions before deciding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {QUESTIONS.map((q) => (
            <Card
              key={q.key}
              onClick={() => toggle(q.key)}
              className={`cursor-pointer transition-colors ${
                scorecard[q.key] ? "bg-emerald-50 border-emerald-300" : "hover:bg-muted/40"
              }`}
            >
              <CardContent className="p-3 flex items-start gap-3">
                <div
                  className={`h-5 w-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                    scorecard[q.key] ? "bg-emerald-600 border-emerald-600 text-white" : "border-muted-foreground/40"
                  }`}
                >
                  {scorecard[q.key] && (
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium cursor-pointer">{q.label}</Label>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      weight {WEIGHTS[q.key]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{q.help}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Score + recommendation */}
        <div className="flex items-center justify-between gap-4 px-3 py-2 rounded-md bg-muted/40 border">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">score</p>
            <p className="text-2xl font-bold tabular-nums">{score} / 100</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">recommendation</p>
            <p
              className={`text-sm font-semibold ${
                recommendation === "bid"
                  ? "text-emerald-700"
                  : recommendation === "no-bid"
                  ? "text-red-700"
                  : "text-amber-700"
              }`}
            >
              {recommendation === "bid" ? "→ bid" : recommendation === "no-bid" ? "→ no-bid" : "→ borderline · use judgment"}
            </p>
          </div>
        </div>

        {/* Reason for no-bid */}
        <div className="space-y-1.5">
          <Label htmlFor="reason" className="text-xs">
            reason <span className="text-muted-foreground">(required for no-bid; optional otherwise — captured for win/loss learning)</span>
          </Label>
          <Textarea
            id="reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. budget too tight for the scope · timeline conflicts with prme delivery · funder relationship not yet built…"
          />
        </div>

        {errorMsg && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">⚠ {errorMsg}</p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => submit("deferred")}
            disabled={submitting}
          >
            defer
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => submit("no-bid")}
              disabled={submitting}
            >
              no-bid
            </Button>
            <Button
              type="button"
              onClick={() => submit("bid")}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? "..." : "bid · commit to pursue"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
