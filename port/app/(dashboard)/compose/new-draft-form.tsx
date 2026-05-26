"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import {
  CHANNEL_LABELS,
  type ComposeChannel,
} from "@/lib/supabase/compose-drafts";

const CHANNEL_OPTIONS: ComposeChannel[] = [
  "linkedin",
  "bluesky",
  "substack",
  "meta-facebook",
  "meta-instagram",
  "email",
];

export function NewDraftForm() {
  const [channel, setChannel] = useState<ComposeChannel>("linkedin");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleCreate = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/compose/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      if (!res.ok) {
        setError(`failed: HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data.draft?.id) {
        router.push(`/compose/${data.draft.id}`);
      } else {
        setError("no draft returned");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={channel} onValueChange={(v) => setChannel(v as ComposeChannel)}>
        <SelectTrigger className="w-44 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CHANNEL_OPTIONS.map((c) => (
            <SelectItem key={c} value={c} className="text-xs">
              {CHANNEL_LABELS[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        onClick={handleCreate}
        disabled={isPending}
        variant="outline"
        size="sm"
        className="h-8 text-xs"
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
        ) : (
          <Plus className="h-3 w-3 mr-1.5" />
        )}
        new draft
      </Button>
      {error && <span className="text-[11px] text-[#b15043]">{error}</span>}
    </div>
  );
}
