'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { EVIDENCE_ROLES } from '@/lib/pcs-config';

export default function EditPacketModal({ packet, onClose, onUpdated }) {
  const toast = useToast();
  const [evidenceRole, setEvidenceRole] = useState(packet.evidenceRole || '');
  const [meetsSqrThreshold, setMeetsSqrThreshold] = useState(packet.meetsSqrThreshold || false);
  const [relevanceNote, setRelevanceNote] = useState(packet.relevanceNote || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/pcs/evidence-packets/${packet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidenceRole: evidenceRole || null,
          meetsSqrThreshold,
          relevanceNote,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update');
      }
      toast.success('Evidence packet updated');
      onUpdated?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <>
      <button
        onClick={onClose}
        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
      >
        Cancel
      </button>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-1.5 text-sm bg-pacific-600 text-white rounded-lg hover:bg-pacific-700 disabled:opacity-50 transition"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </>
  );

  return (
    <Modal title="Edit Evidence Packet" onClose={onClose} size="md" footer={footer}>
      <div className="space-y-4">
        {/* Packet name (read-only context) */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm font-medium text-gray-900">{packet.name}</p>
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
    </Modal>
  );
}
