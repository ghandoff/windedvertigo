import type { EventContext } from '@cloudflare/workers-types';
import { apiHeaders, type Env } from '../../_shared/kv';

const TTL = 86400;

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + 'st-salt-2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPatch({ request, env }: EventContext<Env, any, any>): Promise<Response> {
  try {
    const body = await request.json() as { code?: string; pin?: string; collectReflections?: boolean };
    const { code, pin, collectReflections } = body;
    if (!code || !pin) {
      return Response.json({ error: 'missing code or pin' }, { status: 400, headers: apiHeaders() });
    }

    const raw = await env.SESSION_KV.get(`session:${code}`);
    if (!raw) {
      return Response.json({ error: 'session not found or expired' }, { status: 404, headers: apiHeaders() });
    }

    const session = JSON.parse(raw);
    if (await hashPin(pin) !== session.facilitatorPin) {
      return Response.json({ error: 'invalid pin' }, { status: 403, headers: apiHeaders() });
    }

    if (typeof collectReflections === 'boolean') {
      session.config.collectReflections = collectReflections;
    }

    await env.SESSION_KV.put(`session:${code}`, JSON.stringify(session), { expirationTtl: TTL });
    return Response.json({ config: session.config }, { status: 200, headers: apiHeaders() });
  } catch (err) {
    console.error('session/config error:', err);
    return Response.json({ error: 'internal error' }, { status: 500, headers: apiHeaders() });
  }
}
