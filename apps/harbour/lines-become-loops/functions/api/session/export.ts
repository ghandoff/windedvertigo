import type { EventContext } from '@cloudflare/workers-types';
import { apiHeaders, listKeys, type Env } from '../../_shared/kv';

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + 'st-salt-2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ request, env }: EventContext<Env, any, any>): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const pin = searchParams.get('pin');
    const format = searchParams.get('format');
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

    const studentKeys = await listKeys(env.SESSION_KV, `student:${code}:`);
    const participants = await Promise.all(
      studentKeys.map(async (key) => {
        const pid = key.slice(`student:${code}:`.length);
        const studentRaw = await env.SESSION_KV.get(key);
        const student = studentRaw ? JSON.parse(studentRaw) : { joinedAt: null, progress: {} };

        const eventKeys = await listKeys(env.SESSION_KV, `event:${code}:${pid}:`);
        const events = (
          await Promise.all(eventKeys.map((ek) => env.SESSION_KV.get(ek)))
        )
          .filter(Boolean)
          .map((e) => JSON.parse(e!))
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        return {
          participantId: pid,
          joinedAt: student.joinedAt,
          currentScenario: student.currentScenario,
          progress: student.progress,
          events,
        };
      })
    );

    const exportData = { sessionCode: code, createdAt: session.createdAt, config: session.config, participants };

    if (format === 'csv') {
      const rows: string[][] = [['timestamp', 'participant_id', 'event_type', 'scenario', 'intervention_id', 'dosage', 'text_value']];
      participants.forEach((p) => {
        p.events.forEach((evt) => {
          rows.push([
            evt.timestamp || '',
            p.participantId,
            evt.type || '',
            evt.data?.scenario || '',
            evt.data?.interventionId || '',
            String(evt.data?.dosage ?? ''),
            evt.data?.text || '',
          ]);
        });
      });
      const csv = rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
      return new Response(csv, {
        status: 200,
        headers: { ...apiHeaders(), 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="session-${code}.csv"` },
      });
    }

    return new Response(JSON.stringify(exportData), {
      status: 200,
      headers: { ...apiHeaders(), 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="session-${code}.json"` },
    });
  } catch (err) {
    console.error('session/export error:', err);
    return Response.json({ error: 'internal error' }, { status: 500, headers: apiHeaders() });
  }
}
