import { neon } from "@neondatabase/serverless";

/* ── shared state shape ───────────────────────────────────────── */

export interface ProwlState {
  screen: number;
  arriveBegun: boolean;
  gatherWords: { text: string; x: number; y: number }[];
  oraclePhase: "intro" | "countdown" | "spotlight";
  countdownStart: number | null;
  oracleReadings: string[];
  knockTimes: number[];
  deckIndex: number;
  cardFlipped: boolean;
  breathHeld: number;
  stonesPlaced: number[];
  driftLanterns: { text: string; x: number; id: number }[];
  driftFinal: boolean;
}

const INITIAL_STATE: ProwlState = {
  screen: 0,
  arriveBegun: false,
  gatherWords: [],
  oraclePhase: "intro",
  countdownStart: null,
  oracleReadings: [],
  knockTimes: [],
  deckIndex: -1,
  cardFlipped: false,
  breathHeld: 0,
  stonesPlaced: [],
  driftLanterns: [],
  driftFinal: false,
};

/* ── in-memory fallback (when POSTGRES_URL is not set) ────────── */

let memoryState: ProwlState = { ...INITIAL_STATE };

const useNeon = () => !!process.env.POSTGRES_URL;

function sql() {
  return neon(process.env.POSTGRES_URL!);
}

/* ── database helpers ─────────────────────────────────────────── */

export async function ensureTable() {
  if (!useNeon()) return;
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS prowl_state (
      id TEXT PRIMARY KEY DEFAULT 'session',
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await db`
    INSERT INTO prowl_state (id, state)
    VALUES ('session', ${JSON.stringify(INITIAL_STATE)}::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function getState(): Promise<ProwlState> {
  if (!useNeon()) return { ...memoryState };

  const db = sql();
  const rows = await db`
    SELECT state FROM prowl_state WHERE id = 'session'
  `;
  if (rows.length === 0) {
    await ensureTable();
    return { ...INITIAL_STATE };
  }
  return rows[0].state as ProwlState;
}

export async function updateState(
  mutate: (current: ProwlState) => ProwlState
): Promise<ProwlState> {
  if (!useNeon()) {
    memoryState = mutate(memoryState);
    return { ...memoryState };
  }

  const db = sql();
  const rows = await db`
    SELECT state FROM prowl_state WHERE id = 'session'
  `;
  const current = rows.length > 0
    ? (rows[0].state as ProwlState)
    : { ...INITIAL_STATE };

  const next = mutate(current);
  await db`
    UPDATE prowl_state
    SET state = ${JSON.stringify(next)}::jsonb, updated_at = NOW()
    WHERE id = 'session'
  `;
  return next;
}

export async function resetState(): Promise<ProwlState> {
  if (!useNeon()) {
    memoryState = { ...INITIAL_STATE };
    return { ...memoryState };
  }

  const db = sql();
  const fresh = { ...INITIAL_STATE };
  await db`
    UPDATE prowl_state
    SET state = ${JSON.stringify(fresh)}::jsonb, updated_at = NOW()
    WHERE id = 'session'
  `;
  return fresh;
}
