import { TeamMember } from '@/lib/data';

interface TeamMemberCardProps {
  member: TeamMember;
  index: number;
}

export function TeamMemberCard({ member, index }: TeamMemberCardProps) {
  return (
    <div
      className="card-animate p-4 bg-ops-card border border-ops-border rounded-lg hover:border-ops-text/20 transition-colors"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <h4 className="font-semibold text-ops-text text-sm mb-1">{member.name}</h4>
      <p className="text-xs text-ops-text-muted mb-3">{member.role}</p>
      <div className="space-y-1">
        {member.focus.map((item, i) => (
          <p key={i} className="text-xs text-ops-text/70">
            • {item}
          </p>
        ))}
      </div>
    </div>
  );
}
