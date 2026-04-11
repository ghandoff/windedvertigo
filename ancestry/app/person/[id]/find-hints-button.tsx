"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function FindHintsButton({ personId, personName }: { personId: string; personName: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ generated: number } | null>(null);
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      setResult(null);
      const res = await fetch("/api/hints/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId }),
      });
      const data = await res.json();
      setResult({ generated: data.generated ?? 0 });
      router.refresh();
      setTimeout(() => setResult(null), 5000);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
    >
      {isPending
        ? "searching..."
        : result
          ? result.generated > 0
            ? `${result.generated} hints found`
            : "no new hints"
          : "find hints"}
    </button>
  );
}
