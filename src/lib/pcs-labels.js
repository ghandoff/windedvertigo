/**
 * Product Labels CRUD (Wave 5.0 — added 2026-04-21).
 *
 * Product Labels are the market-facing substantiation anchor:
 * every SKU ships a label, and the label is what the regulator,
 * consumer, and plaintiff attorney actually read. Labels relate to
 * PCS Documents (substantiation), Ingredients (printed composition),
 * Evidence Library (safety cross-check), and PCS Requests (drift findings).
 *
 * See docs/plans/wave-5-product-labels.md §2 for the property schema.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';

const P = PROPS.productLabels;

export function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    sku: p[P.sku]?.title?.[0]?.plain_text || '',
    upc: (p[P.upc]?.rich_text || []).map(t => t.plain_text).join(''),
    productNameAsMarketed: (p[P.productNameAsMarketed]?.rich_text || []).map(t => t.plain_text).join(''),
    labelImage: (p[P.labelImage]?.files || []).map(f => ({
      name: f.name,
      url: f.external?.url || f.file?.url || null,
    })),
    labelVersionDate: p[P.labelVersionDate]?.date?.start || null,
    regulatoryFramework: p[P.regulatoryFramework]?.select?.name || null,
    markets: (p[P.markets]?.multi_select || []).map(s => s.name),
    approvedClaimsOnLabel: (p[P.approvedClaimsOnLabel]?.rich_text || []).map(t => t.plain_text).join(''),
    ingredientListIds: (p[P.ingredientList]?.relation || []).map(r => r.id),
    ingredientDoses: (p[P.ingredientDoses]?.rich_text || []).map(t => t.plain_text).join(''),
    dvCompliance: p[P.dvCompliance]?.checkbox || false,
    pcsDocumentId: (p[P.pcsDocument]?.relation || [])[0]?.id || null,
    linkedEvidenceIds: (p[P.linkedEvidence]?.relation || []).map(r => r.id),
    status: p[P.status]?.select?.name || null,
    lastDriftCheck: p[P.lastDriftCheck]?.date?.start || null,
    driftFindingIds: (p[P.driftFindings]?.relation || []).map(r => r.id),
    ownerIds: (p[P.owner]?.people || []).map(u => u.id),
    notes: (p[P.notes]?.rich_text || []).map(t => t.plain_text).join(''),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function getAllLabels(maxPages = 50) {
  let all = [];
  let cursor = undefined;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.productLabels,
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ property: P.sku, direction: 'ascending' }],
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    pages++;
  } while (cursor && pages < maxPages);
  return all.map(parsePage);
}

export async function getLabel(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function getLabelsForPcs(pcsId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.productLabels,
    filter: { property: P.pcsDocument, relation: { contains: pcsId } },
    sorts: [{ property: P.sku, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

export async function getLabelsForIngredient(ingredientId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.productLabels,
    filter: { property: P.ingredientList, relation: { contains: ingredientId } },
    sorts: [{ property: P.sku, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

function buildProperties(fields, { forCreate } = { forCreate: false }) {
  const properties = {};
  if (forCreate || fields.sku !== undefined) {
    properties[P.sku] = { title: [{ text: { content: fields.sku || '' } }] };
  }
  if (fields.upc !== undefined) {
    properties[P.upc] = { rich_text: [{ text: { content: fields.upc || '' } }] };
  }
  if (fields.productNameAsMarketed !== undefined) {
    properties[P.productNameAsMarketed] = {
      rich_text: [{ text: { content: fields.productNameAsMarketed || '' } }],
    };
  }
  if (fields.labelImage !== undefined) {
    const files = (fields.labelImage || []).map(f => {
      if (f.external?.url) return { name: f.name || 'label', type: 'external', external: { url: f.external.url } };
      if (f.url) return { name: f.name || 'label', type: 'external', external: { url: f.url } };
      // Pass through raw API shapes for advanced callers
      return f;
    });
    properties[P.labelImage] = { files };
  }
  if (fields.labelVersionDate !== undefined) {
    properties[P.labelVersionDate] = fields.labelVersionDate
      ? { date: { start: fields.labelVersionDate } }
      : { date: null };
  }
  if (fields.regulatoryFramework !== undefined) {
    properties[P.regulatoryFramework] = fields.regulatoryFramework
      ? { select: { name: fields.regulatoryFramework } }
      : { select: null };
  }
  if (fields.markets !== undefined) {
    properties[P.markets] = { multi_select: (fields.markets || []).map(name => ({ name })) };
  }
  if (fields.approvedClaimsOnLabel !== undefined) {
    properties[P.approvedClaimsOnLabel] = {
      rich_text: [{ text: { content: fields.approvedClaimsOnLabel || '' } }],
    };
  }
  if (fields.ingredientListIds !== undefined) {
    properties[P.ingredientList] = {
      relation: (fields.ingredientListIds || []).map(id => ({ id })),
    };
  }
  if (fields.ingredientDoses !== undefined) {
    properties[P.ingredientDoses] = {
      rich_text: [{ text: { content: fields.ingredientDoses || '' } }],
    };
  }
  if (fields.dvCompliance !== undefined) {
    properties[P.dvCompliance] = { checkbox: !!fields.dvCompliance };
  }
  if (fields.pcsDocumentId !== undefined) {
    properties[P.pcsDocument] = fields.pcsDocumentId
      ? { relation: [{ id: fields.pcsDocumentId }] }
      : { relation: [] };
  }
  if (fields.linkedEvidenceIds !== undefined) {
    properties[P.linkedEvidence] = {
      relation: (fields.linkedEvidenceIds || []).map(id => ({ id })),
    };
  }
  if (fields.status !== undefined) {
    properties[P.status] = fields.status ? { select: { name: fields.status } } : { select: null };
  }
  if (fields.lastDriftCheck !== undefined) {
    properties[P.lastDriftCheck] = fields.lastDriftCheck
      ? { date: { start: fields.lastDriftCheck } }
      : { date: null };
  }
  if (fields.driftFindingIds !== undefined) {
    properties[P.driftFindings] = {
      relation: (fields.driftFindingIds || []).map(id => ({ id })),
    };
  }
  if (fields.ownerIds !== undefined) {
    properties[P.owner] = { people: (fields.ownerIds || []).map(id => ({ id })) };
  }
  if (fields.notes !== undefined) {
    properties[P.notes] = { rich_text: [{ text: { content: fields.notes || '' } }] };
  }
  return properties;
}

export async function createLabel(fields) {
  if (!fields.sku) throw new Error('createLabel: sku is required');
  const properties = buildProperties(fields, { forCreate: true });
  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.productLabels },
    properties,
  });
  const parsed = parsePage(page);
  // Wave 5.2 — queue label-drift detection on create. Best-effort; never throws.
  // Skipped when the label has no backing PCS yet (drift is undefined).
  if (parsed.pcsDocumentId) {
    scheduleLabelDrift(parsed.id, 'create');
  }
  return parsed;
}

export async function updateLabel(id, fields) {
  const properties = buildProperties(fields);
  const page = await notion.pages.update({ page_id: id, properties });
  const parsed = parsePage(page);
  // Wave 5.2 — only re-check drift when claims, ingredients, doses, or the
  // backing PCS changed. Skips drift-stamp updates to avoid infinite loops,
  // since the drift detector itself writes lastDriftCheck + driftFindingIds.
  const driftRelevant = (
    fields.approvedClaimsOnLabel !== undefined
    || fields.ingredientListIds !== undefined
    || fields.ingredientDoses !== undefined
    || fields.pcsDocumentId !== undefined
  );
  const isDriftStampOnly = (
    fields.lastDriftCheck !== undefined || fields.driftFindingIds !== undefined
  );
  if (driftRelevant && !isDriftStampOnly && parsed.pcsDocumentId) {
    scheduleLabelDrift(parsed.id, 'update');
  }
  return parsed;
}

/**
 * Best-effort fire-and-forget drift scheduler. Runs on the next tick so the
 * caller's create/update resolves immediately; errors are logged and swallowed
 * so a drift-detection bug never fails a label write.
 */
function scheduleLabelDrift(labelId, reason) {
  // Dynamic import breaks the circular dep (label-drift.js -> pcs-labels.js).
  queueMicrotask(async () => {
    try {
      const { detectDriftForLabel } = await import('./label-drift.js');
      await detectDriftForLabel(labelId);
    } catch (err) {
      console.warn(`[LABEL-DRIFT] scheduled drift (${reason}) failed for ${labelId}:`, err?.message || err);
    }
  });
}
