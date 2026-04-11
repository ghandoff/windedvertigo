"use client";

import dynamic from "next/dynamic";
import type { TreeNode, PersonEvent, Place } from "@/lib/types";

const MapView = dynamic(
  () => import("./map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        loading map...
      </div>
    ),
  },
);

export function MapViewDynamic({
  nodes,
  events,
  places,
}: {
  nodes: TreeNode[];
  events: PersonEvent[];
  places: Place[];
}) {
  return <MapView nodes={nodes} events={events} places={places} />;
}
