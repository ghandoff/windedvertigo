"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as d3 from "d3";
import type { TreeNode } from "@/lib/types";

type AncestorNode = {
  node: TreeNode | null;
  generation: number;
  index: number; // position within generation (0-based)
  startAngle: number;
  endAngle: number;
};

const GEN_COLORS = [
  "var(--gen-0)",
  "var(--gen-1)",
  "var(--gen-2)",
  "var(--gen-3)",
  "var(--gen-4)",
  "var(--gen-5)",
];

const SEX_FILLS: Record<string, string> = {
  M: "rgba(219, 234, 254, 0.7)", // blue-50
  F: "rgba(255, 228, 230, 0.7)", // rose-50
  X: "rgba(243, 232, 255, 0.7)", // purple-50
  U: "rgba(249, 250, 251, 0.7)", // gray-50
};

const SEX_STROKES: Record<string, string> = {
  M: "rgb(96, 165, 250)", // blue-400
  F: "rgb(251, 113, 133)", // rose-400
  X: "rgb(192, 132, 252)", // purple-400
  U: "rgb(209, 213, 219)", // gray-300
};

const MAX_GENERATIONS = 6;
const CENTER_RADIUS = 50;
const RING_WIDTH = 60;

function buildAncestorTree(
  nodes: TreeNode[],
  focalId: string,
): AncestorNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const result: AncestorNode[] = [];
  const totalAngle = Math.PI; // semicircle (180 degrees)
  const startOffset = -Math.PI / 2; // start at top, going right

  // generation 0: focal person
  const focal = nodeMap.get(focalId);
  if (!focal) return result;

  result.push({
    node: focal,
    generation: 0,
    index: 0,
    startAngle: -totalAngle,
    endAngle: totalAngle,
  });

  // BFS by binary tree positions
  // Each person at (gen, idx) has parents at (gen+1, idx*2) and (gen+1, idx*2+1)
  type QueueItem = { id: string; generation: number; index: number };
  const queue: QueueItem[] = [{ id: focalId, generation: 0, index: 0 }];

  while (queue.length > 0) {
    const { id, generation, index } = queue.shift()!;
    if (generation >= MAX_GENERATIONS) continue;

    const person = nodeMap.get(id);
    if (!person) continue;

    const parentGen = generation + 1;
    const slotsInGen = Math.pow(2, parentGen);
    const anglePerSlot = (2 * totalAngle) / slotsInGen;

    // sort parents: father (M) first slot, mother (F) second slot
    const parents = person.parentIds
      .map((pid) => nodeMap.get(pid))
      .filter(Boolean) as TreeNode[];

    // father = index*2, mother = index*2+1
    const father = parents.find((p) => p.sex === "M") ?? parents[0] ?? null;
    const mother =
      parents.find((p) => p.sex === "F") ??
      (parents.length > 1 ? parents[1] : null);

    const fatherIdx = index * 2;
    const motherIdx = index * 2 + 1;

    if (father) {
      const sa = -totalAngle + fatherIdx * anglePerSlot;
      const ea = sa + anglePerSlot;
      result.push({
        node: father,
        generation: parentGen,
        index: fatherIdx,
        startAngle: sa,
        endAngle: ea,
      });
      queue.push({ id: father.id, generation: parentGen, index: fatherIdx });
    }

    if (mother) {
      const sa = -totalAngle + motherIdx * anglePerSlot;
      const ea = sa + anglePerSlot;
      result.push({
        node: mother,
        generation: parentGen,
        index: motherIdx,
        startAngle: sa,
        endAngle: ea,
      });
      queue.push({ id: mother.id, generation: parentGen, index: motherIdx });
    }
  }

  return result;
}

function lifespan(node: TreeNode): string {
  const parts = [
    node.birthYear,
    node.isLiving ? "living" : (node.deathYear ?? "?"),
  ].filter(Boolean);
  return parts.join(" \u2013 ");
}

