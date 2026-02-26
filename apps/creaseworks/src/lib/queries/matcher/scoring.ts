/**
 * Scoring logic for the matcher algorithm.
 */

import { PlaydateCandidate } from "./types";

interface CoverageDetail {
  materialsCovered: { id: string; title: string }[];
  materialsMissing: { id: string; title: string; formPrimary: string }[];
  formsCovered: string[];
  formsMissing: string[];
  suggestedSubstitutions: {
    missingMaterial: string;
    availableAlternatives: { id: string; title: string }[];
  }[];
}

export function scorePlaydate(
  playdate: PlaydateCandidate,
  userMaterialIds: Set<string>,
  userForms: Set<string>,
  userSlots: Set<string>,
): { score: number; coverage: CoverageDetail } {
  // --- materials coverage (0–45) ---
  const materialsCovered: { id: string; title: string }[] = [];
  const materialsMissing: { id: string; title: string; formPrimary: string }[] = [];

  for (const mat of playdate.materials) {
    if (userMaterialIds.has(mat.id)) {
      materialsCovered.push({ id: mat.id, title: mat.title });
    } else {
      materialsMissing.push({ id: mat.id, title: mat.title, formPrimary: mat.formPrimary });
    }
  }

  const materialsRatio =
    playdate.materials.length === 0
      ? 1.0
      : materialsCovered.length / playdate.materials.length;
  const materialsScore = materialsRatio * 45;

  // --- forms coverage (0–30) ---
  const formsCovered: string[] = [];
  const formsMissing: string[] = [];

  for (const form of playdate.requiredForms) {
    if (userForms.has(form)) {
      formsCovered.push(form);
    } else {
      formsMissing.push(form);
    }
  }

  const formsRatio =
    playdate.requiredForms.length === 0
      ? 1.0
      : formsCovered.length / playdate.requiredForms.length;
  const formsScore = formsRatio * 30;

  // --- slots match bonus (0–10) ---
  let slotsScore: number;
  if (userSlots.size === 0) {
    slotsScore = 10; // no preference = no penalty
  } else {
    const slotsOverlap = playdate.slotsOptional.filter((s) => userSlots.has(s));
    const slotDenom = Math.max(playdate.slotsOptional.length, 1);
    slotsScore = (slotsOverlap.length / slotDenom) * 10;
  }

  // --- quick-start bonus (0–10) ---
  const quickStartScore = playdate.startIn120s ? 10 : 0;

  // --- friction penalty (0–5 deduction) ---
  const frictionPenalty = playdate.frictionDial ? playdate.frictionDial - 1 : 0;

  const score = Math.round(
    materialsScore + formsScore + slotsScore + quickStartScore - frictionPenalty,
  );

  // --- substitution suggestions ---
  // for each missing material, find user materials with the same form_primary
  const suggestedSubstitutions: CoverageDetail["suggestedSubstitutions"] = [];
  // (filled in by the caller who has access to the user's full material list)

  return {
    score: Math.max(0, Math.min(100, score)),
    coverage: {
      materialsCovered,
      materialsMissing,
      formsCovered,
      formsMissing,
      suggestedSubstitutions,
    },
  };
}
