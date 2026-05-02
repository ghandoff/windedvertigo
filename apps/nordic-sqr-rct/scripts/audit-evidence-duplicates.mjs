#!/usr/bin/env node
/**
 * Evidence Library uniqueness audit — Wave 7.0.5 T8.
 *
 * Per Gina's 2026-04-19 architecture review (see
 * `docs/plans/wave-7.0.5-multi-profile-architecture-refinements.md` §2 T8):
 * one canonical Evidence row per (DOI OR PMID). The per-claim researcher
 * annotation attaches to the `evidence_packet` (Evidence × Claim join), NOT
 * to a duplicate Evidence row. The current library has multiple rows
 * referencing the same study with slight text variations — this is a bug.
 *
 * This script IDENTIFIES duplicates only. It does NOT merge them. Merging
 * is follow-up T8.1 and must be operator-reviewed. A `--merge-plan` flag
 * writes JSON design artifacts for operator review; `--merge` is NOT
 * implemented in this wave.
 *
 * Run:
 *   node scripts/audit-evidence-duplicates.mjs
 *   node scripts/audit-evidence-duplicates.mjs --dry-run          # alias; audit is read-only already
 *   node scripts/audit-evidence-duplicates.mjs --limit=50         # cap Evidence rows scanned
 *   node scripts/audit-evidence-duplicates.mjs --merge-plan       # write per-cluster plan JSON under /tmp
 *   node scripts/audit-evidence-duplicates.mjs --merge-plan --cluster=3
 *
 * Env: reads .env.local (NOTION_TOKEN, NOTION_PCS_EVIDENCE_DB,
 * NOTION_PCS_EVIDENCE_PACKETS_DB).
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Load env (same pattern as other scripts/ files) ────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const envCandidates = ['.env.local', '.env.local.migration'];
let envLoaded = 0;
for (const candidate of envCandidates) {
  const envFile = resolve(projectRoot, candidate);
  if (!existsSync(envFile)) continue;
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    let val = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    val = val.replace(/\\n$/, '').trim();
    if (!process.env[key]) {
      process.env[key] = val;
      envLoaded++;
    }
  }
}
if (envLoaded === 0) {
  console.error('[audit] warning: no env values loaded — expected NOTION_TOKEN, NOTION_PCS_EVIDENCE_DB, NOTION_PCS_EVIDENCE_PACKETS_DB.');
}

// ─── Args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const arg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
};
const DRY_RUN = flag('dry-run'); // alias; audit is already read-only
const LIMIT = arg('limit') ? parseInt(arg('limit'), 10) : null;
const MERGE_PLAN = flag('merge-plan');
const CLUSTER_FILTER = arg('cluster') ? parseInt(arg('cluster'), 10) : null;

// ─── Imports (deferred so env loads first) ──────────────────────────────────
const { getAllEvidence } = await import('../src/lib/pcs-evidence.js');
const { notion } = await import('../src/lib/notion.js');
const { PCS_DB, PROPS } = await import('../src/lib/pcs-config.js');

// ─── Normalization rules ────────────────────────────────────────────────────
/**
 * Normalize DOI: lowercase, strip `https://doi.org/` / `doi:` prefixes, trim.
 * Returns null for empty/unusable input.
 */
export function normalizeDoi(raw) {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
  s = s.replace(/^doi:\s*/, '');
  s = s.trim();
  // A bare "10." prefix is the minimum-viable DOI shape.
  if (!s.startsWith('10.')) return null;
  return s;
}

/**
 * Normalize PMID: strip `PMID:` prefix, trim, must be numeric.
 * Returns null for empty/unusable input.
 */
