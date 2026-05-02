import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { isAutoSyncEnabled } from '@/lib/sqr-sync';
import { isAutoFeedEnabled } from '@/lib/pcs-intake-feed';

export async function GET(request) {
  // Wave 7.5 Batch C — sync feature-flag status reads as audit-shaped data.
  const gate = await requireCapability(request, 'audit:read-logs', { route: '/api/admin/sync/status' });
  if (gate.error) return gate.error;

  return NextResponse.json({
    autoSync: isAutoSyncEnabled(),
    autoFeed: isAutoFeedEnabled(),
  });
}
