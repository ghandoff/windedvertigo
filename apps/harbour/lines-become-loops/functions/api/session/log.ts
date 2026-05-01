import type { EventContext } from '@cloudflare/workers-types';
import { apiHeaders, type Env } from '../../_shared/kv';

const TTL = 86400;

export async function onRequestPost({ request, env }: EventContext<Env, any, any>): Promise<Response> {
  try {
    let body: Record<string, any>;
    const ct = request.headers.get('content-type') ?? '';
    body = ct.includes('text/plain') ? JSON.parse(await request.text()) : await request.json();

    const { sessionCode, participantId, type, data } = body;
    if (!sessionCode || !participantId || !type) {
      return Response.json({ error: 'missing required fields' }, { status: 400, headers: apiHeaders() });
    }

    const raw = await env.SESSION_KV.get(`session:${sessionCode}`);
    if (!raw) {
      return Response.json({ error: 'session not found' }, { status: 404, headers: apiHeaders() });
    }

    const session = JSON.parse(raw);
    const textEvents = ['hypothesis_written', 'shifted_written'];
    if (!session.config?.collectReflections && textEvents.includes(type)) {
      return Response.json({ ok: true, skipped: true }, { status: 200, headers: apiHeaders() });
    }

    const event = { type, data: data || {}, timestamp: new Date().toISOString() };
    // unique key per event so writes never conflict
    const eventKey = `event:${sessionCode}:${participantId}:${Date.now()}`;
    await env.SESSION_KV.put(eventKey, JSON.stringify(event), { expirationTtl: TTL });

    // update student progress
    const studentKey = `student:${sessionCode}:${participantId}`;
    const studentRaw = await env.SESSION_KV.get(studentKey);
    if (studentRaw) {
      const student = JSON.parse(studentRaw);
      if (data?.scenario) student.currentScenario = data.scenario;
      if (type === 'scenario_started' && data?.scenario) {
        student.progress[data.scenario] = { started: true };
      }
      if (type === 'slider_move' && data?.scenario) {
        if (!student.progress[data.scenario]) student.progress[data.scenario] = {};
        student.progress[data.scenario].interacting = true;
      }
      await env.SESSION_KV.put(studentKey, JSON.stringify(student), { expirationTtl: TTL });
    }

    return Response.json({ ok: true }, { status: 200, headers: apiHeaders() });
  } catch (err) {
    console.error('session/log error:', err);
    return Response.json({ error: 'internal error' }, { status: 500, headers: apiHeaders() });
  }
}
