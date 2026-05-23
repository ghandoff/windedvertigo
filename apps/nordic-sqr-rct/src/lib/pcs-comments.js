/**
 * PCS Comments — Postgres-backed discussion threads on any PCS entity.
 *
 * Part 10 / Tier-1 PR #3 (2026-05-23): rewritten Postgres-first. This file
 * originally wrapped Notion's native page-level comments
 * (notion.comments.list / .create). With the Part 10 migration, Notion is
 * no longer a write surface; comments now live in the `pcs_comments`
 * Supabase table (migration 012).
 *
 * Threading model in Postgres mirrors the one Notion used:
 *   - Top-level comment   → discussion_id = own id,        parent_comment_id = null
 *   - Reply               → discussion_id = thread's id,   parent_comment_id = replied-to id
 *
 * Authorship: comments now require an actor ID (reviewer notion_page_id).
 * The API route passes this from the authenticated user; Notion's API used
 * to infer it from the integration token, which no longer applies.
 *
 * Old Notion-native comments are NOT backfilled here — they lived in a
 * separate API surface (not a database) and were inaccessible to the
 * read-comments capability we'd want anyway. New comments accrue here.
 */

import { getPcsSupabase } from './supabase-pcs.js';

// ─────────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a Postgres pcs_comments row into the public comment shape.
 * `authorName` and `authorAlias` are populated by the caller if a join
 * was performed — otherwise they remain null and the caller can resolve
 * them separately.
 */
function parseRow(row, authorMap = null) {
  const author = authorMap?.get(row.created_by) || null;
  return {
    id: row.id,
    text: row.text || '',
    richText: row.rich_text || [{ text: { content: row.text || '' } }],
    createdAt: row.created_at,
    createdBy: row.created_by,
    authorName: author?.name || null,
    authorAlias: author?.alias || null,
    discussionId: row.discussion_id,
    parentCommentId: row.parent_comment_id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all comments on a PCS entity. Returns newest-first.
 *
 * @param {string} pageId  ID of the parent PCS entity (claim, doc, evidence…)
 * @returns {Promise<object[]>}
 */
export async function getCommentsForPage(pageId) {
  const sb = getPcsSupabase();
  if (!sb) return [];

  const { data: rows, error } = await sb
    .from('pcs_comments')
    .select('*')
    .eq('parent_page_id', pageId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[pcs-comments] getCommentsForPage failed:', error.message);
    return [];
  }
  if (!rows?.length) return [];

  // Resolve author names in one batched query.
  const authorIds = [...new Set(rows.map(r => r.created_by).filter(Boolean))];
  const authorMap = new Map();
  if (authorIds.length > 0) {
    const { data: reviewers } = await sb
      .from('reviewers')
      .select('notion_page_id, first_name, last_name, alias')
      .in('notion_page_id', authorIds);
    for (const r of reviewers || []) {
      const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.alias || 'Unknown';
      authorMap.set(r.notion_page_id, { name, alias: r.alias });
    }
  }

  return rows.map(row => parseRow(row, authorMap));
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a comment to a PCS entity. Requires an actor ID since the platform
 * is now the sole authorship source.
 *
 * @param {string}      pageId      Parent PCS entity ID
 * @param {string}      text        Comment body (plain text)
 * @param {object}      opts
 * @param {string|null} opts.discussionId  Existing thread to reply into, or null for a new top-level comment
 * @param {string}      opts.actorId       Author's reviewer ID (notion_page_id)
 * @returns {Promise<object>} The created comment
 */
export async function addComment(pageId, text, { discussionId = null, actorId } = {}) {
  if (!text?.trim()) throw new Error('Comment text is required');
  if (!actorId) throw new Error('actorId is required');

  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');

  // For a new top-level comment, generate the discussion_id up front so
  // discussion_id === own id (matches the Notion semantics).
  const newId = crypto.randomUUID();
  const isReply = !!discussionId;

  const row = {
    id: newId,
    parent_page_id: pageId,
    created_by: actorId,
    text: text.trim(),
    rich_text: [{ text: { content: text.trim() } }],
    discussion_id: isReply ? discussionId : newId,
    parent_comment_id: null, // (replies set this in a future iteration; for now
                             //  every reply is "to the thread" rather than to
                             //  a specific comment, matching current UI)
  };

  const { data, error } = await sb
    .from('pcs_comments')
    .insert(row)
    .select('*')
    .single();

  if (error) throw new Error(`Comment insert failed: ${error.message}`);

  // Resolve author name on the way out so the UI gets a complete object.
  const { data: reviewer } = await sb
    .from('reviewers')
    .select('notion_page_id, first_name, last_name, alias')
    .eq('notion_page_id', actorId)
    .maybeSingle();
  const authorMap = new Map();
  if (reviewer) {
    const name = `${reviewer.first_name || ''} ${reviewer.last_name || ''}`.trim() || reviewer.alias || 'Unknown';
    authorMap.set(reviewer.notion_page_id, { name, alias: reviewer.alias });
  }
  return parseRow(data, authorMap);
}

// ─────────────────────────────────────────────────────────────────────────────
// View helper — unchanged from the Notion-era API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Group comments by discussion thread. Returns threads newest-first by
 * root timestamp; within a thread, replies are oldest-first.
 *
 * @param {object[]} comments  Flat array from getCommentsForPage()
 * @returns {object[]} Array of { root, replies[] }
 */
export function groupByThread(comments) {
  const threads = {};

  for (const comment of comments) {
    const threadId = comment.discussionId || comment.id;
    if (!threads[threadId]) threads[threadId] = { root: null, replies: [] };
    if (comment.id === threadId || !comment.parentCommentId) {
      threads[threadId].root = comment;
    } else {
      threads[threadId].replies.push(comment);
    }
  }

  return Object.values(threads)
    .filter(t => t.root)
    .map(t => ({
      ...t,
      replies: t.replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    }))
    .sort((a, b) => new Date(b.root.createdAt) - new Date(a.root.createdAt));
}
