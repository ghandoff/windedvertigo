/**
 * Wave 8 Phase B — Audit-trail CSV export.
 *
 * GET /api/pcs/audit-trail/export
 *
 * Operator-facing endpoint that streams a CSV of the PCS revision-events
 * audit trail. Powers the "Export CSV" button on the Living PCS Revision
 * History panel (Table A) and on the admin audit views.
 *
 * Capability: `audit:read`. Held by researcher, ra, admin, and super-user.
 * Reviewer is denied (matches the Living PCS view's read posture).
 *
 * Query params (all optional):
 *   - from           ISO date — only events with startDate >= from
 *   - to             ISO date — only events with startDate <= to
 *   - entityType     filter on activity type (substring, case-insensitive)
 *   - reviewerEmail  filter on responsible individual (substring, case-insensitive)
 *
 * CSV columns: timestamp, actor email, role, entity type, entity id, action,
 * before snapshot (truncated 200 chars), after snapshot (truncated 200 chars).
 *
 * The export action itself is recorded in the revision-events log via a
 * best-effort `createRevisionEvent` call; failures there are swallowed so
 * the operator's download still succeeds (the export is read-only —
 * dropping the audit row beats failing the download).
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllRevisionEvents,
  createRevisionEvent,
} from '@/lib/pcs-revision-events';

export const dynamic = 'force-dynamic';

const SNAPSHOT_TRUNCATE = 200;

function truncate(value, max = SNAPSHOT_TRUNCATE) {
  if (value == null) return '';
  const s = String(value);
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

/**
 * RFC 4180 CSV cell escaping. Quote when the value contains a comma,
 * quote, CR, or LF; double any embedded quotes.
 */
function csvCell(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function rowToCsv(cells) {
  return cells.map(csvCell).join(',');
}

function parseDateBound(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function GET(request) {
  const auth = await requireCapability(request, 'audit:read', {
    route: '/api/pcs/audit-trail/export',
  });
  if (auth.error) return auth.error;
  const { user } = auth;

  const { searchParams } = new URL(request.url);
  const from = parseDateBound(searchParams.get('from'));
  const to = parseDateBound(searchParams.get('to'));
  const entityType = (searchParams.get('entityType') || '').trim().toLowerCase();
  const reviewerEmail = (searchParams.get('reviewerEmail') || '').trim().toLowerCase();

  let events;
  try {
    events = await getAllRevisionEvents();
  } catch (err) {
    return NextResponse.json(
      { error: 'audit-trail-fetch-failed', message: err?.message || String(err) },
      { status: 502 }
    );
  }

  const filtered = events.filter((ev) => {
    if (from || to) {
      const ts = ev.startDate || ev.createdTime;
      if (!ts) return false;
      const t = new Date(ts);
      if (Number.isNaN(t.getTime())) return false;
      if (from && t < from) return false;
      if (to && t > to) return false;
    }
    if (entityType) {
      const at = (ev.activityType || '').toLowerCase();
      if (!at.includes(entityType)) return false;
    }
    if (reviewerEmail) {
      const ri = (ev.responsibleIndividual || '').toLowerCase();
      if (!ri.includes(reviewerEmail)) return false;
    }
    return true;
  });

  const header = [
    'timestamp',
    'actor_email',
    'role',
    'entity_type',
    'entity_id',
    'action',
    'before_snapshot',
    'after_snapshot',
  ];

  const lines = [rowToCsv(header)];
  for (const ev of filtered) {
    const role = ev.responsibleDept || '';
    const before = ev.fromVersion ? `version: ${ev.fromVersion}` : '';
    const after = ev.toVersion ? `version: ${ev.toVersion}` : '';
    lines.push(
      rowToCsv([
        ev.startDate || ev.createdTime || '',
        ev.responsibleIndividual || '',
        role,
        ev.activityType || '',
        ev.pcsVersionId || ev.id || '',
        ev.event || '',
        truncate(before),
        truncate(after + (ev.eventNotes ? ` | notes: ${ev.eventNotes}` : '')),
      ])
    );
  }

  // Best-effort: log the export action itself so the audit trail records
  // who pulled what. Swallow errors — the CSV download is the primary work.
  try {
    const actor = user?.email || user?.alias || 'unknown';
    const filterSummary = [
      from ? `from=${searchParams.get('from')}` : null,
      to ? `to=${searchParams.get('to')}` : null,
      entityType ? `entityType=${entityType}` : null,
      reviewerEmail ? `reviewerEmail=${reviewerEmail}` : null,
    ].filter(Boolean).join(' ') || 'no-filters';
    await createRevisionEvent({
      event: `Audit-trail CSV export by ${actor}`,
      activityType: 'Export — Audit Trail CSV',
      responsibleIndividual: actor,
      startDate: new Date().toISOString().slice(0, 10),
      eventNotes: `Rows: ${filtered.length} of ${events.length}. Filters: ${filterSummary}`,
    });
  } catch {
    // intentional swallow
  }

  const csv = lines.join('\r\n') + '\r\n';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pcs-audit-trail-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
