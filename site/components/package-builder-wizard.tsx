"use client";

import { useState, useCallback, useMemo } from "react";
import type { PackData, ModalAsset } from "@/lib/notion";
import styles from "./package-builder-wizard.module.css";
import { AssetModal } from "./asset-modal";

/* ── Quadrant colors ── */

const QUADRANT_COLORS: Record<string, { css: string; hex: string }> = {
  "people-design":    { css: "var(--wv-cadet, #273248)",    hex: "#273248" },
  "people-research":  { css: "var(--wv-sienna, #cb7858)",   hex: "#cb7858" },
  "product-design":   { css: "var(--wv-redwood, #b15043)",  hex: "#b15043" },
  "product-research": { css: "var(--wv-champagne, #ffebd2)", hex: "#ffebd2" },
};

/** Get the color for a quadrant, falling back to a neutral default. */
function quadrantColor(quadrantId: string | null): { css: string; hex: string } {
  if (!quadrantId) return { css: "#3a4459", hex: "#3a4459" };
  return QUADRANT_COLORS[quadrantId] ?? { css: "#3a4459", hex: "#3a4459" };
}

/* ── Static content (UI choices — these don't come from Notion) ── */

const INSIGHTS: Record<string, string> = {
  people: "training, behaviour change, system adoption",
  product: "the tool, game, or experience itself",
  design: "build, improve, make it work better",
  research: "measure, prove, understand impact",
};

const SERVICES: Record<string, { label: string; value: string; desc: string }[]> = {
  "people-design": [
    { label: "creativity & resilience", value: "creativity-resilience", desc: "workshops for navigating uncertainty and fostering innovation" },
    { label: "learning experiences", value: "learning-experiences", desc: "immersive programmes" },
    { label: "programmes", value: "programmes", desc: "structured learning journeys" },
    { label: "AI adoption", value: "ai-adoption", desc: "tools and trainings for human-centered AI integration" },
  ],
  "people-research": [
    { label: "programme evaluation", value: "program-evaluation", desc: "measure programme impact" },
    { label: "MEL touchpoints", value: "mel-touchpoints", desc: "monitoring checkpoints" },
    { label: "research databases", value: "research-databases", desc: "structured systems for capturing and querying evidence" },
    { label: "evidence for funders", value: "evidence-for-funders", desc: "proof for stakeholders" },
  ],
  "product-design": [
    { label: "learning tools", value: "learning-tools", desc: "educational products" },
    { label: "toys/games", value: "toys-games", desc: "play-based products" },
    { label: "comms assets", value: "comms", desc: "brand materials" },
    { label: "UDL improvements", value: "udl-improvements", desc: "accessibility upgrades" },
  ],
  "product-research": [
    { label: "exhibit efficacy", value: "efficacy", desc: "does the exhibit work?" },
    { label: "toy impacts", value: "toy-impacts", desc: "play value research" },
    { label: "UDL validation", value: "udl-validation", desc: "accessibility testing" },
    { label: "usability testing", value: "usability-testing", desc: "user experience research" },
  ],
};

const OUTCOMES = [
  { label: "prove it", value: "prove", desc: "demonstrate measurable impact" },
  { label: "improve it", value: "improve", desc: "make what exists better" },
  { label: "scale it", value: "scale", desc: "expand reach and adoption" },
  { label: "accessibility", value: "accessibility", desc: "ensure inclusive design" },
  { label: "concept sprint", value: "concept", desc: "rapid idea exploration" },
  { label: "prototype", value: "prototype", desc: "build a testable version" },
];

const QUESTIONS: Record<number, string> = {
  1: "what are you trying to change?",
  2: "how do you want to approach it?",
  3: "which needs are closest to yours?",
  4: "what does success look like?",
};

/* ── Types ── */

interface WizardState {
  step: number;
  audience: string | null;
  mode: string | null;
  focus: string[];
  goals: string[];
}

interface Props {
  packs: Record<string, PackData>;
  ctaLink?: string;
}

/* ── Helpers ── */

function toggleArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function getQuadrant(s: WizardState): string | null {
  return s.audience && s.mode ? `${s.audience}-${s.mode}` : null;
}

/* ── Sub-components ── */

function ProgressDots({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "0 24px 16px" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={[
            styles.progressDot,
            i === step ? styles.active : "",
            i < step ? styles.complete : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ))}
    </div>
  );
}

