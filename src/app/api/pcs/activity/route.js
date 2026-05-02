import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { notion } from '@/lib/notion';
import { PCS_DB } from '@/lib/pcs-config';

/**
 * GET /api/pcs/activity?limit=30
 *
 * Returns recently edited pages across the 5 core PCS databases
 * (documents, claims, evidence, requests, versions), sorted by
 * last_edited_time descending. This powers the activity feed.
 */
export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.evidence:read', { route: '/api/pcs/activity' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 50);

  try {
    // Query the 5 most relevant databases for recent edits
    const databases = [
      { db: PCS_DB.documents, type: 'document', titleProp: 'PCS ID' },
      { db: PCS_DB.claims, type: 'claim', titleProp: 'Claim' },
      { db: PCS_DB.evidenceLibrary, type: 'evidence', titleProp: 'Name' },
      { db: PCS_DB.requests, type: 'request', titleProp: 'Request' },
      { db: PCS_DB.versions, type: 'version', titleProp: 'Version' },
    ];

    const results = await Promise.all(
      databases.map(async ({ db, type, titleProp }) => {
        if (!db) return [];
        try {
          const res = await notion.databases.query({
            database_id: db,
            sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
            page_size: 10,
          });
          return res.results.map(page => {
            const title = extractTitle(page.properties, titleProp);
            return {
              id: page.id,
              type,
              title: title || 'Untitled',
              lastEditedTime: page.last_edited_time,
              createdTime: page.created_time,
              lastEditedBy: page.last_edited_by?.id || null,
              isNew: page.created_time === page.last_edited_time,
            };
          });
        } catch {
          return [];
        }
      })
    );

    // Flatten, sort by last edited, limit
    const all = results
      .flat()
      .sort((a, b) => new Date(b.lastEditedTime) - new Date(a.lastEditedTime))
      .slice(0, limit);

    return NextResponse.json({ activity: all });
  } catch (error) {
    console.error('Activity feed error:', error);
    return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 });
  }
}

function extractTitle(properties, titleProp) {
  const prop = properties[titleProp];
  if (!prop) return null;
  if (prop.title) return prop.title[0]?.plain_text || null;
  if (prop.rich_text) return prop.rich_text[0]?.plain_text || null;
  return null;
}
