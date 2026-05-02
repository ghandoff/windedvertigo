import { requireCapability } from '@/lib/auth/require-capability';
import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function PATCH(request, { params }) {
  try {
    // Wave 7.5 Batch C — modifying reviewer admin/status flags is a
    // user lifecycle action; gated on `users:edit-role`.
    const gate = await requireCapability(request, 'users:edit-role', { route: '/api/admin/reviewers/[reviewerId]' });
    if (gate.error) return gate.error;

    const body = await request.json();
    const { reviewerId } = await params;

    // Build update payload
    const properties = {};

    if (typeof body.isAdmin === 'boolean') {
      properties['Admin'] = { checkbox: body.isAdmin };
    }

    if (body.status && typeof body.status === 'string') {
      properties['Status'] = { select: { name: body.status } };
    }

    // Update the page if there are changes
    if (Object.keys(properties).length > 0) {
      await notion.pages.update({
        page_id: reviewerId,
        properties,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating reviewer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
