// In-memory session store for demo mode (no Supabase needed).
// Works in Next.js dev server (single process). Not for production.

import type { CharacterKey } from './session';
import { generateVisitOrder } from './visitOrder';

interface DemoSession {
  id: string;
  created_at: string;
  expires_at: string;
  recipient_name: string | null;
  seed_phrase: string | null;
  seed_name: string | null;
  visit_order: CharacterKey[];
  visits: unknown[];
  image_seed: number;
  seed_image_url: string | null;
  round: number;
  paired_session_id: string | null;
}

const store = new Map<string, DemoSession>();

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function demoCreate(recipientName?: string): { id: string; visitOrder: CharacterKey[]; imageSeed: number } {
  const id = uuid();
  const visitOrder = generateVisitOrder();
  const imageSeed = Math.floor(Math.random() * 2147483647);
  const now = new Date().toISOString();
  store.set(id, {
    id,
    created_at: now,
    expires_at: now,
    recipient_name: recipientName ?? null,
    seed_phrase: null,
    seed_name: null,
    visit_order: visitOrder,
    visits: [],
    image_seed: imageSeed,
    seed_image_url: null,
    round: 1,
    paired_session_id: null,
  });
  return { id, visitOrder, imageSeed };
}

export function demoRead(id: string): DemoSession | null {
  return store.get(id) ?? null;
}

export function demoPatch(id: string, patch: Partial<DemoSession> & { visit?: unknown }) {
  const sess = store.get(id);
  if (!sess) return false;
  if (patch.seed_phrase !== undefined) sess.seed_phrase = patch.seed_phrase;
  if (patch.seed_image_url !== undefined) sess.seed_image_url = patch.seed_image_url;
  if (patch.seed_name !== undefined) sess.seed_name = patch.seed_name;
  if (patch.visit !== undefined) sess.visits.push(patch.visit);
  store.set(id, sess);
  return true;
}

export const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;
