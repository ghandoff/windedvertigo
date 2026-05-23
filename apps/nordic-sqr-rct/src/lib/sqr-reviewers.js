/**
 * SQR-RCT Reviewer CRUD — Notion-canonical with Postgres mirror scaffolding.
 *
 * Phase 1 of the Postgres migration. All existing functions keep their
 * Notion-only behavior unchanged. The Postgres methods (parsePostgresReviewerRow,
 * syncRecentReviewersToPostgres, syncSingleReviewerPageToPostgres) are additive.
 *
 * Phase 3 — read functions are gated behind shouldReadFromSqrPostgres().
 * Write functions (auth, create, update) are NOT gated — Notion-only for now.
 */

import { notion } from './notion.js';
import {
  getPcsSupabase,
  mirrorToPostgres,
  writePostgresFirst,
  shouldUseStrongConsistency,
} from './supabase-pcs.js';
import {
  shouldReadFromSqrPostgres,
  shouldWriteToSqrPostgresFirst,
  shouldUseSqrStrongConsistency,
  SQR_DB,
} from './sqr-config.js';

// No column-name overrides needed — all camelCase → snake_case mappings are
// mechanical. The `password_hash` column is populated directly by auth writes
// (not via notionShapeToPgRow), so it doesn't appear in the shape.
const REVIEWERS_PG_COLUMN_MAP = {};

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers (not exported — mirrors pcs-evidence.js pattern)
// ─────────────────────────────────────────────────────────────────────────────

function extractTitle(prop) {
  return prop?.title?.[0]?.plain_text || '';
}

function extractRichText(prop) {
  return (prop?.rich_text || []).map(t => t.plain_text).join('');
}

