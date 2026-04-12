"use client";

import { useState, useTransition } from "react";
import { addCommentAction, deleteCommentAction } from "./comment-actions";
import type { Comment, CommentTargetType } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function CommentItem({
  comment,
  currentEmail,
  targetType,
  targetId,
  depth,
}: {
  comment: Comment;
  currentEmail: string;
  targetType: CommentTargetType;
  targetId: string;
  depth: number;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [deleted, setDeleted] = useState(false);

  if (deleted) return null;

  const isOwn = comment.author_email === currentEmail;
  const initial = comment.author_email.charAt(0).toUpperCase();

  function handleReply() {
    if (!replyText.trim()) return;
    startSubmit(async () => {
      await addCommentAction(targetType, targetId, replyText.trim(), comment.id);
      setReplyText("");
      setReplying(false);
    });
  }

  function handleDelete() {
    startDelete(async () => {
      await deleteCommentAction(comment.id);
      setDeleted(true);
    });
  }

  return (
    <div className={depth > 0 ? "ml-6 border-l border-border pl-3" : ""}>
      <div className="flex items-start gap-2 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
          {initial}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">
              {comment.author_email.split("@")[0]}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {timeAgo(comment.created_at)}
            </span>
          </div>
          <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{comment.body}</p>
          <div className="flex items-center gap-3 mt-1">
            {depth < 2 && (
              <button
                onClick={() => setReplying(!replying)}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                reply
              </button>
            )}
            {isOwn && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors"
              >
                {deleting ? "..." : "delete"}
              </button>
            )}
          </div>
          {replying && (
            <div className="mt-2 flex gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="write a reply..."
                className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleReply()}
                autoFocus
              />
              <button
                onClick={handleReply}
                disabled={submitting || !replyText.trim()}
                className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
              >
                {submitting ? "..." : "reply"}
              </button>
            </div>
          )}
        </div>
      </div>
      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          currentEmail={currentEmail}
          targetType={targetType}
          targetId={targetId}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function CommentThread({
  comments,
  targetType,
  targetId,
  currentEmail,
}: {
  comments: Comment[];
  targetType: CommentTargetType;
  targetId: string;
  currentEmail: string;
}) {
  const [body, setBody] = useState("");
  const [submitting, startSubmit] = useTransition();

  function handleSubmit() {
    if (!body.trim()) return;
    startSubmit(async () => {
      await addCommentAction(targetType, targetId, body.trim());
      setBody("");
    });
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">no comments yet</p>
      ) : (
        <div className="space-y-1">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              currentEmail={currentEmail}
              targetType={targetType}
              targetId={targetId}
              depth={0}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="add a comment..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !body.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {submitting ? "..." : "post"}
        </button>
      </div>
    </div>
  );
}
