"use client";

import { useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quickAddRelativeAction } from "../actions";

export type QuickAddType = "parent" | "child" | "spouse";

const TYPE_LABELS: Record<QuickAddType, string> = {
  parent: "add parent",
  child: "add child",
  spouse: "add spouse",
};

const TYPE_SEX_OPTIONS: Record<QuickAddType, { label: string; value: string }[]> = {
  parent: [
    { label: "father", value: "M" },
    { label: "mother", value: "F" },
    { label: "parent", value: "U" },
  ],
  child: [
    { label: "son", value: "M" },
    { label: "daughter", value: "F" },
    { label: "child", value: "U" },
  ],
  spouse: [
    { label: "husband", value: "M" },
    { label: "wife", value: "F" },
    { label: "spouse", value: "U" },
  ],
};

export function QuickAddPopover({
  personId,
  personSurname,
  type,
  onClose,
}: {
  personId: string;
  personSurname: string | null;
  type: QuickAddType;
  onClose: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // close on escape or click outside
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    // delay click listener to avoid closing immediately
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 100);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
      clearTimeout(timer);
    };
  }, [onClose]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await quickAddRelativeAction(formData);
      onClose();
      router.refresh();
    });
  }

  const sexOptions = TYPE_SEX_OPTIONS[type];
  // suggest surname based on relationship
  const defaultSurname = type === "child" || type === "parent" ? (personSurname ?? "") : "";

  return (
    <div
      ref={wrapperRef}
      className="absolute z-50 w-64 rounded-xl border border-border bg-card p-3 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-foreground">{TYPE_LABELS[type]}</h4>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          ✕
        </button>
      </div>

      <form ref={formRef} action={handleSubmit} className="space-y-2">
        <input type="hidden" name="relatedPersonId" value={personId} />
        <input type="hidden" name="relationship" value={type} />

        <div className="grid grid-cols-3 gap-1.5">
          <input
            name="givenNames"
            required
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            placeholder="first"
            autoFocus
          />
          <input
            name="middleName"
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            placeholder="middle"
          />
          <input
            name="surname"
            required
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            placeholder="last"
            defaultValue={defaultSurname}
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <input
            name="birthYear"
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            placeholder="birth year"
            pattern="[0-9]{4}"
            maxLength={4}
          />
          <select
            name="sex"
            defaultValue={sexOptions[0].value}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          >
            {sexOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <input
          name="birthPlace"
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          placeholder="birth place (city, state, country)"
        />

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "adding..." : "add"}
        </button>
      </form>
    </div>
  );
}