function parseReviewerPage(page) {
  const p = page.properties;
  const profileImageUrl = extractRichText(p['Profile Image']) || null;
  const isAdmin = p['Admin']?.checkbox || false;
  const explicitRoles = (p['Roles']?.multi_select || []).map(s => s.name);
  // Backwards-compatible: derive roles from Admin checkbox when Roles is empty
  const roles = explicitRoles.length > 0
    ? explicitRoles
    : isAdmin
      ? ['sqr-rct', 'pcs', 'admin']
      : ['sqr-rct'];
  return {
    id: page.id,
    firstName: extractTitle(p['First Name']),
    lastName: extractRichText(p['Last Name (Surname)']),
    email: p['Email']?.email || '',
    affiliation: extractRichText(p['Affiliation']),
    affiliationType: p['Affiliation Type']?.select?.name || '',
    alias: extractRichText(p['Alias']),
    discipline: extractRichText(p['Discipline/Specialty']),
    domainExpertise: (p['Domain expertise']?.multi_select || []).map(s => s.name),
    yearsExperience: p['Years of Experience']?.number || null,
    consent: p['Consent']?.checkbox || false,
    trainingCompleted: p['Training Completed']?.checkbox || false,
    isAdmin,
    roles,
    onboardingDate: p['Onboarding Date']?.date?.start || null,
    profileImageUrl,
    // Wave 7.0.7 — forced-reset flow. Set to true by the bcrypt backfill
    // script for any row whose password was stored plain-text prior to the
    // Notion-side-exposure hotfix. Login intercepts this and routes the
    // reviewer into /reset-password.
    passwordResetRequired: p['Password reset required']?.checkbox || false,
    // Wave 7.3.0 Phase B — email confirmation marker. Stamped by
    // /api/auth/confirm-email when the reviewer accepts/supplies their
    // email-as-key via the EmailConfirmationBanner.
    emailConfirmedAt: p['Email confirmed at']?.date?.start || null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Postgres inverse mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a Postgres `reviewers` table row back to the parseReviewerPage shape.
 * All snake_case → camelCase. `notion_page_id` becomes `id` (Notion-id is what
 * the rest of the app uses for routing and relations).
 *
 * Note: `password_hash` is intentionally omitted — it is never returned to
 * callers via the Notion shape; auth reads it directly from Postgres.
 */
export function parsePostgresReviewerRow(row) {
  return {
    id: row.notion_page_id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    email: row.email || '',
    affiliation: row.affiliation || '',
    affiliationType: row.affiliation_type || '',
    alias: row.alias || '',
    discipline: row.discipline || '',
    domainExpertise: row.domain_expertise || [],
    yearsExperience: row.years_experience ?? null,
    consent: row.consent || false,
    trainingCompleted: row.training_completed || false,
    isAdmin: row.is_admin || false,
    roles: row.roles || ['sqr-rct'],
    onboardingDate: row.onboarding_date || null,
    profileImageUrl: row.profile_image_url || null,
    passwordResetRequired: row.password_reset_required || false,
    emailConfirmedAt: row.email_confirmed_at || null,
    // Included for auth — login route reads reviewer.passwordHash directly.
    // Never exposed in API responses; only consumed within the login handler.
    passwordHash: row.password_hash || null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Notion CRUD (Phase 1 — Notion-only, no read/write gating yet)
// ─────────────────────────────────────────────────────────────────────────────

export async function getReviewerByAlias(alias) {
  if (shouldReadFromSqrPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('reviewers')
        .select('*')
        .eq('alias', alias)
        .maybeSingle();
      if (!error && data) return parsePostgresReviewerRow(data);
    } catch (err) {
      console.warn('[sqr-reviewers] Postgres read failed, falling back to Notion:', err.message);
    }
  }
  // Notion fallback — parse into the same normalized shape so callers
  // don't need to handle two different structures.
  const res = await notion.databases.query({
    database_id: SQR_DB.reviewers,
    filter: { property: 'Alias', rich_text: { equals: alias } },
  });
  if (!res.results[0]) return null;
  const parsed = parseReviewerPage(res.results[0]);
  // Attach the password hash from the raw page for auth (Notion-fallback path only).
  parsed.passwordHash = res.results[0].properties?.['Password']?.rich_text?.[0]?.plain_text || null;
  return parsed;
}

export async function getReviewerById(pageId) {
  if (shouldReadFromSqrPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb.from('reviewers').select('*').eq('notion_page_id', pageId).maybeSingle();
      if (!error && data) return parsePostgresReviewerRow(data);
    } catch (err) {
      console.warn('[sqr-reviewers] Postgres read failed, falling back to Notion:', err.message);
    }
  }
  const page = await notion.pages.retrieve({ page_id: pageId });
  return parseReviewerPage(page);
}

export async function getAllReviewers() {
  if (shouldReadFromSqrPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('reviewers')
        .select('*')
        .eq('consent', true)
        .order('first_name', { ascending: true });
      if (!error && data) return data.map(parsePostgresReviewerRow);
    } catch (err) {
      console.warn('[sqr-reviewers] Postgres read failed, falling back to Notion:', err.message);
    }
  }
  const res = await notion.databases.query({
    database_id: SQR_DB.reviewers,
    filter: { property: 'Consent', checkbox: { equals: true } },
    sorts: [{ property: 'First Name', direction: 'ascending' }],
  });
  return res.results.map(parseReviewerPage);
}

export async function getAllReviewersAdmin() {
  if (shouldReadFromSqrPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('reviewers')
        .select('*')
        .order('first_name', { ascending: true });
      if (!error && data) return data.map(parsePostgresReviewerRow);
    } catch (err) {
      console.warn('[sqr-reviewers] Postgres read failed, falling back to Notion:', err.message);
    }
  }
  const res = await notion.databases.query({
    database_id: SQR_DB.reviewers,
    sorts: [{ property: 'First Name', direction: 'ascending' }],
  });
  return res.results.map(parseReviewerPage);
}

