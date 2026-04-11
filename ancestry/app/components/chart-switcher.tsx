"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { TreeNode, PersonEvent, Place, ColorMode } from "@/lib/types";
import { PedigreeChart } from "./pedigree-chart";
import { FanChart } from "./fan-chart";
import { MapViewDynamic } from "./map-view-dynamic";
import { TimelineView } from "./timeline-view";
import { RelationshipFinder } from "./relationship-finder";
import { ColorCoding } from "./color-coding";

const ChartExport = dynamic(() => import("./chart-export").then((m) => m.ChartExport), {
  ssr: false,
});

type ChartType = "pedigree" | "fan" | "map" | "timeline" | "find path";

const CHART_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "pedigree", label: "pedigree" },
  { value: "fan", label: "fan" },
  { value: "map", label: "map" },
  { value: "timeline", label: "timeline" },
  { value: "find path", label: "find path" },
];

export function ChartSwitcher({
  nodes,
  events = [],
  places = [],
}: {
  nodes: TreeNode[];
  events?: PersonEvent[];
  places?: Place[];
}) {
  const [activeChart, setActiveChart] = useState<ChartType>("pedigree");
  const [colorMode, setColorMode] = useState<ColorMode>("sex");

  return (
    <div className="relative w-full h-full">
      {/* switcher tabs */}
      <div className="absolute top-3 left-12 md:left-3 right-3 md:right-auto z-10 flex gap-1 rounded-lg bg-card/90 backdrop-blur-sm border border-border p-1 shadow-sm overflow-x-auto scrollbar-hide">
        {CHART_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setActiveChart(opt.value)}
            className={`px-2 md:px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeChart === opt.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* export controls */}
      {(activeChart === "fan" || activeChart === "pedigree") && (
        <div className="absolute top-14 md:top-3 right-3 z-10 flex flex-col md:flex-row gap-2 items-end md:items-center">
          {activeChart === "pedigree" && (
            <ColorCoding value={colorMode} onChange={setColorMode} />
          )}
          <div className="rounded-lg bg-card/90 backdrop-blur-sm border border-border p-1 shadow-sm">
            <ChartExport mode={activeChart === "fan" ? "pdf" : "print"} />
          </div>
        </div>
      )}

      {/* chart area */}
      <div className="w-full h-full">
        {activeChart === "pedigree" && <PedigreeChart nodes={nodes} colorMode={colorMode} />}
        {activeChart === "fan" && <FanChart nodes={nodes} />}
        {activeChart === "map" && <MapViewDynamic nodes={nodes} events={events} places={places} />}
        {activeChart === "timeline" && <TimelineView nodes={nodes} events={events} />}
        {activeChart === "find path" && <RelationshipFinder nodes={nodes} />}
      </div>
    </div>
  );
}
