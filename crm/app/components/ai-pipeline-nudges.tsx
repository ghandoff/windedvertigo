"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Nudge {
  contactName?: string;
  contactId?: string;
  organizationName?: string;
  organizationId?: string;
  action: string;
  reason: string;
  priority: "high" | "medium" | "low";
  channel: string;
}

export function AiPipelineNudges() {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [fetched, setFetched] = useState(false);

  async function fetchNudges() {
    setLoading(true);
    try {
      const res = await fetch("/crm/api/ai/next-best-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      });
      if (res.ok) {
        const data = await res.json();
        setNudges(data.actions ?? []);
        setFetched(true);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  if (!fetched) {
    return (
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={fetchNudges} disabled={loading}>
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          {loading ? "analyzing pipeline..." : "AI pipeline insights"}
        </Button>
      </div>
    );
  }

  if (nudges.length === 0) return null;

  return (
    <div className="mb-4 border rounded-lg bg-muted/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI suggests {nudges.length} actions
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {nudges.map((n, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 text-sm">
              <Badge
                variant={n.priority === "high" ? "destructive" : n.priority === "medium" ? "default" : "secondary"}
                className="text-[10px] shrink-0"
              >
                {n.priority}
              </Badge>
              <span className="flex-1 text-xs">{n.action}</span>
              {n.organizationId && (
                <Link
                  href={`/organizations/${n.organizationId}`}
                  className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
                >
                  {n.organizationName ?? "view"} <ArrowRight className="h-3 w-3" />
                </Link>
              )}
              {!n.organizationId && n.contactId && (
                <Link
                  href={`/contacts/${n.contactId}`}
                  className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
                >
                  {n.contactName ?? "view"} <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
