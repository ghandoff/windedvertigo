/**
 * POST /api/webhooks/notion/page-updated
 *
 * General Notion → Postgres sync webhook.
 *
 * When any team member edits a PCS record directly in Notion, this
 * webhook fires immediately and mirrors the change to Postgres — giving
 * sub-second sync instead of waiting up to 2 minutes for the drift-sync
 * cron to catch it.
 *
 * Complementary to (not a replacement for) the drift-sync cron:
 *   - Webhook: real-time push on individual edits
 *   - Cron:    safety net, catches edits the webhook missed
 *
 * Routing: identifies the edited page's parent database ID at runtime
 * and dispatches to the appropriate `syncSingle*PageToPostgres` export.
 * Only the 13 tables that have Postgres mirrors are handled; edits to
 * other Notion databases (labels, prefixes, etc.) are silently acked.
 *
 * Auth: `NOTION_WEBHOOK_TOKEN` bearer token (same as evidence-updated).
 * If unset, accepts all calls (Preview / local dev) with a warning.
 *
 * Setup: register this URL in Notion's webhook configuration for each
 * PCS database. Use `page.updated` and `page.created` event types.
 * See docs/runbooks/notion-webhooks.md for setup instructions.
 */

import { NextResponse } from 'next/server';
import { notion } from '@/lib/notion';
import { PCS_DB } from '@/lib/pcs-config';
import { syncSingleEvidencePageToPostgres } from '@/lib/pcs-evidence';
import { syncSingleClaimPageToPostgres } from '@/lib/pcs-claims';
import { syncSingleDocumentPageToPostgres } from '@/lib/pcs-documents';
import { syncSingleIngredientPageToPostgres } from '@/lib/pcs-ingredients';
import { syncSingleCanonicalClaimPageToPostgres } from '@/lib/pcs-canonical-claims';
import { syncSingleCoreBenefitPageToPostgres } from '@/lib/pcs-core-benefits';
import { syncSingleEvidencePacketPageToPostgres } from '@/lib/pcs-evidence-packets';
import { syncSingleFormulaLinePageToPostgres } from '@/lib/pcs-formula-lines';
import { syncSingleReferencePageToPostgres } from '@/lib/pcs-references';
import { syncSingleRequestPageToPostgres } from '@/lib/pcs-requests';
import { syncSingleRevisionEventPageToPostgres } from '@/lib/pcs-revision-events';
import { syncSingleVersionPageToPostgres } from '@/lib/pcs-versions';
import { syncSingleWordingVariantPageToPostgres } from '@/lib/pcs-wording-variants';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

function verifyAuth(request) {
  const expected = process.env.NOTION_WEBHOOK_TOKEN;
  if (!expected) {
    console.warn('[page-updated] NOTION_WEBHOOK_TOKEN not set — accepting all calls');
    return true;
  }
  const auth = request.headers.get('authorization') || '';
  const xToken = request.headers.get('x-notion-webhook-token') || '';
  return auth === `Bearer ${expected}` || xToken === expected;
}

/**
 * Build an inverted map: Notion database ID → syncSinglePage function.
 * Called at request time so env vars are resolved correctly.
 */
function buildDbSyncMap() {
  return {
    [PCS_DB.evidenceLibrary]: syncSingleEvidencePageToPostgres,
    [PCS_DB.claims]:          syncSingleClaimPageToPostgres,
    [PCS_DB.documents]:       syncSingleDocumentPageToPostgres,
    [PCS_DB.ingredients]:     syncSingleIngredientPageToPostgres,
    [PCS_DB.canonicalClaims]: syncSingleCanonicalClaimPageToPostgres,
    [PCS_DB.coreBenefits]:    syncSingleCoreBenefitPageToPostgres,
    [PCS_DB.evidencePackets]: syncSingleEvidencePacketPageToPostgres,
    [PCS_DB.formulaLines]:    syncSingleFormulaLinePageToPostgres,
    [PCS_DB.references]:      syncSingleReferencePageToPostgres,
    [PCS_DB.requests]:        syncSingleRequestPageToPostgres,
    [PCS_DB.revisionEvents]:  syncSingleRevisionEventPageToPostgres,
    [PCS_DB.versions]:        syncSingleVersionPageToPostgres,
    [PCS_DB.wordingVariants]: syncSingleWordingVariantPageToPostgres,
  };
}

export async function POST(request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Notion verification challenge — mirror the token back on first setup.
  if (body?.type === 'url_verification' && body?.challenge) {
    return NextResponse.json({ challenge: body.challenge });
  }
  if (body?.verification_token && !body?.type) {
    return NextResponse.json({ ok: true, verification_token: body.verification_token });
  }

  // Accept a variety of Notion webhook payload shapes. We need the page id.
  const pageId =
    body?.entity?.id ||
    body?.data?.parent?.id ||
    body?.page?.id ||
    body?.id ||
    null;

  if (!pageId) {
    return NextResponse.json({ ok: true, reason: 'no page id in payload' });
  }

  // Fetch the page to determine which database it belongs to.
  // This also validates the page exists and is accessible.
  let parentDatabaseId;
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    parentDatabaseId = page?.parent?.database_id || null;
  } catch (err) {
    // Page may have been deleted or be inaccessible — ack without error
    // so Notion doesn't retry indefinitely.
    console.warn('[page-updated] page retrieve failed for %s: %s', pageId, err?.message);
    return NextResponse.json({ ok: true, reason: 'page not accessible', pageId });
  }

  if (!parentDatabaseId) {
    return NextResponse.json({ ok: true, reason: 'page has no database parent', pageId });
  }

  const dbSyncMap = buildDbSyncMap();
  const syncFn = dbSyncMap[parentDatabaseId];

  if (!syncFn) {
    // Page belongs to a non-mirrored database (labels, prefixes, AICS, etc.)
    // Ack silently — not an error.
    return NextResponse.json({
      ok: true,
      reason: 'database not mirrored',
      pageId,
      parentDatabaseId,
    });
  }

  try {
    const result = await syncFn(pageId);
    console.log('[page-updated] mirrored pageId=%s dbId=%s mirrored=%s',
      pageId, parentDatabaseId, result?.mirrored);
    return NextResponse.json({ ok: true, pageId, result });
  } catch (err) {
    // Mirror failure should not cause Notion to retry the webhook —
    // the drift-sync cron is the safety net. Log and ack.
    console.error('[page-updated] mirror failed pageId=%s: %s', pageId, err?.message);
    return NextResponse.json(
      { ok: true, reason: 'mirror failed — cron will catch up', pageId, error: err?.message },
      { status: 200 },
    );
  }
}
