"use client";

/**
 * social-metrics-form.tsx
 *
 * Manual-entry form for social media metrics. Opens as a dialog from the
 * KpiSourceModal. One platform per invocation; user fills in the cadence-
 * appropriate fields (weekly/monthly), submits, the parent server
 * component re-fetches with router.refresh().
 *
 * Surfaces the latest previous entry per metric_key so the user can spot
 * a typo (e.g., wrote 280 last week, this week typed 28 — clearly wrong).
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

// ── platform metadata for the form ────────────────────────────────────

interface MetricFieldDef {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
}

interface PlatformConfig {
  label: string;
  cadence: "weekly" | "monthly";
  fields: MetricFieldDef[];
  description: string;
}

const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  substack: {
    label: "substack",
    cadence: "monthly",
    description:
      "monthly subscriber count from windedvertigo.substack.com. take from the substack dashboard → “subscribers” header.",
    fields: [
      { key: "subscribers", label: "total subscribers", required: true },
    ],
  },
  linkedin: {
    label: "linkedin company page",
    cadence: "weekly",
    description:
      "weekly numbers from linkedin/company/winded-vertigo → analytics tab.",
    fields: [
      { key: "followers", label: "total followers", required: true },
      {
        key: "posts_published",
        label: "posts published this week",
        required: false,
      },
      {
        key: "recent_engagement",
        label: "engagement (likes + comments + shares)",
        required: false,
        hint: "sum across all posts in the period",
      },
    ],
  },
  instagram: {
    label: "instagram",
    cadence: "weekly",
    description:
      "weekly numbers from instagram.com/winded.vertigo → insights. business account at comms@windedvertigo.com.",
    fields: [
      { key: "followers", label: "total followers", required: true },
      {
        key: "recent_reach",
        label: "reach this week",
        required: false,
        hint: "unique accounts that saw any post",
      },
      {
        key: "recent_engagement",
        label: "engagement (likes + comments + saves + shares)",
        required: false,
      },
    ],
  },
  facebook: {
    label: "facebook page",
    cadence: "weekly",
    description: "weekly numbers from facebook.com/windedvertigo.",
    fields: [
      { key: "page_followers", label: "page followers", required: true },
      {
        key: "recent_engagement",
        label: "engagement this week",
        required: false,
      },
    ],
  },
  bluesky: {
    label: "bluesky",
    cadence: "weekly",
    description:
      "manual override for bsky.social/profile/windedvertigo.bsky.social. usually populated automatically by the api integration — only enter manually if the api is failing.",
    fields: [
      { key: "followers", label: "total followers", required: true },
    ],
  },
  tiktok: {
    label: "tiktok",
    cadence: "weekly",
    description: "if/when w.v starts a tiktok presence.",
    fields: [
      { key: "followers", label: "total followers", required: true },
      {
        key: "recent_engagement",
        label: "engagement this week",
        required: false,
      },
    ],
  },
};

// ── types ─────────────────────────────────────────────────────────────

export type SupportedPlatform = keyof typeof PLATFORM_CONFIG;

export interface SocialMetricsFormProps {
  platform: SupportedPlatform;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

interface PreviousEntry {
  value: number;
  enteredByEmail: string;
  enteredByName: string | null;
  enteredAt: string;
  periodEnd: string;
}

// ── component ─────────────────────────────────────────────────────────

export function SocialMetricsForm({
  platform,
  open,
  onOpenChange,
}: SocialMetricsFormProps) {
  const router = useRouter();
  const config = PLATFORM_CONFIG[platform];

  const [values, setValues] = useState<Record<string, string>>({});
  const [latest, setLatest] = useState<Record<string, PreviousEntry>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  // fetch previous entries when the dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/admin/social-metrics?platform=${platform}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.latest && typeof d.latest === "object") {
          // shape: { metric_key: row }
          const mapped: Record<string, PreviousEntry> = {};
          for (const [key, row] of Object.entries(
            d.latest as Record<string, Record<string, unknown>>,
          )) {
            mapped[key] = {
              value: row.value as number,
              enteredByEmail: row.enteredByEmail as string,
              enteredByName: (row.enteredByName as string | null) ?? null,
              enteredAt: row.enteredAt as string,
              periodEnd: row.periodEnd as string,
            };
          }
          setLatest(mapped);
        }
      })
      .catch(() => {
        // non-fatal; just won't show the previous-value hint
      });
    return () => {
      cancelled = true;
    };
  }, [platform, open]);

  // reset transient state when reopening
  useEffect(() => {
    if (!open) {
      setValues({});
      setError(null);
      setSavedCount(0);
    }
  }, [open]);

  const updateValue = useCallback((key: string, raw: string) => {
    setValues((prev) => ({ ...prev, [key]: raw }));
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);

    // collect (key, integer) pairs that the user filled in
    const toSubmit: { metricKey: string; value: number }[] = [];
    for (const field of config.fields) {
      const raw = values[field.key]?.trim();
      if (!raw) {
        if (field.required) {
          setError(`"${field.label}" is required`);
          setSubmitting(false);
          return;
        }
        continue;
      }
      const n = Number(raw.replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
        setError(`"${field.label}" must be a number between 0 and 1,000,000`);
        setSubmitting(false);
        return;
      }
      toSubmit.push({ metricKey: field.key, value: Math.round(n) });
    }

    if (toSubmit.length === 0) {
      setError("nothing to save");
      setSubmitting(false);
      return;
    }

    try {
      // POST each metric in sequence so the server validates per-row.
      // Could parallelize, but a 4-call serial is plenty fast for the form.
      for (const entry of toSubmit) {
        const res = await fetch("/api/admin/social-metrics", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform,
            metricKey: entry.metricKey,
            value: entry.value,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(
            data?.error ?? `save failed for ${entry.metricKey} (${res.status})`,
          );
        }
      }
      setSavedCount(toSubmit.length);
      router.refresh();
      // close after a short pause so the user sees the success state
      setTimeout(() => onOpenChange(false), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setSubmitting(false);
    }
  }, [config.fields, platform, values, router, onOpenChange]);

  const formatPrevious = (key: string): string | null => {
    const prev = latest[key];
    if (!prev) return null;
    const when = new Date(prev.enteredAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/Los_Angeles",
    }).toLowerCase();
    const who =
      prev.enteredByName?.toLowerCase().split(" ")[0] ??
      prev.enteredByEmail.split("@")[0];
    return `last entry: ${prev.value.toLocaleString()} · ${who} · ${when}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            update {config.label} numbers
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {config.fields.map((field) => {
            const previousLabel = formatPrevious(field.key);
            return (
              <div key={field.key} className="space-y-1">
                <label
                  htmlFor={field.key}
                  className="text-xs font-medium flex items-center gap-1.5"
                >
                  {field.label}
                  {field.required && (
                    <span className="text-[10px] text-[#b15043]">required</span>
                  )}
                </label>
                <Input
                  id={field.key}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9,]*"
                  value={values[field.key] ?? ""}
                  onChange={(e) => updateValue(field.key, e.target.value)}
                  placeholder={
                    latest[field.key]?.value != null
                      ? `e.g. ${latest[field.key].value.toLocaleString()}`
                      : "0"
                  }
                  disabled={submitting}
                  className="text-sm tabular-nums"
                />
                {field.hint && (
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    {field.hint}
                  </p>
                )}
                {previousLabel && (
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    {previousLabel}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
            {error}
          </p>
        )}

        {savedCount > 0 && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5">
            saved {savedCount} {savedCount === 1 ? "metric" : "metrics"} ✓
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
            save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small inline button that opens the form for a single platform. Use
    inside KpiSourceModal rows. */
export function UpdateMetricButton({
  platform,
  cadence,
  className,
}: {
  platform: SupportedPlatform;
  cadence: "weekly" | "monthly";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          className ??
          "text-[11px] text-[#b15043] hover:underline inline-flex items-center gap-0.5"
        }
      >
        enter {cadence} count →
      </button>
      <SocialMetricsForm
        platform={platform}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