export function FanChart({
  nodes,
  focalPersonId,
}: {
  nodes: TreeNode[];
  focalPersonId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [focalId, setFocalId] = useState(
    focalPersonId ?? nodes[0]?.id ?? "",
  );
  const [hoveredLineage, setHoveredLineage] = useState<Set<string>>(
    new Set(),
  );
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const ancestorNodes = buildAncestorTree(nodes, focalId);

  // build lineage map for hover highlighting
  const getLineage = useCallback(
    (personId: string): Set<string> => {
      const lineage = new Set<string>();
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // walk from focal to this person through ancestor tree
      const ancestorMap = new Map(
        ancestorNodes
          .filter((a) => a.node)
          .map((a) => [a.node!.id, a]),
      );

      // trace path from person back to focal
      let current = ancestorMap.get(personId);
      while (current?.node) {
        lineage.add(current.node.id);
        if (current.generation === 0) break;
        // find child (parent gen - 1, index Math.floor(index/2))
        const childIdx = Math.floor(current.index / 2);
        const childGen = current.generation - 1;
        const child = ancestorNodes.find(
          (a) => a.generation === childGen && a.index === childIdx,
        );
        if (child?.node) {
          current = child;
        } else {
          break;
        }
      }

      return lineage;
    },
    [nodes, ancestorNodes],
  );

  const handleClick = useCallback(
    (personId: string) => {
      setFocalId(personId);
      setHoveredLineage(new Set());
    },
    [],
  );

  const { width, height } = dimensions;
  const cx = width / 2;

  // determine the actual max generation in the tree
  const maxGen = Math.max(...ancestorNodes.map((a) => a.generation), 1);

  // compute ring width so the fan fits within the container
  const padding = 20;
  const maxRadiusV = height - CENTER_RADIUS - padding * 2; // vertical: fan extends up from cy, focal circle down
  const maxRadiusH = width / 2 - padding; // horizontal: semicircle extends left/right from cx
  const maxRadius = Math.max(Math.min(maxRadiusV, maxRadiusH), CENTER_RADIUS + 20);
  const ringWidth = Math.max((maxRadius - CENTER_RADIUS) / maxGen, 15);

  // center the fan vertically:
  // fan extends upward by maxOuterRadius from cy, and downward by CENTER_RADIUS
  const maxOuterRadius = CENTER_RADIUS + maxGen * ringWidth;
  const cy = (height + maxOuterRadius + CENTER_RADIUS) / 2 - (maxOuterRadius - CENTER_RADIUS) / 2 + CENTER_RADIUS;

  const arcGenerator = d3.arc<AncestorNode>();

  return (
    <div ref={containerRef} className="w-full h-full relative" data-chart="fan">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="block"
      >
        <g transform={`translate(${cx},${cy})`}>
          {/* render generations from outermost to innermost so inner overlaps */}
          {[...ancestorNodes]
            .sort((a, b) => b.generation - a.generation)
            .map((ancestor) => {
              if (!ancestor.node) return null;

              const { node, generation, startAngle, endAngle } = ancestor;
              const innerRadius =
                generation === 0
                  ? 0
                  : CENTER_RADIUS + (generation - 1) * ringWidth;
              const outerRadius =
                generation === 0
                  ? CENTER_RADIUS
                  : CENTER_RADIUS + generation * ringWidth;

              const isHighlighted =
                hoveredLineage.size === 0 || hoveredLineage.has(node.id);
              const opacity = hoveredLineage.size === 0 ? 1 : isHighlighted ? 1 : 0.3;

              // arc path
              const arcPath =
                generation === 0
                  ? // circle for focal person
                    null
                  : arcGenerator({
                      ...ancestor,
                      innerRadius,
                      outerRadius,
                      startAngle,
                      endAngle,
                      padAngle: 0.01,
                    } as any);

              const fill = SEX_FILLS[node.sex ?? "U"] ?? SEX_FILLS.U;
              const stroke = SEX_STROKES[node.sex ?? "U"] ?? SEX_STROKES.U;
              const genColor = GEN_COLORS[Math.min(generation, GEN_COLORS.length - 1)];

              // text positioning
              const midAngle = (startAngle + endAngle) / 2;
              const textRadius = (innerRadius + outerRadius) / 2;
              const textX = generation === 0 ? 0 : textRadius * Math.sin(midAngle);
              const textY = generation === 0 ? 0 : -textRadius * Math.cos(midAngle);

              // determine if text should be rotated
              const angleDeg = (midAngle * 180) / Math.PI;
              const wedgeAngleDeg = ((endAngle - startAngle) * 180) / Math.PI;
              const showText = wedgeAngleDeg > 8; // hide text in very narrow wedges
              const showLifespan = wedgeAngleDeg > 16;

              // rotate text to follow the arc for readability
              let textRotation = angleDeg;
              // flip text that would be upside down
              if (textRotation > 90) textRotation -= 180;
              if (textRotation < -90) textRotation += 180;

              return (
                <g
                  key={`${node.id}-${generation}-${ancestor.index}`}
                  style={{
                    opacity,
                    transition: "opacity 0.2s ease",
                    cursor: "pointer",
                    touchAction: "manipulation",
                  }}
                  onMouseEnter={() => setHoveredLineage(getLineage(node.id))}
                  onMouseLeave={() => setHoveredLineage(new Set())}
                  onClick={() => handleClick(node.id)}
                >
                  {generation === 0 ? (
                    <circle
                      r={CENTER_RADIUS}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={2}
                    />
                  ) : (
                    <path
                      d={arcPath ?? ""}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={1.5}
                    />
                  )}
                  {/* generation color indicator on inner edge */}
                  {generation > 0 && (
                    <path
                      d={
                        arcGenerator({
                          ...ancestor,
                          innerRadius,
                          outerRadius: innerRadius + 3,
                          startAngle,
                          endAngle,
                          padAngle: 0.01,
                        } as any) ?? ""
                      }
                      fill={genColor}
                      opacity={0.8}
                    />
                  )}
                  {showText && (
                    <g
                      transform={
                        generation === 0
                          ? ""
                          : `translate(${textX},${textY}) rotate(${textRotation})`
                      }
                    >
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-foreground"
                        style={{
                          fontSize:
                            generation === 0
                              ? "13px"
                              : generation <= 2
                                ? "11px"
                                : "9px",
                          fontWeight: generation === 0 ? 600 : 500,
                          pointerEvents: "none",
                          textTransform: "lowercase",
                        }}
                        dy={showLifespan ? "-0.4em" : "0"}
                      >
                        {node.displayName}
                      </text>
                      {showLifespan && (
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="fill-muted-foreground"
                          style={{
                            fontSize:
                              generation === 0 ? "11px" : generation <= 2 ? "9px" : "7px",
                            pointerEvents: "none",
                          }}
                          dy="0.8em"
                        >
                          {lifespan(node)}
                        </text>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
        </g>
      </svg>
    </div>
  );
}
