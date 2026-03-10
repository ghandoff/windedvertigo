/**
 * PCS (Product Claim Substantiation) Notion client
 *
 * Queries and updates the Evidence Library and Evidence Packets databases
 * in the PCS system. Uses the same NOTION_TOKEN as SQR-RCT since both
 * systems share the same Notion integration.
 */

import { Client } from '@notionhq/client';
import { withRetry } from './notion.js';

const _notion = new Client({
  auth: process.env.NOTION_TOKEN,
  timeoutMs: 30000,
});

// wrap with retry (same pattern as notion.js)
const notion = {
  databases: {
    query: (...args) => withRetry(() => _notion.databases.query(...args)),
  },
  pages: {
    update: (...args) => withRetry(() => _notion.pages.update(...args)),
  },
};

const PCS_EVIDENCE_DB = process.env.NOTION_PCS_EVIDENCE_DB;
const PCS_EVIDENCE_PACKETS_DB = process.env.NOTION_PCS_EVIDENCE_PACKETS_DB;

// ─── Evidence Library ────────────────────────────────────────────────

export async function getAllEvidenceEntries() {
  let allResults = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_EVIDENCE_DB,
      start_cursor: cursor,
    });
    allResults = allResults.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return allResults.map(parseEvidencePage);
}

function parseEvidencePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: extractTitle(p['Name']),
    doi: extractRichText(p['DOI']),
    sqrScore: p['SQR-RCT score']?.number ?? null,
    sqrRiskOfBias: p['SQR-RCT risk of bias']?.select?.name ?? null,
    sqrReviewed: p['SQR-RCT reviewed']?.checkbox ?? false,
    sqrReviewDate: p['SQR-RCT review date']?.date?.start ?? null,
    sqrReviewUrl: p['SQR-RCT review URL']?.url ?? null,
  };
}

export async function updateEvidenceEntry(pageId, { score, riskOfBias, reviewDate, reviewUrl }) {
  const properties = {
    'SQR-RCT score': { number: score },
    'SQR-RCT risk of bias': { select: { name: riskOfBias } },
    'SQR-RCT reviewed': { checkbox: true },
    'SQR-RCT review date': { date: { start: reviewDate } },
    'SQR-RCT review URL': { url: reviewUrl },
  };
  return notion.pages.update({ page_id: pageId, properties });
}

// ─── Evidence Packets ────────────────────────────────────────────────

export async function getPacketsForEvidence(evidencePageId) {
  const res = await notion.databases.query({
    database_id: PCS_EVIDENCE_PACKETS_DB,
    filter: {
      property: 'Evidence Item',
      relation: { contains: evidencePageId },
    },
  });
  return res.results.map(page => ({
    id: page.id,
    meetsThreshold: page.properties['Meets SQR-RCT threshold']?.checkbox ?? false,
  }));
}

export async function updatePacketThreshold(packetId, meetsThreshold) {
  return notion.pages.update({
    page_id: packetId,
    properties: {
      'Meets SQR-RCT threshold': { checkbox: meetsThreshold },
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────

function extractTitle(prop) {
  return prop?.title?.[0]?.plain_text || '';
}

function extractRichText(prop) {
  return (prop?.rich_text || []).map(t => t.plain_text).join('');
}
