export interface Material {
  id: string;
  title: string;
  form_primary: string;
  emoji?: string | null;
  icon?: string | null;
  functions?: string[] | null;
}

export interface MatcherInputFormProps {
  materials: Material[];
  forms: string[];
  slots: string[];
  contexts: string[];
  /**
   * Material IDs to seed the selection with on mount. Used when the user
   * arrives from the landing MaterialPickerHero, which ships a preselected
   * list via ?materials=<csv>. Applied once on mount — later prop changes
   * won't overwrite user edits.
   */
  preselectedMaterialIds?: string[];
}

export interface MatcherResult {
  ranked: any[];
  meta: {
    contextFiltersApplied: string[];
    totalCandidates: number;
    totalAfterFilter: number;
  };
}
