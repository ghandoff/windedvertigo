/**
 * Living PCS View — data assembly endpoint.
 *
 * Wave 4.3.0: returned `{ document, version }`; relation arrays empty and
 * sectionHealth mostly null.
 * Wave 4.3.1: populates `revisionEvents` and `formulaLines`, and fills in
 * the sectionHealth computation for tableA, table1, table2, tableB per
 * the Wave 4.3 plan §4 pseudocode.
 *
 * Later phases add claims, evidence packets, references, and labels.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getDocument } from '@/lib/pcs-documents';
import { getVersion, getVersionsForDocument } from '@/lib/pcs-versions';
import { getEventsForVersion } from '@/lib/pcs-revision-events';
import { getFormulaLinesForVersion } from '@/lib/pcs-formula-lines';
import { getClaimsForVersion } from '@/lib/pcs-claims';
import { getPacketsForClaim } from '@/lib/pcs-evidence-packets';
import { getReferencesForVersion } from '@/lib/pcs-references';
import { getLabelsForPcs } from '@/lib/pcs-labels';

function computeSectionHealth({
  doc,
  version,
  revisionEvents,
  formulaLines,
  claims,
  evidencePackets,
  references,
}) {
  // Table B — Applicable Products: requires finishedGoodName and format.
  const tableB = (!doc.finishedGoodName || !doc.format) ? 'warning' : null;

  // Table A — Revision History: missing entirely = info (non-blocking);
  // legacy doc with no events = warning.
  let tableA = null;
  if (!revisionEvents || revisionEvents.length === 0) {
    tableA = doc.templateVersion === 'Legacy pre-Lauren' ? 'warning' : 'info';
  }

  // Table 1 — Product Details. Prefer the four-axis demographic (Wave 4.1).
  // Fall back to the legacy flat `demographic` multi-select.
  let table1 = null;
  if (version) {
    const axes = ['biologicalSex', 'ageGroup', 'lifeStage', 'lifestyle'];
    const populatedAxes = axes.filter(k => Array.isArray(version[k]) && version[k].length > 0);
    const legacyDemo = Array.isArray(version.demographic) ? version.demographic : [];
    const axisCount = populatedAxes.length > 0 ? populatedAxes.length : legacyDemo.length;
    const hasProductName = Boolean(version.productName) || Boolean(doc.finishedGoodName);
    if (!hasProductName) {
      table1 = 'warning';
    } else if (axisCount === 0) {
      table1 = 'warning';
    } else if (axisCount < 2) {
      // Lauren template expects multi-axis — single-axis is incomplete.
      table1 = 'warning';
    }
  } else {
    table1 = 'warning';
  }

  // Table 2 — Composition. Empty = warning; missing FM PLM# on any line = info.
  let table2 = null;
  if (!formulaLines || formulaLines.length === 0) {
    table2 = 'warning';
  } else if (formulaLines.some(l => !l.fmPlm)) {
    table2 = 'info';
  }

  // Overall badge from classifier signals.
  let overall = null;
  if (doc.templateVersion === 'Legacy pre-Lauren') {
    overall = 'warning';
  } else if (doc.templateSignals) {
    try {
      const parsed = JSON.parse(doc.templateSignals);
      if ((parsed?.negativeCount ?? 0) > 2) overall = 'warning';
    } catch {
      // ignore
    }
  }

  // Tables 3A/3B/3C — Claims buckets (Wave 4.3.2).
  // 3A (primary): critical if empty (no substantiation possible); warning if
  // any claim has status "Unknown".
  // 3B (secondary/amber) and 3C (muted) are optional; no flag when empty.
  const claimsArr = Array.isArray(claims) ? claims : [];
  const bucket3A = claimsArr.filter(c => (c.claimBucket || '3A') === '3A');
  const bucket3B = claimsArr.filter(c => c.claimBucket === '3B');
  const bucket3C = claimsArr.filter(c => c.claimBucket === '3C');
  let table3A = null;
  if (bucket3A.length === 0) {
    table3A = 'critical';
  } else if (bucket3A.some(c => c.claimStatus === 'Unknown')) {
    table3A = 'warning';
  }
  const table3B = bucket3B.length === 0 ? null : null;
  const table3C = bucket3C.length === 0 ? null : null;

  // Tables 4/5/6 + References (Wave 4.3.3).
  const packets = Array.isArray(evidencePackets) ? evidencePackets : [];
  const refs = Array.isArray(references) ? references : [];
  const table4Packets = packets.filter(
    p => (p.substantiationTier || 'Table 4 (primary study)') === 'Table 4 (primary study)'
  );
  const table5Packets = packets.filter(
    p => p.substantiationTier === 'Table 5 (supporting doc)'
  );
  const table6Packets = packets.filter(
    p => p.substantiationTier === 'Table 6 (null result)'
  );

  // Table 4: critical if claims3A has rows but no Table 4 packets;
  // warning if any packet missing keyTakeaway.
  let table4 = null;
  if (bucket3A.length > 0 && table4Packets.length === 0) {
    table4 = 'critical';
  } else if (table4Packets.some(p => !p.keyTakeaway)) {
    table4 = 'warning';
  }
  // Table 5 / Table 6 — no flag when empty.
  const table5 = null;
  const table6 = null;
  // References: warning if empty but claims exist.
  const referencesHealth =
    refs.length === 0 && claimsArr.length > 0 ? 'warning' : null;

  return {
    cover: null,
    tableA,
    tableB,
    table1,
    table2,
    table3A,
    table3B,
    table3C,
    table4,
    table5,
    table6,
    references: referencesHealth,
    overall,
  };
}

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.documents:read', { route: '/api/pcs/documents/[id]/view' });
  if (auth.error) return auth.error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const requestedVersionId = searchParams.get('versionId');
  try {
    const doc = await getDocument(id);
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Resolve version — either the explicitly requested one (for the version
    // picker) or the document's latest pointer.
    let version = null;
    if (requestedVersionId) {
      try {
        const candidate = await getVersion(requestedVersionId);
        // Safety: only serve versions that belong to this document.
        if (candidate && candidate.pcsDocumentId === id) {
          version = candidate;
        }
      } catch {
        version = null;
      }
    }
    if (!version && doc.latestVersionId) {
      try {
        version = await getVersion(doc.latestVersionId);
      } catch {
        version = null;
      }
    }
    if (!version) {
      // Fallback: pick highest-effectiveDate version.
      const all = await getVersionsForDocument(id).catch(() => []);
      version = all.find(v => v.isLatest) || all[0] || null;
    }

    // Load relation payloads in parallel when we have a resolved version.
    let revisionEvents = [];
    let formulaLines = [];
    let claims = [];
    let references = [];
    if (version?.id) {
      const [events, lines, claimRows, refRows] = await Promise.all([
        getEventsForVersion(version.id).catch(() => []),
        getFormulaLinesForVersion(version.id).catch(() => []),
        getClaimsForVersion(version.id).catch(() => []),
        getReferencesForVersion(version.id).catch(() => []),
      ]);
      revisionEvents = events;
      formulaLines = lines;
      claims = claimRows;
      references = refRows;
    }

    // Evidence packets — fan out across all claims on this version. There is
    // no version-scoped query on the packets DB, so we aggregate per-claim
    // packets and dedupe defensively by id.
    let evidencePackets = [];
    if (claims.length > 0) {
      const packetGroups = await Promise.all(
        claims.map(c => getPacketsForClaim(c.id).catch(() => []))
      );
      const seen = new Set();
      for (const group of packetGroups) {
        for (const pkt of group) {
          if (!seen.has(pkt.id)) {
            seen.add(pkt.id);
            evidencePackets.push(pkt);
          }
        }
      }
      // Stable sort by sortOrder (nulls last), mirroring getPacketsForClaim.
      evidencePackets.sort((a, b) => {
        const av = a.sortOrder ?? Number.POSITIVE_INFINITY;
        const bv = b.sortOrder ?? Number.POSITIVE_INFINITY;
        return av - bv;
      });
    }

    const sectionHealth = computeSectionHealth({
      doc,
      version,
      revisionEvents,
      formulaLines,
      claims,
      evidencePackets,
      references,
    });

    // Wave 5.5 — surface related labels so the Living PCS header can offer
    // the "Draft label copy" affordance only when there is a label to target.
    const labels = await getLabelsForPcs(id).catch(() => []);

    return NextResponse.json({
      document: doc,
      version,
      sectionHealth,
      revisionEvents,
      formulaLines,
      claims,
      evidencePackets,
      references,
      labels,
    });
  } catch (err) {
    if (err?.code === 'object_not_found') {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    throw err;
  }
}
