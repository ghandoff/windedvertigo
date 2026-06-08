"use client";

/**
 * ArticleSearchPanel — the collective's literature-retrieval tool.
 *
 * Searches the six academic providers at once, then — for every result —
 * runs the open-access waterfall (Unpaywall → OpenAlex → CORE → Europe PMC →
 * arXiv → the provider's OA link) to resolve a WORKING full-text URL. Reading
 * the actual article (PDF/HTML) is the headline; saving archives a rehosted
 * copy. Reuses the existing bibliography server actions — no new backend.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Check, ExternalLink, Loader2, FileText, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ScholarHit, ProviderStat } from "@/lib/bibliography/scholar/types";
import {
  searchScholarlyAction, addFromSearchAction, retrievePdfAction, resolveFullTextAction,
} from "@/app/(dashboard)/bibliography/actions";
import { AssetPicker } from "@/app/(dashboard)/bibliography/components/asset-picker";

const SRC_LABEL: Record<string, string> = {
  "oa-link": "open access", unpaywall: "Unpaywall", openalex: "OpenAlex",
  core: "CORE", arxiv: "arXiv", europepmc: "Europe PMC", upload: "upload",
};

type FullText = "loading" | "none" | { url: string; source: string };

export function ArticleSearchPanel({ allAssets }: { allAssets: string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ScholarHit[]>([]);
  const [providers, setProviders] = useState<ProviderStat[]>([]);
  const [exact, setExact] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<string[]>([]);
  const [fullText, setFullText] = useState<Record<string, FullText>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, "saving" | "saved" | "exists">>({});
  const [savePdf, setSavePdf] = useState<Record<string, string>>({});
  const [absOpen, setAbsOpen] = useState<Set<string>>(new Set());
  const [searching, startSearch] = useTransition();
  const [, startAdd] = useTransition();

  // resolve a working full-text URL for every hit (concurrency-capped)
  async function resolveAll(list: ScholarHit[]) {
    setFullText(Object.fromEntries(list.map((h) => [h.id, "loading" as FullText])));
    const queue = [...list];
    const worker = async () => {
      for (;;) {
        const h = queue.shift();
        if (!h) break;
        try {
          const r = await resolveFullTextAction({
            doi: h.doi, openAccessPdf: h.openAccessPdf, arxivId: h.arxivId ?? null, pmid: h.pmid,
          });
          setFullText((s) => ({ ...s, [h.id]: r ?? "none" }));
        } catch {
          setFullText((s) => ({ ...s, [h.id]: "none" }));
        }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  }

  function run() {
    if (!query.trim()) return;
    setError(null);
    setFullText({});
    setSaveStatus({});
    startSearch(async () => {
      const res = await searchScholarlyAction(query);
      setSearched(true);
      if (res.error) { setHits([]); setProviders([]); setExact(false); return setError(res.error); }
      const list = res.hits ?? [];
      setHits(list);
      setProviders(res.providers ?? []);
      setExact(!!res.exact);
      void resolveAll(list); // retrieve full text for each result
    });
  }

  function save(hit: ScholarHit) {
    setSaveStatus((s) => ({ ...s, [hit.id]: "saving" }));
    startAdd(async () => {
      const res = await addFromSearchAction(hit, assets);
      if (res.ok) {
        setSaveStatus((s) => ({ ...s, [hit.id]: "saved" }));
        router.refresh();
        if (res.id) {
          void retrievePdfAction(res.id).then((r) => {
            if (r.ok && r.source) setSavePdf((p) => ({ ...p, [hit.id]: r.source! }));
          }).catch(() => {});
        }
      } else if (res.reason === "duplicate") {
        setSaveStatus((s) => ({ ...s, [hit.id]: "exists" }));
      } else {
        setSaveStatus((s) => { const n = { ...s }; delete n[hit.id]; return n; });
        setError(res.error ?? "couldn't save");
      }
    });
  }

  function toggleAbs(id: string) {
    setAbsOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
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
            searches six databases at once, finds the actual full text, and lets you read or save it.
          </p>
          <div className="flex items-center gap-1.5">
            <Label className="text-[11px] text-muted-foreground">tag what you save:</Label>
            <AssetPicker value={assets} allAssets={allAssets} onChange={setAssets} />
          </div>
        </div>
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
            const ft = fullText[h.id];
            const sv = saveStatus[h.id];
            const sources = h.sources ?? [h.source];
            const authors = h.authors.slice(0, 4).join(", ") + (h.authors.length > 4 ? ", et al." : "");
            const isAbsOpen = absOpen.has(h.id);
            return (
              <div key={h.id} className="p-4 space-y-2 hover:bg-muted/20">
                <p className="text-sm font-medium text-foreground leading-snug">{h.title}</p>
                <p className="text-xs text-muted-foreground">
                  {authors || "—"}
                  {h.year ? <span className="tabular-nums"> · {h.year}</span> : null}
                  {h.venue ? <span className="italic"> · {h.venue}</span> : ""}
                  {h.citationCount != null ? ` · cited by ${h.citationCount}` : ""}
                </p>

                {/* abstract — visible inline, clamped */}
                {h.abstract && (
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <p className={isAbsOpen ? "" : "line-clamp-3"}>{h.abstract}</p>
                    <button type="button" onClick={() => toggleAbs(h.id)} className="text-[11px] text-primary hover:underline mt-0.5">
                      {isAbsOpen ? "less" : "more"}
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1.5 flex-wrap">
                  {sources.map((s) => <Badge key={s} variant="outline" className="text-[9px] py-0 px-1.5">{s}</Badge>)}
                  {sources.length > 1 && <Badge variant="secondary" className="text-[9px] py-0 px-1.5">confirmed by {sources.length}</Badge>}
                </div>

                {/* full-text retrieval — the headline */}
                <div className="flex items-center gap-3 flex-wrap pt-1">
                  {ft === "loading" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> finding full text across six sources…
                    </span>
                  ) : ft && ft !== "none" ? (
                    <a
                      href={ft.url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      <BookOpen className="h-4 w-4" /> read full text
                      <span className="text-[10px] font-normal text-muted-foreground">· via {SRC_LABEL[ft.source] ?? ft.source}</span>
                    </a>
                  ) : ft === "none" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5 opacity-50" /> no open-access full text
                      {h.doi && (
                        <a href={`https://doi.org/${h.doi}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground ml-1">
                          <ExternalLink className="h-3 w-3" /> view on publisher
                        </a>
                      )}
                    </span>
                  ) : null}

                  <span className="ml-auto flex items-center gap-3">
                    {h.doi && ft !== "none" && (
                      <a href={`https://doi.org/${h.doi}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3 w-3" /> doi
                      </a>
                    )}
                    {sv === "saved" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <Check className="h-3.5 w-3.5" /> saved{savePdf[h.id] ? ` · pdf via ${SRC_LABEL[savePdf[h.id]] ?? savePdf[h.id]}` : ""}
                      </span>
                    ) : sv === "exists" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" /> in library</span>
                    ) : sv === "saving" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> saving…</span>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => save(h)}>
                        <Plus className="h-3.5 w-3.5" /> save to library
                      </Button>
                    )}
                  </span>
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
          <p>search the wider literature — one box, six databases, the actual article in one click.</p>
        </div>
      )}
    </div>
  );
}
