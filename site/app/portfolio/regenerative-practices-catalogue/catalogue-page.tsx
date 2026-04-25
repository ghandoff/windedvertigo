"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { RegenerativePractice, CatalogueSchema } from "@/lib/notion";
import styles from "./catalogue.module.css";

// ── colour palettes for dimension tags ────────────────────
const DIM_PALETTES = [
  { bg: "var(--wv-cadet)", text: "var(--wv-champagne)" },
  { bg: "var(--wv-redwood)", text: "var(--wv-white)" },
  { bg: "var(--wv-sienna)", text: "var(--wv-white)" },
  { bg: "var(--wv-champagne)", text: "var(--wv-cadet)" },
  { bg: "#3d4f6e", text: "var(--wv-champagne)" },
  { bg: "#8a3b30", text: "var(--wv-white)" },
];

const COVER_FALLBACKS = [
  "var(--wv-cadet)",
  "var(--wv-redwood)",
  "var(--wv-sienna)",
];

function dimPalette(dim: string, allDims: string[]) {
  const idx = allDims.indexOf(dim);
  return DIM_PALETTES[(idx < 0 ? 0 : idx) % DIM_PALETTES.length];
}

function toggleArr(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

function renderSteps(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim().replace(/^\d+[\.\)]\s*/, ""))
    .filter(Boolean);
}

// ── main export ───────────────────────────────────────────

export function CataloguePage({
  practices,
  schema,
}: {
  practices: RegenerativePractice[];
  schema: CatalogueSchema;
}) {
  const [view, setView] = useState<"form" | "gallery">("form");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    tagline: "",
    author: "",
    dimensions: [] as string[],
    duration: "",
    formats: [] as string[],
    levels: [] as string[],
    objective: "",
    instructions: "",
    materials: "",
  });

  const [activeDimensions, setActiveDimensions] = useState<string[]>([]);
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [activeDuration, setActiveDuration] = useState("");
  const [selectedPractice, setSelectedPractice] =
    useState<RegenerativePractice | null>(null);

  const filtered = practices.filter((p) => {
    if (
      activeDimensions.length > 0 &&
      !activeDimensions.some((d) => p.dimensions.includes(d))
    )
      return false;
    if (
      activeFormats.length > 0 &&
      !activeFormats.some((f) => p.formats.includes(f))
    )
      return false;
    if (activeDuration && p.duration !== activeDuration) return false;
    return true;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !formData.name.trim() ||
      !formData.instructions.trim() ||
      formData.dimensions.length === 0
    ) {
      setFormError(
        "please fill in: practice name, at least one regenerative dimension, and the step-by-step instructions.",
      );
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/catalogue-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "submission failed");
      }
      setView("gallery");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (view === "form") {
    return (
      <FormView
        schema={schema}
        formData={formData}
        onChange={setFormData}
        onSubmit={handleSubmit}
        submitting={submitting}
        error={formError}
      />
    );
  }

  return (
    <GalleryView
      practices={filtered}
      allPractices={practices}
      schema={schema}
      activeDimensions={activeDimensions}
      activeFormats={activeFormats}
      activeDuration={activeDuration}
      onToggleDimension={(d) => setActiveDimensions((prev) => toggleArr(prev, d))}
      onToggleFormat={(f) => setActiveFormats((prev) => toggleArr(prev, f))}
      onToggleDuration={(d) =>
        setActiveDuration((prev) => (prev === d ? "" : d))
      }
      onClearFilters={() => {
        setActiveDimensions([]);
        setActiveFormats([]);
        setActiveDuration("");
      }}
      selectedPractice={selectedPractice}
      onSelectPractice={setSelectedPractice}
    />
  );
}

// ── form view ─────────────────────────────────────────────

interface FormState {
  name: string;
  tagline: string;
  author: string;
  dimensions: string[];
  duration: string;
  formats: string[];
  levels: string[];
  objective: string;
  instructions: string;
  materials: string;
}

