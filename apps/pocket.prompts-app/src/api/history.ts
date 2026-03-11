// history API client — calls GET /api/history

const API_BASE = 'https://pocket-prompts-five.vercel.app';

export interface HistoryEntry {
  id: string;
  utterance: string;
  intent: string;
  action_taken: string;
  spoken_response: string;
  timestamp: string;
  user_id: string;
  duration_ms?: number;
  entry_url?: string;
}

export async function get_history(user_id?: string): Promise<HistoryEntry[]> {
  const params = new URLSearchParams();
  if (user_id) params.set('user_id', user_id);

  const res = await fetch(`${API_BASE}/api/history?${params}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`history api error (${res.status})`);
  }

  return res.json();
}
