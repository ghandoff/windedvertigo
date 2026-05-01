"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ExternalLink, Rss, Bell, Database, Search, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { RfpFeedSource, FeedType } from "@/lib/notion/rfp-feeds";

const TYPE_ICONS: Record<FeedType, React.ReactNode> = {
  "RSS Feed": <Rss className="h-3.5 w-3.5" />,
  "Google Alert": <Bell className="h-3.5 w-3.5" />,
  "Procurement DB": <Database className="h-3.5 w-3.5" />,
  "Keyword Search": <Search className="h-3.5 w-3.5" />,
};

const TYPE_COLORS: Record<FeedType, string> = {
  "RSS Feed": "bg-blue-100 text-blue-700 border-blue-200",
  "Google Alert": "bg-red-100 text-red-700 border-red-200",
  "Procurement DB": "bg-purple-100 text-purple-700 border-purple-200",
  "Keyword Search": "bg-orange-100 text-orange-700 border-orange-200",
};

const GOOGLE_ALERTS_URL = "https://www.google.com/alerts";

interface EditState {
  id: string;
  name: string;
  type: FeedType;
  url: string;
  keywords: string;
  notes: string;
}

interface NewFeedState {
  name: string;
  type: FeedType;
  url: string;
  keywords: string;
  notes: string;
}

const BLANK_NEW: NewFeedState = {
  name: "",
  type: "RSS Feed",
  url: "",
  keywords: "",
  notes: "",
};

