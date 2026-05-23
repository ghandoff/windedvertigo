import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getPcsSupabase } from '@/lib/supabase-pcs';

/**
 * GET /api/pcs/activity?limit=30
 *
 * Returns recently edited pages across the 5 core PCS tables sorted by
 * notion_last_edited_at descending. Powered by Postgres — zero Notion calls.
 *
 * Part 10 migration: replaced 5 concurrent Notion database queries with
 * 5 parallel Supabase queries (~40ms wall-clock vs ~1500ms Notion path).
 */
export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.evidence:read', { route: '/api/pcs/activity' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 50);

  try {
    const sb = getPcsSupabase();

    const tables = [
      { table: 'pcs_documents', type: 'document', titleCol: 'pcs_id' },
      { table: 'pcs_claims',    type: 'claim',    titleCol: 'claim' },
      { table: 'pcs_evidence',  type: 'evidence', titleCol: 'name' },
      { table: 'pcs_requests',  type: 'request',  titleCol: 'request' },
      { table: 'pcs_versions',  type: 'version',  titleCol: 'version_label' },
    ];

    const results = await Promise.all(
      tables.map(async ({ table, type, titleCol }) => {
        try {
          const { data, error } = await sb
            .from(table)
            .select(`notion_page_id, ${titleCol}, notion_last_edited_at, notion_created_at`)
            .order('notion_last_edited_at', { ascending: false, nullsFirst: false })
            .limit(10);
          if (error) throw error;
          return (data || []).map(row => ({
            id: row.notion_page_id,
            type,
            title: row[titleCol] || 'Untitled',
            lastEditedTime: row.notion_last_edited_at,
            createdTime: row.notion_created_at,
            lastEditedBy: null,  // not stored in Postgres
            isNew: row.notion_created_at === row.notion_last_edited_at,
          }));
        } catch {
          return [];
        }
      })
    );

    const all = results
      .flat()
      .sort((a, b) => {
        if (!a.lastEditedTime) return 1;
        if (!b.lastEditedTime) return -1;
        return new Date(b.lastEditedTime) - new Date(a.lastEditedTime);
      })
      .slice(0, limit);

    return NextResponse.json({ activity: all });
  } catch (error) {
    console.error('Activity feed error:', error);
    return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 });
  }
}
