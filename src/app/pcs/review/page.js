'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import { useToast } from '@/components/Toast';
import CommentThread from '@/components/pcs/CommentThread';

const BUCKET_COLORS = {
  '3A': 'bg-green-100 text-green-800',
  '3B': 'bg-yellow-100 text-yellow-800',
  '3C': 'bg-red-100 text-red-800',
};

export default function ReviewQueue() {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [evidencePackets, setEvidencePackets] = useState([]);
  const [actionNote, setActionNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(0);

  const toast = useToast();
  // Client check is UX hint; server is the source of truth (authenticatePcsWrite).
  const canWrite = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

  // Load queue: claims that aren't yet Authorized or Not approved
  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    setLoading(true);
    try {
      const res = await fetch('/api/pcs/claims');
      if (res.ok) {
        const claims = await res.json();
        // Queue = claims needing review (not yet authorized/rejected)
        const needsReview = claims.filter(c =>
          !c.claimStatus || c.claimStatus === 'Proposed' || c.claimStatus === 'Unknown'
        );
        // Sort: 3A first (highest evidence tier), then by claim number
        needsReview.sort((a, b) => {
          const bucketOrder = { '3A': 0, '3B': 1, '3C': 2 };
          const aBucket = bucketOrder[a.claimBucket] ?? 3;
          const bBucket = bucketOrder[b.claimBucket] ?? 3;
          if (aBucket !== bBucket) return aBucket - bBucket;
          return (a.claimNo || '').localeCompare(b.claimNo || '');
        });
        setQueue(needsReview);
        if (needsReview.length > 0) {
          fetchEvidence(needsReview[0].id);
        }
      }
    } catch {
      toast.error('Failed to load review queue');
    } finally {
      setLoading(false);
    }
  }

  async function fetchEvidence(claimId) {
    try {
      const res = await fetch(`/api/pcs/evidence-packets?claimId=${claimId}`);
      if (res.ok) {
        const packets = await res.json();
        setEvidencePackets(Array.isArray(packets) ? packets : []);
      } else {
        setEvidencePackets([]);
      }
    } catch {
      setEvidencePackets([]);
    }
  }

  const current = queue[currentIndex] || null;

  const handleAction = useCallback(async (status) => {
    if (!current || saving) return;

    // Require note for rejections
    if (status === 'Not approved' && !actionNote.trim()) {
      return; // Let the UI handle the validation message
    }

    setSaving(true);
    try {
      // Update claim status
      const updateBody = { claimStatus: status };
      if (actionNote.trim()) {
        updateBody.claimNotes = [current.claimNotes, actionNote.trim()].filter(Boolean).join('\n\n---\n\n');
      }

      const updateRes = await fetch(`/api/pcs/claims/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update claim status');
      }

      // If there's a note, also add it as a comment for the audit trail
      if (actionNote.trim()) {
        await fetch('/api/pcs/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageId: current.id,
            text: `[${status}] ${actionNote.trim()}`,
          }),
        });
      }

      setCompleted(prev => prev + 1);
      setActionNote('');

      // Move to next claim
      const nextIndex = currentIndex + 1;
      if (nextIndex < queue.length) {
        setCurrentIndex(nextIndex);
        fetchEvidence(queue[nextIndex].id);
      } else {
        setCurrentIndex(queue.length); // Past end = done
      }
    } catch {
      toast.error('Failed to save review action');
    } finally {
      setSaving(false);
    }
  }, [current, currentIndex, queue, actionNote, saving, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      if (!canWrite || !current || saving) return;
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleAction('Authorized');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleAction('Proposed'); // Request more evidence
      }
      // N for next (skip without action) — hold Shift
      else if (e.key === 'N' && e.shiftKey) {
        e.preventDefault();
        const nextIndex = currentIndex + 1;
        if (nextIndex < queue.length) {
          setCurrentIndex(nextIndex);
          setActionNote('');
          fetchEvidence(queue[nextIndex].id);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canWrite, current, saving, handleAction, currentIndex, queue]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  // Queue empty or all done
  if (queue.length === 0 || currentIndex >= queue.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
        <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
          <div className="text-5xl mb-4">&#10003;</div>
          <h2 className="text-xl font-bold text-gray-900">
            {completed > 0 ? `${completed} claims reviewed!` : 'All caught up'}
          </h2>
          <p className="text-gray-500 mt-1">
            {completed > 0 ? 'Great work. All queued claims have been processed.' : 'No claims are pending review right now.'}
          </p>
          <div className="flex justify-center gap-3 mt-6">
            <Link href="/pcs/claims" className="px-4 py-2 bg-pacific-600 text-white rounded-md text-sm font-medium hover:bg-pacific-700 transition-colors">
              View all claims
            </Link>
            <Link href="/pcs" className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Command Center
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Claim {currentIndex + 1} of {queue.length}
            {completed > 0 && ` — ${completed} reviewed this session`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400 space-x-3">
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px]">A</kbd> Approve
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px]">R</kbd> Request evidence
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px]">Shift+N</kbd> Skip
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-pacific-500 rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex) / queue.length) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main review card */}
        <div className="lg:col-span-2 space-y-4">
          {/* Claim card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-500">#{current.claimNo || '—'}</span>
                {current.claimBucket && (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${BUCKET_COLORS[current.claimBucket] || 'bg-gray-100 text-gray-700'}`}>
                    {current.claimBucket}
                  </span>
                )}
                {current.disclaimerRequired && (
                  <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">Disclaimer</span>
                )}
              </div>
              <Link href={`/pcs/claims/${current.id}`} className="text-xs text-gray-400 hover:text-pacific-600">
                Full detail
              </Link>
            </div>
            <p className="text-lg text-gray-900 leading-relaxed">{current.claim}</p>

            {current.claimNotes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="text-xs font-medium text-gray-500 block mb-1">Existing notes</label>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{current.claimNotes}</p>
              </div>
            )}
          </div>

          {/* Evidence panel */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Linked Evidence
              <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                {evidencePackets.length}
              </span>
            </h2>
            {evidencePackets.length === 0 ? (
              <div className="text-center py-6 bg-red-50 rounded-lg border border-red-100">
                <p className="text-sm text-red-600 font-medium">No evidence linked</p>
                <p className="text-xs text-red-400 mt-1">Consider requesting more evidence before approving</p>
              </div>
            ) : (
              <div className="space-y-3">
                {evidencePackets.map(ep => (
                  <div key={ep.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium text-gray-900">{ep.name || 'Untitled'}</p>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {ep.meetsSqrThreshold !== undefined && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            ep.meetsSqrThreshold ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {ep.meetsSqrThreshold ? 'SQR Pass' : 'SQR Fail'}
                          </span>
                        )}
                        {ep.evidenceRole && (
                          <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                            {ep.evidenceRole}
                          </span>
                        )}
                      </div>
                    </div>
                    {ep.relevanceNote && (
                      <p className="text-xs text-gray-500 mt-2">{ep.relevanceNote}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action area */}
          {canWrite && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Your Decision</h2>
              <textarea
                value={actionNote}
                onChange={e => setActionNote(e.target.value)}
                placeholder="Add rationale or notes (required for rejections)..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-pacific-500 focus:border-pacific-500 mb-4"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleAction('Authorized')}
                  disabled={saving}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-40 transition-colors"
                >
                  {saving ? 'Saving...' : 'Approve (A)'}
                </button>
                <button
                  onClick={() => handleAction('Proposed')}
                  disabled={saving}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-yellow-500 text-white text-sm font-medium rounded-md hover:bg-yellow-600 disabled:opacity-40 transition-colors"
                >
                  Request Evidence (R)
                </button>
                <button
                  onClick={() => {
                    if (!actionNote.trim()) {
                      document.querySelector('textarea')?.focus();
                      return;
                    }
                    handleAction('Not approved');
                  }}
                  disabled={saving}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-40 transition-colors"
                >
                  Reject
                </button>
              </div>
              {!actionNote.trim() && (
                <p className="text-xs text-gray-400 mt-2">
                  Note: Rejections require a written rationale above.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right column: discussion */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <CommentThread pageId={current.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