export function FeedSourcesManager({ initialFeeds }: { initialFeeds: RfpFeedSource[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [feeds, setFeeds] = useState<RfpFeedSource[]>(initialFeeds);
  const [saving, setSaving] = useState<string | null>(null); // feed id or "new"
  const [editState, setEditState] = useState<EditState | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newFeed, setNewFeed] = useState<NewFeedState>(BLANK_NEW);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const enabledCount = feeds.filter((f) => f.enabled && f.url).length;

  async function toggleEnabled(feed: RfpFeedSource) {
    setSaving(feed.id);
    try {
      const res = await fetch(`/api/rfp-radar/feeds/${feed.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !feed.enabled }),
      });
      const updated = await res.json();
      setFeeds((prev) => prev.map((f) => (f.id === feed.id ? updated : f)));
    } finally {
      setSaving(null);
    }
  }

  function startEdit(feed: RfpFeedSource) {
    setEditState({
      id: feed.id,
      name: feed.name,
      type: feed.type,
      url: feed.url ?? "",
      keywords: feed.keywords ?? "",
      notes: feed.notes ?? "",
    });
    setExpandedId(feed.id);
  }

  async function saveEdit() {
    if (!editState) return;
    setSaving(editState.id);
    try {
      const res = await fetch(`/api/rfp-radar/feeds/${editState.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editState.name,
          type: editState.type,
          url: editState.url,
          keywords: editState.keywords,
          notes: editState.notes,
        }),
      });
      const updated = await res.json();
      setFeeds((prev) => prev.map((f) => (f.id === editState.id ? updated : f)));
      setEditState(null);
    } finally {
      setSaving(null);
    }
  }

  async function deleteFeed(id: string) {
    if (!confirm("Delete this feed source?")) return;
    setSaving(id);
    try {
      await fetch(`/api/rfp-radar/feeds/${id}`, { method: "DELETE" });
      setFeeds((prev) => prev.filter((f) => f.id !== id));
      if (editState?.id === id) setEditState(null);
    } finally {
      setSaving(null);
      startTransition(() => router.refresh());
    }
  }

  async function createFeed() {
    if (!newFeed.name.trim()) return;
    setSaving("new");
    try {
      const res = await fetch("/api/rfp-radar/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newFeed,
          sourceLabel: newFeed.type === "Google Alert" ? "Google Alert" : "RSS Feed",
          enabled: !!newFeed.url.trim(),
        }),
      });
      const created = await res.json();
      setFeeds((prev) => [...prev, created]);
      setNewFeed(BLANK_NEW);
      setShowNew(false);
    } finally {
      setSaving(null);
    }
  }

  // Group by type for display
  const byType = feeds.reduce<Record<string, RfpFeedSource[]>>((acc, f) => {
    const t = f.type ?? "RSS Feed";
    (acc[t] ??= []).push(f);
    return acc;
  }, {});

  const typeOrder: FeedType[] = ["RSS Feed", "Google Alert", "Procurement DB", "Keyword Search"];

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{enabledCount}</span> active feeds · {feeds.length} total
        </p>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          add feed
        </button>
      </div>

      {/* New feed form */}
      {showNew && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm">new feed source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">name</label>
                <Input
                  value={newFeed.name}
                  onChange={(e) => setNewFeed((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. World Bank — Education"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">type</label>
                <select
                  value={newFeed.type}
                  onChange={(e) => setNewFeed((p) => ({ ...p, type: e.target.value as FeedType }))}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                >
                  {typeOrder.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {newFeed.type === "Google Alert" ? (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  keywords
                  <a href={GOOGLE_ALERTS_URL} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 hover:underline inline-flex items-center gap-0.5">
                    create alert <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </label>
                <Input
                  value={newFeed.keywords}
                  onChange={(e) => setNewFeed((p) => ({ ...p, keywords: e.target.value }))}
                  placeholder='e.g. "call for proposals" curriculum'
                  className="h-8 text-xs"
                />
                <Input
                  value={newFeed.url}
                  onChange={(e) => setNewFeed((p) => ({ ...p, url: e.target.value }))}
                  placeholder="paste Google Alert feed URL (https://www.google.com/alerts/feeds/...)"
                  className="h-8 text-xs"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">feed URL</label>
                <Input
                  value={newFeed.url}
                  onChange={(e) => setNewFeed((p) => ({ ...p, url: e.target.value }))}
                  placeholder="https://..."
                  className="h-8 text-xs"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">notes (optional)</label>
              <Input
                value={newFeed.notes}
                onChange={(e) => setNewFeed((p) => ({ ...p, notes: e.target.value }))}
                placeholder="what this feed covers"
                className="h-8 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowNew(false); setNewFeed(BLANK_NEW); }}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                cancel
              </button>
              <button
                onClick={createFeed}
                disabled={!newFeed.name.trim() || saving === "new"}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving === "new" ? "saving..." : "add feed"}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feed groups */}
      {typeOrder.filter((t) => byType[t]?.length).map((type) => (
        <div key={type}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[type]}`}>
              {TYPE_ICONS[type]} {type}
            </span>
            <span className="text-xs text-muted-foreground">{byType[type].length} source{byType[type].length !== 1 ? "s" : ""}</span>
          </div>

          <div className="space-y-2">
            {byType[type].map((feed) => {
              const isEditing = editState?.id === feed.id;
              const isExpanded = expandedId === feed.id;
              const isSaving = saving === feed.id;
              const needsUrl = !feed.url && type === "Google Alert";

              return (
                <Card key={feed.id} className={`transition-all ${!feed.enabled ? "opacity-60" : ""}`}>
                  <div className="px-4 py-3">
                    {/* Row header */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Enable toggle */}
                        <button
                          onClick={() => !isSaving && toggleEnabled(feed)}
                          disabled={isSaving || needsUrl}
                          title={needsUrl ? "Add a feed URL to enable" : feed.enabled ? "Disable feed" : "Enable feed"}
                          className={`shrink-0 w-8 h-4 rounded-full transition-colors ${
                            feed.enabled ? "bg-green-500" : "bg-muted-foreground/30"
                          } ${(isSaving || needsUrl) ? "cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${feed.enabled ? "translate-x-4" : "translate-x-0"}`} />
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{feed.name}</p>
                          {feed.keywords && (
                            <p className="text-[10px] text-muted-foreground truncate font-mono">{feed.keywords}</p>
                          )}
                          {feed.url && !feed.keywords && (
                            <p className="text-[10px] text-muted-foreground truncate font-mono">{feed.url}</p>
                          )}
                          {needsUrl && (
                            <p className="text-[10px] text-amber-600">⚠ no feed URL — disabled until added</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {feed.lastPolled && (
                          <span className="text-[10px] text-muted-foreground hidden sm:block">
                            polled {feed.lastPolled}
                            {feed.itemsLastRun != null && ` · ${feed.itemsLastRun} items`}
                          </span>
                        )}
                        {feed.url && (
                          <a href={feed.url} target="_blank" rel="noreferrer" title="Open feed URL">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </a>
                        )}
                        {type === "Google Alert" && !feed.url && (
                          <a href={`${GOOGLE_ALERTS_URL}#create`} target="_blank" rel="noreferrer" title="Create this alert on Google">
                            <ExternalLink className="h-3.5 w-3.5 text-amber-500 hover:text-amber-700" />
                          </a>
                        )}
                        <button
                          onClick={() => {
                            if (isEditing) { setEditState(null); setExpandedId(null); }
                            else { startEdit(feed); }
                          }}
                          title="Edit"
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          {isEditing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => setExpandedId(isExpanded && !isEditing ? null : (isExpanded ? null : feed.id))}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded / edit panel */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        {isEditing ? (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">name</label>
                                <Input
                                  value={editState.name}
                                  onChange={(e) => setEditState((p) => p ? { ...p, name: e.target.value } : p)}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">type</label>
                                <select
                                  value={editState.type}
                                  onChange={(e) => setEditState((p) => p ? { ...p, type: e.target.value as FeedType } : p)}
                                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                                >
                                  {typeOrder.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                            </div>

                            {editState.type === "Google Alert" && (
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">
                                  keywords
                                  <a href={GOOGLE_ALERTS_URL} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 hover:underline inline-flex items-center gap-0.5 text-[10px]">
                                    open google alerts <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                </label>
                                <Input
                                  value={editState.keywords}
                                  onChange={(e) => setEditState((p) => p ? { ...p, keywords: e.target.value } : p)}
                                  className="h-8 text-xs font-mono"
                                  placeholder='e.g. "call for proposals" curriculum'
                                />
                              </div>
                            )}

                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">
                                {editState.type === "Google Alert" ? "alert feed URL" : "feed URL"}
                              </label>
                              <Input
                                value={editState.url}
                                onChange={(e) => setEditState((p) => p ? { ...p, url: e.target.value } : p)}
                                className="h-8 text-xs font-mono"
                                placeholder="https://..."
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">notes</label>
                              <Input
                                value={editState.notes}
                                onChange={(e) => setEditState((p) => p ? { ...p, notes: e.target.value } : p)}
                                className="h-8 text-xs"
                              />
                            </div>

                            <div className="flex justify-between items-center pt-1">
                              <button
                                onClick={() => deleteFeed(feed.id)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> delete
                              </button>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setEditState(null); setExpandedId(null); }}
                                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  cancel
                                </button>
                                <button
                                  onClick={saveEdit}
                                  disabled={isSaving}
                                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                >
                                  <Check className="h-3 w-3" />
                                  {isSaving ? "saving..." : "save"}
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-2 text-xs text-muted-foreground">
                            {feed.url && (
                              <div>
                                <span className="font-medium text-foreground">url </span>
                                <a href={feed.url} target="_blank" rel="noreferrer" className="font-mono break-all text-blue-600 hover:underline">
                                  {feed.url}
                                </a>
                              </div>
                            )}
                            {feed.keywords && (
                              <div>
                                <span className="font-medium text-foreground">keywords </span>
                                <span className="font-mono">{feed.keywords}</span>
                              </div>
                            )}
                            {feed.notes && (
                              <div>
                                <span className="font-medium text-foreground">notes </span>
                                {feed.notes}
                              </div>
                            )}
                            {feed.lastPolled && (
                              <div>
                                <span className="font-medium text-foreground">last polled </span>
                                {feed.lastPolled}
                                {feed.itemsLastRun != null && ` · ${feed.itemsLastRun} items fetched`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Empty state */}
      {feeds.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Rss className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">no feed sources yet</p>
          <p className="text-xs mt-1">click "add feed" to get started</p>
        </div>
      )}

      {/* Google Alerts help box */}
      {byType["Google Alert"]?.some((f) => !f.url) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium text-amber-800 mb-1">setting up google alerts</p>
            <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
              <li>Go to <a href={GOOGLE_ALERTS_URL} target="_blank" rel="noreferrer" className="underline">google.com/alerts</a></li>
              <li>Enter the keyword phrase shown above and create the alert</li>
              <li>Click the <strong>RSS icon (⊡)</strong> next to the alert to get a feed URL</li>
              <li>Edit the row above and paste the feed URL — it will auto-enable</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
