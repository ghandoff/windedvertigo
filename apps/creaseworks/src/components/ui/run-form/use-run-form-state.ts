"use client";

import { useState } from "react";
import {
  createEmptyEvidenceState,
  type EvidenceCaptureState,
} from "../evidence-capture-section";

export function useRunFormState(initialPlaydateId: string = "") {
  // Required fields
  const [title, setTitle] = useState("");
  const [runType, setRunType] = useState("");
  const [runDate, setRunDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Optional fields
  const [playdateId, setPlaydateId] = useState(initialPlaydateId);
  const [contextTags, setContextTags] = useState<string[]>([]);
  const [traceEvidence, setTraceEvidence] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [whatChanged, setWhatChanged] = useState("");
  const [nextIteration, setNextIteration] = useState("");
  const [isFindAgain, setIsFindAgain] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");

  // Evidence capture state (practitioner tier)
  const [evidenceState, setEvidenceState] = useState<EvidenceCaptureState>(
    createEmptyEvidenceState,
  );

  // UI state
  const [loading, setLoading] = useState(false);
  const [savingEvidence, setSavingEvidence] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(tag: string, list: string[], setter: (v: string[]) => void) {
    setter(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  }

  return {
    // Required fields
    title,
    setTitle,
    runType,
    setRunType,
    runDate,
    setRunDate,
    // Optional fields
    playdateId,
    setPlaydateId,
    contextTags,
    setContextTags,
    traceEvidence,
    setTraceEvidence,
    selectedMaterials,
    setSelectedMaterials,
    whatChanged,
    setWhatChanged,
    nextIteration,
    setNextIteration,
    isFindAgain,
    setIsFindAgain,
    showOptional,
    setShowOptional,
    materialSearch,
    setMaterialSearch,
    // Evidence state
    evidenceState,
    setEvidenceState,
    // UI state
    loading,
    setLoading,
    savingEvidence,
    setSavingEvidence,
    error,
    setError,
    // Helpers
    toggleTag,
  };
}

export type RunFormState = ReturnType<typeof useRunFormState>;
