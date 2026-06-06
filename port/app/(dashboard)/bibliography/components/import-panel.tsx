"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ImportPlan, InTextPlan } from "@/lib/bibliography/import";
import { parseImportAction, applyImportAction, parseInTextAction, applyInTextAction } from "../actions";

type Mode = "references" | "in-text";

// Paste a reference list (match-or-insert) or prose with in-text citations
// (tag matches, list the unresolved). Review-first: parse never writes; apply writes.
export function ImportPanel({ allAssets }: { allAssets: string[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("references");
  const [text, setText] = useState("");
  const [asset, setAsset] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [inPlan, setInPlan] = useState<InTextPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ tagged: number; inserted?: number } | null>(null);
  const [pending, startTransition] = useTransition();

  function clearResults() {
    setPlan(null);
    setInPlan(null);
    setError(null);
    setDone(null);
  }
  function switchMode(m: Mode) {
    if (m === mode) return;
    setMode(m);
    clearResults();
  }

  function parse() {
    clearResults();
    startTransition(async () => {
      if (mode === "references") {
        const res = await parseImportAction(text, asset);
        if (res.error) return setError(res.error);
        setPlan(res.plan ?? null);
      } else {
        const res = await parseInTextAction(text, asset);
        if (res.error) return setError(res.error);
        setInPlan(res.plan ?? null);
      }
    });
  }

  function apply() {
    setError(null);
    startTransition(async () => {
      if (mode === "references" && plan) {
        const res = await applyImportAction(plan);
        if (res.error) return setError(res.error);
        setDone({ tagged: res.tagged ?? 0, inserted: res.inserted ?? 0 });
        setPlan(null);
      } else if (mode === "in-text" && inPlan) {
        const res = await applyInTextAction(inPlan);
        if (res.error) return setError(res.error);
        setDone({ tagged: res.tagged ?? 0 });
        setInPlan(null);
      }
      router.refresh();
    });
  }

  const activePlan = mode === "references" ? plan : inPlan;
  const changeCount = plan
    ? plan.matched.length + plan.newCitations.length
    : inPlan
      ? inPlan.matched.length
      : 0;

  return (
    <div className="space-y-3">
      <div className="space-y-3 max-h-[56vh] overflow-y-auto pr-1">
        {/* mode toggle */}
        <div className="space-y-1.5">
          <Label>source text is…</Label>
          <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
            {(["references", "in-text"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "references" ? "a reference list" : "in-text citations"}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {mode === "references"
              ? "existing citations get tagged; new ones are added."
              : "tags the library rows these inline cites point to; unresolved ones are listed, never inserted."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="imp-asset">asset (the deliverable these citations appear in)</Label>
          <Input
            id="imp-asset"
            list="imp-asset-options"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            placeholder="e.g. ppcs final report 2025"
          />
          <datalist id="imp-asset-options">
            {allAssets.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="imp-text">{mode === "references" ? "reference list / citations" : "document text / prose"}</Label>
          <Textarea
            id="imp-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={
              mode === "references"
                ? "Author, A. A. (2020). Title. Journal, 12(3), 45-67.\nAuthor, B. B. (2021). …"
                : "…paste prose containing inline citations like (Pirson, 2020) and Storey et al., 2017…"
            }
            className="font-mono text-xs"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {done && (
          <div className="rounded border border-border p-3 text-xs space-y-1">
            <p className="font-medium text-foreground">
              done — tagged {done.tagged}
              {done.inserted !== undefined ? `, added ${done.inserted} new` : ""}.
            </p>
            <p className="text-muted-foreground">re-running the same text is a no-op (idempotent).</p>
          </div>
        )}

        {plan && mode === "references" && (
          <div className="rounded border border-border p-3 space-y-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">{plan.matched.length} matched</Badge>
              <Badge variant="default" className="text-[10px]">{plan.newCitations.length} new</Badge>
              <Badge variant="outline" className="text-[10px]">{plan.alreadyTagged.length} already tagged</Badge>
              <span className="text-muted-foreground">→ asset &ldquo;{plan.asset}&rdquo;</span>
            </div>
            {plan.matched.length > 0 && (
              <details>
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  {plan.matched.length} existing → will be tagged
                </summary>
                <ul className="mt-1.5 space-y-1 pl-3">
                  {plan.matched.map((m) => (
                    <li key={m.id} className="text-muted-foreground leading-snug list-disc">{m.fullCitation}</li>
                  ))}
                </ul>
              </details>
            )}
            {plan.newCitations.length > 0 && (
              <details open>
                <summary className="cursor-pointer text-foreground font-medium">
                  {plan.newCitations.length} new → will be added
                </summary>
                <ul className="mt-1.5 space-y-1 pl-3">
                  {plan.newCitations.map((c, i) => (
                    <li key={i} className="text-foreground leading-snug list-disc">
                      {c.fullCitation}
                      {c.year ? <span className="text-muted-foreground tabular-nums"> ({c.year})</span> : null}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {inPlan && mode === "in-text" && (
          <div className="rounded border border-border p-3 space-y-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default" className="text-[10px]">{inPlan.matched.length} matched</Badge>
              <Badge variant="outline" className="text-[10px]">{inPlan.alreadyTagged.length} already tagged</Badge>
              <Badge variant="secondary" className="text-[10px]">{inPlan.unresolved.length} unresolved</Badge>
              <span className="text-muted-foreground">→ asset &ldquo;{inPlan.asset}&rdquo;</span>
            </div>
            {inPlan.matched.length > 0 && (
              <details open>
                <summary className="cursor-pointer text-foreground font-medium">
                  {inPlan.matched.length} resolved → will be tagged
                </summary>
                <ul className="mt-1.5 space-y-1 pl-3">
                  {inPlan.matched.map((m) => (
                    <li key={m.id} className="text-foreground leading-snug list-disc">{m.fullCitation}</li>
                  ))}
                </ul>
              </details>
            )}
            {inPlan.unresolved.length > 0 && (
              <details>
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  {inPlan.unresolved.length} unresolved → not in the library (handle manually)
                </summary>
                <ul className="mt-1.5 space-y-1 pl-3">
                  {inPlan.unresolved.map((c, i) => (
                    <li key={i} className="text-muted-foreground leading-snug list-disc">
                      {c.author}
                      {c.year ? <span className="tabular-nums"> ({c.year})</span> : null}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        {activePlan ? (
          <Button onClick={apply} disabled={pending || changeCount === 0}>
            {pending ? "applying…" : changeCount === 0 ? "nothing to apply" : `apply (${changeCount} ${mode === "references" ? "changes" : "tags"})`}
          </Button>
        ) : (
          <Button onClick={parse} disabled={pending || !text.trim() || !asset.trim()}>
            {pending ? "parsing…" : "parse + preview"}
          </Button>
        )}
      </div>
    </div>
  );
}
