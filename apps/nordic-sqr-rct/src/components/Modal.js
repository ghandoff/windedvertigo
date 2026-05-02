'use client';

import { useEffect, useCallback, useRef } from 'react';

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export default function Modal({ title, children, onClose, size = 'md', footer }) {
  const contentRef = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose?.();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog on open
    contentRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Content */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        className={`relative bg-white rounded-xl shadow-xl w-full ${SIZES[size] || SIZES.md} animate-modal-in outline-none`}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 id="modal-title" className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
