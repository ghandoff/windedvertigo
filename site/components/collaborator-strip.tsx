"use client";

import { FadeIn } from "@windedvertigo/motion-kit";
import { COLLABORATORS, type Collaborator } from "@/lib/collaborators";

function CollabItem({ c }: { c: Collaborator }) {
  return (
    <li className={`collab-item${c.current ? " collab-item--current" : ""}`}>
      {c.logoPath ? (
        <img
          src={c.logoPath}
          alt={c.name}
          className="collab-logo"
        />
      ) : (
        <span className="collab-name">{c.name}</span>
      )}
    </li>
  );
}

/**
 * CollaboratorStrip
 *
 * - Default (homepage): slow-scrolling marquee with edge fade.
 * - compact (do page): static centered flex row, no animation.
 *
 * Text-only in V1 — add logoPath to each entry in lib/collaborators.ts
 * once brand clearance is obtained; no component changes needed.
 */
export function CollaboratorStrip({ compact = false }: { compact?: boolean }) {
  if (COLLABORATORS.length === 0) return null;

  return (
    <section
      className={`collab-strip${compact ? " collab-strip--compact" : ""}`}
      aria-label="organisations we play with"
    >
      <p className="collab-strip-label">
        {compact ? "collaborators" : "organisations we play with"}
      </p>

      {!compact && (
        /* Marquee: two identical lists side-by-side; CSS slides left by
           exactly one list-width so the seam is invisible. */
        <div className="collab-marquee-track">
          <ul className="collab-marquee-list" aria-label="collaborator list">
            {COLLABORATORS.map((c) => (
              <CollabItem key={c.name} c={c} />
            ))}
          </ul>
          {/* Duplicate — hidden from assistive technology */}
          <ul className="collab-marquee-list" aria-hidden="true">
            {COLLABORATORS.map((c) => (
              <CollabItem key={c.name + "-dup"} c={c} />
            ))}
          </ul>
        </div>
      )}

      {compact && (
        <FadeIn>
          <ul className="collab-compact-list">
            {COLLABORATORS.map((c) => (
              <CollabItem key={c.name} c={c} />
            ))}
          </ul>
        </FadeIn>
      )}
    </section>
  );
}
