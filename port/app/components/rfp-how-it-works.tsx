"use client";

import { useState, useEffect } from "react";
import { Info, X, FileText, ArrowRight, Zap, Mail, Users, Eye } from "lucide-react";

const LS_KEY = "rfp-how-it-works-dismissed";

export function RfpHowItWorks() {
  // null = not yet hydrated (avoids SSR mismatch)
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    setDismissed(localStorage.getItem(LS_KEY) === "1");
  }, []);

  function dismiss() {
    localStorage.setItem(LS_KEY, "1");
    setDismissed(true);
  }

  if (dismissed === null) return null;

  if (dismissed) {
    return (
      <div className="mb-4">
        <button
          onClick={() => setDismissed(false)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="h-3 w-3" />
          how the kanban works →
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm relative">
      <button
        onClick={dismiss}
        className="absolute top-2.5 right-2.5 text-blue-400 hover:text-blue-600 transition-colors"
        aria-label="dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-center gap-1.5 font-medium text-blue-800 mb-2.5">
        <Info className="h-3.5 w-3.5 shrink-0" />
        how the kanban works
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-blue-700 mb-3">
        <div className="flex items-start gap-2">
          <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
          <span>
            <strong>drag to "pursuing"</strong> to trigger automatic proposal generation — Claude writes a first draft in ~2 min using your BD assets, org context, and annotated bibliography.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Eye className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
          <span>
            Claude <strong>reads the RFP requirements</strong> to decide what documents are needed — a proposal draft is always generated; a cover letter and team CVs are auto-generated if the RFP asks for them.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-500" />
          <span>
            the <strong className="text-purple-700">"review draft →"</strong> link that appears on the card opens the full proposal draft in Notion — sections include executive summary, approach, team, budget, and risks.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-blue-700">
        <div className="flex items-start gap-2">
          <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0 text-indigo-400" />
          <span>
            if a <strong className="text-indigo-700">cover letter</strong> is required, a Notion subpage is created under the deal and linked directly on the card.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Users className="h-3.5 w-3.5 mt-0.5 shrink-0 text-teal-500" />
          <span>
            if <strong className="text-teal-700">team CVs</strong> are required, a Notion subpage is created with bios for each named team member — linked on the card and ready to edit.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
          <span>
            moving a card back to pursuing <strong>won't regenerate</strong> if a draft already exists — clear "proposal status" in Notion first, then move the card again to trigger a fresh run.
          </span>
        </div>
      </div>
    </div>
  );
}
