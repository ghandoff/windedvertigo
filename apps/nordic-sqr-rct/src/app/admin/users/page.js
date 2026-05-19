'use client';

import { useState, useEffect, useRef } from 'react';
import WorkspaceShell from '@/components/WorkspaceShell';
import Footer from '@/components/Footer';
import AdminRoute from '@/components/AdminRoute';
import { AuthProvider } from '@/lib/useAuth';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

const ROLE_COLORS = {
  'super-user': 'bg-red-100 text-red-700',
  'admin':      'bg-orange-100 text-orange-700',
  'researcher': 'bg-blue-100 text-blue-700',
  'ra':         'bg-teal-100 text-teal-700',
  'reviewer':   'bg-gray-100 text-gray-600',
  'sqr-rct':    'bg-gray-100 text-gray-600',
};

const EDITABLE_ROLES = ['reviewer', 'researcher', 'ra', 'admin'];

/**
 * Derive a roles array from the API response.
 * The current API returns `isAdmin` boolean, not `roles[]`.
 * We read `roles` defensively and fall back to the boolean.
 */
function deriveRoles(user) {
  if (Array.isArray(user.roles) && user.roles.length > 0) return user.roles;
  return user.isAdmin ? ['admin'] : ['reviewer'];
}

function isInternal(roles) {
  return roles.some(r => ['researcher', 'ra', 'admin', 'super-user'].includes(r));
}

// ---------------------------------------------------------------------------
// RoleChips — read-only display
// ---------------------------------------------------------------------------

