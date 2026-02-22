'use client';

import { AuthProvider, useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useState, useEffect } from 'react';

function NetworkContent() {
  const { user } = useAuth();
  const [reviewers, setReviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');

  useEffect(() => {
    if (user) fetchNetwork();
  }, [user]);

  const fetchNetwork = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/network');
      if (!res.ok) throw new Error('Failed to load network');
      const data = await res.json();
      setReviewers(data.reviewers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Gather all unique disciplines for filter
  const allDisciplines = [...new Set(reviewers.map(r => r.discipline).filter(Boolean))].sort();

  // Filter reviewers
  const filtered = reviewers.filter(r => {
    const matchSearch = !search ||
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      r.alias?.toLowerCase().includes(search.toLowerCase()) ||
      r.affiliation?.toLowerCase().includes(search.toLowerCase()) ||
      r.domainExpertise?.some(d => d.toLowerCase().includes(search.toLowerCase()));
    const matchDiscipline = !filterDiscipline || r.discipline === filterDiscipline;
    return matchSearch && matchDiscipline;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-pacific" />
            <p className="mt-4 text-gray-600">Loading expert network...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-pacific">Expert Network</h1>
          <p className="text-gray-600 mt-2">
            Connect with fellow reviewers across disciplines and institutions.
            {reviewers.length > 0 && ` ${reviewers.length} experts in the network.`}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, alias, institution, or expertise..."
              className="input-field pl-10"
            />
          </div>
          {allDisciplines.length > 0 && (
            <select
              value={filterDiscipline}
              onChange={(e) => setFilterDiscipline(e.target.value)}
              className="select-field w-auto min-w-[200px]"
            >
              <option value="">All Disciplines</option>
              {allDisciplines.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
        </div>

        {/* Results Count */}
        <p className="text-sm text-gray-500 mb-4">
          Showing {filtered.length} of {reviewers.length} expert{reviewers.length !== 1 ? 's' : ''}
        </p>

        {/* Reviewer Grid */}
        {filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="text-lg font-bold text-gray-700 mb-2">No experts found</h3>
            <p className="text-sm text-gray-500">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((reviewer) => {
              const initials = (reviewer.firstName?.[0] || '') + (reviewer.lastName?.[0] || '');
              const isCurrentUser = reviewer.alias === user?.alias;

              return (
                <div
                  key={reviewer.id}
                  className={`card p-6 hover:shadow-md transition ${isCurrentUser ? 'ring-2 ring-pacific ring-opacity-30' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="shrink-0">
                      {reviewer.profileImageUrl ? (
                        <img
                          src={reviewer.profileImageUrl}
                          alt={`${reviewer.firstName} ${reviewer.lastName}`}
                          className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                      ) : null}
                      <div
                        className={`w-12 h-12 rounded-full bg-pacific text-white flex items-center justify-center text-sm font-bold uppercase ${reviewer.profileImageUrl ? 'hidden' : ''}`}
                      >
                        {initials || '?'}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900 truncate">
                          {reviewer.firstName} {reviewer.lastName}
                        </h3>
                        {isCurrentUser && (
                          <span className="text-xs bg-pacific text-white px-1.5 py-0.5 rounded font-medium shrink-0">You</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">@{reviewer.alias}</p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-4 space-y-2 text-sm">
                    {reviewer.affiliation && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="truncate">{reviewer.affiliation}</span>
                      </div>
                    )}
                    {reviewer.discipline && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span className="truncate">{reviewer.discipline}</span>
                      </div>
                    )}
                  </div>

                  {/* Domain Tags */}
                  {reviewer.domainExpertise?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {reviewer.domainExpertise.slice(0, 3).map((domain) => (
                        <span key={domain} className="px-2 py-0.5 bg-pacific-50 text-pacific rounded-full text-xs">
                          {domain}
                        </span>
                      ))}
                      {reviewer.domainExpertise.length > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
                          +{reviewer.domainExpertise.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer Stats */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>{reviewer.reviewCount} review{reviewer.reviewCount !== 1 ? 's' : ''}</span>
                    {reviewer.yearsExperience && (
                      <span>{reviewer.yearsExperience} yrs experience</span>
                    )}
                    {reviewer.memberSince && (
                      <span>Joined {new Date(reviewer.memberSince).getFullYear()}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function NetworkPage() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <NetworkContent />
      </ProtectedRoute>
    </AuthProvider>
  );
}
