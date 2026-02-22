import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { authenticateRequest } from '@/lib/auth';

export async function POST(request) {
  try {
    // Vercel Blob requires BLOB_READ_WRITE_TOKEN
    // On Vercel: auto-injected via Settings → Storage → Connect Blob Store
    // Locally: add to .env.local (generate at vercel.com/dashboard/stores)
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('Upload failed: BLOB_READ_WRITE_TOKEN is not set');
      return NextResponse.json({
        error: 'Image storage is not configured. The BLOB_READ_WRITE_TOKEN environment variable is missing.',
      }, { status: 503 });
    }

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

    // Optionally delete old blob if a previous URL is provided
    const oldUrl = formData.get('oldUrl');
    if (oldUrl && oldUrl.includes('.vercel-storage.com')) {
      try {
        await del(oldUrl);
      } catch {
        // Old blob may not exist or may have already been deleted — ignore
      }
    }

    // Upload to Vercel Blob
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const filename = `profiles/${user.alias.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;

    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: true, // Prevent cache issues on re-upload
    });

    return NextResponse.json({ url: blob.url, success: true });
  } catch (error) {
    console.error('Upload error:', error);
    // Surface specific Vercel Blob errors
    const message = error?.message?.includes('BlobAccessError')
      ? 'Image storage authentication failed. Check BLOB_READ_WRITE_TOKEN.'
      : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
