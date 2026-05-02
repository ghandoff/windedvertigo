/**
 * PCS Evidence Enrichment — PubMed metadata + Claude summarization.
 *
 * Given a PMID or DOI, fetches article metadata from PubMed's E-utilities API
 * and optionally generates a canonical research summary via Claude.
 */

const PUBMED_ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const PUBMED_EFETCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
const PUBMED_ESEARCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';

// Max characters of full text to send to Claude (≈4000 tokens)
const MAX_FULL_TEXT_CHARS = 16000;

/**
 * Fetch article metadata from PubMed by PMID.
 * @param {string} pmid
 * @returns {Promise<object>} { title, authors, journal, year, abstract, doi }
 */
export async function fetchPubMedByPmid(pmid) {
  // Get summary (title, authors, journal, year)
  const summaryUrl = `${PUBMED_ESUMMARY}?db=pubmed&id=${pmid}&retmode=json`;
  const summaryRes = await fetch(summaryUrl);
  if (!summaryRes.ok) throw new Error(`PubMed summary request failed: ${summaryRes.status}`);
  const summaryData = await summaryRes.json();
  const record = summaryData.result?.[pmid];
  if (!record) throw new Error(`PMID ${pmid} not found`);

  // Get abstract via efetch (XML)
  const abstractUrl = `${PUBMED_EFETCH}?db=pubmed&id=${pmid}&rettype=abstract&retmode=text`;
  const abstractRes = await fetch(abstractUrl);
  const abstractText = abstractRes.ok ? await abstractRes.text() : null;

  // Extract DOI from article IDs
  const doi = record.articleids?.find(a => a.idtype === 'doi')?.value || null;

  return {
    pmid,
    title: record.title || null,
    authors: record.authors?.map(a => a.name).join(', ') || null,
    journal: record.fulljournalname || record.source || null,
    year: record.pubdate?.match(/\d{4}/)?.[0] || null,
    abstract: abstractText?.trim() || null,
    doi,
  };
}

/**
 * Search PubMed by DOI and return the PMID.
 * @param {string} doi
 * @returns {Promise<string|null>} PMID or null
 */
export async function searchPubMedByDoi(doi) {
  const searchUrl = `${PUBMED_ESEARCH}?db=pubmed&term=${encodeURIComponent(doi)}[doi]&retmode=json`;
  const res = await fetch(searchUrl);
  if (!res.ok) return null;
  const data = await res.json();
  const ids = data.esearchresult?.idlist;
  return ids?.length > 0 ? ids[0] : null;
}

/**
 * Fetch article metadata from PubMed by DOI.
 * Searches for the DOI first, then fetches by PMID.
 * @param {string} doi
 * @returns {Promise<object|null>} Same shape as fetchPubMedByPmid, or null
 */
export async function fetchPubMedByDoi(doi) {
  const pmid = await searchPubMedByDoi(doi);
  if (!pmid) return null;
  return fetchPubMedByPmid(pmid);
}

/**
 * Extract text from a PDF at a given URL.
 * Downloads the PDF and uses pdf-parse to extract text content.
 * Returns null if extraction fails (non-fatal).
 *
 * @param {string} pdfUrl — URL of the PDF (Vercel Blob, PMC, etc.)
 * @returns {Promise<string|null>} Extracted text, truncated to MAX_FULL_TEXT_CHARS
 */
export async function extractTextFromPdf(pdfUrl) {
  try {
    const res = await fetch(pdfUrl, {
      headers: { 'User-Agent': 'nordic-sqr-rct/1.0 (PDF enrichment)' },
      redirect: 'follow',
    });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());

    // pdf-parse is a server-side library
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    const data = await pdfParse(buffer);

    const text = data.text?.trim();
    if (!text || text.length < 100) return null; // too short to be useful

    // Truncate to avoid blowing up Claude's context
    return text.length > MAX_FULL_TEXT_CHARS
      ? text.substring(0, MAX_FULL_TEXT_CHARS) + '\n\n[...truncated]'
      : text;
  } catch (err) {
    console.error('PDF text extraction failed:', err.message);
    return null;
  }
}

