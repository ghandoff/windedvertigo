'use client';

import { Meeting } from '@/lib/data';

interface MeetingCardProps {
  meeting: Meeting;
  index: number;
}

export function MeetingCard({ meeting, index }: MeetingCardProps) {
  return (
    <div
      className="card-animate p-4 bg-dark-card border border-dark-border rounded-lg"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-dark-text text-sm">{meeting.title}</h4>
        <span className="text-xs text-dark-textMuted">{meeting.day}</span>
      </div>
      <p className="text-sm text-dark-text mb-3">
        <span className="font-mono">{meeting.time}</span>
        <span className="text-dark-textMuted ml-2">{meeting.timezone}</span>
      </p>
      {meeting.attendees && meeting.attendees.length > 0 && (
        <div className="text-xs text-dark-textMuted">
          {meeting.attendees.join(', ')}
        </div>
      )}
    </div>
  );
}
