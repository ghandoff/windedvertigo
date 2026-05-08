"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { Skill, SkillSet, SkillType } from "@/lib/holistic-skills-data";
import styles from "./framework.module.css";

// ── selection state ───────────────────────────────────────

type SelectionState =
  | { kind: "none" }
  | { kind: "skill"; id: string }
  | { kind: "sets"; ids: string[] };

type SelectionAction =
  | { type: "click_skill"; id: string }
  | { type: "click_set"; id: string; multi: boolean }
  | { type: "clear" }
  | { type: "hydrate"; state: SelectionState };

function selectionReducer(
  state: SelectionState,
  action: SelectionAction,
): SelectionState {
  switch (action.type) {
    case "click_skill":
      return state.kind === "skill" && state.id === action.id
        ? { kind: "none" }
        : { kind: "skill", id: action.id };

    case "click_set": {
      // multi-click extends/toggles when already in sets mode
      if (action.multi && state.kind === "sets") {
        const has = state.ids.includes(action.id);
        const next = has
          ? state.ids.filter((i) => i !== action.id)
          : [...state.ids, action.id];
        return next.length === 0 ? { kind: "none" } : { kind: "sets", ids: next };
      }
      // clicking the only-selected set deselects it
      if (
        !action.multi &&
        state.kind === "sets" &&
        state.ids.length === 1 &&
        state.ids[0] === action.id
      ) {
        return { kind: "none" };
      }
      return { kind: "sets", ids: [action.id] };
    }

    case "clear":
      return { kind: "none" };

    case "hydrate":
      return action.state;
  }
}

