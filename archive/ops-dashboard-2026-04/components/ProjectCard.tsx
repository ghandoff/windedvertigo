'use client';

import { Project } from '@/lib/data';

interface ProjectCardProps {
  project: Project;
  index: number;
}

const statusColors = {
  green: 'badge-green',
  yellow: 'badge-yellow',
  red: 'badge-red',
};

export function ProjectCard({ project, index }: ProjectCardProps) {
  return (
    <div
      className="card-animate p-4 bg-dark-card border border-dark-border rounded-lg hover:border-dark-text/20 transition-colors"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-dark-text text-sm">{project.name}</h3>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[project.status]}`}>
          {project.status === 'green' && 'active'}
          {project.status === 'yellow' && 'in progress'}
          {project.status === 'red' && 'blocked'}
        </span>
      </div>
      {project.description && (
        <p className="text-xs text-dark-textMuted mb-3 leading-relaxed">
          {project.description}
        </p>
      )}
      <div className="space-y-2">
        {project.owner && (
          <div className="flex justify-between text-xs">
            <span className="text-dark-textMuted">owner</span>
            <span className="text-dark-text">{project.owner}</span>
          </div>
        )}
        {project.deadline && (
          <div className="flex justify-between text-xs">
            <span className="text-dark-textMuted">deadline</span>
            <span className="text-dark-text">{project.deadline}</span>
          </div>
        )}
      </div>
    </div>
  );
}
