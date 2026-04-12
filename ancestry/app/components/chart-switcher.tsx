"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import type { TreeNode, PersonEvent, Place, ColorMode } from "@/lib/types";
import type { LayoutPositions, SavedView } from "@/lib/db/queries";
import { PedigreeChart } from "./pedigree-chart";
import { FanChart } from "./fan-chart";
import { MapViewDynamic } from "./map-view-dynamic";
import { TimelineView } from "./timeline-view";
import { RelationshipFinder } from "./relationship-finder";
import { DescendancyChart } from "./descendancy-chart";
import { HourglassChart } from "./hourglass-chart";
import { ColorCoding } from "./color-coding";
import { PersonSelect } from "./person-select";

const ChartExport = dynamic(() => import("./chart-export").then((m) => m.ChartExport), {
  ssr: false,
});

type ChartType = "pedigree" | "descendancy" | "hourglass" | "fan" | "map" | "timeline" | "find path";

const CHART_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "pedigree", label: "pedigree" },
  { value: "descendancy", label: "descendancy" },
  { value: "hourglass", label: "hourglass" },
  { value: "fan", label: "fan" },
  { value: "map", label: "map" },
  { value: "timeline", label: "timeline" },
  { value: "find path", label: "find path" },
];

const CHARTS_WITH_COLOR_CODING: ChartType[] = ["pedigree", "descendancy", "hourglass"];
const CHARTS_NEEDING_PERSON: ChartType[] = ["descendancy", "hourglass"];

