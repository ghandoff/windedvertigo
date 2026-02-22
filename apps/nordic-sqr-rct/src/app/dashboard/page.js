'use client';

import { AuthProvider, useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { DashboardSkeleton } from '@/components/Skeletons';
import Footer from '@/components/Footer';

function DashboardContent() {
  const { user } = useAuth();
  const [myScores, setMyScores] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const [scoresRes, catalogRes] = await Promise.all([
        fetch(`/api/scores?reviewer=${user?.alias}`),
        fetch('/api/studies?catalog=true'),
      ]);

      if (!scoresRes.ok) throw new Error('Failed to fetch scores');
      if (!catalogRes.ok) throw new Error('Failed to fetch articles');

      const scoresData = await scoresRes.json();
      const catalogData = await catalogRes.json();

      setMyScores(scoresData.scores || []);
      setArticles(catalogData.articles || []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
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
    if (totalScore >= 17) return { label: 'High', badge: 'badge-green' };
    if (totalScore >= 11) return { label: 'Moderate', badge: 'badge-yellow' };
    return { label: 'Low', badge: 'badge-red' };
  };

  // Stats
  const reviewsCompleted = myScores.length;
  const articlesNeedingReview = articles.filter(
    (a) => a.needsReview && !a.currentUserReviewed
  ).length;
  const averageScore =
    myScores.length > 0
      ? (
          myScores.reduce((sum, s) => sum + calculateTotalScore(s), 0) /
          myScores.length
        ).toFixed(1)
      : 0;

  const qualityDistribution = myScores.reduce(
    (acc, score) => {
      const tier = getQualityTier(calculateTotalScore(score));
      if (tier.label === 'High') acc.high += 1;
      else if (tier.label === 'Moderate') acc.moderate += 1;
      else acc.low += 1;
      return acc;
    },
    { high: 0, moderate: 0, low: 0 }
  );

  const recentScores = [...myScores]
    .sort((a, b) => new Date(b.timestamp || b.createdTime) - new Date(a.timestamp || a.createdTime))
    .slice(0, 10);

  // Filter articles: only those needing review AND not yet reviewed by current user
  const availableArticles = articles.filter(
    (a) => a.needsReview && !a.currentUserReviewed
  );
  const completedArticles = articles.filter((a) => a.currentUserReviewed);

  const getReviewSlotLabel = (count) => {
    if (count === 0) return { text: 'Needs 1st reviewer', className: 'bg-blue-100 text-blue-800' };
    if (count === 1) return { text: 'Needs 2nd reviewer', className: 'bg-yellow-100 text-yellow-800' };
    if (count === 2) return { text: 'Needs 3rd reviewer', className: 'bg-orange-100 text-orange-800' };
    return { text: 'Fully reviewed', className: 'bg-green-100 text-green-800' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-pacific">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-gray-600 mt-2">
            Reviewer alias: <span className="font-medium">{user?.alias}</span>
          </p>
        </div>

        {/* Quick Actions — functional versions of the landing page value props */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Link
            href="#articles"
            onClick={(e) => { e.preventDefault(); document.getElementById('articles-section')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="card p-5 border-l-4 border-l-pacific-500 hover:shadow-md transition group"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-pacific-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-pacific-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-pacific text-sm">Review Studies</h3>
                <p className="text-xs text-gray-500 mt-0.5">{articlesNeedingReview} article{articlesNeedingReview !== 1 ? 's' : ''} available</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 group-hover:text-pacific ml-auto mt-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>
            </div>
          </Link>
          <Link href="/network" className="card p-5 border-l-4 border-l-gold-500 hover:shadow-md transition group">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-pacific text-sm">Expert Network</h3>
                <p className="text-xs text-gray-500 mt-0.5">Connect with fellow reviewers</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 group-hover:text-pacific ml-auto mt-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>
            </div>
          </Link>
          <Link href="/credibility" className="card p-5 border-l-4 border-l-green-500 hover:shadow-md transition group">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-pacific text-sm">Build Credibility</h3>
                <p className="text-xs text-gray-500 mt-0.5">{reviewsCompleted} review{reviewsCompleted !== 1 ? 's' : ''} completed</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 group-hover:text-pacific ml-auto mt-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>
            </div>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <p className="text-sm text-gray-600 font-medium">Reviews Completed</p>
            <p className="text-4xl font-bold text-pacific mt-2">{reviewsCompleted}</p>
          </div>
          <div className="card p-6">
            <p className="text-sm text-gray-600 font-medium">Articles Available</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">{articlesNeedingReview}</p>
            <p className="text-xs text-gray-500 mt-1">needing your review</p>
          </div>
          <div className="card p-6">
            <p className="text-sm text-gray-600 font-medium">Average Score</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">{averageScore}</p>
            <p className="text-xs text-gray-500 mt-1">out of 22</p>
          </div>
          <div className="card p-6">
            <p className="text-sm text-gray-600 font-medium mb-3">Quality Distribution</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">High:</span>
                <span className="font-medium text-green-700">{qualityDistribution.high}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Moderate:</span>
                <span className="font-medium text-yellow-700">{qualityDistribution.moderate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Low:</span>
                <span className="font-medium text-red-700">{qualityDistribution.low}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* My Recent Reviews */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-pacific">My Recent Reviews</h2>
              {myScores.length > 0 && (
                <Link href="/reviews" className="text-sm text-pacific-600 hover:text-pacific font-medium">
                  View all &rarr;
                </Link>
              )}
            </div>
            {recentScores.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 text-sm">No reviews yet. Select an article to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentScores.map((score) => {
                  const totalScore = calculateTotalScore(score);
                  const tier = getQualityTier(totalScore);
                  const reviewDate = new Date(
                    score.timestamp || score.createdTime
                  ).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div key={score.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm text-gray-700 font-medium line-clamp-2 flex-1">
                          {score.scoreId || 'Review'}
                        </p>
                        <span className={`${tier.badge} text-xs font-medium px-3 py-1 rounded-full ml-2 whitespace-nowrap`}>
                          {tier.label}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-3 text-sm">
                        <span className="font-medium text-gray-900">Score: {totalScore}/22</span>
                        <span className="text-gray-500">{reviewDate}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Articles Needing Review */}
          <div id="articles-section" className="card p-6">
            <h2 className="text-xl font-bold text-pacific mb-2">Articles Needing Review</h2>
            <p className="text-sm text-gray-500 mb-6">
              Select an article to begin your review. Each article needs up to 3 independent human reviewers.
            </p>

            {availableArticles.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 text-sm">
                  {completedArticles.length > 0
                    ? `You've reviewed ${completedArticles.length} article${completedArticles.length !== 1 ? 's' : ''}. No more articles need your review right now.`
                    : 'No articles available for review at this time.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {availableArticles.map((article) => {
                  const slot = getReviewSlotLabel(article.reviewerCount);
                  return (
                    <div key={article.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="text-sm text-gray-900 font-medium line-clamp-2">
                            {article.citation}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {article.year && (
                              <span className="text-xs text-gray-500">{article.year}</span>
                            )}
                            {article.journal && (
                              <span className="text-xs text-gray-500">&middot; {article.journal}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${slot.className}`}>
                          {slot.text}
                        </span>
                        <Link
                          href={`/intake?article=${article.id}`}
                          className="btn-primary text-sm px-4 py-2"
                        >
                          Begin Review
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <DashboardContent />
      </ProtectedRoute>
    </AuthProvider>
  );
}