function RoleChips({ roles }) {
  if (!roles || roles.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map(role => (
        <span
          key={role}
          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role] || 'bg-gray-100 text-gray-600'}`}
        >
          {role}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoleEditor — popover with checkboxes, saves on each change
// ---------------------------------------------------------------------------

function RoleEditor({ user, onSaved }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localRoles, setLocalRoles] = useState(deriveRoles(user));
  const popoverRef = useRef(null);
  const toast = useToast();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const toggleRole = async (role) => {
    const next = localRoles.includes(role)
      ? localRoles.filter(r => r !== role)
      : [...localRoles, role];

    setLocalRoles(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/reviewers/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: next }),
      });
      if (!res.ok) throw new Error('Failed to update roles');
      onSaved(user.id, next);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update roles');
      setLocalRoles(localRoles); // revert
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex flex-wrap gap-1 hover:opacity-80 transition focus:outline-none"
        title="Click to edit roles"
      >
        <RoleChips roles={localRoles} />
        {saving && (
          <span className="ml-1 inline-block w-3 h-3 border-2 border-gray-300 border-t-pacific rounded-full animate-spin" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[160px] p-2">
          <p className="text-xs text-gray-500 px-2 pb-1 mb-1 border-b border-gray-100">Edit roles</p>
          {EDITABLE_ROLES.map(role => (
            <label
              key={role}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
            >
              <input
                type="checkbox"
                checked={localRoles.includes(role)}
                onChange={() => toggleRole(role)}
                disabled={saving}
                className="rounded border-gray-300 text-pacific focus:ring-pacific"
              />
              {role}
            </label>
          ))}
          <button
            onClick={() => setOpen(false)}
            className="mt-1 w-full text-xs text-gray-400 hover:text-gray-600 py-1"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusCell — inline editable status badge (hover dropdown)
// ---------------------------------------------------------------------------

function getStatusBadgeColor(status) {
  switch (status) {
    case 'Active':   return 'badge-green';
    case 'Inactive': return 'badge-gray';
    case 'Pending':  return 'badge-yellow';
    default:         return 'badge-blue';
  }
}

function StatusCell({ user, onStatusChange, isUpdating }) {
  return (
    <div className="relative inline-block group">
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(user.status)}`}>
        {user.status}
      </span>
      <div className="absolute left-0 top-full hidden group-hover:flex flex-col bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1">
        {['Active', 'Inactive', 'Pending'].map(status => (
          <button
            key={status}
            onClick={() => onStatusChange(user.id, status)}
            disabled={isUpdating}
            className="px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 whitespace-nowrap first:rounded-t-md last:rounded-b-md disabled:opacity-50"
          >
            {status}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InviteModal
// ---------------------------------------------------------------------------

function InviteModal({ onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    affiliation: '',
    userType: 'external', // 'internal' | 'external'
    role: 'researcher',   // only for internal
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        affiliation: form.affiliation,
        userType: form.userType,
        ...(form.userType === 'internal' ? { role: form.role } : {}),
      };
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send invite');
      }
      toast.success(`Invite sent to ${form.email}`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to send invite');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <Modal
      title="Invite User"
      onClose={onClose}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" disabled={submitting}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="btn-primary flex items-center gap-2"
            disabled={submitting}
          >
            {submitting && (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            Send Invite
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">First Name *</label>
            <input
              type="text"
              value={form.firstName}
              onChange={e => set('firstName', e.target.value)}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="form-label">Last Name *</label>
            <input
              type="text"
              value={form.lastName}
              onChange={e => set('lastName', e.target.value)}
              className="input-field w-full"
              required
            />
          </div>
        </div>

        <div>
          <label className="form-label">Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            className="input-field w-full"
            required
          />
        </div>

        <div>
          <label className="form-label">Affiliation</label>
          <input
            type="text"
            value={form.affiliation}
            onChange={e => set('affiliation', e.target.value)}
            className="input-field w-full"
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="form-label">User Type *</label>
          <div className="flex gap-4 mt-1">
            {[
              { value: 'internal', label: 'Internal staff' },
              { value: 'external', label: 'External reviewer' },
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="userType"
                  value={opt.value}
                  checked={form.userType === opt.value}
                  onChange={() => set('userType', opt.value)}
                  className="text-pacific focus:ring-pacific"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {form.userType === 'internal' && (
          <div>
            <label className="form-label">Role</label>
            <select
              value={form.role}
              onChange={e => set('role', e.target.value)}
              className="input-field w-full"
            >
              <option value="researcher">Researcher</option>
              <option value="ra">Research Assistant (RA)</option>
            </select>
          </div>
        )}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main content
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'all',      label: 'All' },
  { key: 'internal', label: 'Internal' },
  { key: 'external', label: 'External' },
];

function UserDirectoryContent() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const toast = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/reviewers');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      // Attach derived roles to each user
      const enriched = (data.reviewers || []).map(u => ({
        ...u,
        _roles: deriveRoles(u),
      }));
      setUsers(enriched);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      setUpdatingUserId(userId);
      const res = await fetch(`/api/admin/reviewers/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      toast.success('Status updated');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (error) {
      console.error(error);
      toast.error('Failed to update status');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRolesSaved = (userId, newRoles) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, _roles: newRoles } : u));
  };

  // Apply tab filter
  const tabFiltered = users.filter(u => {
    if (activeTab === 'internal') return isInternal(u._roles);
    if (activeTab === 'external') return !isInternal(u._roles);
    return true;
  });

  // Apply search filter
  const filtered = tabFiltered.filter(u => {
    const q = searchTerm.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      (u.alias || '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <WorkspaceShell variant="reviewer" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-pacific">User Directory</h1>
            <p className="text-gray-600 mt-2">Manage user roles, status, and invitations</p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Invite User
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
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
              placeholder="Search by name, alias, or email…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-pacific text-pacific'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {!loading && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-pacific-100 text-pacific-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.key === 'all'
                    ? users.length
                    : tab.key === 'internal'
                    ? users.filter(u => isInternal(u._roles)).length
                    : users.filter(u => !isInternal(u._roles)).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="px-6 py-8 flex justify-center">
              <div className="w-6 h-6 border-3 border-pacific-200 border-t-pacific rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <p>{searchTerm ? 'No users match your search' : 'No users found'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Roles</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Affiliation</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Reviews</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {user.firstName} {user.lastName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-4">
                        <RoleEditor user={user} onSaved={handleRolesSaved} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.affiliation || '—'}</td>
                      <td className="px-6 py-4">
                        <StatusCell
                          user={user}
                          onStatusChange={handleStatusChange}
                          isUpdating={updatingUserId === user.id}
                        />
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        {user.reviewCount ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">
                        {user.onboardingDate
                          ? new Date(user.onboardingDate).toLocaleDateString()
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

      {showInviteModal && (
        <InviteModal onClose={() => setShowInviteModal(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export (wrapped in auth)
// ---------------------------------------------------------------------------

export default function UserDirectoryPage() {
  return (
    <AuthProvider>
      <AdminRoute>
        <UserDirectoryContent />
      </AdminRoute>
    </AuthProvider>
  );
}
