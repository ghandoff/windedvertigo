'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  RUBRIC_VERSIONS, DEFAULT_RUBRIC_VERSION,
  getRubricByVersion, getQualityTier,
} from '@/lib/rubric';

const ScorePageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // The intake ID is the reviewer's OWN intake entry
  const intakeId = searchParams.get('intake');
  // Legacy support: also check for ?study= param
  const studyId = searchParams.get('study');
  const targetId = intakeId || studyId;

  // Rubric version — default to V2, can be overridden via ?version= param
  const versionParam = searchParams.get('version');
  const [rubricVersion, setRubricVersion] = useState(
    RUBRIC_VERSIONS.includes(versionParam) ? versionParam : DEFAULT_RUBRIC_VERSION
  );
  const activeRubric = getRubricByVersion(rubricVersion);

  const [intakeData, setIntakeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Scoring state
  const [scores, setScores] = useState({
    q1: null, q2: null, q3: null, q4: null, q5: null, q6: null,
    q7: null, q8: null, q9: null, q10: null, q11: null,
  });

  // Reset scores when rubric version changes
  const handleVersionChange = (newVersion) => {
    setRubricVersion(newVersion);
    setScores({
      q1: null, q2: null, q3: null, q4: null, q5: null, q6: null,
      q7: null, q8: null, q9: null, q10: null, q11: null,
    });
  };

  // Fetch the reviewer's own intake data
  useEffect(() => {
    if (!targetId) {
      setLoading(false);
      return;
    }

    const fetchIntake = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/studies/${targetId}`);
        if (!res.ok) throw new Error('Failed to load your intake data');
        const data = await res.json();
        setIntakeData(data.study);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchIntake();
  }, [targetId]);

  const calculateTotalScore = () => {
    let total = 0;
    Object.entries(scores).forEach(([key, value]) => {
      if (value !== null) {
        const questionIndex = parseInt(key.replace('q', '')) - 1;
        const question = activeRubric[questionIndex];
        if (question) {
          const selectedOption = question.options.find((opt) => opt.notionValue === value);
          if (selectedOption) total += selectedOption.score;
        }
      }
    });
    return total;
  };

  const allQuestionsAnswered = Object.values(scores).every((s) => s !== null);
  const totalScore = calculateTotalScore();
  const qualityTier = allQuestionsAnswered ? getQualityTier(totalScore) : null;

  const handleScoreSelect = (questionKey, notionValue) => {
    setScores((prev) => ({ ...prev, [questionKey]: notionValue }));
  };

  const handleSubmit = async () => {
    if (!allQuestionsAnswered || !targetId) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyId: targetId,
          ...scores,
          totalScore,
          qualityTier: qualityTier?.label || '',
          rubricVersion,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to submit scores');
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Pre-defined Tailwind class maps — JIT won't generate dynamic classes like `border-${color}-500`
  const TIER_CLASSES = {
    High: {
      selected: 'border-green-500 bg-green-50 ring-1 ring-green-500',
      unselected: 'border-green-200 hover:border-green-400 hover:bg-green-50',
      radioSelected: 'border-green-500',
      radioUnselected: 'border-green-300',
      dot: 'bg-green-500',
    },
    Moderate: {
      selected: 'border-yellow-500 bg-yellow-50 ring-1 ring-yellow-500',
      unselected: 'border-yellow-200 hover:border-yellow-400 hover:bg-yellow-50',
      radioSelected: 'border-yellow-500',
      radioUnselected: 'border-yellow-300',
      dot: 'bg-yellow-500',
    },
    Low: {
      selected: 'border-red-500 bg-red-50 ring-1 ring-red-500',
      unselected: 'border-red-200 hover:border-red-400 hover:bg-red-50',
      radioSelected: 'border-red-500',
      radioUnselected: 'border-red-300',
      dot: 'bg-red-500',
    },
  };
  const DEFAULT_TIER_CLASSES = {
    selected: 'border-gray-500 bg-gray-50 ring-1 ring-gray-500',
    unselected: 'border-gray-200 hover:border-gray-400 hover:bg-gray-50',
    radioSelected: 'border-gray-500',
    radioUnselected: 'border-gray-300',
    dot: 'bg-gray-500',
  };

  const OptionCard = ({ option, selected, onSelect, questionKey }) => {
    const tc = TIER_CLASSES[option.tier] || DEFAULT_TIER_CLASSES;
    return (
      <button
        type="button"
        onClick={() => onSelect(questionKey, option.notionValue)}
        className={`w-full p-4 rounded border-2 transition-all text-left ${
          selected ? tc.selected : tc.unselected
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 flex-shrink-0">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selected ? tc.radioSelected : tc.radioUnselected
              }`}
            >
              {selected && <div className={`w-2.5 h-2.5 rounded-full ${tc.dot}`} />}
            </div>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">
              {option.score} — {option.label}
            </p>
            <ul className="mt-2 space-y-1">
              {option.criteria.map((criterion, idx) => (
                <li key={idx} className="text-xs text-gray-700 flex gap-2">
                  <span className="text-gray-400">&bull;</span>
                  <span>{criterion}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </button>
    );
  };

  // Data display helper for the left panel
  const DataField = ({ label, value }) => {
    if (!value) return null;
    return (
      <div>
        <p className="form-label">{label}</p>
        <p className="text-sm text-gray-800">{value}</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-pacific"></div>
            <p className="mt-4 text-gray-600">Loading your intake data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!targetId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Intake Data Selected</h2>
          <p className="text-gray-600 mb-6">
            Please start from the Dashboard, select an article, complete the intake form, and you will be automatically directed here to score.
          </p>
          <a href="/dashboard" className="btn-primary">Go to Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header with Version Toggle */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-pacific">Scoring Rubric</h1>
            <p className="text-gray-600 text-sm mt-1">
              Part 2: Score the study using the rubric. Your intake data is shown on the left for reference.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user?.isAdmin ? (
              <>
                <span className="text-xs font-medium text-gray-500 uppercase">Rubric Version:</span>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  {RUBRIC_VERSIONS.map((v) => (
                    <button
                      key={v}
                      onClick={() => handleVersionChange(v)}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        rubricVersion === v
                          ? 'bg-pacific text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                {rubricVersion === 'V2' && (
                  <span className="text-xs text-pacific-600 bg-pacific-50 px-2 py-0.5 rounded-full font-medium">
                    Current
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                Rubric V2
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>
        )}

        {intakeData && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
            {/* Left Panel: YOUR Intake Data */}
            <div className="lg:col-span-2">
              <div className="sticky top-20 max-h-[calc(100vh-8rem)] overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-sm">
                {/* Panel Header */}
                <div className="p-4 bg-pacific-50 border-b border-pacific-100 rounded-t-xl">
                  <p className="text-xs font-semibold text-pacific-600 uppercase tracking-wide">Your Intake Data</p>
                  <p className="text-sm text-gray-700 mt-1 line-clamp-2">{intakeData.citation}</p>
                </div>

                <div className="p-5 space-y-5">
                  {/* Identification */}
                  <div className="space-y-3">
                    <DataField label="Citation" value={intakeData.citation} />
                    <DataField label="DOI" value={intakeData.doi} />
                    <DataField label="Year" value={intakeData.year} />
                    <DataField label="Journal" value={intakeData.journal} />
                  </div>

                  {/* Design Section */}
                  {(intakeData.purposeOfResearch || intakeData.studyDesign || intakeData.blinding) && (
                    <div className="border-t pt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Research Design</p>
                      <div className="space-y-3">
                        <DataField label="Purpose" value={intakeData.purposeOfResearch} />
                        <DataField label="Design" value={intakeData.studyDesign} />
                        <DataField label="Blinding" value={intakeData.blinding} />
                        <DataField label="Funding" value={intakeData.fundingSources} />
                      </div>
                    </div>
                  )}

                  {/* Participants */}
                  {(intakeData.initialN || intakeData.finalN || intakeData.ages) && (
                    <div className="border-t pt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Participants</p>
                      <div className="space-y-3">
                        <DataField label="Initial N" value={intakeData.initialN} />
                        <DataField label="Final N" value={intakeData.finalN} />
                        <DataField label="Ages" value={intakeData.ages} />
                        <DataField label="Female Participants" value={intakeData.femaleParticipants} />
                        <DataField label="Male Participants" value={intakeData.maleParticipants} />
                        <DataField label="Recruitment" value={intakeData.recruitment} />
                        <DataField label="Inclusion Criteria" value={intakeData.inclusionCriteria} />
                        <DataField label="Exclusion Criteria" value={intakeData.exclusionCriteria} />
                        <DataField label="A Priori Power" value={intakeData.aPrioriPower} />
                      </div>
                    </div>
                  )}

                  {/* Variables */}
                  {(intakeData.independentVariables || intakeData.dependentVariables) && (
                    <div className="border-t pt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Variables & Measures</p>
                      <div className="space-y-3">
                        <DataField label="Independent Variables" value={intakeData.independentVariables} />
                        <DataField label="Dependent Variables" value={intakeData.dependentVariables} />
                        <DataField label="Control Variables" value={intakeData.controlVariables} />
                        <DataField label="Timing of Measures" value={intakeData.timingOfMeasures} />
                      </div>
                    </div>
                  )}

                  {/* Results */}
                  {(intakeData.keyResults || intakeData.statisticalMethods) && (
                    <div className="border-t pt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Results</p>
                      <div className="space-y-3">
                        <DataField label="Key Results" value={intakeData.keyResults} />
                        <DataField label="Other Results" value={intakeData.otherResults} />
                        <DataField label="Statistical Methods" value={intakeData.statisticalMethods} />
                        <DataField label="Missing Data Handling" value={intakeData.missingDataHandling} />
                      </div>
                    </div>
                  )}

                  {/* Appraisal */}
                  {(intakeData.strengths || intakeData.limitations || intakeData.potentialBiases) && (
                    <div className="border-t pt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Appraisal</p>
                      <div className="space-y-3">
                        <DataField label="Authors' Conclusion" value={intakeData.authorsConclusion} />
                        <DataField label="Strengths" value={intakeData.strengths} />
                        <DataField label="Limitations" value={intakeData.limitations} />
                        <DataField label="Potential Biases" value={intakeData.potentialBiases} />
                        <DataField label="Location" value={
                          [intakeData.locationCity, intakeData.locationCountry].filter(Boolean).join(', ')
                        } />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel: Scoring Rubric */}
            <div className="lg:col-span-3">
              <div className="space-y-6">
                {activeRubric.map((question, idx) => {
                  const questionKey = `q${idx + 1}`;
                  const selectedScore = scores[questionKey];

                  return (
                    <div key={questionKey} className="card p-6">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Q{idx + 1} — {question.label}
                        </h3>
                        {question.tierLabel && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            question.tier === 5 ? 'bg-green-100 text-green-700' :
                            question.tier === 4 ? 'bg-blue-100 text-blue-700' :
                            question.tier === 3 ? 'bg-orange-100 text-orange-700' :
                            question.tier === 2 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {question.tierLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-4">{question.description}</p>
                      <div className="space-y-3">
                        {question.options.map((option, optIdx) => (
                          <OptionCard
                            key={optIdx}
                            option={option}
                            selected={selectedScore === option.notionValue}
                            onSelect={handleScoreSelect}
                            questionKey={questionKey}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Sticky Footer */}
        {intakeData && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
            <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm text-gray-600">Total Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {totalScore} <span className="text-sm text-gray-600">/ 22</span>
                  </p>
                </div>
                {allQuestionsAnswered && qualityTier && (
                  <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    qualityTier.label === 'High' ? 'bg-green-100 text-green-700' :
                    qualityTier.label === 'Moderate' ? 'bg-yellow-100 text-yellow-700' :
                    qualityTier.label === 'Low' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {qualityTier.label} Quality
                  </div>
                )}
                <span className="text-xs text-gray-400 font-mono">{rubricVersion}</span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!allQuestionsAnswered || submitting}
                className={`btn-primary ${!allQuestionsAnswered ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {submitting ? 'Submitting...' : 'Submit Scores'}
              </button>
            </div>
          </div>
        )}

        {/* Bottom padding for sticky scoring footer */}
        {intakeData && <div className="h-24" />}
      </div>
      <Footer />
    </div>
  );
};

export default function ScorePage() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
          <ScorePageContent />
        </Suspense>
      </ProtectedRoute>
    </AuthProvider>
  );
}
