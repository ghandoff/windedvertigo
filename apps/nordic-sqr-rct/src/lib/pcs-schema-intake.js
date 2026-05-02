/**
 * PCS Schema Intake — read-only access to survey responses.
 *
 * Schema Intake captures user preferences about how PCS data
 * should be structured. Read-only in the portal (form is in Notion).
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';


const P = PROPS.schemaIntake;

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: p[P.name]?.title?.[0]?.plain_text || '',
    respondentEmail: p[P.respondentEmail]?.email || null,
    role: p[P.role]?.select?.name || null,
    digitizeFirst: p[P.digitizeFirst]?.select?.name || null,
    startFrom: p[P.startFrom]?.select?.name || null,
    versionsTreatedAs: p[P.versionsTreatedAs]?.select?.name || null,
    evidenceReuse: p[P.evidenceReuse]?.select?.name || null,
    weeklyOutputs: (p[P.weeklyOutputs]?.multi_select || []).map(s => s.name),
    thirtyDayWin: (p[P.thirtyDayWin]?.multi_select || []).map(s => s.name),
    biggestTimeSink: (p[P.biggestTimeSink]?.rich_text || []).map(t => t.plain_text).join(''),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function getAllIntakeResponses() {
  let all = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.schemaIntake,
      start_cursor: cursor,
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all.map(parsePage);
}

export async function getIntakeResponse(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}
