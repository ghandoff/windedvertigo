"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Handle, Position, useStore, type NodeProps } from "@xyflow/react";
import type { TreeNode, ColorMode } from "@/lib/types";
import { QuickAddPopover, type QuickAddType } from "./quick-add-popover";

export type PersonNodeData = TreeNode & {
  generation: number;
  colorMode: ColorMode;
  surnameIndex: number;
  completenessScore: number;
  isFocused?: boolean;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: (nodeId: string) => void;
  onContextMenu?: (personId: string, x: number, y: number) => void;
  onOpenDetail?: (personId: string) => void;
};

const SEX_COLORS: Record<string, string> = {
  M: "border-blue-400 bg-blue-50",
  F: "border-rose-400 bg-rose-50",
  X: "border-purple-400 bg-purple-50",
  U: "border-gray-300 bg-gray-50",
};

const SEX_ICONS: Record<string, string> = {
  M: "♂",
  F: "♀",
  X: "⚧",
  U: "·",
};

function surnameColor(index: number): string {
  if (index < 0) return "hsl(0, 0%, 88%)";
  const hue = (index * 30) % 360;
  return `hsl(${hue}, 55%, 75%)`;
}

function getNodeStyle(d: PersonNodeData): { className?: string; style?: React.CSSProperties } {
  const mode = d.colorMode ?? "sex";

  switch (mode) {
    case "sex":
      return { className: SEX_COLORS[d.sex ?? "U"] ?? SEX_COLORS.U };

    case "generation":
      return {
        style: {
          backgroundColor: `hsl(${d.generation * 40}, 55%, 75%)`,
          borderColor: `hsl(${d.generation * 40}, 55%, 60%)`,
        },
      };

    case "surname":
      return {
        style: {
          backgroundColor: surnameColor(d.surnameIndex),
          borderColor: d.surnameIndex < 0
            ? "hsl(0, 0%, 78%)"
            : `hsl(${(d.surnameIndex * 30) % 360}, 55%, 60%)`,
        },
      };

    case "living":
      return {
        style: {
          backgroundColor: d.isLiving ? "hsl(142, 40%, 85%)" : "hsl(0, 0%, 88%)",
          borderColor: d.isLiving ? "hsl(142, 40%, 65%)" : "hsl(0, 0%, 72%)",
        },
      };

    case "completeness": {
      const score = d.completenessScore;
      if (score >= 3) {
        return { style: { backgroundColor: "hsl(142, 50%, 85%)", borderColor: "hsl(142, 50%, 65%)" } };
      } else if (score >= 2) {
        return { style: { backgroundColor: "hsl(45, 70%, 85%)", borderColor: "hsl(45, 70%, 65%)" } };
      } else {
        return { style: { backgroundColor: "hsl(0, 60%, 85%)", borderColor: "hsl(0, 60%, 65%)" } };
      }
    }

    default: {
      // handle custom:fieldName decoration modes
      if (mode.startsWith("custom:")) {
        const fieldName = mode.slice(7);
        const value = (d as PersonNodeData & { customFields?: Record<string, string> }).customFields?.[fieldName];
        if (!value) {
          return { style: { backgroundColor: "hsl(0, 0%, 92%)", borderColor: "hsl(0, 0%, 78%)" } };
        }
        // deterministic hue from value string
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
          hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
        }
        const hue = Math.abs(hash) % 360;
        return {
          style: {
            backgroundColor: `hsl(${hue}, 50%, 82%)`,
            borderColor: `hsl(${hue}, 50%, 65%)`,
          },
        };
      }
      return { className: SEX_COLORS.U };
    }
  }
}

function QuickAddButton({
  position,
  label,
  onClick,
}: {
  position: "top" | "bottom" | "left" | "right";
  label: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const positionClasses: Record<string, string> = {
    top: "-top-3 left-1/2 -translate-x-1/2",
    bottom: "-bottom-3 left-1/2 -translate-x-1/2",
    left: "top-1/2 -left-3 -translate-y-1/2",
    right: "top-1/2 -right-3 -translate-y-1/2",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`absolute ${positionClasses[position]} flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 z-10`}
    >
      +
    </button>
  );
}

/** zoom thresholds for progressive detail */
const ZOOM_COMPACT = 0.4;   // below this: name-only pill
const ZOOM_FULL = 1.0;      // above this: full card with actions

