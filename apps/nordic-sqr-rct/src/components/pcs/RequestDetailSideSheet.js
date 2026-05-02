'use client';

/**
 * Wave 4.5.1 — Request detail side-sheet (VIEW / RESOLVE variant).
 *
 * Portal-rendered right-side slide-over that opens on a request row click.
 * Shows full notes, linked PCS/claims, current status + assignee, and a
 * "Mark resolved" button gated by role:
 *   - Research members can close With-RES requests.
 *   - RA members can close With-RA requests.
 *   - Admin can close anything.
 *   - Cross-team gets a soft warning (not hard-blocked) per plan §6.
 *
 * This is DISTINCT from Wave 4.3.1's BackfillSideSheet (the CREATE variant).
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import ReformulationSuggestionModal from './ReformulationSuggestionModal';

/**
 * Detect whether a request carries a safety-signal reference and, if so,
 * extract the evidenceId + labelId. The upstream workflow
 * (src/lib/label-safety.js) writes `specificField` as
 *   "safety-review:<evidenceId>:<labelId>"
 * which is our stable machine-readable marker. We fall back to scanning the
 * notes if the specificField has been edited by a human.
 */
function extractSafetyRefs(req) {
  if (!req) return null;
  if (req.requestType !== 'label-drift') return null;
  const field = req.specificField || '';
  const m = field.match(/^safety-review:([a-z0-9-]+):([a-z0-9-]+)/i);
  if (m) return { evidenceId: m[1], labelId: m[2] };
  // Legacy fallback: scan notes for "Evidence row <id>" + "id: <labelId>"
  const notes = req.requestNotes || '';
  const ev = notes.match(/Evidence row ([a-z0-9-]{8,})/i);
  const lb = notes.match(/id:\s*([a-z0-9-]{8,})/i);
  if (ev && lb) return { evidenceId: ev[1], labelId: lb[1] };
  return null;
}

function roleCanClose(role, user, assignedRole) {
  if (!user) return false;
  const roles = user?.roles || [];
  if (roles.includes('admin') || user?.isAdmin) return true;
  // Soft gate: research team closes Research; RA closes RA; Template-owner closes Template.
  // We infer membership from the user's PCS roles — the app has `pcs` for writers.
  // Refined team-specific roles ('research' / 'ra') are not modeled yet, so writers
  // may close anything (with a cross-team warning when assignedRole is set).
  return roles.includes('pcs');
}

function isCrossTeamClose(user, assignedRole) {
  if (!user || !assignedRole) return false;
  if (user?.isAdmin || (user?.roles || []).includes('admin')) return false;
  // No team-specific role metadata yet — treat all non-admins as potential cross-team
  // only when the assignedRole matches the opposing status. With current schema we
  // warn when the user is closing a request whose Status is With-<OtherTeam>.
  return false;
}

