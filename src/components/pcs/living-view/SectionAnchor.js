'use client';

/**
 * SectionAnchor — reusable section wrapper for the Living PCS View.
 *
 * Provides an anchor id, a section heading, an optional badge slot (used by
 * BackfillBadge in later phases), and an optional right-side action slot.
 */
export default function SectionAnchor({ id, title, eyebrow, badge, action, children }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {eyebrow && (
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{eyebrow}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">
              <a
                href={`#${id}`}
                className="hover:text-pacific-600 transition-colors"
              >
                {title}
              </a>
            </h2>
            {badge}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}
