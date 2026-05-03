import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Mimic the backfill script's env-load (Next.js auto-loads .env.local in production)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const { getAllDocuments } = await import('../src/lib/pcs-documents.js');
const { getAllClaims, getClaimsWithoutEvidence } = await import('../src/lib/pcs-claims.js');
const { getOpenRequests } = await import('../src/lib/pcs-requests.js');
const { getAllEvidence } = await import('../src/lib/pcs-evidence.js');
const { getAllEvidencePackets } = await import('../src/lib/pcs-evidence-packets.js');

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    console.log(`  ok  ${name}: ${Array.isArray(r) ? r.length : '?'} (${Date.now()-t0}ms)`);
    return r;
  } catch (e) {
    console.log(`  ERR ${name}: ${e.message}`);
    return null;
  }
}

await step('getAllDocuments', getAllDocuments);
await step('getAllClaims', () => getAllClaims());
await step('getClaimsWithoutEvidence', getClaimsWithoutEvidence);
await step('getOpenRequests', getOpenRequests);
await step('getAllEvidence', getAllEvidence);
await step('getAllEvidencePackets', getAllEvidencePackets);
