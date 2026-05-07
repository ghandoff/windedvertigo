/**
 * GET /api/r2/[...path]
 *
 * Proxy handler for objects stored in the NORDIC_ASSETS R2 bucket.
 *
 * Auth policy by prefix:
 *   evidence-pdfs/*  — requires pcs.evidence:read capability (browser opens
 *                      these via authenticated session)
 *   pcs-imports/*    — no auth required (UUID key is the de-facto secret;
 *                      the import extraction cron fetches via plain fetch())
 *   label-imports/*  — no auth required (same reasoning as pcs-imports)
 *   profiles/*       — no auth required (profile photos are semi-public)
 *   everything else  — requires pcs.evidence:read by default
 *
 * Example:
 *   GET /api/r2/evidence-pdfs/10.1016_j.foo.2024.pdf
 *   GET /api/r2/pcs-imports/abc123-study.pdf
 *
 * Legacy Vercel Blob URLs (*.public.blob.vercel-storage.com) continue to be
 * served directly by Vercel Blob until the Vercel project is decommissioned.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireCapability } from '@/lib/auth/require-capability';

export const dynamic = 'force-dynamic';

// Prefixes that do NOT require auth — served publicly by design.
const PUBLIC_PREFIXES = ['pcs-imports/', 'label-imports/', 'profiles/'];

export async function GET(request, { params }) {
  const { path } = await params;
  const key = Array.isArray(path) ? path.join('/') : path;

  const isPublic = PUBLIC_PREFIXES.some(p => key.startsWith(p));
  if (!isPublic) {
    const auth = await requireCapability(request, 'pcs.evidence:read', {
      route: '/api/r2/[...path]',
    });
    if (auth.error) return auth.error;
  }

  let bucket;
  try {
    const { env } = await getCloudflareContext({ async: true });
    bucket = env.NORDIC_ASSETS;
  } catch {
    return new Response('R2 storage unavailable', { status: 503 });
  }

  if (!bucket) {
    return new Response('R2 storage not configured', { status: 503 });
  }

  const object = await bucket.get(key);
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream';

  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
      'Content-Length': String(object.size),
    },
  });
}
