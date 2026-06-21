"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function AddPartnerForm({ onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const rawCaps = (fd.get("capabilities") as string).trim();
    const capabilities = rawCaps
      ? rawCaps.split(",").map((c) => c.trim()).filter(Boolean)
      : [];

    const body = {
      name:         (fd.get("name") as string).trim(),
      country:      (fd.get("country") as string).trim() || null,
      type:         fd.get("type") as string,
      relationship: fd.get("relationship") as string,
      capabilities: capabilities.length ? capabilities : null,
      contactName:  (fd.get("contactName") as string).trim() || null,
      contactEmail: (fd.get("contactEmail") as string).trim() || null,
      notes:        (fd.get("notes") as string).trim() || null,
    };

    if (!body.name) { setError("name is required"); return; }

    startTransition(async () => {
      try {
        const res = await fetch("/api/partners", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError((json as { error?: string }).error ?? "failed to create partner");
          return;
        }
        router.refresh();
        onClose();
      } catch {
        setError("unexpected error — please try again");
      }
    });
  }

  return (
    <div className="rounded-lg border bg-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">add teaming partner</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* name */}
        <div className="sm:col-span-2 grid gap-1.5">
          <Label htmlFor="name" className="text-xs">name *</Label>
          <Input id="name" name="name" placeholder="e.g. Hekima Associates" required />
        </div>

        {/* country */}
        <div className="grid gap-1.5">
          <Label htmlFor="country" className="text-xs">country</Label>
          <Input id="country" name="country" placeholder="e.g. Kenya" />
        </div>

        {/* type */}
        <div className="grid gap-1.5">
          <Label htmlFor="type" className="text-xs">type</Label>
          <Select name="type" defaultValue="local">
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">local</SelectItem>
              <SelectItem value="international">international</SelectItem>
              <SelectItem value="academic">academic</SelectItem>
              <SelectItem value="government">government</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* relationship */}
        <div className="grid gap-1.5">
          <Label htmlFor="relationship" className="text-xs">relationship status</Label>
          <Select name="relationship" defaultValue="known">
            <SelectTrigger id="relationship">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="known">known</SelectItem>
              <SelectItem value="nda_signed">NDA signed</SelectItem>
              <SelectItem value="ta_on_file">TA on file</SelectItem>
              <SelectItem value="active_sub">active sub</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* capabilities */}
        <div className="grid gap-1.5">
          <Label htmlFor="capabilities" className="text-xs">capabilities (comma-separated)</Label>
          <Input id="capabilities" name="capabilities" placeholder="MEL, curriculum, gender" />
        </div>

        {/* contact name */}
        <div className="grid gap-1.5">
          <Label htmlFor="contactName" className="text-xs">contact name</Label>
          <Input id="contactName" name="contactName" placeholder="Jane Doe" />
        </div>

        {/* contact email */}
        <div className="grid gap-1.5">
          <Label htmlFor="contactEmail" className="text-xs">contact email</Label>
          <Input id="contactEmail" name="contactEmail" type="email" placeholder="jane@example.com" />
        </div>

        {/* notes */}
        <div className="sm:col-span-2 grid gap-1.5">
          <Label htmlFor="notes" className="text-xs">notes</Label>
          <Textarea id="notes" name="notes" placeholder="any context about this partner..." rows={2} />
        </div>

        {error && (
          <p className="sm:col-span-2 text-xs text-destructive">{error}</p>
        )}

        <div className="sm:col-span-2 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "saving..." : "add partner"}
          </Button>
        </div>
      </form>
    </div>
  );
}