export async function createReviewer(data) {
  if (shouldWriteToSqrPostgresFirst()) {
    const preId = crypto.randomUUID();
    const stubRow = {
      id: preId,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      affiliation: data.affiliation || '',
      alias: data.alias || '',
      discipline: data.discipline || '',
      consent: data.consent === true,
      onboardingDate: new Date().toISOString().split('T')[0],
    };
    await writePostgresFirst(
      'reviewers',
      stubRow,
      REVIEWERS_PG_COLUMN_MAP,
      () => notion.pages.create({
        parent: { database_id: SQR_DB.reviewers },
        properties: {
          'First Name': { title: [{ text: { content: data.firstName } }] },
          'Last Name (Surname)': { rich_text: [{ text: { content: data.lastName } }] },
          'Email': { email: data.email },
          'Affiliation': { rich_text: [{ text: { content: data.affiliation || '' } }] },
          'Alias': { rich_text: [{ text: { content: data.alias } }] },
          'Password': { rich_text: [{ text: { content: data.password } }] },
          'Discipline/Specialty': { rich_text: [{ text: { content: data.discipline || '' } }] },
          'Consent': { checkbox: data.consent === true },
          'Onboarding Date': { date: { start: new Date().toISOString().split('T')[0] } },
        },
      }),
    );
    return stubRow;
  }
  return notion.pages.create({
    parent: { database_id: SQR_DB.reviewers },
    properties: {
      'First Name': { title: [{ text: { content: data.firstName } }] },
      'Last Name (Surname)': { rich_text: [{ text: { content: data.lastName } }] },
      'Email': { email: data.email },
      'Affiliation': { rich_text: [{ text: { content: data.affiliation || '' } }] },
      'Alias': { rich_text: [{ text: { content: data.alias } }] },
      'Password': { rich_text: [{ text: { content: data.password } }] },
      'Discipline/Specialty': { rich_text: [{ text: { content: data.discipline || '' } }] },
      'Consent': { checkbox: data.consent === true },
      'Onboarding Date': { date: { start: new Date().toISOString().split('T')[0] } },
    },
  });
}

export async function updateReviewerPassword(reviewerId, hashedPassword) {
  // Write hash directly to Postgres (no Notion mirror — passwords aren't synced to Notion)
  if (shouldWriteToSqrPostgresFirst()) {
    try {
      const sb = getPcsSupabase();
      if (sb) {
        await sb.from('reviewers').update({ password_hash: hashedPassword }).eq('notion_page_id', reviewerId);
      }
    } catch (err) {
      console.warn('[sqr-reviewers] Postgres password update failed:', err.message);
    }
  }
  // Always also update Notion (source of truth for password until Phase 5 auth migration)
  return notion.pages.update({
    page_id: reviewerId,
    properties: {
      'Password': { rich_text: [{ text: { content: hashedPassword } }] },
    },
  });
}

export async function updateReviewerPasswordAndClearResetFlag(reviewerId, hashedPassword) {
  // Write hash and clear reset flag directly to Postgres (no Notion mirror for hash)
  if (shouldWriteToSqrPostgresFirst()) {
    try {
      const sb = getPcsSupabase();
      if (sb) {
        await sb.from('reviewers')
          .update({ password_hash: hashedPassword, password_reset_required: false })
          .eq('notion_page_id', reviewerId);
      }
    } catch (err) {
      console.warn('[sqr-reviewers] Postgres password+reset-flag update failed:', err.message);
    }
  }
  // Always also update Notion (source of truth until Phase 5 auth migration)
  return notion.pages.update({
    page_id: reviewerId,
    properties: {
      'Password': { rich_text: [{ text: { content: hashedPassword } }] },
      'Password reset required': { checkbox: false },
    },
  });
}

export async function setReviewerPasswordResetRequired(reviewerId, required) {
  // Write reset flag directly to Postgres
  if (shouldWriteToSqrPostgresFirst()) {
    try {
      const sb = getPcsSupabase();
      if (sb) {
        await sb.from('reviewers')
          .update({ password_reset_required: !!required })
          .eq('notion_page_id', reviewerId);
      }
    } catch (err) {
      console.warn('[sqr-reviewers] Postgres password_reset_required update failed:', err.message);
    }
  }
  // Always also update Notion
  return notion.pages.update({
    page_id: reviewerId,
    properties: {
      'Password reset required': { checkbox: !!required },
    },
  });
}

