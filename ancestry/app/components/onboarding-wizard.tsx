"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setupTreeAction } from "../actions";

type WizardStep = "self" | "parents" | "grandparents";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "self", label: "you" },
  { key: "parents", label: "parents" },
  { key: "grandparents", label: "grandparents" },
];

function StepIndicator({ current }: { current: WizardStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const isActive = step.key === current;
        const isPast = STEPS.findIndex((s) => s.key === current) > i;
        return (
          <div key={step.key} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`h-px w-8 ${isPast ? "bg-primary" : "bg-border"}`} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isPast
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isPast ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PersonCard({
  label,
  prefix,
  defaultSex,
  optional,
}: {
  label: string;
  prefix: string;
  defaultSex?: string;
  optional?: boolean;
}) {
  const [sex, setSex] = useState(defaultSex ?? "U");
  const isFemale = sex === "F";

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        {optional && (
          <span className="text-[10px] text-muted-foreground">optional</span>
        )}
      </div>
      {/* name row: first, middle, surname */}
      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">first name</span>
          <input
            name={`${prefix}_givenNames`}
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
            placeholder="first"
            required={!optional}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">middle</span>
          <input
            name={`${prefix}_middleName`}
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
            placeholder="middle"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">surname</span>
          <input
            name={`${prefix}_surname`}
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
            placeholder="last name"
            required={!optional}
          />
        </label>
      </div>
      {/* maiden name for female persons */}
      {isFemale && (
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">maiden name <span className="text-muted-foreground/60">(if different)</span></span>
          <input
            name={`${prefix}_maidenName`}
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
            placeholder="birth surname"
          />
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">date of birth</span>
          <input
            name={`${prefix}_birthDate`}
            type="date"
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">sex</span>
          <select
            name={`${prefix}_sex`}
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
          >
            <option value="M">male</option>
            <option value="F">female</option>
            <option value="X">other</option>
            <option value="U">unknown</option>
          </select>
        </label>
      </div>
      <label className="space-y-1">
        <span className="text-xs text-muted-foreground">place of birth</span>
        <input
          name={`${prefix}_birthPlace`}
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
          placeholder="city, state, country"
        />
      </label>
      {defaultSex && <input type="hidden" name={`${prefix}_defaultSex`} value={defaultSex} />}
    </div>
  );
}

export function OnboardingWizard() {
  const [step, setStep] = useState<WizardStep>("self");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await setupTreeAction(formData);
      if (result?.success) {
        // trigger hint generation in the background
        try {
          fetch("/api/hints/generate", { method: "POST" });
        } catch {
          // non-blocking
        }
        router.refresh();
      }
    });
  }

  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <form action={handleSubmit}>
          <StepIndicator current={step} />

          {/* step 1: self */}
          {step === "self" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">let's start with you</h2>
                <p className="text-sm text-muted-foreground">
                  every great family tree begins with a single person
                </p>
              </div>
              <PersonCard label="you" prefix="self" />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep("parents")}
                  className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  next →
                </button>
              </div>
            </div>
          )}

          {/* step 2: parents */}
          {step === "parents" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">add your parents</h2>
                <p className="text-sm text-muted-foreground">
                  fill in what you know — you can always add more later
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PersonCard label="father" prefix="father" defaultSex="M" optional />
                <PersonCard label="mother" prefix="mother" defaultSex="F" optional />
              </div>
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep("self")}
                  className="rounded-lg border border-border px-6 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
                >
                  ← back
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("grandparents")}
                    className="rounded-lg border border-border px-6 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
                  >
                    skip
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("grandparents")}
                    className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    next →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* step 3: grandparents */}
          {step === "grandparents" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">add your grandparents</h2>
                <p className="text-sm text-muted-foreground">
                  even just names help — you can fill in details anytime
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">paternal</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PersonCard label="grandfather" prefix="pgf" defaultSex="M" optional />
                    <PersonCard label="grandmother" prefix="pgm" defaultSex="F" optional />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">maternal</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PersonCard label="grandfather" prefix="mgf" defaultSex="M" optional />
                    <PersonCard label="grandmother" prefix="mgm" defaultSex="F" optional />
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep("parents")}
                  className="rounded-lg border border-border px-6 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
                >
                  ← back
                </button>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg border border-border px-6 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {isPending ? "building..." : "skip & finish"}
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending ? "building your tree..." : "finish"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
