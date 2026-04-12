"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { useTutorial } from "./tutorial-provider";
import type { EventData, Controls, Step, TooltipRenderProps } from "react-joyride";

// load react-joyride only on client (it accesses DOM APIs)
const JoyrideComponent = dynamic(
  () => import("react-joyride").then((m) => m.Joyride),
  { ssr: false },
);

function TourTooltip({
  continuous,
  index,
  step,
  size,
  backProps,
  primaryProps,
  skipProps,
  closeProps,
}: TooltipRenderProps) {
  return (
    <div className="rounded-lg bg-card border border-border shadow-xl max-w-[320px] overflow-hidden">
      {/* header */}
      <div className="px-4 pt-4 pb-2">
        {step.title && (
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {step.title as string}
          </h3>
        )}
        <div className="text-xs text-muted-foreground leading-relaxed">
          {step.content}
        </div>
      </div>

      {/* footer */}
      <div className="px-4 pb-3 pt-2 flex items-center justify-between">
        <button
          {...skipProps}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          skip tour
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {index + 1} / {size}
          </span>

          {index > 0 && (
            <button
              {...backProps}
              className="rounded border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              back
            </button>
          )}

          {continuous ? (
            <button
              {...primaryProps}
              className="rounded bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {index === size - 1 ? "done" : "next"}
            </button>
          ) : (
            <button
              {...closeProps}
              className="rounded bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              got it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const TOUR_STEPS: Step[] = [
  {
    target: ".react-flow",
    title: "your family tree",
    content:
      "this is your family tree canvas. click and drag to pan around, scroll to zoom in and out. the dot grid helps you orient.",
    placement: "center",
    skipBeacon: true,
  },
  {
    target: ".react-flow__node:first-of-type",
    title: "people cards",
    content:
      "click any person to see their details in a side panel. double-click to open their full profile for editing. right-click for quick actions.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tutorial='chart-tabs']",
    title: "chart views",
    content:
      "switch between different views — pedigree shows ancestors, descendancy shows descendants, fan gives a radial view, and more.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tutorial='sidebar']",
    title: "build your tree",
    content:
      "add people and relationships from the sidebar. you can also import a GEDCOM file if you have data from another platform.",
    placement: "right",
    skipBeacon: true,
  },
  {
    target: "[data-tutorial='help-button']",
    title: "you're all set!",
    content:
      "need help later? click this button anytime. you can also replay this tour or browse keyboard shortcuts.",
    placement: "top",
    skipBeacon: true,
  },
];

export function ProductTour() {
  const { tourRunning, completeTour } = useTutorial();

  const handleEvent = useCallback(
    (data: EventData, _controls: Controls) => {
      const { status, action } = data;
      if (status === "finished" || status === "skipped" || action === "close") {
        completeTour();
      }
    },
    [completeTour],
  );

  if (!tourRunning) return null;

  return (
    <JoyrideComponent
      steps={TOUR_STEPS}
      run={tourRunning}
      continuous
      onEvent={handleEvent}
      tooltipComponent={TourTooltip}
      options={{
        zIndex: 10000,
        overlayColor: "rgba(0, 0, 0, 0.4)",
        spotlightRadius: 8,
        buttons: ["back", "close", "primary", "skip"],
        overlayClickAction: false,
      }}
      floatingOptions={{
        hideArrow: true,
      }}
    />
  );
}
