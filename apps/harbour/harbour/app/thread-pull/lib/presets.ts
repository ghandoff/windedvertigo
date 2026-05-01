/** common HCA labels drawn from the research paper (Galpin, UCL) */
export const PRESET_HCAS = [
  { label: "busy places", emoji: "🏙️" },
  { label: "unfamiliar people", emoji: "👤" },
  { label: "waiting", emoji: "⏳" },
  { label: "transitions or changes", emoji: "🔄" },
  { label: "clothing or textures", emoji: "👕" },
  { label: "food and drink", emoji: "🍎" },
  { label: "loud noises", emoji: "🔊" },
  { label: "routine changes", emoji: "📅" },
  { label: "being asked to do something", emoji: "📋" },
  { label: "personal space", emoji: "🫧" },
  { label: "not feeling well", emoji: "🤒" },
  { label: "not being understood", emoji: "💬" },
  { label: "leaving a parent or carer", emoji: "👋" },
  { label: "feeling pressure to choose", emoji: "🤔" },
] as const;

export type PresetHCA = (typeof PRESET_HCAS)[number];
