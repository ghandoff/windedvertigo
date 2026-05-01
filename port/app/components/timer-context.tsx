"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Global timer state — lives at the dashboard layout level so the
 * timer survives page navigation and is accessible from the top-bar
 * popover, the sidebar running indicator, and anywhere else that
 * needs it.
 *
 * Active state is mirrored to localStorage so closing and reopening
 * the tab resumes the timer.
 */

const STORAGE_KEY = "wv-port-timer-v1";

type TimerState = {
  running: boolean;
  elapsed: number;
  startTimestamp: number | null;
  description: string;
  billable: boolean;
  /** Project the time is logged against — required before save. */
  projectId: string | null;
  /** Optional milestone scope; filters the task picker and, when set,
   *  is attached as additional task context. */
  milestoneId: string | null;
  /** The specific task being worked on — required before save so the
   *  timesheet rolls up through task → project for billable reports. */
  taskId: string | null;
};

const INITIAL: TimerState = {
  running: false,
  elapsed: 0,
  startTimestamp: null,
  description: "",
  billable: true,
  projectId: null,
  milestoneId: null,
  taskId: null,
};

type TimerContextValue = TimerState & {
  start: () => void;
  stop: () => void;
  reset: () => void;
  setDescription: (text: string) => void;
  setBillable: (billable: boolean) => void;
  setProjectId: (projectId: string | null) => void;
  setMilestoneId: (milestoneId: string | null) => void;
  setTaskId: (taskId: string | null) => void;
  save: () => Promise<{ ok: true } | { ok: false; error: string }>;
};

const TimerContext = createContext<TimerContextValue | null>(null);

function loadInitial(): TimerState {
  if (typeof window === "undefined") return INITIAL;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as Partial<TimerState>;
    // If a running timer was persisted, reconstruct elapsed from wall clock
    if (parsed.running && parsed.startTimestamp) {
      const now = Date.now();
      return {
        running: true,
        startTimestamp: parsed.startTimestamp,
        elapsed: Math.floor((now - parsed.startTimestamp) / 1000),
        description: parsed.description ?? "",
        billable: parsed.billable ?? true,
        projectId: parsed.projectId ?? null,
        milestoneId: parsed.milestoneId ?? null,
        taskId: parsed.taskId ?? null,
      };
    }
    return {
      running: false,
      startTimestamp: null,
      elapsed: parsed.elapsed ?? 0,
      description: parsed.description ?? "",
      billable: parsed.billable ?? true,
      projectId: parsed.projectId ?? null,
      milestoneId: parsed.milestoneId ?? null,
      taskId: parsed.taskId ?? null,
    };
  } catch {
    return INITIAL;
  }
}

function persist(s: TimerState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota or disabled — fine */
  }
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TimerState>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // hydrate from localStorage after mount (prevents SSR mismatch)
  useEffect(() => {
    // hydrating from localStorage on mount — the pattern is intentional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadInitial());
    setHydrated(true);
  }, []);

  // tick while running
  useEffect(() => {
    if (!state.running || !state.startTimestamp) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = setInterval(() => {
      setState((s) =>
        s.running && s.startTimestamp
          ? { ...s, elapsed: Math.floor((Date.now() - s.startTimestamp) / 1000) }
          : s,
      );
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [state.running, state.startTimestamp]);

  // persist whenever state changes
  useEffect(() => {
    if (!hydrated) return;
    persist(state);
  }, [hydrated, state]);

  const start = useCallback(() => {
    setState((s) => ({
      ...s,
      running: true,
      startTimestamp: Date.now() - s.elapsed * 1000,
    }));
  }, []);

  const stop = useCallback(() => {
    setState((s) => ({ ...s, running: false, startTimestamp: null }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...INITIAL });
  }, []);

  const setDescription = useCallback((text: string) => {
    setState((s) => ({ ...s, description: text }));
  }, []);

  const setBillable = useCallback((billable: boolean) => {
    setState((s) => ({ ...s, billable }));
  }, []);

  const setProjectId = useCallback((projectId: string | null) => {
    // Changing project invalidates milestone + task selections so we
    // never end up with a task that doesn't belong to the new project.
    setState((s) => ({ ...s, projectId, milestoneId: null, taskId: null }));
  }, []);

  const setMilestoneId = useCallback((milestoneId: string | null) => {
    // Changing milestone clears the task for the same reason.
    setState((s) => ({ ...s, milestoneId, taskId: null }));
  }, []);

  const setTaskId = useCallback((taskId: string | null) => {
    setState((s) => ({ ...s, taskId }));
  }, []);

  const save = useCallback(async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (state.elapsed <= 0) return { ok: false, error: "nothing to save" };
    if (!state.projectId) return { ok: false, error: "pick a project first" };
    if (!state.taskId) return { ok: false, error: "pick a task or milestone-scoped task" };
    const hours = state.elapsed / 3600;
    const today = new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch("/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry: state.description || "time logged",
          hours,
          billable: state.billable,
          status: "draft",
          dateAndTime: { start: today },
          taskIds: state.taskId ? [state.taskId] : undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, error: text || `HTTP ${res.status}` };
      }
      setState({ ...INITIAL });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "unknown error" };
    }
  }, [state.elapsed, state.description, state.billable, state.projectId, state.taskId]);

  return (
    <TimerContext.Provider
      value={{
        ...state,
        start,
        stop,
        reset,
        setDescription,
        setBillable,
        setProjectId,
        setMilestoneId,
        setTaskId,
        save,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return ctx;
}

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}