function FormView({
  schema,
  formData,
  onChange,
  onSubmit,
  submitting,
  error,
}: {
  schema: CatalogueSchema;
  formData: FormState;
  onChange: (data: FormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  error: string | null;
}) {
  function set(field: keyof FormState, value: FormState[keyof FormState]) {
    onChange({ ...formData, [field]: value });
  }

  function toggleMulti(
    field: "dimensions" | "formats" | "levels",
    value: string,
  ) {
    onChange({ ...formData, [field]: toggleArr(formData[field] as string[], value) });
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <div className={styles.formIntro}>
          <span className={styles.contextLabel}>PPCS · regenerative practices open library</span>
          <h1 className={styles.pageTitle}>add your practice.</h1>
          <p className={styles.introText}>
            share a regenerative teaching practice you designed in session 5b.
            once submitted, you&apos;ll be able to explore the full catalogue of
            practices contributed by your peers.
          </p>
        </div>

        <form className={styles.form} onSubmit={onSubmit} noValidate>

          {/* section 1: basic info */}
          <fieldset className={styles.formSection}>
            <legend className={styles.formSectionTitle}>the practice</legend>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="practice-name">
                practice name <span className={styles.required}>*</span>
              </label>
              <input
                id="practice-name"
                type="text"
                className={styles.input}
                placeholder="e.g. the listening circle"
                value={formData.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="tagline">
                tagline
                <span className={styles.optional}> — one sentence that captures the spirit of this practice</span>
              </label>
              <input
                id="tagline"
                type="text"
                className={styles.input}
                placeholder="e.g. slow down to notice what usually goes unheard"
                value={formData.tagline}
                onChange={(e) => set("tagline", e.target.value)}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="author">
                your name
                <span className={styles.optional}> — appears as practice author in the gallery</span>
              </label>
              <input
                id="author"
                type="text"
                className={styles.input}
                placeholder="e.g. dr. amara osei"
                value={formData.author}
                onChange={(e) => set("author", e.target.value)}
              />
            </div>
          </fieldset>

          {/* section 2: classification */}
          <fieldset className={styles.formSection}>
            <legend className={styles.formSectionTitle}>classification</legend>

            {schema.dimensions.length > 0 && (
              <div className={styles.fieldGroup}>
                <span className={styles.label}>
                  regenerative dimension <span className={styles.required}>*</span>
                  <span className={styles.optional}> — select all that apply</span>
                </span>
                <div className={styles.checkboxGroup} role="group" aria-label="regenerative dimension">
                  {schema.dimensions.map((dim) => {
                    const palette = dimPalette(dim, schema.dimensions);
                    const checked = formData.dimensions.includes(dim);
                    return (
                      <label
                        key={dim}
                        className={`${styles.checkLabel} ${checked ? styles.checkLabelActive : ""}`}
                        style={
                          checked
                            ? {
                                backgroundColor: palette.bg,
                                color: palette.text,
                                borderColor: palette.bg,
                              }
                            : undefined
                        }
                      >
                        <input
                          type="checkbox"
                          className={styles.checkInput}
                          checked={checked}
                          onChange={() => toggleMulti("dimensions", dim)}
                        />
                        {dim}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {schema.durations.length > 0 && (
              <div className={styles.fieldGroup}>
                <span className={styles.label}>duration</span>
                <div className={styles.radioGroup} role="group" aria-label="duration">
                  {schema.durations.map((d) => (
                    <label
                      key={d}
                      className={`${styles.radioLabel} ${formData.duration === d ? styles.radioLabelActive : ""}`}
                    >
                      <input
                        type="radio"
                        className={styles.checkInput}
                        name="duration"
                        checked={formData.duration === d}
                        onChange={() =>
                          set("duration", formData.duration === d ? "" : d)
                        }
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {schema.formats.length > 0 && (
              <div className={styles.fieldGroup}>
                <span className={styles.label}>
                  format
                  <span className={styles.optional}> — select all that apply</span>
                </span>
                <div className={styles.checkboxGroup} role="group" aria-label="format">
                  {schema.formats.map((f) => (
                    <label
                      key={f}
                      className={`${styles.checkLabel} ${formData.formats.includes(f) ? styles.checkLabelActive : ""}`}
                    >
                      <input
                        type="checkbox"
                        className={styles.checkInput}
                        checked={formData.formats.includes(f)}
                        onChange={() => toggleMulti("formats", f)}
                      />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {schema.levels.length > 0 && (
              <div className={styles.fieldGroup}>
                <span className={styles.label}>
                  learning level
                  <span className={styles.optional}> — select all that apply</span>
                </span>
                <div className={styles.checkboxGroup} role="group" aria-label="learning level">
                  {schema.levels.map((l) => (
                    <label
                      key={l}
                      className={`${styles.checkLabel} ${formData.levels.includes(l) ? styles.checkLabelActive : ""}`}
                    >
                      <input
                        type="checkbox"
                        className={styles.checkInput}
                        checked={formData.levels.includes(l)}
                        onChange={() => toggleMulti("levels", l)}
                      />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </fieldset>

          {/* section 3: practice content */}
          <fieldset className={styles.formSection}>
            <legend className={styles.formSectionTitle}>the content</legend>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="objective">
                learning objective
                <span className={styles.optional}> — what will participants gain or experience?</span>
              </label>
              <textarea
                id="objective"
                className={styles.textarea}
                rows={3}
                placeholder="e.g. participants will develop the capacity to notice extractive assumptions in their own teaching..."
                value={formData.objective}
                onChange={(e) => set("objective", e.target.value)}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="instructions">
                step-by-step instructions <span className={styles.required}>*</span>
                <span className={styles.optional}> — number each step on a new line</span>
              </label>
              <textarea
                id="instructions"
                className={`${styles.textarea} ${styles.textareaLarge}`}
                rows={8}
                placeholder={"1. begin by...\n2. invite participants to...\n3. after ten minutes..."}
                value={formData.instructions}
                onChange={(e) => set("instructions", e.target.value)}
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="materials">
                materials needed
                <span className={styles.optional}> — leave blank if none required</span>
              </label>
              <textarea
                id="materials"
                className={styles.textarea}
                rows={3}
                placeholder="e.g. sticky notes, markers, one sheet of paper per participant"
                value={formData.materials}
                onChange={(e) => set("materials", e.target.value)}
              />
            </div>
          </fieldset>

          {error && (
            <div className={styles.formError} role="alert">
              {error}
            </div>
          )}

          <div className={styles.formActions}>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? "submitting…" : "submit and explore the catalogue →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── gallery view ──────────────────────────────────────────

function GalleryView({
  practices,
  allPractices,
  schema,
  activeDimensions,
  activeFormats,
  activeDuration,
  onToggleDimension,
  onToggleFormat,
  onToggleDuration,
  onClearFilters,
  selectedPractice,
  onSelectPractice,
}: {
  practices: RegenerativePractice[];
  allPractices: RegenerativePractice[];
  schema: CatalogueSchema;
  activeDimensions: string[];
  activeFormats: string[];
  activeDuration: string;
  onToggleDimension: (d: string) => void;
  onToggleFormat: (f: string) => void;
  onToggleDuration: (d: string) => void;
  onClearFilters: () => void;
  selectedPractice: RegenerativePractice | null;
  onSelectPractice: (p: RegenerativePractice | null) => void;
}) {
  const hasFilters =
    activeDimensions.length > 0 || activeFormats.length > 0 || !!activeDuration;

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <div className={styles.galleryIntro}>
          <span className={styles.contextLabel}>PPCS · regenerative practices open library</span>
          <h1 className={styles.pageTitle}>the catalogue.</h1>
          <p className={styles.introText}>
            {allPractices.length > 0
              ? `${allPractices.length} regenerative teaching ${allPractices.length === 1 ? "practice" : "practices"} contributed by PPCS faculty. your submission has been received — it will appear here once reviewed.`
              : "your submission has been received. practices will appear here once reviewed. check back soon."}
          </p>
        </div>

        {/* filter bar */}
        {(schema.dimensions.length > 0 || schema.formats.length > 0 || schema.durations.length > 0) && (
          <div className={styles.filterBar}>
            {schema.dimensions.length > 0 && (
              <div className={styles.filterGroup}>
                <span className={styles.filterGroupLabel}>dimension</span>
                <div className={styles.filterToggleRow}>
                  {schema.dimensions.map((d) => {
                    const palette = dimPalette(d, schema.dimensions);
                    const active = activeDimensions.includes(d);
                    return (
                      <button
                        key={d}
                        className={`${styles.filterToggle} ${active ? styles.filterToggleActive : ""}`}
                        style={
                          active
                            ? { backgroundColor: palette.bg, color: palette.text, borderColor: palette.bg }
                            : undefined
                        }
                        onClick={() => onToggleDimension(d)}
                        aria-pressed={active}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {schema.formats.length > 0 && (
              <div className={styles.filterGroup}>
                <span className={styles.filterGroupLabel}>format</span>
                <div className={styles.filterToggleRow}>
                  {schema.formats.map((f) => {
                    const active = activeFormats.includes(f);
                    return (
                      <button
                        key={f}
                        className={`${styles.filterToggle} ${active ? styles.filterToggleActive : ""}`}
                        onClick={() => onToggleFormat(f)}
                        aria-pressed={active}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {schema.durations.length > 0 && (
              <div className={styles.filterGroup}>
                <span className={styles.filterGroupLabel}>duration</span>
                <div className={styles.filterToggleRow}>
                  {schema.durations.map((d) => {
                    const active = activeDuration === d;
                    return (
                      <button
                        key={d}
                        className={`${styles.filterToggle} ${active ? styles.filterToggleActive : ""}`}
                        onClick={() => onToggleDuration(d)}
                        aria-pressed={active}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {hasFilters && (
              <button className={styles.clearFilters} onClick={onClearFilters}>
                clear filters
              </button>
            )}
          </div>
        )}

        {/* grid */}
        {practices.length === 0 && allPractices.length > 0 ? (
          <div className={styles.emptyFiltered}>
            <p>no practices match the current filters.</p>
            <button className={styles.clearFilters} onClick={onClearFilters}>
              clear filters
            </button>
          </div>
        ) : allPractices.length === 0 ? (
          <div className={styles.emptyState}>
            <p>no practices yet — yours will be the first.</p>
            <p className={styles.emptySubtext}>
              this catalogue grows every time a PPCS participant completes session 5b.
            </p>
          </div>
        ) : (
          <div className={styles.grid}>
            {practices.map((practice, index) => (
              <PracticeCard
                key={practice.id}
                practice={practice}
                schema={schema}
                index={index}
                onClick={() => onSelectPractice(practice)}
              />
            ))}
          </div>
        )}
      </div>

      {/* modal */}
      {selectedPractice && (
        <PracticeModal
          practice={selectedPractice}
          schema={schema}
          onClose={() => onSelectPractice(null)}
        />
      )}
    </div>
  );
}

// ── practice card ─────────────────────────────────────────

function PracticeCard({
  practice,
  schema,
  index,
  onClick,
}: {
  practice: RegenerativePractice;
  schema: CatalogueSchema;
  index: number;
  onClick: () => void;
}) {
  const fallback = COVER_FALLBACKS[index % COVER_FALLBACKS.length];

  return (
    <article className={styles.card} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      aria-label={`view details for ${practice.name}`}
    >
      {/* cover */}
      <div
        className={styles.cardCover}
        style={
          practice.coverImage
            ? { backgroundImage: `url(${practice.coverImage})` }
            : { background: fallback }
        }
      />

      {/* body */}
      <div className={styles.cardBody}>
        <h2 className={styles.cardTitle}>{practice.name}</h2>
        {practice.tagline && (
          <p className={styles.cardTagline}>{practice.tagline}</p>
        )}

        {practice.dimensions.length > 0 && (
          <div className={styles.cardTags}>
            {practice.dimensions.map((dim) => {
              const palette = dimPalette(dim, schema.dimensions);
              return (
                <span
                  key={dim}
                  className={styles.dimTag}
                  style={{ backgroundColor: palette.bg, color: palette.text }}
                >
                  {dim}
                </span>
              );
            })}
          </div>
        )}

        <div className={styles.cardMeta}>
          {practice.duration && (
            <span className={styles.metaPill}>{practice.duration}</span>
          )}
          {practice.formats.map((f) => (
            <span key={f} className={styles.metaPill}>{f}</span>
          ))}
        </div>
      </div>

      {practice.author && (
        <div className={styles.cardFooter}>
          <span className={styles.cardAuthor}>{practice.author}</span>
        </div>
      )}
    </article>
  );
}

// ── practice modal ────────────────────────────────────────

function PracticeModal({
  practice,
  schema,
  onClose,
}: {
  practice: RegenerativePractice;
  schema: CatalogueSchema;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const steps = renderSteps(practice.instructions);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={practice.name}
    >
      <div className={styles.panel} ref={panelRef}>
        <button
          className={styles.panelClose}
          onClick={onClose}
          aria-label="close"
        >
          ×
        </button>

        {/* cover strip */}
        {practice.coverImage && (
          <div
            className={styles.panelCover}
            style={{ backgroundImage: `url(${practice.coverImage})` }}
          />
        )}

        <div className={styles.panelContent}>
          {/* dimensions */}
          {practice.dimensions.length > 0 && (
            <div className={styles.panelTags}>
              {practice.dimensions.map((dim) => {
                const palette = dimPalette(dim, schema.dimensions);
                return (
                  <span
                    key={dim}
                    className={styles.dimTag}
                    style={{ backgroundColor: palette.bg, color: palette.text }}
                  >
                    {dim}
                  </span>
                );
              })}
            </div>
          )}

          <h2 className={styles.panelTitle}>{practice.name}</h2>
          {practice.tagline && (
            <p className={styles.panelTagline}>{practice.tagline}</p>
          )}

          {/* meta pills */}
          <div className={styles.panelMeta}>
            {practice.duration && (
              <span className={styles.metaPill}>{practice.duration}</span>
            )}
            {practice.formats.map((f) => (
              <span key={f} className={styles.metaPill}>{f}</span>
            ))}
            {practice.levels.map((l) => (
              <span key={l} className={`${styles.metaPill} ${styles.metaPillLight}`}>{l}</span>
            ))}
          </div>

          {/* objective */}
          {practice.objective && (
            <div className={styles.panelSection}>
              <h3 className={styles.panelSectionTitle}>learning objective</h3>
              <p className={styles.panelBody}>{practice.objective}</p>
            </div>
          )}

          {/* instructions */}
          {steps.length > 0 && (
            <div className={styles.panelSection}>
              <h3 className={styles.panelSectionTitle}>step-by-step</h3>
              <ol className={styles.steps}>
                {steps.map((step, i) => (
                  <li key={i} className={styles.step}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* materials */}
          {practice.materials && (
            <div className={styles.panelSection}>
              <h3 className={styles.panelSectionTitle}>materials needed</h3>
              <p className={styles.panelBody}>{practice.materials}</p>
            </div>
          )}

          {/* author */}
          {practice.author && (
            <div className={styles.panelAuthor}>
              contributed by {practice.author}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
