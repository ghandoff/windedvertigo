"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ImportPlan } from "@/lib/bibliography/import";
import { parseImportAction, applyImportAction } from "../actions";

// Reusable "import citations" tool: paste a reference list, pick an asset, parse →
// review the matched/new/already-tagged split, apply → tag + insert. Review-first
// (parse never writes; apply writes). This is the durable "as they come in" surface.
export function ImportDialog({ allAssets }: { allAssets: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [asset, setAsset] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ tagged: number; inserted: number } | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setText("");
    setAsset("");
    setPlan(null);
    setError(null);
    setDone(null);
  }

  function parse() {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const res = await parseImportAction(text, asset);
      if (res.error) return setError(res.error);
      setPlan(res.plan ?? null);
    });
  }

  function apply() {
    if (!plan) return;
    setError(null);
    startTransition(async () => {
      const res = await applyImportAction(plan);
      if (res.error) return setError(res.error);
      setDone({ tagged: res.tagged ?? 0, inserted: res.inserted ?? 0 });
      setPlan(null);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={
        <Button size="sm" variant="outline" className="gap-1.5">
          <FileDown className="h-3.5 w-3.5" />
          import citations
        </Button>
      } />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>import citations</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[64vh] overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            paste a document&rsquo;s reference list. existing citations get tagged with the
            asset; new ones are added. nothing is written until you review + apply.
          </p>

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
            <Label htmlFor="imp-text">reference list / citations</Label>
            <Textarea
              id="imp-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={"Author, A. A. (2020). Title. Journal, 12(3), 45-67.\nAuthor, B. B. (2021). …"}
              className="font-mono text-xs"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {done && (
            <div className="rounded border border-border p-3 text-xs space-y-1">
              <p className="font-medium text-foreground">
                done — tagged {done.tagged}, added {done.inserted} new.
              </p>
              <p className="text-muted-foreground">re-running the same list is a no-op (idempotent).</p>
            </div>
          )}

          {plan && (
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            close
          </Button>
          {plan ? (
            <Button onClick={apply} disabled={pending}>
              {pending ? "applying…" : `apply (${plan.matched.length + plan.newCitations.length} changes)`}
            </Button>
          ) : (
            <Button onClick={parse} disabled={pending || !text.trim() || !asset.trim()}>
              {pending ? "parsing…" : "parse + preview"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
