"use client";

import { useState, useRef, useMemo } from "react";
import { Material, MatcherResult } from "./types";

export function useMatcherState(materials: Material[]) {
  // selection state
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(
    new Set(),
  );
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set());
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [selectedContexts, setSelectedContexts] = useState<Set<string>>(
    new Set(),
  );

  // search filter for materials
  const [materialSearch, setMaterialSearch] = useState("");

  // mobile: track which material form-groups are expanded
  const [expandedFormGroups, setExpandedFormGroups] = useState<Set<string>>(
    new Set(),
  );

  // submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MatcherResult | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  // group materials by form_primary
  const materialsByForm = useMemo(() => {
    const groups = new Map<string, Material[]>();
    for (const mat of materials) {
      const form = mat.form_primary || "other";
      const list = groups.get(form) ?? [];
      list.push(mat);
      groups.set(form, list);
    }
    return groups;
  }, [materials]);

  // filter materials by search term
  const filteredMaterialsByForm = useMemo(() => {
    if (!materialSearch.trim()) return materialsByForm;
    const query = materialSearch.toLowerCase();
    const filtered = new Map<string, Material[]>();
    for (const [form, mats] of materialsByForm) {
      const matching = mats.filter(
        (m: Material) =>
          m.title.toLowerCase().includes(query) ||
          form.toLowerCase().includes(query),
      );
      if (matching.length > 0) filtered.set(form, matching);
    }
    return filtered;
  }, [materialsByForm, materialSearch]);

  const hasSelection =
    selectedMaterials.size > 0 ||
    selectedForms.size > 0 ||
    selectedSlots.size > 0 ||
    selectedContexts.size > 0;

  const totalSelections =
    selectedMaterials.size +
    selectedForms.size +
    selectedSlots.size +
    selectedContexts.size;

  // toggle helpers
  function toggleSet(
    set: Set<string>,
    setter: (s: Set<string>) => void,
    value: string,
  ) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  function toggleFormGroup(form: string) {
    const next = new Set(expandedFormGroups);
    if (next.has(form)) next.delete(form);
    else next.add(form);
    setExpandedFormGroups(next);
  }

  async function handleSubmit() {
    if (!hasSelection) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/matcher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materials: Array.from(selectedMaterials),
          forms: Array.from(selectedForms),
          slots: Array.from(selectedSlots),
          contexts: Array.from(selectedContexts),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `request failed (${res.status})`);
      }

      const data: MatcherResult = await res.json();
      setResults(data);

      // scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      setError(err.message || "something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setSelectedMaterials(new Set());
    setSelectedForms(new Set());
    setSelectedSlots(new Set());
    setSelectedContexts(new Set());
    setMaterialSearch("");
    setExpandedFormGroups(new Set());
    setResults(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // resolve material titles for the selection summary
  const materialTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const mat of materials) map.set(mat.id, mat.title);
    return map;
  }, [materials]);

  return {
    selectedMaterials,
    setSelectedMaterials,
    selectedForms,
    setSelectedForms,
    selectedSlots,
    setSelectedSlots,
    selectedContexts,
    setSelectedContexts,
    materialSearch,
    setMaterialSearch,
    expandedFormGroups,
    setExpandedFormGroups,
    loading,
    setLoading,
    error,
    setError,
    results,
    setResults,
    resultsRef,
    materialsByForm,
    filteredMaterialsByForm,
    hasSelection,
    totalSelections,
    toggleSet,
    toggleFormGroup,
    handleSubmit,
    handleClear,
    materialTitleMap,
  };
}
