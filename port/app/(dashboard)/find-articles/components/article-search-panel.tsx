"use client";

/**
 * ArticleSearchPanel — the collective's literature-retrieval tool, front and
 * centre. Searches the six academic providers at once (Crossref, OpenAlex,
 * Semantic Scholar, PubMed, arXiv, CORE), shows clean results, and adds to the
 * bibliography in one click (with optional asset tagging + auto PDF retrieval).
 *
 * Reuses the existing bibliography server actions — no new backend.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Check, ExternalLink, Loader2, FileText, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ScholarHit, ProviderStat } from "@/lib/bibliography/scholar/types";
import {
  searchScholarlyAction, addFromSearchAction, retrievePdfAction,
} from "@/app/(dashboard)/bibliography/actions";
import { AssetPicker } from "@/app/(dashboard)/bibliography/components/asset-picker";

const PDF_SOURCE_LABEL: Record<string, string> = {
  "oa-link": "OA link", unpaywall: "Unpaywall", openalex: "OpenAlex",
  core: "CORE", arxiv: "arXiv", europepmc: "Europe PMC", upload: "upload",
};

export function ArticleSearchPanel({ allAssets }: { allAssets: string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ScholarHit[]>([]);
  const [providers, setProviders] = useState<ProviderStat[]>([]);
  const [exact, setExact] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, "added" | "exists">>({});
  const [pdf, setPdf] = useState<Record<string, string>>({});
  const [assets, setAssets] = useState<string[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [searching, startSearch] = useTransition();
  const [, startAdd] = useTransition();

  function run() {
    if (!query.trim()) return;
    setError(null);
    startSearch(async () => {
      const res = await searchScholarlyAction(query);
      setSearched(true);
      if (res.error) { setHits([]); setProviders([]); setExact(false); return setError(res.error); }
      setHits(res.hits ?? []);
      setProviders(res.providers ?? []);
      setExact(!!res.exact);
    });
  }

  function add(hit: ScholarHit) {
    startAdd(async () => {
      const res = await addFromSearchAction(hit, assets);
      if (res.ok) {
        setStatus((s) => ({ ...s, [hit.id]: "added" }));
        router.refresh();
        if (res.id) {
          void retrievePdfAction(res.id).then((r) => {
            if (r.ok && r.source) setPdf((p) => ({ ...p, [hit.id]: r.source! }));
            router.refresh();
          }).catch(() => {});
        }
      } else if (res.reason === "duplicate") {
        setStatus((s) => ({ ...s, [hit.id]: "exists" }));
      } else setError(res.error ?? "couldn't add");
    });
  }

  function toggleAbstract(id: string) {
    setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  return (
    <div className="space-y-4">
      {/* ── search box ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search by topic, title, author, or paste a DOI…"
              className="h-11 pl-9 text-base"
            />
          </div>
          <Button type="submit" size="lg" className="gap-1.5 shrink-0" disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            search
          </Button>
        </form>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            searches Crossref, OpenAlex, Semantic Scholar, PubMed, arXiv &amp; CORE at once — add with one click.
          </p>
          <div className="flex items-center gap-1.5">
            <Label className="text-[11px] text-muted-foreground">tag as you add:</Label>
            <AssetPicker value={assets} allAssets={allAssets} onChange={setAssets} />
          </div>
        </div>

        {/* provider stats */}
        {!exact && providers.length > 0 && (
          <p className="text-[11px] text-muted-foreground border-t border-border/60 pt-2">
            {providers.map((p) => `${p.id} ${p.error === "rate-limited" ? "⚠ limited" : p.error ? "⚠" : p.count}`).join(" · ")}
          </p>
        )}
        {exact && hits.length > 0 && (
          <p className="text-[11px] text-muted-foreground border-t border-border/60 pt-2">exact DOI match · crossref</p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {/* ── results ────────────────────────────────────────────────── */}
      {hits.length > 0 && (
        <div className="rounded-md border divide-y divide-border overflow-hidden">
          {hits.map((h) => {
            const st = status[h.id];
            const sources = h.sources ?? [h.source];
            const authors = h.authors.slice(0, 4).join(", ") + (h.authors.length > 4 ? ", et al." : "");
            const isOpen = open.has(h.id);
            const pdfSrc = pdf[h.id];
            return (
              <div key={h.id} className="p-3.5 flex items-start gap-3 hover:bg-muted/20">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-sm font-medium text-foreground leading-snug">{h.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {authors || "—"}
                    {h.year ? <span className="tabular-nums"> · {h.year}</span> : null}
                    {h.venue ? <span className="italic"> · {h.venue}</span> : ""}
                    {h.citationCount != null ? ` · cited by ${h.citationCount}` : ""}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {sources.map((s) => <Badge key={s} variant="outline" className="text-[9px] py-0 px-1.5">{s}</Badge>)}
                    {sources.length > 1 && <Badge variant="secondary" className="text-[9px] py-0 px-1.5">confirmed by {sources.length}</Badge>}
                    {h.sourceType && <Badge variant="outline" className="text-[9px] py-0 px-1.5">{h.sourceType}</Badge>}
                  </div>
                  {h.abstract && (
                    <div>
                      <button
                        type="button"
                        onClick={() => toggleAbstract(h.id)}
                        className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        abstract
                      </button>
                      {isOpen && <p className="text-xs text-muted-foreground leading-relaxed mt-1">{h.abstract}</p>}
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-0.5">
                    {h.doi && (
                      <a href={`https://doi.org/${h.doi}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3 w-3" /> doi
                      </a>
                    )}
                    {h.openAccessPdf && (
                      <a href={h.openAccessPdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                        <FileText className="h-3 w-3" /> open pdf
                      </a>
                    )}
                  </div>
                </div>

                {/* add button / status */}
                <div className="shrink-0 self-center flex flex-col items-end gap-1">
                  {st === "added" ? (
                    <>
                      <span className="inline-flex items-center gap-1 text-xs text-green-600"><Check className="h-3.5 w-3.5" /> added</span>
                      {pdfSrc && <span className="text-[9px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 rounded-full px-1.5 py-0.5">pdf · {PDF_SOURCE_LABEL[pdfSrc] ?? pdfSrc}</span>}
                    </>
                  ) : st === "exists" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" /> in library</span>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => add(h)}>
                      <Plus className="h-3.5 w-3.5" /> add
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {searched && !searching && hits.length === 0 && !error && (
        <p className="text-sm text-muted-foreground text-center py-10">no results — try different terms.</p>
      )}
      {!searched && !searching && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <Search className="h-6 w-6 mx-auto mb-3 opacity-30" />
          <p>search the wider literature — one box, six databases, one-click add.</p>
        </div>
      )}
    </div>
  );
}
