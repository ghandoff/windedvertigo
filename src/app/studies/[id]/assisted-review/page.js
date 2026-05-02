'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getRubricByVersion, DEFAULT_RUBRIC_VERSION, RUBRIC_VERSIONS } from '@/lib/rubric';

/**
 * Assisted Review — conversational human-in-the-loop SQR-RCT scoring.
 *
 * Flow:
 *   1. User opens the page for a specific study
 *   2. Clicks "Generate AI draft" → calls /api/ai-review (existing)
 *      which submits AI scores under the AI-Reviewer alias in parallel
 *      (those scores feed existing /analytics IRR data). The AI-drafted
 *      notionValues come back to the client as the starting point.
 *   3. Each rubric item is displayed as a card with its current
 *      proposed score. User can: Accept, Override (pick different
 *      option), or Challenge (open a chat with the LLM).
 *   4. Challenges hit /api/ai-review/chat which returns a revised
 *      score + rationale after considering the reviewer's objection.
 *   5. When all 11 items have a confirmed score, "Submit review"
 *      POSTs to /api/scores — creating a SECOND score row under
 *      the human reviewer's alias. Both scores appear in IRR stats.
 *
 * The chat transcript is embedded in the Notes field so the reasoning
 * chain is preserved for audit.
 */

const TIER_COLORS = {
  2: 'bg-green-100 text-green-800 border-green-200',
  1: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  0: 'bg-red-100 text-red-800 border-red-200',
};

function scoreOf(notionValue) {
  const m = String(notionValue || '').match(/^(\d)/);
  return m ? Number(m[1]) : null;
}

