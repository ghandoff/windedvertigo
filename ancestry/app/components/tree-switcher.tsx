"use client";

import { useRouter } from "next/navigation";

type TreeOption = {
  id: string;
  name: string;
  owner_email: string;
};

export function TreeSwitcher({
  currentTreeId,
  currentTreeName,
  sharedTrees,
}: {
  currentTreeId: string;
  currentTreeName: string;
  sharedTrees: TreeOption[];
}) {
  const router = useRouter();

  return (
    <select
      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
      value={currentTreeId}
      onChange={(e) => {
        const val = e.target.value;
        router.push(val === currentTreeId ? "/" : `/?tree=${val}`);
      }}
      aria-label="switch family tree"
    >
      <option value={currentTreeId}>{currentTreeName}</option>
      {sharedTrees.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name} (shared)
        </option>
      ))}
    </select>
  );
}
