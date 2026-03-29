import { DispatchTask } from '@/lib/data';

interface DispatchCardProps {
  task: DispatchTask;
  index: number;
}

export function DispatchCard({ task, index }: DispatchCardProps) {
  return (
    <div
      className="card-animate p-4 bg-ops-card border border-ops-border rounded-lg"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-mono text-sm text-ops-text">{task.name}</h4>
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
          <span className="text-ops-text-muted">schedule</span>
          <span className="text-ops-text">{task.schedule}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-ops-text-muted">last ran</span>
          <span className="text-ops-text">{task.lastRan}</span>
        </div>
      </div>
    </div>
  );
}
