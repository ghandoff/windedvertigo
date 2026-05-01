'use client';

import { DispatchTask } from '@/lib/data';

interface DispatchCardProps {
  task: DispatchTask;
  index: number;
}

export function DispatchCard({ task, index }: DispatchCardProps) {
  return (
    <div
      className="card-animate p-4 bg-dark-card border border-dark-border rounded-lg"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-mono text-sm text-dark-text">{task.name}</h4>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full ${
            task.status === 'success'
              ? 'badge-green'
              : 'badge-gray'
          }`}
        >
          {task.status}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-dark-textMuted">schedule</span>
          <span className="text-dark-text">{task.schedule}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-dark-textMuted">last ran</span>
          <span className="text-dark-text">{task.lastRan}</span>
        </div>
      </div>
    </div>
  );
}
