/**
 * NOTION CONTENT FETCHER
 *
 * Fetches content from Notion databases and generates
 * a JSON file for the Package Builder.
 *
 * Features:
 * - Centralized config (see notion-config.js)
 * - Retry logic for transient failures
 * - Validation of required properties
 * - Detailed error reporting
 */

const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
const config = require('./notion-config');

// Validate environment
if (!process.env.NOTION_API_KEY) {
  console.error('ERROR: NOTION_API_KEY environment variable is not set');
  process.exit(1);
}

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// ============================================
// RETRY WRAPPER
// ============================================
async function withRetry(fn, name) {
  const { maxAttempts, delayMs, backoffMultiplier } = config.retry;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        console.warn('  Warning: ' + name + ' failed (attempt ' + attempt + '/' + maxAttempts + '), retrying in ' + delay + 'ms...');
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw new Error(name + ' failed after ' + maxAttempts + ' attempts: ' + lastError.message);
}

// ============================================
// PROPERTY EXTRACTORS
// ============================================
function getTextValue(prop) {
  if (!prop) return '';
  if (prop.type === 'rich_text') return prop.rich_text.map(t => t.plain_text).join('');
  return '';
}

function getTitleValue(prop) {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title.map(t => t.plain_text).join('');
  return '';
}

// Rich text with formatting preserved as markdown-style markers
// e.g. Notion italic "yes" → "*yes*", bold → "**bold**"
function getRichTextAsMarkdown(prop) {
  if (!prop) return '';
  if (prop.type === 'rich_text') {
    return prop.rich_text.map(t => {
      let text = t.plain_text;
      if (t.annotations?.bold) text = '**' + text + '**';
      if (t.annotations?.italic) text = '*' + text + '*';
      return text;
    }).join('');
  }
  return '';
}

function getSelectValue(prop) {
  if (!prop) return '';
  if (prop.type === 'select') return prop.select?.name || '';
  return '';
}

function getUrlValue(prop) {
  if (!prop) return '';
  if (prop.type === 'url') return prop.url || '';
  return '';
}

// Get URL with fallback options
function getUrlWithFallback(props, keys) {
  if (Array.isArray(keys)) {
    for (const key of keys) {
      const val = getUrlValue(props[key]);
      if (val) return val;
    }
    return '';
  }
  return getUrlValue(props[keys]);
}

function getMultiSelectValue(prop) {
  if (!prop) return [];
  if (prop.type === 'multi_select') return prop.multi_select.map(s => s.name);
  return [];
}

function getCheckboxValue(prop) {
  if (!prop) return false;
  if (prop.type === 'checkbox') return prop.checkbox;
  return false;
}

function getNumberValue(prop) {
  if (!prop) return null;
  if (prop.type === 'number') return prop.number;
  return null;
}

function getRelationIds(prop) {
  if (!prop) return [];
  if (prop.type === 'relation') return prop.relation.map(r => r.id);
  return [];
}