export async function updateReviewerProperties(reviewerId, updates) {
  const properties = {};
  if (updates.isAdmin !== undefined) {
    properties['Admin'] = { checkbox: updates.isAdmin };
  }
  if (updates.status !== undefined) {
    properties['Status'] = { select: { name: updates.status } };
  }
  if (shouldWriteToSqrPostgresFirst()) {
    const stubRow = { id: reviewerId, ...updates };
    await writePostgresFirst(
      'reviewers',
      stubRow,
      REVIEWERS_PG_COLUMN_MAP,
      () => notion.pages.update({ page_id: reviewerId, properties }),
    );
    return stubRow;
  }
  return notion.pages.update({
    page_id: reviewerId,
    properties,
  });
}

export async function updateReviewerProfile(reviewerId, updates) {
  const properties = {};
  if (updates.firstName !== undefined) {
    properties['First Name'] = { title: [{ text: { content: updates.firstName } }] };
  }
  if (updates.lastName !== undefined) {
    properties['Last Name (Surname)'] = { rich_text: [{ text: { content: updates.lastName } }] };
  }
  if (updates.affiliation !== undefined) {
    properties['Affiliation'] = { rich_text: [{ text: { content: updates.affiliation } }] };
  }
  if (updates.discipline !== undefined) {
    properties['Discipline/Specialty'] = { rich_text: [{ text: { content: updates.discipline } }] };
  }
  if (updates.yearsExperience !== undefined) {
    properties['Years of Experience'] = { number: updates.yearsExperience ? Number(updates.yearsExperience) : null };
  }
  if (updates.profileImageUrl !== undefined) {
    properties['Profile Image'] = updates.profileImageUrl
      ? { rich_text: [{ text: { content: updates.profileImageUrl } }] }
      : { rich_text: [] };
  }
  if (shouldWriteToSqrPostgresFirst()) {
    const stubRow = { id: reviewerId, ...updates };
    await writePostgresFirst(
      'reviewers',
      stubRow,
      REVIEWERS_PG_COLUMN_MAP,
      () => notion.pages.update({ page_id: reviewerId, properties }),
    );
    return stubRow;
  }
  return notion.pages.update({ page_id: reviewerId, properties });
}

/**
 * Wave 7.3.0 Phase B — find a reviewer by email (case-insensitive).
 */
export async function getReviewerByEmail(email) {
  if (!email) return null;
  const normalized = String(email).trim().toLowerCase();
  if (!normalized) return null;
  if (shouldReadFromSqrPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('reviewers')
        .select('*')
        .eq('email', normalized)
        .maybeSingle();
      if (!error && data) return parsePostgresReviewerRow(data);
    } catch (err) {
      console.warn('[sqr-reviewers] Postgres read failed, falling back to Notion:', err.message);
    }
  }
  // Notion fallback — parse into normalized shape and attach password hash.
  const res = await notion.databases.query({
    database_id: SQR_DB.reviewers,
    filter: { property: 'Email', email: { equals: normalized } },
  });
  if (!res.results[0]) return null;
  const parsed = parseReviewerPage(res.results[0]);
  parsed.passwordHash = res.results[0].properties?.['Password']?.rich_text?.[0]?.plain_text || null;
  return parsed;
}

/**
 * Wave 7.3.0 Phase B — write the reviewer's confirmed email and stamp
 * the Email confirmed at marker. Atomic single-page update.
 */
export async function updateReviewerEmail(reviewerId, email) {
  const normalized = String(email).trim().toLowerCase();
  const emailConfirmedAt = new Date().toISOString();
  if (shouldWriteToSqrPostgresFirst()) {
    const stubRow = { id: reviewerId, email: normalized, emailConfirmedAt };
    await writePostgresFirst(
      'reviewers',
      stubRow,
      REVIEWERS_PG_COLUMN_MAP,
      () => notion.pages.update({
        page_id: reviewerId,
        properties: {
          'Email': { email: normalized },
          'Email confirmed at': { date: { start: emailConfirmedAt } },
        },
      }),
    );
    return stubRow;
  }
  return notion.pages.update({
    page_id: reviewerId,
    properties: {
      'Email': { email: normalized },
      'Email confirmed at': { date: { start: emailConfirmedAt } },
    },
  });
}

