'use client';

import { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { EVIDENCE_ROLES } from '@/lib/pcs-config';

export default function LinkEvidenceModal({ claimId, claimText, onClose, onLinked }) {
  const toast = useToast();

  // Step 1: select evidence item, Step 2: set metadata
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState('');
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  // Step 2 fields
  const [evidenceRole, setEvidenceRole] = useState('');
  const [meetsSqrThreshold, setMeetsSqrThreshold] = useState(false);
  const [relevanceNote, setRelevanceNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchEvidence() {
      try {
        const res = await fetch('/api/pcs/evidence');
        if (!res.ok) throw new Error('Failed to load evidence');
        const data = await res.json();
        setEvidenceItems(data);
      } catch (err) {
        toast.error('Failed to load evidence library');
      } finally {
        setLoading(false);
      }
    }
    fetchEvidence();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!query.trim()) return evidenceItems;
    const q = query.toLowerCase();
    return evidenceItems.filter(
      (e) =>
        e.name?.toLowerCase().includes(q) ||
        e.citation?.toLowerCase().includes(q) ||
        e.doi?.toLowerCase().includes(q) ||
        (e.ingredient || []).some((i) => i.toLowerCase().includes(q))
    );
  }, [evidenceItems, query]);

  function handleSelect(item) {
    setSelectedItem(item);
    setMeetsSqrThreshold(item.sqrReviewed && item.sqrScore >= 17);
    setStep(2);
  }

  async function handleSave() {
    if (!selectedItem) return;
    setSaving(true);

    const shortClaim = (claimText || '').slice(0, 40);
    const shortEvidence = (selectedItem.name || '').slice(0, 40);
    const name = `${shortClaim} — ${shortEvidence}`;

    try {
      const res = await fetch('/api/pcs/evidence-packets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          pcsClaimId: claimId,
          evidenceItemId: selectedItem.id,
          evidenceRole: evidenceRole || undefined,
          meetsSqrThreshold,
          relevanceNote: relevanceNote || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to link evidence');
      }
      toast.success('Evidence linked successfully');
      onLinked?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Score badge color
  function sqrBadge(item) {
    if (!item.sqrReviewed) return null;
    const score = item.sqrScore;
    const color = score >= 17 ? 'bg-green-100 text-green-700' : score >= 11 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
    return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${color}`}>SQR {score}/22</span>;
  }

  const step1Footer = (
    <p className="text-xs text-gray-400">
      {filtered.length} evidence item{filtered.length !== 1 ? 's' : ''}
      {query && ` matching "${query}"`}
    </p>
  );

  const step2Footer = (
    <>
      <button
        onClick={() => { setStep(1); setSelectedItem(null); }}
        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
      >
        Back
      </button>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-1.5 text-sm bg-pacific-600 text-white rounded-lg hover:bg-pacific-700 disabled:opacity-50 transition"
      >
        {saving ? 'Linking...' : 'Link Evidence'}
      </button>
    </>
  );

  return (
    <Modal
      title={step === 1 ? 'Select Evidence to Link' : 'Set Evidence Details'}
      onClose={onClose}
      size="lg"
      footer={step === 1 ? step1Footer : step2Footer}
    >
      {step === 1 && (
        <div className="space-y-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, citation, DOI, or ingredient..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-pacific-500 focus:border-pacific-500 outline-none"
            autoFocus
          />

          {loading ? (
            <div className="py-8 text-center text-sm text-gray-400">Loading evidence library...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              {query ? 'No evidence items match your search' : 'No evidence items found'}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto -mx-1 divide-y divide-gray-100">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="w-full text-left px-3 py-2.5 hover:bg-pacific-50 rounded transition group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-pacific-700">
                        {item.name}
                      </p>
                      {item.citation && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{item.citation}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {item.evidenceType && (
                          <span className="text-xs text-gray-400">{item.evidenceType}</span>
                        )}
                        {(item.ingredient || []).map((ing) => (
                          <span key={ing} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {ing}
                          </span>
                        ))}
                        {item.publicationYear && (
                          <span className="text-xs text-gray-400">{item.publicationYear}</span>
                        )}
                      </div>
                    </div>
                    {sqrBadge(item)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && selectedItem && (
        <div className="space-y-4">
          {/* Selected item summary */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-900">{selectedItem.name}</p>
            {selectedItem.citation && (
              <p className="text-xs text-gray-500 mt-0.5">{selectedItem.citation}</p>
            )}
          </div>

          {/* Evidence Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Evidence Role</label>
            <select
              value={evidenceRole}
              onChange={(e) => setEvidenceRole(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-pacific-500 focus:border-pacific-500 outline-none"
            >
              <option value="">Select role...</option>
              {EVIDENCE_ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          {/* SQR Threshold */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={meetsSqrThreshold}
              onChange={(e) => setMeetsSqrThreshold(e.target.checked)}
              className="rounded border-gray-300 text-pacific-600 focus:ring-pacific-500"
            />
            <span className="text-sm text-gray-700">Meets SQR-RCT threshold</span>
          </label>

          {/* Relevance Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Relevance Note</label>
            <textarea
              value={relevanceNote}
              onChange={(e) => setRelevanceNote(e.target.value)}
              placeholder="Why is this evidence relevant to this claim?"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-pacific-500 focus:border-pacific-500 outline-none resize-none"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
