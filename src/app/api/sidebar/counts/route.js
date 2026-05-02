/**
 * Wave 7.4 polish — sidebar badge counts.
 *
 * GET /api/sidebar/counts
 *
 * Returns a small payload of "open work" counts the role-aware sidebar
 * uses to render badges next to nav items (Requests, Drift, Imports,
 * Label Imports). Auth required (any authenticated user can read their
 * own counts) — read-only data, no capability gate.
 *
 * Per-section error isolation: if one Notion sub-fetch errors we return
 * `null` for that section but still respond 200 with the rest. This keeps
 * one DB hiccup from blanking every badge in the UI.
 *
 * In-memory cache: Sidebar mounts on every page load, so this endpoint
 * could easily hammer Notion. We cache the full payload for 30s keyed by
 * reviewer id (per-user only because the per-role buckets in `requests`
 * are computed once and shared across users — the keying is a courtesy
 * for future per-user filters). Cache is process-local and best-effort;
 * on Vercel each lambda has its own cache.
 */

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getOpenRequests } from '@/lib/pcs-requests';
import { getAllLabels } from '@/lib/pcs-labels';
import { getAllJobs } from '@/lib/pcs-import-jobs';
import { getAllIntakeRows } from '@/lib/label-intake-queue';

const CACHE_TTL_MS = 30_000;
const cache = new Map(); // key: reviewerId, value: { ts, payload }

// PCS import-jobs use lowercase status names; "active" = not in a terminal
// state. See `src/lib/pcs-import-runner.js` (terminal: committed/failed/skipped).
const IMPORT_ACTIVE_STATUSES = new Set(['queued', 'extracting', 'extracted', 'committing']);
const IMPORT_NEEDS_ATTENTION_STATUSES = new Set(['failed']);

// Label intake queue uses Title-case status names. See
// `src/lib/label-intake-queue.js` header comment.
const LABEL_ACTIVE_STATUSES = new Set(['Pending', 'Extracting']);
const LABEL_NEEDS_ATTENTION_STATUSES = new Set(['Needs Validation', 'Failed']);

async function fetchRequestsSection() {
  try {
    const open = await getOpenRequests();
    let withResearch = 0;
    let withRA = 0;
    for (const r of open) {
      const role = (r.assignedRole || '').toLowerCase();
      if (role === 'research' || role === 'researcher') withResearch += 1;
      else if (role === 'ra' || role === 'research assistant') withRA += 1;
    }
    return { total: open.length, withResearch, withRA };
  } catch (err) {
    console.error('[sidebar/counts] requests sub-fetch failed:', err?.message || err);
    return null;
  }
}

async function fetchDriftSection() {
  try {
    const labels = await getAllLabels();
    let openCount = 0;
    for (const l of labels) {
      if (l.status !== 'Active') continue;
      if ((l.driftFindingIds || []).length > 0) openCount += 1;
    }
    return { openCount };
  } catch (err) {
    console.error('[sidebar/counts] drift sub-fetch failed:', err?.message || err);
    return null;
  }
}

async function fetchImportsSection() {
  try {
    const jobs = await getAllJobs();
    let active = 0;
    let needsAttention = 0;
    for (const j of jobs) {
      if (IMPORT_ACTIVE_STATUSES.has(j.status)) active += 1;
      else if (IMPORT_NEEDS_ATTENTION_STATUSES.has(j.status)) needsAttention += 1;
    }
    return { active, needsAttention };
  } catch (err) {
    console.error('[sidebar/counts] imports sub-fetch failed:', err?.message || err);
    return null;
  }
}

async function fetchLabelImportsSection() {
  try {
    const rows = await getAllIntakeRows();
    let active = 0;
    let needsAttention = 0;
    for (const r of rows) {
      if (LABEL_ACTIVE_STATUSES.has(r.status)) active += 1;
      else if (LABEL_NEEDS_ATTENTION_STATUSES.has(r.status)) needsAttention += 1;
    }
    return { active, needsAttention };
  } catch (err) {
    console.error('[sidebar/counts] labelImports sub-fetch failed:', err?.message || err);
    return null;
  }
}

export async function GET(request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const cacheKey = user.reviewerId || user.email || 'anon';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.payload, {
      headers: { 'X-Sidebar-Counts-Cache': 'HIT' },
    });
  }

  // Run sub-fetches in parallel; each handles its own errors.
  const [requests, drift, imports, labelImports] = await Promise.all([
    fetchRequestsSection(),
    fetchDriftSection(),
    fetchImportsSection(),
    fetchLabelImportsSection(),
  ]);

  const payload = { requests, drift, imports, labelImports };
  cache.set(cacheKey, { ts: Date.now(), payload });

  return NextResponse.json(payload, {
    headers: { 'X-Sidebar-Counts-Cache': 'MISS' },
  });
}
