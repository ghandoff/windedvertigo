"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TreeNode, PersonEvent, Place } from "@/lib/types";

// fix leaflet default marker icons (broken in webpack/turbopack)
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// event type colors for polylines and markers
const EVENT_COLORS: Record<string, string> = {
  birth: "#22c55e",
  death: "#ef4444",
  marriage: "#8b5cf6",
  residence: "#3b82f6",
  immigration: "#f59e0b",
  emigration: "#f97316",
};

function getColor(eventType: string): string {
  return EVENT_COLORS[eventType] ?? "#6b7280";
}

function createColorIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 12px; height: 12px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  });
}

type MapMarker = {
  lat: number;
  lng: number;
  personName: string;
  personId: string;
  eventType: string;
  date: string | null;
  placeName: string;
};

export function MapView({
  nodes,
  events,
  places,
}: {
  nodes: TreeNode[];
  events: PersonEvent[];
  places: Place[];
}) {
  // build place lookup: placeId -> Place
  const placeMap = new Map<string, Place>();
  for (const p of places) {
    placeMap.set(p.id, p);
  }

  // build person name lookup
  const nameMap = new Map<string, string>();
  for (const n of nodes) {
    nameMap.set(n.id, n.displayName);
  }

  // build markers from events that have places with lat/lng
  const markers: MapMarker[] = [];
  for (const evt of events) {
    if (!evt.place_id) continue;
    const place = placeMap.get(evt.place_id);
    if (!place || place.latitude == null || place.longitude == null) continue;

    markers.push({
      lat: place.latitude,
      lng: place.longitude,
      personName: nameMap.get(evt.person_id) ?? "unknown",
      personId: evt.person_id,
      eventType: evt.event_type,
      date: evt.sort_date,
      placeName: place.name,
    });
  }

  // group markers by person for migration lines
  const personMarkers = new Map<string, MapMarker[]>();
  for (const m of markers) {
    const list = personMarkers.get(m.personId) ?? [];
    list.push(m);
    personMarkers.set(m.personId, list);
  }

  // compute center
  let center: [number, number] = [39.8, -98.5]; // US center default
  if (markers.length > 0) {
    const avgLat = markers.reduce((s, m) => s + m.lat, 0) / markers.length;
    const avgLng = markers.reduce((s, m) => s + m.lng, 0) / markers.length;
    center = [avgLat, avgLng];
  }

  if (places.length === 0 || markers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <div className="text-center space-y-1">
          <p>no places with coordinates found</p>
          <p className="text-xs">add coordinates to places to see them on the map</p>
        </div>
      </div>
    );
  }

  // migration polylines per person
  const polylines: { positions: [number, number][]; personId: string }[] = [];
  for (const [personId, pMarkers] of personMarkers) {
    if (pMarkers.length < 2) continue;
    // sort by date
    const sorted = [...pMarkers].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });
    polylines.push({
      personId,
      positions: sorted.map((m) => [m.lat, m.lng]),
    });
  }

  return (
    <MapContainer
      center={center}
      zoom={markers.length === 1 ? 8 : 4}
      className="h-full w-full"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {markers.map((m, i) => (
        <Marker
          key={`${m.personId}-${m.eventType}-${i}`}
          position={[m.lat, m.lng]}
          icon={createColorIcon(getColor(m.eventType))}
        >
          <Popup>
            <div className="text-xs space-y-0.5">
              <div className="font-medium">{m.personName}</div>
              <div>{m.eventType}{m.date ? ` — ${m.date.slice(0, 4)}` : ""}</div>
              <div className="text-muted-foreground">{m.placeName}</div>
            </div>
          </Popup>
        </Marker>
      ))}

      {polylines.map((pl) => (
        <Polyline
          key={pl.personId}
          positions={pl.positions}
          pathOptions={{ color: "#6b7280", weight: 2, opacity: 0.5, dashArray: "4 4" }}
        />
      ))}
    </MapContainer>
  );
}
