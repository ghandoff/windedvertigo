'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AdminRoute from '@/components/AdminRoute';
import { AuthProvider } from '@/lib/useAuth';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';

function ReviewerManagementContent() {
  const [reviewers, setReviewers] = useState([]);
  const [filteredReviewers, setFilteredReviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    affiliation: '',
  });
  const [inviteUrl, setInviteUrl] = useState('');
  const [updatingReviewerId, setUpdatingReviewerId] = useState(null);
  const toast = useToast();

  // Fetch reviewers on mount
  useEffect(() => {
    fetchReviewers();
  }, []);

  // Filter reviewers based on search term
  useEffect(() => {
    const filtered = reviewers.filter(reviewer => {
      const searchLower = searchTerm.toLowerCase();
      return (
        reviewer.firstName.toLowerCase().includes(searchLower) ||
        reviewer.lastName.toLowerCase().includes(searchLower) ||
        reviewer.alias.toLowerCase().includes(searchLower) ||
        reviewer.email.toLowerCase().includes(searchLower)
      );
    });
    setFilteredReviewers(filtered);
  }, [searchTerm, reviewers]);

  const fetchReviewers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/reviewers');
      if (!res.ok) throw new Error('Failed to fetch reviewers');
      const data = await res.json();
      setReviewers(data.reviewers || []);
    } catch (error) {
      console.error('Error fetching reviewers:', error);
      toast.error('Failed to load reviewers');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSubmit = (e) => {
    e.preventDefault();
    const { firstName, lastName, email, affiliation } = inviteForm;

    if (!firstName || !lastName || !email) {
      toast.error('Please fill in all required fields');
      return;
    }

    const url = `/register?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&email=${encodeURIComponent(email)}&affiliation=${encodeURIComponent(affiliation)}`;
    setInviteUrl(url);
  };

  const copyInviteUrl = () => {
    const fullUrl = `${window.location.origin}${inviteUrl}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success('Invite link copied to clipboard');
  };

  const handleStatusChange = async (reviewerId, newStatus) => {
    try {
      setUpdatingReviewerId(reviewerId);
      const res = await fetch(`/api/admin/reviewers/${reviewerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');
      toast.success('Status updated successfully');
      fetchReviewers();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdatingReviewerId(null);
    }
  };

  const handleAdminToggle = async (reviewerId, currentIsAdmin) => {
    try {
      setUpdatingReviewerId(reviewerId);
      const res = await fetch(`/api/admin/reviewers/${reviewerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !currentIsAdmin }),
      });

      if (!res.ok) throw new Error('Failed to update admin status');
      toast.success(`Admin access ${!currentIsAdmin ? 'granted' : 'revoked'}`);
      fetchReviewers();
    } catch (error) {
      console.error('Error updating admin status:', error);
      toast.error('Failed to update admin status');
    } finally {
      setUpdatingReviewerId(null);
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'Active':
        return 'badge-green';
      case 'Inactive':
        return 'badge-gray';
      case 'Pending':
        return 'badge-yellow';
      default:
        return 'badge-blue';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-pacific">Manage Reviewers</h1>
            <p className="text-gray-600 mt-2">View, search, and manage reviewer accounts</p>
          </div>
          <button
            onClick={() => {
              setInviteForm({ firstName: '', lastName: '', email: '', affiliation: '' });
              setInviteUrl('');
              setShowInviteModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Invite Reviewer
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <svg
              className="absolute left-3 top-3 w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, alias, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
        </div>

        {/* Reviewers Table */}
        <div className="card bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="px-6 py-8 flex justify-center">
              <div className="w-6 h-6 border-3 border-pacific-200 border-t-pacific rounded-full animate-spin" />
            </div>
          ) : filteredReviewers.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <p>{searchTerm ? 'No reviewers match your search' : 'No reviewers found'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Alias</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Affiliation</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Admin</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Reviews</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Last Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredReviewers.map((reviewer) => (
                    <tr key={reviewer.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {reviewer.firstName} {reviewer.lastName}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-700">{reviewer.alias}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{reviewer.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{reviewer.affiliation || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="relative inline-block group">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(reviewer.status)}`}>
                            {reviewer.status}
                          </span>
                          <div className="absolute left-0 top-full hidden group-hover:flex flex-col bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1">
                            {['Active', 'Inactive', 'Pending'].map(status => (
                              <button
                                key={status}
                                onClick={() => handleStatusChange(reviewer.id, status)}
                                disabled={updatingReviewerId === reviewer.id}
                                className="px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 whitespace-nowrap first:rounded-t-md last:rounded-b-md disabled:opacity-50"
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleAdminToggle(reviewer.id, reviewer.isAdmin)}
                          disabled={updatingReviewerId === reviewer.id}
                          className={`inline-block w-5 h-5 rounded border-2 transition ${
                            reviewer.isAdmin
                              ? 'bg-pacific border-pacific'
                              : 'border-gray-300 hover:border-pacific'
                          } disabled:opacity-50`}
                        >
                          {reviewer.isAdmin && (
                            <svg className="w-full h-full text-white" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 11-1.06-1.06l7.25-7.25a.75.75 0 011.06 0z" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        {reviewer.reviewCount}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">
                        {reviewer.lastReviewDate
                          ? new Date(reviewer.lastReviewDate).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Invite Modal */}
      {showInviteModal && (
        <Modal
          title="Invite Reviewer"
          onClose={() => setShowInviteModal(false)}
          size="md"
          footer={
            <>
              <button
                onClick={() => setShowInviteModal(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              {inviteUrl ? (
                <button
                  onClick={copyInviteUrl}
                  className="btn-primary"
                >
                  Copy Link
                </button>
              ) : (
                <button
                  onClick={handleInviteSubmit}
                  className="btn-primary"
                >
                  Generate Invite
                </button>
              )}
            </>
          }
        >
          {!inviteUrl ? (
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="form-label">First Name *</label>
                <input
                  type="text"
                  value={inviteForm.firstName}
                  onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>

              <div>
                <label className="form-label">Last Name *</label>
                <input
                  type="text"
                  value={inviteForm.lastName}
                  onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>

              <div>
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>

              <div>
                <label className="form-label">Affiliation</label>
                <input
                  type="text"
                  value={inviteForm.affiliation}
                  onChange={(e) => setInviteForm({ ...inviteForm, affiliation: e.target.value })}
                  className="input-field w-full"
                  placeholder="Optional"
                />
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Share this link with the reviewer to invite them:
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <code className="text-xs break-all text-gray-700">
                  {`${window.location.origin}${inviteUrl}`}
                </code>
              </div>
              <button
                onClick={() => setInviteUrl('')}
                className="btn-ghost w-full text-center"
              >
                Create Another Invite
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

export default function ReviewerManagementPage() {
  return (
    <AuthProvider>
      <AdminRoute>
        <ReviewerManagementContent />
      </AdminRoute>
    </AuthProvider>
  );
}
