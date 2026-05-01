import type { EventContext } from '@cloudflare/workers-types';
import { apiHeaders, type Env } from '../../_shared/kv';

const TTL = 86400;
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ2345679';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + 'st-salt-2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }: EventContext<Env, any, any>): Promise<Response> {
  try {
    const body = await request.json() as { pin?: string };
    if (!body.pin || !/^\d{4}$/.test(body.pin)) {
      return Response.json({ error: 'pin must be exactly 4 digits' }, { status: 400, headers: apiHeaders() });
    }

    let code = '';
    let attempts = 0;
    do {
      code = generateCode();
      const exists = await env.SESSION_KV.get(`session:${code}`);
      if (!exists) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return Response.json({ error: 'could not generate unique code, try again' }, { status: 503, headers: apiHeaders() });
    }

    const session = {
      facilitatorPin: await hashPin(body.pin),
      createdAt: new Date().toISOString(),
      config: { collectReflections: true },
    };

    await env.SESSION_KV.put(`session:${code}`, JSON.stringify(session), { expirationTtl: TTL });

    return Response.json({ code, createdAt: session.createdAt }, { status: 200, headers: apiHeaders() });
  } catch (err) {
    console.error('session/create error:', err);
    return Response.json({ error: 'internal error' }, { status: 500, headers: apiHeaders() });
  }
}
