'use client';

/**
 * Wave 6.1 — floating "Send feedback" action button + modal.
 *
 * Mounted in the PCS layout so it appears on every authenticated PCS page.
 * Screenshot capture is intentionally omitted in v1 to avoid the
 * html2canvas dependency and getDisplayMedia permission friction — instead,
 * we auto-include page URL, user-agent, viewport, commit SHA in the Slack
 * payload (server-side in /api/feedback).
 *
 * v2 TODO: allow pasting an image from clipboard into the textarea and
 * uploading it to Blob, attach the URL to the Slack message.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/useAuth';
import { useToast } from '@/components/Toast';

const CATEGORIES = [
  { value: 'bug',       label: '🐛 Bug',        hint: 'Something broken or wrong' },
  { value: 'confusion', label: '❓ Confusion',  hint: 'Unclear or hard to find' },
  { value: 'idea',      label: '💡 Idea',       hint: 'Feature request or suggestion' },
  { value: 'other',     label: '💬 Other',      hint: 'Anything else' },
];

export default function FeedbackButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Only render for authenticated users. (Layout also gates, but be safe.)
  if (!user) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Send feedback"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-pacific-600 hover:bg-pacific-700 text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-pacific-400 focus:ring-offset-2"
      >
        {/* Chat bubble icon */}
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </button>
      {open ? <FeedbackModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function FeedbackModal({ onClose }) {
  const toast = useToast();
  const [category, setCategory] = useState('bug');
  const [message, setMessage] = useState('');
  const [emailBack, setEmailBack] = useState(true); // default on for bugs
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Flip emailBack default when switching category: on for bug, off otherwise.
  // Only adjust if the user hasn't manually diverged from the new default.
  const handleCategoryChange = useCallback((next) => {
    setCategory((prev) => {
      if (prev === next) return prev;
      setEmailBack((prevEmail) => {
        const prevDefault = prev === 'bug';
        // If the current value still matches the *previous* default,
        // sync it to the new default. Otherwise respect user's choice.
        if (prevEmail === prevDefault) return next === 'bug';
        return prevEmail;
      });
      return next;
    });
  }, []);

  // Escape to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  // Autofocus textarea
  useEffect(() => {
    if (mounted) textareaRef.current?.focus();
  }, [mounted]);

  const canSubmit = message.trim().length > 0 && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const body = {
        category,
        message: message.trim(),
        emailBack,
        pageUrl: typeof window !== 'undefined' ? window.location.href : null,
        viewport:
          typeof window !== 'undefined'
            ? `${window.innerWidth}x${window.innerHeight}`
            : null,
      };
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Send failed');
      }
      toast.success('Thanks — your feedback was sent');
      onClose();
    } catch (err) {
      toast.error("Couldn't send — please try again");
      console.error('[feedback] submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close feedback"
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-black/40"
      />
      {/* Panel */}
      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-lg shadow-2xl w-full max-w-md border border-gray-200"
      >
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 id="feedback-modal-title" className="text-lg font-semibold text-gray-900">
              Send feedback
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Goes straight to Garrett. Page + build info are included automatically.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Category */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">Category</legend>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => {
                const checked = category === c.value;
                return (
                  <label
                    key={c.value}
                    className={`cursor-pointer rounded-md border px-3 py-2 text-sm transition ${
                      checked
                        ? 'border-pacific-500 bg-pacific-50 text-pacific-800 ring-1 ring-pacific-400'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="feedback-category"
                      value={c.value}
                      checked={checked}
                      onChange={() => handleCategoryChange(c.value)}
                      className="sr-only"
                    />
                    <span className="font-medium">{c.label}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">{c.hint}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Message */}
          <div>
            <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-700 mb-1">
              What&apos;s happening?
            </label>
            <textarea
              id="feedback-message"
              ref={textareaRef}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={submitting}
              placeholder="Describe what you saw, what you expected, or what you'd like to see..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-pacific-500 focus:outline-none focus:ring-1 focus:ring-pacific-500 disabled:bg-gray-50"
              maxLength={4000}
            />
          </div>

          {/* Email-back */}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={emailBack}
              onChange={(e) => setEmailBack(e.target.checked)}
              disabled={submitting}
              className="h-4 w-4 rounded border-gray-300 text-pacific-600 focus:ring-pacific-500"
            />
            Email me back when this is resolved
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium rounded-md bg-pacific-600 text-white hover:bg-pacific-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending…' : 'Send feedback'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
