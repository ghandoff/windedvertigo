"use client";

import { useState, useMemo } from "react";
import type { TreeNode } from "@/lib/types";
import { calculateRelationship } from "@/lib/relationship-calculator";
import { PersonSelect } from "./person-select";

type PathStep = { personId: string; edgeLabel: string };

type AdjEntry = { targetId: string; label: string };

function buildAdjacencyList(nodes: TreeNode[]): Map<string, AdjEntry[]> {
  const adj = new Map<string, AdjEntry[]>();

  const addEdge = (from: string, to: string, label: string) => {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push({ targetId: to, label });
  };

  for (const node of nodes) {
    if (!adj.has(node.id)) adj.set(node.id, []);

    for (const parentId of node.parentIds) {
      addEdge(node.id, parentId, "child \u2192 parent");
      addEdge(parentId, node.id, "parent \u2192 child");
    }

    for (const spouseId of node.spouseIds) {
      addEdge(node.id, spouseId, "spouse");
    }

    // childIds edges are already covered by the reverse parentIds traversal,
    // but in case some nodes are missing from the array, add them explicitly
    for (const childId of node.childIds) {
      addEdge(node.id, childId, "parent \u2192 child");
      addEdge(childId, node.id, "child \u2192 parent");
    }
  }

  return adj;
}

function findPath(
  nodes: TreeNode[],
  fromId: string,
  toId: string
): PathStep[] | null {
  if (fromId === toId) return [{ personId: fromId, edgeLabel: "" }];

  const adj = buildAdjacencyList(nodes);
  const visited = new Set<string>();
  // queue entries: [currentId, path so far]
  const queue: [string, PathStep[]][] = [
    [fromId, [{ personId: fromId, edgeLabel: "" }]],
  ];
  visited.add(fromId);

  while (queue.length > 0) {
    const [currentId, path] = queue.shift()!;
    const neighbors = adj.get(currentId) ?? [];

    for (const { targetId, label } of neighbors) {
      if (visited.has(targetId)) continue;
      visited.add(targetId);

      const newPath = [...path, { personId: targetId, edgeLabel: label }];
      if (targetId === toId) return newPath;
      queue.push([targetId, newPath]);
    }
  }

  return null;
}

// --- sex color helper ---

function sexBgClass(sex: string | null): string {
  if (sex === "M") return "border-[#6B8F9E] bg-blue-50";
  if (sex === "F") return "border-[#A45A52] bg-rose-50";
  return "border-[#C97B3D] bg-orange-50";
}

const SEX_ICONS: Record<string, string> = {
  M: "\u2642",
  F: "\u2640",
  X: "\u26A7",
  U: "\u00B7",
};

// --- path card ---

function PathCard({ node }: { node: TreeNode }) {
  const icon = SEX_ICONS[node.sex ?? "U"] ?? "\u00B7";
  const lifespan = [node.birthYear, node.isLiving ? "living" : (node.deathYear ?? "?")]
    .filter(Boolean)
    .join(" \u2013 ");

  return (
    <div
      className={`rounded-lg border-2 px-3 py-2 shadow-sm min-w-[140px] max-w-[200px] shrink-0 ${sexBgClass(node.sex)}`}
    >
      <div className="flex items-start gap-2">
        {node.thumbnailUrl ? (
          <img
            src={node.thumbnailUrl}
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
            {node.displayName}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{lifespan}</div>
        </div>
      </div>
    </div>
  );
}

// --- arrow between cards ---

function PathArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center shrink-0 px-1">
      <span className="text-[10px] text-muted-foreground whitespace-nowrap mb-0.5">
        {label}
      </span>
      <svg width="40" height="16" viewBox="0 0 40 16" className="text-muted-foreground">
        <line x1="0" y1="8" x2="32" y2="8" stroke="currentColor" strokeWidth="1.5" />
        <polygon points="32,3 40,8 32,13" fill="currentColor" />
      </svg>
    </div>
  );
}

// --- main component ---

export function RelationshipFinder({ nodes }: { nodes: TreeNode[] }) {
  const [personA, setPersonA] = useState("");
  const [personB, setPersonB] = useState("");
  const [result, setResult] = useState<PathStep[] | null | undefined>(undefined);
  const [searched, setSearched] = useState(false);

  const nodeMap = useMemo(() => {
    const m = new Map<string, TreeNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const handleFind = () => {
    if (!personA || !personB) return;
    if (personA === personB) {
      setResult([{ personId: personA, edgeLabel: "" }]);
      setSearched(true);
      return;
    }
    const path = findPath(nodes, personA, personB);
    setResult(path);
    setSearched(true);
  };

  const relationshipLabel = useMemo(() => {
    if (!result || result.length === 0) return null;
    return calculateRelationship(result);
  }, [result]);

  const stepsText = useMemo(() => {
    if (!result || result.length <= 1) return null;
    const labels = result.slice(1).map((s) => s.edgeLabel);
    return `${result.length - 1} step${result.length - 1 === 1 ? "" : "s"}: ${labels.join(" \u2192 ")}`;
  }, [result]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* top bar */}
      <div className="flex flex-wrap items-end gap-3 p-4 border-b border-border bg-card/50">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-muted-foreground mb-1">person a</label>
          <PersonSelect
            nodes={nodes}
            value={personA}
            onChange={setPersonA}
            placeholder="search..."
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-muted-foreground mb-1">person b</label>
          <PersonSelect
            nodes={nodes}
            value={personB}
            onChange={setPersonB}
            placeholder="search..."
          />
        </div>
        <button
          onClick={handleFind}
          disabled={!personA || !personB}
          className="px-4 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          find path
        </button>
        {searched && relationshipLabel && relationshipLabel !== "self" && (
          <div className="w-full mt-1">
            <div className="text-base font-semibold text-foreground">{relationshipLabel}</div>
            {stepsText && (
              <div className="text-xs text-muted-foreground mt-0.5">{stepsText}</div>
            )}
          </div>
        )}
        {searched && personA === personB && personA && (
          <div className="w-full mt-1">
            <div className="text-base font-semibold text-foreground">self</div>
          </div>
        )}
      </div>

      {/* path visualization */}
      <div className="flex-1 overflow-auto p-6">
        {!searched && (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            select two people and click &quot;find path&quot;
          </div>
        )}

        {searched && result === null && (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            no connection found
          </div>
        )}

        {searched && result && result.length === 1 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <PathCard node={nodeMap.get(result[0].personId)!} />
              <div className="text-sm text-muted-foreground mt-3">same person</div>
            </div>
          </div>
        )}

        {searched && result && result.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-4">
            {result.map((step, i) => {
              const node = nodeMap.get(step.personId);
              if (!node) return null;
              return (
                <div key={step.personId} className="flex items-center">
                  {i > 0 && <PathArrow label={step.edgeLabel} />}
                  <PathCard node={node} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
