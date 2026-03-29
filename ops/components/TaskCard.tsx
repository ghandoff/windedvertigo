import { Task } from '@/lib/data';

interface TaskCardProps {
  task: Task;
  index: number;
}

export function TaskCard({ task, index }: TaskCardProps) {
  return (
    <div
      className="card-animate p-4 bg-ops-card border border-ops-border rounded-lg"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold text-ops-text text-sm flex-1">{task.title}</h4>
        <span className="text-xs text-ops-text-muted bg-ops-border px-2 py-1 rounded ml-2 whitespace-nowrap">
          {task.category}
        </span>
      </div>
      {task.assigned && (
        <p className="text-xs text-ops-text-muted mb-2">assigned: {task.assigned}</p>
      )}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="space-y-1 mt-3">
          {task.subtasks.map((subtask, i) => (
            <p key={i} className="text-xs text-ops-text/60 pl-3 border-l border-ops-border">
              {subtask}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
