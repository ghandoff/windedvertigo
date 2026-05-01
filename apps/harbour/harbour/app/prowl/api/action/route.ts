import { NextRequest, NextResponse } from "next/server";
import { updateState, resetState, ensureTable, type ProwlState } from "../../lib/prowl-db";

let tableReady = false;

const STONE_COUNT = 6;
const KNOCK_WINDOW_MS = 3000;
const KNOCK_THRESHOLD = 5;
const BREATH_THRESHOLD_MS = 30000;

export async function POST(req: NextRequest) {
  if (!tableReady) {
    await ensureTable();
    tableReady = true;
  }

  const body = await req.json();
  const { action, payload } = body as {
    action: string;
    payload?: Record<string, unknown>;
  };

  let state: ProwlState;

  switch (action) {
    /* ── session control ── */
    case "reset":
      state = await resetState();
      break;

    case "begin":
      state = await updateState((s) => ({ ...s, arriveBegun: true }));
      break;

    case "advance":
      state = await updateState((s) => ({
        ...s,
        screen: Math.min(s.screen + 1, 8),
      }));
      break;

    case "set_screen": {
      const screen = Number(payload?.screen ?? -1);
      if (screen < 0 || screen > 8)
        return NextResponse.json({ error: "invalid screen" }, { status: 400 });
      state = await updateState((s) => ({ ...s, screen }));
      break;
    }

    /* ── gate 1: gathering ── */
    case "add_word": {
      const text = String(payload?.text ?? "").trim().toLowerCase();
      if (!text) return NextResponse.json({ error: "empty word" }, { status: 400 });
      state = await updateState((s) => {
        const words = [
          ...s.gatherWords,
          {
            text,
            x: 15 + Math.random() * 70,
            y: 15 + Math.random() * 60,
          },
        ];
        return {
          ...s,
          gatherWords: words,
          // auto-advance when 5+ words
          screen: words.length >= 5 && s.screen === 1 ? s.screen : s.screen,
        };
      });
      break;
    }

    /* ── screen 2: oracle ── */
    case "start_countdown":
      state = await updateState((s) => ({
        ...s,
        oraclePhase: "countdown" as const,
        countdownStart: Date.now(),
      }));
      break;

    case "end_countdown":
      state = await updateState((s) => ({
        ...s,
        oraclePhase: "spotlight" as const,
      }));
      break;

    case "add_reading": {
      const text = String(payload?.text ?? "").trim();
      if (!text) return NextResponse.json({ error: "empty reading" }, { status: 400 });
      state = await updateState((s) => ({
        ...s,
        oracleReadings: [...s.oracleReadings, text],
      }));
      break;
    }

    /* ── gate 3: knock ── */
    case "knock": {
      const now = Date.now();
      state = await updateState((s) => {
        const recent = [...s.knockTimes, now].filter(
          (t) => now - t < KNOCK_WINDOW_MS
        );
        const unlocked = recent.length >= KNOCK_THRESHOLD;
        return {
          ...s,
          knockTimes: recent,
          screen: unlocked && s.screen === 3 ? 4 : s.screen,
        };
      });
      break;
    }

    /* ── screen 4: deep deck ── */
    case "pull_card":
      state = await updateState((s) => ({
        ...s,
        deckIndex: s.deckIndex + 1 >= 8 ? 0 : s.deckIndex + 1,
        cardFlipped: true,
      }));
      break;

    case "flip_card":
      state = await updateState((s) => ({
        ...s,
        cardFlipped: !s.cardFlipped,
      }));
      break;

    /* ── gate 5: breath ── */
    case "add_breath": {
      const ms = Number(payload?.ms ?? 0);
      if (ms <= 0) return NextResponse.json({ error: "invalid ms" }, { status: 400 });
      state = await updateState((s) => {
        const total = Math.min(s.breathHeld + ms, BREATH_THRESHOLD_MS);
        return {
          ...s,
          breathHeld: total,
          screen:
            total >= BREATH_THRESHOLD_MS && s.screen === 5 ? 6 : s.screen,
        };
      });
      break;
    }

    /* ── gate 7: cairn ── */
    case "place_stone": {
      const idx = Number(payload?.index ?? -1);
      if (idx < 0 || idx >= STONE_COUNT)
        return NextResponse.json({ error: "invalid stone" }, { status: 400 });
      state = await updateState((s) => {
        if (s.stonesPlaced.includes(idx)) return s;
        const placed = [...s.stonesPlaced, idx];
        return {
          ...s,
          stonesPlaced: placed,
        };
      });
      break;
    }

    /* ── screen 8: drift ── */
    case "add_lantern": {
      const text = String(payload?.text ?? "").trim();
      if (!text) return NextResponse.json({ error: "empty lantern" }, { status: 400 });
      state = await updateState((s) => ({
        ...s,
        driftLanterns: [
          ...s.driftLanterns,
          { text, x: 20 + Math.random() * 60, id: Date.now() },
        ],
      }));
      break;
    }

    case "trigger_final":
      state = await updateState((s) => ({ ...s, driftFinal: true }));
      break;

    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  return NextResponse.json(state);
}
