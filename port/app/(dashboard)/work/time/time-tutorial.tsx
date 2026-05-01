"use client";

/**
 * Multi-step onboarding tutorial for the time-tracking & Gusto sync workflow.
 *
 * Shows automatically on first visit (localStorage gate). Users can re-open
 * via the "guide" button in the page header. Tutorial content adapts based
 * on the user's visibility tier — admins see all 5 steps including Gusto
 * sync and invoicing; members see a focused 3-step version.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Clock,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  FileText,
  RefreshCw,
  BookOpen,
  CalendarDays,
  Zap,
} from "lucide-react";
import type { VisibilityTier } from "@/lib/role";

// ── types & data ────────────────────────────────────────

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string[];
  accent: string;
}

// Steps visible to everyone
const SHARED_STEPS: Step[] = [
  {
    icon: <Clock className="h-5 w-5" />,
    title: "time entries flow in automatically",
    description:
      "timesheets are created from your Google Calendar via the daily sync cron. each calendar event matched to a project becomes a draft entry with hours pre-calculated.",
    details: [
      "entries link to work items and projects through Notion relations",
      "hours and minutes are pulled from the calendar event duration",
      "you can also create entries manually in Notion for non-calendar work",
    ],
    accent: "blue",
  },
  {
    icon: <CalendarDays className="h-5 w-5" />,
    title: "use GCal to block time and track it",
    description:
      "your Google Calendar isn\u2019t just for meetings \u2014 it\u2019s your time tracker. block focused work sessions as calendar events and they\u2019ll automatically become timesheet entries.",
    details: [
      "create events for deep work: \u201cPRME \u2014 evidence framework\u201d, \u201cIDB \u2014 proposal writing\u201d",
      "include the project name so the sync can match it automatically",
      "blocked time protects your calendar from meetings AND logs your hours",
      "even 30-min blocks add up \u2014 this is how the collective pulse tracks your workload",
      "tip: use recurring blocks for steady work (e.g., \u201cweekly admin\u201d every Friday 2\u20133pm)",
    ],
    accent: "blue",
  },
  {
    icon: <CheckCircle2 className="h-5 w-5" />,
    title: "the approval workflow",
    description:
      "every timesheet moves through a status pipeline. entries start as drafts and need approval before they can be invoiced or synced to payroll.",
    details: [
      "draft \u2192 submitted \u2192 approved \u2192 invoiced \u2192 paid",
      "draft entries show a yellow warning \u2014 they need attention",
      "once approved, entries are ready for payroll or invoicing",
      "mark entries as billable to include them in client invoices",
    ],
    accent: "green",
  },
  {
    icon: <DollarSign className="h-5 w-5" />,
    title: "rates and hours",
    description:
      "each timesheet can carry an hourly rate. the summary cards show your total, draft, approved, and billable hours at a glance.",
    details: [
      "rates are set per entry in Notion \u2014 different members can have different rates",
      "billable hours are what gets invoiced to clients",
      "non-billable hours (internal work) still count toward your total",
      "reimbursements (e.g., Claude Pro, tools) use type = \"reimbursement\" with a flat amount",
    ],
    accent: "purple",
  },
];

// Extra detail for "self" tier — personalized context
const SELF_ENTRY_DETAIL = "your time entries appear here \u2014 filtered to your account";

// Extra detail for admin/team tier — team-wide context
const ADMIN_ENTRY_DETAIL = "all team members\u2019 entries appear here \u2014 this is the admin view";

// Admin-only steps
const ADMIN_EXTRA_STEPS: Step[] = [
  {
    icon: <RefreshCw className="h-5 w-5" />,
    title: "Gusto sync",
    description:
      "once entries are approved, the \"sync to Gusto\" button pushes them to your payroll system. it matches team members by email and posts hours as contractor payments or employee time.",
    details: [
      "only approved entries sync \u2014 draft and submitted are skipped",
      "members are matched to Gusto by their email address",
      "synced entries get marked as \"invoiced\" so they won\u2019t sync twice",
      "the sync also runs automatically via the daily cron job",
    ],
    accent: "emerald",
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: "invoice generation",
    description:
      "use \"generate invoice\" in the header to create branded invoices from approved billable timesheets. select a project and month, preview the invoice, then send or print.",
    details: [
      "invoices pull line items from approved billable entries for the selected project + period",
      "the invoice number is editable (format: WV-YYYY-NNN)",
      "send directly via email or use print/PDF for manual delivery",
      "sent invoices mark their timesheets as \"invoiced\" automatically",
    ],
    accent: "amber",
  },
];

function buildSteps(tier: VisibilityTier): Step[] {
  const isAdminLike = tier === "admin" || tier === "finance";

  // Customize the first step's details based on tier
  const entryStep: Step = {
    ...SHARED_STEPS[0],
    details: [
      ...SHARED_STEPS[0].details,
      isAdminLike ? ADMIN_ENTRY_DETAIL : SELF_ENTRY_DETAIL,
    ],
  };

  const base = [entryStep, SHARED_STEPS[1], SHARED_STEPS[2]];

  if (isAdminLike) {
    return [...base, ...ADMIN_EXTRA_STEPS];
  }

  return base;
}

const ACCENT_MAP: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  blue:    { bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-200",    dot: "bg-blue-400" },
  green:   { bg: "bg-green-50",   text: "text-green-600",   border: "border-green-200",   dot: "bg-green-400" },
  purple:  { bg: "bg-purple-50",  text: "text-purple-600",  border: "border-purple-200",  dot: "bg-purple-400" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", dot: "bg-emerald-400" },
  amber:   { bg: "bg-amber-50",   text: "text-amber-600",   border: "border-amber-200",   dot: "bg-amber-400" },
};

// ── quick-start messages ────────────────────────────────

const ADMIN_QUICKSTART = (
  <>
    <span className="font-medium text-foreground">quick start:</span>{" "}
    check that your calendar sync is running, approve any draft entries,
    then hit &quot;sync to Gusto&quot; to push hours to payroll.
  </>
);

const MEMBER_QUICKSTART = (
  <>
    <span className="font-medium text-foreground">quick start:</span>{" "}
    your calendar events sync automatically. check that draft entries
    look correct, then they&apos;ll move through the approval flow.
  </>
);

// ── localStorage hook ───────────────────────────────────

const STORAGE_KEY = "time_tutorial_dismissed";

export function useTimeTutorial() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed !== "true") {
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  const reopen = useCallback(() => {
    setOpen(true);
  }, []);

  return { open, setOpen, dismiss, reopen };
}

// ── stepper dots ────────────────────────────────────────

function StepDots({
  total,
  current,
  onSelect,
}: {
  total: number;
  current: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          className={`h-1.5 rounded-full transition-all duration-200 ${
            i === current
              ? "w-4 bg-foreground"
              : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
          }`}
          aria-label={`Go to step ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ── main component ──────────────────────────────────────

interface TimeTutorialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss: () => void;
  tier: VisibilityTier;
}

export function TimeTutorial({ open, onOpenChange, onDismiss, tier }: TimeTutorialProps) {
  const steps = buildSteps(tier);
  const [step, setStep] = useState(0);
  const current = steps[step];
  const colors = ACCENT_MAP[current.accent];
  const isLast = step === steps.length - 1;
  const isAdminLike = tier === "admin" || tier === "finance";

  function handleNext() {
    if (isLast) {
      onDismiss();
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 ${colors.text}`}>
              {current.icon}
              <span className="text-[10px] font-medium uppercase tracking-wider">
                step {step + 1} of {steps.length}
              </span>
            </div>
            <StepDots total={steps.length} current={step} onSelect={setStep} />
          </div>
          <DialogTitle className="text-base">{current.title}</DialogTitle>
          <DialogDescription>{current.description}</DialogDescription>
        </DialogHeader>

        {/* detail bullets */}
        <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3 space-y-2`}>
          {current.details.map((detail, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className={`mt-1 h-1.5 w-1.5 rounded-full ${colors.dot} shrink-0`} />
              {detail}
            </div>
          ))}
        </div>

        {/* quick-start on last step */}
        {isLast && (
          <div className="flex items-start gap-2 rounded-md bg-muted/50 border px-3 py-2.5">
            <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              {isAdminLike ? ADMIN_QUICKSTART : MEMBER_QUICKSTART}
            </p>
          </div>
        )}

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onDismiss} className="text-muted-foreground">
              skip
            </Button>
            <Button size="sm" onClick={handleNext} className="gap-1.5">
              {isLast ? (
                <>
                  get started
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  next
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── header trigger button ───────────────────────────────

export function TutorialButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title="show time tracking tutorial"
    >
      <BookOpen className="h-3.5 w-3.5" />
      guide
    </button>
  );
}
