"use client";

import { useState, useEffect, useRef } from "react";

export function AiSubjectScore({ subject }: { subject: string }) {
  const [score, setScore] = useState<{ score: number; tip: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!subject || subject.length < 5) {
      setScore(null);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/ai/subject-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject }),
        });
        if (res.ok) {
          setScore(await res.json());
        }
      } catch {} finally {
        setLoading(false);
      }
    }, 800);

    return () => clearTimeout(debounceRef.current);
  }, [subject]);

  if (!subject || subject.length < 5) return null;

  const scoreColor =
    !score ? "text-muted-foreground" :
    score.score >= 8 ? "text-green-600" :
    score.score >= 5 ? "text-yellow-600" : "text-orange-500";

  return (
    <div className="flex items-center gap-2 mt-1 min-h-[20px]">
      {loading && (
        <span className="text-[10px] text-muted-foreground">scoring...</span>
      )}
      {score && !loading && (
        <>
          <span className={`text-[10px] font-medium ${scoreColor}`}>
            {score.score}/10
          </span>
          <span className="text-[10px] text-muted-foreground">{score.tip}</span>
        </>
      )}
    </div>
  );
}
