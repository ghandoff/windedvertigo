"use client";

import { useState, useCallback } from "react";
import type { Activity, ActivityType, ActivityConfig, Phase, PollOption, PuzzlePiece, SortingCard, SortingCategory, SandboxParameter } from "@/lib/types";
import type { InteractionModel, SocialStructure, Tempo, MechanicMetadata } from "@/lib/types";

interface Props {
  onLaunch: (activities: Activity[]) => void;
  disabled?: boolean;
}

const ACTIVITY_TYPES: { type: ActivityType; label: string; icon: string }[] = [
  { type: "poll", label: "poll", icon: "📊" },
  { type: "prediction", label: "prediction", icon: "🔮" },
  { type: "reflection", label: "reflection", icon: "💭" },
  { type: "open-response", label: "open response", icon: "✍️" },
  { type: "sorting", label: "sorting", icon: "🗂️" },
  { type: "canvas", label: "canvas", icon: "📍" },
  { type: "rule-sandbox", label: "rule sandbox", icon: "🔬" },
  { type: "puzzle", label: "puzzle", icon: "🧩" },
  { type: "asymmetric", label: "asymmetric", icon: "🎭" },
];

const PHASES: Phase[] = ["encounter", "struggle", "threshold", "integration", "application"];

const INTERACTION_MODELS: { value: InteractionModel; label: string }[] = [
  { value: "sandbox", label: "sandbox" },
  { value: "construction", label: "construction" },
  { value: "reveal", label: "reveal" },
  { value: "negotiation", label: "negotiation" },
  { value: "performance", label: "performance" },
  { value: "investigation", label: "investigation" },
  { value: "competition", label: "competition" },
  { value: "framing", label: "framing" },
];

const SOCIAL_STRUCTURES: { value: SocialStructure; label: string }[] = [
  { value: "solo", label: "solo" },
  { value: "cooperative", label: "cooperative" },
  { value: "asymmetric", label: "asymmetric" },
  { value: "competitive", label: "competitive" },
  { value: "anonymous", label: "anonymous" },
  { value: "audience", label: "audience" },
];

const TEMPOS: { value: Tempo; label: string }[] = [
  { value: "contemplative", label: "contemplative" },
  { value: "paced", label: "paced" },
  { value: "timed", label: "timed" },
  { value: "rapid-fire", label: "rapid-fire" },
  { value: "real-time", label: "real-time" },
];

let _builderId = 0;
function uid(): string {
  return `custom_${++_builderId}_${Date.now().toString(36)}`;
}

function defaultConfig(type: ActivityType): ActivityConfig {
  switch (type) {
    case "poll":
      return {
        type: "poll",
        poll: {
          question: "",
          options: [
            { id: "a", label: "" },
            { id: "b", label: "" },
          ],
        },
      };
    case "prediction":
      return {
        type: "prediction",
        prediction: { question: "", type: "text" },
      };
    case "reflection":
      return {
        type: "reflection",
        reflection: { prompt: "", minLength: 50, shareWithGroup: true },
      };
    case "open-response":
      return {
        type: "open-response",
        openResponse: { prompt: "", responseType: "text", anonymous: false },
      };
    case "sorting":
      return {
        type: "sorting",
        sorting: {
          prompt: "",
          cards: [{ id: "c1", content: "" }],
          categories: [
            { id: "cat1", label: "" },
            { id: "cat2", label: "" },
          ],
        },
      };
    case "canvas":
      return {
        type: "canvas",
        canvas: { prompt: "", width: 100, height: 100, allowNote: true },
      };
    case "rule-sandbox":
      return {
        type: "rule-sandbox",
        ruleSandbox: {
          prompt: "",
          parameters: [{ id: "x", label: "x", min: 0, max: 100, step: 1, defaultValue: 50 }],
          formula: "x",
          outputLabel: "result",
          reflectionPrompt: "what did you notice?",
        },
      };
    case "puzzle":
      return {
        type: "puzzle",
        puzzle: {
          prompt: "",
          pieces: [
            { id: "p1", content: "" },
            { id: "p2", content: "" },
          ],
          solution: ["p1", "p2"],
        },
      };
    case "asymmetric":
      return {
        type: "asymmetric",
        asymmetric: {
          scenario: "",
          roles: [{ id: "r1", label: "", info: "", question: "" }],
          discussionPrompt: "",
        },
      };
  }
}

