"use client";

/**
 * tidal.pool — simulation state hook
 *
 * Wraps the pure simulation engine in a React reducer
 * and manages the animation loop.
 */

import { useReducer, useCallback, useEffect, useRef } from "react";
import type {
  PoolState,
  PoolAction,
  PoolElement,
  Connection,
  PaletteItem,
} from "@/lib/types";
import { simulateTick, isEquilibrium, createEmptyPool } from "@/lib/simulation";

// ── reducer ─────────────────────────────────────────────────

function poolReducer(state: PoolState, action: PoolAction): PoolState {
  switch (action.type) {
    case "ADD_ELEMENT":
      return { ...state, elements: [...state.elements, action.element] };

    case "REMOVE_ELEMENT":
      return {
        ...state,
        elements: state.elements.filter((e) => e.id !== action.id),
        connections: state.connections.filter(
          (c) => c.from !== action.id && c.to !== action.id,
        ),
      };

    case "MOVE_ELEMENT":
      return {
        ...state,
        elements: state.elements.map((e) =>
          e.id === action.id ? { ...e, x: action.x, y: action.y } : e,
        ),
      };

    case "SET_VALUE":
      return {
        ...state,
        elements: state.elements.map((e) =>
          e.id === action.id
            ? {
                ...e,
                value: Math.max(e.minValue, Math.min(e.maxValue, action.value)),
              }
            : e,
        ),
      };

    case "ADD_CONNECTION":
      return {
        ...state,
        connections: [...state.connections, action.connection],
      };

    case "REMOVE_CONNECTION":
      return {
        ...state,
        connections: state.connections.filter((c) => c.id !== action.id),
      };

    case "TICK":
      return simulateTick(state);

    case "PLAY":
      return { ...state, playing: true };

    case "PAUSE":
      return { ...state, playing: false };

    case "SET_SPEED":
      return { ...state, speed: action.speed };

    case "RESET":
      return createEmptyPool();

    case "LOAD_SCENARIO":
      return {
        ...createEmptyPool(),
        elements: action.scenario.elements,
        connections: action.scenario.connections,
      };

    case "FIT_TO_CANVAS": {
      // Re-centre elements to fit within the actual canvas dimensions
      const els = state.elements;
      if (els.length === 0) return state;

      const margin = 50; // px padding from edge
      const minX = Math.min(...els.map((e) => e.x));
      const maxX = Math.max(...els.map((e) => e.x));
      const minY = Math.min(...els.map((e) => e.y));
      const maxY = Math.max(...els.map((e) => e.y));

      const contentW = maxX - minX || 1;
      const contentH = maxY - minY || 1;
      const contentCX = (minX + maxX) / 2;
      const contentCY = (minY + maxY) / 2;

      const canvasCX = action.width / 2;
      const canvasCY = action.height / 2;

      // Scale down if content overflows, but never scale up
      const scaleX = (action.width - margin * 2) / contentW;
      const scaleY = (action.height - margin * 2) / contentH;
      const scale = Math.min(scaleX, scaleY, 1);

      return {
        ...state,
        elements: els.map((e) => ({
          ...e,
          x: canvasCX + (e.x - contentCX) * scale,
          y: canvasCY + (e.y - contentCY) * scale,
        })),
      };
    }

    default:
      return state;
  }
}

// ── hook ────────────────────────────────────────────────────

export function useSimulation(initialState?: Partial<PoolState>) {
  const [state, dispatch] = useReducer(poolReducer, {
    ...createEmptyPool(),
    ...initialState,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Animation loop
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    if (!state.playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tickInterval = 1000 / state.speed; // ms per tick

    function loop(timestamp: number) {
      if (timestamp - lastTickRef.current >= tickInterval) {
        // Auto-pause on equilibrium
        if (isEquilibrium(stateRef.current)) {
          dispatch({ type: "PAUSE" });
          return;
        }

        dispatch({ type: "TICK" });
        lastTickRef.current = timestamp;
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [state.playing, state.speed]);

  // ── convenience methods ─────────────────────────────────

  const nextId = useRef(0);

  const addElementFromPalette = useCallback(
    (item: PaletteItem, x: number, y: number) => {
      const id = `${item.slug}-${++nextId.current}`;
      const element: PoolElement = {
        id,
        slug: item.slug,
        label: item.label,
        icon: item.icon,
        category: item.category,
        value: item.defaultValue,
        minValue: 0,
        maxValue: 100,
        x,
        y,
        color: item.color,
      };
      dispatch({ type: "ADD_ELEMENT", element });
      return id;
    },
    [],
  );

  const addConnection = useCallback(
    (
      fromId: string,
      toId: string,
      type: Connection["type"] = "amplifying",
      strength = 0.5,
    ) => {
      const id = `conn-${++nextId.current}`;
      const connection: Connection = {
        id,
        from: fromId,
        to: toId,
        type,
        strength,
        delay: type === "delayed" ? 3 : 0,
        threshold: type === "threshold" ? 50 : 0,
      };
      dispatch({ type: "ADD_CONNECTION", connection });
      return id;
    },
    [],
  );

  return {
    state,
    dispatch,
    addElementFromPalette,
    addConnection,
  };
}
