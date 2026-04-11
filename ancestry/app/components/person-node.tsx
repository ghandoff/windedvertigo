"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { TreeNode, ColorMode } from "@/lib/types";
import { QuickAddPopover, type QuickAddType } from "./quick-add-popover";

export type PersonNodeData = TreeNode & {
  generation: number;
  colorMode: ColorMode;
  surnameIndex: number;
  completenessScore: number;
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

    default:
      return { className: SEX_COLORS.U };
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

export function PersonNode({ data }: NodeProps) {
  const d = data as unknown as PersonNodeData;
  const router = useRouter();
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

  const popoverPosition: Record<QuickAddType, string> = {
    parent: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    child: "top-full left-1/2 -translate-x-1/2 mt-2",
    spouse: "top-1/2 left-full -translate-y-1/2 ml-2",
  };

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-border !w-2 !h-2" />
      <div className="group relative">
        <div
          className={`rounded-lg border-2 px-3 py-2 shadow-sm min-w-[140px] max-w-[200px] min-h-[44px] cursor-pointer hover:shadow-md transition-shadow touch-manipulation ${nodeStyle.className ?? ""}`}
          style={nodeStyle.style}
          onClick={() => router.push(`/person/${d.id}`)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") router.push(`/person/${d.id}`); }}
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
        </div>

        {/* quick-add buttons */}
        <QuickAddButton position="top" label="add parent" onClick={handleQuickAdd("parent")} />
        <QuickAddButton position="bottom" label="add child" onClick={handleQuickAdd("child")} />
        <QuickAddButton position="right" label="add spouse" onClick={handleQuickAdd("spouse")} />

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
