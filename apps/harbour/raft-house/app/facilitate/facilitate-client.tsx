"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateRoomCode } from "@/lib/room-code";
import type { Activity, AgeLevel } from "@/lib/types";
import { SessionBuilder } from "@/components/session-builder";

const AGE_LEVELS: { value: AgeLevel; label: string; desc: string; icon: string }[] = [
  { value: "kids", label: "ages 10–14", desc: "simplified language, jargon tooltips, encouraging tone", icon: "🌱" },
  { value: "highschool", label: "ages 14–18", desc: "standard language, jargon hints on hover", icon: "🌿" },
  { value: "professional", label: "higher ed+", desc: "full academic language, no simplification", icon: "🌳" },
];

export interface SessionTemplate {
  name: string;
  description: string;
  activities: Activity[];
  icon: string;
}

export default function FacilitateClient({
  templates,
}: {
  templates: SessionTemplate[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [ageLevel, setAgeLevel] = useState<AgeLevel>("professional");

  const createSession = useCallback(
    (template: SessionTemplate) => {
      setCreating(true);
      const code = generateRoomCode();

      // store session config in sessionStorage so the live page can read it
      sessionStorage.setItem(
        `raft:${code}`,
        JSON.stringify({
          code,
          activities: template.activities,
          sessionName: template.name,
          template: template.name,
          ageLevel,
          createdAt: Date.now(),
        }),
      );

      router.push(`/facilitate/live/${code}`);
    },
    [router, ageLevel],
  );

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              create a session
            </h1>
            <p className="text-sm text-[var(--rh-text-muted)]">
              choose a template to start a facilitated threshold crossing.
              participants will join with a room code on their phones.
            </p>
          </div>
          <Link
            href="/facilitate/history"
            className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border border-black/10 hover:bg-black/5 transition-colors"
          >
            history
          </Link>
        </div>
      </div>

      {/* age-level picker */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--rh-text-muted)] mb-2">
          audience level
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {AGE_LEVELS.map((al) => (
            <button
              key={al.value}
              onClick={() => setAgeLevel(al.value)}
              className={`text-left p-3 rounded-xl border transition-all ${
                ageLevel === al.value
                  ? "border-[var(--rh-teal)] bg-[var(--rh-foam)]/10 shadow-sm"
                  : "border-black/10 hover:border-black/20"
              }`}
            >
              <span className="text-lg">{al.icon}</span>
              <p className={`text-sm font-medium mt-1 ${ageLevel === al.value ? "text-[var(--rh-teal)]" : ""}`}>
                {al.label}
              </p>
              <p className="text-[10px] text-[var(--rh-text-muted)] mt-0.5 leading-tight">
                {al.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* template cards */}
      <div className="space-y-4">
        {templates.map((template) => (
          <button
            key={template.name}
            onClick={() => createSession(template)}
            disabled={creating}
            className="w-full text-left p-5 rounded-2xl border border-black/10 bg-white hover:border-[var(--rh-cyan)] hover:shadow-md transition-all group disabled:opacity-50"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{template.icon}</span>
              <div className="flex-1">
                <h2 className="font-semibold text-lg group-hover:text-[var(--rh-teal)] transition-colors">
                  {template.name}
                </h2>
                <p className="text-sm text-[var(--rh-text-muted)] mt-1">
                  {template.description}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs bg-[var(--rh-sand)] px-2 py-0.5 rounded-full">
                    {template.activities.length} activities
                  </span>
                  {template.activities.map((a) => (
                    <span
                      key={a.id}
                      className={`phase-dot phase-${a.phase}`}
                      title={a.phase}
                    />
                  ))}
                </div>
                {template.activities.some((a) => a.mechanic?.interactionModel) && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[...new Set(template.activities
                      .map((a) => a.mechanic?.interactionModel)
                      .filter(Boolean)
                    )].map((model) => (
                      <span key={model} className="text-xs bg-[var(--rh-foam)]/20 text-[var(--rh-teal)] px-1.5 py-0.5 rounded-full">
                        {model}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[var(--rh-text-muted)] group-hover:text-[var(--rh-teal)] transition-colors">
                &rarr;
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* custom session builder */}
      <div className="mt-8">
        <SessionBuilder
          disabled={creating}
          onLaunch={(activities) => {
            createSession({
              name: "custom session",
              description: "",
              activities,
              icon: "🛠️",
            });
          }}
        />
      </div>
    </div>
  );
}
