import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getStudyById, getScoresForStudy } from '@/lib/notion';
import { callLLM } from '@/lib/llm';
import { buildScoringPrompt, validateLLMScores } from '@/lib/llm-prompt';
import { getRubricByVersion, DEFAULT_RUBRIC_VERSION } from '@/lib/rubric';
import {
  computeRepetitionKappa,
  computePositionShuffleKappa,
  computeGoldStandardKappa,
} from '@/lib/llm-reliability';
import { recordReliabilityRun } from '@/lib/reliability-store';

// Vercel function timeout headroom — clamp to 50s for safety on a default plan.
export const maxDuration = 60;

const APPROX_COST_PER_CALL = 0.01;

/**
 * Build a scoring prompt where the rubric questions are presented in a
 * deterministic but shuffled order, derived from a seed integer. The
 * underlying question IDs and notionValues are unchanged — only the order in
 * the prompt text moves. This isolates "position bias" from any other source
 * of variance.
 *
 * Implementation: we take the system + user prompt produced by the canonical
 * builder, then re-emit only the rubric block in the requested order. The
 * post-rubric "ARTICLE DATA" block is preserved verbatim so the LLM sees
 * identical study context across both runs.
 */
function buildShuffledScoringPrompt(study, version, seed) {
  // Reuse the canonical builder for the system prompt + the article-data
  // suffix, then splice in a re-ordered rubric block.
  const { systemPrompt } = buildScoringPrompt(study, version);
  const rubric = getRubricByVersion(version);

  const order = seededShuffle(rubric.map((q) => q.id), seed);
  const byId = Object.fromEntries(rubric.map((q) => [q.id, q]));

  let userPrompt = `## SCORING RUBRIC (${version}) — items presented in order [${order.join(', ')}]\n\n`;
  for (const qId of order) {
    const q = byId[qId];
    userPrompt += `### ${q.id.toUpperCase()}: ${q.label}\n`;
    userPrompt += `${q.description}\n\n`;
    userPrompt += 'Choose ONE of these exact options:\n';
    for (const opt of q.options) {
      userPrompt += `- notionValue: "${opt.notionValue}"\n`;
      userPrompt += `  Criteria: ${opt.criteria.join('; ')}\n`;
    }
    userPrompt += '\n';
  }

  userPrompt += '---\n\n## ARTICLE DATA\n\n';
  userPrompt += formatStudyData(study);
  userPrompt += '\n---\n\n';
  userPrompt += `Now score this article. Return ONLY a JSON object with keys q1-q${rubric.length} (each an exact notionValue string from above) and "reasoning" (a brief summary). Note: while the prompt presents items in a non-canonical order, the JSON keys you return must use the canonical q1, q2, ... naming.`;

  return { systemPrompt, userPrompt };
}

// Mulberry32 — a tiny seeded PRNG suitable for deterministic Fisher-Yates.
function seededShuffle(arr, seed) {
  const out = arr.slice();
  let s = (seed >>> 0) || 1;
  function rand() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Mirrors the field selection used by buildScoringPrompt.
function formatStudyData(data) {
  const fields = [
    ['Citation', data.citation], ['DOI', data.doi], ['Year', data.year],
    ['Journal', data.journal], ['Purpose of Research', data.purposeOfResearch],
    ['Study Design', data.studyDesign], ['Blinding', data.blinding],
    ['A Priori Power Estimation', data.aPrioriPower], ['Funding Sources', data.fundingSources],
    ['Inclusion Criteria', data.inclusionCriteria], ['Exclusion Criteria', data.exclusionCriteria],
    ['Recruitment', data.recruitment], ['Initial N', data.initialN], ['Final N', data.finalN],
    ['Ages (group means)', data.ages], ['Female Participants', data.femaleParticipants],
    ['Male Participants', data.maleParticipants], ['Location (Country)', data.locationCountry],
    ['Location (City)', data.locationCity], ['Timing of Measures', data.timingOfMeasures],
    ['Independent Variables', data.independentVariables],
    ['Dependent Variables', data.dependentVariables], ['Control Variables', data.controlVariables],
    ['Key Results', data.keyResults], ['Other Results', data.otherResults],
    ['Statistical Methods', data.statisticalMethods], ['Missing Data Handling', data.missingDataHandling],
    ['Authors\' Conclusion', data.authorsConclusion], ['Strengths', data.strengths],
    ['Limitations', data.limitations], ['Potential Biases', data.potentialBiases],
  ];
  return fields
    .filter(([, val]) => val != null && val !== '')
    .map(([label, val]) => `**${label}:** ${val}`)
    .join('\n');
}

async function singleLLMRun({ study, version, shuffleSeed }) {
  const { systemPrompt, userPrompt } = shuffleSeed != null
    ? buildShuffledScoringPrompt(study, version, shuffleSeed)
    : buildScoringPrompt(study, version);

  const t0 = Date.now();
  const llmResponse = await callLLM(systemPrompt, userPrompt);
  const latencyMs = Date.now() - t0;

  const validation = validateLLMScores(llmResponse, version);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors, latencyMs };
  }
  return {
    ok: true,
    scores: validation.scores,
    reasoning: validation.reasoning,
    latencyMs,
    shuffleSeed: shuffleSeed ?? null,
  };
}

