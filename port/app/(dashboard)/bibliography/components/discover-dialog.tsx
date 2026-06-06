"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Check, ExternalLink, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ScholarHit, ProviderStat } from "@/lib/bibliography/scholar/types";
import { searchScholarlyAction, addFromSearchAction } from "../actions";
import { AssetPicker } from "./asset-picker";

// Federated scholarly discovery — one query fanned across Crossref, OpenAlex,
// Semantic Scholar, PubMed, arXiv (+ CORE) → deduped, source-tagged → one-click add.
export function DiscoverDialog({ allAssets }: { allAssets: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ScholarHit[]>([]);
  const [providers, setProviders] = useState<ProviderStat[]>([]);
  const [searched, setSearched] = useState(false);
  const [assets, setAssets] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, "added" | "exists">>({});
  const [searching, startSearch] = useTransition();
  const [, startAdd] = useTransition();

  function reset() {
    setQuery("");
    setHits([]);
    setProviders([]);
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
        setHits([]);
        setProviders([]);
        return setError(res.error);
      }
      setHits(res.hits ?? []);
      setProviders(res.providers ?? []);
    });
  }

  function add(hit: ScholarHit) {
    startAdd(async () => {
      const res = await addFromSearchAction(hit, assets);
      if (res.ok) {
        setStatus((s) => ({ ...s, [hit.id]: "added" }));
        router.refresh();
      } else if (res.reason === "duplicate") {
        setStatus((s) => ({ ...s, [hit.id]: "exists" }));
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
          <DialogTitle>discover citations</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <form onSubmit={(e) => { e.preventDefault(); search(); }} className="flex gap-1.5">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="title, author, topic — fans out across 5+ databases"
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

          {/* provider stats — count, or ⚠ when a source was rate-limited/errored */}
          {providers.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              {providers.map((p) => `${p.id} ${p.error === "rate-limited" ? "⚠ limited" : p.error ? "⚠" : p.count}`).join(" · ")}
            </p>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-2 max-h-[46vh] overflow-y-auto">
            {hits.map((h) => {
              const st = status[h.id];
              const sources = h.sources ?? [h.source];
              const authors = h.authors.slice(0, 3).join(", ") + (h.authors.length > 3 ? ", et al." : "");
              return (
                <div key={h.id} className="rounded border border-border p-2.5 text-xs space-y-1">
                  <p className="font-medium text-foreground leading-snug">{h.title}</p>
                  <p className="text-muted-foreground">
                    {authors || "—"}
                    {h.year ? <span className="tabular-nums"> · {h.year}</span> : null}
                    {h.venue ? ` · ${h.venue}` : ""}
                    {h.sourceType ? ` · ${h.sourceType}` : ""}
                    {h.citationCount != null ? ` · cited by ${h.citationCount}` : ""}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {/* source chips */}
                    {sources.map((s) => (
                      <Badge key={s} variant="outline" className="text-[9px] py-0 px-1.5">{s}</Badge>
                    ))}
                    {sources.length > 1 && (
                      <Badge variant="secondary" className="text-[9px] py-0 px-1.5">confirmed by {sources.length}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 pt-0.5">
                    {st === "added" ? (
                      <span className="inline-flex items-center gap-1 text-green-600"><Check className="h-3 w-3" /> added</span>
                    ) : st === "exists" ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Check className="h-3 w-3" /> in library</span>
                    ) : (
                      <button type="button" onClick={() => add(h)} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Plus className="h-3 w-3" /> add
                      </button>
                    )}
                    {h.doi && (
                      <a href={`https://doi.org/${h.doi}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3 w-3" /> doi
                      </a>
                    )}
                    {h.openAccessPdf && (
                      <a href={h.openAccessPdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                        <FileText className="h-3 w-3" /> pdf
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {searched && !searching && hits.length === 0 && !error && (
              <p className="text-xs text-muted-foreground text-center py-6">no results — try different terms.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
