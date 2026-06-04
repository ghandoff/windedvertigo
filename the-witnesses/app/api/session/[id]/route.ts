import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { Visit } from '@/lib/session';
import { isDemoMode, demoPatch } from '@/lib/demo-store';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (isDemoMode) {
      if ('seedPhrase' in body) demoPatch(id, { seed_phrase: body.seedPhrase });
      if ('seedImageUrl' in body) demoPatch(id, { seed_image_url: body.seedImageUrl });
      if ('seedName' in body) demoPatch(id, { seed_name: body.seedName });
      if ('visit' in body) demoPatch(id, { visit: body.visit });
      return NextResponse.json({ ok: true });
    }

    const supabase = createServerClient();

    if ('seedPhrase' in body) {
      const { error } = await supabase
        .from('witnesses_sessions')
        .update({ seed_phrase: body.seedPhrase })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if ('seedImageUrl' in body) {
      const { error } = await supabase
        .from('witnesses_sessions')
        .update({ seed_image_url: body.seedImageUrl })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if ('seedName' in body) {
      const { error } = await supabase
        .from('witnesses_sessions')
        .update({ seed_name: body.seedName })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if ('visit' in body) {
      // Append visit to array
      const visit: Visit = body.visit;
      // Fetch current visits
      const { data: current, error: fetchError } = await supabase
        .from('witnesses_sessions')
        .select('visits')
        .eq('id', id)
        .single();
      if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

      const visits = Array.isArray(current?.visits) ? current.visits : [];
      visits.push(visit);

      const { error } = await supabase
        .from('witnesses_sessions')
        .update({ visits })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Session PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
