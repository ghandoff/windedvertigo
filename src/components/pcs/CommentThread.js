'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';

/**
 * Reusable comment thread component for any PCS entity.
 * Fetches and displays threaded comments, supports adding new comments and replies.
 *
 * Usage: <CommentThread pageId="notion-page-id" />
 */
export default function CommentThread({ pageId }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null); // discussionId for reply
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (pageId) fetchComments();
  }, [pageId]);

  async function fetchComments() {
    try {
      const res = await fetch(`/api/pcs/comments?pageId=${pageId}&grouped=true`);
      if (res.ok) {
        const data = await res.json();
        setThreads(data.comments || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/pcs/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId,
          text: newComment.trim(),
          discussionId: replyTo,
        }),
      });

      if (res.ok) {
        setNewComment('');
        setReplyTo(null);
        await fetchComments(); // Refresh threads
      }
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  }

  function handleReply(discussionId) {
    setReplyTo(discussionId);
    inputRef.current?.focus();
  }

  function cancelReply() {
    setReplyTo(null);
    setNewComment('');
  }

  function timeAgo(dateStr) {
    const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-12 bg-gray-100 rounded" />
      </div>
    );
  }

  // Client check is UX hint; server is the source of truth (authenticatePcsWrite).
  const canComment = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        Discussion
        {threads.length > 0 && (
          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
            {threads.reduce((n, t) => n + 1 + t.replies.length, 0)}
          </span>
        )}
      </h3>

      {/* Threads */}
      {threads.length === 0 && !canComment && (
        <p className="text-sm text-gray-400">No comments yet.</p>
      )}

      {threads.map(thread => (
        <div key={thread.root.id} className="space-y-2">
          {/* Root comment */}
          <CommentBubble
            comment={thread.root}
            timeAgo={timeAgo}
            onReply={canComment ? () => handleReply(thread.root.discussionId) : null}
          />
          {/* Replies */}
          {thread.replies.length > 0 && (
            <div className="ml-6 border-l-2 border-gray-100 pl-4 space-y-2">
              {thread.replies.map(reply => (
                <CommentBubble key={reply.id} comment={reply} timeAgo={timeAgo} isReply />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Add comment form */}
      {canComment && (
        <form onSubmit={handleSubmit} className="space-y-2">
          {replyTo && (
            <div className="flex items-center gap-2 text-xs text-pacific-600">
              <span>Replying to thread</span>
              <button type="button" onClick={cancelReply} className="text-gray-400 hover:text-gray-600">
                Cancel
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-pacific-100 text-pacific-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              {(user?.firstName?.[0] || '').toUpperCase()}
            </div>
            <div className="flex-1">
              <textarea
                ref={inputRef}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder={replyTo ? 'Write a reply...' : 'Add a comment...'}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-pacific-500 focus:border-pacific-500"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
                }}
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-400">Cmd+Enter to submit</span>
                <button
                  type="submit"
                  disabled={!newComment.trim() || submitting}
                  className="px-3 py-1 bg-pacific-600 text-white text-xs font-medium rounded-md hover:bg-pacific-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Posting...' : replyTo ? 'Reply' : 'Comment'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {!canComment && threads.length > 0 && (
        <p className="text-xs text-gray-400 italic">Read-only access — commenting requires PCS write permission.</p>
      )}
    </div>
  );
}

function CommentBubble({ comment, timeAgo, onReply, isReply }) {
  return (
    <div className={`flex gap-2 ${isReply ? '' : ''}`}>
      <div className={`w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5`}>
        {comment.authorName
          ? comment.authorName[0].toUpperCase()
          : <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
            </svg>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{comment.text}</p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-gray-400">{timeAgo(comment.createdAt)}</span>
          {onReply && (
            <button onClick={onReply} className="text-xs text-pacific-600 hover:text-pacific-800 font-medium">
              Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
