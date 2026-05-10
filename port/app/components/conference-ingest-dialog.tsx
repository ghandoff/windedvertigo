"use client";

/**
 * conference-ingest-dialog.tsx
 *
 * "+ ingest URL" dialog on the /events page toolbar (Phase 3 optional UI).
 * Calls POST /api/conferences/ingest with a URL entered by the user.
 * On success, refreshes the page so the new candidate card appears.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Link2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type IngestState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; name: string; fitScore: string | null; skipped: boolean; dedupedTo?: string | null }
  | { type: "error"; message: string };

export function ConferenceIngestDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [state, setState] = useState<IngestState>({ type: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setState({ type: "loading" });
    try {
      const res = await fetch("/api/conferences/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const json = await res.json();

      if (!res.ok) {
        setState({ type: "error", message: json.error ?? `server error ${res.status}` });
        return;
      }

      setState({
        type: "success",
        name: json.triage?.conferenceName ?? url,
        fitScore: json.triage?.fitScore ?? null,
        skipped: json.skipped === true,
        dedupedTo: json.dedupedTo ?? null,
      });

      router.refresh();
    } catch (err) {
      setState({
        type: "error",
        message: err instanceof Error ? err.message : "network error",
      });
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // reset on close so the next open starts fresh
      setUrl("");
      setState({ type: "idle" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
        <Link2 className="h-4 w-4" />
        ingest url
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">ingest conference url</DialogTitle>
        </DialogHeader>

        {state.type !== "success" ? (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="ingest-url" className="text-sm">conference url</Label>
              <Input
                id="ingest-url"
                type="url"
                placeholder="https://example-conference.org"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={state.type === "loading"}
                autoFocus
                required
              />
            </div>

            {state.type === "error" && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <XCircle className="h-4 w-4 shrink-0" />
                {state.message}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenChange(false)}
                disabled={state.type === "loading"}
              >
                cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={state.type === "loading" || !url.trim()}
              >
                {state.type === "loading" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    analysing…
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    ingest
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 pt-2">
            {state.skipped || state.dedupedTo ? (
              <div className="flex items-start gap-3 rounded-md bg-muted px-3 py-3 text-sm">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">already exists</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {state.skipped
                      ? "this url was classified as non-conference content"
                      : "a matching event is already in your list"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-md bg-green-50 dark:bg-green-950/30 px-3 py-3 text-sm">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium">{state.name}</p>
                  {state.fitScore && (
                    <p className="text-muted-foreground text-xs mt-0.5">
                      fit: {state.fitScore} · added as candidate
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUrl("");
                  setState({ type: "idle" });
                }}
              >
                ingest another
              </Button>
              <Button size="sm" onClick={() => handleOpenChange(false)}>
                done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
