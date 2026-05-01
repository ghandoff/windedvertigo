"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CompetitorFormModal, AiSuggestionsModal, type CompetitorFormData } from "./competitor-form-modal";
import { Sparkles, Plus } from "lucide-react";
import type { Competitor } from "@/lib/notion/types";
import type { CompetitorSuggestion } from "@/app/api/competitors/generate/route";

interface Props {
  competitors: Competitor[];
}

export function CompetitorActions({ competitors }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<CompetitorSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const handleAdd = useCallback(async (data: CompetitorFormData) => {
    await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setAddOpen(false);
    router.refresh();
  }, [router]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/competitors/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ existingNames: competitors.map((c) => c.organisation) }),
      });
      if (res.ok) {
        const { suggestions: s } = await res.json();
        setSuggestions(s);
        setSuggestOpen(true);
      }
    } finally {
      setGenerating(false);
    }
  }, [competitors]);

  const handleAddSuggestion = useCallback(async (s: CompetitorSuggestion) => {
    await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    router.refresh();
  }, [router]);

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          add competitor
        </Button>
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          {generating ? "generating…" : "ai suggest"}
        </Button>
      </div>

      <CompetitorFormModal
        open={addOpen}
        onSave={handleAdd}
        onClose={() => setAddOpen(false)}
      />
      <AiSuggestionsModal
        open={suggestOpen}
        suggestions={suggestions}
        onAdd={handleAddSuggestion}
        onClose={() => setSuggestOpen(false)}
      />
    </>
  );
}
