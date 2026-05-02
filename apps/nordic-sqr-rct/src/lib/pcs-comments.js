/**
 * PCS Comments — read/write Notion page-level comments.
 *
 * The Notion API supports comments on any page. Each PCS entity
 * (document, claim, evidence item, etc.) is a Notion page, so we
 * can attach threaded discussion comments to any record.
 *
 * Notion comments are tied to the page, not to specific properties.
 * This is perfect for RA review notes, approval rationale, and
 * cross-team discussion on individual claims.
 */

import { Client } from '@notionhq/client';
import { withRetry } from './notion.js';

const _notion = new Client({ auth: process.env.NOTION_TOKEN, timeoutMs: 30000 });
const notion = {
  comments: {
    list: (...args) => withRetry(() => _notion.comments.list(...args)),
    create: (...args) => withRetry(() => _notion.comments.create(...args)),
  },
};

/**
 * Parse a Notion comment object into a clean shape.
 */
function parseComment(comment) {
  const text = (comment.rich_text || []).map(t => t.plain_text).join('');
  return {
    id: comment.id,
    text,
    richText: comment.rich_text || [],
    createdAt: comment.created_time,
    createdBy: comment.created_by?.id || null,
    // discussion_id groups threaded replies together
    discussionId: comment.discussion_id || null,
    parentCommentId: comment.parent?.comment_id || null,
  };
}

/**
 * Get all comments on a Notion page (any PCS entity).
 * Returns comments sorted newest-first.
 *
 * @param {string} pageId - Notion page ID
 * @returns {Promise<object[]>}
 */
export async function getCommentsForPage(pageId) {
  const all = [];
  let cursor;
  try {
    do {
      const params = { block_id: pageId };
      if (cursor) params.start_cursor = cursor;
      const res = await notion.comments.list(params);
      all.push(...res.results.map(parseComment));
      cursor = res.has_more ? res.next_cursor : null;
    } while (cursor);
  } catch (err) {
    // Integration lacks "Read comments" capability, or page isn't shared.
    // Degrade gracefully — CommentThread renders the empty state.
    if (err?.code === 'unauthorized' || err?.code === 'restricted_resource') {
      return [];
    }
    throw err;
  }

  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Add a comment to a Notion page.
 *
 * @param {string} pageId - Notion page ID
 * @param {string} text - Plain text comment
 * @param {string|null} discussionId - Reply to an existing discussion thread
 * @returns {Promise<object>} The created comment
 */
export async function addComment(pageId, text, discussionId = null) {
  if (!text?.trim()) throw new Error('Comment text is required');

  const params = {
    rich_text: [{ text: { content: text.trim() } }],
  };

  if (discussionId) {
    // Reply to an existing discussion thread
    params.discussion_id = discussionId;
  } else {
    // New top-level comment on the page
    params.parent = { page_id: pageId };
  }

  const comment = await notion.comments.create(params);
  return parseComment(comment);
}

/**
 * Group comments by discussion thread.
 * Returns an array of threads, each with a root comment and replies.
 *
 * @param {object[]} comments - Flat array of parsed comments
 * @returns {object[]} Array of { root, replies[] } objects, newest thread first
 */
export function groupByThread(comments) {
  const threads = {};

  for (const comment of comments) {
    const threadId = comment.discussionId || comment.id;
    if (!threads[threadId]) {
      threads[threadId] = { root: null, replies: [] };
    }
    if (!comment.parentCommentId) {
      threads[threadId].root = comment;
    } else {
      threads[threadId].replies.push(comment);
    }
  }

  // Convert to array, sort threads by root comment date (newest first)
  return Object.values(threads)
    .filter(t => t.root) // Skip orphaned replies
    .map(t => ({
      ...t,
      replies: t.replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    }))
    .sort((a, b) => new Date(b.root.createdAt) - new Date(a.root.createdAt));
}
