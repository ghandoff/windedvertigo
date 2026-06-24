import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { isDemoMode, demoRead } from '@/lib/demo-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (isDemoMode) {
      const sess = demoRead(id);
      if (!sess) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      return NextResponse.json(sess);
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('witnesses_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Session read error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