export function PersonNode({ data }: NodeProps) {
  const d = data as unknown as PersonNodeData;
  const router = useRouter();
  const zoom = useStore((s) => s.transform[2]);
  const nodeStyle = getNodeStyle(d);
  const icon = SEX_ICONS[d.sex ?? "U"] ?? "·";
  const [activePopover, setActivePopover] = useState<QuickAddType | null>(null);

  const lifespan = [d.birthYear, d.isLiving ? "living" : (d.deathYear ?? "?")]
    .filter(Boolean)
    .join(" – ");

  const handleQuickAdd = useCallback((type: QuickAddType) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePopover((prev) => (prev === type ? null : type));
  }, []);

  const closePopover = useCallback(() => setActivePopover(null), []);

  const handleClick = useCallback(() => {
    if (d.onOpenDetail) {
      d.onOpenDetail(d.id);
    } else {
      router.push(`/person/${d.id}`);
    }
  }, [d.id, d.onOpenDetail, router]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    d.onContextMenu?.(d.id, e.clientX, e.clientY);
  }, [d.id, d.onContextMenu]);

  const popoverPosition: Record<QuickAddType, string> = {
    parent: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    child: "top-full left-1/2 -translate-x-1/2 mt-2",
    spouse: "top-1/2 left-full -translate-y-1/2 ml-2",
  };

  // ── compact pill (far zoom) ──────────────────────────────────────────
  if (zoom < ZOOM_COMPACT) {
    return (
      <>
        <Handle type="target" position={Position.Top} className="!bg-border !w-1 !h-1" />
        <div
          className={`rounded-full border px-2 py-0.5 cursor-pointer ${nodeStyle.className ?? ""}`}
          style={nodeStyle.style}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
          <div className="truncate text-[9px] font-medium text-foreground leading-tight max-w-[100px]">
            {d.displayName.split(" ")[0]}
          </div>
        </div>
        <Handle type="source" position={Position.Bottom} className="!bg-border !w-1 !h-1" />
      </>
    );
  }

  // ── standard card (medium zoom) ──────────────────────────────────────
  // ── full card with actions (close zoom, > ZOOM_FULL) ─────────────────
  const showActions = zoom >= ZOOM_FULL;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-border !w-2 !h-2" />
      <div className="group relative">
        <div
          className={`rounded-lg border-2 px-3 py-2 shadow-sm min-w-[140px] max-w-[200px] min-h-[44px] cursor-pointer hover:shadow-md transition-shadow touch-manipulation ${nodeStyle.className ?? ""}`}
          style={nodeStyle.style}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
        >
          <div className="flex items-start gap-2">
            {d.thumbnailUrl ? (
              <img
                src={d.thumbnailUrl}
                alt=""
                className="h-8 w-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/60 text-sm font-medium">
                {icon}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground leading-tight">
                {d.displayName}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {lifespan}
              </div>
            </div>
          </div>

          {/* extra detail at close zoom */}
          {showActions && (
            <div className="mt-1.5 pt-1.5 border-t border-black/10 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              {d.parentIds.length > 0 && <span title="parents">↑{d.parentIds.length}</span>}
              {d.spouseIds.length > 0 && <span title="spouses">♥{d.spouseIds.length}</span>}
              {d.childIds.length > 0 && <span title="children">↓{d.childIds.length}</span>}
              {d.completenessScore < 3 && (
                <span className="ml-auto text-amber-500" title="incomplete profile">⚠</span>
              )}
            </div>
          )}
        </div>

        {/* quick-add buttons (visible on hover at any zoom) */}
        {showActions && (
          <>
            <QuickAddButton position="top" label="add parent" onClick={handleQuickAdd("parent")} />
            {!d.isCollapsed && <QuickAddButton position="bottom" label="add child" onClick={handleQuickAdd("child")} />}
            <QuickAddButton position="right" label="add spouse" onClick={handleQuickAdd("spouse")} />
          </>
        )}

        {/* collapse/expand toggle */}
        {d.isCollapsible && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              d.onToggleCollapse?.(d.id);
            }}
            title={d.isCollapsed ? "expand subtree" : "collapse subtree"}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-muted border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-card transition-colors z-10 shadow-sm"
          >
            {d.isCollapsed ? "+" : "−"}
          </button>
        )}

        {/* popover */}
        {activePopover && (
          <div className={`absolute ${popoverPosition[activePopover]}`}>
            <QuickAddPopover
              personId={d.id}
              personSurname={d.surname}
              type={activePopover}
              onClose={closePopover}
            />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-border !w-2 !h-2" />
    </>
  );
}