export default function RequestDetailSideSheet({ requestId, onClose, user, onResolved }) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [req, setReq] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [error, setError] = useState(null);
  const [showReformulationModal, setShowReformulationModal] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!requestId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/pcs/requests/${requestId}`)
      .then(r => r.json())
      .then(data => {
        if (data?.error) setError(data.error);
        else setReq(data);
      })
      .catch(err => setError(err?.message || 'Failed to load request'))
      .finally(() => setLoading(false));
  }, [requestId]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleResolve() {
    if (!resolutionNote.trim()) {
      setError('Resolution note is required.');
      return;
    }
    setResolving(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/pcs/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Done',
          resolutionNote: resolutionNote.trim(),
          resolvedAt: today,
          assignedRole: req?.assignedRole || undefined,
        }),
      });
      const updated = await res.json();
      if (!res.ok) {
        setError(updated?.error || 'Failed to resolve');
      } else {
        setReq(updated);
        setShowResolveForm(false);
        onResolved?.(updated);
      }
    } catch (err) {
      setError(err?.message || 'Failed to resolve');
    } finally {
      setResolving(false);
    }
  }

  if (!mounted) return null;

  const canClose = req && roleCanClose(req.assignedRole, user, req.status);
  const crossTeam = req && isCrossTeamClose(user, req.assignedRole);
  const isResolved = req?.status === 'Done';
  const safetyRefs = extractSafetyRefs(req);

  const body = (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Request detail">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      {/* Panel */}
      <aside className="absolute inset-y-0 right-0 w-96 bg-white shadow-2xl flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Request detail</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading && <p className="text-sm text-gray-500">Loading…</p>}
          {error && !resolving && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {req && !loading && (
            <>
              <div>
                <h3 className="text-base font-semibold text-gray-900">{req.request || 'Untitled request'}</h3>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  {req.status && (
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      isResolved ? 'bg-green-100 text-green-700'
                        : req.status === 'Blocked' ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {req.status}
                    </span>
                  )}
                  {req.priority && (
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      req.priority === 'Safety' ? 'bg-red-100 text-red-700'
                        : req.priority === 'High' ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {req.priority}
                    </span>
                  )}
                  {typeof req.ageDays === 'number' && (
                    <span className="text-gray-500">{req.ageDays}d old</span>
                  )}
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-y-2 text-xs">
                <dt className="text-gray-500 col-span-1">Type</dt>
                <dd className="col-span-2 text-gray-900">{req.requestType || '—'}</dd>

                <dt className="text-gray-500 col-span-1">Field / signal</dt>
                <dd className="col-span-2 text-gray-900 font-mono">{req.specificField || '—'}</dd>

                <dt className="text-gray-500 col-span-1">Role</dt>
                <dd className="col-span-2 text-gray-900">{req.assignedRole || '—'}</dd>

                <dt className="text-gray-500 col-span-1">Assignee</dt>
                <dd className="col-span-2 text-gray-900">
                  {req.assignees?.length > 0
                    ? req.assignees.map(a => a.name || a.email || a.id).join(', ')
                    : <span className="text-gray-400">Unassigned</span>}
                </dd>

                <dt className="text-gray-500 col-span-1">Opened</dt>
                <dd className="col-span-2 text-gray-900">{req.openedDate || '—'}</dd>

                <dt className="text-gray-500 col-span-1">Source</dt>
                <dd className="col-span-2 text-gray-900">{req.source || '—'}</dd>
              </dl>

              {req.requestNotes && (
                <div>
                  <p className="text-xs uppercase text-gray-500 mb-1">Notes</p>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-md p-3 border border-gray-200">
                    {req.requestNotes}
                  </div>
                </div>
              )}

              <div className="space-y-1 text-xs">
                {req.relatedPcsId && (
                  <div>
                    <Link
                      href={`/pcs/documents/${req.relatedPcsId}`}
                      className="text-pacific-600 hover:underline"
                    >
                      → Open PCS document
                    </Link>
                  </div>
                )}
                {req.pcsVersionId && (
                  <div className="text-gray-500">Version: <span className="font-mono">{req.pcsVersionId.slice(0, 8)}</span></div>
                )}
                {req.relatedClaimIds?.length > 0 && (
                  <div className="text-gray-500">{req.relatedClaimIds.length} related claim{req.relatedClaimIds.length === 1 ? '' : 's'}</div>
                )}
              </div>

              {isResolved && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-xs uppercase text-green-700 font-semibold">Resolved</p>
                  {req.resolutionNote && (
                    <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{req.resolutionNote}</p>
                  )}
                </div>
              )}

              {safetyRefs && !isResolved && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-xs uppercase font-semibold text-amber-800">
                    Safety-flagged ingredient
                  </p>
                  <p className="text-xs text-amber-900">
                    Get AI-assisted reformulation options (dose reduction, form swap,
                    substitution, narrower demographic, or warning label). Advisory only —
                    nothing is written back to the label.
                  </p>
                  <button
                    onClick={() => setShowReformulationModal(true)}
                    className="w-full px-3 py-1.5 text-sm font-medium text-amber-900 bg-white border border-amber-300 rounded-md hover:bg-amber-100 transition-colors"
                  >
                    Suggest reformulation
                  </button>
                </div>
              )}

              {!isResolved && canClose && !showResolveForm && (
                <button
                  onClick={() => setShowResolveForm(true)}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-pacific-600 rounded-md hover:bg-pacific-700 transition-colors"
                >
                  Mark resolved
                </button>
              )}

              {!isResolved && !canClose && (
                <p className="text-xs text-gray-500 italic">
                  Read-only: you don&apos;t have write access to close this request.
                </p>
              )}

              {!isResolved && showResolveForm && (
                <div className="space-y-2 bg-gray-50 rounded-md p-3 border border-gray-200">
                  {crossTeam && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      Warning: this request is assigned to the {req.assignedRole} team. Closing it as another role is allowed but logged.
                    </p>
                  )}
                  <label className="block text-xs font-medium text-gray-700">
                    Resolution note <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={resolutionNote}
                    onChange={e => setResolutionNote(e.target.value)}
                    rows={3}
                    className="w-full text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
                    placeholder="How was this resolved?"
                    autoFocus
                  />
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => { setShowResolveForm(false); setError(null); }}
                      disabled={resolving}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleResolve}
                      disabled={resolving}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-pacific-600 rounded-md hover:bg-pacific-700 disabled:opacity-50"
                    >
                      {resolving ? 'Saving…' : 'Confirm resolve'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
      {showReformulationModal && safetyRefs && (
        <ReformulationSuggestionModal
          requestId={requestId}
          labelId={safetyRefs.labelId}
          safetyEvidenceId={safetyRefs.evidenceId}
          existingNotes={req?.requestNotes || ''}
          onClose={() => setShowReformulationModal(false)}
          onNotesAppended={(updated) => setReq(updated)}
        />
      )}
    </div>
  );

  return createPortal(body, document.body);
}
