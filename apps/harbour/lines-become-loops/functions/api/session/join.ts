import type { EventContext } from '@cloudflare/workers-types';
import { apiHeaders, type Env } from '../../_shared/kv';

const TTL = 86400;

export async function onRequestPost({ request, env }: EventContext<Env, any, any>): Promise<Response> {
  try {
    const body = await request.json() as { code?: string };
    if (!body.code || !/^[A-Z0-9]{6}$/.test(body.code.toUpperCase())) {
      return Response.json({ error: 'invalid session code' }, { status: 400, headers: apiHeaders() });
    }

    const upperCode = body.code.toUpperCase();
    const raw = await env.SESSION_KV.get(`session:${upperCode}`);
    if (!raw) {
      return Response.json({ error: 'session not found or expired' }, { status: 404, headers: apiHeaders() });
    }

    const pid = crypto.randomUUID();
    const student = {
      joinedAt: new Date().toISOString(),
      currentScenario: null,
      progress: {},
    };
    await env.SESSION_KV.put(`student:${upperCode}:${pid}`, JSON.stringify(student), { expirationTtl: TTL });

    const session = JSON.parse(raw);
    return Response.json(
      { participantId: pid, sessionCode: upperCode, config: session.config || { collectReflections: true } },
      { status: 200, headers: apiHeaders() }
    );
  } catch (err) {
    console.error('session/join error:', err);
    return Response.json({ error: 'internal error' }, { status: 500, headers: apiHeaders() });
  }
}
