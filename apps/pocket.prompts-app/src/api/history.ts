// history API client — calls GET /api/history
// Returns paginated voice log from Notion

const API_BASE = 'https://pocket-prompts-five.vercel.app';

export interface HistoryEntry {
  id: string;
  timestamp: string;
  created_time: string;
  utterance: string | null;       // sanitized: "intent — user_id" (privacy)
  intent: string | null;
  confidence: number | null;
  action_taken: string | null;
  priority: string | null;
  entry_url: string | null;
  user_id: string | null;
  error: string | null;
  duration_ms: number | null;
  platform: string | null;
}

export interface HistoryResponse {
  entries: HistoryEntry[];
  has_more: boolean;
  next_cursor: string | null;
}

export async function get_history(
  user_id?: string,
  cursor?: string,
  limit = 30,
): Promise<HistoryResponse> {
  const params = new URLSearchParams();
  if (user_id) params.set('user', user_id);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));

  const res = await fetch(`${API_BASE}/api/history?${params}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`history api error (${res.status})`);
  }

  return res.json();
}
