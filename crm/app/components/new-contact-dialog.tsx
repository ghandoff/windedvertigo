"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrgSearchField } from "./org-search-field";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

const TYPE_OPTIONS = [
  "decision maker", "program officer", "collaborator", "referral source",
  "team member", "manager", "ceo", "consultant",
] as const;
const STAGE_OPTIONS = [
  "stranger", "introduced", "in conversation", "warm connection",
  "active collaborator", "inner circle",
] as const;

interface NewContactDialogProps {
  /** Pre-fill organization relation */
  organizationId?: string;
  /** Compact mode for mobile */
  compact?: boolean;
}

export function NewContactDialog({ organizationId, compact }: NewContactDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [contactType, setContactType] = useState<string | null>(null);
  const [relationshipStage, setRelationshipStage] = useState<string | null>("stranger");
  const [orgIds, setOrgIds] = useState<string[]>(organizationId ? [organizationId] : []);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          role: role.trim() || undefined,
          contactType: contactType || undefined,
          relationshipStage: relationshipStage || "stranger",
          organizationIds: orgIds.length > 0 ? orgIds : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "creation failed" }));
        setError(data.error || `failed (${res.status})`);
        return;
      }

      // Reset
      setName("");
      setEmail("");
      setRole("");
      setContactType(null);
      setRelationshipStage("stranger");
      setOrgIds(organizationId ? [organizationId] : []);
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
        <UserPlus className="h-4 w-4" />
        {compact ? "new" : "new contact"}
      </SheetTrigger>
      <SheetContent side="right" className="w-96">
        <SheetTitle>new contact</SheetTitle>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="mb-1.5 block">name *</Label>
            <Input
              placeholder="first & last name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className={compact ? "text-base" : ""}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">email</Label>
            <Input type="email" placeholder="email@org.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">role</Label>
            <Input placeholder="job title" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">type</Label>
            <Select value={contactType ?? ""} onValueChange={(v) => setContactType(v)}>
              <SelectTrigger><SelectValue placeholder="select type..." /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">relationship stage</Label>
            <Select value={relationshipStage ?? "stranger"} onValueChange={(v) => setRelationshipStage(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">organization</Label>
            <OrgSearchField value={orgIds} onChange={setOrgIds} multiple={false} />
          </div>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <Button onClick={handleSave} disabled={!name.trim() || saving} className="w-full">
            {saving ? "creating..." : "create contact"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
