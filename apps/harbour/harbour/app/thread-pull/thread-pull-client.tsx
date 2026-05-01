"use client";

import {
  useState,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import "./thread-pull.css";
import type {
  HCA,
  PCRRating,
  MapSession,
  MapAction,
  Phase,
  NetworkNode,
  NetworkEdge,
  DirectedPair,
} from "./lib/types";
import {
  assignColour,
  assignShape,
  generatePairs,
  minPairsRequired,
  computeEdges,
  computeNodes,
  selectFocusNodes,
  getConnectedLabels,
  edgePath,
  nodeRadius,
} from "./lib/network-math";
import { PRESET_HCAS } from "./lib/presets";

/* ── constants ────────────────────────────────────────────────── */

const SESSION_KEY = "tp-session";
const STRENGTH_OPTIONS = [
  { value: 0, label: "no", size: 0 },
  { value: 1, label: "a little", size: 12 },
  { value: 2, label: "some", size: 20 },
  { value: 4, label: "a lot", size: 28 },
] as const;

const FREQ_LABELS = ["rarely", "sometimes", "often", "daily"] as const;
const FREQ_SIZES = [16, 22, 28, 34] as const;

/* ── CSS variable → hex resolver for SVG export ───────────────── */

const COLOUR_MAP: Record<string, string> = {
  "var(--wv-cornflower)": "#5872cb",
  "var(--wv-seafoam)": "#58cbb2",
  "var(--wv-sienna)": "#cb7858",
  "var(--wv-periwinkle)": "#d5d2ff",
  "var(--wv-redwood)": "#b15043",
  "var(--wv-teal)": "#43b187",
  "var(--wv-navy)": "#436db1",
  "var(--wv-mint)": "#d2fdff",
};

function resolveColour(cssVar: string): string {
  return COLOUR_MAP[cssVar] ?? cssVar;
}

/* ── reducer ─────────────────────────────────────────────────── */

function initialState(): MapSession {
  if (typeof window !== "undefined") {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
  }
  return {
    phase: "intro",
    childName: "",
    hcas: [],
    ratings: [],
    currentPairIndex: 0,
  };
}

function reducer(state: MapSession, action: MapAction): MapSession {
  switch (action.type) {
    case "SET_NAME":
      return { ...state, childName: action.name };

    case "ADD_HCA": {
      const idx = state.hcas.length;
      const hca: HCA = {
        id: crypto.randomUUID(),
        label: action.label.toLowerCase().trim(),
        frequency: action.frequency,
        color: assignColour(idx),
        shape: assignShape(idx),
      };
      return { ...state, hcas: [...state.hcas, hca] };
    }

    case "REMOVE_HCA": {
      const hcas = state.hcas.filter((h) => h.id !== action.id);
      const ratings = state.ratings.filter(
        (r) => r.sourceId !== action.id && r.targetId !== action.id,
      );
      return { ...state, hcas, ratings };
    }

    case "SET_FREQUENCY":
      return {
        ...state,
        hcas: state.hcas.map((h) =>
          h.id === action.id ? { ...h, frequency: action.frequency } : h,
        ),
      };

    case "RATE_PAIR": {
      const existing = state.ratings.findIndex(
        (r) => r.sourceId === action.sourceId && r.targetId === action.targetId,
      );
      const rating: PCRRating = {
        sourceId: action.sourceId,
        targetId: action.targetId,
        strength: action.strength,
      };
      const ratings =
        existing >= 0
          ? state.ratings.map((r, i) => (i === existing ? rating : r))
          : [...state.ratings, rating];
      return { ...state, ratings };
    }

    case "NEXT_PAIR":
      return { ...state, currentPairIndex: state.currentPairIndex + 1 };

    case "SKIP_PAIR":
      return { ...state, currentPairIndex: state.currentPairIndex + 1 };

    case "SET_PHASE":
      return { ...state, phase: action.phase, currentPairIndex: 0 };

    case "RESET":
      return {
        phase: "intro",
        childName: "",
        hcas: [],
        ratings: [],
        currentPairIndex: 0,
      };

    default:
      return state;
  }
}

/* ── hooks ────────────────────────────────────────────────────── */

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

/* ── main component ──────────────────────────────────────────── */

export function ThreadPullClient() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const reducedMotion = useReducedMotion();

  // persist to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  // screen reader live region
  const [announcement, setAnnouncement] = useState("");

  const setPhase = useCallback(
    (phase: Phase) => {
      dispatch({ type: "SET_PHASE", phase });
      const labels: Record<Phase, string> = {
        intro: "welcome",
        input: "name your threads",
        mapping: "how do they connect",
        visualisation: "the map",
        focus: "where to start",
      };
      setAnnouncement(`moved to: ${labels[phase]}`);
    },
    [],
  );

  return (
    <div className="tp-root">
      <a href="/harbour" className="tp-back" aria-label="back to the harbour">
        ← harbour
      </a>

      {state.phase === "intro" && (
        <IntroPhase onBegin={() => setPhase("input")} />
      )}
      {state.phase === "input" && (
        <InputPhase
          state={state}
          dispatch={dispatch}
          onContinue={() => setPhase("mapping")}
        />
      )}
      {state.phase === "mapping" && (
        <MappingPhase
          state={state}
          dispatch={dispatch}
          onDone={() => setPhase("visualisation")}
          onBack={() => setPhase("input")}
        />
      )}
      {state.phase === "visualisation" && (
        <VisualisationPhase
          state={state}
          dispatch={dispatch}
          onFocus={() => setPhase("focus")}
          onBack={() => setPhase("mapping")}
          reducedMotion={reducedMotion}
        />
      )}
      {state.phase === "focus" && (
        <FocusPhase
          state={state}
          dispatch={dispatch}
          onBack={() => setPhase("visualisation")}
          reducedMotion={reducedMotion}
        />
      )}

      {/* screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="tp-sr-only">
        {announcement}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   intro phase — warm on-ramp
   ══════════════════════════════════════════════════════════════════ */

function IntroPhase({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="tp-phase" role="region" aria-label="welcome to thread pull">
      <div className="tp-intro-icon" aria-hidden="true">
        🧶
      </div>
      <div className="tp-title">thread pull</div>
      <div className="tp-subtitle">
        when everything feels tangled, it helps to find the threads that matter
        most. this tool maps how hard things connect — so you know where to
        start.
      </div>
      <button className="tp-btn tp-btn-primary" onClick={onBegin}>
        let&apos;s begin
      </button>
      <div className="tp-intro-note">
        <strong>for practitioners:</strong> this tool is based on network
        analysis research (Galpin, UCL) that identifies central anxiety triggers.
        the child names the things that feel hard, then rates how they connect.
        the map reveals which threads, when eased, may create a cascade of
        relief.
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   phase 1: input — "what feels hard?"
   ══════════════════════════════════════════════════════════════════ */

function InputPhase({
  state,
  dispatch,
  onContinue,
}: {
  state: MapSession;
  dispatch: React.Dispatch<MapAction>;
  onContinue: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [draftFreq, setDraftFreq] = useState(2);
  const [showPresets, setShowPresets] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addHCA = useCallback(() => {
    const label = draft.trim();
    if (!label) return;
    if (state.hcas.some((h) => h.label === label.toLowerCase())) return;
    dispatch({ type: "ADD_HCA", label, frequency: draftFreq });
    setDraft("");
    setDraftFreq(2);
    inputRef.current?.focus();
  }, [draft, draftFreq, dispatch, state.hcas]);

  const addPreset = useCallback(
    (label: string) => {
      if (state.hcas.some((h) => h.label === label.toLowerCase())) return;
      dispatch({ type: "ADD_HCA", label, frequency: 2 });
    },
    [dispatch, state.hcas],
  );

  const canContinue = state.hcas.length >= 3;

  return (
    <div className="tp-phase" role="region" aria-label="name your threads">
      <div className="tp-title">
        {state.childName
          ? `what feels hard for ${state.childName}?`
          : "what feels hard?"}
      </div>
      <div className="tp-subtitle">
        add the things that feel difficult — one at a time. you can pick from
        common ones or type your own.
      </div>

      {/* optional child name */}
      {!state.childName && state.hcas.length === 0 && (
        <input
          className="tp-input tp-name-input"
          type="text"
          placeholder="name (optional)"
          maxLength={40}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = (e.target as HTMLInputElement).value.trim();
              if (val) dispatch({ type: "SET_NAME", name: val });
            }
          }}
          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val) dispatch({ type: "SET_NAME", name: val });
          }}
          aria-label="child's name"
        />
      )}

      {/* frequency selector for draft */}
      {draft.trim() && (
        <div className="tp-freq">
          <span className="tp-freq-label">how often?</span>
          {FREQ_SIZES.map((size, i) => (
            <button
              key={i}
              className="tp-freq-item"
              data-active={draftFreq === i + 1}
              onClick={() => setDraftFreq(i + 1)}
              aria-label={`${FREQ_LABELS[i]} — frequency ${i + 1} of 4`}
              aria-pressed={draftFreq === i + 1}
            >
              <span
                className="tp-freq-dot"
                style={{ width: size, height: size }}
              />
              <span className="tp-freq-text">{FREQ_LABELS[i]}</span>
            </button>
          ))}
        </div>
      )}

      {/* input row */}
      <div className="tp-input-row">
        <input
          ref={inputRef}
          className="tp-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addHCA();
          }}
          placeholder="type something that feels hard…"
          maxLength={60}
          aria-label="type something that feels hard"
        />
        <button
          className="tp-btn tp-btn-primary"
          onClick={addHCA}
          disabled={!draft.trim()}
          aria-label="add thread"
        >
          add
        </button>
      </div>

      {/* preset library */}
      <button
        className="tp-presets-toggle"
        onClick={() => setShowPresets(!showPresets)}
        aria-expanded={showPresets}
      >
        {showPresets ? "hide common threads" : "show common threads"}
      </button>

      {showPresets && (
        <div className="tp-chips" role="list" aria-label="common threads">
          {PRESET_HCAS.map((p) => {
            const added = state.hcas.some(
              (h) => h.label === p.label.toLowerCase(),
            );
            return (
              <button
                key={p.label}
                className={`tp-chip${added ? " tp-chip-added" : ""}`}
                data-selected={added}
                onClick={() => !added && addPreset(p.label)}
                disabled={added}
                role="listitem"
                aria-label={`${p.label}${added ? " (already added)" : ""}`}
              >
                <span>{p.emoji}</span>
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* current HCAs */}
      {state.hcas.length > 0 && (
        <div className="tp-chips" role="list" aria-label="your threads">
          {state.hcas.map((hca) => (
            <div key={hca.id} className="tp-chip" role="listitem">
              <span
                className="tp-chip-dot"
                style={{ background: hca.color }}
              />
              <span>{hca.label}</span>
              {/* frequency dots inline with labels */}
              <span className="tp-chip-freq">
                {[1, 2, 3, 4].map((f) => (
                  <button
                    key={f}
                    className="tp-freq-dot-inline"
                    data-active={hca.frequency >= f}
                    style={{ width: 8 + f * 3, height: 8 + f * 3 }}
                    onClick={() =>
                      dispatch({
                        type: "SET_FREQUENCY",
                        id: hca.id,
                        frequency: f,
                      })
                    }
                    aria-label={`set ${hca.label} frequency to ${FREQ_LABELS[f - 1]}`}
                  />
                ))}
              </span>
              <button
                className="tp-chip-remove"
                onClick={() => dispatch({ type: "REMOVE_HCA", id: hca.id })}
                aria-label={`remove ${hca.label}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* continue */}
      <button
        className="tp-btn tp-btn-primary"
        onClick={onContinue}
        disabled={!canContinue}
        aria-label={
          canContinue
            ? "continue to connect threads"
            : `add at least ${3 - state.hcas.length} more ${3 - state.hcas.length === 1 ? "thread" : "threads"}`
        }
      >
        {canContinue
          ? "connect them →"
          : `add ${3 - state.hcas.length} more to continue`}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   phase 2: mapping — "how do they connect?"
   ══════════════════════════════════════════════════════════════════ */

function MappingPhase({
  state,
  dispatch,
  onDone,
  onBack,
}: {
  state: MapSession;
  dispatch: React.Dispatch<MapAction>;
  onDone: () => void;
  onBack: () => void;
}) {
  const pairs = useMemo(() => generatePairs(state.hcas), [state.hcas]);
  const totalPairs = pairs.length;
  const currentIdx = state.currentPairIndex;
  const minRequired = minPairsRequired(state.hcas.length);
  const canExit = currentIdx >= minRequired;
  const isDone = currentIdx >= totalPairs;

  // auto-advance when all pairs are rated
  useEffect(() => {
    if (isDone) onDone();
  }, [isDone, onDone]);

  if (isDone) return null;

  const pair = pairs[currentIdx];
  const source = state.hcas.find((h) => h.id === pair.sourceId)!;
  const target = state.hcas.find((h) => h.id === pair.targetId)!;

  // check if this pair has already been rated (e.g. from sessionStorage restore)
  const existingRating = state.ratings.find(
    (r) => r.sourceId === pair.sourceId && r.targetId === pair.targetId,
  );

  const ratePair = (strength: number) => {
    dispatch({
      type: "RATE_PAIR",
      sourceId: pair.sourceId,
      targetId: pair.targetId,
      strength,
    });
    dispatch({ type: "NEXT_PAIR" });
  };

  const progressPct = totalPairs > 0 ? (currentIdx / totalPairs) * 100 : 0;

  return (
    <div className="tp-phase" role="region" aria-label="connect threads">
      <div className="tp-title">how do they connect?</div>

      <div className="tp-pair">
        {/* the two nodes */}
        <div className="tp-pair-nodes">
          <div className="tp-pair-node">
            <div
              className="tp-pair-bubble"
              style={{ background: source.color }}
              aria-hidden="true"
            />
            <span className="tp-pair-label">{source.label}</span>
          </div>

          <span className="tp-pair-arrow" aria-hidden="true">
            →
          </span>

          <div className="tp-pair-node">
            <div
              className="tp-pair-bubble"
              style={{ background: target.color }}
              aria-hidden="true"
            />
            <span className="tp-pair-label">{target.label}</span>
          </div>
        </div>

        {/* question — simplified language */}
        <p className="tp-pair-question">
          when <strong>{source.label}</strong> is hard, does{" "}
          <strong>{target.label}</strong> get harder too?
        </p>

        {/* strength selector */}
        <div
          className="tp-strength"
          role="radiogroup"
          aria-label="how much does this thread pull on the other"
        >
          {STRENGTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className="tp-strength-btn"
              data-selected={existingRating?.strength === opt.value}
              onClick={() => ratePair(opt.value)}
              role="radio"
              aria-checked={existingRating?.strength === opt.value}
              aria-label={opt.label}
            >
              {opt.size > 0 ? (
                <span
                  className="tp-strength-ring"
                  style={{ width: opt.size, height: opt.size }}
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="tp-strength-ring tp-strength-ring-empty"
                  style={{ width: 10, height: 10 }}
                  aria-hidden="true"
                />
              )}
              <span className="tp-strength-label">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* controls */}
        <div className="tp-bottom-controls">
          <button className="tp-btn tp-btn-ghost" onClick={onBack}>
            ← back
          </button>
          <button
            className="tp-btn tp-btn-ghost"
            onClick={() => dispatch({ type: "SKIP_PAIR" })}
          >
            skip
          </button>
          {canExit && (
            <button className="tp-btn tp-btn-secondary" onClick={onDone}>
              show the map →
            </button>
          )}
        </div>
      </div>

      {/* progress bar + fraction */}
      <div className="tp-progress-wrap">
        <div
          className="tp-progress-bar-wrap"
          role="progressbar"
          aria-valuenow={currentIdx}
          aria-valuemin={0}
          aria-valuemax={totalPairs}
          aria-label={`${currentIdx} of ${totalPairs} connections rated`}
        >
          <div
            className="tp-progress-bar"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="tp-progress-text">
          {currentIdx} of {totalPairs}
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   phase 3: visualisation — "the map"
   ══════════════════════════════════════════════════════════════════ */

function VisualisationPhase({
  state,
  dispatch,
  onFocus,
  onBack,
  reducedMotion,
}: {
  state: MapSession;
  dispatch: React.Dispatch<MapAction>;
  onFocus: () => void;
  onBack: () => void;
  reducedMotion: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 400 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(true);

  // measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setDims({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const edges = useMemo(() => computeEdges(state.ratings), [state.ratings]);
  const nodes = useMemo(
    () => computeNodes(state.hcas, edges, dims.w, dims.h),
    [state.hcas, edges, dims.w, dims.h],
  );
  const focusIds = useMemo(() => selectFocusNodes(nodes), [nodes]);

  // build node position map for edge rendering
  const posMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const n of nodes) m.set(n.hca.id, { x: n.x, y: n.y });
    return m;
  }, [nodes]);

  // selected node detail
  const selectedNode = selectedId
    ? nodes.find((n) => n.hca.id === selectedId) ?? null
    : null;

  // always show labels — halo stroke makes them readable over nodes

  return (
    <div className="tp-phase tp-phase-graph" role="region" aria-label="thread map">
      <div className="tp-graph-wrap" ref={containerRef}>
        <svg
          className="tp-graph-svg"
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          role="img"
          aria-label={`thread map showing ${nodes.length} threads. ${
            focusIds.length > 0
              ? `the most central thread is ${nodes.find((n) => n.hca.id === focusIds[0])?.hca.label ?? "unknown"}`
              : ""
          }`}
        >
          <defs>
            {/* gradient definitions for edge direction */}
            {edges.map((edge) => {
              const src = posMap.get(edge.sourceId);
              const tgt = posMap.get(edge.targetId);
              if (!src || !tgt) return null;
              const srcNode = nodes.find((n) => n.hca.id === edge.sourceId);
              return (
                <linearGradient
                  key={`g-${edge.sourceId}-${edge.targetId}`}
                  id={`g-${edge.sourceId}-${edge.targetId}`}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor={resolveColour(srcNode?.hca.color ?? "#fff")} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={resolveColour(srcNode?.hca.color ?? "#fff")} stopOpacity={0.1} />
                </linearGradient>
              );
            })}
          </defs>

          {/* edges */}
          {edges.map((edge) => {
            const src = posMap.get(edge.sourceId);
            const tgt = posMap.get(edge.targetId);
            if (!src || !tgt) return null;
            const dimmed =
              selectedId !== null &&
              edge.sourceId !== selectedId &&
              edge.targetId !== selectedId;
            return (
              <path
                key={`e-${edge.sourceId}-${edge.targetId}`}
                className="tp-graph-edge"
                d={edgePath(src.x, src.y, tgt.x, tgt.y)}
                stroke={`url(#g-${edge.sourceId}-${edge.targetId})`}
                strokeWidth={1 + edge.strength * 0.8}
                opacity={dimmed ? 0.05 : 0.5}
              />
            );
          })}

          {/* nodes */}
          {nodes.map((node) => {
            const r = nodeRadius(node.centrality);
            const isFocus = focusIds.includes(node.hca.id);
            const isSelected = node.hca.id === selectedId;
            const dimmed =
              selectedId !== null && !isSelected &&
              !edges.some(
                (e) =>
                  (e.sourceId === selectedId && e.targetId === node.hca.id) ||
                  (e.targetId === selectedId && e.sourceId === node.hca.id),
              );
            return (
              <g
                key={node.hca.id}
                className="tp-graph-node"
                onClick={() =>
                  setSelectedId(isSelected ? null : node.hca.id)
                }
                opacity={dimmed ? 0.2 : 1}
                role="button"
                tabIndex={0}
                aria-label={`${node.hca.label}, pushes on ${node.outStrength} strength to other threads, receives ${node.inStrength} from others`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(isSelected ? null : node.hca.id);
                  }
                }}
              >
                {/* glow ring for central nodes */}
                {isFocus && !reducedMotion && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r + 8}
                    fill="none"
                    stroke={resolveColour(node.hca.color)}
                    strokeWidth={3}
                    className="tp-glow-ring"
                  />
                )}
                {isFocus && reducedMotion && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r + 8}
                    fill="none"
                    stroke={resolveColour(node.hca.color)}
                    strokeWidth={3}
                    opacity={0.5}
                  />
                )}

                {/* main node */}
                <NodeShape
                  shape={node.hca.shape}
                  x={node.x}
                  y={node.y}
                  r={r}
                  fill={resolveColour(node.hca.color)}
                />

                {/* label */}
                <text
                  x={node.x}
                  y={node.y + r + 16}
                  className="tp-graph-node-label"
                >
                  {truncate(node.hca.label, 18)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* node detail panel (on tap) */}
        {selectedNode && (
          <div className="tp-node-detail" role="status">
            <strong>{selectedNode.hca.label}</strong>
            <span>
              pushes on {selectedNode.outStrength} · receives{" "}
              {selectedNode.inStrength}
            </span>
          </div>
        )}

        {/* legend overlay */}
        {showLegend && (
          <div className="tp-legend">
            the bigger a thread-bubble, the more it pulls on other threads. the
            glowing ones are where things start.
            <button
              className="tp-legend-dismiss"
              onClick={() => setShowLegend(false)}
            >
              got it
            </button>
          </div>
        )}
      </div>

      {/* controls */}
      <div className="tp-bottom-controls">
        <button className="tp-btn tp-btn-ghost" onClick={onBack}>
          ← back
        </button>
        <button className="tp-btn tp-btn-primary" onClick={onFocus}>
          where to start →
        </button>
      </div>
    </div>
  );
}

/* ── node shape renderer ─────────────────────────────────────── */

function NodeShape({
  shape,
  x,
  y,
  r,
  fill,
}: {
  shape: HCA["shape"];
  x: number;
  y: number;
  r: number;
  fill: string;
}) {
  switch (shape) {
    case "square":
      return (
        <rect
          x={x - r * 0.8}
          y={y - r * 0.8}
          width={r * 1.6}
          height={r * 1.6}
          rx={4}
          fill={fill}
          opacity={0.85}
        />
      );
    case "diamond":
      return (
        <rect
          x={x - r * 0.7}
          y={y - r * 0.7}
          width={r * 1.4}
          height={r * 1.4}
          rx={3}
          fill={fill}
          opacity={0.85}
          transform={`rotate(45 ${x} ${y})`}
        />
      );
    case "triangle": {
      const h = r * 1.6;
      const pts = [
        `${x},${y - r}`,
        `${x - h / 2},${y + r * 0.6}`,
        `${x + h / 2},${y + r * 0.6}`,
      ].join(" ");
      return <polygon points={pts} fill={fill} opacity={0.85} />;
    }
    case "hexagon": {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        return `${x + r * Math.cos(angle)},${y + r * Math.sin(angle)}`;
      }).join(" ");
      return <polygon points={pts} fill={fill} opacity={0.85} />;
    }
    case "star": {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.5;
        return `${x + rad * Math.cos(angle)},${y + rad * Math.sin(angle)}`;
      }).join(" ");
      return <polygon points={pts} fill={fill} opacity={0.85} />;
    }
    default:
      return <circle cx={x} cy={y} r={r} fill={fill} opacity={0.85} />;
  }
}

