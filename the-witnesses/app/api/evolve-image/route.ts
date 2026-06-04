import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { getEvolutionPrompt, NEGATIVE_PROMPT } from '@/lib/image-gen';
import type { CharacterKey } from '@/lib/session';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(request: NextRequest) {
  let prevImageUrl = '';
  try {
    const body = await request.json() as {
      prevImageUrl: string;
      character: CharacterKey;
      objectChoice?: string;
      erasedElement?: string;
      imageSeed: number;
    };
    const { character, objectChoice, erasedElement, imageSeed } = body;
    prevImageUrl = body.prevImageUrl;

    // Builder returns prevImageUrl immediately (no API call)
    if (character === 'builder') {
      return NextResponse.json({ imageUrl: prevImageUrl });
    }

    const prompt = getEvolutionPrompt(character, { objectChoice, erasedElement });
    if (!prompt) {
      return NextResponse.json({ imageUrl: prevImageUrl });
    }

    // Use flux-dev img2img
    const output = await replicate.run('black-forest-labs/flux-dev', {
      input: {
        prompt,
        image: prevImageUrl,
        prompt_strength: 0.7,
        seed: imageSeed,
        num_outputs: 1,
        negative_prompt: NEGATIVE_PROMPT,
      },
    });

    const imageUrl = Array.isArray(output) ? output[0] : output;
    if (!imageUrl) {
      return NextResponse.json({ imageUrl: prevImageUrl });
    }

    return NextResponse.json({ imageUrl: String(imageUrl) });
  } catch (err) {
    console.error('Evolve image error:', err);
    return NextResponse.json({ imageUrl: prevImageUrl || null, error: 'Evolution failed' });
  }
}
