'use client';

import { AuthProvider, useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { RUBRIC_QUESTIONS, RUBRIC_VERSIONS } from '@/lib/rubric';

const TABS = [
  { id: 'irr', label: 'IRR Analysis' },
  { id: 'articles', label: 'Article Scores' },
  { id: 'reviewers', label: 'Reviewer Stats' },
  { id: 'distributions', label: 'Quality Distributions' },
  { id: 'ai', label: 'AI Reviewer' },
];

const NORDIC_COLORS = {
  primary: '#266474',
  light: '#4db5c2',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  blue: '#3b82f6',
  gray: '#6b7280',
};

const KAPPA_COLORS = {
  'Almost Perfect': 'bg-green-100 text-green-800',
  'Substantial': 'bg-emerald-100 text-emerald-800',
  'Moderate': 'bg-yellow-100 text-yellow-800',
  'Fair': 'bg-orange-100 text-orange-800',
  'Slight': 'bg-red-100 text-red-800',
  'N/A': 'bg-gray-100 text-gray-700',
};

const CONSENSUS_COLORS = {
  'Consensus': 'badge-green',
  'Moderate Spread': 'badge-yellow',
  'Conflicted': 'badge-red',
  'Single Reviewer': 'badge-blue',
  'Pending': 'badge-gray',
};

// ─── Summary Cards ─────────────────────────────────────────────────
function SummaryCards({ summary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <div className="card p-4 text-center">
        <p className="text-2xl font-bold text-pacific">{summary.totalArticles}</p>
        <p className="text-xs text-gray-500 mt-1">Articles</p>
      </div>
      <div className="card p-4 text-center">
        <p className="text-2xl font-bold text-pacific">{summary.totalScores}</p>
        <p className="text-xs text-gray-500 mt-1">Total Scores</p>
      </div>
      <div className="card p-4 text-center">
        <p className="text-2xl font-bold text-pacific">{summary.totalReviewers}</p>
        <p className="text-xs text-gray-500 mt-1">Active Reviewers</p>
      </div>
      <div className="card p-4 text-center">
        <p className="text-2xl font-bold text-pacific">{summary.articlesWithMultipleReviewers}</p>
        <p className="text-xs text-gray-500 mt-1">Multi-Reviewer</p>
      </div>
      <div className="card p-4 text-center">
        <p className="text-2xl font-bold text-pacific">{summary.overallAgreement}%</p>
        <p className="text-xs text-gray-500 mt-1">Overall Agreement</p>
      </div>
    </div>
  );
}

// ─── Tab: IRR Analysis ─────────────────────────────────────────────
function IRRTab({ irr }) {
  const { cohensKappaPairs, fleissKappas } = irr;

  if (cohensKappaPairs.length === 0 && fleissKappas.eligibleArticleCount === 0) {
    return (
      <EmptyState
        title="Not enough data for IRR analysis"
        message="Inter-rater reliability requires at least 2 reviewers scoring the same article. As more reviews are submitted, IRR statistics will appear here."
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* ICC Card — scale-level agreement (total scores) */}
      {irr.icc && (
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Intraclass Correlation ({irr.icc.model})</h3>
          <div className="flex items-center gap-4 mb-2">
            <span className="text-4xl font-bold text-pacific">{irr.icc.icc}</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${KAPPA_COLORS[irr.icc.interpretation] || KAPPA_COLORS['N/A']}`}>
              {irr.icc.interpretation}
            </span>
            <span className="text-sm text-gray-500">
              {irr.icc.articlesUsed} articles, {irr.icc.ratersPerArticle} raters each
            </span>
          </div>
          <p className="text-xs text-gray-400">Scale-level agreement on total scores. Two-way random, single measures, absolute agreement (Shrout &amp; Fleiss, 1979).</p>
        </div>
      )}

      {/* Overall Fleiss' Kappa — multi-rater item-level agreement */}
      {fleissKappas.overall != null && (
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Multi-Rater Agreement (Fleiss&apos; Kappa)</h3>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-4xl font-bold text-pacific">{fleissKappas.overall}</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${KAPPA_COLORS[fleissKappas.overallInterpretation] || KAPPA_COLORS['N/A']}`}>
              {fleissKappas.overallInterpretation}
            </span>
            <span className="text-sm text-gray-500">
              across {fleissKappas.eligibleArticleCount} article{fleissKappas.eligibleArticleCount !== 1 ? 's' : ''} with 2+ raters
            </span>
          </div>

          {/* Per-Question Fleiss' Kappa Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">Question</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">Kappa</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">Interpretation</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">% Agreement</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(fleissKappas.perQuestion).map(([qId, data]) => (
                  <tr key={qId} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-700">{data.label}</td>
                    <td className="text-center py-2 px-3 font-mono">{data.kappa}</td>
                    <td className="text-center py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${KAPPA_COLORS[data.interpretation] || KAPPA_COLORS['N/A']}`}>
                        {data.interpretation}
                      </span>
                    </td>
                    <td className="text-center py-2 px-3">{data.percentAgreement}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cohen's Kappa Pairwise — paired-rater agreement */}
      {cohensKappaPairs.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Pairwise Agreement (Cohen&apos;s Kappa + PABAK)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">Reviewer Pair</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">Articles</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">Kappa</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">PABAK</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">Interpretation</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">% Agreement</th>
                </tr>
              </thead>
              <tbody>
                {cohensKappaPairs.map((pair, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-700">
                      <span className="font-medium">{pair.reviewer1}</span>
                      <span className="text-gray-400 mx-1">vs</span>
                      <span className="font-medium">{pair.reviewer2}</span>
                    </td>
                    <td className="text-center py-2 px-3">{pair.sharedArticles}</td>
                    <td className="text-center py-2 px-3 font-mono">
                      {pair.overallKappa != null ? pair.overallKappa : '—'}
                    </td>
                    <td className="text-center py-2 px-3 font-mono">
                      {pair.overallPABAK != null ? pair.overallPABAK : '—'}
                    </td>
                    <td className="text-center py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${KAPPA_COLORS[pair.interpretation] || KAPPA_COLORS['N/A']}`}>
                        {pair.interpretation}
                      </span>
                    </td>
                    <td className="text-center py-2 px-3">{pair.percentAgreement}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">PABAK (Byrt et al., 1993) corrects for prevalence and bias paradoxes that can deflate raw kappa when score distributions are skewed.</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Article Scores ───────────────────────────────────────────
function ArticlesTab({ articles }) {
  const [expandedId, setExpandedId] = useState(null);

  if (articles.length === 0) {
    return <EmptyState title="No articles scored yet" message="Article summaries will appear here once reviews have been submitted." />;
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => (
        <div key={article.id} className="card overflow-hidden">
          <button
            onClick={() => setExpandedId(expandedId === article.id ? null : article.id)}
            className="w-full text-left p-4 hover:bg-gray-50 transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 line-clamp-2">{article.citation}</p>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                  {article.year && <span>{article.year}</span>}
                  {article.journal && <span>&middot; {article.journal}</span>}
                  {article.doi && <span>&middot; DOI</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`${CONSENSUS_COLORS[article.consensusStatus] || 'badge-gray'} text-xs`}>
                  {article.consensusStatus}
                </span>
                <span className="text-sm font-medium text-gray-700">
                  {article.reviewerCount} reviewer{article.reviewerCount !== 1 ? 's' : ''}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === article.id ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {article.avgScore != null && (
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="text-gray-500">Avg: <span className="font-medium text-gray-700">{article.avgScore}/22</span></span>
                <span className="text-gray-500">Tier: <span className="font-medium text-gray-700">{article.avgTier}</span></span>
                {article.maxDifference > 0 && (
                  <span className="text-gray-500">Max diff: <span className="font-medium text-gray-700">{article.maxDifference}</span></span>
                )}
              </div>
            )}
          </button>

          {expandedId === article.id && article.reviewerScores.length > 0 && (
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-1.5 pr-3 font-medium text-gray-600">Reviewer</th>
                      {['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11'].map(q => (
                        <th key={q} className="text-center py-1.5 px-1 font-medium text-gray-600 w-8">{q}</th>
                      ))}
                      <th className="text-center py-1.5 pl-3 font-medium text-gray-600">Total</th>
                      <th className="text-center py-1.5 pl-2 font-medium text-gray-600">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {article.reviewerScores.map((rs, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-1.5 pr-3 font-medium text-gray-700">{rs.raterAlias}</td>
                        {['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11'].map(q => (
                          <td key={q} className="text-center py-1.5 px-1">
                            <span className={`inline-block w-6 h-6 leading-6 rounded text-center font-mono ${
                              rs[q] === 2 ? 'bg-green-100 text-green-800' :
                              rs[q] === 1 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {rs[q] ?? '—'}
                            </span>
                          </td>
                        ))}
                        <td className="text-center py-1.5 pl-3 font-bold text-gray-900">{rs.total}/22</td>
                        <td className="text-center py-1.5 pl-2 text-gray-500">
                          {rs.timeToComplete ? `${rs.timeToComplete}m` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Reviewer Stats ───────────────────────────────────────────
function ReviewersTab({ reviewers }) {
  if (reviewers.length === 0) {
    return <EmptyState title="No reviewer data" message="Reviewer statistics will appear here once reviews have been submitted." />;
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 font-medium text-gray-600">Reviewer</th>
              <th className="text-center py-3 px-3 font-medium text-gray-600">Articles</th>
              <th className="text-center py-3 px-3 font-medium text-gray-600">Avg Score</th>
              <th className="text-center py-3 px-3 font-medium text-gray-600">Tier</th>
              <th className="text-center py-3 px-3 font-medium text-gray-600">Avg Time</th>
              <th className="text-center py-3 px-3 font-medium text-gray-600">Bias Indicator</th>
            </tr>
          </thead>
          <tbody>
            {reviewers.map((r) => (
              <tr key={r.alias} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <p className="font-medium text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-500">{r.alias}</p>
                </td>
                <td className="text-center py-3 px-3">{r.articlesReviewed}</td>
                <td className="text-center py-3 px-3 font-mono">{r.avgScore}/22</td>
                <td className="text-center py-3 px-3">
                  <span className={`${
                    r.avgTier === 'High' ? 'badge-green' :
                    r.avgTier === 'Moderate' ? 'badge-yellow' :
                    'badge-red'
                  } text-xs`}>
                    {r.avgTier}
                  </span>
                </td>
                <td className="text-center py-3 px-3 text-gray-500">
                  {r.avgTime != null ? `${r.avgTime} min` : '—'}
                </td>
                <td className="text-center py-3 px-3">
                  <span className={`text-xs font-medium ${
                    r.biasLabel === 'Consistent' ? 'text-green-700' :
                    r.biasPct > 0 ? 'text-orange-600' : 'text-blue-600'
                  }`}>
                    {r.biasLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Quality Distributions ────────────────────────────────────
function DistributionsTab({ distributions, fleissKappas }) {
  if (distributions.totalScores === 0) {
    return <EmptyState title="No score data" message="Quality distribution charts will appear here once reviews have been submitted." />;
  }

  const rubricLookup = Object.fromEntries(RUBRIC_QUESTIONS.map(q => [q.id, q.description]));
  const fleissPerQ = fleissKappas?.perQuestion || {};

  const questionData = Object.entries(distributions.perQuestion).map(([qId, data]) => ({
    name: qId.toUpperCase(),
    qId,
    label: data.label,
    description: rubricLookup[qId] || '',
    mean: data.mean,
    'Score 0': data.percentages[0],
    'Score 1': data.percentages[1],
    'Score 2': data.percentages[2],
    fleissKappa: fleissPerQ[qId]?.kappa ?? null,
    fleissInterpretation: fleissPerQ[qId]?.interpretation ?? null,
    percentAgreement: fleissPerQ[qId]?.percentAgreement ?? null,
  }));

  // Sort by mean for the item performance table (worst items first)
  const sortedByPerformance = [...questionData].sort((a, b) => a.mean - b.mean);

  return (
    <div className="space-y-8">
      {/* Overall stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-pacific">{distributions.avgScore}</p>
          <p className="text-xs text-gray-500 mt-1">Average Score (out of 22)</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-pacific">{distributions.totalScores}</p>
          <p className="text-xs text-gray-500 mt-1">Total Reviews</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{distributions.qualityTiers.highPct}%</p>
          <p className="text-xs text-gray-500 mt-1">High Quality Rate</p>
        </div>
      </div>

      {/* Score Histogram + Item Performance Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Histogram */}
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Score Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={distributions.scoreHistogram} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
              />
              <Bar dataKey="count" fill={NORDIC_COLORS.primary} radius={[4, 4, 0, 0]} name="Reviews" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Item Performance Panel (replaces Quality Tiers pie) */}
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Item Performance Summary</h3>
          <p className="text-xs text-gray-500 mb-3">Questions ranked by difficulty (lowest mean first). Items with low agreement may need rubric clarification.</p>
          <div className="overflow-y-auto max-h-[280px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 pr-2 font-medium text-gray-600">Item</th>
                  <th className="text-center py-1.5 px-1 font-medium text-gray-600">Mean</th>
                  <th className="text-center py-1.5 px-1 font-medium text-gray-600">% High</th>
                  <th className="text-center py-1.5 px-1 font-medium text-gray-600">Fleiss &kappa;</th>
                  <th className="text-center py-1.5 px-1 font-medium text-gray-600">Agree%</th>
                </tr>
              </thead>
              <tbody>
                {sortedByPerformance.map((item) => (
                  <tr key={item.qId} className="border-b border-gray-100">
                    <td className="py-1.5 pr-2">
                      <span className="font-mono font-medium text-gray-700">{item.name}</span>
                      <span className="text-gray-400 ml-1 hidden sm:inline">{item.label}</span>
                    </td>
                    <td className="text-center py-1.5 px-1">
                      <span className={`font-mono font-medium ${
                        item.mean >= 1.5 ? 'text-green-700' :
                        item.mean >= 1.0 ? 'text-yellow-700' :
                        'text-red-700'
                      }`}>
                        {item.mean}
                      </span>
                    </td>
                    <td className="text-center py-1.5 px-1 font-mono text-gray-600">
                      {item['Score 2']}%
                    </td>
                    <td className="text-center py-1.5 px-1">
                      {item.fleissKappa != null ? (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                          KAPPA_COLORS[item.fleissInterpretation] || KAPPA_COLORS['N/A']
                        }`}>
                          {item.fleissKappa}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="text-center py-1.5 px-1 font-mono text-gray-600">
                      {item.percentAgreement != null ? `${item.percentAgreement}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between mt-3 text-xs text-gray-400 border-t border-gray-100 pt-2">
            <span>Quality tiers: High {distributions.qualityTiers.high} &middot; Moderate {distributions.qualityTiers.moderate} &middot; Low {distributions.qualityTiers.low}</span>
          </div>
        </div>
      </div>

      {/* Per-Question Stacked Bar */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Score Distribution by Question</h3>
        <p className="text-xs text-gray-500 mb-4">Percentage of reviews receiving each score (0, 1, or 2) per question. Hover for IRR metrics.</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={questionData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} unit="%" />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const item = questionData.find(d => d.name === label);
                return (
                  <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '10px 14px', maxWidth: '340px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <p style={{ fontWeight: 700, fontSize: '14px', margin: '0 0 4px' }}>{label}: {item?.label}</p>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px', lineHeight: '1.4' }}>{item?.description}</p>
                    {payload.map((entry, i) => (
                      <p key={i} style={{ fontSize: '13px', margin: '2px 0', color: entry.color }}>
                        {entry.name}: {entry.value}%
                      </p>
                    ))}
                    <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '8px', paddingTop: '8px' }}>
                      <p style={{ fontSize: '12px', color: '#374151', margin: '2px 0' }}>
                        <span style={{ fontWeight: 600 }}>Mean:</span> {item?.mean}/2
                      </p>
                      {item?.fleissKappa != null && (
                        <p style={{ fontSize: '12px', color: '#374151', margin: '2px 0' }}>
                          <span style={{ fontWeight: 600 }}>Fleiss&apos; &kappa;:</span> {item.fleissKappa} ({item.fleissInterpretation})
                        </p>
                      )}
                      {item?.percentAgreement != null && (
                        <p style={{ fontSize: '12px', color: '#374151', margin: '2px 0' }}>
                          <span style={{ fontWeight: 600 }}>Agreement:</span> {item.percentAgreement}%
                        </p>
                      )}
                    </div>
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="Score 2" stackId="a" fill={NORDIC_COLORS.green} name="High (2)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Score 1" stackId="a" fill={NORDIC_COLORS.yellow} name="Moderate (1)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Score 0" stackId="a" fill={NORDIC_COLORS.red} name="Low (0)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Tab: AI Reviewer ──────────────────────────────────────────────
function AIReviewerTab({ articles, onRefresh }) {
  const [selectedStudyId, setSelectedStudyId] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [batchError, setBatchError] = useState('');

  const handleTriggerAI = async () => {
    if (!selectedStudyId) return;
    setAiLoading(true);
    setAiResult(null);
    setAiError('');
    try {
      const res = await fetch('/api/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyId: selectedStudyId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json.error || 'AI review failed');
        if (json.details) setAiError(prev => prev + ': ' + json.details.join(', '));
        return;
      }
      setAiResult(json);
      if (onRefresh) onRefresh();
    } catch (err) {
      setAiError(err.message || 'Failed to trigger AI review');
    } finally {
      setAiLoading(false);
    }
  };

  const handleBatchAI = async () => {
    setBatchLoading(true);
    setBatchResult(null);
    setBatchError('');
    try {
      const res = await fetch('/api/ai-review/batch', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setBatchError(json.error || 'Batch review failed');
        return;
      }
      setBatchResult(json);
      if (onRefresh) onRefresh();
    } catch (err) {
      setBatchError(err.message || 'Failed to run batch AI review');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleContinueBatch = async () => {
    await handleBatchAI();
  };

  return (
    <div className="space-y-6">
      {/* Single Article AI Review */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Run AI Auto-Review</h3>
        <p className="text-sm text-gray-500 mb-4">
          Select an article to score individually, or use &quot;Review All Unscored&quot; for batch processing.
        </p>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="form-label">Select Article</label>
            <select
              value={selectedStudyId}
              onChange={(e) => setSelectedStudyId(e.target.value)}
              className="select-field"
            >
              <option value="">Choose an article...</option>
              {articles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.citation?.substring(0, 80)}{a.citation?.length > 80 ? '...' : ''} ({a.reviewerCount} reviewers)
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleTriggerAI}
            disabled={!selectedStudyId || aiLoading}
            className="btn-primary whitespace-nowrap"
          >
            {aiLoading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Scoring...
              </span>
            ) : 'Run AI Review'}
          </button>
        </div>

        {aiError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{aiError}</p>
          </div>
        )}

        {aiResult && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-800 font-medium text-sm">AI Review Completed</p>
            </div>
            <div className="text-sm text-green-700 space-y-1">
              <p>Score: <span className="font-bold">{aiResult.totalScore}/22</span> — {aiResult.qualityTier} Quality</p>
              {aiResult.reasoning && <p className="text-green-600 italic">{aiResult.reasoning}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Batch AI Review */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Batch AI Review</h3>
            <p className="text-sm text-gray-500 mt-1">
              Score all unreviewed articles automatically. Articles already scored by AI-Reviewer will be skipped.
            </p>
          </div>
          <button
            onClick={handleBatchAI}
            disabled={batchLoading}
            className="btn-secondary whitespace-nowrap"
          >
            {batchLoading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-pacific-600 border-t-transparent" />
                Processing...
              </span>
            ) : 'Review All Unscored'}
          </button>
        </div>

        {batchError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{batchError}</p>
          </div>
        )}

        {batchResult && (
          <div className="space-y-4">
            {/* Progress summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-700">{batchResult.processed}</p>
                <p className="text-xs text-green-600">Completed</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-700">{batchResult.failed}</p>
                <p className="text-xs text-red-600">Failed</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-700">{batchResult.remaining}</p>
                <p className="text-xs text-blue-600">Remaining</p>
              </div>
            </div>

            {/* Progress bar */}
            {batchResult.total > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{batchResult.processed + batchResult.failed} of {batchResult.total} processed</span>
                  <span>{Math.round(((batchResult.processed + batchResult.failed) / batchResult.total) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-pacific h-2 rounded-full transition-all duration-500"
                    style={{ width: `${((batchResult.processed + batchResult.failed) / batchResult.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Continue button */}
            {batchResult.remaining > 0 && (
              <button
                onClick={handleContinueBatch}
                disabled={batchLoading}
                className="btn-primary w-full"
              >
                Continue — {batchResult.remaining} remaining
              </button>
            )}

            {batchResult.remaining === 0 && batchResult.processed > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-green-800 font-medium text-sm">All articles have been scored by AI!</p>
              </div>
            )}

            {/* Processed details */}
            {batchResult.processedDetails?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Completed Reviews</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {batchResult.processedDetails.map((item) => (
                    <div key={item.studyId} className="flex items-center justify-between text-sm py-2 border-b border-gray-100">
                      <span className="text-gray-700 truncate flex-1 mr-4">{item.citation}</span>
                      <span className={`font-medium ${item.qualityTier === 'High' ? 'text-green-700' : item.qualityTier === 'Moderate' ? 'text-yellow-700' : 'text-red-700'}`}>
                        {item.totalScore}/22
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed details */}
            {batchResult.failedDetails?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-700 mb-2">Failed Reviews</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {batchResult.failedDetails.map((item) => (
                    <div key={item.studyId} className="text-sm p-2 bg-red-50 rounded">
                      <p className="text-red-800 truncate">{item.citation}</p>
                      <p className="text-red-600 text-xs">{item.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* About section */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">About AI Auto-Reviewer</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>The AI reviewer uses the full SQR-RCT rubric and all intake data to score each article on 11 quality dimensions (Q1-Q11), just like human reviewers.</p>
          <p>AI scores are submitted under the alias <span className="font-mono bg-gray-100 px-1 rounded">AI-Reviewer</span> and appear in all IRR calculations, article summaries, and quality distributions alongside human reviewers.</p>
          <p>Batch processing handles Vercel&apos;s timeout limit by processing as many articles as possible within 50 seconds. Click &quot;Continue&quot; to resume processing remaining articles.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────
function EmptyState({ title, message }) {
  return (
    <div className="card p-12 text-center">
      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <h3 className="text-lg font-bold text-gray-700 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-md mx-auto">{message}</p>
    </div>
  );
}

// ─── Main Analytics Content ────────────────────────────────────────
function AnalyticsContent() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('irr');
  const [versionFilter, setVersionFilter] = useState(''); // '' = All, 'V1', 'V2'

  useEffect(() => {
    if (user) fetchAnalytics();
  }, [user, versionFilter]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      const url = versionFilter
        ? `/api/analytics?version=${versionFilter}`
        : '/api/analytics';
      const res = await fetch(url);
      if (res.status === 403) {
        setError('admin_required');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (!loading && error === 'admin_required') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="card p-12 text-center max-w-md">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 className="text-lg font-bold text-gray-700 mb-2">Admin Access Required</h3>
            <p className="text-sm text-gray-500">The analytics dashboard is restricted to project administrators. Contact your project lead to request access.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-pacific" />
            <p className="mt-4 text-gray-600">Computing analytics...</p>
          </div>
        </div>
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

        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-pacific">Analytics Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Inter-rater reliability, scoring patterns, and quality distributions
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Rubric Version Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Version:</span>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                {['', ...RUBRIC_VERSIONS].map((v) => (
                  <button
                    key={v}
                    onClick={() => setVersionFilter(v)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      versionFilter === v
                        ? 'bg-pacific text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {v || 'All'}
                  </button>
                ))}
              </div>
              {data?.summary?.versionCounts && (
                <span className="text-xs text-gray-400">
                  {Object.entries(data.summary.versionCounts).map(([v, c]) => `${v}: ${c}`).join(' | ')}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <a
                href={`/api/export/csv${versionFilter ? `?version=${versionFilter}` : ''}`}
                className="btn-secondary text-sm px-4 py-2"
              >
                <svg className="w-4 h-4 mr-1.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                </svg>
                Export CSV
              </a>
              <a
                href={`/api/export/pdf${versionFilter ? `?version=${versionFilter}` : ''}`}
                className="btn-secondary text-sm px-4 py-2"
              >
                <svg className="w-4 h-4 mr-1.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                </svg>
                Export PDF
              </a>
            </div>
          </div>
        </div>

        {data && (
          <>
            <SummaryCards summary={data.summary} />

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="flex gap-0 -mb-px overflow-x-auto">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-pacific text-pacific'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'irr' && <IRRTab irr={data.irr} />}
            {activeTab === 'articles' && <ArticlesTab articles={data.articles} />}
            {activeTab === 'reviewers' && <ReviewersTab reviewers={data.reviewers} />}
            {activeTab === 'distributions' && <DistributionsTab distributions={data.distributions} fleissKappas={data.irr?.fleissKappas} />}
            {activeTab === 'ai' && <AIReviewerTab articles={data.articles} onRefresh={fetchAnalytics} />}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <AnalyticsContent />
      </ProtectedRoute>
    </AuthProvider>
  );
}
