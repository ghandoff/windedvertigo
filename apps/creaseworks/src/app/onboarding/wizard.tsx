"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ── option definitions ── */

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

type Step = 0 | 1 | 2;

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  const [contexts, setContexts] = useState<string[]>([]);
  const [energy, setEnergy] = useState<string>("any");
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
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ageGroups, contexts, energy }),
      });
      router.push("/sampler");
    } catch {
      setSaving(false);
    }
  }

  const canAdvance =
    step === 0 ? ageGroups.length > 0 : step === 1 ? contexts.length > 0 : true;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* progress dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`block rounded-full transition-all ${
              i === step
                ? "w-8 h-2 bg-sienna"
                : i < step
                  ? "w-2 h-2 bg-sienna/40"
                  : "w-2 h-2 bg-cadet/15"
            }`}
          />
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-cadet/10 p-8">
        {/* step 0: ages */}
        {step === 0 && (
          <>
            <h1 className="text-xl font-semibold text-cadet mb-1">
              who&apos;s playing?
            </h1>
            <p className="text-sm text-cadet/50 mb-6">
              pick all that apply — we&apos;ll tailor your first playdate
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

        {/* step 1: context */}
        {step === 1 && (
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

        {/* step 2: energy */}
        {step === 2 && (
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

        {/* nav buttons */}
        <div className="flex items-center justify-between mt-8">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as Step)}
              className="text-sm text-cadet/50 hover:text-cadet transition-colors"
            >
              &larr; back
            </button>
          ) : (
            <span />
          )}

          {step < 2 ? (
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
              disabled={saving}
              onClick={finish}
              className="rounded-lg bg-redwood px-5 py-2.5 text-sm font-medium text-white hover:bg-sienna transition-colors disabled:opacity-60"
            >
              {saving ? "saving..." : "show me playdates"}
            </button>
          )}
        </div>

        {/* skip link */}
        {step === 0 && (
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
