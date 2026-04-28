"use client";

import { useState } from "react";
import Link from "next/link";
import type { Person } from "@/lib/types";
import { formatFuzzyDate } from "@/lib/db/utils";

function getDisplayName(p: Person): string {
  const primary = p.names.find((n) => n.is_primary) ?? p.names[0];
  return primary?.display ?? [primary?.given_names, primary?.surname].filter(Boolean).join(" ") ?? "unnamed";
}

export function PersonList({ persons }: { persons: Person[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (persons.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-4">
        no people yet — add someone to get started
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>people ({persons.length})</span>
        <span className="text-[10px]">{isOpen ? "▲" : "▼"}</span>
      </button>
      {isOpen && (
        <ul className="space-y-1 max-h-[40vh] overflow-y-auto">
          {persons.map((p) => {
            const birth = p.events.find((e) => e.event_type === "birth");
            const death = p.events.find((e) => e.event_type === "death");

            return (
              <li key={p.id}>
                <Link
                  href={`/person/${p.id}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {p.sex === "M" ? "♂" : p.sex === "F" ? "♀" : "·"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{getDisplayName(p)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {birth?.date ? formatFuzzyDate(birth.date) : "?"}
                      {" – "}
                      {p.is_living ? "living" : death?.date ? formatFuzzyDate(death.date) : "?"}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
