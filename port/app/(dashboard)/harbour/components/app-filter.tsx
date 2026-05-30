"use client";

/**
 * AppFilter — client-side app selector for the harbour analytics page.
 *
 * Updates ?app= in the URL (replaces history entry) so the server page
 * re-renders with filtered data. No JS framework dependency beyond Next.js
 * router.
 */

import { useRouter, useSearchParams } from "next/navigation";

// Subset of HARBOUR_APPS from harbour-apps/packages/auth/harbour-apps-data.ts
// — only apps with real Neon data today. Extend as apps add commerce/knots.
const APPS = [
  { key: "creaseworks",    label: "creaseworks"      },
  { key: "vertigo-vault",  label: "vertigo.vault"    },
  { key: "depth-chart",    label: "depth.chart"      },
] as const;

export function AppFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("app") ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set("app", val);
    } else {
      params.delete("app");
    }
    router.replace(`/harbour?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={onChange}
      className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      aria-label="filter by app"
    >
      <option value="">all apps</option>
      {APPS.map((a) => (
        <option key={a.key} value={a.key}>
          {a.label}
        </option>
      ))}
    </select>
  );
}
