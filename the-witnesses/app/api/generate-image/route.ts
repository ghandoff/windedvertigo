import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { LOCKED_STYLE, SEED_SUBJECT, NEGATIVE_PROMPT } from '@/lib/image-gen';

const isDemoMode = !process.env.REPLICATE_API_TOKEN;

const replicate = isDemoMode ? null : new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    // Demo mode: return null so the canvas fallback renders
    if (isDemoMode || !replicate) {
      return NextResponse.json({ imageUrl: null });
    }

    const { seedPhrase, imageSeed } = await request.json();

    const prompt = `${LOCKED_STYLE}\n\n${SEED_SUBJECT}\n\nContext note: the maker describes their creation as: "${seedPhrase}"`;

    const output = await replicate.run('black-forest-labs/flux-schnell', {
      input: {
        prompt,
        negative_prompt: NEGATIVE_PROMPT,
        seed: imageSeed,
        width: 512,
        height: 512,
        num_outputs: 1,
      },
    });

    const imageUrl = Array.isArray(output) ? output[0] : output;

    if (!imageUrl) {
      return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

    return NextResponse.json({ imageUrl: String(imageUrl) });
  } catch (err) {
    console.error('Generate image error:', err);
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
  }
}