export async function POST(request) {
  // Wave 7.5 Batch C — capability gate replaces authenticate + admin check.
  const gate = await requireCapability(request, 'sqr.ai-review:run', { route: '/api/ai-review/reliability' });
  if (gate.error) return gate.error;

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const {
    studyId,
    rubricVersion,
    mode,
    n: requestedN,
    goldScoreId,
  } = body || {};

  if (!studyId) return NextResponse.json({ error: 'studyId is required' }, { status: 400 });
  if (!['repetition', 'position-shuffle', 'gold-standard'].includes(mode)) {
    return NextResponse.json({ error: 'mode must be one of: repetition, position-shuffle, gold-standard' }, { status: 400 });
  }

  const version = rubricVersion || DEFAULT_RUBRIC_VERSION;

  let study;
  try { study = await getStudyById(studyId); }
  catch { return NextResponse.json({ error: 'Study not found' }, { status: 404 }); }
  if (!study?.citation) {
    return NextResponse.json({ error: 'Study not found or has no data' }, { status: 404 });
  }

  // Plan the runs. NOTE: we never call /api/ai-review/batch and never write
  // to Notion's Scores DB — these calls would pollute IRR data.
  const runs = [];
  const errors = [];

  try {
    if (mode === 'repetition') {
      const N = Math.min(Math.max(parseInt(requestedN, 10) || 5, 2), 10);
      for (let i = 0; i < N; i++) {
        const r = await singleLLMRun({ study, version });
        if (r.ok) runs.push(r); else errors.push({ runIndex: i, errors: r.errors });
      }
      if (runs.length < 2) {
        return NextResponse.json({
          error: 'Too few successful runs to compute repetition κ',
          details: errors,
        }, { status: 502 });
      }
      const kappa = computeRepetitionKappa(runs.map((r) => r.scores));
      const record = {
        mode, studyId, rubricVersion: version,
        timestamp: new Date().toISOString(),
        kappa: kappa.kappa, status: kappa.status,
        runCount: runs.length, callCount: runs.length,
        approxCostUSD: Math.round(runs.length * APPROX_COST_PER_CALL * 100) / 100,
        latencyMsTotal: runs.reduce((s, r) => s + r.latencyMs, 0),
        citation: study.citation,
      };
      recordReliabilityRun(record);
      return NextResponse.json({
        ...kappa,
        runs: runs.map((r, i) => ({ index: i, scores: r.scores, latencyMs: r.latencyMs })),
        errors,
        record,
      });
    }

    if (mode === 'position-shuffle') {
      // Two runs with different deterministic seeds.
      const seedA = 1;
      const seedB = 2;
      const r1 = await singleLLMRun({ study, version, shuffleSeed: seedA });
      const r2 = await singleLLMRun({ study, version, shuffleSeed: seedB });
      if (r1.ok) runs.push(r1); else errors.push({ runIndex: 0, errors: r1.errors });
      if (r2.ok) runs.push(r2); else errors.push({ runIndex: 1, errors: r2.errors });
      if (runs.length < 2) {
        return NextResponse.json({
          error: 'Too few successful runs to compute position-shuffle κ',
          details: errors,
        }, { status: 502 });
      }
      const kappa = computePositionShuffleKappa(runs[0].scores, runs[1].scores);
      const record = {
        mode, studyId, rubricVersion: version,
        timestamp: new Date().toISOString(),
        kappa: kappa.kappa, status: kappa.status,
        runCount: runs.length, callCount: runs.length,
        approxCostUSD: Math.round(runs.length * APPROX_COST_PER_CALL * 100) / 100,
        latencyMsTotal: runs.reduce((s, r) => s + r.latencyMs, 0),
        citation: study.citation,
        shuffleSeeds: [seedA, seedB],
      };
      recordReliabilityRun(record);
      return NextResponse.json({
        ...kappa,
        runs: runs.map((r, i) => ({ index: i, scores: r.scores, latencyMs: r.latencyMs, shuffleSeed: r.shuffleSeed })),
        errors,
        record,
      });
    }

    if (mode === 'gold-standard') {
      // The "gold" is an existing Score row in Notion. We fetch all scores
      // for this study and pick the one matching goldScoreId, falling back
      // to the most recent non-AI-Reviewer score if none specified.
      let scores;
      try { scores = await getScoresForStudy(studyId); }
      catch (err) {
        return NextResponse.json({ error: `Failed to fetch gold scores: ${err.message}` }, { status: 502 });
      }
      let gold;
      if (goldScoreId) {
        gold = scores.find((s) => s.id === goldScoreId);
      } else {
        gold = scores.find((s) => s.raterAlias && s.raterAlias !== 'AI-Reviewer');
      }
      if (!gold) {
        return NextResponse.json({
          error: 'No gold score available for this study. Provide goldScoreId or have a human reviewer score it first.',
        }, { status: 400 });
      }
      // Translate the gold row from numeric q1..qN into the same notionValue
      // strings the LLM produces so categorical comparison is meaningful.
      const rubric = getRubricByVersion(version);
      const goldScores = {};
      for (const q of rubric) {
        const numeric = gold[q.id];
        if (numeric == null) continue;
        const opt = q.options.find((o) => o.score === numeric);
        if (opt) goldScores[q.id] = opt.notionValue;
      }

      const r = await singleLLMRun({ study, version });
      if (r.ok) runs.push(r); else errors.push({ runIndex: 0, errors: r.errors });
      if (runs.length === 0) {
        return NextResponse.json({
          error: 'LLM run failed; no κ to compute',
          details: errors,
        }, { status: 502 });
      }
      const kappa = computeGoldStandardKappa(runs.map((r) => r.scores), goldScores);
      const record = {
        mode, studyId, rubricVersion: version,
        timestamp: new Date().toISOString(),
        kappa: kappa.kappa, status: kappa.status,
        runCount: runs.length, callCount: runs.length,
        approxCostUSD: Math.round(runs.length * APPROX_COST_PER_CALL * 100) / 100,
        latencyMsTotal: runs.reduce((s, r) => s + r.latencyMs, 0),
        citation: study.citation,
        goldScoreId: gold.id,
        goldRater: gold.raterAlias,
      };
      recordReliabilityRun(record);
      return NextResponse.json({
        ...kappa,
        gold: { id: gold.id, raterAlias: gold.raterAlias, scores: goldScores },
        runs: runs.map((r, i) => ({ index: i, scores: r.scores, latencyMs: r.latencyMs })),
        errors,
        record,
      });
    }

    return NextResponse.json({ error: 'Unhandled mode' }, { status: 400 });
  } catch (err) {
    console.error('Reliability run error:', err);
    return NextResponse.json({ error: err.message || 'Reliability run failed' }, { status: 500 });
  }
}
