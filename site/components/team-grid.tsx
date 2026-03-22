"use client";

import { useState } from "react";
import type { TeamMember } from "@/lib/notion";

/**
 * Renders a markdown-like bio string into React elements.
 * Supports: **bold**, *italic*, [link](url), paragraph breaks.
 */
function MarkdownBio({ text }: { text: string }) {
  // Split into paragraphs on double newlines
  const paragraphs = text.split(/\n\n+/).filter(Boolean);

  return (
    <>
      {paragraphs.map((para, i) => (
        <p key={i}>
          {para.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/).map((part, j) => {
            // Bold
            const boldMatch = part.match(/^\*\*(.+)\*\*$/);
            if (boldMatch) return <strong key={j}>{boldMatch[1]}</strong>;
            // Italic
            const italicMatch = part.match(/^\*(.+)\*$/);
            if (italicMatch) return <em key={j}>{italicMatch[1]}</em>;
            // Link
            const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
            if (linkMatch) return <a key={j} href={linkMatch[2]}>{linkMatch[1]}</a>;
            // Plain text
            return part;
          })}
        </p>
      ))}
    </>
  );
}

function MemberCard({ member }: { member: TeamMember }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = member.bio.length > 400;

  return (
    <article className="team-member">
      <div className="member-photo">
        {member.headshot ? (
          <img
            src={member.headshot}
            alt={member.name}
            className="member-headshot"
            loading="lazy"
          />
        ) : (
          <div
            className="member-headshot"
            style={{ background: "var(--color-surface-raised)" }}
          />
        )}
      </div>
      <div className="member-content">
        <h2>{member.name}</h2>
        <p className="role">{member.role}</p>
        <div
          className={`bio${needsTruncation && !expanded ? " truncated" : ""}${expanded ? " expanded" : ""}`}
          style={
            needsTruncation && !expanded ? { maxHeight: 150 } : undefined
          }
        >
          <MarkdownBio text={member.bio} />
        </div>
        {needsTruncation && (
          <button
            className="see-more-btn"
            onClick={() => setExpanded(!expanded)}
          >
            [{expanded ? "see less" : "see more..."}]
          </button>
        )}
        {member.link && (
          <div className="links">
            <a href={member.link} target="_blank" rel="noopener noreferrer">
              linkedin
            </a>
          </div>
        )}
        {member.tags.length > 0 && (
          <div className="tags">
            {member.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function TeamGrid({ members }: { members: TeamMember[] }) {
  return (
    <div className="team-grid">
      {members.map((member) => (
        <MemberCard key={member.name} member={member} />
      ))}
    </div>
  );
}
