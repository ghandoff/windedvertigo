// voice API client — calls the existing POST /api/voice endpoint

const API_BASE = 'https://pocket-prompts-five.vercel.app';

export interface VoiceResponse {
  spoken_response: string;
  action_taken: string;
  entry_url?: string;
  intent_result?: {
    intent: string;
    confidence: number;
    content?: string;
    priority?: string;
    assignee?: string;
    due_date?: string;
    slack_recipient?: string;
    reply_to?: string;
    clarifying_question?: string;
  };
  error?: string;
  exit?: boolean;
  message_count?: number;
  channel_id?: string;
}

export async function send_voice(text: string, user_id: string): Promise<VoiceResponse> {
  const res = await fetch(`${API_BASE}/api/voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, user_id }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown error');
    throw new Error(`voice api error (${res.status}): ${err}`);
  }

  return res.json();
}
