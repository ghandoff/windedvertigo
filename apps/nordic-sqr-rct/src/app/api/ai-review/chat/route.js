/**
 * Per-item assisted-review chat endpoint.
 *
 * Takes a reviewer's objection to a specific rubric item's AI-drafted
 * score, sends it to the LLM with full study context, and returns a
 * revised score proposal for that single question.
 *
 * Why not streaming: the initial response target is a short JSON
 * envelope (revised score + rationale, <= 300 tokens typical). The
 * existing non-streaming pattern in /api/ai-review works fine here
 * and keeps the response validation simple. If per-turn latency
 * becomes a problem we can add streaming via messages.stream() in
 * a follow-up without breaking the contract.
 *
 * Session model: the client owns the conversation state. Each POST
 * sends the full message history for the item being challenged;
 * the server rebuilds context fresh per call. Cheap because the
 * per-item scope keeps tokens small.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getStudyById } from '@/lib/notion';
import { getRubricByVersion, DEFAULT_RUBRIC_VERSION } from '@/lib/rubric';

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'anthropic';
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-5-20250929';

function buildSystemPrompt(questionSpec) {
  return `You are an expert research methodology reviewer. A human reviewer is challenging your scoring of a single rubric item and you are in a back-and-forth to arrive at the correct score.

The item under discussion is:

${questionSpec.id.toUpperCase()} — ${questionSpec.label}
${questionSpec.description}

Valid scoring options (pick ONE):
${questionSpec.options.map(o => `- notionValue: "${o.notionValue}"\n  Criteria: ${o.criteria.join('; ')}`).join('\n')}

Your job each turn:
1. Read the reviewer's challenge carefully.
2. Decide whether to hold your current score, revise upward, or revise downward.
3. Respond with a JSON object: {"revisedScore": "<exact notionValue string>", "rationale": "<2-4 sentences citing the specific study detail that drove your decision>"}

Be willing to change your mind when the reviewer cites a specific manuscript detail you missed or misread. Do not capitulate just to agree — if the reviewer's challenge misreads the study, explain why and hold the score. Always return EXACTLY one of the valid notionValue strings.`;
}

function buildContextMessage(study, questionId, proposedScore) {
  // Field names match parseIntakePage() in src/lib/notion.js
  const lines = [
    `Study under review:`,
    `- Citation: ${study.citation || 'n/a'}`,
    `- Year: ${study.year || 'n/a'}`,
    `- DOI: ${study.doi || 'n/a'}`,
    `- Journal: ${study.journal || 'n/a'}`,
    `- Purpose: ${study.purposeOfResearch || 'n/a'}`,
    `- Design: ${study.studyDesign || 'n/a'}`,
    `- Inclusion criteria: ${study.inclusionCriteria || 'n/a'}`,
    `- Exclusion criteria: ${study.exclusionCriteria || 'n/a'}`,
    `- Recruitment: ${study.recruitment || 'n/a'}`,
    `- Initial N: ${study.initialN ?? 'n/a'}  |  Final N: ${study.finalN ?? 'n/a'}`,
    `- Ages: ${study.ages || 'n/a'}`,
    `- Blinding: ${study.blinding || 'n/a'}`,
    `- A priori power: ${study.aPrioriPower || 'n/a'}`,
    `- Independent variables: ${study.independentVariables || 'n/a'}`,
    `- Dependent variables: ${study.dependentVariables || 'n/a'}`,
    `- Control variables: ${study.controlVariables || 'n/a'}`,
    `- Timing of measures: ${study.timingOfMeasures || 'n/a'}`,
    `- Statistical methods: ${study.statisticalMethods || 'n/a'}`,
    `- Missing data handling: ${study.missingDataHandling || 'n/a'}`,
    `- Key results: ${study.keyResults || 'n/a'}`,
    `- Authors' conclusion: ${study.authorsConclusion || 'n/a'}`,
    `- Strengths (per authors): ${study.strengths || 'n/a'}`,
    `- Limitations (per authors): ${study.limitations || 'n/a'}`,
    `- Potential biases (per authors): ${study.potentialBiases || 'n/a'}`,
    `- Funding source(s): ${study.fundingSources || 'n/a'}`,
    ``,
    `Current proposed score for ${questionId}: "${proposedScore}"`,
  ];
  return lines.join('\n');
}

async function callAnthropicMessages(system, messages) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: LLM_API_KEY });
  const response = await client.messages.create({
    model: LLM_MODEL,
    max_tokens: 800,
    temperature: 0,
    system,
    messages,
  });
  return response.content[0]?.text || '';
}

async function callOpenAIMessages(system, messages) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: LLM_API_KEY });
  const completion = await client.chat.completions.create({
    model: LLM_MODEL,
    temperature: 0,
    max_tokens: 800,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, ...messages],
  });
  return completion.choices[0]?.message?.content || '';
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch { /* fallthrough */ }
  const code = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (code) { try { return JSON.parse(code[1].trim()); } catch { /* fallthrough */ } }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) { try { return JSON.parse(brace[0]); } catch { /* fallthrough */ } }
  return null;
}