function toSlug(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Extract first file URL from a Files & media property
function getFilesValue(prop) {
  if (!prop) return '';
  if (prop.type === 'files' && prop.files.length > 0) {
    const file = prop.files[0];
    // Handle both Notion-hosted files and external URLs
    if (file.type === 'file') {
      return file.file.url;
    } else if (file.type === 'external') {
      return file.external.url;
    }
  }
  return '';
}

// Hybrid extractor: tries files first, then falls back to text
function getIconValue(prop) {
  if (!prop) return '';
  // If it's a files property, get the URL
  if (prop.type === 'files') {
    return getFilesValue(prop);
  }
  // If it's rich_text (emoji/text), get the text
  if (prop.type === 'rich_text') {
    return getTextValue(prop);
  }
  return '';
}

// ============================================
// QUADRANT RELATION HYDRATION (cached)
// ============================================
const VALID_QUADRANT_KEYS = ['people-design', 'people-research', 'product-design', 'product-research'];
const quadrantRelCache = {};  // page_id → quadrantKey string

async function hydrateQuadrantRel(pageIds) {
  const results = [];
  for (const id of pageIds) {
    if (quadrantRelCache[id] !== undefined) {
      results.push(quadrantRelCache[id]);
      continue;
    }
    try {
      const page = await withRetry(
        () => notion.pages.retrieve({ page_id: id }),
        'hydrateQuadrantRel:' + id
      );
      const key = getSelectValue(page.properties['Quadrant Key']);
      if (key && VALID_QUADRANT_KEYS.includes(key)) {
        quadrantRelCache[id] = key;
        results.push(key);
      } else {
        console.warn('  Warning: Quadrant relation page ' + id + ' has unexpected key "' + key + '", ignoring');
        quadrantRelCache[id] = '';
      }
    } catch (err) {
      console.warn('  Warning: Could not hydrate quadrant relation ' + id + ': ' + err.message);
      quadrantRelCache[id] = '';
    }
  }
  return results.filter(k => k !== '');
}

// ============================================
// VALIDATION
// ============================================
function validatePage(page, requiredProps, dbName) {
  const props = page.properties;
  const missing = requiredProps.filter(prop => {
    const val = props[prop];
    if (!val) return true;
    if (val.type === 'title') return getTitleValue(val) === '';
    if (val.type === 'select') return getSelectValue(val) === '';
    if (val.type === 'rich_text') return getTextValue(val) === '';
    return false;
  });

  if (missing.length > 0) {
    const pageTitle = getTitleValue(props['Name']) || getTitleValue(props['Title']) || page.id;
    console.warn('  Warning: ' + dbName + ': "' + pageTitle + '" missing required: ' + missing.join(', '));
    return false;
  }
  return true;
}

// ============================================
// FETCH FUNCTIONS  
// ============================================
async function fetchQuadrants() {
  const propMap = config.properties.quadrants;
  const required = config.required.quadrants;

  const response = await withRetry(
    () => notion.databases.query({ database_id: config.databases.quadrants }),
    'fetchQuadrants'
  );

  const result = {};
  let skipped = 0;

  for (const page of response.results) {
    if (!validatePage(page, required, 'Quadrants')) {
      skipped++;
      continue;
    }

    const props = page.properties;
    const key = getSelectValue(props[propMap.key]);

    if (key) {
      result[key] = {
        title: getTextValue(props[propMap.title]),
        promise: getTextValue(props[propMap.promise]),
        quadrantStory: getTextValue(props[propMap.quadrantStory]),
        story: getTextValue(props[propMap.story]),
        crossover: getTextValue(props[propMap.crossover]),
      };
    }
  }

  console.log('  OK Quadrants: ' + Object.keys(result).length + ' loaded, ' + skipped + ' skipped');
  return result;
}

async function fetchOutcomes() {
  const propMap = config.properties.outcomes;
  const required = config.required.outcomes;

  const response = await withRetry(
    () => notion.databases.query({
      database_id: config.databases.outcomes,
      sorts: [{ property: propMap.order, direction: 'ascending' }],
    }),
    'fetchOutcomes'
  );

  const byQuadrant = {};
  let total = 0;
  let skipped = 0;

  for (const page of response.results) {
    if (!validatePage(page, required, 'Outcomes')) {
      skipped++;
      continue;
    }

    const props = page.properties;
    const quadrant = getSelectValue(props[propMap.quadrant]);

    if (quadrant) {
      if (!byQuadrant[quadrant]) byQuadrant[quadrant] = [];
      byQuadrant[quadrant].push({
        title: getTitleValue(props[propMap.name]),
        detail: getTextValue(props[propMap.detail]),
      });
      total++;
    }
  }

  console.log('  OK Outcomes: ' + total + ' loaded across ' + Object.keys(byQuadrant).length + ' quadrants, ' + skipped + ' skipped');
  return byQuadrant;
}

async function fetchExamples() {
  const propMap = config.properties.examples;
  const required = config.required.examples;

  const response = await withRetry(
    () => notion.databases.query({
      database_id: config.databases.examples,
      sorts: [{ property: propMap.order, direction: 'ascending' }],
    }),
    'fetchExamples'
  );

  const byQuadrant = {};
  let total = 0;
  let skipped = 0;

  for (const page of response.results) {
    if (!validatePage(page, required, 'Examples')) {
      skipped++;
      continue;
    }

    const props = page.properties;
    const quadrant = getSelectValue(props[propMap.quadrant]);

    if (quadrant) {
      if (!byQuadrant[quadrant]) byQuadrant[quadrant] = [];
      byQuadrant[quadrant].push({
        title: getTitleValue(props[propMap.name]),
        type: getTextValue(props[propMap.type]),
        icon: getTextValue(props[propMap.icon]),
        url: getUrlWithFallback(props, propMap.url),
        detail: getTextValue(props[propMap.detail]),
      });
      total++;
    }
  }

  console.log('  OK Examples: ' + total + ' loaded across ' + Object.keys(byQuadrant).length + ' quadrants, ' + skipped + ' skipped');
  return byQuadrant;
}

// ============================================
// PORTFOLIO ASSETS (from BD multi-database)
//
// The BD assets live inside a Notion multi-database.
// Individual data sources in a multi-database are NOT
// queryable via databases.query(), so we use notion.search()
// and filter by parent database ID + BD-specific properties.
// ============================================
async function fetchPortfolioAssets() {
  const propMap = config.properties.portfolioAssets;
  const required = config.required.portfolioAssets;
  const parentDbId = config.databases.portfolioAssets;

  // Notion search returns dashed UUIDs; normalise for comparison
  const parentDashed = parentDbId.replace(
    /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
    '$1-$2-$3-$4-$5'
  );

  // Paginate through workspace search results
  let allPages = [];
  let startCursor = undefined;
  let round = 0;
  const MAX_ROUNDS = 20; // safety cap

  do {
    round++;
    const searchOpts = {
      filter: { property: 'object', value: 'page' },
      page_size: 100,
    };
    if (startCursor) searchOpts.start_cursor = startCursor;

    const response = await withRetry(
      () => notion.search(searchOpts),
      'searchBDAssets:round' + round
    );

    for (const page of response.results) {
      const pid = page.parent?.database_id;
      if (pid === parentDbId || pid === parentDashed) {
        allPages.push(page);
      }
    }

    startCursor = response.has_more ? response.next_cursor : undefined;
  } while (startCursor && round < MAX_ROUNDS);

  console.log('  Portfolio search: ' + round + ' round(s), ' + allPages.length + ' pages in parent DB');

  // Filter to BD-asset pages (have 'asset' title property)
  // and apply Show in Portfolio / Show in Package Builder filter
  const assets = [];
  let skipped = 0;
  let filtered = 0;

  for (const page of allPages) {
    const props = page.properties;

    // Only process pages from the BD assets data source
    // (they have a title property named 'asset')
    if (!props[propMap.name] || props[propMap.name].type !== 'title') {
      continue;
    }

    // Apply checkbox filter (mirror the old databases.query filter)
    const showInPortfolio = getCheckboxValue(props[propMap.showInPortfolio]);
    const showInPB = getCheckboxValue(props[propMap.showInPackageBuilder]);
    if (!showInPortfolio && !showInPB) {
      filtered++;
      continue;
    }

    if (!validatePage(page, required, 'BD Assets')) {
      skipped++;
      continue;
    }

    // Quadrant from relation (same hydration as portfolio assets)
    const quadrantRelIds = getRelationIds(props[propMap.quadrantRel]);
    const quadrantKeysFromRel = await hydrateQuadrantRel(quadrantRelIds);
    const quadrantKey = quadrantKeysFromRel.length > 0 ? quadrantKeysFromRel[0] : '';

    const assetName = getTitleValue(props[propMap.name]);
    const explicitSlug = getTextValue(props[propMap.slug]);

    if (!quadrantKey) {
      console.warn('  Warning: "' + assetName + '" has no quadrant relation set');
    }

    assets.push({
      id: page.id,
      name: assetName,
      slug: explicitSlug || toSlug(assetName),
      assetType: getSelectValue(props[propMap.assetType]),
      quadrants: quadrantKey ? [quadrantKey] : [],
      quadrantKey: quadrantKey,
      url: getUrlWithFallback(props, propMap.url),
      thumbnailUrl: getUrlValue(props[propMap.thumbnailUrl]),
      description: getTextValue(props[propMap.description]),
      tags: getMultiSelectValue(props[propMap.tags]),
      featured: getCheckboxValue(props[propMap.featured]),
      showInPackageBuilder: getCheckboxValue(props[propMap.showInPackageBuilder]),
      showInPortfolio: getCheckboxValue(props[propMap.showInPortfolio]),
      passwordProtected: getCheckboxValue(props[propMap.passwordProtected]),
      password: getTextValue(props[propMap.password]),
      client: getTextValue(props[propMap.client]),
      order: getNumberValue(props[propMap.order]),
      icon: getIconValue(props[propMap.icon]),
    });
  }

  // Sort by order ascending (search API does not support sorting)
  assets.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  console.log('  OK Portfolio Assets: ' + assets.length + ' loaded, ' + filtered + ' filtered, ' + skipped + ' skipped');
  return assets;
}

// ============================================
// VERTIGO VAULT
// ============================================
async function fetchVertigoVault() {
  const propMap = config.properties.vertigoVault;
  const required = config.required.vertigoVault;

  const response = await withRetry(
    () => notion.databases.query({
      database_id: config.databases.vertigoVault,
    }),
    'fetchVertigoVault'
  );

  // Ensure cover image directory exists
  const coverDir = path.join(__dirname, '..', 'apps', 'site', 'images', 'vertigo-vault');
  if (!fs.existsSync(coverDir)) {
    fs.mkdirSync(coverDir, { recursive: true });
  }

  const activities = [];
  let skipped = 0;
  let coversDownloaded = 0;

  for (const page of response.results) {
    if (!validatePage(page, required, 'Vertigo Vault')) {
      skipped++;
      continue;
    }

    const props = page.properties;

    // Fetch page content (block children)
    let contentText = '';
    try {
      const blocks = await withRetry(
        () => notion.blocks.children.list({ block_id: page.id }),
        'fetchBlocks:' + page.id
      );
      contentText = blocksToMarkdown(blocks.results);
    } catch (err) {
      console.warn('  Warning: Could not fetch content for ' + getTitleValue(props[propMap.name]) + ': ' + err.message);
    }

    // Extract and download page cover image
    let coverImage = '';
    if (page.cover) {
      const coverUrl = page.cover.type === 'file'
        ? page.cover.file.url
        : page.cover.type === 'external'
          ? page.cover.external.url
          : '';

      if (coverUrl) {
        try {
          const ext = getCoverExtension(coverUrl);
          const filename = page.id.replace(/-/g, '') + ext;
          const filepath = path.join(coverDir, filename);
          await downloadFile(coverUrl, filepath);
          coverImage = 'images/vertigo-vault/' + filename;
          coversDownloaded++;
        } catch (err) {
          console.warn('  Warning: Could not download cover for ' + getTitleValue(props[propMap.name]) + ': ' + err.message);
        }
      }
    }

    activities.push({
      id: page.id,
      name: getTitleValue(props[propMap.name]),
      headline: getTextValue(props[propMap.headline]),
      duration: getSelectValue(props[propMap.duration]),
      format: getMultiSelectValue(props[propMap.format]),
      type: getMultiSelectValue(props[propMap.type]),
      skillsDeveloped: getMultiSelectValue(props[propMap.skillsDeveloped]),
      coverImage: coverImage,
      content: contentText,
    });
  }

  console.log('  OK Vertigo Vault: ' + activities.length + ' activities loaded, ' + coversDownloaded + ' covers downloaded, ' + skipped + ' skipped');
  return activities;
}

// Download a file from a URL to a local path
async function downloadFile(url, filepath) {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch(url);
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const buffer = await response.buffer();
  fs.writeFileSync(filepath, buffer);
}

// Determine file extension from a cover URL
function getCoverExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)/i);
    if (match) return '.' + match[1].toLowerCase();
  } catch (e) {}
  return '.jpg'; // default fallback
}

