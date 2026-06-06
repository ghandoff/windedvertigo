"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, ExternalLink, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { BibliographyRow } from "@/lib/supabase/bibliography";
import { UsedInEditor } from "./used-in-editor";
import { CitationDialog } from "./citation-dialog";
import { AddCitationsDialog } from "./add-citations-dialog";
import { CitationDetail } from "./citation-detail";
import { deleteCitationAction } from "../actions";

export function BibliographyTable({
  rows,
  assets,
  topics,
}: {
  rows: BibliographyRow[];
  assets: string[];
  topics: string[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [asset, setAsset] = useState<string>("all");
  const [topic, setTopic] = useState<string>("all");
  const [editing, setEditing] = useState<BibliographyRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<BibliographyRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [, startTransition] = useTransition();

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (asset !== "all" && !(r.usedIn ?? []).includes(asset)) return false;
        if (topic !== "all" && r.topic !== topic) return false;
        if (q && !`${r.fullCitation} ${r.keywords ?? ""} ${r.abstract ?? ""}`.toLowerCase().includes(q)) return false;
        return true;
      }),
    [rows, asset, topic, q],
  );

  function del(r: BibliographyRow) {
    if (!window.confirm(`delete this citation?\n\n${r.fullCitation.slice(0, 120)}`)) return;
    startTransition(async () => {
      await deleteCitationAction(r.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* toolbar — left: browse the library · right: add to the library */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="filter the library…"
              className="h-8 w-60 text-xs pl-7"
            />
          </div>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-8 text-xs border border-border rounded px-2 bg-background text-muted-foreground"
          >
            <option value="all">all topics</option>
            {topics.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <AddCitationsDialog allAssets={assets} />
      </div>

      {/* asset (used-in) filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {["all", ...assets].map((a) => (
          <button
            key={a}
            onClick={() => setAsset(a)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
              asset === a
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {a === "all" ? "all assets" : a}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">{filtered.length} of {rows.length} citations</p>

      <div className="space-y-2">
        {filtered.map((r) => (
          <Card key={r.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="py-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => { setDetailRow(r); setDetailOpen(true); }}
                  className="text-sm leading-snug text-left hover:underline decoration-dotted underline-offset-2"
                  title="view details"
                >
                  {r.fullCitation}
                </button>
                <div className="flex items-center gap-1 shrink-0">
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
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {r.topic && <Badge variant="outline" className="text-[10px] py-0">{r.topic}</Badge>}
                {r.sourceType && <Badge variant="secondary" className="text-[10px] py-0">{r.sourceType}</Badge>}
                {r.year && <span className="text-[10px] text-muted-foreground tabular-nums">{r.year}</span>}
                <span className="text-[10px] text-muted-foreground mx-1">·</span>
                <span className="text-[10px] text-muted-foreground">used in:</span>
                <UsedInEditor id={r.id} usedIn={r.usedIn ?? []} allAssets={assets} />
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">no citations match the current filters.</p>
        )}
      </div>

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
