import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { createAicsDocument, createAicsVersion, createAicsClaim } from '@/lib/aics-documents';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pcs/aics/batch — bulk-create AICS documents with nested
 * versions and claims in a single request.
 *
 * Requires `aics.documents:create` capability (RA / admin / super-user).
 *
 * Body: Array of document objects:
 * [
 *   {
 *     aicsId: string,          // required
 *     aiName?: string,
 *     classification?: string,
 *     fileStatus?: string,
 *     versions?: [
 *       {
 *         version: string,     // required
 *         effectiveDate?: string,
 *         changeDescription?: string,
 *         isLatest?: boolean,
 *         claims?: [
 *           {
 *             claimId: string, // required
 *             claimText?: string,
 *             claimNo?: number,
 *             benefitCategory?: string,
 *             grade?: string,
 *             ...
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * ]
 *
 * Hard cap: 20 documents per batch (Notion 3 req/s limit).
 * Returns: { ok: true, created: [...], errors: [...] }
 */

const BATCH_DOC_CAP = 20;
const DOC_CREATE_PAUSE_MS = 350;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request) {
  const auth = await requireCapability(request, 'aics.documents:create', {
    route: '/api/pcs/aics/batch',
  });
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be a JSON array.' }, { status: 400 });
  }
  if (body.length === 0) {
    return NextResponse.json({ error: 'Array must not be empty.' }, { status: 400 });
  }
  if (body.length > BATCH_DOC_CAP) {
    return NextResponse.json(
      { error: `Batch size ${body.length} exceeds maximum of ${BATCH_DOC_CAP} documents.` },
      { status: 400 },
    );
  }

  const created = [];
  const errors = [];

  for (let i = 0; i < body.length; i++) {
    const docInput = body[i];

    if (!docInput?.aicsId) {
      errors.push({ index: i, aicsId: docInput?.aicsId ?? null, error: 'aicsId is required.' });
      continue;
    }

    // Throttle between top-level document creates to stay under Notion's 3 req/s.
    if (i > 0) await sleep(DOC_CREATE_PAUSE_MS);

    let doc;
    try {
      // Strip the nested arrays before passing to createAicsDocument.
      const { versions: _v, ...docFields } = docInput;
      doc = await createAicsDocument(docFields);
    } catch (err) {
      errors.push({ index: i, aicsId: docInput.aicsId, error: err.message });
      continue;
    }

    const docResult = { ...doc, versions: [] };
    const versionInputs = Array.isArray(docInput.versions) ? docInput.versions : [];

    for (const versionInput of versionInputs) {
      if (!versionInput?.version) {
        errors.push({
          index: i,
          aicsId: docInput.aicsId,
          context: 'version',
          error: 'version field is required for each version entry.',
        });
        continue;
      }

      let ver;
      try {
        const { claims: _c, ...versionFields } = versionInput;
        ver = await createAicsVersion(doc.id, versionFields);
      } catch (err) {
        errors.push({ index: i, aicsId: docInput.aicsId, context: 'version', error: err.message });
        continue;
      }

      const verResult = { ...ver, claims: [] };
      const claimInputs = Array.isArray(versionInput.claims) ? versionInput.claims : [];

      for (const claimInput of claimInputs) {
        if (!claimInput?.claimId) {
          errors.push({
            index: i,
            aicsId: docInput.aicsId,
            context: 'claim',
            error: 'claimId is required for each claim entry.',
          });
          continue;
        }

        try {
          const claim = await createAicsClaim(doc.id, ver.id, claimInput);
          verResult.claims.push(claim);
        } catch (err) {
          errors.push({
            index: i,
            aicsId: docInput.aicsId,
            context: 'claim',
            claimId: claimInput.claimId,
            error: err.message,
          });
        }
      }

      docResult.versions.push(verResult);
    }

    created.push(docResult);
  }

  return NextResponse.json({ ok: true, created, errors });
}
