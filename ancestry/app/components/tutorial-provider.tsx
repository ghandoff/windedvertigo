"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

const STORAGE_KEY = "wv-ancestry-tutorial";

type TutorialState = {
  tourComplete: boolean;
  hintsShown: Record<string, boolean>;
  helpLevel: "minimal" | "standard" | "guided";
};

const DEFAULT_STATE: TutorialState = {
  tourComplete: false,
  hintsShown: {},
  helpLevel: "standard",
};

type TutorialContextValue = {
  state: TutorialState;
  tourRunning: boolean;
  startTour: () => void;
  stopTour: () => void;
  completeTour: () => void;
  resetTour: () => void;
  markHintShown: (key: string) => void;
  hasSeenHint: (key: string) => boolean;
  setHelpLevel: (level: TutorialState["helpLevel"]) => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

function loadState(): TutorialState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_STATE;
}

function saveState(state: TutorialState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TutorialState>(DEFAULT_STATE);
  const [tourRunning, setTourRunning] = useState(false);
  const [mounted, setMounted] = useState(false);

  // load from localStorage on mount
  useEffect(() => {
    setState(loadState());
    setMounted(true);
  }, []);

  // auto-start tour for first-time users (after a delay to let the UI settle)
  useEffect(() => {
    if (!mounted) return;
    if (state.tourComplete) return;

    const timer = setTimeout(() => {
      // only auto-start if there are person nodes on the page (tree has data)
      const hasNodes = document.querySelector(".react-flow__node");
      if (hasNodes) {
        setTourRunning(true);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [mounted, state.tourComplete]);

  const persist = useCallback((next: TutorialState) => {
    setState(next);
    saveState(next);
  }, []);

  const startTour = useCallback(() => setTourRunning(true), []);
  const stopTour = useCallback(() => setTourRunning(false), []);

  const completeTour = useCallback(() => {
    setTourRunning(false);
    persist({ ...state, tourComplete: true });
  }, [state, persist]);

  const resetTour = useCallback(() => {
    const next = { ...state, tourComplete: false };
    persist(next);
    setTourRunning(true);
  }, [state, persist]);

  const markHintShown = useCallback(
    (key: string) => {
      if (state.hintsShown[key]) return;
      persist({ ...state, hintsShown: { ...state.hintsShown, [key]: true } });
    },
    [state, persist],
  );

  const hasSeenHint = useCallback(
    (key: string) => !!state.hintsShown[key],
    [state.hintsShown],
  );

  const setHelpLevel = useCallback(
    (level: TutorialState["helpLevel"]) => {
      persist({ ...state, helpLevel: level });
    },
    [state, persist],
  );

  return (
    <TutorialContext.Provider
      value={{
        state,
        tourRunning,
        startTour,
        stopTour,
        completeTour,
        resetTour,
        markHintShown,
        hasSeenHint,
        setHelpLevel,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
}
