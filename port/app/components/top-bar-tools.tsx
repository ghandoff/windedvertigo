"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Play,
  Square,
  Plus,
  UserPlus,
  MessageSquarePlus,
  CheckSquare,
  NotebookPen,
  Mic,
  Loader2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NewContactDialog } from "@/app/components/new-contact-dialog";
import { QuickAddActivity } from "@/app/components/quick-add-activity";
import { NewTaskDialog } from "@/app/components/new-task-dialog";
import { NewMeetingNoteDialog } from "@/app/components/new-meeting-note-dialog";
import { useTimer, formatElapsed } from "@/app/components/timer-context";
import { cn } from "@/lib/utils";

/**
 * TopBarTools — the global workflow toolset.
 *
 * Two icon buttons, always visible in the dashboard header:
 *   - ⏱ timer (opens popover with start/stop + description + save)
 *   - ➕ add menu (contact, activity, task, meeting note)
 *
 * `compact` mode drops the text labels and shows icon-only buttons.
 * Used on narrow viewports (mobile header) where the text labels would
 * crowd out the wordmark.
 */
export function TopBarTools({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <TimerButton compact={compact} />
      <AddMenu compact={compact} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// timer button + popover
// ────────────────────────────────────────────────────────────────

interface ProjectOption {
  id: string;
  project: string;
  status: string;
}

interface MilestoneOption {
  id: string;
  milestone: string;
  projectIds: string[];
}

interface TaskOption {
  id: string;
  task: string;
  projectIds: string[];
  milestoneIds: string[];
}

function TimerButton({ compact = false }: { compact?: boolean }) {
  const timer = useTimer();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pickers for project / milestone / task. Projects load on popover
  // open; milestones + tasks load when a project is picked (and refilter
  // whenever the milestone scope changes).
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneOption[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Fetch projects when popover opens (once).
  useEffect(() => {
    if (!open || projects.length > 0 || projectsLoading) return;
    let cancelled = false;
    setProjectsLoading(true);
    fetch("/api/projects?pageSize=100")
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[] = Array.isArray(payload) ? payload : payload?.data ?? [];
        setProjects(
          rows
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((p: any) => p && p.status !== "complete" && p.status !== "cancelled")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((p: any) => ({ id: p.id, project: p.project, status: p.status })),
        );
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projects.length, projectsLoading]);

  // Fetch milestones + tasks whenever project changes.
  useEffect(() => {
    if (!open || !timer.projectId) {
      setMilestones([]);
      setTasks([]);
      return;
    }
    let cancelled = false;
    setTasksLoading(true);

    const milestonesUrl = `/api/milestones?projectId=${timer.projectId}&pageSize=100`;
    const tasksUrl = `/api/work-items?projectId=${timer.projectId}&archive=false&pageSize=200`;

    Promise.all([
      fetch(milestonesUrl).then((r) => r.json()).catch(() => ({ data: [] })),
      fetch(tasksUrl).then((r) => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([mPayload, tPayload]) => {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mRows: any[] = Array.isArray(mPayload) ? mPayload : mPayload?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tRows: any[] = Array.isArray(tPayload) ? tPayload : tPayload?.data ?? [];
        setMilestones(
          mRows.map((m) => ({
            id: m.id,
            milestone: m.milestone,
            projectIds: m.projectIds ?? [],
          })),
        );
        setTasks(
          tRows
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((t: any) => t.status !== "complete" && t.status !== "cancelled")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((t: any) => ({
              id: t.id,
              task: t.task,
              projectIds: t.projectIds ?? [],
              milestoneIds: t.milestoneIds ?? [],
            })),
        );
      })
      .finally(() => {
        if (!cancelled) setTasksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, timer.projectId]);

  // Tasks narrowed by selected milestone (if any).
  const filteredTasks = timer.milestoneId
    ? tasks.filter((t) => t.milestoneIds.includes(timer.milestoneId!))
    : tasks;

  const canSave =
    !timer.running &&
    timer.elapsed > 0 &&
    !saving &&
    !!timer.projectId &&
    !!timer.taskId;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const result = await timer.save();
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center rounded-md border border-border bg-background font-medium font-mono tabular-nums transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
          compact ? "gap-1.5 px-2 h-8 text-xs" : "gap-2 px-3 h-8 text-xs",
          timer.running && "border-accent text-accent bg-accent/5 hover:bg-accent/10",
        )}
        aria-label={timer.running ? `timer running: ${formatElapsed(timer.elapsed)}` : "start timer"}
      >
        <Clock className="h-4 w-4" aria-hidden="true" />
        {timer.running ? (
          <span>{formatElapsed(timer.elapsed)}</span>
        ) : (
          !compact && <span>timer</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">time tracker</h3>
            <span className="text-xs text-muted-foreground">
              {timer.running ? "running" : timer.elapsed > 0 ? "stopped" : "idle"}
            </span>
          </div>

          <div className="text-center">
            <div className="font-mono text-4xl font-semibold tabular-nums">
              {formatElapsed(timer.elapsed)}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            {!timer.running ? (
              <Button
                size="sm"
                onClick={timer.start}
                className="gap-2"
                aria-label="start timer"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                start
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onClick={timer.stop}
                className="gap-2"
                aria-label="stop timer"
              >
                <Square className="h-4 w-4" aria-hidden="true" />
                stop
              </Button>
            )}
            {timer.elapsed > 0 && !timer.running && (
              <Button
                size="sm"
                variant="ghost"
                onClick={timer.reset}
                aria-label="reset timer"
              >
                reset
              </Button>
            )}
          </div>

          {/*
            Note: we use native <select> elements rather than the shadcn
            Select component here because the Select opens its own
            portalled popover, which conflicts with the outer Timer
            Popover's outside-click handler — clicking the Select closes
            the Timer popover before the dropdown can open. Native
            selects render a browser-native dropdown outside React's
            portal boundary and sidestep the issue entirely.
          */}
          <div className="space-y-2">
            <Label className="text-xs">
              project <span className="text-destructive">*</span>
            </Label>
            <select
              value={timer.projectId ?? ""}
              onChange={(e) => timer.setProjectId(e.target.value || null)}
              disabled={projectsLoading}
              className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50"
            >
              <option value="">
                {projectsLoading ? "loading…" : "— pick a project —"}
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project}
                </option>
              ))}
            </select>
          </div>

          {timer.projectId && (
            <div className="space-y-2">
              <Label className="text-xs">
                milestone <span className="text-muted-foreground">(optional scope)</span>
              </Label>
              <select
                value={timer.milestoneId ?? ""}
                onChange={(e) => timer.setMilestoneId(e.target.value || null)}
                disabled={tasksLoading || milestones.length === 0}
                className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50"
              >
                <option value="">any milestone</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.milestone}
                  </option>
                ))}
              </select>
            </div>
          )}

          {timer.projectId && (
            <div className="space-y-2">
              <Label className="text-xs">
                task <span className="text-destructive">*</span>
              </Label>
              <select
                value={timer.taskId ?? ""}
                onChange={(e) => timer.setTaskId(e.target.value || null)}
                disabled={tasksLoading || filteredTasks.length === 0}
                className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50"
              >
                <option value="">
                  {tasksLoading
                    ? "loading…"
                    : filteredTasks.length === 0
                      ? "no open tasks"
                      : "— pick a task —"}
                </option>
                {filteredTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.task}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="timer-description" className="text-xs">
              what are you working on?
            </Label>
            <Textarea
              id="timer-description"
              value={timer.description}
              onChange={(e) => timer.setDescription(e.target.value)}
              placeholder="e.g., creaseworks onboarding redesign"
              rows={2}
              className="text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={timer.billable}
              onChange={(e) => timer.setBillable(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-muted-foreground">billable</span>
          </label>

          {saveError && (
            <p className="text-xs text-destructive" role="alert">
              couldn&apos;t save: {saveError}
            </p>
          )}

          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                saving…
              </>
            ) : (
              <>log {formatElapsed(timer.elapsed)}</>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ────────────────────────────────────────────────────────────────
// add menu (➕)
// ────────────────────────────────────────────────────────────────
function AddMenu({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [contactOpen, setContactOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [meetingNoteOpen, setMeetingNoteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex items-center rounded-md border border-border bg-background font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
            compact ? "gap-1.5 px-2 h-8 text-xs" : "gap-2 px-3 h-8 text-xs",
          )}
          aria-label="add something new"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {!compact && <span>add</span>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs">add a new…</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setContactOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />
            contact
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActivityOpen(true)}>
            <MessageSquarePlus className="h-4 w-4 mr-2" aria-hidden="true" />
            activity (call / email / note)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTaskOpen(true)}>
            <CheckSquare className="h-4 w-4 mr-2" aria-hidden="true" />
            task
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMeetingNoteOpen(true)}>
            <NotebookPen className="h-4 w-4 mr-2" aria-hidden="true" />
            meeting note
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/transcribe")}>
            <Mic className="h-4 w-4 mr-2" aria-hidden="true" />
            <span className="flex-1">record a meeting</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
              beta
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/*
        NewContactDialog has its own SheetTrigger internally. We render
        it with `open` controlled via a proxy — the component itself
        accepts `externalOpen` and `onExternalOpenChange` props.
      */}
      <NewContactDialog
        externalOpen={contactOpen}
        onExternalOpenChange={setContactOpen}
      />

      <QuickAddActivity
        externalOpen={activityOpen}
        onExternalOpenChange={setActivityOpen}
      />

      <NewTaskDialog
        externalOpen={taskOpen}
        onExternalOpenChange={setTaskOpen}
      />

      <NewMeetingNoteDialog
        externalOpen={meetingNoteOpen}
        onExternalOpenChange={setMeetingNoteOpen}
      />
    </>
  );
}
