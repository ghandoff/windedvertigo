"use client";

import { useRouter } from "next/navigation";
import type { RunFormState } from "./use-run-form-state";

interface RunFormActionsProps {
  state: RunFormState;
}

export function RunFormActions({ state }: RunFormActionsProps) {
  const router = useRouter();

  return (
    <>
      {/* error */}
      {state.error && (
        <div
          id="reflection-error"
          className="rounded-lg p-3 text-sm"
          style={{
            backgroundColor: "rgba(177, 80, 67, 0.08)",
            color: "var(--wv-redwood)",
          }}
        >
          {state.error}
        </div>
      )}

      {/* submit */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={
            state.loading ||
            !state.title.trim() ||
            !state.runType ||
            !state.runDate
          }
          className="rounded-lg px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40 transition-all"
          style={{ backgroundColor: "var(--wv-redwood)" }}
        >
          {state.savingEvidence
            ? "uploading evidence…"
            : state.loading
              ? "saving…"
              : "save reflection"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/playbook")}
          className="rounded-lg px-6 py-2.5 text-sm font-medium transition-all hover:opacity-70"
          style={{ color: "var(--wv-cadet)" }}
        >
          cancel
        </button>
      </div>
    </>
  );
}
