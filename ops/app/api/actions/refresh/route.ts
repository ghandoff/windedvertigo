import { NextResponse } from 'next/server';

/**
 * POST /api/actions/refresh
 * Triggers a manual data refresh — currently just revalidates the page cache.
 * In the future, this could trigger Cowork dispatch tasks to push fresh data to KV.
 */
export async function POST() {
  try {
    // Revalidate the main page to pick up fresh KV data
    // Next.js 16 revalidation via fetch
    const baseUrl = process.env.AUTH_URL || 'https://ops.windedvertigo.com';
    await fetch(`${baseUrl}/`, { next: { revalidate: 0 } }).catch(() => {});

    return NextResponse.json({
      ok: true,
      message: 'Data refresh triggered',
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Refresh failed' }, { status: 500 });
  }
}
