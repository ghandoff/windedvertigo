"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { updateUsedInAction } from "../actions";

// Inline multi-select: the artifacts (products/reports) a citation is used in.
// Chips with remove; an add field backed by a shared <datalist id="bib-assets">
// of existing values (rendered once by the parent table).
export function UsedInEditor({ id, usedIn }: { id: string; usedIn: string[] }) {
  const router = useRouter();
  const [tags, setTags] = useState(usedIn);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function commit(next: string[]) {
    const prev = tags;
    setTags(next);
    setSaving(true);
    const res = await updateUsedInAction(id, next);
    setSaving(false);
    if (res.error) setTags(prev);
    else router.refresh();
  }

  function add() {
    const v = draft.trim();
    setDraft("");
    setAdding(false);
    if (v && !tags.includes(v)) commit([...tags, v]);
  }

  return (
    <div className={`flex items-center gap-1 flex-wrap ${saving ? "opacity-60" : ""}`}>
      {tags.map((t) => (
        <Badge key={t} variant="secondary" className="text-[10px] py-0 gap-1">
          {t}
          <button
            type="button"
            onClick={() => commit(tags.filter((x) => x !== t))}
            className="hover:text-destructive"
            aria-label={`remove ${t}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}
      {adding ? (
        <input
          list="bib-assets"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            } else if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder="asset…"
          className="text-[11px] border border-border rounded px-1 py-0.5 w-32 bg-background"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-muted-foreground/50 hover:text-foreground transition-colors"
          aria-label="add asset"
          title="tag a product / report this is used in"
        >
          <Plus className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
