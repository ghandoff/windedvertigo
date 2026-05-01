"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

const TYPE_OPTIONS = [
  "ngo", "studio", "corporate", "non-profit", "foundation", "government",
  "individual donor", "consultancy/firm", "academic institution",
] as const;

const CONNECTION_OPTIONS = [
  "unengaged", "exploring", "in progress", "collaborating", "champion", "steward", "past client",
] as const;

export function NewOrgDialog() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [connection, setConnection] = useState<string | null>("unengaged");

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization: name.trim(),
          website: website.trim() || undefined,
          type: type || undefined,
          connection: connection || "unengaged",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "creation failed" }));
        setError(data.error || `failed (${res.status})`);
        return;
      }

      setName("");
      setWebsite("");
      setType(null);
      setConnection("unengaged");
      setError("");
      setOpen(false);
      startTransition(() => router.refresh());
    } catch {
      setError("network error — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors">
        <Building2 className="h-4 w-4" />
        new organisation
      </SheetTrigger>
      <SheetContent side="right" className="w-96">
        <SheetTitle>new organisation</SheetTitle>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="mb-1.5 block">name *</Label>
            <Input
              placeholder="organisation name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label className="mb-1.5 block">website</Label>
            <Input
              type="url"
              placeholder="https://example.org"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">type</Label>
            <Select value={type ?? ""} onValueChange={(v) => setType(v)}>
              <SelectTrigger><SelectValue placeholder="select type..." /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">connection</Label>
            <Select value={connection ?? "unengaged"} onValueChange={(v) => setConnection(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONNECTION_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <Button onClick={handleSave} disabled={!name.trim() || saving} className="w-full">
            {saving ? "creating..." : "create organisation"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