/**
 * Generate a canonical research summary of an article using Claude.
 * @param {object} article - { title, abstract, authors, journal, year }
 * @param {string} [fullText] - Optional full article text from PDF
 * @returns {Promise<string>} Summary text (2-3 sentences)
 */
export async function summarizeArticle(article, fullText = null) {
  const LLM_API_KEY = process.env.LLM_API_KEY;
  if (!LLM_API_KEY) throw new Error('LLM_API_KEY not configured');

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: LLM_API_KEY });

  const message = await client.messages.create({
    model: process.env.LLM_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    temperature: 0,
    system: `You are a regulatory science assistant for Nordic Naturals. Generate a concise canonical research summary (2-3 sentences) that captures the study's key finding, methodology, and relevance to dietary supplement claims. Focus on: study design (RCT, meta-analysis, mechanistic, etc.), primary outcomes, and the specific ingredient/dose studied. Do not use marketing language.`,
    messages: [{
      role: 'user',
      content: fullText
        ? `Title: ${article.title}\nAuthors: ${article.authors}\nJournal: ${article.journal} (${article.year})\n\nFull article text:\n${fullText}`
        : `Title: ${article.title}\nAuthors: ${article.authors}\nJournal: ${article.journal} (${article.year})\n\nAbstract:\n${article.abstract}`,
    }],
  });

  return message.content[0]?.text?.trim() || '';
}

/**
 * Fast keyword-based ingredient detection (no LLM needed).
 * Returns an array of ingredient names that match Nordic's ingredient taxonomy.
 * Use this as a fallback when no abstract is available or LLM_API_KEY is not set.
 * @param {string} title
 * @param {string} abstract
 * @returns {string[]}
 */
export function detectIngredients(title, abstract) {
  const text = `${title || ''} ${abstract || ''}`.toLowerCase();
  const ingredients = [];

  const patterns = [
    { name: 'Omega-3 (general)', keywords: ['omega-3', 'omega 3', 'fish oil', 'n-3 fatty acid', 'n-3 pufa'] },
    { name: 'EPA', keywords: ['epa', 'eicosapentaenoic'] },
    { name: 'DHA', keywords: ['dha', 'docosahexaenoic'] },
    { name: 'Vitamin D', keywords: ['vitamin d', 'cholecalciferol', '25-hydroxyvitamin', '25(oh)d'] },
    { name: 'Probiotics', keywords: ['probiotic', 'lactobacillus', 'bifidobacterium', 'saccharomyces'] },
    { name: 'CoQ10', keywords: ['coq10', 'coenzyme q10', 'ubiquinone', 'ubiquinol'] },
    { name: 'Curcumin', keywords: ['curcumin', 'turmeric', 'curcuma'] },
    { name: 'Magnesium', keywords: ['magnesium'] },
    { name: 'Vitamin K2', keywords: ['vitamin k2', 'menaquinone', 'mk-7', 'mk-4'] },
  ];

  for (const { name, keywords } of patterns) {
    if (keywords.some(kw => text.includes(kw))) {
      ingredients.push(name);
    }
  }

  return ingredients;
}

// Valid ingredient values for the PCS Evidence Library multi-select
const VALID_INGREDIENTS = [
  'EPA', 'DHA', 'Omega-3 (general)', 'Vitamin D', 'Magnesium',
  'CoQ10', 'Curcumin', 'Vitamin K2', 'Probiotics', 'Other',
];

/**
 * Context-aware ingredient detection using Claude.
 *
 * Unlike keyword matching, this understands the *role* of each ingredient:
 * - Primary intervention (supplemented/studied) → tagged
 * - Measured outcome biomarker → tagged only if directly relevant
 * - Control, comparator, or incidental mention → NOT tagged
 *
 * Falls back to keyword detection if LLM_API_KEY is not set or abstract is empty.
 *
 * @param {{ title: string, abstract: string, authors?: string, journal?: string, year?: string }} article
 * @param {string} [fullText] - Optional full article text from PDF
 * @returns {Promise<{ ingredients: string[], reasoning: string }>}
 */
