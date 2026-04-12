import type { FuzzyDate } from "./db";

export type Sex = "M" | "F" | "X" | "U";

export type NameType = "birth" | "married" | "adopted" | "alias" | "nickname" | "other";

export type RelationshipType =
  | "biological_parent" | "adoptive_parent" | "foster_parent"
  | "step_parent" | "guardian" | "godparent"
  | "spouse" | "partner" | "ex_spouse" | "other";

export const PARENT_TYPES: RelationshipType[] = [
  "biological_parent", "adoptive_parent", "foster_parent", "step_parent", "guardian",
];

export type PersonName = {
  id: string;
  person_id: string;
  name_type: NameType;
  given_names: string | null;
  surname: string | null;
  prefix: string | null;
  suffix: string | null;
  display: string | null;
  is_primary: boolean;
  sort_order: number;
};

export type Person = {
  id: string;
  tree_id: string;
  sex: Sex | null;
  is_living: boolean;
  privacy_level: string;
  thumbnail_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  names: PersonName[];
  events: PersonEvent[];
};

export type PersonEvent = {
  id: string;
  person_id: string;
  event_type: string;
  date: FuzzyDate | null;
  sort_date: string | null;
  place_id: string | null;
  description: string | null;
  is_primary: boolean;
};

export type Relationship = {
  id: string;
  tree_id: string;
  person1_id: string;
  person2_id: string;
  relationship_type: RelationshipType;
  start_date: FuzzyDate | null;
  end_date: FuzzyDate | null;
  confidence: number | null;
  notes: string | null;
};

export type Place = {
  id: string;
  tree_id: string;
  parent_id: string | null;
  place_type: string | null;
  latitude: number | null;
  longitude: number | null;
  name: string; // current name from place_names
};

// sources & citations
export type SourceType = "census" | "vital_record" | "church" | "military" | "newspaper" | "book" | "online" | "photo" | "interview" | "other";
export type CitationConfidence = "primary" | "secondary" | "questionable" | "unreliable";

export type Source = {
  id: string;
  tree_id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  source_type: string | null;
  url: string | null;
  notes: string | null;
  created_at: string;
};

export type Citation = {
  id: string;
  source_id: string;
  event_id: string | null;
  page: string | null;
  confidence: CitationConfidence | null;
  extract: string | null;
  notes: string | null;
};

// tree sharing
export type TreeRole = "owner" | "editor" | "viewer";

export type TreeMember = {
  tree_id: string;
  member_email: string;
  role: TreeRole;
  created_at: string;
};

// color coding modes for pedigree chart
export type ColorMode = "sex" | "generation" | "surname" | "living" | "completeness";

// edge metadata for relationship-type-aware rendering
export type EdgeMeta = {
  targetId: string;
  type: RelationshipType;
  startDate?: string | null;
};

// for the pedigree chart — a person node with parent links
export type TreeNode = {
  id: string;
  displayName: string;
  surname: string | null;
  sex: Sex | null;
  birthYear: string | null;
  deathYear: string | null;
  thumbnailUrl: string | null;
  isLiving: boolean;
  parentIds: string[];
  spouseIds: string[];
  childIds: string[];
  /** metadata per parent edge (matches parentIds order) */
  parentEdges: EdgeMeta[];
  /** metadata per spouse edge (matches spouseIds order) */
  spouseEdges: EdgeMeta[];
};

// ---------------------------------------------------------------------------
// hints — suggested matches from external genealogy databases
// ---------------------------------------------------------------------------

export type HintStatus = "pending" | "accepted" | "rejected" | "expired";
export type HintSource = "familysearch" | "wikidata" | "familysearch_records" | "chronicling_america" | "nara" | "dpla";

export type Hint = {
  id: string;
  tree_id: string;
  person_id: string;
  source_system: HintSource;
  external_id: string;
  match_data: HintMatchData;
  confidence: number;
  status: HintStatus;
  evidence: HintEvidence | null;
  created_at: string;
  reviewed_at: string | null;
};

export type HintMatchData = {
  displayName: string;
  givenNames?: string;
  middleName?: string;
  surname?: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  sex?: string;
  sourceUrl?: string;
  /** for record-based hints: the type of record (birth, death, census, newspaper, etc.) */
  recordType?: string;
  /** for record-based hints: the collection or newspaper title */
  collectionTitle?: string;
  /** for record hints: the event/publication date (distinct from birthDate) */
  eventDate?: string;
  /** for record hints: the event/publication place */
  eventPlace?: string;
  /** for newspaper hints: OCR text snippet */
  snippet?: string;
  /** thumbnail or image URL for document/person preview */
  imageUrl?: string;
  relationships?: {
    type: string;
    name: string;
    externalId?: string;
  }[];
};

export type HintEvidence = {
  nameMatch: { score: number; details: string };
  dateMatch?: { score: number; details: string };
  placeMatch?: { score: number; details: string };
  familyMatch?: { score: number; details: string };
  overallConfidence: number;
};

// ---------------------------------------------------------------------------
// research tasks
// ---------------------------------------------------------------------------

export type TaskStatus = "todo" | "in_progress" | "done" | "dismissed";
export type TaskPriority = "high" | "medium" | "low";

export type ResearchTask = {
  id: string;
  tree_id: string;
  person_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  source: string | null;
  hint_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  person_name?: string;
};

// ---------------------------------------------------------------------------
// comments — collaborative discussion threads on persons, events, sources
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DNA / ethnicity — manual entry (all DNA APIs are paid)
// ---------------------------------------------------------------------------

export type DnaData = {
  ethnicity: Array<{ region: string; percentage: number }>;
  maternalHaplogroup?: string;
  paternalHaplogroup?: string;
  testProvider?: string;
  testDate?: string;
  notes?: string;
};

export type CommentTargetType = "person" | "event" | "source" | "relationship";

export type Comment = {
  id: string;
  tree_id: string;
  author_email: string;
  target_type: CommentTargetType;
  target_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  // joined
  replies?: Comment[];
};
