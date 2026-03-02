"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import StepProgress from "@/components/ui/step-progress";
import { apiUrl } from "@/lib/api-url";

/* ── option definitions ── */

const TIER_OPTIONS = [
  {
    value: "casual",
    label: "just play",
    sub: "simple play ideas, no tracking",
    icon: "🎈",
  },
  {
    value: "curious",
    label: "play + learn",
    sub: "ideas with developmental context",
    icon: "📖",
  },
  {
    value: "collaborator",
    label: "play + grow",
    sub: "reflections, community, evidence",
    icon: "🌱",
  },
] as const;

const AGE_GROUPS = [
  { value: "toddler", label: "toddlers", sub: "1-3 yrs" },
  { value: "preschool", label: "preschool", sub: "3-5 yrs" },
  { value: "school-age", label: "school age", sub: "5-8 yrs" },
  { value: "older", label: "older kids", sub: "8+" },
] as const;

const CONTEXTS = [
  { value: "home", label: "at home", icon: "🏠" },
  { value: "classroom", label: "in a classroom", icon: "🏫" },
  { value: "outdoors", label: "outdoors", icon: "🌳" },
  { value: "travel", label: "on the go", icon: "✈️" },
] as const;

const ENERGY = [
  { value: "chill", label: "chill", sub: "low mess, minimal setup", icon: "🌿" },
  { value: "medium", label: "medium", sub: "some supplies, moderate mess", icon: "🌤️" },
  { value: "active", label: "active", sub: "big mess, big fun", icon: "⚡" },
  { value: "any", label: "surprise me", sub: "show me everything", icon: "🎲" },
] as const;

const CONTEXT_NAME_SUGGESTIONS = [
  "at home",
  "school time",
  "outdoors adventure",
  "road trip",
  "rainy day",
  "weekend play",
] as const;

type Step = 0 | 1 | 2 | 3 | 4;

interface WizardProps {
  editMode?: boolean;
  initialValues?: {
    ageGroups: string[];
    contexts: string[];
    energy: string;
    contextName: string;
  } | null;
}

