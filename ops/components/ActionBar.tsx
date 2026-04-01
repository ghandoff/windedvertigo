'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActionBarProps {
  className?: string;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

interface TaskFormData {
  title: string;
  priority: 'high' | 'medium' | 'low';
  project: string;
}

const DISPATCH_TASKS = [
  { id: 'weekly-cfo-review', label: 'Weekly CFO Review' },
  { id: 'invoice-processor', label: 'Invoice Processor' },
  { id: 'revenue-sync', label: 'Revenue Sync' },
  { id: 'payroll-reconcile', label: 'Payroll Reconcile' },
] as const;

const PROJECTS = [
  'Winded Vertigo',
  'Creaseworks',
  'Harbour',
  'Ops Dashboard',
] as const;

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function triggerAction(endpoint: string, body?: object) {
  const res = await fetch(endpoint, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Action failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Inline SVG Icons
// ---------------------------------------------------------------------------

function IconRefresh({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? 'animate-spin' : ''}
    >
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="animate-spin"
    >
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Status color helpers
// ---------------------------------------------------------------------------

function statusColor(status: ActionStatus): string {
  switch (status) {
    case 'loading':
      return '#f59e0b'; // amber
    case 'success':
      return '#10b981'; // emerald
    case 'error':
      return '#ef4444'; // red
    default:
      return '#71717a'; // ops-text-muted
  }
}

// ---------------------------------------------------------------------------
// useActionState hook
// ---------------------------------------------------------------------------

function useActionState() {
  const [status, setStatus] = useState<ActionStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const reset = useCallback(() => {
    setStatus('idle');
  }, []);

  const execute = useCallback(
    async (fn: () => Promise<unknown>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setStatus('loading');
      try {
        await fn();
        setStatus('success');
      } catch {
        setStatus('error');
      }
      timeoutRef.current = setTimeout(() => setStatus('idle'), 2000);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { status, execute, reset };
}

// ---------------------------------------------------------------------------
// ActionButton
// ---------------------------------------------------------------------------

function ActionButton({
  icon,
  label,
  status,
  successLabel,
  errorLabel,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  status: ActionStatus;
  successLabel?: string;
  errorLabel?: string;
  onClick: () => void;
}) {
  const displayLabel =
    status === 'success'
      ? successLabel ?? 'done'
      : status === 'error'
        ? errorLabel ?? 'failed'
        : label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status === 'loading'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        border: 'none',
        background: 'transparent',
        color: statusColor(status),
        fontSize: '11px',
        fontFamily: 'inherit',
        cursor: status === 'loading' ? 'wait' : 'pointer',
        borderRadius: '4px',
        transition: 'color 150ms ease, background 150ms ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (status === 'idle') {
          (e.currentTarget as HTMLButtonElement).style.color = '#d4d4d8';
          (e.currentTarget as HTMLButtonElement).style.background =
            'rgba(255,255,255,0.04)';
        }
      }}
      onMouseLeave={(e) => {
        if (status === 'idle') {
          (e.currentTarget as HTMLButtonElement).style.color = '#71717a';
          (e.currentTarget as HTMLButtonElement).style.background =
            'transparent';
        }
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLButtonElement).style.outline = 'none';
        (e.currentTarget as HTMLButtonElement).style.boxShadow =
          '0 0 0 2px #3b82f6';
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
      }}
    >
      {status === 'loading' ? <IconSpinner /> : icon}
      <span>{displayLabel}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ActionBar
// ---------------------------------------------------------------------------

export function ActionBar({ className }: ActionBarProps) {
  const refresh = useActionState();
  const slack = useActionState();
  const task = useActionState();
  const dispatch = useActionState();
  const exportSnap = useActionState();

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);

  const [taskForm, setTaskForm] = useState<TaskFormData>({
    title: '',
    priority: 'medium',
    project: PROJECTS[0],
  });

  // Close task form on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setTaskFormOpen(false);
        setDispatchOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close dispatch dropdown when clicking outside
  const dispatchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        dispatchRef.current &&
        !dispatchRef.current.contains(e.target as Node)
      ) {
        setDispatchOpen(false);
      }
    }
    if (dispatchOpen) {
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }
  }, [dispatchOpen]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  function handleRefresh() {
    refresh.execute(() => triggerAction('/api/actions/refresh', {}));
  }

  function handleSlack() {
    slack.execute(() => triggerAction('/api/actions/slack-update', {}));
  }

  function handleToggleTaskForm() {
    setTaskFormOpen((prev) => !prev);
    setDispatchOpen(false);
  }

  function handleSubmitTask(e: React.FormEvent) {
    e.preventDefault();
    task.execute(async () => {
      await triggerAction('/api/actions/create-task', taskForm);
      setTaskForm({ title: '', priority: 'medium', project: PROJECTS[0] });
      setTaskFormOpen(false);
    });
  }

  function handleToggleDispatch() {
    setDispatchOpen((prev) => !prev);
    setTaskFormOpen(false);
  }

  function handleDispatch(taskId: string, taskName: string) {
    setDispatchOpen(false);
    dispatch.execute(() =>
      triggerAction('/api/actions/run-dispatch', { taskId }),
    );
    // Override the success label dynamically via a small trick: we rely on the
    // status-driven label in ActionButton. For a richer message we would need
    // extra state — keeping it simple here.
    void taskName; // used by the button's successLabel prop below
  }

  function handleExport() {
    exportSnap.execute(async () => {
      const res = await fetch('/api/actions/export');
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ops-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  // Track the last dispatched task name for the success label
  const [lastDispatchName, setLastDispatchName] = useState('');

  function handleDispatchWrapped(taskId: string, taskName: string) {
    setLastDispatchName(taskName);
    handleDispatch(taskId, taskName);
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(30,42,56,0.5)',
    borderRadius: '4px',
    padding: '6px 8px',
    fontSize: '11px',
    color: '#d4d4d8',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    width: 'auto',
    minWidth: '100px',
    appearance: 'none' as const,
    backgroundImage:
      'url("data:image/svg+xml,%3Csvg width=\'10\' height=\'6\' viewBox=\'0 0 10 6\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1 1l4 4 4-4\' stroke=\'%2371717a\' stroke-width=\'1.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    paddingRight: '24px',
  };

  return (
    <div className={className}>
      {/* Action buttons bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: '6px 0',
          borderBottom: '1px solid rgba(30,42,56,0.3)',
          width: '100%',
        }}
      >
        <ActionButton
          icon={<IconRefresh spinning={refresh.status === 'loading'} />}
          label="Refresh"
          status={refresh.status}
          successLabel="refreshed"
          onClick={handleRefresh}
        />

        <ActionButton
          icon={<IconChat />}
          label="Slack Update"
          status={slack.status}
          successLabel="sent to #ops"
          onClick={handleSlack}
        />

        <ActionButton
          icon={<IconPlus />}
          label="New Task"
          status={task.status}
          successLabel="task created"
          onClick={handleToggleTaskForm}
        />

        {/* Dispatch wrapper for dropdown positioning */}
        <div ref={dispatchRef} style={{ position: 'relative' }}>
          <ActionButton
            icon={<IconPlay />}
            label="Dispatch"
            status={dispatch.status}
            successLabel={`dispatched ${lastDispatchName}`}
            onClick={handleToggleDispatch}
          />

          {/* Dispatch dropdown */}
          {dispatchOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: '#0f1923',
                border: '1px solid rgba(30,42,56,0.5)',
                borderRadius: '6px',
                padding: '4px 0',
                minWidth: '180px',
                zIndex: 50,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {DISPATCH_TASKS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleDispatchWrapped(t.id, t.label)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: '#d4d4d8',
                    fontSize: '11px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      'rgba(255,255,255,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      'transparent';
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <ActionButton
          icon={<IconDownload />}
          label="Export"
          status={exportSnap.status}
          successLabel="exported"
          onClick={handleExport}
        />
      </div>

      {/* Inline task creation form */}
      {taskFormOpen && (
        <form
          onSubmit={handleSubmitTask}
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            padding: '10px 0',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 200px', minWidth: '160px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '10px',
                color: '#71717a',
                marginBottom: '3px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Title
            </label>
            <input
              type="text"
              value={taskForm.title}
              onChange={(e) =>
                setTaskForm((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Task title..."
              required
              autoFocus
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 2px #3b82f6';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '10px',
                color: '#71717a',
                marginBottom: '3px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Priority
            </label>
            <select
              value={taskForm.priority}
              onChange={(e) =>
                setTaskForm((prev) => ({
                  ...prev,
                  priority: e.target.value as TaskFormData['priority'],
                }))
              }
              style={selectStyle}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '10px',
                color: '#71717a',
                marginBottom: '3px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Project
            </label>
            <select
              value={taskForm.project}
              onChange={(e) =>
                setTaskForm((prev) => ({ ...prev, project: e.target.value }))
              }
              style={selectStyle}
            >
              {PROJECTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={task.status === 'loading'}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: '4px',
              background: 'rgba(59,130,246,0.15)',
              color: '#60a5fa',
              fontSize: '11px',
              fontFamily: 'inherit',
              cursor: task.status === 'loading' ? 'wait' : 'pointer',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'rgba(59,130,246,0.25)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'rgba(59,130,246,0.15)';
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 2px #3b82f6';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {task.status === 'loading' ? 'Creating...' : 'Create Task'}
          </button>

          <button
            type="button"
            onClick={() => setTaskFormOpen(false)}
            style={{
              padding: '6px 10px',
              border: 'none',
              borderRadius: '4px',
              background: 'transparent',
              color: '#71717a',
              fontSize: '11px',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 2px #3b82f6';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