function AssistedReviewInner({ studyId }) {
  const { user } = useAuth();
  const [study, setStudy] = useState(null);
  const [rubricVersion] = useState(DEFAULT_RUBRIC_VERSION);
  const [rubric] = useState(() => getRubricByVersion(DEFAULT_RUBRIC_VERSION));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);           // { scores: {q1..q11}, reasoning }
  const [generating, setGenerating] = useState(false);
  const [confirmed, setConfirmed] = useState({});     // { q1: true, ... }
  const [scores, setScores] = useState({});           // { q1: notionValue, ... }
  const [transcripts, setTranscripts] = useState({}); // { q1: [{role, content}], ... }
  const [openChallenge, setOpenChallenge] = useState(null); // qId | null
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const loadStudy = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/studies/${studyId}`);
      if (!res.ok) throw new Error('Could not load study');
      const data = await res.json();
      setStudy(data.study || data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [studyId]);

  useEffect(() => { loadStudy(); }, [loadStudy]);

  async function generateDraft() {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyId, rubricVersion }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'AI review failed');
      // The /api/ai-review response shape: { scores: {q1..q11}, totalScore, reasoning, ... }
      setDraft(json);
      setScores(json.scores || {});
      // Clear confirmations & transcripts when a new draft lands
      setConfirmed({});
      setTranscripts({});
      setSubmitResult(null);
    } catch (e) {
      setError(e.message || 'Failed to generate draft');
    } finally {
      setGenerating(false);
    }
  }

  function acceptItem(qId) {
    setConfirmed(c => ({ ...c, [qId]: true }));
  }

  function overrideItem(qId, notionValue) {
    setScores(s => ({ ...s, [qId]: notionValue }));
    setConfirmed(c => ({ ...c, [qId]: true }));
    setTranscripts(t => ({
      ...t,
      [qId]: [...(t[qId] || []), {
        role: 'user',
        content: `[Manual override to: ${notionValue}]`,
      }],
    }));
  }

  async function submitChallenge(qId, userText) {
    const history = transcripts[qId] || [];
    // Draft → first assistant turn (if no prior turns yet)
    const messages = history.length === 0
      ? [
          { role: 'assistant', content: JSON.stringify({ revisedScore: scores[qId], rationale: '[AI draft] see overall reasoning above.' }) },
          { role: 'user', content: userText },
        ]
      : [...history, { role: 'user', content: userText }];

    const res = await fetch('/api/ai-review/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studyId,
        questionId: qId,
        rubricVersion,
        proposedScore: scores[qId],
        messages,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Chat call failed');

    setTranscripts(t => ({
      ...t,
      [qId]: [...messages, { role: 'assistant', content: json.assistantMessage }],
    }));
    // The returned revisedScore becomes the new proposed value
    setScores(s => ({ ...s, [qId]: json.revisedScore }));
  }

  async function submitFinal() {
    setSubmitting(true);
    setError('');
    try {
      // Build notes with the full chat transcript so the reasoning is preserved
      const transcriptLines = [`[Assisted review via /studies/${studyId}/assisted-review — rubric ${rubricVersion}]`];
      transcriptLines.push(`AI draft overall reasoning: ${draft?.reasoning || 'n/a'}`);
      for (const qId of Object.keys(transcripts)) {
        if ((transcripts[qId] || []).length === 0) continue;
        transcriptLines.push(`\n--- ${qId.toUpperCase()} chat transcript ---`);
        for (const msg of transcripts[qId]) {
          transcriptLines.push(`[${msg.role}] ${msg.content}`);
        }
      }
      const notes = transcriptLines.join('\n').slice(0, 1990); // Notion rich_text block cap

      const payload = { studyId, rubricVersion, notes, ...scores };
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Submit failed');
      setSubmitResult(json);
    } catch (e) {
      setError(e.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  const allConfirmed = rubric.every(q => confirmed[q.id]);
  const totalScore = rubric.reduce((sum, q) => sum + (scoreOf(scores[q.id]) ?? 0), 0);

  if (loading) {
    return <div className="p-8"><div className="animate-pulse h-8 bg-gray-200 rounded w-1/3 mb-4" /><div className="animate-pulse h-32 bg-gray-200 rounded" /></div>;
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/reviews" className="hover:underline">Reviews</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">Assisted Review</span>
      </div>
      <h1 className="text-3xl font-bold text-pacific mb-2">Assisted Review</h1>
      <p className="text-gray-600 max-w-3xl">
        AI drafts an initial score for each rubric item; you review, override, or challenge individual items in a back-and-forth chat. Final scores are submitted under <span className="font-mono text-sm">{user?.alias || 'your alias'}</span>, not AI-Reviewer, so your review appears in IRR stats alongside other human reviewers. The full chat transcript is saved with the score.
      </p>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">{error}</div>
      )}

      {/* Study card */}
      <div className="mt-6 card p-4 bg-gray-50">
        <p className="text-xs text-gray-500 uppercase mb-1">Study</p>
        <p className="font-medium text-gray-900">{study?.citation || studyId}</p>
        <div className="flex gap-4 mt-1 text-xs text-gray-500">
          {study?.year && <span>{study.year}</span>}
          {study?.journal && <span>· {study.journal}</span>}
          {study?.doi && <span>· DOI {study.doi.slice(0, 40)}</span>}
        </div>
      </div>

      {/* Generate / regenerate */}
      {!draft ? (
        <div className="mt-6 card p-6 text-center">
          <p className="text-sm text-gray-600 mb-4">Generate an AI-drafted score to start the review. You&apos;ll be able to challenge each item individually.</p>
          <button
            onClick={generateDraft}
            disabled={generating}
            className="btn-primary"
          >
            {generating ? 'Generating…' : 'Generate AI draft'}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Total score: <span className="font-bold text-gray-900">{totalScore}/22</span>
              {' · '}
              Confirmed: <span className="font-bold">{rubric.filter(q => confirmed[q.id]).length}/{rubric.length}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={generateDraft} disabled={generating} className="btn-secondary text-sm">
                {generating ? 'Regenerating…' : 'Regenerate draft'}
              </button>
              <button
                onClick={submitFinal}
                disabled={!allConfirmed || submitting || submitResult}
                className="btn-primary text-sm"
                title={allConfirmed ? 'Submit final scores' : 'Confirm all 11 items first'}
              >
                {submitting ? 'Submitting…' : (submitResult ? 'Submitted ✓' : 'Submit review')}
              </button>
            </div>
          </div>

          {submitResult && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
              Review submitted successfully. Score ID: <span className="font-mono">{submitResult.scoreId}</span>.
              It now appears in /analytics alongside AI-Reviewer and other human reviewers.
            </div>
          )}

          <div className="mt-6 space-y-4">
            {rubric.map(q => (
              <ItemCard
                key={q.id}
                question={q}
                proposed={scores[q.id]}
                confirmed={!!confirmed[q.id]}
                transcript={transcripts[q.id] || []}
                onAccept={() => acceptItem(q.id)}
                onOverride={(v) => overrideItem(q.id, v)}
                onChallenge={(userText) => submitChallenge(q.id, userText)}
                isOpen={openChallenge === q.id}
                onToggleOpen={() => setOpenChallenge(o => o === q.id ? null : q.id)}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function ItemCard({ question, proposed, confirmed, transcript, onAccept, onOverride, onChallenge, isOpen, onToggleOpen }) {
  const [challengeText, setChallengeText] = useState('');
  const [working, setWorking] = useState(false);
  const score = scoreOf(proposed);

  async function sendChallenge() {
    if (!challengeText.trim()) return;
    setWorking(true);
    try {
      await onChallenge(challengeText);
      setChallengeText('');
    } catch (e) {
      alert(e.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className={`card ${confirmed ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-gray-200'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-gray-500">{question.id.toUpperCase()}</span>
              <span className="font-medium text-gray-900">{question.label}</span>
              {score !== null && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${TIER_COLORS[score]}`}>
                  {score}/2
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">{question.description}</p>
            <p className="mt-2 text-sm text-gray-800 bg-gray-50 p-2 rounded">
              <span className="font-medium">Current score:</span> {proposed || '—'}
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {!confirmed && (
              <button onClick={onAccept} className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                Accept
              </button>
            )}
            <button onClick={onToggleOpen} className="text-xs px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50">
              {isOpen ? 'Close' : 'Challenge / Override'}
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
            {/* Override dropdown */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Override to a specific option</label>
              <select
                value={proposed || ''}
                onChange={e => onOverride(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-gray-300 rounded bg-white"
              >
                {question.options.map(opt => (
                  <option key={opt.notionValue} value={opt.notionValue}>
                    {opt.label} — {opt.notionValue.slice(0, 90)}{opt.notionValue.length > 90 ? '…' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Chat transcript */}
            {transcript.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-50 p-3 rounded">
                {transcript.map((msg, i) => (
                  <div key={i} className={`text-xs ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block max-w-[85%] px-2 py-1 rounded ${
                      msg.role === 'user' ? 'bg-pacific-100 text-pacific-900' : 'bg-white border border-gray-200'
                    }`}>
                      <span className="font-mono text-[10px] text-gray-400 mr-1">{msg.role}</span>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Challenge textarea */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Challenge the AI</label>
              <textarea
                value={challengeText}
                onChange={e => setChallengeText(e.target.value)}
                rows={3}
                placeholder='e.g. "The per-protocol analysis only excluded 2 of 60 participants, so the impact on the effect estimate is minimal — not substantial. The score should be higher."'
                className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pacific focus:border-transparent"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={sendChallenge}
                  disabled={working || !challengeText.trim()}
                  className="text-xs px-3 py-1.5 bg-pacific-600 text-white rounded hover:bg-pacific-700 disabled:opacity-50"
                >
                  {working ? 'Thinking…' : 'Send challenge'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssistedReviewPage({ params }) {
  const { id: studyId } = use(params);
  return (
    <AuthProvider>
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <AssistedReviewInner studyId={studyId} />
          <Footer />
        </div>
      </ProtectedRoute>
    </AuthProvider>
  );
}