interface DraftActivity {
  id: string;
  type: ActivityType;
  config: ActivityConfig;
  phase: Phase;
  label: string;
  mechanic?: MechanicMetadata;
}

export function SessionBuilder({ onLaunch, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [activities, setActivities] = useState<DraftActivity[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  const addActivity = useCallback((type: ActivityType) => {
    const id = uid();
    const draft: DraftActivity = {
      id,
      type,
      config: defaultConfig(type),
      phase: "encounter",
      label: "",
    };
    setActivities((prev) => [...prev, draft]);
    setEditing(id);
  }, []);

  const updateActivity = useCallback((id: string, updates: Partial<DraftActivity>) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    );
  }, []);

  const removeActivity = useCallback((id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
    setEditing((prev) => (prev === id ? null : prev));
  }, []);

  const updateMechanic = useCallback(
    (index: number, key: keyof MechanicMetadata, value: string | undefined) => {
      setActivities((prev) =>
        prev.map((a, i) =>
          i === index
            ? {
                ...a,
                mechanic: {
                  ...a.mechanic,
                  [key]: value,
                },
              }
            : a,
        ),
      );
    },
    [],
  );

  const moveActivity = useCallback((id: string, direction: -1 | 1) => {
    setActivities((prev) => {
      const idx = prev.findIndex((a) => a.id === id);
      if (idx < 0) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  const handleLaunch = () => {
    const built: Activity[] = activities.map((a) => ({
      id: a.id,
      type: a.type,
      config: a.config,
      phase: a.phase,
      label: a.label || `${a.type} activity`,
      mechanic: a.mechanic,
    }));
    onLaunch(built);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full p-5 rounded-2xl border border-dashed border-black/10 text-center hover:border-[var(--rh-cyan)] hover:bg-[var(--rh-cyan)]/5 transition-all"
      >
        <p className="text-sm font-medium text-[var(--rh-teal)]">
          + build a custom session
        </p>
        <p className="text-xs text-[var(--rh-text-muted)] mt-1">
          design your own activity sequence from scratch
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
      {/* header */}
      <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">custom session</h2>
          <p className="text-xs text-[var(--rh-text-muted)]">
            {activities.length} {activities.length === 1 ? "activity" : "activities"}
          </p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-[var(--rh-text-muted)] hover:text-[var(--rh-text)] transition-colors"
        >
          close
        </button>
      </div>

      {/* activity list */}
      <div className="px-5 py-3">
        {activities.length === 0 ? (
          <p className="text-sm text-[var(--rh-text-muted)] text-center py-4">
            add activities below to build your sequence
          </p>
        ) : (
          <div className="space-y-2 mb-4">
            {activities.map((act, i) => (
              <div
                key={act.id}
                className={`rounded-xl border text-sm transition-all ${
                  editing === act.id
                    ? "border-[var(--rh-cyan)] bg-[var(--rh-cyan)]/5"
                    : "border-black/5 bg-[var(--rh-sand-light)]"
                }`}
              >
                {/* activity header row */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className={`phase-dot phase-${act.phase} flex-shrink-0`} />
                  <span className="flex-1 truncate">
                    {act.label || `${act.type} activity`}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveActivity(act.id, -1)}
                      disabled={i === 0}
                      className="w-6 h-6 rounded text-xs hover:bg-black/5 disabled:opacity-20"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveActivity(act.id, 1)}
                      disabled={i === activities.length - 1}
                      className="w-6 h-6 rounded text-xs hover:bg-black/5 disabled:opacity-20"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => setEditing(editing === act.id ? null : act.id)}
                      className="w-6 h-6 rounded text-xs hover:bg-black/5"
                    >
                      {editing === act.id ? "−" : "✎"}
                    </button>
                    <button
                      onClick={() => removeActivity(act.id)}
                      className="w-6 h-6 rounded text-xs text-red-500 hover:bg-red-50"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* edit panel */}
                {editing === act.id && (
                  <div className="px-3 pb-3 space-y-3 border-t border-black/5 pt-3">
                    {/* label + phase */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-[var(--rh-text-muted)]">
                          label
                        </label>
                        <input
                          type="text"
                          value={act.label}
                          onChange={(e) => updateActivity(act.id, { label: e.target.value })}
                          placeholder={`${act.type} activity`}
                          className="w-full px-2 py-1.5 rounded-lg border border-black/10 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-[var(--rh-text-muted)]">
                          phase
                        </label>
                        <select
                          value={act.phase}
                          onChange={(e) => updateActivity(act.id, { phase: e.target.value as Phase })}
                          className="w-full px-2 py-1.5 rounded-lg border border-black/10 text-sm bg-white"
                        >
                          {PHASES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* type-specific config */}
                    <ConfigEditor
                      activity={act}
                      onChange={(config) => updateActivity(act.id, { config })}
                    />

                    <details className="mt-4 border-t border-black/5 pt-3">
                      <summary className="text-xs font-semibold uppercase tracking-wider text-[var(--rh-text-muted)] cursor-pointer hover:text-[var(--rh-text)]">
                        mechanics
                      </summary>
                      <div className="mt-3 space-y-3">
                        <div>
                          <p className="text-xs text-[var(--rh-text-muted)] mb-1.5">interaction model</p>
                          <div className="flex flex-wrap gap-1.5">
                            {INTERACTION_MODELS.map((m) => (
                              <button
                                key={m.value}
                                type="button"
                                onClick={() => updateMechanic(i, "interactionModel", act.mechanic?.interactionModel === m.value ? undefined : m.value)}
                                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                                  act.mechanic?.interactionModel === m.value
                                    ? "border-[var(--rh-cyan)] bg-[var(--rh-cyan)]/10 text-[var(--rh-teal)] font-medium"
                                    : "border-black/10 hover:bg-black/5"
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--rh-text-muted)] mb-1.5">social structure</p>
                          <div className="flex flex-wrap gap-1.5">
                            {SOCIAL_STRUCTURES.map((s) => (
                              <button
                                key={s.value}
                                type="button"
                                onClick={() => updateMechanic(i, "socialStructure", act.mechanic?.socialStructure === s.value ? undefined : s.value)}
                                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                                  act.mechanic?.socialStructure === s.value
                                    ? "border-[var(--rh-cyan)] bg-[var(--rh-cyan)]/10 text-[var(--rh-teal)] font-medium"
                                    : "border-black/10 hover:bg-black/5"
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--rh-text-muted)] mb-1.5">tempo</p>
                          <div className="flex flex-wrap gap-1.5">
                            {TEMPOS.map((t) => (
                              <button
                                key={t.value}
                                type="button"
                                onClick={() => updateMechanic(i, "tempo", act.mechanic?.tempo === t.value ? undefined : t.value)}
                                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                                  act.mechanic?.tempo === t.value
                                    ? "border-[var(--rh-cyan)] bg-[var(--rh-cyan)]/10 text-[var(--rh-teal)] font-medium"
                                    : "border-black/10 hover:bg-black/5"
                                }`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* add activity buttons */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--rh-text-muted)] mb-2">
            add activity
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ACTIVITY_TYPES.map(({ type, label, icon }) => (
              <button
                key={type}
                onClick={() => addActivity(type)}
                className="px-2.5 py-1.5 rounded-lg text-xs border border-black/10 hover:border-[var(--rh-cyan)]/50 hover:bg-[var(--rh-cyan)]/5 transition-colors"
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* launch */}
      {activities.length > 0 && (
        <div className="px-5 py-4 border-t border-black/5">
          <button
            onClick={handleLaunch}
            disabled={disabled}
            className="w-full py-3 rounded-xl bg-[var(--rh-teal)] text-white font-semibold hover:bg-[var(--rh-deep)] transition-colors disabled:opacity-50"
          >
            launch session ({activities.length} {activities.length === 1 ? "activity" : "activities"})
          </button>
        </div>
      )}
    </div>
  );
}

// ── config editors per type ──────────────────────────────────────

function ConfigEditor({
  activity,
  onChange,
}: {
  activity: DraftActivity;
  onChange: (config: ActivityConfig) => void;
}) {
  const { config } = activity;

  switch (config.type) {
    case "poll":
      return <PollConfigEditor config={config.poll} onChange={(poll) => onChange({ type: "poll", poll })} />;
    case "prediction":
      return <PredictionConfigEditor config={config.prediction} onChange={(prediction) => onChange({ type: "prediction", prediction })} />;
    case "reflection":
      return <ReflectionConfigEditor config={config.reflection} onChange={(reflection) => onChange({ type: "reflection", reflection })} />;
    case "open-response":
      return <OpenResponseConfigEditor config={config.openResponse} onChange={(openResponse) => onChange({ type: "open-response", openResponse })} />;
    case "sorting":
      return <SortingConfigEditor config={config.sorting} onChange={(sorting) => onChange({ type: "sorting", sorting })} />;
    case "canvas":
      return <CanvasConfigEditor config={config.canvas} onChange={(canvas) => onChange({ type: "canvas", canvas })} />;
    case "rule-sandbox":
      return <RuleSandboxConfigEditor config={config.ruleSandbox} onChange={(ruleSandbox) => onChange({ type: "rule-sandbox", ruleSandbox })} />;
    case "puzzle":
      return <PuzzleConfigEditor config={config.puzzle} onChange={(puzzle) => onChange({ type: "puzzle", puzzle })} />;
    case "asymmetric":
      return <AsymmetricConfigEditor config={config.asymmetric} onChange={(asymmetric) => onChange({ type: "asymmetric", asymmetric })} />;
  }
}

// ── shared input helpers ─────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] uppercase tracking-wider text-[var(--rh-text-muted)] block mb-0.5">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls = "w-full px-2 py-1.5 rounded-lg border border-black/10 text-sm";
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className={`${cls} resize-none`}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cls}
    />
  );
}

// ── poll ──────────────────────────────────────────────────────────

function PollConfigEditor({
  config,
  onChange,
}: {
  config: { question: string; options: PollOption[]; allowMultiple?: boolean };
  onChange: (c: typeof config) => void;
}) {
  const addOption = () => {
    const id = String.fromCharCode(97 + config.options.length);
    onChange({ ...config, options: [...config.options, { id, label: "" }] });
  };
  const removeOption = (i: number) => {
    onChange({ ...config, options: config.options.filter((_, idx) => idx !== i) });
  };
  const updateOption = (i: number, label: string) => {
    const opts = [...config.options];
    opts[i] = { ...opts[i], label };
    onChange({ ...config, options: opts });
  };

  return (
    <div className="space-y-2">
      <div>
        <Label>question</Label>
        <TextInput value={config.question} onChange={(question) => onChange({ ...config, question })} placeholder="what do you think about...?" multiline />
      </div>
      <div>
        <Label>options</Label>
        <div className="space-y-1">
          {config.options.map((opt, i) => (
            <div key={opt.id} className="flex gap-1">
              <TextInput value={opt.label} onChange={(v) => updateOption(i, v)} placeholder={`option ${i + 1}`} />
              {config.options.length > 2 && (
                <button onClick={() => removeOption(i)} className="text-xs text-red-500 px-1">×</button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addOption} className="text-xs text-[var(--rh-teal)] mt-1">+ add option</button>
      </div>
    </div>
  );
}

// ── prediction ───────────────────────────────────────────────────

function PredictionConfigEditor({
  config,
  onChange,
}: {
  config: { question: string; type: "number" | "text" | "choice"; answer?: string | number; unit?: string };
  onChange: (c: typeof config) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label>question</Label>
        <TextInput value={config.question} onChange={(question) => onChange({ ...config, question })} placeholder="predict: how many...?" multiline />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>response type</Label>
          <select
            value={config.type}
            onChange={(e) => onChange({ ...config, type: e.target.value as "number" | "text" })}
            className="w-full px-2 py-1.5 rounded-lg border border-black/10 text-sm bg-white"
          >
            <option value="number">number</option>
            <option value="text">text</option>
          </select>
        </div>
        <div>
          <Label>answer (optional)</Label>
          <TextInput value={String(config.answer ?? "")} onChange={(v) => onChange({ ...config, answer: config.type === "number" ? Number(v) || undefined : v || undefined })} placeholder="correct answer" />
        </div>
        <div>
          <Label>unit (optional)</Label>
          <TextInput value={config.unit ?? ""} onChange={(unit) => onChange({ ...config, unit: unit || undefined })} placeholder="%, $, etc" />
        </div>
      </div>
    </div>
  );
}

// ── reflection ───────────────────────────────────────────────────

function ReflectionConfigEditor({
  config,
  onChange,
}: {
  config: { prompt: string; minLength?: number; shareWithGroup?: boolean };
  onChange: (c: typeof config) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label>prompt</Label>
        <TextInput value={config.prompt} onChange={(prompt) => onChange({ ...config, prompt })} placeholder="reflect on..." multiline />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={config.shareWithGroup ?? false}
            onChange={(e) => onChange({ ...config, shareWithGroup: e.target.checked })}
          />
          share with group
        </label>
      </div>
    </div>
  );
}

// ── open response ────────────────────────────────────────────────

function OpenResponseConfigEditor({
  config,
  onChange,
}: {
  config: { prompt: string; responseType: "text" | "drawing"; anonymous?: boolean };
  onChange: (c: typeof config) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label>prompt</Label>
        <TextInput value={config.prompt} onChange={(prompt) => onChange({ ...config, prompt })} placeholder="describe..." multiline />
      </div>
      <label className="flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={config.anonymous ?? false}
          onChange={(e) => onChange({ ...config, anonymous: e.target.checked })}
        />
        anonymous responses
      </label>
    </div>
  );
}

// ── sorting ──────────────────────────────────────────────────────

function SortingConfigEditor({
  config,
  onChange,
}: {
  config: { prompt: string; cards: SortingCard[]; categories: SortingCategory[]; solution?: Record<string, string> };
  onChange: (c: typeof config) => void;
}) {
  const addCard = () => {
    const id = `c${config.cards.length + 1}`;
    onChange({ ...config, cards: [...config.cards, { id, content: "" }] });
  };
  const addCategory = () => {
    const id = `cat${config.categories.length + 1}`;
    onChange({ ...config, categories: [...config.categories, { id, label: "" }] });
  };

  return (
    <div className="space-y-2">
      <div>
        <Label>prompt</Label>
        <TextInput value={config.prompt} onChange={(prompt) => onChange({ ...config, prompt })} placeholder="sort these into categories..." multiline />
      </div>
      <div>
        <Label>categories</Label>
        <div className="space-y-1">
          {config.categories.map((cat, i) => (
            <div key={cat.id} className="flex gap-1">
              <TextInput
                value={cat.label}
                onChange={(label) => {
                  const cats = [...config.categories];
                  cats[i] = { ...cats[i], label };
                  onChange({ ...config, categories: cats });
                }}
                placeholder={`category ${i + 1}`}
              />
              {config.categories.length > 2 && (
                <button onClick={() => onChange({ ...config, categories: config.categories.filter((_, idx) => idx !== i) })} className="text-xs text-red-500 px-1">×</button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addCategory} className="text-xs text-[var(--rh-teal)] mt-1">+ add category</button>
      </div>
      <div>
        <Label>cards</Label>
        <div className="space-y-1">
          {config.cards.map((card, i) => (
            <div key={card.id} className="flex gap-1">
              <TextInput
                value={card.content}
                onChange={(content) => {
                  const cards = [...config.cards];
                  cards[i] = { ...cards[i], content };
                  onChange({ ...config, cards });
                }}
                placeholder={`card ${i + 1}`}
              />
              {config.cards.length > 1 && (
                <button onClick={() => onChange({ ...config, cards: config.cards.filter((_, idx) => idx !== i) })} className="text-xs text-red-500 px-1">×</button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addCard} className="text-xs text-[var(--rh-teal)] mt-1">+ add card</button>
      </div>
    </div>
  );
}

// ── canvas ───────────────────────────────────────────────────────

function CanvasConfigEditor({
  config,
  onChange,
}: {
  config: { prompt: string; width: number; height: number; xLabel?: string; yLabel?: string; allowNote?: boolean };
  onChange: (c: typeof config) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label>prompt</Label>
        <TextInput value={config.prompt} onChange={(prompt) => onChange({ ...config, prompt })} placeholder="place your pin where..." multiline />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>x axis label</Label>
          <TextInput value={config.xLabel ?? ""} onChange={(xLabel) => onChange({ ...config, xLabel: xLabel || undefined })} placeholder="e.g. simple → complex" />
        </div>
        <div>
          <Label>y axis label</Label>
          <TextInput value={config.yLabel ?? ""} onChange={(yLabel) => onChange({ ...config, yLabel: yLabel || undefined })} placeholder="e.g. low → high" />
        </div>
      </div>
      <label className="flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={config.allowNote ?? false}
          onChange={(e) => onChange({ ...config, allowNote: e.target.checked })}
        />
        allow participants to add a note
      </label>
    </div>
  );
}

// ── rule sandbox ─────────────────────────────────────────────────

function RuleSandboxConfigEditor({
  config,
  onChange,
}: {
  config: {
    prompt: string;
    parameters: SandboxParameter[];
    formula: string;
    outputLabel: string;
    outputUnit?: string;
    reflectionPrompt: string;
  };
  onChange: (c: typeof config) => void;
}) {
  const addParam = () => {
    const id = `p${config.parameters.length + 1}`;
    onChange({
      ...config,
      parameters: [...config.parameters, { id, label: id, min: 0, max: 100, step: 1, defaultValue: 50 }],
    });
  };

  return (
    <div className="space-y-2">
      <div>
        <Label>prompt</Label>
        <TextInput value={config.prompt} onChange={(prompt) => onChange({ ...config, prompt })} placeholder="adjust the parameters to explore..." multiline />
      </div>
      <div>
        <Label>parameters</Label>
        <div className="space-y-2">
          {config.parameters.map((param, i) => (
            <div key={param.id} className="grid grid-cols-5 gap-1 items-end">
              <div>
                <TextInput value={param.label} onChange={(label) => {
                  const params = [...config.parameters];
                  params[i] = { ...params[i], label, id: label.replace(/\s+/g, "_").toLowerCase() || param.id };
                  onChange({ ...config, parameters: params });
                }} placeholder="name" />
              </div>
              <div>
                <input type="number" value={param.min} onChange={(e) => {
                  const params = [...config.parameters];
                  params[i] = { ...params[i], min: Number(e.target.value) };
                  onChange({ ...config, parameters: params });
                }} className="w-full px-2 py-1.5 rounded-lg border border-black/10 text-sm" placeholder="min" />
              </div>
              <div>
                <input type="number" value={param.max} onChange={(e) => {
                  const params = [...config.parameters];
                  params[i] = { ...params[i], max: Number(e.target.value) };
                  onChange({ ...config, parameters: params });
                }} className="w-full px-2 py-1.5 rounded-lg border border-black/10 text-sm" placeholder="max" />
              </div>
              <div>
                <input type="number" value={param.defaultValue} onChange={(e) => {
                  const params = [...config.parameters];
                  params[i] = { ...params[i], defaultValue: Number(e.target.value) };
                  onChange({ ...config, parameters: params });
                }} className="w-full px-2 py-1.5 rounded-lg border border-black/10 text-sm" placeholder="default" />
              </div>
              {config.parameters.length > 1 && (
                <button onClick={() => onChange({ ...config, parameters: config.parameters.filter((_, idx) => idx !== i) })} className="text-xs text-red-500 px-1 py-1.5">×</button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addParam} className="text-xs text-[var(--rh-teal)] mt-1">+ add parameter</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>formula (use parameter names)</Label>
          <TextInput value={config.formula} onChange={(formula) => onChange({ ...config, formula })} placeholder="x * y + z" />
        </div>
        <div>
          <Label>output label</Label>
          <TextInput value={config.outputLabel} onChange={(outputLabel) => onChange({ ...config, outputLabel })} placeholder="result" />
        </div>
      </div>
      <div>
        <Label>reflection prompt</Label>
        <TextInput value={config.reflectionPrompt} onChange={(reflectionPrompt) => onChange({ ...config, reflectionPrompt })} placeholder="what did you notice?" multiline />
      </div>
    </div>
  );
}

// ── puzzle ────────────────────────────────────────────────────────

function PuzzleConfigEditor({
  config,
  onChange,
}: {
  config: { prompt: string; pieces: PuzzlePiece[]; solution: string[] };
  onChange: (c: typeof config) => void;
}) {
  const addPiece = () => {
    const id = `p${config.pieces.length + 1}`;
    const pieces = [...config.pieces, { id, content: "" }];
    onChange({ ...config, pieces, solution: pieces.map((p) => p.id) });
  };

  return (
    <div className="space-y-2">
      <div>
        <Label>prompt</Label>
        <TextInput value={config.prompt} onChange={(prompt) => onChange({ ...config, prompt })} placeholder="put these in the correct order..." multiline />
      </div>
      <div>
        <Label>pieces (in correct order — will be shuffled for participants)</Label>
        <div className="space-y-1">
          {config.pieces.map((piece, i) => (
            <div key={piece.id} className="flex gap-1">
              <span className="text-xs text-[var(--rh-text-muted)] w-4 py-1.5 text-center">{i + 1}</span>
              <TextInput
                value={piece.content}
                onChange={(content) => {
                  const pieces = [...config.pieces];
                  pieces[i] = { ...pieces[i], content };
                  onChange({ ...config, pieces });
                }}
                placeholder={`step ${i + 1}`}
              />
              {config.pieces.length > 2 && (
                <button onClick={() => {
                  const pieces = config.pieces.filter((_, idx) => idx !== i);
                  onChange({ ...config, pieces, solution: pieces.map((p) => p.id) });
                }} className="text-xs text-red-500 px-1">×</button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addPiece} className="text-xs text-[var(--rh-teal)] mt-1">+ add piece</button>
      </div>
    </div>
  );
}

// ── asymmetric ───────────────────────────────────────────────────

function AsymmetricConfigEditor({
  config,
  onChange,
}: {
  config: { scenario: string; roles: { id: string; label: string; info: string; question: string }[]; discussionPrompt: string; revealPrompt?: string };
  onChange: (c: typeof config) => void;
}) {
  const addRole = () => {
    const id = `r${config.roles.length + 1}`;
    onChange({ ...config, roles: [...config.roles, { id, label: "", info: "", question: "" }] });
  };

  return (
    <div className="space-y-2">
      <div>
        <Label>scenario</Label>
        <TextInput value={config.scenario} onChange={(scenario) => onChange({ ...config, scenario })} placeholder="describe the situation..." multiline />
      </div>
      <div>
        <Label>roles</Label>
        <div className="space-y-2">
          {config.roles.map((role, i) => (
            <div key={role.id} className="p-2 rounded-lg bg-[var(--rh-sand-light)] space-y-1">
              <div className="flex gap-1">
                <TextInput value={role.label} onChange={(label) => {
                  const roles = [...config.roles];
                  roles[i] = { ...roles[i], label };
                  onChange({ ...config, roles });
                }} placeholder="role name" />
                {config.roles.length > 1 && (
                  <button onClick={() => onChange({ ...config, roles: config.roles.filter((_, idx) => idx !== i) })} className="text-xs text-red-500 px-1">×</button>
                )}
              </div>
              <TextInput value={role.info} onChange={(info) => {
                const roles = [...config.roles];
                roles[i] = { ...roles[i], info };
                onChange({ ...config, roles });
              }} placeholder="information this role sees" multiline />
              <TextInput value={role.question} onChange={(question) => {
                const roles = [...config.roles];
                roles[i] = { ...roles[i], question };
                onChange({ ...config, roles });
              }} placeholder="question for this role" />
            </div>
          ))}
        </div>
        <button onClick={addRole} className="text-xs text-[var(--rh-teal)] mt-1">+ add role</button>
      </div>
      <div>
        <Label>discussion prompt</Label>
        <TextInput value={config.discussionPrompt} onChange={(discussionPrompt) => onChange({ ...config, discussionPrompt })} placeholder="share what you learned..." multiline />
      </div>
    </div>
  );
}
