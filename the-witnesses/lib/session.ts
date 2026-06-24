export type CharacterKey =
  | "builder"
  | "explorer"
  | "ripple"
  | "ghost"
  | "timeTraveler"
  | "trickster";

export interface Visit {
  character: CharacterKey;
  arrivalLineIndex: number; // 0-2, randomly selected
  playerText: string;
  secondText?: string; // Ripple's second field
  feltSense: string;
  objectChoice?: "lamp" | "blanket" | "mug"; // Explorer
  erasedElement?: string; // Ghost
  imageUrl?: string; // AI generated image after this visit
}

export interface GameSession {
  id: string;
  recipientName?: string;
  seedPhrase: string;
  seedName?: string;
  visitOrder: CharacterKey[];
  visits: Visit[];
  imageSeed: number;
  seedImageUrl?: string;
  round: number;
}

export type GameScreen =
  | "arrival"
  | "letter"
  | "permissions"
  | "seed"
  | "visit"
  | "seed-naming"
  | "postcard";

export interface DbSession {
  id: string;
  created_at: string;
  expires_at: string;
  recipient_name: string | null;
  seed_phrase: string | null;
  seed_name: string | null;
  visit_order: string[] | null;
  visits: Visit[];
  image_seed: number | null;
  seed_image_url: string | null;
  round: number;
  paired_session_id: string | null;
}

export function dbSessionToGameSession(db: DbSession): GameSession {
  return {
    id: db.id,
    recipientName: db.recipient_name ?? undefined,
    seedPhrase: db.seed_phrase ?? "",
    seedName: db.seed_name ?? undefined,
    visitOrder: (db.visit_order as CharacterKey[]) ?? [],
    visits: db.visits ?? [],
    imageSeed: db.image_seed ?? 0,
    seedImageUrl: db.seed_image_url ?? undefined,
    round: db.round ?? 1,
  };
}