export function ChartSwitcher({
  nodes,
  events = [],
  places = [],
  savedPositions = {},
}: {
  nodes: TreeNode[];
  events?: PersonEvent[];
  places?: Place[];
  savedPositions?: LayoutPositions;
}) {
  const [activeChart, setActiveChart] = useState<ChartType>("pedigree");
  const [colorMode, setColorMode] = useState<ColorMode>("sex");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [customFieldKeys, setCustomFieldKeys] = useState<string[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [viewName, setViewName] = useState("");

  useEffect(() => {
    fetch("/api/custom-fields")
      .then(r => r.json())
      .then(setCustomFieldKeys)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/views")
      .then(r => r.json())
      .then(views => setSavedViews(views))
      .catch(() => {});
  }, []);

  const saveCurrentView = useCallback(async () => {
    if (!viewName.trim()) return;
    const view: SavedView = {
      id: crypto.randomUUID(),
      name: viewName.trim(),
      chartType: activeChart,
      colorMode,
      focalPersonId: selectedPersonId || null,
      ancestorDepth: 4,
      descendantDepth: 4,
      collapsedNodeIds: [],
      createdAt: new Date().toISOString(),
    };
    try {
      await fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(view),
      });
      setSavedViews(prev => [...prev, view]);
      setViewName("");
      setShowSaveDialog(false);
    } catch {}
  }, [viewName, activeChart, colorMode, selectedPersonId]);

  const loadView = useCallback((view: SavedView) => {
    setActiveChart(view.chartType as ChartType);
    setColorMode(view.colorMode as ColorMode);
    if (view.focalPersonId) setSelectedPersonId(view.focalPersonId);
  }, []);

  const deleteView = useCallback(async (viewId: string) => {
    try {
      await fetch("/api/views", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewId }),
      });
      setSavedViews(prev => prev.filter(v => v.id !== viewId));
    } catch {}
  }, []);

  const needsPerson = CHARTS_NEEDING_PERSON.includes(activeChart);
  const showColorCoding = CHARTS_WITH_COLOR_CODING.includes(activeChart);
  const showExport = activeChart === "fan" || activeChart === "pedigree";

  return (
    <div className="relative w-full h-full">
      {/* switcher tabs */}
      <div data-tutorial="chart-tabs" className="absolute top-3 left-12 md:left-3 right-3 md:right-auto z-10 flex gap-1 rounded-lg bg-card/90 backdrop-blur-sm border border-border p-1 shadow-sm overflow-x-auto scrollbar-hide">
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

      {/* saved views dropdown */}
      <div className="absolute top-3 right-3 z-10">
        <div className="relative">
          <button
            onClick={() => setShowSaveDialog(prev => !prev)}
            className="rounded-lg bg-card/90 backdrop-blur-sm border border-border p-2 shadow-sm text-muted-foreground hover:text-foreground transition-colors"
            title="saved views"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
            </svg>
          </button>

          {showSaveDialog && (
            <div className="absolute right-0 top-full mt-1 w-64 rounded-lg bg-card border border-border shadow-lg z-50 p-2 space-y-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-1">saved views</div>

              {savedViews.length === 0 && (
                <div className="text-xs text-muted-foreground px-1 py-2">no saved views yet</div>
              )}

              {savedViews.map(v => (
                <div key={v.id} className="flex items-center gap-1 group">
                  <button
                    onClick={() => { loadView(v); setShowSaveDialog(false); }}
                    className="flex-1 text-left rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors truncate"
                  >
                    <span className="font-medium">{v.name}</span>
                    <span className="text-muted-foreground ml-1.5">· {v.chartType}</span>
                  </button>
                  <button
                    onClick={() => deleteView(v.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 text-xs px-1 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}

              <div className="border-t border-border pt-2 flex gap-1">
                <input
                  value={viewName}
                  onChange={e => setViewName(e.target.value)}
                  placeholder="view name..."
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                  onKeyDown={e => { if (e.key === "Enter") saveCurrentView(); }}
                />
                <button
                  onClick={saveCurrentView}
                  disabled={!viewName.trim()}
                  className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* person selector for descendancy/hourglass */}
      {needsPerson && (
        <div className="absolute top-14 left-12 md:left-3 z-10 w-64">
          <div className="rounded-lg bg-card/90 backdrop-blur-sm border border-border p-2 shadow-sm">
            <label className="block text-[10px] text-muted-foreground mb-1">focal person</label>
            <PersonSelect
              nodes={nodes}
              value={selectedPersonId}
              onChange={setSelectedPersonId}
              placeholder="select a person..."
            />
          </div>
        </div>
      )}

      {/* export + color coding controls */}
      {(showExport || showColorCoding) && (
        <div className={`absolute ${needsPerson ? "top-[7.5rem]" : "top-14"} md:top-3 right-12 z-10 flex flex-col md:flex-row gap-2 items-end md:items-center`}>
          {showColorCoding && (
            <ColorCoding value={colorMode} onChange={setColorMode} customFieldKeys={customFieldKeys} />
          )}
          {showExport && (
            <div className="rounded-lg bg-card/90 backdrop-blur-sm border border-border p-1 shadow-sm">
              <ChartExport mode={activeChart === "fan" ? "pdf" : "print"} />
            </div>
          )}
        </div>
      )}

      {/* chart area */}
      <div className="w-full h-full">
        {activeChart === "pedigree" && <PedigreeChart nodes={nodes} colorMode={colorMode} savedPositions={savedPositions} events={events} />}
        {activeChart === "descendancy" && selectedPersonId && (
          <DescendancyChart nodes={nodes} rootId={selectedPersonId} colorMode={colorMode} events={events} />
        )}
        {activeChart === "descendancy" && !selectedPersonId && (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            select a focal person to view their descendants
          </div>
        )}
        {activeChart === "hourglass" && selectedPersonId && (
          <HourglassChart nodes={nodes} rootId={selectedPersonId} colorMode={colorMode} events={events} />
        )}
        {activeChart === "hourglass" && !selectedPersonId && (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            select a focal person to view their hourglass chart
          </div>
        )}
        {activeChart === "fan" && <FanChart nodes={nodes} />}
        {activeChart === "map" && <MapViewDynamic nodes={nodes} events={events} places={places} />}
        {activeChart === "timeline" && <TimelineView nodes={nodes} events={events} />}
        {activeChart === "find path" && <RelationshipFinder nodes={nodes} />}
      </div>
    </div>
  );
}
