"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

const LS_PREFIX = "wv-a11y-";

const KEYS = [
  "textLg",
  "highContrast",
  "wideSpacing",
  "dyslexiaFont",
  "highlightLinks",
  "bigCursor",
  "readingGuide",
  "grayscale",
] as const;

type Key = (typeof KEYS)[number];

// Maps each toggle to the html data-attribute name it sets
const ATTR: Record<Key, string> = {
  textLg:         "text-lg",
  highContrast:   "high-contrast",
  wideSpacing:    "wide-spacing",
  dyslexiaFont:   "dyslexia-font",
  highlightLinks: "highlight-links",
  bigCursor:      "big-cursor",
  readingGuide:   "reading-guide",
  grayscale:      "grayscale",
};

type A11yState = Record<Key, boolean>;

interface A11yCtx extends A11yState {
  toggle: (key: Key) => void;
  resetAll: () => void;
}

const Ctx = createContext<A11yCtx>({
  textLg: false, highContrast: false, wideSpacing: false, dyslexiaFont: false,
  highlightLinks: false, bigCursor: false, readingGuide: false, grayscale: false,
  toggle: () => {}, resetAll: () => {},
});

function readStored(): A11yState {
  const state = {} as A11yState;
  for (const key of KEYS) {
    state[key] = localStorage.getItem(`${LS_PREFIX}${key}`) === "1";
  }
  return state;
}

function applyAttr(key: Key, active: boolean): void {
  if (active) {
    document.documentElement.dataset[ATTR[key].replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = "";
  } else {
    delete document.documentElement.dataset[ATTR[key].replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())];
  }
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<A11yState>(() => ({
    textLg: false, highContrast: false, wideSpacing: false, dyslexiaFont: false,
    highlightLinks: false, bigCursor: false, readingGuide: false, grayscale: false,
  }));

  const guideRef = useRef<HTMLDivElement | null>(null);
  const guideMoveRef = useRef<((e: MouseEvent) => void) | null>(null);

  // Sync reading guide div with state
  useEffect(() => {
    if (state.readingGuide) {
      if (!guideRef.current) {
        const div = document.createElement("div");
        div.className = "a11y-reading-guide";
        div.setAttribute("aria-hidden", "true");
        document.body.appendChild(div);
        guideRef.current = div;
        const move = (e: MouseEvent) => {
          if (guideRef.current) guideRef.current.style.top = `${e.clientY}px`;
        };
        guideMoveRef.current = move;
        window.addEventListener("mousemove", move);
      }
    } else {
      if (guideRef.current) {
        guideRef.current.remove();
        guideRef.current = null;
      }
      if (guideMoveRef.current) {
        window.removeEventListener("mousemove", guideMoveRef.current);
        guideMoveRef.current = null;
      }
    }
  }, [state.readingGuide]);

  // On mount: restore from localStorage and apply html attributes
  useEffect(() => {
    const stored = readStored();
    setState(stored);
    for (const key of KEYS) {
      applyAttr(key, stored[key]);
    }
  }, []);

  const toggle = useCallback((key: Key) => {
    setState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(`${LS_PREFIX}${key}`, next[key] ? "1" : "0");
      applyAttr(key, next[key]);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    for (const key of KEYS) {
      localStorage.setItem(`${LS_PREFIX}${key}`, "0");
      applyAttr(key, false);
    }
    setState({
      textLg: false, highContrast: false, wideSpacing: false, dyslexiaFont: false,
      highlightLinks: false, bigCursor: false, readingGuide: false, grayscale: false,
    });
  }, []);

  return (
    <Ctx.Provider value={{ ...state, toggle, resetAll }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAccessibility(): A11yCtx {
  return useContext(Ctx);
}
