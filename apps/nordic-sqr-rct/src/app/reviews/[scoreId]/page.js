'use client';

import { AuthProvider, useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Footer from '@/components/Footer';
import { getRubricByVersion, DEFAULT_RUBRIC_VERSION } from '@/lib/rubric';
import ScoreComparison from '@/components/ScoreComparison';

function ScoreDetailContent({ scoreId }) {
  const { user } = useAuth();
  const [score, setScore] = useState(null);
  const [study, setStudy] = useState(null);
  const [otherScores, setOtherScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) fetchData();
  }, [user, scoreId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const scoresRes = await fetch(`/api/scores?reviewer=${user?.alias}`);
      if (!scoresRes.ok) throw new Error('Failed to fetch scores');

      const scoresData = await scoresRes.json();
      const scoresArray = scoresData.scores || [];
      const foundScore = scoresArray.find(s => s.id === scoreId);

      if (!foundScore) throw new Error('Score not found');
      setScore(foundScore);

      const studyId = foundScore.studyRelation?.[0];
      if (studyId) {
        const studyRes = await fetch(`/api/studies/${studyId}`);
        if (studyRes.ok) {
          const studyData = await studyRes.json();
          setStudy(studyData.study);
        }

        const allScoresRes = await fetch('/api/scores');
        if (allScoresRes.ok) {
          const allScoresData = await allScoresRes.json();
          const allScoresArray = allScoresData.scores || [];
          const relatedScores = allScoresArray.filter(s =>
            s.studyRelation?.includes(studyId) && s.id !== scoreId && s.raterAlias !== user?.alias
          );
          setOtherScores(relatedScores);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load review details');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalScore = (scoreObj) => {
    let total = 0;
    for (let i = 1; i <= 11; i++) {
      total += scoreObj[`q${i}`] || 0;
    }
    return total;
  };

  const getQualityTier = (totalScore) => {
    if (totalScore >= 17) return { label: 'High Quality', badge: 'badge-green' };
    if (totalScore >= 11) return { label: 'Moderate Quality', badge: 'badge-yellow' };
    return { label: 'Low Quality', badge: 'badge-red' };
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (seconds) => {
    if (!seconds) return '—';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes === 0) return `${secs} seconds`;
    if (secs === 0) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    return `${minutes}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="skeleton h-6 w-32 rounded" />
            <div className="skeleton h-8 w-96 rounded" />
            <div className="skeleton h-40 w-full rounded" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !score) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error || 'Score not found'}</p>
            <Link href="/reviews" className="btn-primary inline-block">
              Back to Reviews
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const totalScore = calculateTotalScore(score);
  const tier = getQualityTier(totalScore);
  const scoreVersion = score.rubricVersion || DEFAULT_RUBRIC_VERSION;
  const rubric = getRubricByVersion(scoreVersion);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <Link href="/reviews" className="inline-flex items-center gap-2 text-pacific-600 hover:text-pacific font-medium text-sm mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Reviews
        </Link>

        <div className="card p-8 mb-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-pacific mb-3">
              {study?.citation || 'Review'}
            </h1>
            <div className="flex flex-wrap gap-3 items-center">
              {study?.doi && (
                <a
                  href={`https://doi.org/${study.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-pacific-600 hover:text-pacific font-medium"
                >
                  DOI: {study.doi}
                </a>
              )}
              {study?.year && (
                <span className="text-sm text-gray-600">Published {study.year}</span>
              )}
              {study?.journal && (
                <span className="text-sm text-gray-600">{study.journal}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Score</p>
              <p className="text-4xl font-bold text-gray-900 mt-2">{totalScore}</p>
              <p className="text-sm text-gray-600 mt-1">out of 22 points</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Quality Tier</p>
              <div className="mt-2 flex items-center gap-3">
                <span className={`${tier.badge} text-sm font-medium px-4 py-2 rounded-full`}>
                  {tier.label}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reviewer</p>
              <p className="text-sm font-medium text-gray-900 mt-2">{score.raterAlias}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reviewed On</p>
              <p className="text-sm text-gray-700 mt-2">
                {formatDate(score.timestamp || score.createdTime)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Time spent: {formatTime(score.timeToComplete)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Rubric: {scoreVersion}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-pacific">Rubric Scores</h2>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {scoreVersion}
            </span>
          </div>

          <div className="space-y-6">
            {rubric.map((question) => {
              const scoreValue = score[question.id];
              const rawValue = score[`${question.id}Raw`];
              const selectedOption = question.options.find(opt => opt.score === scoreValue);

              return (
                <div key={question.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">
                        Question {question.number}
                      </p>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {question.label}
                      </h3>
                    </div>
                    <span className="text-2xl font-bold text-pacific">
                      {scoreValue !== undefined ? scoreValue : '—'}/2
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">
                    {question.description}
                  </p>

                  {selectedOption && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-4">
                      <p className="text-sm font-medium text-blue-900 mb-2">
                        {selectedOption.label}
                      </p>
                      {rawValue && (
                        <p className="text-sm text-blue-800">{rawValue}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {score.notes && (
          <div className="card p-8 mb-8">
            <h2 className="text-xl font-bold text-pacific mb-4">Reviewer Notes</h2>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {score.notes}
            </div>
          </div>
        )}

        {otherScores.length > 0 && (
          <div className="card p-8">
            <h2 className="text-xl font-bold text-pacific mb-6">Other Reviewers' Scores</h2>
            <ScoreComparison scores={[score, ...otherScores]} rubricVersion={scoreVersion} />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function ScoreDetailPage({ params }) {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <ScoreDetailContent scoreId={params.scoreId} />
      </ProtectedRoute>
    </AuthProvider>
  );
}
