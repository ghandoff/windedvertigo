import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getCommentsForPage, addComment, groupByThread } from '@/lib/pcs-comments';

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/**
 * GET /api/pcs/comments?pageId=<id>&grouped=true
 * Read comments on any PCS entity.
 */
export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.evidence:read', { route: '/api/pcs/comments' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get('pageId');
  if (!pageId || !UUID_RE.test(pageId)) {
    return NextResponse.json({ error: 'Invalid page ID format' }, { status: 400 });
  }

  try {
    const comments = await getCommentsForPage(pageId);
    const grouped = searchParams.get('grouped') === 'true';
    return NextResponse.json({
      comments: grouped ? groupByThread(comments) : comments,
      total: comments.length,
    });
  } catch (error) {
    console.error('Comments fetch error:', {
      code: error?.code,
      status: error?.status,
      message: error?.message,
      body: error?.body,
    });
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

/**
 * POST /api/pcs/comments
 * Add a comment to any PCS entity.
 * Body: { pageId, text, discussionId? }
 */
export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.evidence:edit', { route: '/api/pcs/comments' });
  if (auth.error) return auth.error;

  try {
    const { pageId, text, discussionId } = await request.json();
    if (!pageId || !UUID_RE.test(pageId)) {
      return NextResponse.json({ error: 'Invalid page ID format' }, { status: 400 });
    }
    if (!text?.trim()) {
      return NextResponse.json({ error: 'pageId and text are required' }, { status: 400 });
    }

    const comment = await addComment(pageId, text, discussionId || null);

    return NextResponse.json({
      comment,
      author: {
        name: `${auth.user.firstName || ''} ${auth.user.lastName || ''}`.trim() || auth.user.alias || 'Unknown',
        alias: auth.user.alias || null,
      },
    });
  } catch (error) {
    console.error('Comment create error:', error);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