// Convert Notion blocks to simple markdown
function blocksToMarkdown(blocks) {
  let md = '';
  for (const block of blocks) {
    const text = richTextToPlain(block[block.type]?.rich_text);
    switch (block.type) {
      case 'heading_2':
        md += '## ' + text + '\n';
        break;
      case 'heading_3':
        md += '### ' + text + '\n';
        break;
      case 'paragraph':
        if (text) md += text + '\n';
        break;
      case 'numbered_list_item':
        md += '1. ' + text + '\n';
        break;
      case 'bulleted_list_item':
        md += '- ' + text + '\n';
        break;
      default:
        if (text) md += text + '\n';
    }
  }
  return md.trim();
}

function richTextToPlain(richText) {
  if (!richText) return '';
  return richText.map(t => {
    let text = t.plain_text;
    if (t.annotations?.bold) text = '**' + text + '**';
    if (t.annotations?.italic) text = '*' + text + '*';
    return text;
  }).join('');
}

// ============================================
// WHAT PAGE CONTENT
// ============================================
async function fetchWhatPageContent() {
  const propMap = config.properties.whatPage;
  const required = config.required.whatPage;

  const response = await withRetry(
    () => notion.databases.query({
      database_id: config.databases.whatPage,
      sorts: [{ property: propMap.order, direction: 'ascending' }],
    }),
    'fetchWhatPageContent'
  );

  const sections = [];
  let skipped = 0;

  for (const page of response.results) {
    if (!validatePage(page, required, 'What Page')) {
      skipped++;
      continue;
    }

    const props = page.properties;

    sections.push({
      name: getTitleValue(props[propMap.name]),
      content: getRichTextAsMarkdown(props[propMap.content]),
      order: getNumberValue(props[propMap.order]),
      type: getSelectValue(props[propMap.type]),
      layout: getSelectValue(props[propMap.layout]) || 'default',
      icon: props[propMap.icon]?.url || null,
    });
  }

  console.log('  OK What Page: ' + sections.length + ' sections loaded, ' + skipped + ' skipped');
  return sections;
}

