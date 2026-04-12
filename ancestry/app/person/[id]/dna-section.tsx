"use client";

import { useState, useTransition } from "react";
import { saveDnaDataAction } from "./dna-actions";
import type { DnaData } from "@/lib/types";

const COMMON_REGIONS = [
  "England & NW Europe", "Ireland & Scotland", "Germanic Europe", "Norway", "Sweden & Denmark",
  "France", "Iberian Peninsula", "Italy", "Greece & Balkans", "Eastern Europe & Russia",
  "Baltic States", "Finland", "European Jewish", "West Africa", "Cameroon & Congo",
  "Nigeria", "Benin & Togo", "Mali", "Senegal", "East Africa", "North Africa",
  "Middle East", "Central Asia", "South Asia", "East Asia", "Southeast Asia",
  "Japan", "Korea", "Philippines", "Polynesia", "Melanesia",
  "Indigenous Americas — North", "Indigenous Americas — Central", "Indigenous Americas — South",
];

const DONUT_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899",
  "#06b6d4", "#f97316", "#14b8a6", "#6366f1", "#84cc16", "#e11d48",
  "#0891b2", "#a855f7", "#d97706", "#059669",
];

function DonutChart({ data }: { data: Array<{ region: string; percentage: number }> }) {
  const size = 160;
  const center = size / 2;
  const radius = 60;
  const inner = 35;

  let startAngle = -Math.PI / 2;
  const paths = data
    .filter((d) => d.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage)
    .map((d, i) => {
      const angle = (d.percentage / 100) * Math.PI * 2;
      const endAngle = startAngle + angle;
      const largeArc = angle > Math.PI ? 1 : 0;

      const x1 = center + radius * Math.cos(startAngle);
      const y1 = center + radius * Math.sin(startAngle);
      const x2 = center + radius * Math.cos(endAngle);
      const y2 = center + radius * Math.sin(endAngle);
      const ix1 = center + inner * Math.cos(endAngle);
      const iy1 = center + inner * Math.sin(endAngle);
      const ix2 = center + inner * Math.cos(startAngle);
      const iy2 = center + inner * Math.sin(startAngle);

      const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${inner} ${inner} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;

      startAngle = endAngle;
      return { path, color: DONUT_COLORS[i % DONUT_COLORS.length], region: d.region, pct: d.percentage };
    });

  return (
    <div className="flex items-start gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {paths.map((p, i) => (
          <path key={i} d={p.path} fill={p.color} opacity="0.85">
            <title>{p.region}: {p.pct}%</title>
          </path>
        ))}
      </svg>
      <div className="space-y-1 text-xs min-w-0">
        {paths.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-foreground truncate">{p.region}</span>
            <span className="text-muted-foreground ml-auto shrink-0">{p.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DnaSection({ personId, initialData }: { personId: string; initialData: DnaData | null }) {
  const [editing, setEditing] = useState(false);
  const [saving, startSave] = useTransition();
  const [data, setData] = useState<DnaData>(
    initialData ?? { ethnicity: [], maternalHaplogroup: "", paternalHaplogroup: "", testProvider: "", notes: "" },
  );
  const [entries, setEntries] = useState<Array<{ region: string; percentage: string }>>(
    data.ethnicity.length > 0
      ? data.ethnicity.map((e) => ({ region: e.region, percentage: String(e.percentage) }))
      : [{ region: "", percentage: "" }],
  );

  function addRow() {
    setEntries([...entries, { region: "", percentage: "" }]);
  }

  function removeRow(i: number) {
    setEntries(entries.filter((_, idx) => idx !== i));
  }

  function handleSave() {
    const ethnicity = entries
      .filter((e) => e.region && e.percentage)
      .map((e) => ({ region: e.region, percentage: parseFloat(e.percentage) || 0 }));

    const newData: DnaData = {
      ethnicity,
      maternalHaplogroup: data.maternalHaplogroup || undefined,
      paternalHaplogroup: data.paternalHaplogroup || undefined,
      testProvider: data.testProvider || undefined,
      testDate: data.testDate || undefined,
      notes: data.notes || undefined,
    };

    startSave(async () => {
      await saveDnaDataAction(personId, newData);
      setData(newData);
      setEditing(false);
    });
  }

  const hasData = data.ethnicity.length > 0;

  if (!editing && !hasData) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
      >
        add DNA / ethnicity data
      </button>
    );
  }

  if (!editing && hasData) {
    return (
      <div className="space-y-3">
        <DonutChart data={data.ethnicity} />
        {(data.maternalHaplogroup || data.paternalHaplogroup) && (
          <div className="flex gap-4 text-xs">
            {data.maternalHaplogroup && (
              <span className="text-muted-foreground">maternal: <span className="text-foreground font-medium">{data.maternalHaplogroup}</span></span>
            )}
            {data.paternalHaplogroup && (
              <span className="text-muted-foreground">paternal: <span className="text-foreground font-medium">{data.paternalHaplogroup}</span></span>
            )}
          </div>
        )}
        {data.testProvider && (
          <div className="text-[10px] text-muted-foreground">
            tested with {data.testProvider}{data.testDate ? ` (${data.testDate})` : ""}
          </div>
        )}
        {data.notes && <p className="text-xs text-muted-foreground">{data.notes}</p>}
        <button
          onClick={() => setEditing(true)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          edit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="block text-xs text-muted-foreground">ethnicity estimates</label>
        {entries.map((entry, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select
              value={entry.region}
              onChange={(e) => {
                const next = [...entries];
                next[i] = { ...next[i], region: e.target.value };
                setEntries(next);
              }}
              className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              <option value="">select region...</option>
              {COMMON_REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={entry.percentage}
              onChange={(e) => {
                const next = [...entries];
                next[i] = { ...next[i], percentage: e.target.value };
                setEntries(next);
              }}
              placeholder="%"
              className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs text-right"
            />
            <button
              onClick={() => removeRow(i)}
              className="text-muted-foreground hover:text-red-500 text-xs transition-colors"
              title="remove"
            >
              x
            </button>
          </div>
        ))}
        <button onClick={addRow} className="text-[10px] text-primary hover:underline">
          + add region
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-muted-foreground mb-0.5">maternal haplogroup</label>
          <input
            value={data.maternalHaplogroup ?? ""}
            onChange={(e) => setData({ ...data, maternalHaplogroup: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
            placeholder="e.g. H1a"
          />
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground mb-0.5">paternal haplogroup</label>
          <input
            value={data.paternalHaplogroup ?? ""}
            onChange={(e) => setData({ ...data, paternalHaplogroup: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
            placeholder="e.g. R1b-L21"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-muted-foreground mb-0.5">test provider</label>
          <select
            value={data.testProvider ?? ""}
            onChange={(e) => setData({ ...data, testProvider: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="">select...</option>
            <option value="AncestryDNA">AncestryDNA</option>
            <option value="23andMe">23andMe</option>
            <option value="MyHeritage">MyHeritage</option>
            <option value="FamilyTreeDNA">FamilyTreeDNA</option>
            <option value="LivingDNA">LivingDNA</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground mb-0.5">test date</label>
          <input
            type="date"
            value={data.testDate ?? ""}
            onChange={(e) => setData({ ...data, testDate: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-muted-foreground mb-0.5">notes</label>
        <textarea
          value={data.notes ?? ""}
          onChange={(e) => setData({ ...data, notes: e.target.value })}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          placeholder="additional notes about DNA results..."
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "saving..." : "save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
