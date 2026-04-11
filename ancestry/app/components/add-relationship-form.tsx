"use client";

import { useRef, useState } from "react";
import { addRelationship } from "../actions";
import type { Person, RelationshipType } from "@/lib/types";

type RelOption = {
  value: RelationshipType;
  label: string;
  group: "parents" | "partners" | "other";
  helperText: string;
};

const RELATIONSHIP_OPTIONS: RelOption[] = [
  // parents
  { value: "biological_parent", label: "biological parent (mother/father)", group: "parents", helperText: "person 1 is the biological parent of person 2" },
  { value: "adoptive_parent", label: "adoptive parent", group: "parents", helperText: "person 1 is the adoptive parent of person 2" },
  { value: "step_parent", label: "step-parent", group: "parents", helperText: "person 1 is the step-parent of person 2" },
  { value: "foster_parent", label: "foster parent", group: "parents", helperText: "person 1 is the foster parent of person 2" },
  { value: "guardian", label: "guardian", group: "parents", helperText: "person 1 is the legal guardian of person 2" },
  { value: "godparent", label: "godparent", group: "parents", helperText: "person 1 is the godparent of person 2" },
  // partners
  { value: "spouse", label: "spouse (married)", group: "partners", helperText: "person 1 and person 2 are married" },
  { value: "partner", label: "partner (unmarried)", group: "partners", helperText: "person 1 and person 2 are partners" },
  { value: "ex_spouse", label: "ex-spouse (divorced)", group: "partners", helperText: "person 1 and person 2 were previously married" },
  // other
  { value: "other", label: "other relationship", group: "other", helperText: "a custom relationship between person 1 and person 2" },
];

const GROUPS: { key: RelOption["group"]; label: string }[] = [
  { key: "parents", label: "parents & guardians" },
  { key: "partners", label: "partners & spouses" },
  { key: "other", label: "other" },
];

function getDisplayName(p: Person): string {
  const primary = p.names.find((n) => n.is_primary) ?? p.names[0];
  return primary?.display ?? [primary?.given_names, primary?.surname].filter(Boolean).join(" ") ?? "unnamed";
}

export function AddRelationshipForm({ persons }: { persons: Person[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [selectedType, setSelectedType] = useState<RelationshipType>("biological_parent");
  const [person1Id, setPerson1Id] = useState("");
  const [person2Id, setPerson2Id] = useState("");

  const selectedOption = RELATIONSHIP_OPTIONS.find((o) => o.value === selectedType);
  const isDirectional = selectedOption?.group === "parents" || selectedOption?.group === "other";

  // build contextual helper text with actual names
  const p1Name = persons.find((p) => p.id === person1Id);
  const p2Name = persons.find((p) => p.id === person2Id);
  const p1Label = p1Name ? getDisplayName(p1Name) : "person 1";
  const p2Label = p2Name ? getDisplayName(p2Name) : "person 2";

  function getContextualHelper(): string {
    if (!selectedOption) return "";
    return selectedOption.helperText
      .replace("person 1", p1Label)
      .replace("person 2", p2Label);
  }

  async function handleSubmit(formData: FormData) {
    await addRelationship(formData);
    formRef.current?.reset();
    setExpanded(false);
    setSelectedType("biological_parent");
    setPerson1Id("");
    setPerson2Id("");
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        {expanded ? "cancel" : "+ add relationship"}
      </button>

      {expanded && (
        <form ref={formRef} action={handleSubmit} className="space-y-3 rounded-lg border border-border p-3">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">
              {isDirectional ? "person 1 (the parent/guardian)" : "person 1"}
            </span>
            <select
              name="person1Id"
              required
              value={person1Id}
              onChange={(e) => setPerson1Id(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="">select...</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>{getDisplayName(p)}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">relationship</span>
            <select
              name="relationshipType"
              required
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as RelationshipType)}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
            >
              {GROUPS.map((group) => (
                <optgroup key={group.key} label={group.label}>
                  {RELATIONSHIP_OPTIONS.filter((o) => o.group === group.key).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">
              {isDirectional ? "person 2 (the child)" : "person 2"}
            </span>
            <select
              name="person2Id"
              required
              value={person2Id}
              onChange={(e) => setPerson2Id(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="">select...</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>{getDisplayName(p)}</option>
              ))}
            </select>
          </label>

          {/* contextual helper text */}
          {selectedOption && (
            <div className="rounded-md bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
              {isDirectional && (
                <div className="flex items-center gap-1 mb-1">
                  <svg width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
                    <path d="M2 6h8M7 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="font-medium">directional — order matters</span>
                </div>
              )}
              <span>{getContextualHelper()}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            save relationship
          </button>
        </form>
      )}
    </div>
  );
}
