/**
 * Shared constants for the /events page and its view components.
 * Extracted from campaigns/page.tsx (Phase 10 migration).
 */

export const EVENT_TYPE_OPTIONS = [
  "Conference", "Summit", "Trade Show", "Academic Conference",
  "Awards / Ceremony", "Network Event",
] as const;

export const TEAM_OPTIONS = ["Garrett", "María", "Jamie", "Lamis", "Yigal"] as const;

export const EVENT_STATUS_OPTIONS = [
  "candidate", "watch", "attend", "pursue", "not_relevant",
] as const;

export const VIEWS = [
  { key: "calendar",   label: "calendar" },
  { key: "gallery",    label: "gallery" },
  { key: "countdown",  label: "countdown" },
  { key: "table",      label: "table" },
] as const satisfies readonly { key: string; label: string }[];

export type EventView = typeof VIEWS[number]["key"];
