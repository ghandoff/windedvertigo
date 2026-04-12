"use client";

import { useState, useTransition } from "react";

function MarkdownLine({ text }: { text: string }) {
  // simple bold rendering without dangerouslySetInnerHTML
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <span>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="text-foreground">{part}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

export function ResearchAssistant({ personId, personName }: { personId: string; personName: string }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [usage, setUsage] = useState<{ inputTokens: number; outputTokens: number } | null>(null);

  function handleAnalyze() {
    setError(null);
    startLoad(async () => {
      try {
        const res = await fetch("/api/research-assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "failed to analyze");
          return;
        }
        setAnalysis(data.analysis);
        setUsage(data.usage);
      } catch {
        setError("network error");
      }
    });
  }

  return (
    <div className="space-y-3">
      {!analysis && (
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
        >
          {loading ? "analyzing..." : `analyze ${personName}'s research gaps`}
        </button>
      )}

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {analysis && (
        <div className="space-y-2">
          {analysis.split("\n").map((line, i) => {
            if (line.startsWith("**") && line.endsWith("**")) {
              return (
                <h3 key={i} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-3 mb-1">
                  {line.replace(/\*\*/g, "")}
                </h3>
              );
            }
            if (line.startsWith("- ") || line.startsWith("* ")) {
              return (
                <div key={i} className="flex items-start gap-1.5 text-sm">
                  <span className="text-muted-foreground mt-0.5 shrink-0">·</span>
                  <MarkdownLine text={line.slice(2)} />
                </div>
              );
            }
            if (line.match(/^\d+\.\s/)) {
              const num = line.match(/^(\d+)\./)?.[1];
              return (
                <div key={i} className="flex items-start gap-1.5 text-sm">
                  <span className="text-muted-foreground mt-0.5 shrink-0">{num}.</span>
                  <MarkdownLine text={line.replace(/^\d+\.\s/, "")} />
                </div>
              );
            }
            if (!line.trim()) return <div key={i} className="h-1" />;
            return (
              <p key={i} className="text-sm">
                <MarkdownLine text={line} />
              </p>
            );
          })}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {loading ? "analyzing..." : "re-analyze"}
            </button>
            {usage && (
              <span className="text-[10px] text-muted-foreground">
                ~${((usage.inputTokens * 0.001 + usage.outputTokens * 0.005) / 1000).toFixed(4)} cost
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
