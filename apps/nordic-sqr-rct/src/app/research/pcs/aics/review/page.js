'use client';

/**
 * /research/pcs/aics/review — AICS Claim Reviewer Interface.
 *
 * For users with `aics.claims:review` capability (aics-reviewer role,
 * RA, admin, super-user). Shows AICS documents assigned to the current
 * reviewer (the list API is scoped server-side for aics-reviewer role).
 *
 * Flow: pick a document → review each claim (approve/reject + notes) →
 * progress bar shows N of M claims reviewed in this session.
 *
 * Blind: other reviewers' decisions are not shown until you submit.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { can } from '@/lib/auth/capabilities';

export default function AicsReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [docDetails, setDocDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  // sessionReviews: Map of claimId → { decision, notes } submitted this session
  const [sessionReviews, setSessionReviews] = useState({});
  const [submitting, setSubmitting] = useState(null); // claimId currently submitting
  const [submitErrors, setSubmitErrors] = useState({}); // claimId → error string

  const canReview = !authLoading && can(user, 'aics.claims:review');

  useEffect(() => {
    if (authLoading || !canReview) return;
    fetch('/api/pcs/aics')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => setDocuments(Array.isArray(data) ? data : (data?.items || [])))
      .catch(err => setError(err?.message || 'Failed to load documents'))
      .finally(() => setLoading(false));
  }, [authLoading, canReview]);

  const loadDocDetails = useCallback(async (docId) => {
    if (!docId) return;
    setDetailsLoading(true);
    setDocDetails(null);
    setSessionReviews({});
    setSubmitErrors({});
    try {
      const [docRes, versionsRes] = await Promise.all([
        fetch(`/api/pcs/aics/${docId}`),
        fetch(`/api/pcs/aics/${docId}/versions`),
      ]);
      const doc = docRes.ok ? await docRes.json() : null;
      const versData = versionsRes.ok ? await versionsRes.json() : null;

      // Get claims from latest version
      const versions = Array.isArray(versData) ? versData : (versData?.versions || []);
      const latestVersion = versions.find(v => v.isLatest) || versions[0];
      let claims = [];
      if (latestVersion?.id) {
        const claimsRes = await fetch(`/api/pcs/aics/${docId}/claims?versionId=${latestVersion.id}`);
        const claimsData = claimsRes.ok ? await claimsRes.json() : {};
        claims = Array.isArray(claimsData) ? claimsData : (claimsData?.claims || []);
      }

      setDocDetails({ doc, latestVersion, claims });
    } catch (err) {
      setError(`Failed to load document: ${err?.message}`);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDocId) loadDocDetails(selectedDocId);
  }, [selectedDocId, loadDocDetails]);

  async function handleSubmitReview(claimId, decision, notes) {
    setSubmitting(claimId);
    setSubmitErrors(prev => { const next = { ...prev }; delete next[claimId]; return next; });
    try {
      const res = await fetch(`/api/pcs/aics/claims/${claimId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          // Already submitted — treat as success
          setSessionReviews(prev => ({ ...prev, [claimId]: { decision: body.existingReview?.decision || decision, notes } }));
        } else {
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
      } else {
        setSessionReviews(prev => ({ ...prev, [claimId]: { decision, notes } }));
      }
    } catch (err) {
      setSubmitErrors(prev => ({ ...prev, [claimId]: err?.message || 'Submission failed' }));
    } finally {
      setSubmitting(null);
    }
  }

  if (authLoading) return <div className="py-8 text-center text-gray-400 text-sm">Loading…</div>;

  if (!canReview) {
    return (
      <div className="max-w-xl space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-900">
          <p className="font-semibold mb-1">Access restricted</p>
          <p>Claim review requires the aics-reviewer, RA, admin, or super-user role.</p>
        </div>
      </div>
    );
  }

  const claims = docDetails?.claims || [];
  const reviewedCount = Object.keys(sessionReviews).length;
  const totalClaims = claims.length;
  const progressPct = totalClaims > 0 ? Math.round((reviewedCount / totalClaims) * 100) : 0;

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <nav className="text-xs text-gray-500 flex items-center gap-1 mb-2">
            <Link href="/research/pcs/aics" className="hover:text-gray-700 transition">AICS Library</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Claim Review</span>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">AICS Claim Review</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and approve or reject health claims from AICS substantiation dossiers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Document selector */}
        <div className="md:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Documents</h2>
          {loading && (
            <div className="text-sm text-gray-400">Loading…</div>
          )}
          {error && !loading && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}
          {!loading && documents.length === 0 && !error && (
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-4 text-center">
              No documents assigned to you.
            </div>
          )}
          <div className="space-y-1.5">
            {documents.map(doc => (
              <button
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                  selectedDocId === doc.id
                    ? 'border-pacific-400 bg-pacific-50 text-pacific-900'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="font-medium">{doc.aiName || doc.aicsId || 'Unnamed'}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {doc.classification || '—'}
                  {doc.demographic ? ` · ${doc.demographic}` : ''}
                </div>
                <div className="text-xs mt-0.5">
                  <span className={`inline-block rounded-full px-1.5 py-0.5 ${
                    doc.raReviewStatus === 'Approved' ? 'bg-green-100 text-green-700' :
                    doc.raReviewStatus?.includes('Pending') ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {doc.raReviewStatus || 'No status'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Claims review panel */}
        <div className="md:col-span-2 space-y-4">
          {!selectedDocId && (
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
              Select a document to begin reviewing claims
            </div>
          )}

          {selectedDocId && detailsLoading && (
            <div className="py-8 text-center text-gray-400 text-sm">Loading claims…</div>
          )}

          {selectedDocId && !detailsLoading && docDetails && (
            <>
              {/* Progress bar */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    {docDetails.doc?.aiName || 'Document'} — claim review progress
                  </span>
                  <span className="text-gray-500">{reviewedCount} of {totalClaims} reviewed this session</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pacific-500 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                {reviewedCount === totalClaims && totalClaims > 0 && (
                  <p className="text-xs text-green-700 font-medium">All claims reviewed for this document.</p>
                )}
              </div>

              {/* Claims list */}
              {claims.length === 0 && (
                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-6 text-center">
                  No claims found for the latest version of this document.
                </div>
              )}

              {claims.map((claim, idx) => {
                const reviewed = sessionReviews[claim.id];
                const isSubmitting = submitting === claim.id;
                const submitError = submitErrors[claim.id];
                return (
                  <ClaimReviewCard
                    key={claim.id}
                    claim={claim}
                    idx={idx}
                    reviewed={reviewed}
                    isSubmitting={isSubmitting}
                    submitError={submitError}
                    onSubmit={handleSubmitReview}
                  />
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ClaimReviewCard({ claim, idx, reviewed, isSubmitting, submitError, onSubmit }) {
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [expanded, setExpanded] = useState(!reviewed);

  const handleSubmit = () => {
    if (!decision) return;
    onSubmit(claim.id, decision, notes);
  };

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${reviewed ? 'border-green-200' : 'border-gray-200'}`}>
      {/* Claim header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition"
      >
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-xs font-medium text-gray-600 flex items-center justify-center mt-0.5">
          {idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 leading-snug">{claim.claimText || '(no claim text)'}</p>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {claim.benefitCategory && (
              <span className="text-xs bg-pacific-50 text-pacific-700 rounded-full px-2 py-0.5">{claim.benefitCategory}</span>
            )}
            {claim.ageGroup && (
              <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{claim.ageGroup}</span>
            )}
            {claim.minDose != null && (
              <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                ≥{claim.minDose}{claim.minDoseUnit ? ' ' + claim.minDoseUnit : ''}
              </span>
            )}
            {claim.grade && (
              <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                claim.grade === 'A' ? 'bg-green-100 text-green-700' :
                claim.grade === 'B' ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-600'
              }`}>Grade {claim.grade}</span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          {reviewed && (
            <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${
              reviewed.decision === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {reviewed.decision === 'approved' ? '✓ Approved' : '✗ Rejected'}
            </span>
          )}
          <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Review form */}
      {expanded && !reviewed && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Decision:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`decision-${claim.id}`}
                value="approved"
                checked={decision === 'approved'}
                onChange={() => setDecision('approved')}
                className="text-green-600"
              />
              <span className="text-sm text-green-700 font-medium">Approve</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`decision-${claim.id}`}
                value="rejected"
                checked={decision === 'rejected'}
                onChange={() => setDecision('rejected')}
                className="text-red-600"
              />
              <span className="text-sm text-red-700 font-medium">Reject</span>
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Notes {decision === 'rejected' ? '(required for rejections)' : '(optional)'}
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add context for your decision…"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pacific-500 resize-none"
            />
          </div>
          {submitError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={!decision || isSubmitting || (decision === 'rejected' && !notes.trim())}
            className="flex items-center gap-2 px-4 py-2 bg-pacific-600 hover:bg-pacific-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {isSubmitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>
      )}

      {/* Already reviewed — show submitted decision */}
      {expanded && reviewed && (
        <div className={`px-4 pb-3 border-t pt-3 ${reviewed.decision === 'approved' ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'}`}>
          <p className="text-sm text-gray-700">
            <span className="font-medium">{reviewed.decision === 'approved' ? '✓ Approved' : '✗ Rejected'}</span>
            {reviewed.notes ? ` — ${reviewed.notes}` : ''}
          </p>
          <p className="text-xs text-gray-400 mt-1">Submitted this session</p>
        </div>
      )}
    </div>
  );
}