export default function OnboardingWizard({ editMode = false, initialValues }: WizardProps) {
  const router = useRouter();
  // New flow: tier → ages → contexts → energy (+ name in edit mode)
  // Edit mode skips tier step — users change tier from profile instead
  const totalSteps = editMode ? 4 : 4;
  const [step, setStep] = useState<Step>(editMode ? 1 : 0);
  const [tier, setTier] = useState<string>("casual");
  const [ageGroups, setAgeGroups] = useState<string[]>(initialValues?.ageGroups ?? []);
  const [contexts, setContexts] = useState<string[]>(initialValues?.contexts ?? []);
  const [energy, setEnergy] = useState<string>(initialValues?.energy ?? "any");
  const [contextName, setContextName] = useState<string>(initialValues?.contextName ?? "");
  const [saving, setSaving] = useState(false);

  const toggle = useCallback(
    (list: string[], setList: (v: string[]) => void, val: string) => {
      setList(list.includes(val) ? list.filter((v) => v !== val) : [...list, val]);
    },
    [],
  );

  async function finish() {
    setSaving(true);
    try {
      const endpoint = apiUrl(editMode ? "/api/onboarding/context" : "/api/onboarding");
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ageGroups,
          contexts,
          energy,
          ...(!editMode && { tier }),
          ...(editMode && { contextName: contextName.trim() || "default" }),
          ...(editMode && initialValues?.contextName && {
            originalContextName: initialValues.contextName,
          }),
        }),
      });
      router.push(editMode ? "/profile?manage=true" : "/sampler");
      router.refresh();
    } catch {
      setSaving(false);
    }
  }

  const canAdvance =
    step === 0
      ? true // tier always has a default selection
      : step === 1
        ? ageGroups.length > 0
        : step === 2
          ? contexts.length > 0
          : step === 3
            ? true // energy always has a default
            : contextName.trim().length > 0; // step 4: name required (edit mode)

  const lastContentStep = editMode ? 4 : 3;

  const stepLabels = useMemo(
    () =>
      editMode
        ? ["who's playing?", "where?", "energy level", "name it"]
        : ["how do you play?", "who's playing?", "where?", "energy level"],
    [editMode],
  );

  return (
    <div className="w-full max-w-md mx-auto">
      {/* progress indicator */}
      <div className="mb-8">
        <StepProgress
          currentStep={editMode ? step - 1 : step}
          totalSteps={totalSteps}
          stepLabels={stepLabels}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-cadet/10 p-8">
        {/* step 0: tier selection (new users only) */}
        {step === 0 && !editMode && (
          <>
            <h1 className="text-xl font-semibold text-cadet mb-1">
              how do you want to use creaseworks?
            </h1>
            <p className="text-sm text-cadet/50 mb-6">
              you can change this anytime from your profile
            </p>
            <div className="space-y-3">
              {TIER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTier(opt.value)}
                  className={`w-full rounded-xl border-2 px-5 py-4 text-left transition-all ${
                    tier === opt.value
                      ? "border-sienna bg-sienna/5"
                      : "border-cadet/10 hover:border-cadet/20"
                  }`}
                >
                  <span className="text-xl mr-3">{opt.icon}</span>
                  <span className="text-sm font-semibold text-cadet">
                    {opt.label}
                  </span>
                  <span className="text-xs text-cadet/40 ml-2">{opt.sub}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* step 1: ages */}
        {step === 1 && (
          <>
            <h1 className="text-xl font-semibold text-cadet mb-1">
              who&apos;s playing?
            </h1>
            <p className="text-sm text-cadet/50 mb-6">
              pick all that apply — we&apos;ll tailor {editMode ? "this context" : "your first playdate"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {AGE_GROUPS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(ageGroups, setAgeGroups, opt.value)}
                  className={`rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    ageGroups.includes(opt.value)
                      ? "border-sienna bg-sienna/5"
                      : "border-cadet/10 hover:border-cadet/20"
                  }`}
                >
                  <span className="block text-sm font-semibold text-cadet">
                    {opt.label}
                  </span>
                  <span className="block text-xs text-cadet/40">{opt.sub}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* step 2: context */}
        {step === 2 && (
          <>
            <h1 className="text-xl font-semibold text-cadet mb-1">
              where do you usually play?
            </h1>
            <p className="text-sm text-cadet/50 mb-6">
              pick your most common spots
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CONTEXTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(contexts, setContexts, opt.value)}
                  className={`rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    contexts.includes(opt.value)
                      ? "border-sienna bg-sienna/5"
                      : "border-cadet/10 hover:border-cadet/20"
                  }`}
                >
                  <span className="text-lg mr-1">{opt.icon}</span>
                  <span className="text-sm font-semibold text-cadet">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* step 3: energy */}
        {step === 3 && (
          <>
            <h1 className="text-xl font-semibold text-cadet mb-1">
              what energy level works?
            </h1>
            <p className="text-sm text-cadet/50 mb-6">
              we&apos;ll recommend a playdate to match
            </p>
            <div className="space-y-3">
              {ENERGY.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEnergy(opt.value)}
                  className={`w-full rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    energy === opt.value
                      ? "border-sienna bg-sienna/5"
                      : "border-cadet/10 hover:border-cadet/20"
                  }`}
                >
                  <span className="text-lg mr-2">{opt.icon}</span>
                  <span className="text-sm font-semibold text-cadet">
                    {opt.label}
                  </span>
                  <span className="text-xs text-cadet/40 ml-2">{opt.sub}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* step 4 (edit mode only): name this context */}
        {step === 4 && editMode && (
          <>
            <h1 className="text-xl font-semibold text-cadet mb-1">
              name this context
            </h1>
            <p className="text-sm text-cadet/50 mb-6">
              give it a name so you can switch between play settings
            </p>
            <input
              type="text"
              value={contextName}
              onChange={(e) => setContextName(e.target.value)}
              placeholder="e.g. at home, school time, road trip"
              maxLength={40}
              className="w-full rounded-xl border-2 border-cadet/10 px-4 py-3 text-sm text-cadet placeholder:text-cadet/30 focus:border-sienna focus:outline-none transition-colors"
            />
            <div className="flex flex-wrap gap-2 mt-4">
              {CONTEXT_NAME_SUGGESTIONS
                .filter((s) => s !== contextName)
                .map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setContextName(suggestion)}
                    className="rounded-full border border-cadet/10 px-3 py-1.5 text-xs text-cadet/50 hover:border-sienna/30 hover:text-sienna transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
            </div>
          </>
        )}

        {/* nav buttons */}
        <div className="flex items-center justify-between mt-8">
          {step > (editMode ? 1 : 0) ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as Step)}
              className="text-sm text-cadet/50 hover:text-cadet transition-colors"
            >
              &larr; back
            </button>
          ) : editMode ? (
            <button
              type="button"
              onClick={() => router.push("/profile?manage=true")}
              className="text-sm text-cadet/50 hover:text-cadet transition-colors"
            >
              &larr; cancel
            </button>
          ) : (
            <span />
          )}

          {step < lastContentStep ? (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => setStep((step + 1) as Step)}
              className="rounded-lg bg-sienna px-5 py-2.5 text-sm font-medium text-white hover:bg-redwood transition-colors disabled:opacity-40"
            >
              next &rarr;
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || !canAdvance}
              onClick={finish}
              className="rounded-lg bg-redwood px-5 py-2.5 text-sm font-medium text-white hover:bg-sienna transition-colors disabled:opacity-60"
            >
              {saving ? "saving..." : editMode ? "save context" : "show me playdates"}
            </button>
          )}
        </div>

        {/* skip link — first-time only, on tier step */}
        {step === 0 && !editMode && (
          <p className="text-center mt-4">
            <button
              type="button"
              onClick={finish}
              className="text-xs text-cadet/30 hover:text-cadet/50 transition-colors"
            >
              skip for now
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
