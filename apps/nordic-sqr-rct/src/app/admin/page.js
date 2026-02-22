'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminRoute from '@/components/AdminRoute';
import { AuthProvider } from '@/lib/useAuth';

function AdminDashboardContent() {
  const [stats, setStats] = useState({
    totalReviewers: 0,
    totalReviews: 0,
    totalStudies: 0,
    avgScore: 0,
  });
  const [recentScores, setRecentScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reviewersRes, analyticsRes] = await Promise.all([
          fetch('/api/admin/reviewers'),
          fetch('/api/analytics'),
        ]);

        if (reviewersRes.ok) {
          const reviewersData = await reviewersRes.json();
          const reviewers = reviewersData.reviewers || [];

          const totalReviews = reviewers.reduce((sum, r) => sum + (r.reviewCount || 0), 0);
          const avgScores = reviewers
            .filter(r => r.avgScore !== null)
            .map(r => r.avgScore);
          const avgScore =
            avgScores.length > 0
              ? (avgScores.reduce((a, b) => a + b, 0) / avgScores.length).toFixed(2)
              : 0;

          setStats(prev => ({
            ...prev,
            totalReviewers: reviewers.length,
            totalReviews,
            avgScore: parseFloat(avgScore),
          }));

          // Extract recent reviews from reviewers data
          const allScores = [];
          reviewers.forEach(reviewer => {
            if (reviewer.reviewCount > 0) {
              allScores.push({
                reviewerAlias: reviewer.alias,
                reviewCount: reviewer.reviewCount,
                lastReviewDate: reviewer.lastReviewDate,
              });
            }
          });
          // Sort by most recent and take top 10
          const sorted = allScores
            .filter(s => s.lastReviewDate)
            .sort((a, b) => new Date(b.lastReviewDate) - new Date(a.lastReviewDate))
            .slice(0, 10);
          setRecentScores(sorted);
        }

        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json();
          setStats(prev => ({
            ...prev,
            totalStudies: analyticsData.totalStudies || 0,
          }));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-pacific">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage reviewers, view analytics, and monitor platform activity</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-2">Total Reviewers</div>
            <div className="text-4xl font-bold text-gray-900">{stats.totalReviewers}</div>
          </div>

          <div className="card bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-2">Total Reviews</div>
            <div className="text-4xl font-bold text-gray-900">{stats.totalReviews}</div>
          </div>

          <div className="card bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-2">Total Studies</div>
            <div className="text-4xl font-bold text-gray-900">{stats.totalStudies}</div>
          </div>

          <div className="card bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-2">Average Score</div>
            <div className="text-4xl font-bold text-gray-900">{stats.avgScore.toFixed(1)}</div>
            <p className="text-xs text-gray-500 mt-1">out of 5</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link
            href="/admin/reviewers"
            className="btn-primary flex items-center justify-center gap-2 py-3 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 12H9m6 0h.01M9 12h.01M7.07 12a7 7 0 1014 0M12 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Manage Reviewers
          </Link>

          <Link
            href="/analytics"
            className="btn-secondary flex items-center justify-center gap-2 py-3 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Analytics
          </Link>

          <a
            href="/api/export/csv"
            download
            className="btn-ghost flex items-center justify-center gap-2 py-3 rounded-lg border border-gray-300"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </a>

          <a
            href="/api/export/pdf"
            download
            className="btn-ghost flex items-center justify-center gap-2 py-3 rounded-lg border border-gray-300"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
          </a>
        </div>

        {/* Recent Activity */}
        <div className="card bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-pacific">Recent Activity</h2>
          </div>

          {loading ? (
            <div className="px-6 py-8 flex justify-center">
              <div className="w-6 h-6 border-3 border-pacific-200 border-t-pacific rounded-full animate-spin" />
            </div>
          ) : recentScores.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <p>No recent reviews</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentScores.map((score, idx) => (
                <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{score.reviewerAlias}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(score.lastReviewDate).toLocaleDateString()} at{' '}
                      {new Date(score.lastReviewDate).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{score.reviewCount} review{score.reviewCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthProvider>
      <AdminRoute>
        <AdminDashboardContent />
      </AdminRoute>
    </AuthProvider>
  );
}