export function normalizePmid(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/^pmid:\s*/i, '').trim();
  if (!/^\d+$/.test(s)) return null;
  return s;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Evidence Duplicate Audit ===');
  if (DRY_RUN) console.log('(dry-run mode — audit is read-only by design)');

  let rows = await getAllEvidence(100);
  if (LIMIT && rows.length > LIMIT) {
    console.log(`Limiting to first ${LIMIT} of ${rows.length} rows.`);
    rows = rows.slice(0, LIMIT);
  }

  // Build canonical key → rows map
  const byKey = new Map(); // key = `doi:X` or `pmid:Y`
  const unidentifiable = [];
  for (const row of rows) {
    const doi = normalizeDoi(row.doi);
    const pmid = normalizePmid(row.pmid);
    const keys = [];
    if (doi) keys.push(`doi:${doi}`);
    if (pmid) keys.push(`pmid:${pmid}`);
    if (keys.length === 0) {
      unidentifiable.push(row);
      continue;
    }
    // Attach to every key this row carries — if a row has both DOI + PMID
    // it will show up in both clusters, which surfaces DOI↔PMID cross-refs.
    for (const k of keys) {
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(row);
    }
  }

  const clusters = [...byKey.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, rows: list }));

  console.log(`Scanned ${rows.length} Evidence rows.`);
  console.log(`Canonical identifiers found: ${byKey.size} unique DOIs/PMIDs`);
  console.log(`Unidentifiable rows (no DOI and no PMID): ${unidentifiable.length}`);
  console.log(`Duplicate clusters: ${clusters.length}`);
  console.log('');

  // Build evidence_packet reference counts per row (one query per cluster row)
  // — small N expected; if clusters are huge, batch later.
  const packetCountCache = new Map();
  async function countPacketsForEvidence(evidenceId) {
    if (packetCountCache.has(evidenceId)) return packetCountCache.get(evidenceId);
    try {
      const res = await notion.databases.query({
        database_id: PCS_DB.evidencePackets,
        filter: {
          property: PROPS.evidencePackets.evidenceItem,
          relation: { contains: evidenceId },
        },
        page_size: 100,
      });
      // Note: .has_more handled approximately — we record count-at-page.
      const count = res.results.length + (res.has_more ? 100 : 0);
      packetCountCache.set(evidenceId, count);
      return count;
    } catch (err) {
      console.error(`[audit] packet lookup failed for ${evidenceId}: ${err.message}`);
      packetCountCache.set(evidenceId, -1);
      return -1;
    }
  }

  // Render clusters
  let totalDupRows = 0;
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    const idx = i + 1;
    if (CLUSTER_FILTER && CLUSTER_FILTER !== idx) continue;

    // Sort: earliest created first
    const sorted = [...c.rows].sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));
    const packetCounts = [];
    for (const r of sorted) {
      packetCounts.push(await countPacketsForEvidence(r.id));
    }

    totalDupRows += sorted.length;
    console.log(`Cluster ${idx} — ${c.key.replace(':', ': ')}`);
    sorted.forEach((r, j) => {
      const shortId = r.id.replace(/-/g, '').slice(0, 8);
      const title = r.name || '(untitled)';
      const createdDate = (r.createdTime || '').slice(0, 10);
      console.log(`  [${j + 1}] Page ${shortId} — "${title}" — created ${createdDate}`);
    });
    console.log(`  ${packetCounts.reduce((a, b) => a + Math.max(0, b), 0)} evidence packets reference cluster rows (${packetCounts.join(', ')} respectively)`);

    // Suggested canonical: earliest created; tie-break by richest canonicalSummary
    const canonical = [...sorted].sort((a, b) => {
      const ta = new Date(a.createdTime).getTime();
      const tb = new Date(b.createdTime).getTime();
      if (ta !== tb) return ta - tb;
      return (b.canonicalSummary?.length || 0) - (a.canonicalSummary?.length || 0);
    })[0];
    const canonicalPos = sorted.findIndex((r) => r.id === canonical.id) + 1;
    console.log(`  Suggested canonical: [${canonicalPos}] (earliest created, richest abstract)`);
    const others = sorted.filter((r) => r.id !== canonical.id).map((r, k) => `[${sorted.indexOf(r) + 1}]`);
    console.log(`  Action: MERGE → ${others.join(' and ')} collapse into [${canonicalPos}]; all evidence_packet references re-point; preserve claim_linkage_note from each`);
    console.log('');

    if (MERGE_PLAN) {
      const plan = {
        clusterIndex: idx,
        canonicalKey: c.key,
        generatedAt: new Date().toISOString(),
        survivor: {
          id: canonical.id,
          name: canonical.name,
          doi: canonical.doi || null,
          pmid: canonical.pmid || null,
          createdTime: canonical.createdTime,
          canonicalSummaryLength: canonical.canonicalSummary?.length || 0,
        },
        merged: sorted
          .filter((r) => r.id !== canonical.id)
          .map((r) => ({
            id: r.id,
            name: r.name,
            doi: r.doi || null,
            pmid: r.pmid || null,
            createdTime: r.createdTime,
            canonicalSummaryLength: r.canonicalSummary?.length || 0,
            evidencePacketCount: packetCounts[sorted.indexOf(r)],
          })),
        annotationPolicy:
          'Preserve per-packet: each evidence_packet row keeps its own claim_linkage_note / relevance_note. ' +
          'Do NOT concatenate annotations onto the surviving Evidence row — per-claim reasoning lives on the join. ' +
          '(Gina 2026-04-19: "The only real variation should be a notation from the researcher as to how the findings reflect on the claim.")',
        rePointActions: sorted
          .filter((r) => r.id !== canonical.id)
          .map((r) => ({
            evidenceRowToRetire: r.id,
            evidencePacketsToRePoint: packetCounts[sorted.indexOf(r)],
            action: `UPDATE evidence_packet.evidenceItem WHERE evidenceItem = ${r.id} SET evidenceItem = ${canonical.id}`,
          })),
        warnings: [],
      };
      // Flag warnings
      if (plan.merged.some((m) => m.canonicalSummaryLength > plan.survivor.canonicalSummaryLength)) {
        plan.warnings.push('A merged row has a richer canonicalSummary than the survivor — operator should review and copy best summary forward before retiring.');
      }
      if (packetCounts.some((n) => n === -1)) {
        plan.warnings.push('Evidence packet count lookup failed for one or more rows — re-run before executing merge.');
      }
      const planDir = '/tmp';
      try {
        mkdirSync(planDir, { recursive: true });
      } catch { /* ignore */ }
      const planPath = `${planDir}/evidence-merge-plan-cluster-${idx}.json`;
      writeFileSync(planPath, JSON.stringify(plan, null, 2));
      console.log(`  → merge plan written: ${planPath}`);
      console.log('');
    }
  }

  const uniqueDupRowIds = new Set();
  for (const c of clusters) for (const r of c.rows) uniqueDupRowIds.add(r.id);
  const netSavings = uniqueDupRowIds.size - clusters.length;

  console.log('=== Summary ===');
  console.log(`${clusters.length} clusters totaling ${uniqueDupRowIds.size} duplicate rows.`);
  if (clusters.length > 0) {
    console.log(`If merged, Evidence Library shrinks from ${rows.length} to ${rows.length - netSavings} rows (${rows.length === 0 ? '0' : (-(netSavings / rows.length) * 100).toFixed(1)}%).`);
  }
  if (unidentifiable.length > 0) {
    console.log(`${unidentifiable.length} rows have no DOI and no PMID — they cannot be deduped by this script. Consider a separate title/citation fuzzy-match pass.`);
  }
  console.log('Suggested next step: run `--merge-plan --cluster=N` to review the merge plan for cluster N, then `--merge --cluster=N --confirm` to execute (merge execution is T8.1, NOT implemented in this wave).');
}

main().catch((err) => {
  console.error('[audit] fatal:', err);
  process.exit(1);
});
