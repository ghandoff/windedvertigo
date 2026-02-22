'use client';

import { AuthProvider, useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Footer from '@/components/Footer';

function ReviewsContent() {
  const { user } = useAuth();
  const [scores, setScores] = useState([]);
  const [studyDetails, setStudyDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterTier, setFilterTier] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const scoresRes = await fetch(`/api/scores?reviewer=${user?.alias}`);
      if (!scoresRes.ok) throw new Error('Failed to fetch scores');

      const scoresData = await scoresRes.json();
      const scoresArray = scoresData.scores || [];
      setScores(scoresArray);

      const uniqueStudyIds = [...new Set(scoresArray.flatMap(s => s.studyRelation || []))];
      const studyDetailsMap = {};

      await Promise.all(
        uniqueStudyIds.map(async (studyId) => {
          try {
            const studyRes = await fetch(`/api/studies/${studyId}`);
            if (studyRes.ok) {
              const studyData = await studyRes.json();
              studyDetailsMap[studyId] = studyData.study;
            }
          } catch (err) {
            console.error(`Failed to fetch study ${studyId}:`, err);
          }
        })
      );

      setStudyDetails(studyDetailsMap);
    } catch (err) {
      setError(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalScore = (score) => {
    let total = 0;
    for (let i = 1; i <= 11; i++) {
      total += score[`q${i}`] || 0;
    }
    return total;
  };

  const getQualityTier = (totalScore) => {
    if (totalScore >= 17) return { label: 'High', badge: 'badge-green', value: 'high' };
    if (totalScore >= 11) return { label: 'Moderate', badge: 'badge-yellow', value: 'moderate' };
    return { label: 'Low', badge: 'badge-red', value: 'low' };
  };

  const enrichedScores = scores.map((score) => {
    const totalScore = calculateTotalScore(score);
    const tier = getQualityTier(totalScore);
    const studyId = score.studyRelation?.[0];
    const study = studyDetails[studyId] || {};

    return {
      ...score,
      totalScore,
      tier,
      study,
      citation: study.citation || 'Unknown Citation',
      date: new Date(score.timestamp || score.createdTime),
    };
  });

  let filtered = enrichedScores;

  if (filterTier !== 'all') {
    filtered = filtered.filter(s => s.tier.value === filterTier);
  }

  if (searchText.trim()) {
    const query = searchText.toLowerCase();
    filtered = filtered.filter(s =>
      s.citation.toLowerCase().includes(query) ||
      s.study.journal?.toLowerCase().includes(query) ||
      s.study.doi?.toLowerCase().includes(query)
    );
  }

  if (sortBy === 'date') {
    filtered.sort((a, b) => b.date - a.date);
  } else if (sortBy === 'score') {
    filtered.sort((a, b) => b.totalScore - a.totalScore);
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (seconds) => {
    if (!seconds) return '—';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes === 0) return `${secs}s`;
    if (secs === 0) return `${minutes}m`;
    return `${minutes}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="skeleton h-8 w-48 rounded mb-8" />
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="flex items-center justify-between gap-4">
                    <div className="skeleton h-4 flex-1 rounded" />
                    <div className="skeleton h-6 w-20 rounded-full" />
                    <div className="skeleton h-4 w-20 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-pacific">My Reviews</h1>
          <p className="text-gray-600 mt-2">
            {filtered.length} review{filtered.length !== 1 ? 's' : ''} completed
          </p>
        </div>

        {scores.length === 0 ? (
          <div className="card p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No reviews yet</h2>
            <p className="text-gray-600 mb-6">Get started by selecting an article to review on your dashboard.</p>
            <Link href="/dashboard" className="btn-primary inline-block">
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <>
            <div className="card p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="search" className="form-label">Search</label>
                  <input
                    id="search"
                    type="text"
                    placeholder="Citation, journal, DOI..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label htmlFor="tier-filter" className="form-label">Quality Tier</label>
                  <select
                    id="tier-filter"
                    value={filterTier}
                    onChange={(e) => setFilterTier(e.target.value)}
                    className="input-field"
                  >
                    <option value="all">All Tiers</option>
                    <option value="high">High Quality</option>
                    <option value="moderate">Moderate Quality</option>
                    <option value="low">Low Quality</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="sort" className="form-label">Sort By</label>
                  <select
                    id="sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="input-field"
                  >
                    <option value="date">Newest First</option>
                    <option value="score">Highest Score</option>
                  </select>
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="card p-12 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">No results found</h2>
                <p className="text-gray-600">Try adjusting your filters or search terms.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((score) => (
                  <Link key={score.id} href={`/reviews/${score.id}`}>
                    <div className="card p-5 hover:shadow-md transition cursor-pointer">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                        <div className="md:col-span-2">
                          <p className="text-sm font-medium text-gray-900 line-clamp-2">
                            {score.citation}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {score.study.year && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {score.study.year}
                              </span>
                            )}
                            {score.study.journal && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {score.study.journal}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:flex-col md:items-end gap-4">
                          <div className="text-right">
                            <p className="text-2xl font-bold text-gray-900">{score.totalScore}</p>
                            <p className="text-xs text-gray-500">/ 22</p>
                          </div>
                          <span className={`${score.tier.badge} text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap`}>
                            {score.tier.label}
                          </span>
                        </div>

                        <div className="flex items-center justify-between md:flex-col md:items-end gap-4">
                          <div className="text-right">
                            <p className="text-sm text-gray-600">{formatDate(score.date)}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatTime(score.timeToComplete)}
                            </p>
                          </div>
                          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <ReviewsContent />
      </ProtectedRoute>
    </AuthProvider>
  );
}