function ChoiceButton({
  label,
  desc,
  selected,
  size = "small",
  onClick,
}: {
  label: string;
  desc: string;
  selected: boolean;
  size?: "small" | "large";
  onClick: () => void;
}) {
  return (
    <button
      className={[styles.choiceBtn, styles[size], selected ? styles.selected : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
    >
      {label}
      <span className={styles.tooltip}>{desc}</span>
    </button>
  );
}

function Matrix({ state, expanded = false }: { state: WizardState; expanded?: boolean }) {
  const quadrant = getQuadrant(state);

  const getClass = (cellId: string) => {
    if (quadrant === cellId) return "active";
    if (state.step === 2 && state.audience && cellId.startsWith(state.audience)) return "highlight";
    return "";
  };

  const cellSize = expanded ? 64 : 50;
  const fontSize = expanded ? 10 : 9;
  const labelFontSize = expanded ? 8 : 0;

  const cellLabels: Record<string, string> = expanded
    ? {
        "people-design": "design &\ndeploy",
        "people-research": "pinpoint &\nprove",
        "product-design": "build &\niterate",
        "product-research": "test &\nvalidate",
      }
    : {};

  const cellStyle = (id: string): React.CSSProperties => {
    const cls = getClass(id);
    const qc = QUADRANT_COLORS[id] ?? { css: "#3a4459", hex: "#3a4459" };
    let background = "#3a4459";
    if (cls === "active") background = qc.css;
    else if (cls === "highlight") background = `color-mix(in srgb, ${qc.hex} 50%, #3a4459)`;

    return {
      width: cellSize,
      height: cellSize,
      background,
      borderRadius: 3,
      transition: "all 0.3s ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 4,
      // Cadet is close to page background — add border so it reads as selected
      border: cls === "active" && id === "people-design"
        ? "1.5px solid rgba(255,255,255,0.4)"
        : "1.5px solid transparent",
    };
  };

  const cellLabelStyle = (id: string): React.CSSProperties => {
    const isActive = getClass(id) === "active";
    // Champagne (#ffebd2) is light — use dark text; all others use white
    const needsDarkText = isActive && id === "product-research";
    return {
      fontSize: labelFontSize,
      color: isActive
        ? needsDarkText ? "var(--wv-cadet, #273248)" : "#ffffff"
        : "rgba(255,255,255,0.7)",
      textAlign: "center",
      lineHeight: 1.2,
      textTransform: "lowercase",
      whiteSpace: "pre-line",
    };
  };

  const cells = ["people-design", "people-research", "product-design", "product-research"];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      {/* Column labels */}
      <div style={{ display: "grid", gridTemplateColumns: `${cellSize}px ${cellSize}px`, gap: 3, marginBottom: 3 }}>
        <div style={{ fontSize, color: "rgba(255,255,255,0.7)", textAlign: "center", textTransform: "lowercase" }}>
          design
        </div>
        <div style={{ fontSize, color: "rgba(255,255,255,0.7)", textAlign: "center", textTransform: "lowercase" }}>
          research
        </div>
      </div>
      {/* Grid with row labels */}
      <div style={{ position: "relative" }}>
        {/* Row labels */}
        <div
          style={{
            position: "absolute",
            right: "100%",
            top: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-around",
            paddingRight: 8,
          }}
        >
          {["people", "product"].map((label) => (
            <div
              key={label}
              style={{
                fontSize,
                color: "rgba(255,255,255,0.7)",
                textAlign: "right",
                textTransform: "lowercase",
                height: cellSize,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              {label}
            </div>
          ))}
        </div>
        {/* Cells */}
        <div style={{ display: "grid", gridTemplateColumns: `${cellSize}px ${cellSize}px`, gap: 3 }}>
          {cells.map((id) => (
            <div key={id} style={cellStyle(id)}>
              <div style={cellLabelStyle(id)}>{cellLabels[id] || ""}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultPage({
  state,
  pack,
  ctaLink,
  onStartOver,
  allExamples,
}: {
  state: WizardState;
  pack: PackData;
  ctaLink: string;
  onStartOver: () => void;
  allExamples: ModalAsset[];
}) {
  const [activeExample, setActiveExample] = useState<ModalAsset | null>(null);
  const closeModal = useCallback(() => setActiveExample(null), []);
  const qc = quadrantColor(getQuadrant(state));
  // Champagne is light — tags/accents need dark text
  const isLightQuadrant = getQuadrant(state) === "product-research";
  const tagTextColor = isLightQuadrant ? "var(--wv-cadet, #273248)" : "#ffffff";

  const emailBody = encodeURIComponent(
    `I'm interested in the "${pack.title}" package from winded.vertigo.\n\nQuadrant: ${state.audience} × ${state.mode}\nServices: ${state.focus.join(", ")}\nGoals: ${state.goals.join(", ")}\n\n${pack.promise}\n\nLearn more at windedvertigo.com`,
  );

  return (
    <div style={{ paddingTop: 10, paddingBottom: 40, maxWidth: 540, margin: "0 auto" }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 10, textTransform: "lowercase", color: qc.css }}>
        {pack.title}
      </h1>
      <p style={{ fontSize: 16, color: "#ffffff", marginBottom: 20, lineHeight: 1.5 }}>
        {pack.promise}
      </p>

      {/* Tags */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {[state.audience, state.mode, `${state.focus.length} service${state.focus.length > 1 ? "s" : ""}`, `${state.goals.length} goal${state.goals.length > 1 ? "s" : ""}`].map((label, i) => (
          <span key={i} style={{ background: qc.css, color: tagTextColor, padding: "6px 14px", fontSize: 12, fontWeight: 700, textTransform: "lowercase" }}>
            {label}
          </span>
        ))}
      </div>

      {/* Quadrant context */}
      <div
        style={{
          background: "var(--color-surface-raised, #1e2738)",
          padding: 24,
          marginBottom: 28,
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Matrix state={state} expanded />
        {pack.quadrantStory && (
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, marginTop: 20, textAlign: "center" }}>
            {pack.quadrantStory}
          </p>
        )}
      </div>

      {/* Outcomes */}
      {pack.outcomes.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: qc.css, marginBottom: 16, textTransform: "lowercase", letterSpacing: 0.5 }}>
            what you&apos;ll get
          </div>
          {pack.outcomes.map((o, i) => (
            <div
              key={i}
              style={{
                padding: "16px 20px",
                background: "#3a4459",
                marginBottom: 8,
                borderLeft: `3px solid ${qc.css}`,
                borderRadius: "0 6px 6px 0",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{o.title}</div>
              {o.detail && (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{o.detail}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Story + crossover */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: qc.css, marginBottom: 16, textTransform: "lowercase", letterSpacing: 0.5 }}>
          how we&apos;ll work together
        </div>
        {pack.story && (
          <div
            style={{
              padding: 20,
              background: "var(--color-surface-raised, #1e2738)",
              border: "1px solid #3a4459",
              borderRadius: 8,
              fontSize: 14,
              lineHeight: 1.8,
              color: "rgba(255,255,255,0.7)",
              marginBottom: 16,
            }}
          >
            {pack.story}
          </div>
        )}
        {pack.crossover && (
          <div
            style={{
              padding: 16,
              background: `color-mix(in srgb, ${qc.hex} 15%, transparent)`,
              borderLeft: `3px solid ${qc.css}`,
              borderRadius: "0 6px 6px 0",
              fontSize: 13,
              lineHeight: 1.7,
              color: "var(--wv-champagne, #ffebd2)",
              fontStyle: "italic",
            }}
          >
            <strong style={{ fontStyle: "normal" }}>crossing boundaries:</strong> {pack.crossover}
          </div>
        )}
      </div>

      {/* Examples */}
      {pack.examples.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: qc.css, marginBottom: 16, textTransform: "lowercase", letterSpacing: 0.5 }}>
            see it in action
          </div>
          {pack.examples.map((ex) => (
            <button
              key={ex.id}
              className={styles.exampleCard}
              onClick={() => setActiveExample(ex )}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <span style={{ fontSize: 28, lineHeight: 1 }}>{ex.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, textTransform: "lowercase", color: "#ffffff" }}>
                    {ex.title}
                  </div>
                  {ex.type && (
                    <div style={{ fontSize: 11, color: qc.css, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {ex.type}
                    </div>
                  )}
                  {ex.detail && (
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{ex.detail}</div>
                  )}
                </div>
                <span style={{ color: qc.css, fontSize: 20, fontWeight: 700 }}>→</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* CTAs */}
      <div className={styles.ctaRow} style={{ display: "flex", gap: 10, marginTop: 32 }}>
        <a
          href={ctaLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.ctaBtn} ${styles.primary}`}
        >
          book a playdate
        </a>
        <a
          href={`mailto:?subject=My winded.vertigo package: ${encodeURIComponent(pack.title)}&body=${emailBody}`}
          className={`${styles.ctaBtn} ${styles.secondary}`}
        >
          email package
        </a>
        <button className={`${styles.ctaBtn} ${styles.outline}`} onClick={onStartOver}>
          start over
        </button>
      </div>

      {/* Asset preview modal */}
      {activeExample && (
        <AssetModal
          asset={activeExample}
          allAssets={allExamples}
          onClose={closeModal}
          onOpenRelated={(a) => setActiveExample(a)}
        />
      )}
    </div>
  );
}

/* ── Main Wizard Component ── */

export function PackageBuilderWizard({ packs, ctaLink = "https://calendar.app.google/ZXVqJLdprmUZk1DW6" }: Props) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    audience: null,
    mode: null,
    focus: [],
    goals: [],
  });

  const quadrant = getQuadrant(state);

  const advance = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, step: prev.step - 1 };
      // Clear downstream selections so stale picks from a previous
      // quadrant don't carry into the result when the user re-advances
      if (prev.step === 3) next.focus = [];
      if (prev.step === 4) next.goals = [];
      return next;
    });
  }, []);

  const goNext = useCallback(() => {
    setState((prev) => ({ ...prev, step: prev.step + 1 }));
  }, []);

  const startOver = useCallback(() => {
    setState({ step: 1, audience: null, mode: null, focus: [], goals: [] });
  }, []);

  // Flatten all examples across all packs for the modal's "related work" pool
  const allExamples = useMemo<ModalAsset[]>(() => {
    const seen = new Set<string>();
    const result: ModalAsset[] = [];
    for (const pack of Object.values(packs)) {
      for (const ex of pack.examples) {
        if (!seen.has(ex.id)) {
          seen.add(ex.id);
          result.push(ex );
        }
      }
    }
    return result;
  }, [packs]);

  if (Object.keys(packs).length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>loading packages…</p>;
  }

  /* Step 5: Result */
  if (state.step === 5) {
    if (quadrant && packs[quadrant]) {
      return (
        <ResultPage state={state} pack={packs[quadrant]} ctaLink={ctaLink} onStartOver={startOver} allExamples={allExamples} />
      );
    }
    // Graceful fallback — pack data missing for this quadrant
    return (
      <div style={{ textAlign: "center", padding: "var(--space-2xl) 0" }}>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-lg)" }}>
          something went wrong loading your package.
        </p>
        <button className={styles.navBtn} onClick={startOver}>start over</button>
      </div>
    );
  }

  /* Steps 1–4 */
  const handleSelect = (field: "audience" | "mode", value: string) => {
    advance({ [field]: value, step: state.step + 1 });
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <p className={styles.pbIntro} style={{ width: "100%", maxWidth: 420, textAlign: "center", padding: "0 20px 16px", fontSize: 13, color: "#ffffff", lineHeight: 1.5 }}>
        get to know us by building your custom learning experience package
      </p>

      <ProgressDots step={state.step} />

      {/* Two-zone layout: top content flows normally, matrix is absolutely pinned (desktop) / flows (mobile) */}
      <div className={styles.wizardBody}>
        {/* Top zone: question + choices — fixed heights so nothing shifts */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Question: fixed height for 2 lines (24px * 1.3 line-height * 2 lines + 24px margin) */}
          <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: "center", textTransform: "lowercase", lineHeight: 1.3, marginBottom: 24, minHeight: "3.6em", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            {QUESTIONS[state.step]}
          </h2>

          {/* Button area: fixed height for 3 rows of buttons + helper text */}
          <div style={{ width: "100%", maxWidth: 340, minHeight: 195 }}>
            {state.step === 1 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {["people", "product"].map((v) => (
                  <ChoiceButton
                    key={v}
                    label={v}
                    desc={INSIGHTS[v]}
                    selected={state.audience === v}
                    size="large"
                    onClick={() => handleSelect("audience", v)}
                  />
                ))}
              </div>
            )}

            {state.step === 2 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {["design", "research"].map((v) => (
                  <ChoiceButton
                    key={v}
                    label={v}
                    desc={INSIGHTS[v]}
                    selected={state.mode === v}
                    size="large"
                    onClick={() => handleSelect("mode", v)}
                  />
                ))}
              </div>
            )}

            {state.step === 3 && quadrant && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {(SERVICES[quadrant] || []).map((svc) => (
                    <ChoiceButton
                      key={svc.value}
                      label={svc.label}
                      desc={svc.desc}
                      selected={state.focus.includes(svc.value)}
                      onClick={() => advance({ focus: toggleArray(state.focus, svc.value) })}
                    />
                  ))}
                </div>
                <p style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.7)", textAlign: "center" }}>
                  select one or more
                </p>
              </>
            )}

            {state.step === 4 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {OUTCOMES.map((opt) => (
                    <ChoiceButton
                      key={opt.value}
                      label={opt.label}
                      desc={opt.desc}
                      selected={state.goals.includes(opt.value)}
                      onClick={() => advance({ goals: toggleArray(state.goals, opt.value) })}
                    />
                  ))}
                </div>
                <p style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.7)", textAlign: "center" }}>
                  select one or more
                </p>
              </>
            )}
          </div>
        </div>

        {/* Bottom zone: matrix pinned on desktop, flows on mobile */}
        <div className={styles.matrixZone}>
          <Matrix state={state} />

          {/* Nav buttons — fixed-height slot so buttons appearing/disappearing
              don't shift the matrix above. 50px fits the tallest button state. */}
          <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 12, minHeight: 50 }}>
            {state.step > 1 && (
              <button className={styles.navBtn} onClick={goBack}>
                back
              </button>
            )}
            {state.step === 3 && state.focus.length > 0 && (
              <button className={`${styles.navBtn} ${styles.primary}`} onClick={goNext}>
                next
              </button>
            )}
            {state.step === 4 && state.goals.length > 0 && (
              <button className={`${styles.navBtn} ${styles.primary}`} onClick={goNext}>
                see your pack
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
