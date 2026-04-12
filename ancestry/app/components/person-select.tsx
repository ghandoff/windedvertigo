"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { TreeNode } from "@/lib/types";

export function PersonSelect({
  nodes,
  value,
  onChange,
  placeholder,
}: {
  nodes: TreeNode[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedNode = nodes.find((n) => n.id === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return nodes.slice(0, 50);
    const q = query.toLowerCase();
    return nodes.filter((n) => n.displayName.toLowerCase().includes(q)).slice(0, 50);
  }, [nodes, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder={selectedNode ? selectedNode.displayName : placeholder}
        value={open ? query : selectedNode ? selectedNode.displayName : ""}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              no matches
            </div>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(n.id);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      n.sex === "M"
                        ? "#6B8F9E"
                        : n.sex === "F"
                          ? "#A45A52"
                          : "#C97B3D",
                  }}
                />
                <span className="truncate">{n.displayName}</span>
                {n.birthYear && (
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {n.birthYear}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
