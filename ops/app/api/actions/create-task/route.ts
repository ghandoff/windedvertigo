import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/actions/create-task
 * Creates a task in the Notion tasks database.
 * Body: { title: string, priority: 'high' | 'medium' | 'low', project?: string }
 */

const NOTION_TOKEN = process.env.NOTION_TOKEN;
// Tasks database — if you have one; otherwise falls back to projects DB
const TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;

export async function POST(req: NextRequest) {
  if (!NOTION_TOKEN) {
    return NextResponse.json(
      { ok: false, error: 'NOTION_TOKEN not configured' },
      { status: 503 }
    );
  }

  if (!TASKS_DB_ID) {
    return NextResponse.json(
      { ok: false, error: 'NOTION_TASKS_DB_ID not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { title, priority, project } = body as {
      title: string;
      priority: string;
      project?: string;
    };

    if (!title?.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    const properties: Record<string, unknown> = {
      Name: { title: [{ text: { content: title.trim() } }] },
    };

    if (priority) {
      properties['Priority'] = { select: { name: priority } };
    }

    if (project) {
      properties['Project'] = { select: { name: project } };
    }

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: TASKS_DB_ID },
        properties,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { ok: false, error: `Notion API: ${res.status}`, detail: err },
        { status: 502 }
      );
    }

    const page = await res.json();
    return NextResponse.json({
      ok: true,
      message: 'Task created',
      pageId: page.id,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to create task' }, { status: 500 });
  }
}
