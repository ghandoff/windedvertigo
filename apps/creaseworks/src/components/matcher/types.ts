export interface Material {
  id: string;
  title: string;
  form_primary: string;
}

export interface MatcherInputFormProps {
  materials: Material[];
  forms: string[];
  slots: string[];
  contexts: string[];
}

export interface MatcherResult {
  ranked: any[];
  meta: {
    contextFiltersApplied: string[];
    totalCandidates: number;
    totalAfterFilter: number;
  };
}
