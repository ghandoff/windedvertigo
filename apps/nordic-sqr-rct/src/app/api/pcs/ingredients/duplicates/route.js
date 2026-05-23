import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllIngredients } from '@/lib/pcs-ingredients';

/**
 * GET /api/pcs/ingredients/duplicates
 *
 * Returns pairs of canonical ingredients that are likely duplicates, scored
 * by a combination of:
 *   1. Token Jaccard similarity — tokenize names, compute intersection/union.
 *   2. Prefix match — one name starts with the first 4+ chars of the other.
 *   3. Synonym cross-match — one's canonical name appears in the other's synonyms.
 *
 * Query params:
 *   threshold=0.5   — minimum Jaccard score to include (default 0.5)
 *
 * Returns: [{ ingredientA, ingredientB, score, reason }] sorted desc by score.
 */

// Words that are too common to be discriminating — strip before tokenizing.
const STOP_TOKENS = new Set([
  'acid', 'extract', 'oxide', 'citrate', 'glycinate', 'malate', 'fumarate',
  'gluconate', 'bisglycinate', 'chelate', 'complex', 'salt', 'form', 'type',
  'vitamin', 'mineral', 'and', 'or', 'of', 'from', 'with',
]);

function tokenize(name) {
  return (name || '')
    .toLowerCase()
    .split(/[\s\-_/.,()[\]]+/)
    .map(t => t.replace(/[^a-z0-9]/g, ''))
    .filter(t => t.length >= 2 && !STOP_TOKENS.has(t));
}

function jaccardSimilarity(tokensA, tokensB) {
  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

function detectSimilarity(a, b) {
  const nameA = (a.canonicalName || '').trim().toLowerCase();
  const nameB = (b.canonicalName || '').trim().toLowerCase();

  // 1. Exact duplicate (shouldn't happen but worth catching)
  if (nameA === nameB) return { score: 1.0, reason: 'Exact duplicate name' };

  // 2. Synonym cross-match — strongest signal
  const synsA = (a.synonyms || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const synsB = (b.synonyms || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (synsA.includes(nameB) || synsB.includes(nameA)) {
    return { score: 0.95, reason: 'One name appears in the other\'s synonyms' };
  }

  // 3. Token Jaccard similarity
  const tokA = tokenize(nameA);
  const tokB = tokenize(nameB);
  const jaccard = jaccardSimilarity(tokA, tokB);

  // 4. Prefix match (first 4 chars) — helps catch "Vit D3" vs "Vitamin D3"
  const prefix = 4;
  const prefixMatch =
    nameA.length >= prefix && nameB.length >= prefix &&
    (nameA.startsWith(nameB.slice(0, prefix)) || nameB.startsWith(nameA.slice(0, prefix)));

  // 5. One is a substring of the other
  const substringMatch = nameA.includes(nameB) || nameB.includes(nameA);

  let score = jaccard;
  let reason = `Token similarity: ${(jaccard * 100).toFixed(0)}%`;

  if (substringMatch) {
    score = Math.max(score, 0.75);
    reason = 'One name is a substring of the other';
  } else if (prefixMatch && jaccard >= 0.3) {
    score = Math.max(score, 0.65);
    reason = `Prefix match + ${(jaccard * 100).toFixed(0)}% token similarity`;
  }

  return { score, reason };
}

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', {
    route: '/api/pcs/ingredients/duplicates',
  });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const threshold = Math.max(0.1, Math.min(1.0, parseFloat(searchParams.get('threshold') || '0.5')));

  const ingredients = await getAllIngredients();
  const pairs = [];

  for (let i = 0; i < ingredients.length; i++) {
    for (let j = i + 1; j < ingredients.length; j++) {
      const { score, reason } = detectSimilarity(ingredients[i], ingredients[j]);
      if (score >= threshold) {
        pairs.push({
          ingredientA: ingredients[i],
          ingredientB: ingredients[j],
          score: Math.round(score * 100) / 100,
          reason,
        });
      }
    }
  }

  // Sort by score descending
  pairs.sort((a, b) => b.score - a.score);

  return NextResponse.json({ pairs, total: pairs.length, threshold });
}
