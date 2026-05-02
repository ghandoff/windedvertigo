/**
 * POST /api/webhooks/safety/resolve
 *
 * Called by RA (or an operator tool) when a safety review request is resolved.
 * Marks the `safety_sweep_pending` row as resolved_at = now(), then checks if
 * ALL rows for the same run_id are resolved. If so, posts a "sweep complete"
 * Slack notification.
 *
 * Auth: CRON_SECRET bearer token (same pattern as cron routes).
 *
 * Body JSON:
 *   {
 *     requestId: string,   — the Notion Research Request page id
 *     resolvedBy?: string, — optional userId or name
 *     notes?: string       — optional resolution notes
 *   }
 */

import { NextResponse } from 'next/server';
import { getSafetySupabase } from '@/lib/supabase-safety';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

async function notifyComplete(runId, ingredientId, totalRequests) {
  const channelOverride = process.env.SLACK_SAFETY_CHANNEL || process.env.SLACK_REQUESTS_CHANNEL || null;
  const hasBotToken = Boolean(process.env.SLACK_BOT_TOKEN);
  const webhook = process.env.SLACK_WEBHOOK_URL;
  const text = `✅ Safety sweep for ingredient \`${ingredientId}\` complete. ${totalRequests} label${totalRequests === 1 ? '' : 's'} reviewed. Run: \`${runId}\``;

  if (hasBotToken && channelOverride) {
    const resp = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({ channel: channelOverride, text }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.ok) {
      throw new Error(`Slack API error: ${data?.error || resp.status}`);
    }
    return { sent: true, via: 'bot' };
  }
  if (webhook) {
    const resp = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) throw new Error(`Slack webhook ${resp.status}`);
    return { sent: true, via: 'webhook' };
  }
  return { sent: false, reason: 'no Slack delivery configured' };
}

export async function POST(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { requestId, resolvedBy, notes } = body || {};
  if (!requestId) {
    return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
  }

  const sb = getSafetySupabase();
  if (!sb) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  // Mark this request as resolved.
  const { data: updated, error: updateError } = await sb
    .from('safety_sweep_pending')
    .update({ resolved_at: new Date().toISOString() })
    .eq('request_id', requestId)
    .is('resolved_at', null)
    .select('run_id, ingredient_id')
    .single();

  if (updateError || !updated) {
    console.error('[safety/resolve] update failed:', updateError?.message);
    return NextResponse.json(
      { error: updateError?.message || 'Row not found or already resolved' },
      { status: 404 },
    );
  }

  const { run_id: runId, ingredient_id: ingredientId } = updated;
  console.log('[safety/resolve] resolved requestId=%s runId=%s', requestId, runId);

  // Check if all rows for this run are now resolved.
  const { count: pendingCount, error: countError } = await sb
    .from('safety_sweep_pending')
    .select('*', { count: 'exact', head: true })
    .eq('run_id', runId)
    .is('resolved_at', null);

  if (countError) {
    console.error('[safety/resolve] count query failed:', countError.message);
    return NextResponse.json({ ok: true, resolved: true, allDone: false });
  }

  if (pendingCount === 0) {
    // All rows resolved — fetch total count for the completion notification.
    const { count: totalCount } = await sb
      .from('safety_sweep_pending')
      .select('*', { count: 'exact', head: true })
      .eq('run_id', runId);

    try {
      await notifyComplete(runId, ingredientId, totalCount ?? 0);
      console.log('[safety/resolve] sweep complete for runId=%s', runId);
    } catch (err) {
      console.error('[safety/resolve] completion notify failed:', err?.message);
    }

    return NextResponse.json({ ok: true, resolved: true, allDone: true, runId });
  }

  return NextResponse.json({ ok: true, resolved: true, allDone: false, pendingCount, runId });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'safety/resolve' });
}
