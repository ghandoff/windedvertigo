"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type {
  StrategyBrief,
  StrategyBriefContent,
  StrategyBriefSection,
  StrategyBriefVersionSummary,
} from "@/lib/supabase/cmo-strategy-brief";

const EMPTY_CONTENT: StrategyBriefContent = { sections: [], decisions: [], actions: [] };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function emptySection(): StrategyBriefSection {
  return { id: crypto.randomUUID(), heading: "new section", owner: "all", body: "", covered: false };
}

export function StrategyBriefTab({
  brief,
  isSignedIn,
}: {
  brief: StrategyBrief | null;
  isSignedIn: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState<StrategyBriefContent>(brief?.content ?? EMPTY_CONTENT);
  const [changeNote, setChangeNote] = useState("");
  const [history, setHistory] = useState<StrategyBriefVersionSummary[] | null>(null);
  const [viewingVersion, setViewingVersion] = useState<{ version: number; content: StrategyBriefContent } | null>(null);
  const [error, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEditing() {
    setContent(brief?.content ?? EMPTY_CONTENT);
    setChangeNote("");
    setErrorMsg(null);
    setEditing(true);
  }

  function save() {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await fetch("/api/cmo/strategy-brief", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, change_note: changeNote || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErrorMsg(body?.error ?? "save failed");
        return;
      }
      setEditing(false);
      window.location.reload();
    });
  }

  function loadHistory() {
    startTransition(async () => {
      const res = await fetch("/api/cmo/strategy-brief?history=1");
      if (res.ok) setHistory(await res.json());
    });
  }

  function viewVersion(version: number) {
    startTransition(async () => {
      const res = await fetch(`/api/cmo/strategy-brief?version=${version}`);
      if (res.ok) {
        const snapshot = await res.json();
        setViewingVersion({ version, content: snapshot.content });
      }
    });
  }

  function restore(version: number) {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await fetch(`/api/cmo/strategy-brief?restore=${version}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErrorMsg(body?.error ?? "restore failed");
        return;
      }
      window.location.reload();
    });
  }

  function updateSection(id: string, patch: Partial<StrategyBriefSection>) {
    setContent((c) => ({ ...c, sections: c.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  }
  function addSection() {
    setContent((c) => ({ ...c, sections: [...c.sections, emptySection()] }));
  }
  function removeSection(id: string) {
    setContent((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== id) }));
  }
  function updateListItem(field: "decisions" | "actions", i: number, value: string) {
    setContent((c) => ({ ...c, [field]: c[field].map((v, idx) => (idx === i ? value : v)) }));
  }
  function addListItem(field: "decisions" | "actions") {
    setContent((c) => ({ ...c, [field]: [...c[field], ""] }));
  }
  function removeListItem(field: "decisions" | "actions", i: number) {
    setContent((c) => ({ ...c, [field]: c[field].filter((_, idx) => idx !== i) }));
  }

  const displayed = viewingVersion?.content ?? content;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-muted-foreground">
          {brief ? (
            <>
              v{brief.version} · last edited by <span className="font-medium">{brief.updated_by}</span> ·{" "}
              {formatDate(brief.updated_at)}
            </>
          ) : (
            "no brief saved yet"
          )}
        </div>
        <div className="flex gap-2">
          {!editing && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => (history ? setHistory(null) : loadHistory())}
              disabled={isPending}
            >
              {history ? "hide history" : "history"}
            </Button>
          )}
          {!editing && isSignedIn && (
            <Button size="sm" onClick={startEditing}>
              edit
            </Button>
          )}
          {!isSignedIn && (
            <Badge variant="outline" className="text-xs">
              sign in to edit
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive border border-destructive/30 rounded-md p-2">{error}</div>
      )}

      {viewingVersion && (
        <div className="flex items-center justify-between text-xs bg-muted/50 rounded-md p-2">
          <span>
            viewing version {viewingVersion.version} (read-only) — current is v{brief?.version}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setViewingVersion(null)}>
              back to current
            </Button>
            {isSignedIn && (
              <Button size="sm" variant="outline" onClick={() => restore(viewingVersion.version)} disabled={isPending}>
                restore this version
              </Button>
            )}
          </div>
        </div>
      )}

      {history && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#273248]">history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">no versions yet</p>
            ) : (
              history.map((v) => (
                <div key={v.version} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">v{v.version}</span>{" "}
                    <span className="text-muted-foreground">
                      {v.created_by} · {formatDate(v.created_at)}
                    </span>
                    {v.change_note && <p className="text-xs mt-0.5">{v.change_note}</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => viewVersion(v.version)}>
                    view
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {editing ? (
        <div className="space-y-4">
          {content.sections.map((s) => (
            <Card key={s.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex gap-2 items-center flex-wrap">
                  <Input
                    value={s.heading}
                    onChange={(e) => updateSection(s.id, { heading: e.target.value })}
                    className="text-sm font-medium flex-1 min-w-[200px]"
                    placeholder="section heading"
                  />
                  <Input
                    value={s.owner}
                    onChange={(e) => updateSection(s.id, { owner: e.target.value })}
                    className="text-sm w-28"
                    placeholder="owner"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={s.covered}
                      onChange={(e) => updateSection(s.id, { covered: e.target.checked })}
                    />
                    covered
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => removeSection(s.id)}>
                    remove
                  </Button>
                </div>
                <Textarea
                  value={s.body}
                  onChange={(e) => updateSection(s.id, { body: e.target.value })}
                  rows={4}
                  placeholder="markdown body…"
                  className="text-sm"
                />
              </CardContent>
            </Card>
          ))}
          <Button size="sm" variant="outline" onClick={addSection}>
            + add section
          </Button>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#273248]">decisions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {content.decisions.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={d} onChange={(e) => updateListItem("decisions", i, e.target.value)} className="text-sm" />
                  <Button size="sm" variant="ghost" onClick={() => removeListItem("decisions", i)}>
                    remove
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => addListItem("decisions")}>
                + add decision
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#273248]">actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {content.actions.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={a} onChange={(e) => updateListItem("actions", i, e.target.value)} className="text-sm" />
                  <Button size="sm" variant="ghost" onClick={() => removeListItem("actions", i)}>
                    remove
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => addListItem("actions")}>
                + add action
              </Button>
            </CardContent>
          </Card>

          <div className="flex gap-2 items-center flex-wrap pt-2">
            <Input
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="change note (optional)"
              className="text-sm flex-1 min-w-[200px]"
            />
            <Button onClick={save} disabled={isPending}>
              {isPending ? "saving…" : "save"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={isPending}>
              cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.sections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              no brief saved yet.{" "}
              {isSignedIn ? "click edit to start one." : "sign in to start one."}
            </div>
          ) : (
            displayed.sections.map((s) => (
              <Card key={s.id}>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base text-[#273248]">{s.heading}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">{s.owner}</Badge>
                    {s.covered && (
                      <Badge variant="secondary" className="text-xs">covered ✓</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{s.body}</p>
                </CardContent>
              </Card>
            ))
          )}

          {displayed.decisions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-[#273248]">decisions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {displayed.decisions.map((d, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary shrink-0">→</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {displayed.actions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-[#273248]">actions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {displayed.actions.map((a, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-[#b15043] shrink-0">□</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
