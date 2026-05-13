/**
 * POST /api/upload
 *
 * Profile photo upload. Accepts a multipart/form-data body with a `file`
 * field (JPEG/PNG/WebP, max 500 KB) and an optional `oldUrl` field.
 *
 * Storage: R2 bucket NORDIC_ASSETS (binding from wrangler.jsonc), served
 * via GET /api/r2/profiles/... which is publicly accessible.
 * Falls back to Vercel Blob in local dev without a wrangler binding.
 *
 * Returns: { url: string, success: true }
 */

import { NextResponse } from 'next/server';
// @vercel/blob imported dynamically in the local dev fallback below so it
// is never evaluated on CF Workers (where the module throws on init).
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authenticateRequest } from '@/lib/auth';

const NORDIC_URL = 'https://nordic.windedvertigo.com';

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File must be JPEG, PNG, or WebP' }, { status: 400 });
    }

    // Validate size (500 KB max — images are already resized client-side)
    if (file.size > 500 * 1024) {
      return NextResponse.json({ error: 'File too large (max 500 KB)' }, { status: 400 });
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    // Include a random suffix to bust caches on re-upload
    const randomSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const filename = `profiles/${user.alias.replace(/[^a-zA-Z0-9_-]/g, '_')}-${randomSuffix}.${ext}`;

    let url;
    try {
      const { env } = await getCloudflareContext({ async: true });
      const bucket = env.NORDIC_ASSETS;

      if (!bucket) {
        throw new Error('NORDIC_ASSETS R2 binding required (Vercel Blob fallback removed post-migration)');
      }
      const oldUrl = formData.get('oldUrl');
      if (oldUrl && typeof oldUrl === 'string' && oldUrl.includes('/api/r2/profiles/')) {
        try {
          const key = oldUrl.replace(/^.*\/api\/r2\//, '');
          await bucket.delete(key);
        } catch {
          // Old object may not exist — ignore
        }
      }

      await bucket.put(filename, file, {
        httpMetadata: { contentType: file.type },
      });
      url = `${NORDIC_URL}/api/r2/${filename}`;
    } catch (err) {
      console.error('[upload] storage write failed:', err);
      return NextResponse.json({ error: 'Upload failed' }, { status: 502 });
    }

    return NextResponse.json({ url, success: true });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
