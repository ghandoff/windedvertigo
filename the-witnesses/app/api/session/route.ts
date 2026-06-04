import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateVisitOrder } from '@/lib/visitOrder';
import { isDemoMode, demoCreate } from '@/lib/demo-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const recipientName: string | undefined = body.recipientName;

    if (isDemoMode) {
      const result = demoCreate(recipientName);
      return NextResponse.json(result);
    }

    const imageSeed = Math.floor(Math.random() * 2147483647);
    const visitOrder = generateVisitOrder();

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('witnesses_sessions')
      .insert({
        recipient_name: recipientName ?? null,
        image_seed: imageSeed,
        visit_order: visitOrder,
        visits: [],
        round: 1,
      })
      .select('id, visit_order, image_seed')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      visitOrder: data.visit_order,
      imageSeed: data.image_seed,
    });
  } catch (err) {
    console.error('Session creation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
