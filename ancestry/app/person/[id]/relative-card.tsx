"use client";

import { useTransition } from "react";
import Link from "next/link";
import { formatFuzzyDate } from "@/lib/db/utils";
import type { FuzzyDate } from "@/lib/db/utils";
import { deleteRelationshipAction } from "./actions";

const SEX_ICONS: Record<string, string> = {
  M: "♂",
  F: "♀",
  X: "⚧",
  U: "·",
};

type RelativeInfo = {
  id: string;
  displayName: string;
  sex: string | null;
  isLiving: boolean;
  thumbnailUrl: string | null;
  birthDate: unknown;
  deathDate: unknown;
  relationshipId?: string;
  relationshipType?: string;
  marriageDate?: unknown;
};

export function RelativeCard({ relative, personId }: { relative: RelativeInfo; personId: string }) {
  const [isPending, startTransition] = useTransition();
  const icon = SEX_ICONS[relative.sex ?? "U"] ?? "·";
  const birthStr = relative.birthDate ? formatFuzzyDate(relative.birthDate as FuzzyDate) : null;
  const deathStr = relative.deathDate ? formatFuzzyDate(relative.deathDate as FuzzyDate) : null;

  const lifespan = [
    birthStr ?? "?",
    relative.isLiving ? "living" : (deathStr ?? "?"),
  ].join(" – ");

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5 hover:bg-muted/50 transition-colors group">
      <Link href={`/person/${relative.id}`} className="flex items-center gap-2.5 flex-1 min-w-0">
        {relative.thumbnailUrl ? (
          <img
            src={relative.thumbnailUrl}
            alt={relative.displayName}
            className="h-9 w-9 rounded-full object-cover shrink-0"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{relative.displayName}</div>
          <div className="truncate text-xs text-muted-foreground">{lifespan}</div>
          {relative.relationshipType && (
            <div className="text-xs text-muted-foreground/70">{relative.relationshipType.replace("_", " ")}</div>
          )}
        </div>
      </Link>
      {relative.relationshipId && (
        <button
          onClick={() => {
            if (!confirm(`unlink ${relative.displayName}? this removes the relationship, not the person.`)) return;
            startTransition(async () => {
              await deleteRelationshipAction(relative.relationshipId!, personId);
            });
          }}
          disabled={isPending}
          className="shrink-0 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 min-w-[28px] min-h-[28px] flex items-center justify-center text-xs text-destructive hover:bg-destructive/10 rounded disabled:opacity-50 transition-all"
          title="remove relationship"
          aria-label={`unlink ${relative.displayName}`}
        >
          ×
        </button>
      )}
    </div>
  );
}
