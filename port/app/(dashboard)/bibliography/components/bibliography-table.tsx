"use client";

import { Fragment, useState, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil, Trash2, ExternalLink, Search, Library, Globe, ArrowUpDown, ArrowUp, ArrowDown,
  Download, Loader2, Plus, Check, FileText, Sparkles, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { BibliographyRow } from "@/lib/supabase/bibliography";
import type { ScholarHit, ProviderStat } from "@/lib/bibliography/scholar/types";
import { UsedInEditor } from "./used-in-editor";
import { CitationDialog } from "./citation-dialog";
import { AddCitationsDialog } from "./add-citations-dialog";
import { CitationDetail } from "./citation-detail";
import { FacetMultiSelect, type FacetOption } from "./facet-multi-select";
import { AssignResearchTopic } from "@/app/components/assign-research-topic";
import {
  deleteCitationAction, retrievePdfAction,
  searchScholarlyAction, addFromSearchAction,
} from "../actions";

// ── display helpers ───────────────────────────────────────────────────────────

/** Lead author for the author column + A–Z sort. */
function leadAuthor(r: BibliographyRow): string {
  if (r.firstAuthor) return r.firstAuthor;
  if (r.authors?.[0]) return r.authors[0].split(/[,\s]/)[0];
  // legacy fallback: leading token of the citation
  const lead = r.fullCitation.split(/\(\d{4}/)[0] || r.fullCitation;
  return lead.trim().split(/[,\s]/)[0] || "—";
}

function authorDisplay(r: BibliographyRow): string {
  const lead = leadAuthor(r);
  const n = r.authors?.length ?? 0;
  if (n > 1) return `${lead} et al.`;
  return lead;
}

/**
 * Clean title only — the title sentence, without the journal/volume/pages tail.
 * Strips the leading "Authors (year). " then keeps up to the end of the title
 * sentence (before the journal). The full citation lives in the expand row.
 */
function cleanTitle(r: BibliographyRow): string {
  const afterYear = r.fullCitation.split(/\)\.\s+/);
  const tail = (afterYear.length > 1 ? afterYear.slice(1).join("). ") : r.fullCitation).trim();
  const title = tail.split(/\.\s+/)[0]?.trim();
  return title || tail || r.fullCitation;
}

type SortKey = "author" | "title" | "journal" | "year" | "cites" | "added";

const PDF_SOURCE_LABEL: Record<string, string> = {
  "oa-link": "OA link", unpaywall: "Unpaywall", openalex: "OpenAlex",
  core: "CORE", arxiv: "arXiv", europepmc: "Europe PMC", upload: "upload",
};

// ── component ─────────────────────────────────────────────────────────────────

export function BibliographyTable({
  rows,
  assets,
}: {
  rows: BibliographyRow[];
  assets: string[];
  topics: string[];
}) {
  const router = useRouter();

  // search + mode
  const [mode, setMode] = useState<"library" | "find">("library");
  const [search, setSearch] = useState("");

  // facets
  const [fTopics, setFTopics] = useState<string[]>([]);
  const [fJournals, setFJournals] = useState<string[]>([]);
  const [fTypes, setFTypes] = useState<string[]>([]);
  const [fAssets, setFAssets] = useState<string[]>([]);
  const [hasPdf, setHasPdf] = useState(false);

  // sort
  const [sortKey, setSortKey] = useState<SortKey>("year");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // row interaction
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<BibliographyRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<BibliographyRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // ── facet option lists (value + count) ──────────────────────────────────────
  const facetOptions = useCallback(
    (pick: (r: BibliographyRow) => string[] | string | null): FacetOption[] => {
      const counts = new Map<string, number>();
      for (const r of rows) {
        const v = pick(r);
        const vals = Array.isArray(v) ? v : v ? [v] : [];
        for (const x of vals) counts.set(x, (counts.get(x) ?? 0) + 1);
      }
      return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
    },
    [rows],
  );
  const topicOpts = useMemo(() => facetOptions((r) => r.topic), [facetOptions]);
  const journalOpts = useMemo(() => facetOptions((r) => r.journal), [facetOptions]);
  const typeOpts = useMemo(() => facetOptions((r) => r.sourceType), [facetOptions]);
  const assetOpts = useMemo(() => facetOptions((r) => r.usedIn ?? []), [facetOptions]);

  // ── filter + sort ───────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const out = rows.filter((r) => {
      if (fTopics.length && !(r.topic && fTopics.includes(r.topic))) return false;
      if (fJournals.length && !(r.journal && fJournals.includes(r.journal))) return false;
      if (fTypes.length && !(r.sourceType && fTypes.includes(r.sourceType))) return false;
      if (fAssets.length && !(r.usedIn ?? []).some((a) => fAssets.includes(a))) return false;
      if (hasPdf && !r.pdfUrl) return false;
      if (q) {
        const hay = `${r.fullCitation} ${(r.authors ?? []).join(" ")} ${r.journal ?? ""} ${r.keywords ?? ""} ${r.abstract ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: BibliographyRow, b: BibliographyRow): number => {
      switch (sortKey) {
        case "author": return leadAuthor(a).localeCompare(leadAuthor(b)) * dir;
        case "title": return cleanTitle(a).localeCompare(cleanTitle(b)) * dir;
        case "journal": return (a.journal ?? "~").localeCompare(b.journal ?? "~") * dir;
        case "year": return ((a.year ?? 0) - (b.year ?? 0)) * dir;
        case "cites": return ((a.citationCount ?? 0) - (b.citationCount ?? 0)) * dir;
        case "added": return (a.createdAt ?? "").localeCompare(b.createdAt ?? "") * dir;
      }
    };
    return [...out].sort(cmp);
  }, [rows, fTopics, fJournals, fTypes, fAssets, hasPdf, q, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      // sensible default direction per column
      setSortDir(key === "author" || key === "title" || key === "journal" ? "asc" : "desc");
    }
  }

  // render helper (not a component — avoids "component created during render")
  function sortHead(k: SortKey, label: string, className?: string) {
    const active = sortKey === k;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : ""}`}
        >
          {label}
          {active ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                  : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </button>
      </TableHead>
    );
  }

  function del(r: BibliographyRow) {
    if (!window.confirm(`delete this citation?\n\n${r.fullCitation.slice(0, 120)}`)) return;
    startTransition(async () => { await deleteCitationAction(r.id); router.refresh(); });
  }

  function findPdf(r: BibliographyRow) {
    setPdfBusy((s) => new Set(s).add(r.id));
    startTransition(async () => {
      await retrievePdfAction(r.id);
      router.refresh();
      setPdfBusy((s) => { const n = new Set(s); n.delete(r.id); return n; });
    });
  }

  function toggleExpand(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  const facetCount = fTopics.length + fJournals.length + fTypes.length + fAssets.length + (hasPdf ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* ── unified search bar + mode toggle ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* mode toggle */}
          <div className="inline-flex rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setMode("library")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${mode === "library" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Library className="h-3.5 w-3.5" /> my library
            </button>
            <button
              type="button"
              onClick={() => setMode("find")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${mode === "find" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Globe className="h-3.5 w-3.5" /> find new
            </button>
          </div>
          <UnifiedSearch mode={mode} search={search} setSearch={setSearch} />
        </div>
        <div className="flex items-center gap-2">
          <AssignResearchTopic assignedBy="Jamie" />
          <AddCitationsDialog allAssets={assets} />
        </div>
      </div>

      {mode === "library" ? (
        <>
          {/* ── facet bar ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            <FacetMultiSelect label="topics" options={topicOpts} selected={fTopics} onChange={setFTopics} />
            <FacetMultiSelect label="journals" options={journalOpts} selected={fJournals} onChange={setFJournals} />
            <FacetMultiSelect label="type" options={typeOpts} selected={fTypes} onChange={setFTypes} />
            <FacetMultiSelect label="used in" options={assetOpts} selected={fAssets} onChange={setFAssets} />
            <button
              type="button"
              onClick={() => setHasPdf((v) => !v)}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs transition-colors ${hasPdf ? "border-primary/60 bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"}`}
            >
              <FileText className="h-3.5 w-3.5" /> has pdf
            </button>
            {facetCount > 0 && (
              <button
                type="button"
                onClick={() => { setFTopics([]); setFJournals([]); setFTypes([]); setFAssets([]); setHasPdf(false); }}
                className="text-[11px] text-muted-foreground hover:text-foreground underline"
              >
                clear all
              </button>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
              {filtered.length} of {rows.length}
            </span>
          </div>

          {/* ── sort control (mobile only — desktop sorts via column headers) ── */}
          <div className="md:hidden">
            <label htmlFor="biblio-sort" className="sr-only">sort by</label>
            <select
              id="biblio-sort"
              value={`${sortKey}:${sortDir}`}
              onChange={(e) => {
                const [k, d] = e.target.value.split(":");
                setSortKey(k as SortKey);
                setSortDir(d as "asc" | "desc");
              }}
              className="h-9 w-full text-sm border border-input rounded-md px-2 bg-background text-muted-foreground"
            >
              <option value="year:desc">newest first</option>
              <option value="year:asc">oldest first</option>
              <option value="author:asc">author A–Z</option>
              <option value="title:asc">title A–Z</option>
              <option value="journal:asc">journal A–Z</option>
              <option value="cites:desc">most cited</option>
              <option value="added:desc">recently added</option>
            </select>
          </div>

          {/* ── sortable table (desktop) ───────────────────────────────── */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table className="min-w-[760px] table-fixed">
              <TableHeader>
                <TableRow className="text-[11px] text-muted-foreground">
                  <TableHead className="w-9">pdf</TableHead>
                  {sortHead("author", "author", "w-32")}
                  {sortHead("title", "title")}
                  {sortHead("journal", "journal", "w-40")}
                  {sortHead("year", "year", "w-14 text-right")}
                  {sortHead("cites", "cites", "w-14 text-right")}
                  <TableHead className="w-24">tags</TableHead>
                  <TableHead className="w-9" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const isOpen = expanded.has(r.id);
                  const busy = pdfBusy.has(r.id);
                  return (
                    <Fragment key={r.id}>
                      <TableRow className="align-top group">
                        {/* PDF */}
                        <TableCell className="py-2">
                          {r.pdfUrl ? (
                            <a
                              href={r.pdfUrl} target="_blank" rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title={`open pdf${r.pdfSource ? ` · via ${PDF_SOURCE_LABEL[r.pdfSource] ?? r.pdfSource}` : ""}`}
                              className="inline-flex items-center text-primary hover:opacity-80"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          ) : busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          ) : (
                            <button
                              type="button" onClick={() => findPdf(r)}
                              title="find open-access pdf"
                              className="text-muted-foreground/40 hover:text-primary text-[10px]"
                            >
                              find
                            </button>
                          )}
                        </TableCell>
                        {/* author */}
                        <TableCell className="py-2 text-xs text-muted-foreground truncate" title={authorDisplay(r)}>{authorDisplay(r)}</TableCell>
                        {/* title / citation */}
                        <TableCell className="py-2">
                          <button
                            type="button"
                            onClick={() => toggleExpand(r.id)}
                            className="text-left text-sm leading-snug hover:underline decoration-dotted underline-offset-2 flex items-start gap-1"
                          >
                            <ChevronRight className={`h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/50 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                            <span className="line-clamp-2">{cleanTitle(r)}</span>
                          </button>
                        </TableCell>
                        {/* journal */}
                        <TableCell className="py-2 text-xs text-muted-foreground italic truncate" title={r.journal ?? undefined}>{r.journal ?? "—"}</TableCell>
                        {/* year */}
                        <TableCell className="py-2 text-xs text-muted-foreground tabular-nums text-right">{r.year ?? "—"}</TableCell>
                        {/* cites */}
                        <TableCell className="py-2 text-xs text-muted-foreground tabular-nums text-right">{r.citationCount ?? "—"}</TableCell>
                        {/* tags */}
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1 flex-wrap max-w-[160px]">
                            {r.topic && <Badge variant="outline" className="text-[10px] py-0">{r.topic}</Badge>}
                            {r.sourceType === "cARL finding" && (
                              <Badge variant="secondary" className="text-[10px] py-0 gap-0.5"><Sparkles className="h-2.5 w-2.5" /> cARL</Badge>
                            )}
                          </div>
                        </TableCell>
                        {/* actions */}
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {r.doi && (
                              <a href={r.doi} target="_blank" rel="noreferrer" className="text-muted-foreground/60 hover:text-foreground" title="open source">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <button onClick={() => { setEditing(r); setEditOpen(true); }} className="text-muted-foreground/60 hover:text-foreground" title="edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => del(r)} className="text-muted-foreground/50 hover:text-destructive" title="delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow className="bg-muted/20">
                          <TableCell />
                          <TableCell colSpan={7} className="py-3 space-y-2">
                            <div>
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">citation</span>
                              <p className="text-xs text-foreground/80 leading-relaxed">{r.fullCitation}</p>
                            </div>
                            {r.abstract && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{r.abstract}</p>}
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                              <span className="text-[10px] text-muted-foreground">used in:</span>
                              <UsedInEditor id={r.id} usedIn={r.usedIn ?? []} allAssets={assets} />
                              <button
                                onClick={() => { setDetailRow(r); setDetailOpen(true); }}
                                className="text-[11px] text-primary hover:underline ml-2"
                              >
                                full details
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">no citations match the current filters.</p>
            )}
          </div>

          {/* ── stacked cards (mobile) ─────────────────────────────────── */}
          <div className="md:hidden space-y-2">
            {filtered.map((r) => {
              const isOpen = expanded.has(r.id);
              const busy = pdfBusy.has(r.id);
              return (
                <div key={r.id} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <button type="button" onClick={() => toggleExpand(r.id)} className="flex-1 text-left">
                      <p className="text-sm font-medium leading-snug line-clamp-3">{cleanTitle(r)}</p>
                    </button>
                    <div className="shrink-0 pt-0.5">
                      {r.pdfUrl ? (
                        <a href={r.pdfUrl} target="_blank" rel="noreferrer" title="open pdf" className="text-primary hover:opacity-80">
                          <Download className="h-4 w-4" />
                        </a>
                      ) : busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <button type="button" onClick={() => findPdf(r)} className="text-[10px] text-muted-foreground/50 hover:text-primary">find pdf</button>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    {authorDisplay(r)}
                    {r.year ? <span className="tabular-nums"> · {r.year}</span> : null}
                    {r.journal ? <span className="italic"> · {r.journal}</span> : null}
                  </p>

                  <div className="flex items-center gap-1 flex-wrap">
                    {r.topic && <Badge variant="outline" className="text-[10px] py-0">{r.topic}</Badge>}
                    {r.sourceType === "cARL finding" && (
                      <Badge variant="secondary" className="text-[10px] py-0 gap-0.5"><Sparkles className="h-2.5 w-2.5" /> cARL</Badge>
                    )}
                    <button
                      type="button" onClick={() => toggleExpand(r.id)}
                      className="ml-auto text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                    >
                      <ChevronRight className={`h-3 w-3 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      {isOpen ? "less" : "details"}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="pt-1.5 space-y-2 border-t border-border/60">
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">citation</span>
                        <p className="text-xs text-foreground/80 leading-relaxed">{r.fullCitation}</p>
                      </div>
                      {r.abstract && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{r.abstract}</p>}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">used in:</span>
                        <UsedInEditor id={r.id} usedIn={r.usedIn ?? []} allAssets={assets} />
                      </div>
                      <div className="flex items-center gap-3 pt-0.5">
                        {r.doi && (
                          <a href={r.doi} target="_blank" rel="noreferrer" className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> source
                          </a>
                        )}
                        <button onClick={() => { setEditing(r); setEditOpen(true); }} className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                          <Pencil className="h-3 w-3" /> edit
                        </button>
                        <button onClick={() => { setDetailRow(r); setDetailOpen(true); }} className="text-[11px] text-primary">full details</button>
                        <button onClick={() => del(r)} className="ml-auto text-muted-foreground hover:text-destructive" title="delete">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">no citations match the current filters.</p>
            )}
          </div>
        </>
      ) : (
        <FindNew search={search} />
      )}

      <CitationDialog existing={editing ?? undefined} open={editOpen} onOpenChange={setEditOpen} allAssets={assets} />
      <CitationDetail
        row={detailRow}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={(r) => { setEditing(r); setEditOpen(true); }}
      />
    </div>
  );
}

// ── unified search input (drives library filter OR find-new search) ───────────

function UnifiedSearch({
  mode, search, setSearch,
}: {
  mode: "library" | "find";
  search: string;
  setSearch: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={mode === "library" ? "filter the library…" : "search Semantic Scholar, PubMed, Crossref…"}
        className="h-8 w-72 text-xs pl-7"
      />
    </div>
  );
}

// ── find-new: federated search rendered inline in the same surface ────────────

function FindNew({ search }: { search: string }) {
  const router = useRouter();
  const [hits, setHits] = useState<ScholarHit[]>([]);
  const [providers, setProviders] = useState<ProviderStat[]>([]);
  const [exact, setExact] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, "added" | "exists">>({});
  const [searching, startSearch] = useTransition();
  const [, startAdd] = useTransition();

  function run() {
    if (!search.trim()) return;
    setError(null);
    startSearch(async () => {
      const res = await searchScholarlyAction(search);
      setSearched(true);
      if (res.error) { setHits([]); setProviders([]); setExact(false); return setError(res.error); }
      setHits(res.hits ?? []);
      setProviders(res.providers ?? []);
      setExact(!!res.exact);
    });
  }

  function add(hit: ScholarHit) {
    startAdd(async () => {
      const res = await addFromSearchAction(hit, []);
      if (res.ok) {
        setStatus((s) => ({ ...s, [hit.id]: "added" }));
        router.refresh();
        if (res.id) void retrievePdfAction(res.id).then(() => router.refresh()).catch(() => {});
      } else if (res.reason === "duplicate") {
        setStatus((s) => ({ ...s, [hit.id]: "exists" }));
      } else setError(res.error ?? "couldn't add");
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex gap-2 items-center">
        <p className="text-xs text-muted-foreground">
          press <kbd className="px-1 py-0.5 rounded border border-border text-[10px]">enter</kbd> to search the wider literature for{" "}
          <span className="font-medium text-foreground">{search.trim() || "…"}</span>
        </p>
        <Button type="submit" size="sm" className="gap-1" disabled={searching || !search.trim()}>
          {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} search
        </Button>
      </form>

      {!exact && providers.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {providers.map((p) => `${p.id} ${p.error === "rate-limited" ? "⚠ limited" : p.error ? "⚠" : p.count}`).join(" · ")}
        </p>
      )}
      {exact && hits.length > 0 && <p className="text-[10px] text-muted-foreground">exact DOI match · crossref</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="space-y-2">
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
                {h.venue ? <span className="italic"> · {h.venue}</span> : ""}
                {h.citationCount != null ? ` · cited by ${h.citationCount}` : ""}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {sources.map((s) => <Badge key={s} variant="outline" className="text-[9px] py-0 px-1.5">{s}</Badge>)}
                {sources.length > 1 && <Badge variant="secondary" className="text-[9px] py-0 px-1.5">confirmed by {sources.length}</Badge>}
              </div>
              <div className="flex items-center gap-3 pt-0.5">
                {st === "added" ? (
                  <span className="inline-flex items-center gap-1 text-green-600"><Check className="h-3 w-3" /> added</span>
                ) : st === "exists" ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground"><Check className="h-3 w-3" /> in library</span>
                ) : (
                  <button type="button" onClick={() => add(h)} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Plus className="h-3 w-3" /> add to library
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
        {!searched && !searching && (
          <p className="text-xs text-muted-foreground text-center py-6">
            search Semantic Scholar, PubMed, Crossref, OpenAlex, arXiv and CORE at once — then add with one click.
          </p>
        )}
      </div>
    </div>
  );
}
