import { Card, CardContent } from "@/components/ui/card";

// Shared working-memory panel for agent dashboard pages (PaM, cARL).
// PamMemoryEntry and CarlMemoryEntry are structurally identical, so one
// plain prop shape serves both.

export interface AgentMemoryEntry {
  key: string;
  value: string;
  updated_at: string;
  updated_by: string;
}

export function AgentMemoryPanel({ entries }: { entries: AgentMemoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          no working memory yet. the agent populates this as it learns.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((m) => (
        <Card key={m.key} className="border-l-2 border-l-primary/30">
          <CardContent className="py-3 space-y-1">
            <p className="text-xs font-mono text-primary">{m.key}</p>
            <p className="text-sm leading-relaxed">{m.value}</p>
            <p className="text-[10px] text-muted-foreground">
              updated {m.updated_at.slice(0, 10)} by {m.updated_by}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
