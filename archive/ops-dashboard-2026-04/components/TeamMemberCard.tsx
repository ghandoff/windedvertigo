'use client';

import { TeamMember } from '@/lib/data';

interface TeamMemberCardProps {
  member: TeamMember;
  index: number;
}

export function TeamMemberCard({ member, index }: TeamMemberCardProps) {
  return (
    <div
      className="card-animate p-4 bg-dark-card border border-dark-border rounded-lg hover:border-dark-text/20 transition-colors"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <h4 className="font-semibold text-dark-text text-sm mb-1">{member.name}</h4>
      <p className="text-xs text-dark-textMuted mb-3">{member.role}</p>
      <div className="space-y-1">
        {member.focus.map((item, i) => (
          <p key={i} className="text-xs text-dark-text/70">
            • {item}
          </p>
        ))}
      </div>
    </div>
  );
}
