"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Mail, Phone, Globe, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ActionItem {
  action: string;
  reason: string;
  priority: "high" | "medium" | "low";
  channel: string;
  suggestedDate: string;
}

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  call: Phone,
  linkedin: Globe,
};

export function AiOutreachCard({ organizationId }: { organizationId: string }) {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function fetchSuggestions() {
    setLoading(true);
    try {
      const res = await fetch("/crm/api/ai/next-best-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 3 }),
      });
      if (res.ok) {
        const data = await res.json();
        // Filter to actions related to this org
        const orgActions = data.actions?.filter(
          (a: ActionItem & { organizationId?: string }) => a.organizationId === organizationId,
        ) ?? [];
        setActions(orgActions.length > 0 ? orgActions : (data.actions?.slice(0, 2) ?? []));
        setFetched(true);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" />
          AI suggestions
        </CardTitle>
        {!fetched && (
          <Button variant="outline" size="sm" onClick={fetchSuggestions} disabled={loading}>
            {loading ? "thinking..." : "get suggestions"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!fetched && !loading && (
          <p className="text-muted-foreground text-xs">
            AI will analyze activities and recommend outreach actions
          </p>
        )}
        {fetched && actions.length === 0 && (
          <p className="text-muted-foreground text-xs">no specific suggestions right now</p>
        )}
        {actions.map((a, i) => {
          const Icon = CHANNEL_ICONS[a.channel] ?? Mail;
          return (
            <div key={i} className="border rounded-md p-2.5 space-y-1">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium text-xs flex-1">{a.action}</span>
                <Badge
                  variant={a.priority === "high" ? "destructive" : a.priority === "medium" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {a.priority}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{a.reason}</p>
              {a.channel === "email" && (
                <Link
                  href={`/email?org=${organizationId}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  compose email <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
