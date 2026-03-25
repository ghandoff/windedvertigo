"use client";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { AudienceFilter } from "@/lib/notion/types";

interface AudienceBuilderInlineProps {
  value: AudienceFilter;
  onChange: (filters: AudienceFilter) => void;
}

const PRIORITY_OPTIONS = ["Tier 1 – Pursue now", "Tier 2 – Warm up", "Tier 3 – Monitor"];
const FIT_OPTIONS = ["🔥 Perfect fit", "✅ Strong fit", "🟡 Moderate fit"];
const FRIENDSHIP_OPTIONS = ["Inner circle", "Warm friend", "Friendly contact", "Loose tie", "Known-of / name in common", "Stranger"];
const OUTREACH_OPTIONS = ["Not started", "Researching", "Contacted", "In conversation", "Proposal sent", "Active client"];
const CONNECTION_OPTIONS = ["unengaged", "exploring", "in progress", "collaborating", "champion", "steward", "past client"];
const QUADRANT_OPTIONS = ["Design + Deploy", "Pinpoint + Prove", "Build + Iterate", "Test + Validate"];
const TYPE_OPTIONS = ["ngo", "studio", "corporate", "non-profit", "foundation", "government", "individual donor", "consultancy/firm", "academic institution"];
const SOURCE_OPTIONS = ["cold research", "conference", "direct network", "partner referral", "rfp platform", "internal"];

interface FilterRowProps {
  label: string;
  paramKey: keyof AudienceFilter;
  options: string[];
  value: AudienceFilter;
  onChange: (filters: AudienceFilter) => void;
}

function FilterRow({ label, paramKey, options, value, onChange }: FilterRowProps) {
  const current = (value[paramKey] as string) ?? "";

  function handleChange(v: string | null) {
    const next = { ...value };
    if (v && v !== "__all__") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next as any)[paramKey] = v;
    } else {
      delete next[paramKey];
    }
    onChange(next);
  }

  return (
    <div>
      <span className="text-[10px] text-muted-foreground mb-0.5 block">{label}</span>
      <Select value={current || "__all__"} onValueChange={handleChange}>
        <SelectTrigger className="h-8 text-xs">
          <span className={`flex flex-1 text-left truncate ${!current ? "text-muted-foreground" : ""}`}>
            {current || `all ${label}`}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">all {label}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AudienceBuilderInline({ value, onChange }: AudienceBuilderInlineProps) {
  const activeCount = Object.keys(value).filter((k) => value[k as keyof AudienceFilter]).length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        select filters to target specific organizations.{" "}
        {activeCount > 0 && <span className="font-medium text-foreground">{activeCount} filter{activeCount > 1 ? "s" : ""} active</span>}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <FilterRow label="priority" paramKey="priority" options={PRIORITY_OPTIONS} value={value} onChange={onChange} />
        <FilterRow label="fit" paramKey="fitRating" options={FIT_OPTIONS} value={value} onChange={onChange} />
        <FilterRow label="friendship" paramKey="friendship" options={FRIENDSHIP_OPTIONS} value={value} onChange={onChange} />
        <FilterRow label="outreach" paramKey="outreachStatus" options={OUTREACH_OPTIONS} value={value} onChange={onChange} />
        <FilterRow label="connection" paramKey="connection" options={CONNECTION_OPTIONS} value={value} onChange={onChange} />
        <FilterRow label="quadrant" paramKey="quadrant" options={QUADRANT_OPTIONS} value={value} onChange={onChange} />
        <FilterRow label="type" paramKey="type" options={TYPE_OPTIONS} value={value} onChange={onChange} />
        <FilterRow label="source" paramKey="source" options={SOURCE_OPTIONS} value={value} onChange={onChange} />
      </div>
    </div>
  );
}
