"use client";

import { useState, type ComponentProps } from "react";
import { AgentMemoryPanel } from "@/app/components/agent-memory-panel";
import { AgentLogTab } from "@/app/components/agent-log-tab";
import { cn } from "@/lib/utils";

type MemoryEntries = ComponentProps<typeof AgentMemoryPanel>["entries"];
type Decisions = ComponentProps<typeof AgentLogTab>["decisions"];

/**
 * PaM's "brain" — its working memory + decision log in one tab. These are the
 * agent's internals (read-only), folded together so they don't take two slots
 * in the primary tab bar.
 */
export function BrainTab({ memory, decisions }: { memory: MemoryEntries; decisions: Decisions }) {
  const [sub, setSub] = useState<"memory" | "log">("memory");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">PaM&apos;s working memory and decision log</p>
        <div className="inline-flex items-center rounded-md border border-border bg-muted/50 p-0.5">
          {(["memory", "log"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSub(k)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-sm transition-colors",
                sub === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {sub === "memory" ? (
        <AgentMemoryPanel entries={memory} />
      ) : (
        <AgentLogTab decisions={decisions} agentName="PaM" />
      )}
    </div>
  );
}
