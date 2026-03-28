"use client";

/**
 * Collapsible per-step tutorial panel for the campaign wizard.
 * Preference stored in localStorage — survives page reloads, resets per user.
 */

import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Lightbulb, X } from "lucide-react";

interface TutorialStep {
  title: string;
  tips: string[];
  example?: string;
}

const STEPS: Record<number, TutorialStep> = {
  1: {
    title: "choose your channels and campaign type",
    tips: [
      "email works best for detailed pitches and formal intros — it stays in the inbox and can be referenced later.",
      "LinkedIn works well for brief connection requests or warm follow-ups after meeting someone at an event.",
      "use 'one-off blast' for a single targeted send (e.g. a conference follow-up). use 'recurring cadence' for an always-on nurture sequence.",
      "you can combine channels in one campaign — e.g. email intro on day 1, LinkedIn connection on day 3.",
    ],
    example: "scenario: you're following up after BETT 2026. pick email + linkedin, type: event-based.",
  },
  2: {
    title: "pick a blueprint or build from scratch",
    tips: [
      "blueprints are pre-built sequences with tested timing and templates — fastest way to launch.",
      "'event outreach' is designed for conference lead-up: intro email 6 weeks before, event invite 1 week before, follow-up 1 day after.",
      "'cold intro sequence' is for new orgs you've never contacted: 4 steps over 14 days.",
      "start from scratch if you have a unique flow in mind — you can always save it as a blueprint later.",
    ],
    example: "scenario: you have 20 new orgs from cold research. pick 'cold intro sequence' — it's designed exactly for this.",
  },
  3: {
    title: "build your audience",
    tips: [
      "filters work with AND logic between categories and OR logic within a category. 'Tier 1' + 'email' type means: Tier 1 orgs that are email type.",
      "use 'manually add org' to include a specific org even if it doesn't match your filters.",
      "click the × next to any org to exclude them from this campaign without changing filters.",
      "add individual contacts to target specific people (not just their org's general email).",
      "the counter updates live — aim for 10–50 orgs for focused campaigns, 50–200 for broader blasts.",
    ],
    example: "scenario: you want to reach Tier 1 NGOs in your network, but also include one specific foundation you met at a conference. set priority filter to 'Tier 1' + type 'ngo', then manually add the foundation.",
  },
  4: {
    title: "customize your campaign steps",
    tips: [
      "click 'edit' on any step to modify subject line, body, and delay.",
      "use template variables like {{orgName}} to personalize at scale — they're replaced automatically at send time.",
      "shorter delays (3–7 days) work for event-based campaigns. longer delays (7–14 days) work for cold outreach.",
      "the first step delay is always relative to the campaign start date. later steps are relative to the previous step.",
      "you can add a step without a template — just write the content directly in the editor.",
    ],
    example: "scenario: the blueprint has a LinkedIn step but you don't use LinkedIn. click remove on that step, then add an email follow-up instead.",
  },
  5: {
    title: "review and launch",
    tips: [
      "give the campaign a descriptive name you'll recognize in 6 months, e.g. 'BETT 2026 — NGO outreach'.",
      "the launch checklist will flag anything missing before you can create — like no steps or an empty audience.",
      "the start date determines when step 1 fires. for event-based campaigns, set it far enough in advance.",
      "you can still edit the campaign name and dates after creation — but steps and audience are harder to change once live.",
    ],
    example: "scenario: you're launching a quarterly newsletter. name it 'Q2 2026 — winded.vertigo collective update', set start date to June 1.",
  },
};

const STORAGE_KEY = "campaign_tutorial_enabled";

export function useTutorial() {
  const [enabled, setEnabled] = useState(true); // default on

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setEnabled(stored === "true");
  }, []);

  function toggle() {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return { enabled, toggle };
}

interface CampaignTutorialProps {
  step: number;
  enabled: boolean;
}

export function CampaignTutorial({ step, enabled }: CampaignTutorialProps) {
  const [expanded, setExpanded] = useState(true);
  const content = STEPS[step];

  if (!enabled || !content) return null;

  return (
    <div className="rounded-lg border border-accent/20 bg-accent/5 text-sm">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2 text-accent">
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs font-medium">{content.title}</span>
        </div>
        {expanded
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        }
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-accent/10">
          <ul className="mt-2.5 space-y-1.5">
            {content.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-accent/40 shrink-0" />
                {tip}
              </li>
            ))}
          </ul>
          {content.example && (
            <div className="flex items-start gap-2 rounded-md bg-background border px-2.5 py-2">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">{content.example}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Small toggle button to show/hide tutorials globally. */
export function TutorialToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
        enabled
          ? "border-accent/30 bg-accent/5 text-accent"
          : "border-border text-muted-foreground hover:border-accent/30"
      }`}
    >
      {enabled ? <X className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
      {enabled ? "hide tips" : "show tips"}
    </button>
  );
}
