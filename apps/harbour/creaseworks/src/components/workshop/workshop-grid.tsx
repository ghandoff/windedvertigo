"use client";

/**
 * WorkshopGrid — interactive material inventory grid.
 *
 * displays all available materials grouped by form. users tap to
 * add/remove materials from their personal workshop inventory.
 * owned materials get a warm highlight ring.
 */

import { useState, useCallback } from "react";
import Image from "next/image";
import { haptic } from "@/lib/haptics";

interface Material {
  id: string;
  title: string;
  emoji: string | null;
  icon: string | null;
  form_primary: string | null;
  functions: string[] | null;
  context_tags: string[] | null;
}

interface WorkshopGridProps {
  allMaterials: Material[];
  ownedIds: string[];
}

export default function WorkshopGrid({ allMaterials, ownedIds }: WorkshopGridProps) {
  const [owned, setOwned] = useState<Set<string>>(new Set(ownedIds));
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const toggle = useCallback(async (materialId: string) => {
    if (toggling.has(materialId)) return;

    // optimistic update
    setOwned((prev) => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });

    haptic("light");
    setToggling((prev) => new Set(prev).add(materialId));

    try {
      await fetch("/harbour/creaseworks/api/workshop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId }),
      });
    } catch {
      // rollback on error
      setOwned((prev) => {
        const next = new Set(prev);
        if (next.has(materialId)) {
          next.delete(materialId);
        } else {
          next.add(materialId);
        }
        return next;
      });
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(materialId);
        return next;
      });
    }
  }, [toggling]);

  // group materials by form
  const grouped = new Map<string, Material[]>();
  for (const mat of allMaterials) {
    const form = mat.form_primary ?? "other";
    if (!grouped.has(form)) grouped.set(form, []);
    grouped.get(form)!.push(mat);
  }

  const ownedCount = owned.size;

  return (
    <div>
      {/* inventory summary */}
      <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-cream/30">
        <span className="text-2xl font-bold text-sienna">{ownedCount}</span>
        <span className="text-sm text-cadet/60">
          material{ownedCount !== 1 ? "s" : ""} in your workshop
        </span>
      </div>

      {/* form groups */}
      {Array.from(grouped.entries()).map(([form, materials]) => (
        <div key={form} className="mb-8">
          <h2 className="text-sm font-semibold text-cadet/50 uppercase tracking-wider mb-3">
            {form}
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {materials.map((mat) => {
              const isOwned = owned.has(mat.id);
              const iconPath = mat.icon
                ? `/harbour/creaseworks/icons/materials/${mat.icon}.png`
                : null;

              return (
                <button
                  key={mat.id}
                  onClick={() => toggle(mat.id)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-150"
                  style={{
                    backgroundColor: isOwned
                      ? "rgba(203, 120, 88, 0.12)"
                      : "rgba(39, 50, 72, 0.03)",
                    border: isOwned
                      ? "2px solid var(--wv-sienna)"
                      : "2px solid transparent",
                  }}
                  aria-pressed={isOwned}
                  aria-label={`${isOwned ? "remove" : "add"} ${mat.title}`}
                >
                  {iconPath ? (
                    <Image
                      src={iconPath}
                      alt=""
                      width={48}
                      height={48}
                      className="object-contain"
                    />
                  ) : (
                    <span className="text-3xl leading-none">
                      {mat.emoji ?? "✨"}
                    </span>
                  )}
                  <span className="text-xs text-cadet/70 text-center leading-tight">
                    {mat.title}
                  </span>
                  {isOwned && mat.functions && mat.functions.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 justify-center">
                      {mat.functions.slice(0, 2).map((fn: string) => (
                        <span
                          key={fn}
                          className="text-2xs text-teal/80 bg-teal/10 rounded-full px-1.5 py-0.5"
                        >
                          {fn}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
