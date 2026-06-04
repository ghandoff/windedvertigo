import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ word: 'thing' });
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 16,
      messages: [
        {
          role: 'user',
          content: `Extract the single most interesting, concrete, or evocative word from this text. Return only the word, nothing else: ${text}`,
        },
      ],
    });

    const word = message.content[0].type === 'text'
      ? message.content[0].text.trim().toLowerCase().replace(/[^a-z']/g, '')
      : 'thing';

    return NextResponse.json({ word: word || 'thing' });
  } catch (err) {
    console.error('Extract word error:', err);
    return NextResponse.json({ word: 'thing' });
  }
}
