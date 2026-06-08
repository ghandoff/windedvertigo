"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ChevronRight } from "lucide-react";

interface Insight {
  key: string;
  value: string;
  updated_at?: string | null;
}

// "what cARL prepared for you" — collapsed by default; click the header to reveal.
// Kept deliberately low-key (muted accent) so it sits quietly at the bottom of the page.
export function CarlInsightsCollapsible({ insights, total }: { insights: Insight[]; total: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-l-2 border-l-border/70">
      <CardContent className="py-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 w-full text-left text-muted-foreground hover:text-foreground transition-colors"
          aria-expanded={open}
        >
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <h3 className="text-xs font-medium text-foreground">what cARL prepared for you</h3>
          <span className="text-[10px]">{total} insight{total === 1 ? "" : "s"}</span>
        </button>
        {open && (
          <ul className="space-y-2 mt-2">
            {insights.map((m) => (
              <li key={m.key} className="text-xs leading-relaxed border-l border-border/60 pl-2">
                <p className="text-foreground/90">{m.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{m.updated_at?.slice(0, 10)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
