"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/app/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContentForm } from "./content-form";
import type { ContentDraft } from "@/lib/notion/content";

const CHANNEL_COLOUR: Record<string, string> = {
  linkedin: "bg-blue-500/10 text-blue-600 border-blue-200/40",
  bluesky: "bg-sky-500/10 text-sky-600 border-sky-200/40",
  twitter: "bg-slate-500/10 text-slate-600 border-slate-200/40",
  newsletter: "bg-violet-500/10 text-violet-600 border-violet-200/40",
  blog: "bg-emerald-500/10 text-emerald-600 border-emerald-200/40",
  website: "bg-teal-500/10 text-teal-600 border-teal-200/40",
};

const STATUS_COLOUR: Record<string, string> = {
  idea: "bg-muted text-muted-foreground",
  draft: "bg-muted text-foreground/70",
  review: "bg-amber-50 text-amber-700 border-amber-200/50",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200/50",
};

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function ContentPage() {
  const [items, setItems] = useState<ContentDraft[]>([]);
  const [dbMissing, setDbMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/content");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setDbMissing(!!data.dbMissing);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="content"
        description="draft posts, schedule content, track the pipeline"
      />

      {/* draft form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">new draft</CardTitle>
        </CardHeader>
        <CardContent>
          <ContentForm onSaved={load} dbMissing={dbMissing} />
        </CardContent>
      </Card>

      {/* content queue */}
      {!dbMissing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              queue
              {!loading && items.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">{items.length} items</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground py-4">loading…</div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                nothing in the queue — add your first draft above.
              </p>
            ) : (
              <div className="divide-y">
                {items.map(item => (
                  <div key={item.id} className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      {item.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${CHANNEL_COLOUR[item.channel] ?? ""}`}>
                          {item.channel}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${STATUS_COLOUR[item.status] ?? ""}`}>
                          {item.status}
                        </span>
                        {item.scheduledDate && (
                          <span className="text-[10px] text-muted-foreground">{formatDate(item.scheduledDate)}</span>
                        )}
                        {item.author && (
                          <span className="text-[10px] text-muted-foreground">{item.author}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
