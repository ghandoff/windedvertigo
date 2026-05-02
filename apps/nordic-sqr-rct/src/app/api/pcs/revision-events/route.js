import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllRevisionEvents, getEventsForVersion,
  getEventsByActivityType, getEventsByDepartment, createRevisionEvent,
} from '@/lib/pcs-revision-events';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.revisions:read', { route: '/api/pcs/revision-events' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get('versionId');
  const activityType = searchParams.get('activityType');
  const dept = searchParams.get('dept');

  let events;
  if (versionId) {
    events = await getEventsForVersion(versionId);
  } else if (activityType) {
    events = await getEventsByActivityType(activityType);
  } else if (dept) {
    events = await getEventsByDepartment(dept);
  } else {
    events = await getAllRevisionEvents();
  }
  return NextResponse.json(events);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.revisions:read', { route: '/api/pcs/revision-events' });
  if (auth.error) return auth.error;

  const fields = await request.json();
  if (!fields.event) {
    return NextResponse.json({ error: 'event title is required' }, { status: 400 });
  }
  const event = await createRevisionEvent(fields);
  return NextResponse.json(event, { status: 201 });
}