/**
 * Update the Roles multi_select property for a reviewer.
 *
 * Part 10 (Supabase-only): Postgres is canonical. We write to Postgres
 * synchronously, then fire-and-forget the Notion mirror so the UI never
 * blocks on a dead/slow Notion API call. Notion errors are silently
 * swallowed — they were retired as a write target in the Part 10 migration.
 *
 * @param {string} reviewerId — reviewer ID (Postgres notion_page_id column)
 * @param {string[]} roles    — full replacement set (e.g. ['reviewer', 'admin'])
 */
export async function updateReviewerRoles(reviewerId, roles) {
  // 1) Postgres write — canonical, blocking.
  if (shouldWriteToSqrPostgresFirst()) {
    const sb = getPcsSupabase();
    if (sb) {
      const { error } = await sb
        .from('reviewers')
        .update({ roles })
        .eq('notion_page_id', reviewerId);
      if (error) throw new Error(`Postgres roles update failed: ${error.message}`);
    }
  }

  // 2) Notion mirror — best-effort, non-blocking. (Notion was retired as a
  //    write target; this is kept only so legacy Notion-side views stay in
  //    sync if anyone happens to look. Failures are expected and ignored.)
  notion.pages
    .update({
      page_id: reviewerId,
      properties: {
        'Roles': { multi_select: roles.map(r => ({ name: r })) },
      },
    })
    .catch(() => { /* Part 10 — Notion no longer canonical */ });
}

// ─────────────────────────────────────────────────────────────────────────────
// Postgres sync helpers (Phase 1 — additive, not called by Notion CRUD yet)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drift-sync: pull any Notion edits since `sinceIso` into Postgres.
 * Paginate Notion with a last_edited_time filter, parse each page,
 * mirror to the `reviewers` table. Idempotent.
 *
 * Guards on SQR_DB.reviewers — if the env var is unset, returns immediately.
 *
 * @param {string} sinceIso — ISO 8601 timestamp (e.g. '2026-05-14T00:00:00Z')
 * @returns {{ count: number, fetched: number, maxSeen: string }}
 */
export async function syncRecentReviewersToPostgres(sinceIso) {
  if (!SQR_DB.reviewers) {
    console.warn('[sqr-reviewers] syncRecentReviewersToPostgres: NOTION_REVIEWER_DB not configured');
    return { count: 0, fetched: 0, maxSeen: sinceIso };
  }
  const filter = {
    timestamp: 'last_edited_time',
    last_edited_time: { on_or_after: sinceIso },
  };
  const res = await notion.databases.query({
    database_id: SQR_DB.reviewers,
    filter,
    page_size: 100,
  });
  let maxSeen = sinceIso;
  let mirrored = 0;
  for (const page of res.results) {
    const parsed = parseReviewerPage(page);
    const result = await mirrorToPostgres('reviewers', parsed, REVIEWERS_PG_COLUMN_MAP, {
      enqueueOnFailure: shouldUseSqrStrongConsistency(),
    });
    if (result.mirrored) mirrored++;
    if (parsed.lastEditedTime > maxSeen) maxSeen = parsed.lastEditedTime;
  }
  return { count: mirrored, fetched: res.results.length, maxSeen };
}

/**
 * Sync a single Notion reviewer page into Postgres by page ID.
 * Used by the page-updated webhook to mirror a specific edited row
 * immediately rather than waiting for the drift-sync cron.
 *
 * @param {string} pageId — Notion page ID
 */
export async function syncSingleReviewerPageToPostgres(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const parsed = parseReviewerPage(page);
  return mirrorToPostgres('reviewers', parsed, REVIEWERS_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseSqrStrongConsistency(),
  });
}
