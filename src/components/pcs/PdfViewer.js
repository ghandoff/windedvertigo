'use client';

/**
 * Minimal PDF viewer wrapper. Uses the browser's built-in PDF renderer via
 * iframe + fragment navigation (e.g., #page=3). No external deps.
 *
 * PDF.js (Chrome's built-in) sometimes ignores the page fragment on first
 * load, so we use the URL as the `key` to force an iframe remount whenever
 * the page changes.
 *
 * Props:
 *   src: blob URL (or any PDF URL)
 *   page: 1-indexed page to jump to (null/undefined = page 1)
 *   className: optional tailwind class for sizing
 */
export default function PdfViewer({ src, page, className = '' }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-500 ${className}`}>
        No PDF URL
      </div>
    );
  }
  const pageFragment = page && page > 0 ? `#page=${page}&zoom=page-fit` : '';
  const iframeSrc = `${src}${pageFragment}`;
  return (
    <iframe
      key={iframeSrc}
      src={iframeSrc}
      className={`w-full h-full border border-gray-200 rounded ${className}`}
      title="PDF Viewer"
    />
  );
}
