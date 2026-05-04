'use client';

/**
 * SectionAnchor — reusable section wrapper for the Living PCS View.
 *
 * 2026-05-04 restyled to match the printed Word template:
 *   - Blue-banded section header (~#D6E5F4 background, dark navy text)
 *   - "Eyebrow" (e.g., "Table A.") rendered inline before the title, matching
 *     "Table A. Document Revision History" pattern from the .docx
 *   - Body text inherits serif from the .pcs-paper wrapper in LivingPcsView
 *
 * Backfill badge + action slots preserved on the right.
 */
export default function SectionAnchor({ id, title, eyebrow, badge, action, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      {/* Word-template style banded section header */}
      <div className="flex items-center justify-between gap-3 border-l-4 border-pacific-700 bg-pacific-100/70 px-3 py-2 mb-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-pacific-900 text-base leading-tight">
            <a href={`#${id}`} className="hover:underline">
              {eyebrow ? <span>{eyebrow}. </span> : null}
              {title}
            </a>
          </h2>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {badge}
          {action}
        </div>
      </div>
      <div className="pcs-section-body">{children}</div>
    </section>
  );
}
