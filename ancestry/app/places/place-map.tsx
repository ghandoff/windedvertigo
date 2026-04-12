"use client";

import { useState, useTransition, useEffect } from "react";
import { getPlaceDataAction, geocodePlacesAction } from "./actions";

type PlaceData = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  event_count: number;
  persons: string[];
};

type MigrationPath = {
  person_id: string;
  person_name: string;
  events: Array<{ event_type: string; date: string | null; place_name: string; lat: number; lng: number }>;
};

type PlaceState = {
  places: PlaceData[];
  ungeocoded: Array<{ id: string; name: string }>;
  migrations: MigrationPath[];
};

const COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
];

export function PlaceMap() {
  const [data, setData] = useState<PlaceState | null>(null);
  const [loading, startLoad] = useTransition();
  const [geocoding, startGeocode] = useTransition();
  const [geocodeResult, setGeocodeResult] = useState<{ geocoded: number; total: number } | null>(null);
  const [showMigrations, setShowMigrations] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  useEffect(() => {
    startLoad(async () => {
      const result = await getPlaceDataAction();
      setData(result as PlaceState);
    });
  }, []);

  function handleGeocode() {
    startGeocode(async () => {
      const result = await geocodePlacesAction();
      setGeocodeResult(result);
      // refresh data
      const updated = await getPlaceDataAction();
      setData(updated as PlaceState);
    });
  }

  if (loading || !data) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        loading place data...
      </div>
    );
  }

  // compute map bounds
  const allCoords = data.places.map((p) => ({ lat: p.latitude, lng: p.longitude }));
  if (allCoords.length === 0) {
    return (
      <div className="space-y-4">
        {data.ungeocoded.length > 0 ? (
          <div className="rounded-md border border-border p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {data.ungeocoded.length} place{data.ungeocoded.length === 1 ? "" : "s"} without coordinates.
            </p>
            <button
              onClick={handleGeocode}
              disabled={geocoding}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {geocoding ? "geocoding..." : "geocode all places"}
            </button>
          </div>
        ) : (
          <div className="text-center py-12 text-sm text-muted-foreground">
            no places with coordinates found. add places to events to see them on the map.
          </div>
        )}
      </div>
    );
  }

  const centerLat = allCoords.reduce((s, c) => s + c.lat, 0) / allCoords.length;
  const centerLng = allCoords.reduce((s, c) => s + c.lng, 0) / allCoords.length;

  // simple SVG map projection (equirectangular)
  const margin = 40;
  const width = 800;
  const height = 500;
  const latMin = Math.min(...allCoords.map((c) => c.lat)) - 2;
  const latMax = Math.max(...allCoords.map((c) => c.lat)) + 2;
  const lngMin = Math.min(...allCoords.map((c) => c.lng)) - 3;
  const lngMax = Math.max(...allCoords.map((c) => c.lng)) + 3;

  function project(lat: number, lng: number): [number, number] {
    const x = margin + ((lng - lngMin) / (lngMax - lngMin)) * (width - 2 * margin);
    const y = margin + ((latMax - lat) / (latMax - latMin)) * (height - 2 * margin);
    return [x, y];
  }

  const filteredMigrations = selectedPerson
    ? data.migrations.filter((m) => m.person_id === selectedPerson)
    : data.migrations;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        {data.ungeocoded.length > 0 && (
          <button
            onClick={handleGeocode}
            disabled={geocoding}
            className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            {geocoding ? "geocoding..." : `geocode ${data.ungeocoded.length} places`}
          </button>
        )}
        {geocodeResult && (
          <span className="text-xs text-green-600">
            geocoded {geocodeResult.geocoded} of {geocodeResult.total} places
          </span>
        )}
        {data.migrations.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showMigrations}
              onChange={(e) => setShowMigrations(e.target.checked)}
              className="accent-primary"
            />
            show migration paths ({data.migrations.length})
          </label>
        )}
      </div>

      {showMigrations && data.migrations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedPerson(null)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
              !selectedPerson ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            all
          </button>
          {data.migrations.map((m, i) => (
            <button
              key={m.person_id}
              onClick={() => setSelectedPerson(m.person_id === selectedPerson ? null : m.person_id)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                m.person_id === selectedPerson
                  ? "text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              style={m.person_id === selectedPerson ? { backgroundColor: COLORS[i % COLORS.length] } : undefined}
            >
              {m.person_name}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ maxHeight: "500px" }}>
          <rect width={width} height={height} fill="var(--color-card, #fff)" />

          {/* migration paths */}
          {showMigrations &&
            filteredMigrations.map((m, mi) => {
              const color = COLORS[data.migrations.indexOf(m) % COLORS.length];
              const points = m.events.map((e) => project(e.lat, e.lng));
              if (points.length < 2) return null;
              const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
              return (
                <g key={m.person_id}>
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeDasharray="6 3"
                    opacity="0.7"
                  />
                  {/* arrowheads */}
                  {points.slice(1).map((p, i) => {
                    const prev = points[i];
                    const dx = p[0] - prev[0];
                    const dy = p[1] - prev[1];
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    return (
                      <polygon
                        key={i}
                        points="-5,-3 0,0 -5,3"
                        fill={color}
                        opacity="0.7"
                        transform={`translate(${p[0]},${p[1]}) rotate(${angle})`}
                      />
                    );
                  })}
                </g>
              );
            })}

          {/* place dots */}
          {data.places.map((place) => {
            const [x, y] = project(place.latitude, place.longitude);
            const r = Math.min(4 + place.event_count * 1.5, 12);
            return (
              <g key={place.id}>
                <circle cx={x} cy={y} r={r} fill="var(--color-primary, #3b82f6)" opacity="0.6" />
                <circle cx={x} cy={y} r={r} fill="none" stroke="var(--color-primary, #3b82f6)" strokeWidth="1" />
                <title>
                  {place.name} ({place.event_count} event{place.event_count === 1 ? "" : "s"})
                  {"\n"}
                  {place.persons?.filter(Boolean).join(", ")}
                </title>
                <text
                  x={x}
                  y={y - r - 3}
                  textAnchor="middle"
                  className="text-[9px] fill-muted-foreground"
                >
                  {place.name.length > 20 ? place.name.slice(0, 18) + "..." : place.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* place list */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          places ({data.places.length} geocoded{data.ungeocoded.length > 0 ? `, ${data.ungeocoded.length} pending` : ""})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {data.places.map((place) => (
            <div
              key={place.id}
              className="rounded-md border border-border p-2.5 text-sm space-y-1"
            >
              <div className="font-medium text-foreground">{place.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {place.event_count} event{place.event_count === 1 ? "" : "s"}
                {place.persons?.filter(Boolean).length > 0 && (
                  <> &middot; {place.persons.filter(Boolean).join(", ")}</>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