export async function detectIngredientsWithContext(article, fullText = null) {
  const LLM_API_KEY = process.env.LLM_API_KEY;
  const textSource = fullText || article.abstract;

  // Fallback to keyword detection if no LLM or no text
  if (!LLM_API_KEY || !textSource) {
    const kw = detectIngredients(article.title, article.abstract);
    return { ingredients: kw, reasoning: 'keyword match (no text or LLM unavailable)' };
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: LLM_API_KEY });

  const message = await client.messages.create({
    model: process.env.LLM_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    temperature: 0,
    system: `You are a regulatory science analyst for Nordic Naturals, a dietary supplement company. Your task is to identify which ingredients from Nordic's product line were the PRIMARY INTERVENTION or primary subject of study in a research article.

ONLY tag ingredients that were:
- The active supplement/intervention being studied
- The primary subject of a mechanistic investigation
- The focus of a meta-analysis or systematic review

Do NOT tag ingredients that were:
- Mentioned as a control group or placebo comparator
- Measured as a secondary biomarker but not the intervention
- Referenced in the background/introduction as context
- Part of dietary intake assessment but not supplemented
- Mentioned in exclusion criteria (e.g., "participants taking magnesium were excluded")

Valid ingredient tags (use EXACTLY these names):
${VALID_INGREDIENTS.join(', ')}

Use "Other" only if the primary studied ingredient is a Nordic Naturals product ingredient not in the list above.

Respond in JSON format:
{"ingredients": ["tag1", "tag2"], "reasoning": "brief explanation of why these were tagged and what role they play in the study"}`,
    messages: [{
      role: 'user',
      content: fullText
        ? `Title: ${article.title}\nAuthors: ${article.authors || 'N/A'}\nJournal: ${article.journal || 'N/A'} (${article.year || 'N/A'})\n\nFull article text:\n${fullText}`
        : `Title: ${article.title}\nAuthors: ${article.authors || 'N/A'}\nJournal: ${article.journal || 'N/A'} (${article.year || 'N/A'})\n\nAbstract:\n${article.abstract}`,
    }],
  });

  try {
    const text = message.content[0]?.text?.trim() || '{}';
    // Extract JSON from response (handle markdown code blocks)
    const jsonStr = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(jsonStr);
    // Filter to only valid ingredient names
    const ingredients = (parsed.ingredients || []).filter(i => VALID_INGREDIENTS.includes(i));
    return {
      ingredients,
      reasoning: parsed.reasoning || 'Claude analysis',
    };
  } catch {
    // JSON parse failed — fall back to keyword detection
    const kw = detectIngredients(article.title, article.abstract);
    return { ingredients: kw, reasoning: 'keyword match (Claude response parse failed)' };
  }
}

/**
 * Full enrichment of a single article: PubMed metadata + summary + smart ingredients.
 * When a pdfUrl is provided, extracts full text for higher-quality summarization
 * and ingredient detection (instead of relying on the abstract alone).
 *
 * @param {{ doi?: string, pmid?: string, title?: string, pdfUrl?: string }} input
 * @returns {Promise<object>} enriched metadata
 */
export async function enrichArticle(input) {
  let metadata = null;

  // Fetch from PubMed
  if (input.pmid) {
    metadata = await fetchPubMedByPmid(input.pmid);
  } else if (input.doi) {
    metadata = await fetchPubMedByDoi(input.doi);
  }

  if (!metadata) {
    return { enriched: false, reason: 'No PubMed match found' };
  }

  // Extract full text from PDF if available
  let fullText = null;
  if (input.pdfUrl) {
    fullText = await extractTextFromPdf(input.pdfUrl);
  }

  // Generate summary (prefer full text over abstract)
  let summary = null;
  const hasText = fullText || metadata.abstract;
  try {
    if (hasText && process.env.LLM_API_KEY) {
      summary = await summarizeArticle(metadata, fullText);
    }
  } catch {
    // Non-fatal — summary is optional
  }

  // Smart ingredient detection (prefer full text over abstract)
  const ingredientResult = await detectIngredientsWithContext(metadata, fullText);

  return {
    enriched: true,
    pmid: metadata.pmid,
    doi: metadata.doi,
    title: metadata.title,
    authors: metadata.authors,
    journal: metadata.journal,
    year: metadata.year,
    abstract: metadata.abstract,
    fullTextExtracted: !!fullText,
    summary,
    ingredients: ingredientResult.ingredients,
    ingredientReasoning: ingredientResult.reasoning,
  };
}