export async function POST(request) {
  // Wave 7.5 Batch C — assisted-review chat is part of the AI-review surface.
  const gate = await requireCapability(request, 'sqr.ai-review:run', { route: '/api/ai-review/chat' });
  if (gate.error) return gate.error;

  if (!LLM_API_KEY) {
    return NextResponse.json({ error: 'LLM_API_KEY not configured' }, { status: 500 });
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const {
    studyId,
    questionId,
    rubricVersion = DEFAULT_RUBRIC_VERSION,
    proposedScore,
    messages = [],
  } = body;

  if (!studyId || !questionId) {
    return NextResponse.json({ error: 'studyId and questionId are required' }, { status: 400 });
  }

  const rubric = getRubricByVersion(rubricVersion);
  const questionSpec = rubric.find(q => q.id === questionId);
  if (!questionSpec) {
    return NextResponse.json({ error: `Unknown question ${questionId} for rubric ${rubricVersion}` }, { status: 400 });
  }

  let study;
  try { study = await getStudyById(studyId); }
  catch {
    return NextResponse.json({ error: 'Study not found' }, { status: 404 });
  }

  const systemPrompt = buildSystemPrompt(questionSpec);
  const contextMessage = buildContextMessage(study, questionId, proposedScore);

  // Prepend the study context as the first user message so it's part of
  // the conversation root — this is cheaper than re-sending it every turn
  // because Claude prompt-caches the system + first user turn.
  const fullMessages = [
    { role: 'user', content: contextMessage },
    ...messages,
  ];

  let responseText;
  try {
    if (LLM_PROVIDER === 'openai') {
      responseText = await callOpenAIMessages(systemPrompt, fullMessages);
    } else {
      responseText = await callAnthropicMessages(systemPrompt, fullMessages);
    }
  } catch (err) {
    console.error('Chat LLM call failed:', err);
    return NextResponse.json({ error: 'LLM call failed', details: err.message }, { status: 502 });
  }

  const parsed = extractJSON(responseText);
  if (!parsed || !parsed.revisedScore || !parsed.rationale) {
    return NextResponse.json({
      error: 'LLM response could not be parsed',
      raw: responseText.slice(0, 500),
    }, { status: 502 });
  }

  // Validate that the revisedScore matches one of the valid notionValues
  // for this question. If not, reject — we don't want to submit garbage
  // to Notion even if the LLM hallucinates a new option.
  const validValues = questionSpec.options.map(o => o.notionValue);
  if (!validValues.includes(parsed.revisedScore)) {
    // Fuzzy-match to the closest valid value by leading score number
    const prefix = parsed.revisedScore.match(/^(\d)/)?.[1];
    const fallback = prefix ? validValues.find(v => v.startsWith(prefix)) : null;
    if (fallback) {
      parsed.revisedScore = fallback;
      parsed.rationale += ` (Score string coerced to the nearest valid notionValue.)`;
    } else {
      return NextResponse.json({
        error: 'LLM returned an invalid score string',
        returned: parsed.revisedScore,
        validOptions: validValues,
      }, { status: 502 });
    }
  }

  return NextResponse.json({
    questionId,
    revisedScore: parsed.revisedScore,
    rationale: parsed.rationale,
    assistantMessage: JSON.stringify({ revisedScore: parsed.revisedScore, rationale: parsed.rationale }),
  });
}
