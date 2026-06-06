"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateUsedInAction } from "../actions";
import { AssetPicker } from "./asset-picker";

// Inline editor for a row's used_in assets: a multi-select of existing tags plus
// a field to create a new one. Persists each change optimistically.
export function UsedInEditor({
  id,
  usedIn,
  allAssets,
}: {
  id: string;
  usedIn: string[];
  allAssets: string[];
}) {
  const router = useRouter();
  const [tags, setTags] = useState(usedIn);
  const [saving, setSaving] = useState(false);

  async function commit(next: string[]) {
    const prev = tags;
    setTags(next);
    setSaving(true);
    const res = await updateUsedInAction(id, next);
    setSaving(false);
    if (res.error) setTags(prev);
    else router.refresh();
  }

  return (
    <span className={saving ? "opacity-60" : ""}>
      <AssetPicker value={tags} allAssets={allAssets} onChange={commit} />
    </span>
  );
}