function parseHash(hash: string): SelectionState {
  const m = hash.replace(/^#/, "");
  if (!m) return { kind: "none" };
  const [kind, payload] = m.split("=");
  if (!payload) return { kind: "none" };
  if (kind === "skill") return { kind: "skill", id: payload };
  if (kind === "sets") {
    const ids = payload.split(",").filter(Boolean);
    return ids.length === 0 ? { kind: "none" } : { kind: "sets", ids };
  }
  if (kind === "set") return { kind: "sets", ids: [payload] }; // legacy
  return { kind: "none" };
}

function selectionToHash(state: SelectionState): string {
  if (state.kind === "none") return "";
  if (state.kind === "skill") return `#skill=${state.id}`;
  return `#sets=${state.ids.join(",")}`;
}

type TypeMeta = Record<
  SkillType,
  { label: string; bg: string; text: string; description: string }
>;

const TYPE_ORDER: SkillType[] = ["cognitive", "social", "behavioral"];
type ViewMode = "list" | "graph" | "radial";

// ── main page component ────────────────────────────────────

export function FrameworkPage({
  skills,
  skillSets,
  typeMeta,
}: {
  skills: Skill[];
  skillSets: SkillSet[];
  typeMeta: TypeMeta;
}) {
  const [selection, dispatch] = useReducer(selectionReducer, { kind: "none" });
  const [view, setView] = useState<ViewMode>("list");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  // ref to the element that opened the drawer, so we can return focus on close
  const drawerTriggerRef = useRef<HTMLElement | null>(null);

  // when leaving compare mode, collapse multi-set selection to just the first
  useEffect(() => {
    if (
      !compareMode &&
      selection.kind === "sets" &&
      selection.ids.length > 1
    ) {
      dispatch({
        type: "hydrate",
        state: { kind: "sets", ids: [selection.ids[0]] },
      });
    }
  }, [compareMode, selection]);

  // hash sync ─────────────────────────────────────────────
  useEffect(() => {
    const hydrate = () =>
      dispatch({ type: "hydrate", state: parseHash(window.location.hash) });
    hydrate();
    window.addEventListener("hashchange", hydrate);
    return () => window.removeEventListener("hashchange", hydrate);
  }, []);

  useEffect(() => {
    const next = selectionToHash(selection);
    if (window.location.hash !== next) {
      const url = `${window.location.pathname}${window.location.search}${next}`;
      window.history.replaceState(null, "", url);
    }
  }, [selection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (drawerOpen) setDrawerOpen(false);
        else dispatch({ type: "clear" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // lookup maps ───────────────────────────────────────────
  const skillById = useMemo(() => {
    const m = new Map<string, Skill>();
    skills.forEach((s) => m.set(s.id, s));
    return m;
  }, [skills]);

  const setById = useMemo(() => {
    const m = new Map<string, SkillSet>();
    skillSets.forEach((s) => m.set(s.id, s));
    return m;
  }, [skillSets]);

  const skillsBySetId = useMemo(() => {
    const m = new Map<string, Skill[]>();
    skillSets.forEach((s) => m.set(s.id, []));
    skills.forEach((sk) => {
      sk.skillSetIds.forEach((sid) => {
        const arr = m.get(sid);
        if (arr) arr.push(sk);
      });
    });
    return m;
  }, [skills, skillSets]);

  const totalConnections = useMemo(
    () => skills.reduce((acc, s) => acc + s.skillSetIds.length, 0),
    [skills],
  );

  const avgSetsPerSkill = useMemo(
    () => (skills.length === 0 ? 0 : totalConnections / skills.length),
    [skills.length, totalConnections],
  );

  // derive highlight sets ────────────────────────────────
  const { highlightedSkillIds, highlightedSetIds, comparisonSkillIds } = useMemo(() => {
    if (selection.kind === "none") {
      return {
        highlightedSkillIds: null,
        highlightedSetIds: null,
        comparisonSkillIds: null,
      } as {
        highlightedSkillIds: Set<string> | null;
        highlightedSetIds: Set<string> | null;
        comparisonSkillIds: Set<string> | null;
      };
    }

    if (selection.kind === "skill") {
      const sk = skillById.get(selection.id);
      return {
        highlightedSkillIds: new Set([selection.id]),
        highlightedSetIds: new Set(sk?.skillSetIds ?? []),
        comparisonSkillIds: null,
      };
    }

    // selection.kind === "sets"
    const ids = selection.ids;
    if (ids.length === 1) {
      const setSkills = skillsBySetId.get(ids[0]) ?? [];
      return {
        highlightedSkillIds: new Set(setSkills.map((s) => s.id)),
        highlightedSetIds: new Set(ids),
        comparisonSkillIds: null,
      };
    }
    // intersection of all selected sets
    const skillSetsArr = ids.map((id) => skillsBySetId.get(id) ?? []);
    const baseIds = new Set(skillSetsArr[0]?.map((s) => s.id) ?? []);
    for (let i = 1; i < skillSetsArr.length; i++) {
      const next = new Set(skillSetsArr[i].map((s) => s.id));
      for (const id of baseIds) if (!next.has(id)) baseIds.delete(id);
    }
    return {
      highlightedSkillIds: baseIds,
      highlightedSetIds: new Set(ids),
      comparisonSkillIds: baseIds,
    };
  }, [selection, skillById, skillsBySetId]);

  // handlers ─────────────────────────────────────────────
  const onClickSkill = useCallback((id: string) => {
    dispatch({ type: "click_skill", id });
  }, []);

  const onClickSet = useCallback(
    (id: string, modifierKey: boolean) => {
      // compare mode OR a held modifier key both activate multi-select
      dispatch({ type: "click_set", id, multi: compareMode || modifierKey });
    },
    [compareMode],
  );

  const onClear = useCallback(() => {
    dispatch({ type: "clear" });
  }, []);

  const onOpenDrawer = useCallback((triggerEl?: HTMLElement | null) => {
    if (triggerEl) drawerTriggerRef.current = triggerEl;
    setDrawerOpen(true);
  }, []);

  const onCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    // return focus to whatever opened the drawer
    queueMicrotask(() => {
      drawerTriggerRef.current?.focus();
      drawerTriggerRef.current = null;
    });
  }, []);

  const hasSelection = selection.kind !== "none";
  const isComparing = selection.kind === "sets" && selection.ids.length >= 2;

  // concise screen-reader announcement (separate from the visible summary,
  // which contains too much content to read aloud on every change)
  const announcement = useMemo(() => {
    if (selection.kind === "none") return "";
    if (selection.kind === "skill") {
      const sk = skillById.get(selection.id);
      if (!sk) return "";
      const n = sk.skillSetIds.length;
      return `selected ${sk.label}. ${sk.type} skill, contributes to ${n} skill set${n === 1 ? "" : "s"}.`;
    }
    const ids = selection.ids;
    if (ids.length === 1) {
      const set = setById.get(ids[0]);
      const n = (skillsBySetId.get(ids[0]) ?? []).length;
      return `selected ${set?.label ?? "skill set"}. ${n} contributing skill${n === 1 ? "" : "s"}.`;
    }
    const shared = highlightedSkillIds?.size ?? 0;
    return `comparing ${ids.length} skill sets. ${shared} shared skill${shared === 1 ? "" : "s"}.`;
  }, [selection, skillById, setById, skillsBySetId, highlightedSkillIds]);

  // ── render ──────────────────────────────────────────────
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        {/* intro */}
        <div className={styles.intro}>
          <span className={styles.contextLabel}>portfolio · holistic skills framework</span>
          <h1 className={styles.pageTitle}>holistic skills framework.</h1>
          <p className={styles.introText}>
            a map of how cognitive, social, and behavioral skills weave together
            to form the skill sets we cultivate in learning programmes. tap any
            skill set or skill to see how it connects. turn on{" "}
            <strong>compare mode</strong> to find what two skill sets share.
          </p>
        </div>

        {/* legend */}
        <div className={styles.legend} role="group" aria-label="skill type legend">
          {TYPE_ORDER.map((t) => {
            const meta = typeMeta[t];
            return (
              <div
                key={t}
                className={styles.legendItem}
                style={{ backgroundColor: meta.bg, color: meta.text }}
              >
                <span className={styles.legendLabel}>{meta.label}</span>
                <span className={styles.legendDesc}>{meta.description}</span>
              </div>
            );
          })}
        </div>

        {/* stats strip */}
        <div className={styles.stats} aria-label="framework stats">
          <span><strong>{skills.length}</strong> skills</span>
          <span className={styles.statsDot}>·</span>
          <span><strong>{skillSets.length}</strong> skill sets</span>
          <span className={styles.statsDot}>·</span>
          <span><strong>{totalConnections}</strong> connections</span>
          <span className={styles.statsDot}>·</span>
          <span>average skill spans <strong>{avgSetsPerSkill.toFixed(1)}</strong> sets</span>
        </div>

        {/* concise screen-reader-only announcer */}
        <div
          className={styles.srOnly}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {announcement}
        </div>

        {/* visible selection bar */}
        <div
          className={`${styles.selectionBar} ${hasSelection ? styles.selectionBarActive : ""}`}
        >
          {hasSelection ? (
            <SelectionSummary
              selection={selection}
              skillById={skillById}
              setById={setById}
              skillsBySetId={skillsBySetId}
              comparisonSkillIds={comparisonSkillIds}
              typeMeta={typeMeta}
              onPickSkill={onClickSkill}
              onPickSet={(id) => onClickSet(id, false)}
              onClear={onClear}
              onOpenDrawer={onOpenDrawer}
            />
          ) : (
            <span className={styles.selectionHint}>
              nothing selected. tap any skill set or skill below to explore the connections.
            </span>
          )}
        </div>

        {/* controls row: view switcher + compare-mode toggle */}
        <div className={styles.controlsRow}>
          <div className={styles.viewTabs} role="tablist" aria-label="view mode">
            <button
              type="button"
              role="tab"
              aria-selected={view === "list"}
              className={`${styles.viewTab} ${view === "list" ? styles.viewTabActive : ""}`}
              onClick={() => setView("list")}
            >
              list view
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "graph"}
              className={`${styles.viewTab} ${view === "graph" ? styles.viewTabActive : ""}`}
              onClick={() => setView("graph")}
            >
              graph view
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "radial"}
              className={`${styles.viewTab} ${view === "radial" ? styles.viewTabActive : ""}`}
              onClick={() => setView("radial")}
            >
              radial view
            </button>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={compareMode}
            onClick={() => setCompareMode((m) => !m)}
            className={`${styles.compareToggle} ${compareMode ? styles.compareToggleActive : ""}`}
          >
            <span className={styles.compareToggleTrack} aria-hidden="true">
              <span className={styles.compareToggleThumb} />
            </span>
            <span>
              compare mode
              {compareMode ? (
                <span className={styles.compareToggleSubLabel}> — tap sets to add or remove</span>
              ) : null}
            </span>
          </button>
        </div>

        {/* main view */}
        {view === "list" && (
          <ListView
            skills={skills}
            skillSets={skillSets}
            skillsBySetId={skillsBySetId}
            typeMeta={typeMeta}
            selection={selection}
            highlightedSkillIds={highlightedSkillIds}
            highlightedSetIds={highlightedSetIds}
            isComparing={isComparing}
            onClickSet={onClickSet}
            onClickSkill={onClickSkill}
          />
        )}
        {view === "graph" && (
          <GraphView
            skills={skills}
            skillSets={skillSets}
            typeMeta={typeMeta}
            selection={selection}
            highlightedSkillIds={highlightedSkillIds}
            highlightedSetIds={highlightedSetIds}
            isComparing={isComparing}
            onClickSet={onClickSet}
            onClickSkill={onClickSkill}
          />
        )}
        {view === "radial" && (
          <RadialView
            skills={skills}
            skillSets={skillSets}
            typeMeta={typeMeta}
            selection={selection}
            highlightedSkillIds={highlightedSkillIds}
            highlightedSetIds={highlightedSetIds}
            isComparing={isComparing}
            onClickSet={onClickSet}
            onClickSkill={onClickSkill}
          />
        )}
      </div>

      {/* detail drawer */}
      {drawerOpen && hasSelection && (
        <DetailDrawer
          selection={selection}
          skillById={skillById}
          setById={setById}
          skillsBySetId={skillsBySetId}
          comparisonSkillIds={comparisonSkillIds}
          typeMeta={typeMeta}
          onPickSkill={(id) => {
            onClickSkill(id);
          }}
          onPickSet={(id) => {
            onClickSet(id, false);
          }}
          onClose={onCloseDrawer}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  list view
// ═══════════════════════════════════════════════════════════

function ListView({
  skills,
  skillSets,
  skillsBySetId,
  typeMeta,
  selection,
  highlightedSkillIds,
  highlightedSetIds,
  isComparing,
  onClickSet,
  onClickSkill,
}: {
  skills: Skill[];
  skillSets: SkillSet[];
  skillsBySetId: Map<string, Skill[]>;
  typeMeta: TypeMeta;
  selection: SelectionState;
  highlightedSkillIds: Set<string> | null;
  highlightedSetIds: Set<string> | null;
  isComparing: boolean;
  onClickSet: (id: string, multi: boolean) => void;
  onClickSkill: (id: string) => void;
}) {
  const hasSelection = selection.kind !== "none";

  return (
    <div className={styles.grid}>
      {/* sets column */}
      <section className={styles.column} aria-label="skill sets">
        <h2 className={styles.columnTitle}>
          skill sets
          {isComparing && (
            <span className={styles.compareBadge}>
              comparing {(selection as { ids: string[] }).ids.length}
            </span>
          )}
        </h2>
        <div className={styles.setsList}>
          {skillSets.map((s) => {
            const isSelectedSetMember =
              selection.kind === "sets" && selection.ids.includes(s.id);
            const isHighlighted = highlightedSetIds?.has(s.id) ?? false;
            const dim = hasSelection && !isHighlighted;
            return (
              <button
                key={s.id}
                type="button"
                onClick={(e) => onClickSet(s.id, e.metaKey || e.ctrlKey || e.shiftKey)}
                aria-pressed={isSelectedSetMember}
                className={`${styles.setTile} ${
                  isSelectedSetMember ? styles.setTileSelected : ""
                } ${
                  isHighlighted && !isSelectedSetMember ? styles.setTileHighlighted : ""
                } ${dim ? styles.dim : ""}`}
              >
                <span className={styles.setTileLabel}>{s.label}</span>
                <span className={styles.setTileCount}>
                  {(skillsBySetId.get(s.id) ?? []).length} skills
                </span>
                <span className={styles.setTileDesc}>{s.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* skills column */}
      <section className={styles.column} aria-label="skills">
        <h2 className={styles.columnTitle}>
          skills
          {isComparing && highlightedSkillIds && (
            <span className={styles.compareBadge}>
              {highlightedSkillIds.size} shared
            </span>
          )}
        </h2>
        {TYPE_ORDER.map((t) => {
          const groupSkills = skills.filter((sk) => sk.type === t);
          const meta = typeMeta[t];
          return (
            <div key={t} className={styles.typeGroup}>
              <div className={styles.typeGroupHeader} style={{ color: meta.bg }}>
                {meta.label}
              </div>
              <div className={styles.chipsRow}>
                {groupSkills.map((sk) => {
                  const isSelected =
                    selection.kind === "skill" && selection.id === sk.id;
                  const isHighlighted = highlightedSkillIds?.has(sk.id) ?? false;
                  const dim = hasSelection && !isHighlighted && !isSelected;
                  const m = typeMeta[sk.type];
                  return (
                    <button
                      key={sk.id}
                      type="button"
                      onClick={() => onClickSkill(sk.id)}
                      aria-pressed={isSelected}
                      aria-label={`${sk.label} — ${sk.type} skill, contributes to ${sk.skillSetIds.length} skill set${sk.skillSetIds.length === 1 ? "" : "s"}`}
                      className={`${styles.chip} ${isSelected ? styles.chipSelected : ""} ${dim ? styles.dim : ""}`}
                      style={{
                        backgroundColor: m.bg,
                        color: m.text,
                        borderColor: m.bg,
                      }}
                    >
                      {sk.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  graph view
// ═══════════════════════════════════════════════════════════

const GRAPH = {
  width: 980,
  height: 760,
  setColX: 24,
  setColW: 220,
  skillColX: 720,
  skillColW: 236,
  nodeH: 44,
  setNodeH: 56,
  typeHeaderH: 28,
  groupGap: 10,
  topPad: 24,
};

function computeGraphLayout(skillSets: SkillSet[], skills: Skill[]) {
  const setCount = skillSets.length;
  const setSpacing = (GRAPH.height - GRAPH.topPad * 2) / Math.max(setCount, 1);
  const setPos = new Map<string, { x: number; y: number; cx: number; cy: number }>();
  skillSets.forEach((s, i) => {
    const y = GRAPH.topPad + setSpacing * i + (setSpacing - GRAPH.setNodeH) / 2;
    setPos.set(s.id, {
      x: GRAPH.setColX,
      y,
      cx: GRAPH.setColX + GRAPH.setColW,
      cy: y + GRAPH.setNodeH / 2,
    });
  });

  // skills grouped by type, vertically stacked
  const skillPos = new Map<string, { x: number; y: number; cx: number; cy: number }>();
  let cursor = GRAPH.topPad;
  TYPE_ORDER.forEach((t) => {
    const grpSkills = skills.filter((s) => s.type === t);
    cursor += GRAPH.typeHeaderH;
    grpSkills.forEach((sk) => {
      skillPos.set(sk.id, {
        x: GRAPH.skillColX,
        y: cursor,
        cx: GRAPH.skillColX,
        cy: cursor + GRAPH.nodeH / 2,
      });
      cursor += GRAPH.nodeH + 4;
    });
    cursor += GRAPH.groupGap;
  });

  // type header positions
  const typeHeaderY = new Map<SkillType, number>();
  let cursor2 = GRAPH.topPad;
  TYPE_ORDER.forEach((t) => {
    typeHeaderY.set(t, cursor2);
    const grpSkills = skills.filter((s) => s.type === t);
    cursor2 += GRAPH.typeHeaderH + grpSkills.length * (GRAPH.nodeH + 4) + GRAPH.groupGap;
  });

  return { setPos, skillPos, typeHeaderY };
}

function GraphView({
  skills,
  skillSets,
  typeMeta,
  selection,
  highlightedSkillIds,
  highlightedSetIds,
  isComparing,
  onClickSet,
  onClickSkill,
}: {
  skills: Skill[];
  skillSets: SkillSet[];
  typeMeta: TypeMeta;
  selection: SelectionState;
  highlightedSkillIds: Set<string> | null;
  highlightedSetIds: Set<string> | null;
  isComparing: boolean;
  onClickSet: (id: string, multi: boolean) => void;
  onClickSkill: (id: string) => void;
}) {
  const layout = useMemo(
    () => computeGraphLayout(skillSets, skills),
    [skillSets, skills],
  );

  const hasSelection = selection.kind !== "none";

  // edges: every (skill, setId) pair
  const edges = useMemo(() => {
    const list: { skillId: string; setId: string; type: SkillType }[] = [];
    skills.forEach((sk) => {
      sk.skillSetIds.forEach((sid) => {
        list.push({ skillId: sk.id, setId: sid, type: sk.type });
      });
    });
    return list;
  }, [skills]);

  function edgeIsHighlighted(skillId: string, setId: string): boolean {
    if (!hasSelection) return false;
    if (selection.kind === "skill") return selection.id === skillId;
    if (selection.kind === "sets") {
      // edge is highlighted if it touches a selected set AND a highlighted skill (intersection-aware)
      const setSelected = selection.ids.includes(setId);
      const skillHighlighted = highlightedSkillIds?.has(skillId) ?? false;
      return setSelected && skillHighlighted;
    }
    return false;
  }

  return (
    <div className={styles.graphScroll}>
      <div
        className={styles.graphContainer}
        style={{ width: GRAPH.width, height: GRAPH.height }}
      >
        {/* svg curves layer (under nodes) */}
        <svg
          className={styles.graphSvg}
          width={GRAPH.width}
          height={GRAPH.height}
          aria-hidden="true"
        >
          {edges.map((e) => {
            const sp = layout.setPos.get(e.setId);
            const skp = layout.skillPos.get(e.skillId);
            if (!sp || !skp) return null;
            const x1 = sp.cx;
            const y1 = sp.cy;
            const x2 = skp.cx;
            const y2 = skp.cy;
            const midX = (x1 + x2) / 2;
            const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
            const highlighted = edgeIsHighlighted(e.skillId, e.setId);
            const dimmed = hasSelection && !highlighted;
            const stroke =
              e.type === "cognitive"
                ? "var(--wv-cadet)"
                : e.type === "social"
                  ? "var(--wv-redwood)"
                  : "var(--wv-sienna)";
            return (
              <path
                key={`${e.skillId}-${e.setId}`}
                d={d}
                stroke={stroke}
                strokeWidth={highlighted ? 2 : 1}
                fill="none"
                opacity={dimmed ? 0.07 : highlighted ? 0.85 : 0.35}
                style={{ transition: "opacity 0.18s ease, stroke-width 0.18s ease" }}
              />
            );
          })}
        </svg>

        {/* type group headers */}
        {TYPE_ORDER.map((t) => {
          const y = layout.typeHeaderY.get(t) ?? 0;
          const meta = typeMeta[t];
          return (
            <div
              key={`hdr-${t}`}
              className={styles.graphTypeHeader}
              style={{
                position: "absolute",
                top: y,
                left: GRAPH.skillColX,
                width: GRAPH.skillColW,
                color: meta.bg,
                height: GRAPH.typeHeaderH,
                lineHeight: `${GRAPH.typeHeaderH}px`,
              }}
            >
              {meta.label}
            </div>
          );
        })}

        {/* skill set nodes (left) */}
        {skillSets.map((s) => {
          const pos = layout.setPos.get(s.id);
          if (!pos) return null;
          const isSelectedSetMember =
            selection.kind === "sets" && selection.ids.includes(s.id);
          const isHighlighted = highlightedSetIds?.has(s.id) ?? false;
          const dim = hasSelection && !isHighlighted;
          return (
            <button
              key={s.id}
              type="button"
              onClick={(e) => onClickSet(s.id, e.metaKey || e.ctrlKey || e.shiftKey)}
              aria-pressed={isSelectedSetMember}
              className={`${styles.graphSetNode} ${
                isSelectedSetMember ? styles.graphSetNodeSelected : ""
              } ${
                isHighlighted && !isSelectedSetMember ? styles.graphSetNodeHighlighted : ""
              } ${dim ? styles.dim : ""}`}
              style={{
                position: "absolute",
                top: pos.y,
                left: pos.x,
                width: GRAPH.setColW,
                height: GRAPH.setNodeH,
              }}
            >
              <span className={styles.graphSetLabel}>{s.label}</span>
            </button>
          );
        })}

        {/* skill nodes (right) */}
        {skills.map((sk) => {
          const pos = layout.skillPos.get(sk.id);
          if (!pos) return null;
          const isSelected =
            selection.kind === "skill" && selection.id === sk.id;
          const isHighlighted = highlightedSkillIds?.has(sk.id) ?? false;
          const dim = hasSelection && !isHighlighted && !isSelected;
          const m = typeMeta[sk.type];
          return (
            <button
              key={sk.id}
              type="button"
              onClick={() => onClickSkill(sk.id)}
              aria-pressed={isSelected}
              aria-label={`${sk.label} — ${sk.type} skill`}
              className={`${styles.graphSkillNode} ${
                isSelected ? styles.graphSkillNodeSelected : ""
              } ${dim ? styles.dim : ""}`}
              style={{
                position: "absolute",
                top: pos.y,
                left: pos.x,
                width: GRAPH.skillColW,
                height: GRAPH.nodeH,
                backgroundColor: m.bg,
                color: m.text,
              }}
            >
              {sk.label}
            </button>
          );
        })}
      </div>
      <p className={styles.compareHint} style={{ marginTop: "1rem" }}>
        each curve is one connection · {isComparing ? "highlighted curves are skills shared across the selected sets" : "click any node to highlight what it touches"}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  radial view
// ═══════════════════════════════════════════════════════════

const RADIAL = {
  // viewBox is 0..100 in both dims; center at (50,50)
  innerR: 22, // skill set ring (slightly tighter than before)
  outerR: 38, // skill anchor dot ring — labels extend horizontally outward
  // each type occupies a 100° arc with 20° gaps between
  // angles in SVG convention: 0°=right, 90°=down, 270°=top
  arcs: {
    cognitive:  { start: 220, end: 320 }, // top arc, centered at 270 (top)
    social:     { start: 340, end: 80  }, // right arc, centered at 30  (lower-right)
    behavioral: { start: 100, end: 200 }, // left arc,  centered at 150 (lower-left)
  } as Record<SkillType, { start: number; end: number }>,
  arcLabelR: 47,
};

function polar(angleDeg: number, r: number, cx = 50, cy = 50) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function computeRadialLayout(skillSets: SkillSet[], skills: Skill[]) {
  // skill sets evenly spaced on inner ring, starting at top
  const setPos = new Map<string, { x: number; y: number; angle: number }>();
  const n = skillSets.length;
  skillSets.forEach((s, i) => {
    // start at -90° (top), distribute clockwise
    const angle = -90 + (i * 360) / Math.max(n, 1);
    const { x, y } = polar(angle, RADIAL.innerR);
    setPos.set(s.id, { x, y, angle });
  });

  // skills grouped by type, distributed across each type's arc
  const skillPos = new Map<string, { x: number; y: number; angle: number }>();
  TYPE_ORDER.forEach((t) => {
    const arc = RADIAL.arcs[t];
    const groupSkills = skills.filter((sk) => sk.type === t);
    const m = groupSkills.length;
    if (m === 0) return;
    let start = arc.start;
    let end = arc.end;
    if (end < start) end += 360;
    const span = end - start;
    groupSkills.forEach((sk, i) => {
      const angle = m === 1 ? start + span / 2 : start + (i * span) / (m - 1);
      const { x, y } = polar(angle, RADIAL.outerR);
      skillPos.set(sk.id, { x, y, angle: angle % 360 });
    });
  });

  return { setPos, skillPos };
}

function RadialView({
  skills,
  skillSets,
  typeMeta,
  selection,
  highlightedSkillIds,
  highlightedSetIds,
  isComparing,
  onClickSet,
  onClickSkill,
}: {
  skills: Skill[];
  skillSets: SkillSet[];
  typeMeta: TypeMeta;
  selection: SelectionState;
  highlightedSkillIds: Set<string> | null;
  highlightedSetIds: Set<string> | null;
  isComparing: boolean;
  onClickSet: (id: string, multi: boolean) => void;
  onClickSkill: (id: string) => void;
}) {
  const layout = useMemo(
    () => computeRadialLayout(skillSets, skills),
    [skillSets, skills],
  );

  const hasSelection = selection.kind !== "none";

  // edges: every (skill, setId) pair
  const edges = useMemo(() => {
    const list: { skillId: string; setId: string; type: SkillType }[] = [];
    skills.forEach((sk) => {
      sk.skillSetIds.forEach((sid) => {
        list.push({ skillId: sk.id, setId: sid, type: sk.type });
      });
    });
    return list;
  }, [skills]);

  function edgeIsHighlighted(skillId: string, setId: string): boolean {
    if (!hasSelection) return false;
    if (selection.kind === "skill") return selection.id === skillId;
    if (selection.kind === "sets") {
      const setSelected = selection.ids.includes(setId);
      const skillHighlighted = highlightedSkillIds?.has(skillId) ?? false;
      return setSelected && skillHighlighted;
    }
    return false;
  }

  return (
    <div className={styles.radialOuter}>
      <div className={styles.radialContainer}>
        <svg
          className={styles.radialSvg}
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {/* faint guide ring at outer radius */}
          <circle
            cx={50}
            cy={50}
            r={RADIAL.outerR}
            fill="none"
            stroke="rgba(39, 50, 72, 0.06)"
            strokeWidth={0.3}
          />
          <circle
            cx={50}
            cy={50}
            r={RADIAL.innerR}
            fill="none"
            stroke="rgba(39, 50, 72, 0.06)"
            strokeWidth={0.3}
          />

          {/* connection curves — bezier with control points pulled toward center */}
          {edges.map((e) => {
            const sp = layout.setPos.get(e.setId);
            const skp = layout.skillPos.get(e.skillId);
            if (!sp || !skp) return null;
            const cp1x = skp.x + (50 - skp.x) * 0.55;
            const cp1y = skp.y + (50 - skp.y) * 0.55;
            const cp2x = sp.x + (50 - sp.x) * 0.55;
            const cp2y = sp.y + (50 - sp.y) * 0.55;
            const d = `M ${skp.x} ${skp.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${sp.x} ${sp.y}`;
            const highlighted = edgeIsHighlighted(e.skillId, e.setId);
            const dimmed = hasSelection && !highlighted;
            const stroke =
              e.type === "cognitive"
                ? "var(--wv-cadet)"
                : e.type === "social"
                  ? "var(--wv-redwood)"
                  : "#8a3b30";
            return (
              <path
                key={`${e.skillId}-${e.setId}`}
                d={d}
                stroke={stroke}
                strokeWidth={highlighted ? 0.7 : 0.35}
                fill="none"
                opacity={dimmed ? 0.06 : highlighted ? 0.85 : 0.32}
                style={{ transition: "opacity 0.18s ease, stroke-width 0.18s ease" }}
              />
            );
          })}
        </svg>

        {/* type-arc labels positioned outside outer ring */}
        {TYPE_ORDER.map((t) => {
          const arc = RADIAL.arcs[t];
          let start = arc.start;
          let end = arc.end;
          if (end < start) end += 360;
          const mid = (start + end) / 2;
          const pos = polar(mid, RADIAL.arcLabelR);
          return (
            <div
              key={`arc-label-${t}`}
              className={styles.radialArcLabel}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                color: typeMeta[t].bg,
              }}
            >
              {typeMeta[t].label}
            </div>
          );
        })}

        {/* skill set tiles (inner ring) */}
        {skillSets.map((s) => {
          const pos = layout.setPos.get(s.id);
          if (!pos) return null;
          const isSelectedSetMember =
            selection.kind === "sets" && selection.ids.includes(s.id);
          const isHighlighted = highlightedSetIds?.has(s.id) ?? false;
          const dim = hasSelection && !isHighlighted;
          return (
            <button
              key={s.id}
              type="button"
              onClick={(e) => onClickSet(s.id, e.metaKey || e.ctrlKey || e.shiftKey)}
              aria-pressed={isSelectedSetMember}
              aria-label={`skill set: ${s.label}`}
              className={`${styles.radialSetNode} ${
                isSelectedSetMember ? styles.radialSetNodeSelected : ""
              } ${
                isHighlighted && !isSelectedSetMember ? styles.radialSetNodeHighlighted : ""
              } ${dim ? styles.dim : ""}`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              }}
            >
              {s.label}
            </button>
          );
        })}

        {/* skill labels (anchored dot + horizontal text + type tick) */}
        {skills.map((sk) => {
          const pos = layout.skillPos.get(sk.id);
          if (!pos) return null;
          const isSelected =
            selection.kind === "skill" && selection.id === sk.id;
          const isHighlighted = highlightedSkillIds?.has(sk.id) ?? false;
          const dim = hasSelection && !isHighlighted && !isSelected;
          const m = typeMeta[sk.type];
          // labels on the right half extend right from the dot,
          // labels on the left half extend left (flex-direction reversed)
          const isRightSide = pos.x >= 50;
          return (
            <button
              key={sk.id}
              type="button"
              onClick={() => onClickSkill(sk.id)}
              aria-pressed={isSelected}
              aria-label={`${sk.label} — ${sk.type} skill`}
              className={`${styles.radialLabel} ${
                isRightSide ? styles.radialLabelRight : styles.radialLabelLeft
              } ${isSelected ? styles.radialLabelSelected : ""} ${
                dim ? styles.dim : ""
              }`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              }}
            >
              <span
                className={styles.radialDot}
                style={{ backgroundColor: m.bg }}
                aria-hidden="true"
              />
              <span className={styles.radialLabelStack}>
                <span
                  className={styles.radialLabelText}
                  style={isSelected ? { color: m.bg } : undefined}
                >
                  {sk.label}
                </span>
                <span
                  className={styles.radialLabelTick}
                  style={{ backgroundColor: m.bg }}
                  aria-hidden="true"
                />
              </span>
            </button>
          );
        })}
      </div>
      <p className={styles.compareHint} style={{ marginTop: "0.75rem" }}>
        skill sets in the center · skills around the perimeter, grouped by type ·{" "}
        {isComparing ? "highlighted curves are skills shared across the selected sets" : "tap any node to trace its connections"}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  selection summary (inline bar)
// ═══════════════════════════════════════════════════════════

type ActiveSelection = Exclude<SelectionState, { kind: "none" }>;

function SelectionSummary({
  selection,
  skillById,
  setById,
  skillsBySetId,
  comparisonSkillIds,
  typeMeta,
  onPickSkill,
  onPickSet,
  onClear,
  onOpenDrawer,
}: {
  selection: ActiveSelection;
  skillById: Map<string, Skill>;
  setById: Map<string, SkillSet>;
  skillsBySetId: Map<string, Skill[]>;
  comparisonSkillIds: Set<string> | null;
  typeMeta: TypeMeta;
  onPickSkill: (id: string) => void;
  onPickSet: (id: string) => void;
  onClear: () => void;
  onOpenDrawer: (triggerEl: HTMLElement | null) => void;
}) {
  if (selection.kind === "skill") {
    const sk = skillById.get(selection.id);
    if (!sk) return null;
    const m = typeMeta[sk.type];
    const memberSets = sk.skillSetIds
      .map((id) => setById.get(id))
      .filter((s): s is SkillSet => !!s);
    return (
      <div className={styles.summary}>
        <div className={styles.summaryHead}>
          <span
            className={styles.summaryKind}
            style={{ backgroundColor: m.bg, color: m.text }}
          >
            {sk.type} skill
          </span>
          <h3 className={styles.summaryTitle}>{sk.label}</h3>
          <button
            type="button"
            onClick={(e) => onOpenDrawer(e.currentTarget)}
            className={styles.detailBtn}
          >
            more detail →
          </button>
          <button type="button" onClick={onClear} className={styles.clearBtn}>
            clear ✕
          </button>
        </div>
        <div className={styles.summaryListLabel}>
          contributes to {memberSets.length} skill set{memberSets.length === 1 ? "" : "s"}:
        </div>
        <div className={styles.summaryChips}>
          {memberSets.map((set) => (
            <button
              key={set.id}
              type="button"
              onClick={() => onPickSet(set.id)}
              className={`${styles.summaryChip} ${styles.summaryChipNeutral}`}
            >
              {set.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // selection.kind === "sets"
  if (selection.ids.length === 1) {
    const set = setById.get(selection.ids[0]);
    if (!set) return null;
    const setSkills = skillsBySetId.get(set.id) ?? [];
    return (
      <div className={styles.summary}>
        <div className={styles.summaryHead}>
          <span className={styles.summaryKind}>skill set</span>
          <h3 className={styles.summaryTitle}>{set.label}</h3>
          <button
            type="button"
            onClick={(e) => onOpenDrawer(e.currentTarget)}
            className={styles.detailBtn}
          >
            more detail →
          </button>
          <button type="button" onClick={onClear} className={styles.clearBtn}>
            clear ✕
          </button>
        </div>
        <p className={styles.summaryDesc}>{set.description}</p>
        <div className={styles.summaryListLabel}>
          {setSkills.length} contributing skills:
        </div>
        <div className={styles.summaryChips}>
          {setSkills.map((sk) => {
            const m = typeMeta[sk.type];
            return (
              <button
                key={sk.id}
                type="button"
                onClick={() => onPickSkill(sk.id)}
                className={styles.summaryChip}
                style={{ backgroundColor: m.bg, color: m.text }}
              >
                {sk.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // multi-set comparison
  const sets = selection.ids
    .map((id) => setById.get(id))
    .filter((s): s is SkillSet => !!s);
  const intersection = comparisonSkillIds
    ? Array.from(comparisonSkillIds)
        .map((id) => skillById.get(id))
        .filter((s): s is Skill => !!s)
    : [];
  return (
    <div className={styles.summary}>
      <div className={styles.summaryHead}>
        <span className={styles.summaryKind}>comparing {sets.length} sets</span>
        <h3 className={styles.summaryTitle}>
          {sets.map((s) => s.label).join(" + ")}
        </h3>
        <button
          type="button"
          onClick={(e) => onOpenDrawer(e.currentTarget)}
          className={styles.detailBtn}
        >
          more detail →
        </button>
        <button type="button" onClick={onClear} className={styles.clearBtn}>
          clear ✕
        </button>
      </div>
      <div className={styles.summaryListLabel}>
        {intersection.length === 0
          ? "no skills appear in all selected sets."
          : `${intersection.length} skill${intersection.length === 1 ? "" : "s"} appear${intersection.length === 1 ? "s" : ""} in all selected sets:`}
      </div>
      {intersection.length > 0 && (
        <div className={styles.summaryChips}>
          {intersection.map((sk) => {
            const m = typeMeta[sk.type];
            return (
              <button
                key={sk.id}
                type="button"
                onClick={() => onPickSkill(sk.id)}
                className={styles.summaryChip}
                style={{ backgroundColor: m.bg, color: m.text }}
              >
                {sk.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  detail drawer
// ═══════════════════════════════════════════════════════════

function DetailDrawer({
  selection,
  skillById,
  setById,
  skillsBySetId,
  comparisonSkillIds,
  typeMeta,
  onPickSkill,
  onPickSet,
  onClose,
}: {
  selection: ActiveSelection;
  skillById: Map<string, Skill>;
  setById: Map<string, SkillSet>;
  skillsBySetId: Map<string, Skill[]>;
  comparisonSkillIds: Set<string> | null;
  typeMeta: TypeMeta;
  onPickSkill: (id: string) => void;
  onPickSet: (id: string) => void;
  onClose: () => void;
}) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // lock background scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // focus the close button when the drawer opens
  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  // focus trap — keep tab cycling inside the drawer
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Tab") return;
      const root = drawerRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [],
  );

  function content() {
    if (selection.kind === "skill") {
      const sk = skillById.get(selection.id);
      if (!sk) return null;
      const m = typeMeta[sk.type];
      const memberSets = sk.skillSetIds
        .map((id) => setById.get(id))
        .filter((s): s is SkillSet => !!s);
      return (
        <div className={styles.drawerBody}>
          <span
            className={styles.drawerKind}
            style={{ backgroundColor: m.bg, color: m.text }}
          >
            {sk.type} skill
          </span>
          <h2 id="drawer-title" className={styles.drawerTitle}>{sk.label}</h2>
          {sk.definition && (
            <p className={styles.drawerDef}>{sk.definition}</p>
          )}

          <DrawerSection title={`contributes to ${memberSets.length} skill set${memberSets.length === 1 ? "" : "s"}`}>
            <div className={styles.summaryChips}>
              {memberSets.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  onClick={() => onPickSet(set.id)}
                  className={`${styles.summaryChip} ${styles.summaryChipNeutral}`}
                >
                  {set.label}
                </button>
              ))}
            </div>
          </DrawerSection>

          {sk.programmes && sk.programmes.length > 0 && (
            <DrawerSection title="develops through">
              <ul className={styles.drawerList}>
                {sk.programmes.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </DrawerSection>
          )}

          {sk.examples && sk.examples.length > 0 && (
            <DrawerSection title="example activities">
              <ul className={styles.drawerList}>
                {sk.examples.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </DrawerSection>
          )}
        </div>
      );
    }

    // sets — single or comparison
    if (selection.kind === "sets" && selection.ids.length === 1) {
      const set = setById.get(selection.ids[0]);
      if (!set) return null;
      const setSkills = skillsBySetId.get(set.id) ?? [];
      return (
        <div className={styles.drawerBody}>
          <span className={styles.drawerKind}>skill set</span>
          <h2 id="drawer-title" className={styles.drawerTitle}>{set.label}</h2>
          <p className={styles.drawerDef}>{set.description}</p>

          <DrawerSection title={`${setSkills.length} contributing skills`}>
            <div className={styles.summaryChips}>
              {setSkills.map((sk) => {
                const m = typeMeta[sk.type];
                return (
                  <button
                    key={sk.id}
                    type="button"
                    onClick={() => onPickSkill(sk.id)}
                    className={styles.summaryChip}
                    style={{ backgroundColor: m.bg, color: m.text }}
                  >
                    {sk.label}
                  </button>
                );
              })}
            </div>
          </DrawerSection>

          {set.programmes && set.programmes.length > 0 && (
            <DrawerSection title="cultivated through">
              <ul className={styles.drawerList}>
                {set.programmes.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </DrawerSection>
          )}
        </div>
      );
    }

    // comparison
    if (selection.kind === "sets") {
      const sets = selection.ids
        .map((id) => setById.get(id))
        .filter((s): s is SkillSet => !!s);
      const intersection = comparisonSkillIds
        ? Array.from(comparisonSkillIds)
            .map((id) => skillById.get(id))
            .filter((s): s is Skill => !!s)
        : [];
      return (
        <div className={styles.drawerBody}>
          <span className={styles.drawerKind}>comparing {sets.length}</span>
          <h2 id="drawer-title" className={styles.drawerTitle}>
            {sets.map((s) => s.label).join(" + ")}
          </h2>
          <p className={styles.drawerDef}>
            skills that appear in all {sets.length} selected sets — the overlap
            tells you which capacities are reinforced from multiple angles.
          </p>

          <DrawerSection title={intersection.length === 0 ? "no overlap" : `${intersection.length} shared skill${intersection.length === 1 ? "" : "s"}`}>
            {intersection.length === 0 ? (
              <p className={styles.drawerDef}>
                these skill sets don&apos;t share any skills — they cover
                distinct territory.
              </p>
            ) : (
              <div className={styles.summaryChips}>
                {intersection.map((sk) => {
                  const m = typeMeta[sk.type];
                  return (
                    <button
                      key={sk.id}
                      type="button"
                      onClick={() => onPickSkill(sk.id)}
                      className={styles.summaryChip}
                      style={{ backgroundColor: m.bg, color: m.text }}
                    >
                      {sk.label}
                    </button>
                  );
                })}
              </div>
            )}
          </DrawerSection>
        </div>
      );
    }

    return null;
  }

  return (
    <div
      className={styles.drawerOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <aside className={styles.drawer} ref={drawerRef}>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          className={styles.drawerClose}
          aria-label="close detail panel"
        >
          ✕
        </button>
        {content()}
      </aside>
    </div>
  );
}

function DrawerSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.drawerSection}>
      <div className={styles.drawerSectionTitle}>{title}</div>
      {children}
    </div>
  );
}
