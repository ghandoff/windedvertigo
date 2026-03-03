"use client";

import { useRouter } from "next/navigation";
import type { AgeBand } from "@/lib/types";
import { AgeBandPicker } from "@/components/age-band-picker";
import { useAccess } from "@/lib/use-access";

export default function PickPage() {
  const router = useRouter();
  const { isSamplerOnly } = useAccess();

  function handleSelect(band: AgeBand) {
    router.push(`/play?band=${band}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-full bg-[var(--dd-redwood)] flex items-center justify-center">
            <span className="text-lg font-bold text-white">DD</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--dd-cadet)]">
            deep.deck
          </h1>
        </div>
        <p className="text-base text-[var(--dd-cadet)]/60 max-w-md mx-auto">
          {isSamplerOnly
            ? "Pick an age group to play the free sampler."
            : "Pick an age group to start."}
        </p>
      </div>

      <AgeBandPicker onSelect={handleSelect} />

      <footer className="mt-16 text-center">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-[var(--dd-cadet)]/40 hover:text-[var(--dd-cadet)] transition-colors"
        >
          &larr; Back to deep.deck
        </button>
      </footer>
    </div>
  );
}
