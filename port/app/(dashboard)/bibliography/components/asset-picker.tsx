"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Multi-select of existing asset tags + a text field to create a new one.
// Controlled: parent holds `value` and persists via `onChange`.
export function AssetPicker({
  value,
  allAssets,
  onChange,
}: {
  value: string[];
  allAssets: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function add(a: string) {
    const v = a.trim();
    if (v && !value.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
    setQuery("");
  }
  function remove(a: string) {
    onChange(value.filter((x) => x !== a));
  }

  const q = query.trim().toLowerCase();
  const options = allAssets.filter((a) => !value.includes(a) && (!q || a.toLowerCase().includes(q)));
  const canCreate =
    !!q &&
    !allAssets.some((a) => a.toLowerCase() === q) &&
    !value.some((v) => v.toLowerCase() === q);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {value.map((a) => (
        <Badge key={a} variant="secondary" className="text-[10px] py-0 gap-1">
          {a}
          <button type="button" onClick={() => remove(a)} className="hover:text-destructive" aria-label={`remove ${a}`}>
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="text-muted-foreground/60 hover:text-foreground transition-colors inline-flex items-center gap-0.5 text-[11px]">
          <Plus className="h-3 w-3" /> tag
        </PopoverTrigger>
        <PopoverContent className="w-60 p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (canCreate) add(query);
                else if (options.length === 1) add(options[0]);
              }
            }}
            placeholder="type to add or create an asset…"
            className="w-full text-xs border border-border rounded px-2 py-1 bg-background mb-1.5"
          />
          <div className="max-h-52 overflow-y-auto space-y-0.5">
            {canCreate && (
              <button
                type="button"
                onClick={() => add(query)}
                className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted flex items-center gap-1.5"
              >
                <Plus className="h-3 w-3" /> create &ldquo;{query.trim()}&rdquo;
              </button>
            )}
            {options.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => add(a)}
                className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted"
              >
                {a}
              </button>
            ))}
            {options.length === 0 && !canCreate && (
              <p className="text-[11px] text-muted-foreground px-2 py-1">
                {allAssets.length === 0 ? "no assets yet — type to create one" : "all assets added"}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
