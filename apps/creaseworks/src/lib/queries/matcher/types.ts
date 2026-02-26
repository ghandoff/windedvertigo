/**
 * Types for matcher algorithm.
 */

export interface MatcherInput {
  materials: string[];   // material UUIDs the user has on hand
  forms: string[];       // required form values they can provide
  slots: string[];       // optional slot tags
  contexts: string[];    // context constraint tags
  energyLevels?: string[];  // optional energy level filters ("calm", "moderate", "active")
}

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

export interface RankedPlaydate {
  playdateId: string;
  slug: string;
  title: string;
  headline: string | null;
  score: number;
  primaryFunction: string | null;
  arcEmphasis: string[];
  frictionDial: number | null;
  energyLevel: string | null;  // computed energy level label
  startIn120s: boolean;
  coverage: CoverageDetail;
  substitutionsNotes: string | null;
  hasFindAgain: boolean;
  findAgainMode: string | null;
  isEntitled: boolean;
  packSlugs: string[];
}

export interface MatcherResult {
  ranked: RankedPlaydate[];
  meta: {
    contextFiltersApplied: string[];
    energyLevelFiltersApplied?: string[];
    totalCandidates: number;
    totalAfterFilter: number;
  };
}

export interface CandidateRow {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  primary_function: string | null;
  arc_emphasis: string[];
  context_tags: string[];
  friction_dial: number | null;
  start_in_120s: boolean;
  required_forms: string[];
  slots_optional: string[];
  find_again_mode: string | null;
  substitutions_notes: string | null;
  // joined material fields (null when playdate has no materials)
  material_id: string | null;
  material_title: string | null;
  material_form_primary: string | null;
}

export interface PlaydateCandidate {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  primaryFunction: string | null;
  arcEmphasis: string[];
  contextTags: string[];
  frictionDial: number | null;
  energyLevel: string | null;  // computed from friction_dial
  startIn120s: boolean;
  requiredForms: string[];
  slotsOptional: string[];
  findAgainMode: string | null;
  substitutionsNotes: string | null;
  materials: { id: string; title: string; formPrimary: string }[];
}

export interface SessionSlice {
  orgId: string | null;
}
