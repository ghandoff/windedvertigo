"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";

const MAX_HISTORY = 50;

type Snapshot = { id: string; x: number; y: number }[];

type UndoRedoState = {
  canUndo: boolean;
  canRedo: boolean;
  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;
};

export function useUndoRedo(): UndoRedoState {
  const { getNodes, setNodes } = useReactFlow();
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  // refs don't trigger re-renders — bump a counter so canUndo/canRedo stay fresh
  const [, forceUpdate] = useState(0);

  const takeSnapshot = useCallback(() => {
    const snapshot = getNodes().map((n) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
    }));
    pastRef.current = [...pastRef.current.slice(-MAX_HISTORY + 1), snapshot];
    futureRef.current = []; // clear redo stack on new action
    forceUpdate((c) => c + 1);
  }, [getNodes]);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;

    // save current state to future
    const current = getNodes().map((n) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
    }));
    futureRef.current = [...futureRef.current, current];

    // pop last state from past
    const previous = pastRef.current.pop()!;

    // apply
    setNodes((nodes) =>
      nodes.map((n) => {
        const saved = previous.find((s) => s.id === n.id);
        return saved
          ? { ...n, position: { x: saved.x, y: saved.y } }
          : n;
      }),
    );

    forceUpdate((c) => c + 1);
  }, [getNodes, setNodes]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;

    // save current to past
    const current = getNodes().map((n) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
    }));
    pastRef.current = [...pastRef.current, current];

    // pop from future
    const next = futureRef.current.pop()!;

    // apply
    setNodes((nodes) =>
      nodes.map((n) => {
        const saved = next.find((s) => s.id === n.id);
        return saved
          ? { ...n, position: { x: saved.x, y: saved.y } }
          : n;
      }),
    );

    forceUpdate((c) => c + 1);
  }, [getNodes, setNodes]);

  // keyboard shortcuts: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return {
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    takeSnapshot,
    undo,
    redo,
  };
}
