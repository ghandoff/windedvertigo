"use client";

import { apiPath } from "./paths";

const STORAGE_KEY = "rcb:participant";

type Stored = { code: string; participant_id: string };

export function readParticipantId(code: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.code !== code) return null;
    return parsed.participant_id;
  } catch {
    return null;
  }
}

export function writeParticipant(code: string, participantId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ code, participant_id: participantId }),
  );
}

export function clearParticipant(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export async function ensureJoined(code: string): Promise<string | null> {
  const existing = readParticipantId(code);
  if (existing) return existing;
  try {
    const res = await fetch(apiPath(`/api/rooms/${code}/join`), { method: "POST" });
    if (!res.ok) return null;
    const { participant_id } = (await res.json()) as { participant_id: string };
    writeParticipant(code, participant_id);
    return participant_id;
  } catch {
    return null;
  }
}
