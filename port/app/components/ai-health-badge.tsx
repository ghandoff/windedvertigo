"use client";

import { useState } from "react";
import { HeartPulse, TrendingUp, TrendingDown, Minus, AlertTriangle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HealthData {
  score: number;
  trend: "improving" | "stable" | "declining" | "at-risk";
  factors: string[];
  daysSinceContact: number;
}

export function AiHealthBadge({ contactId }: { contactId: string }) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function fetchHealth() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/relationship-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: [contactId] }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.scores?.[0]) {
          setHealth(data.scores[0]);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  if (!health) {
    return (
      <button
        onClick={fetchHealth}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {loading ? "analyzing..." : "check health"}
      </button>
    );
  }

  const scoreColor =
    health.score >= 70 ? "text-green-600" :
    health.score >= 50 ? "text-yellow-600" :
    health.score >= 30 ? "text-orange-500" : "text-red-500";

  const TrendIcon =
    health.trend === "improving" ? TrendingUp :
    health.trend === "declining" ? TrendingDown :
    health.trend === "at-risk" ? AlertTriangle : Minus;

  const trendColor =
    health.trend === "improving" ? "text-green-500" :
    health.trend === "declining" ? "text-yellow-500" :
    health.trend === "at-risk" ? "text-red-500" : "text-muted-foreground";

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full"
      >
        <HeartPulse className="h-4 w-4 text-muted-foreground" />
        <span className={`text-lg font-bold ${scoreColor}`}>{health.score}</span>
        <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
        <span className="text-xs text-muted-foreground">{health.trend}</span>
      </button>

      {expanded && (
        <div className="pl-6 space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {health.daysSinceContact < 999
              ? `last contact: ${health.daysSinceContact}d ago`
              : "never contacted"}
          </p>
          <div className="flex flex-wrap gap-1">
            {health.factors.map((f, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">{f}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
