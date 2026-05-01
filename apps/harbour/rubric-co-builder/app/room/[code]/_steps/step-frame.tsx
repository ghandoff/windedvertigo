"use client";

import type { Room } from "@/lib/types";

export function StepFrame({ room }: { room: Room }) {
  return (
    <div className="flex flex-col justify-center min-h-[60vh]">
      <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/70 mb-4">
        learning outcome
      </p>
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-10 leading-tight">
        {room.learning_outcome}
      </h1>
      <p className="text-sm tracking-widest text-[color:var(--color-cadet)]/70 mb-2">
        the artifact
      </p>
      <p className="text-xl sm:text-2xl mb-12">{room.project_description}</p>
      <p className="text-base sm:text-lg text-[color:var(--color-cadet)]/85 max-w-3xl border-l-4 border-[color:var(--color-sienna)] pl-5 leading-relaxed">
        you&apos;re about to co-design how this gets graded. the outcome tells you what
        this assessment should show. your job is to decide what counts as good.
      </p>
    </div>
  );
}
