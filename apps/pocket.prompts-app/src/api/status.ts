// status + oauth API clients — calls GET /api/status and GET /api/oauth-url

const API_BASE = 'https://pocket-prompts-five.vercel.app';

export interface ConnectionStatus {
  member: string;
  slack: boolean;
  slack_token_type: 'user' | 'bot' | null;
  notion: boolean;
}

export async function get_status(member: string): Promise<ConnectionStatus> {
  const res = await fetch(`${API_BASE}/api/status?member=${encodeURIComponent(member)}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`status api error (${res.status})`);
  }

  return res.json();
}

export async function get_oauth_url(member: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/oauth-url?member=${encodeURIComponent(member)}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`oauth-url api error (${res.status})`);
  }

  const data = await res.json();
  return data.url;
}
