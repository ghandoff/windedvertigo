"use client";

/**
 * Inspector panel for a selected element.
 * Shows value slider, connections, and delete button.
 */

import type { PoolElement, Connection, PoolAction, ConnectionType } from "@/lib/types";

interface ElementInspectorProps {
  element: PoolElement;
  connections: Connection[];
  allElements: PoolElement[];
  dispatch: React.Dispatch<PoolAction>;
  onClose: () => void;
}

const TYPE_LABELS: Record<ConnectionType, string> = {
  amplifying: "+ amplifying",
  dampening: "− dampening",
  delayed: "⏱ delayed",
  threshold: "⚡ threshold",
};

export function ElementInspector({
  element,
  connections,
  allElements,
  dispatch,
  onClose,
}: ElementInspectorProps) {
  const incoming = connections.filter((c) => c.to === element.id);
  const outgoing = connections.filter((c) => c.from === element.id);

  const findLabel = (id: string) =>
    allElements.find((e) => e.id === id)?.label ?? id;

  return (
    <div className="w-64 shrink-0 flex flex-col gap-4 overflow-y-auto max-h-full p-4 bg-white/5 rounded-xl border border-white/10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{element.icon}</span>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-on-dark)]">
              {element.label}
            </h3>
            <span className="text-[10px] text-[var(--color-text-on-dark-muted)]">
              {element.category}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)] text-sm"
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>

      {/* Value slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--color-text-on-dark-muted)]">
            value
          </span>
          <span className="text-sm font-bold text-[var(--color-text-on-dark)]">
            {Math.round(element.value)}
          </span>
        </div>
        <input
          type="range"
          min={element.minValue}
          max={element.maxValue}
          step={1}
          value={element.value}
          onChange={(e) =>
            dispatch({
              type: "SET_VALUE",
              id: element.id,
              value: Number(e.target.value),
            })
          }
          className="w-full accent-[var(--wv-sienna)]"
          aria-label={`${element.label} value`}
        />
      </div>

      {/* Connections */}
      {(incoming.length > 0 || outgoing.length > 0) && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-text-on-dark-muted)] tracking-wider">
            connections
          </p>

          {incoming.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-2.5 py-1.5"
            >
              <span className="text-[var(--color-text-on-dark)]">
                {findLabel(conn.from)} → here
              </span>
              <span className="text-[var(--color-text-on-dark-muted)]">
                {TYPE_LABELS[conn.type]}
              </span>
            </div>
          ))}

          {outgoing.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-2.5 py-1.5"
            >
              <span className="text-[var(--color-text-on-dark)]">
                here → {findLabel(conn.to)}
              </span>
              <span className="text-[var(--color-text-on-dark-muted)]">
                {TYPE_LABELS[conn.type]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Delete */}
      <button
        onClick={() => {
          dispatch({ type: "REMOVE_ELEMENT", id: element.id });
          onClose();
        }}
        className="mt-auto px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-all border border-red-500/20"
      >
        remove element
      </button>
    </div>
  );
}
