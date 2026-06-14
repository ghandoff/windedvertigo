/**
 * AI Research Chat — Budget C Marketing Intelligence Layer
 *
 * POST /api/pcs/ai-chat
 * Capability: pcs.market-explorer:view (super-user only until Budget C payment)
 *
 * Body: {
 *   messages: [{ role: 'user'|'assistant', content: string }],
 *   context: { ingredientId?: string }
 * }
 *
 * Returns a streaming plain-text response grounded exclusively in Nordic's
 * PCS claims and SQR-RCT scored evidence — NOT the open web.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';

export const dynamic = 'force-dynamic';

const LLM_API_KEY = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';

async function buildIngredientContext(ingredientId) {
  // Fetch the same payload the CAIPB ingredient dashboard uses — it's already
  // computed and cached in memory by the route handler.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nordic.windedvertigo.com';
  const res = await fetch(`${baseUrl}/api/pcs/caipb/ingredient/${ingredientId}`, {
    headers: { 'x-internal-service': '1' },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

function buildSystemPrompt(context) {
  if (!context) {
    return `You are the Nordic Research Platform AI assistant. You answer questions about ingredient substantiation using only Nordic's PCS database. If you don't have data, say so clearly.`;
  }

  const { ingredient, claims, products, formUsage } = context;
  const name = ingredient?.canonicalName || 'this ingredient';

  const claimLines = (claims || []).slice(0, 40).map(c => {
    const regions = (c.authorityRegions || []).join(', ') || 'unassigned';
    const dose = c.minDoseMg != null
      ? `≥${c.minDoseMg}${c.maxDoseMg && c.maxDoseMg !== c.minDoseMg ? `–${c.maxDoseMg}` : ''}mg`
      : 'dose not specified';
    const benefit = c.benefitCategory?.name || '';
    const evidence = c.evidenceCount != null ? `${c.evidenceCount} stud.` : '';
    const score = c.statusInputs?.meanScore != null
      ? `score ${Math.round(c.statusInputs.meanScore * 100)}%`
      : '';
    return `  - [${c.status || 'Unknown'}] "${c.claimText}" | ${benefit} | ${dose} | Regions: ${regions}${evidence ? ` | ${evidence}` : ''}${score ? ` | ${score}` : ''}`;
  }).join('\n');

  const productLines = (products || []).slice(0, 15).map(p =>
    `  - ${p.finishedGoodName || p.pcsId || '?'}${p.amountPerServing != null ? ` (${p.amountPerServing}${p.amountUnit ? ` ${p.amountUnit}` : ''})` : ''}`
  ).join('\n');

  const formLines = (formUsage || []).map(f => `  - ${f.form} (${f.count} products)`).join('\n');

  return `You are the Nordic Research Platform AI assistant — a research tool for Nordic Naturals' regulatory and marketing teams.

You answer questions about ${name} using ONLY the Nordic PCS database below. You do NOT search the internet or use general knowledge beyond what is listed here. If a question cannot be answered from this data, say so explicitly and suggest checking the full Evidence Library.

Always cite specific claim text, evidence counts, SQR-RCT scores, and dose thresholds when available. Be concise and direct.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INGREDIENT: ${name}
Category: ${ingredient?.category || 'Unknown'}
Standard unit: ${ingredient?.standardUnit || 'Unknown'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLAIMS IN NORDIC PCS (${(claims || []).length} total):
${claimLines || '  (none on file)'}

PRODUCTS USING ${name.toUpperCase()} (${(products || []).length}):
${productLines || '  (none on file)'}

FORMS IN USE:
${formLines || '  (none on file)'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data source: Nordic Research Platform PCS database. Not the internet.`;
}

export async function POST(request) {
  const gate = await requireCapability(request, 'pcs.market-explorer:view', {
    route: '/api/pcs/ai-chat',
  });
  if (gate.error) return gate.error;

  if (!LLM_API_KEY) {
    return NextResponse.json(
      { error: 'LLM_API_KEY not configured — add ANTHROPIC_API_KEY to Vercel env vars' },
      { status: 500 }
    );
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { messages = [], context = {} } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
  }

  // Build context payload
  let ingredientContext = null;
  if (context.ingredientId) {
    try {
      ingredientContext = await buildIngredientContext(context.ingredientId);
    } catch {
      // Non-fatal — fall back to generic system prompt
    }
  }

  const systemPrompt = buildSystemPrompt(ingredientContext);

  // Sanitize messages: only user/assistant roles, string content
  const safeMessages = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (safeMessages.length === 0 || safeMessages[safeMessages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: LLM_API_KEY });

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: safeMessages,
  });

  // Return a streaming response — each chunk is raw text
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta?.type === 'text_delta' &&
            chunk.delta.text
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n[Error: ${err.message}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