/* ══════════════════════════════════════════════════════════════════
   phase 4: focus — "where to start"
   ══════════════════════════════════════════════════════════════════ */

function FocusPhase({
  state,
  dispatch,
  onBack,
  reducedMotion,
}: {
  state: MapSession;
  dispatch: React.Dispatch<MapAction>;
  onBack: () => void;
  reducedMotion: boolean;
}) {
  const edges = useMemo(() => computeEdges(state.ratings), [state.ratings]);
  const nodes = useMemo(
    () => computeNodes(state.hcas, edges, 400, 400),
    [state.hcas, edges],
  );
  const focusIds = useMemo(() => selectFocusNodes(nodes), [nodes]);
  const focusNodes = nodes.filter((n) => focusIds.includes(n.hca.id));

  return (
    <div className="tp-phase" role="region" aria-label="where to start">
      <div className="tp-title">where to start</div>
      <div className="tp-subtitle">
        {focusNodes.length === 1
          ? "this thread pulls on the most others. easing it may create a cascade of relief."
          : `these ${focusNodes.length} threads pull on the most others. start here.`}
      </div>

      <div className="tp-focus-wrap">
        {/* focus cards — the primary interface */}
        <div className="tp-focus-cards">
          {focusNodes.map((node) => {
            const connected = getConnectedLabels(
              node.hca.id,
              edges,
              state.hcas,
            );
            return (
              <div key={node.hca.id} className="tp-focus-card">
                <div className="tp-focus-card-header">
                  <div
                    className="tp-focus-card-node"
                    style={{ background: resolveColour(node.hca.color) }}
                    aria-hidden="true"
                  />
                  <div>
                    <div className="tp-focus-card-label">{node.hca.label}</div>
                    <div className="tp-focus-card-stat">
                      pulls on {connected.length}{" "}
                      {connected.length === 1 ? "thread" : "threads"}
                    </div>
                  </div>
                </div>
                {connected.length > 0 && (
                  <div className="tp-focus-card-cascade">
                    if we can ease this one, it may help with{" "}
                    {connected.slice(0, 4).join(", ")}
                    {connected.length > 4 && `, and ${connected.length - 4} more`}
                  </div>
                )}
                {connected.length > 0 && (
                  <div className="tp-focus-card-threads">
                    {connected.map((label) => (
                      <span key={label} className="tp-focus-card-thread-chip">
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* actions */}
        <div className="tp-focus-actions">
          <button className="tp-btn tp-btn-ghost" onClick={onBack}>
            ← back to map
          </button>
          <button
            className="tp-btn tp-btn-ghost"
            onClick={() => dispatch({ type: "RESET" })}
          >
            start fresh
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── utils ────────────────────────────────────────────────────── */

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}
