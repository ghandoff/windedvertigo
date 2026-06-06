"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CrossrefMeta } from "@/lib/bibliography/crossref";
import { searchScholarlyAction, addFromSearchAction } from "../actions";
import { AssetPicker } from "./asset-picker";

// Scholarly discovery search (Crossref) → one-click add to the library.
// Mirrors the Nordic evidence page's article-search pattern, Crossref-backed.
export function DiscoverDialog({ allAssets }: { allAssets: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CrossrefMeta[]>([]);
  const [searched, setSearched] = useState(false);
  const [assets, setAssets] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // doi → "added" | "exists"
  const [status, setStatus] = useState<Record<string, "added" | "exists">>({});
  const [searching, startSearch] = useTransition();
  const [, startAdd] = useTransition();

  function reset() {
    setQuery("");
    setResults([]);
    setSearched(false);
    setAssets([]);
    setError(null);
    setStatus({});
  }

  function search() {
    setError(null);
    startSearch(async () => {
      const res = await searchScholarlyAction(query);
      setSearched(true);
      if (res.error) {
        setResults([]);
        return setError(res.error);
      }
      setResults(res.results ?? []);
    });
  }

  function add(meta: CrossrefMeta) {
    startAdd(async () => {
      const res = await addFromSearchAction(meta, assets);
      const key = meta.doi || meta.fullCitation;
      if (res.ok) {
        setStatus((s) => ({ ...s, [key]: "added" }));
        router.refresh();
      } else if (res.reason === "duplicate") {
        setStatus((s) => ({ ...s, [key]: "exists" }));
      } else {
        setError(res.error ?? "couldn't add");
      }
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
          <Search className="h-3.5 w-3.5" />
          discover
        </Button>
      } />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>discover citations (crossref)</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <form
            onSubmit={(e) => { e.preventDefault(); search(); }}
            className="flex gap-1.5"
          >
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="title, author, topic — e.g. responsible management education playful"
            />
            <Button type="submit" size="sm" className="shrink-0 gap-1" disabled={searching || !query.trim()}>
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              search
            </Button>
          </form>

          <div className="space-y-1.5">
            <Label className="text-[11px]">tag added citations (optional)</Label>
            <AssetPicker value={assets} allAssets={allAssets} onChange={setAssets} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-2 max-h-[48vh] overflow-y-auto">
            {results.map((m) => {
              const key = m.doi || m.fullCitation;
              const st = status[key];
              return (
                <div key={key} className="rounded border border-border p-2.5 text-xs space-y-1">
                  <p className="font-medium text-foreground leading-snug">{m.title}</p>
                  <p className="text-muted-foreground">
                    {m.authors || "—"}
                    {m.year ? <span className="tabular-nums"> · {m.year}</span> : null}
                    {m.venue ? ` · ${m.venue}` : ""}
                    {m.sourceType ? ` · ${m.sourceType}` : ""}
                    {m.citationCount != null ? ` · cited by ${m.citationCount}` : ""}
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    {st === "added" ? (
                      <span className="inline-flex items-center gap-1 text-green-600"><Check className="h-3 w-3" /> added</span>
                    ) : st === "exists" ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Check className="h-3 w-3" /> in library</span>
                    ) : (
                      <button type="button" onClick={() => add(m)} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Plus className="h-3 w-3" /> add
                      </button>
                    )}
                    {m.doiUrl && (
                      <a href={m.doiUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3 w-3" /> doi
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {searched && !searching && results.length === 0 && !error && (
              <p className="text-xs text-muted-foreground text-center py-6">no results — try different terms.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