// ============================================
// WHAT PAGE CONTENT V2
// ============================================
// Syncs the v2 what page content database with additional Layout and Icon columns
async function fetchWhatPageContentV2() {
  const propMap = config.properties.whatPageV2;
  const required = config.required.whatPageV2;

  const response = await withRetry(
    () => notion.databases.query({
      database_id: config.databases.whatPageV2,
      sorts: [{ property: propMap.order, direction: 'ascending' }],
    }),
    'fetchWhatPageContentV2'
  );

  const sections = [];
  let skipped = 0;

  for (const page of response.results) {
    if (!validatePage(page, required, 'What Page V2')) {
      skipped++;
      continue;
    }

    const props = page.properties;

    sections.push({
      name: getTitleValue(props[propMap.name]),
      content: getRichTextAsMarkdown(props[propMap.content]),
      order: getNumberValue(props[propMap.order]),
      type: getSelectValue(props[propMap.type]),
      layout: getSelectValue(props[propMap.layout]) || 'default',
      icon: getUrlValue(props[propMap.icon]) || null,
    });
  }

  console.log('  OK What Page V2: ' + sections.length + ' sections loaded, ' + skipped + ' skipped');
  return sections;
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('Fetching content from Notion...');

  try {
    const [quadrants, outcomes, portfolioAssets, vaultActivities, whatPageSections, whatPageV2Sections] = await Promise.all([
      fetchQuadrants(),
      fetchOutcomes(),
      fetchPortfolioAssets(),
      fetchVertigoVault(),
      fetchWhatPageContent(),
      fetchWhatPageContentV2(),
    ]);

    // Validate we got all 4 quadrants
    const expectedQuadrants = ['people-design', 'people-research', 'product-design', 'product-research'];
    const missingQuadrants = expectedQuadrants.filter(q => !quadrants[q]);
    if (missingQuadrants.length > 0) {
      console.warn('WARNING: Missing quadrants: ' + missingQuadrants.join(', '));
    }

    // Generate examples from BD assets (filtered by showInPackageBuilder)
    // Use quadrant names directly - they should match the keys in the Quadrants database
    const examplesFromAssets = {};
    for (const asset of portfolioAssets) {
      if (!asset.showInPackageBuilder) continue;

      for (const quadrant of asset.quadrants) {
        // Use quadrant name as-is (e.g., 'product-design') to match Quadrant database keys
        if (!examplesFromAssets[quadrant]) examplesFromAssets[quadrant] = [];
        examplesFromAssets[quadrant].push({
          id: asset.id,
          title: asset.name,
          type: asset.assetType,
          icon: asset.icon,
          url: asset.url,
          detail: asset.description,
        });
      }
    }

    const packageBuilderExamples = Object.keys(examplesFromAssets).reduce((acc, key) => acc + examplesFromAssets[key].length, 0);
    console.log('  OK Examples (from BD Assets): ' + packageBuilderExamples + ' items with showInPackageBuilder=true');

    // Assemble packs
    const packs = {};
    for (const key of Object.keys(quadrants)) {
      packs[key] = {
        ...quadrants[key],
        outcomes: outcomes[key] || [],
        examples: examplesFromAssets[key] || [],
      };

      if (!outcomes[key] || outcomes[key].length === 0) {
        console.warn('  Warning: ' + key + ' has no outcomes');
      }
      if (!examplesFromAssets[key] || examplesFromAssets[key].length === 0) {
        console.warn('  Warning: ' + key + ' has no examples (check showInPackageBuilder in BD Assets)');
      }
    }

    // Build output
    const content = {
      lastUpdated: new Date().toISOString(),
      note: 'Auto-generated from Notion. Do not edit directly.',
      packs,
    };

    // Write Package Builder content
    const outputPath = path.join(__dirname, '..', 'apps', 'site', 'data', 'package-builder-content.json');
    fs.writeFileSync(outputPath, JSON.stringify(content, null, 2));

    // Write Portfolio Assets (sourced from BD Assets database)
    const portfolioContent = {
      lastUpdated: new Date().toISOString(),
      note: 'Auto-generated from Notion BD Assets. Do not edit directly.',
      assets: portfolioAssets,
    };
    const portfolioPath = path.join(__dirname, '..', 'apps', 'site', 'data', 'portfolio-assets.json');
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolioContent, null, 2));

    // Write Vertigo Vault
    const vaultContent = {
      lastUpdated: new Date().toISOString(),
      note: 'Auto-generated from Notion vertigo.vault database. Do not edit directly.',
      notionDatabaseId: config.databases.vertigoVault,
      activities: vaultActivities,
    };
    const vaultPath = path.join(__dirname, '..', 'apps', 'site', 'data', 'vertigo-vault.json');
    fs.writeFileSync(vaultPath, JSON.stringify(vaultContent, null, 2));

    // Write What Page content
    const whatPageContent = {
      lastUpdated: new Date().toISOString(),
      note: 'Auto-generated from Notion what page content database. Do not edit directly.',
      sections: whatPageSections,
    };
    const whatPagePath = path.join(__dirname, '..', 'apps', 'site', 'data', 'what-page.json');
    fs.writeFileSync(whatPagePath, JSON.stringify(whatPageContent, null, 2));

    // Write What Page V2 content
    const whatPageV2Content = {
      lastUpdated: new Date().toISOString(),
      note: 'Auto-generated from Notion what page v2 content database. Do not edit directly.',
      sections: whatPageV2Sections,
    };
    const whatPageV2Path = path.join(__dirname, '..', 'apps', 'site', 'data', 'what-page-v2.json');
    fs.writeFileSync(whatPageV2Path, JSON.stringify(whatPageV2Content, null, 2));

    console.log('Success!');
    console.log('  Package Builder: ' + Object.keys(packs).length + ' packs → ' + outputPath);
    console.log('  Portfolio: ' + portfolioAssets.length + ' assets → ' + portfolioPath);
    console.log('  Vertigo Vault: ' + vaultActivities.length + ' activities → ' + vaultPath);
    console.log('  What Page: ' + whatPageSections.length + ' sections → ' + whatPagePath);
    console.log('  What Page V2: ' + whatPageV2Sections.length + ' sections → ' + whatPageV2Path);

  } catch (err) {
    console.error('Sync failed:', err.message);
    if (err.code) console.error('  Error code:', err.code);
    process.exit(1);
  }
}

main();
