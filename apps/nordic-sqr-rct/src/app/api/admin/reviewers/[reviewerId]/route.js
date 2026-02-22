import { authenticateRequest, verifyAdminFromNotion } from '@/lib/auth';
import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function PATCH(request, { params }) {
  try {
    // Authenticate and check admin status
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const isAdmin = await verifyAdminFromNotion(user);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { reviewerId } = params;

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
