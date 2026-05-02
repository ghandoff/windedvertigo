/**
 * Wave 4.3.5 — Living PCS View inline edit endpoint.
 *
 * POST /api/pcs/documents/[id]/view/edit
 *
 * Body: {
 *   section: 'table1',
 *   field: 'productName' | 'dailyServingSize' | 'biologicalSex' | 'ageGroup'
 *          | 'lifeStage' | 'lifestyle' | 'demographic' | 'formatOverride',
 *   value: <string | string[]>,
 *   versionNote: '<required>',
 * }
 *
 * Semantics — save as new version:
 *   1. Resolve the current latest Version row for this document.
 *   2. Clone Lauren-template scalar + chip fields from the latest onto a
 *      new Version row.
 *   3. Apply the single-field edit on top of the clone.
 *   4. Set isLatest=true on the new row and supersedes=<old id>.
 *   5. Unset isLatest on the old row.
 *
 * Concurrency note: two writers editing concurrently resolve last-write-wins.
 * The loser's edit still persists as its own version row, so it is
 * recoverable from the supersedes chain.
 *
 * Scoped to Table 1 in Wave 4.3.5. Tables 2/3/4 extend the `section` switch.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getDocument, setLatestVersion } from '@/lib/pcs-documents';
import {
  getVersion,
  getVersionsForDocument,
  createVersion,
  updateVersion,
} from '@/lib/pcs-versions';

const TABLE1_ALLOWED_FIELDS = new Set([
  'productName',
  'formatOverride',
  'dailyServingSize',
  'demographic',
  'biologicalSex',
  'ageGroup',
  'lifeStage',
  'lifestyle',
]);

const CHIP_FIELDS = new Set([
  'demographic',
  'biologicalSex',
  'ageGroup',
  'lifeStage',
  'lifestyle',
]);

function cloneTable1Fields(v) {
  return {
    productName: v.productName || '',
    formatOverride: v.formatOverride || '',
    dailyServingSize: v.dailyServingSize || '',
    demographic: Array.isArray(v.demographic) ? v.demographic : [],
    biologicalSex: Array.isArray(v.biologicalSex) ? v.biologicalSex : [],
    ageGroup: Array.isArray(v.ageGroup) ? v.ageGroup : [],
    lifeStage: Array.isArray(v.lifeStage) ? v.lifeStage : [],
    lifestyle: Array.isArray(v.lifestyle) ? v.lifestyle : [],
    totalEPA: v.totalEPA ?? null,
    totalDHA: v.totalDHA ?? null,
    totalEPAandDHA: v.totalEPAandDHA ?? null,
    totalOmega6: v.totalOmega6 ?? null,
    totalOmega9: v.totalOmega9 ?? null,
    demographicBackfillReview: v.demographicBackfillReview || '',
  };
}

function bumpVersion(current) {
  if (!current) return 'v1.1';
  const m = /^v?(\d+)\.(\d+)$/.exec(current.trim());
  if (m) {
    const major = Number(m[1]);
    const minor = Number(m[2]) + 1;
    return `v${major}.${minor}`;
  }
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${current}+e${stamp}`;
}

export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'pcs.documents:edit', { route: '/api/pcs/documents/[id]/view/edit' });
  if (auth.error) return auth.error;

  const { id: documentId } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { section, field, value, versionNote } = body || {};

  if (section !== 'table1') {
    return NextResponse.json(
      { error: `Editing section "${section}" is not supported in Wave 4.3.5. Only "table1".` },
      { status: 400 }
    );
  }
  if (!field || !TABLE1_ALLOWED_FIELDS.has(field)) {
    return NextResponse.json(
      { error: `Field "${field}" is not editable in Table 1.` },
      { status: 400 }
    );
  }
  if (typeof versionNote !== 'string' || versionNote.trim().length === 0) {
    return NextResponse.json(
      { error: 'versionNote is required' },
      { status: 400 }
    );
  }

  if (CHIP_FIELDS.has(field)) {
    if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) {
      return NextResponse.json(
        { error: `Field "${field}" expects an array of strings.` },
        { status: 400 }
      );
    }
  } else if (value != null && typeof value !== 'string') {
    return NextResponse.json(
      { error: `Field "${field}" expects a string value.` },
      { status: 400 }
    );
  }

  let doc;
  try {
    doc = await getDocument(documentId);
  } catch (err) {
    if (err?.code === 'object_not_found') {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    throw err;
  }
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  let latest = null;
  if (doc.latestVersionId) {
    try {
      latest = await getVersion(doc.latestVersionId);
    } catch {
      latest = null;
    }
  }
  if (!latest) {
    const all = await getVersionsForDocument(documentId).catch(() => []);
    latest = all.find(v => v.isLatest) || all[0] || null;
  }
  if (!latest) {
    return NextResponse.json(
      { error: 'No existing version to edit — create a version first.' },
      { status: 409 }
    );
  }

  const cloned = cloneTable1Fields(latest);
  cloned[field] = CHIP_FIELDS.has(field) ? value : (value ?? '');

  const nextVersionString = bumpVersion(latest.version);
  const today = new Date().toISOString().slice(0, 10);

  let created;
  try {
    created = await createVersion({
      version: nextVersionString,
      pcsDocumentId: documentId,
      effectiveDate: today,
      isLatest: true,
      supersedesId: latest.id,
      versionNotes: versionNote,
      ...cloned,
    });
  } catch (err) {
    console.error('[wave-4.3.5] createVersion failed', err);
    return NextResponse.json(
      { error: 'Failed to create new version. Your change was not saved.' },
      { status: 500 }
    );
  }

  try {
    await updateVersion(latest.id, { isLatest: false });
  } catch (err) {
    console.warn('[wave-4.3.5] failed to unset isLatest on old version', err);
  }

  // Repoint the document's `latestVersion` relation at the new version so
  // downstream consumers (label-drift sweep, Living PCS view, etc.) read
  // the fresh row. Failure is logged but non-fatal: the new version still
  // has isLatest=true and getVersionsForDocument() will fall back to it.
  try {
    await setLatestVersion(documentId, created.id);
  } catch (err) {
    console.warn('[wave-4.3.5] failed to repoint document.latestVersion', err);
  }

  return NextResponse.json(
    {
      ok: true,
      versionId: created.id,
      version: created.version,
      supersededVersionId: latest.id,
    },
    { status: 201 }
  );
}
