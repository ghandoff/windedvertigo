import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllEvidence } from '@/lib/pcs-evidence';
import { normalizeDoi } from '@/lib/doi';

export async function POST(request) {
  const { user, error } = await requireCapability(request, 'pcs.evidence:read', { route: '/api/pcs/evidence/check-duplicates' });
  if (error) return error;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { dois = [], pmids = [], endnoteRecordIds = [] } = body;

    const allEvidence = await getAllEvidence();

    // Build lookup maps from existing evidence
    const doiMap = {};
    const pmidMap = {};
    const endnoteMap = {};

    for (const item of allEvidence) {
      const ref = { id: item.id, name: item.name };
      const normalizedDoi = normalizeDoi(item.doi);
      if (normalizedDoi) doiMap[normalizedDoi] = ref;
      if (item.pmid) pmidMap[item.pmid] = ref;
      if (item.endnoteRecordId) endnoteMap[item.endnoteRecordId] = ref;
    }

    // Check inputs against maps
    const byDoi = {};
    for (const doi of dois) {
      const normalized = normalizeDoi(doi);
      if (normalized && doiMap[normalized]) byDoi[normalized] = doiMap[normalized];
    }

    const byPmid = {};
    for (const pmid of pmids) {
      if (pmidMap[pmid]) byPmid[pmid] = pmidMap[pmid];
    }

    const byEndnoteRecordId = {};
    for (const id of endnoteRecordIds) {
      if (endnoteMap[id]) byEndnoteRecordId[id] = endnoteMap[id];
    }

    return NextResponse.json({ duplicates: { byDoi, byPmid, byEndnoteRecordId } });
  } catch (err) {
    console.error('check-duplicates error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
