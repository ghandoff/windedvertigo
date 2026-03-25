"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetTitle,
} from "@/components/ui/sheet";
import type { CachedContact } from "@/lib/pwa/offline-store";

const WARMTH_OPTIONS = ["cold", "lukewarm", "warm", "hot"] as const;
const STAGE_OPTIONS = [
  "stranger", "introduced", "in conversation", "warm connection",
  "active collaborator", "inner circle",
] as const;
const TYPE_OPTIONS = [
  "decision maker", "program officer", "collaborator", "referral source",
  "team member", "manager", "ceo", "consultant",
] as const;

interface MobileContactEditProps {
  contact: CachedContact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileContactEdit({ contact, open, onOpenChange }: MobileContactEditProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email);
  const [role, setRole] = useState(contact.role);
  const [warmth, setWarmth] = useState(contact.contactWarmth || "");
  const [stage, setStage] = useState(contact.relationshipStage || "stranger");
  const [nextAction, setNextAction] = useState("");

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/crm/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          role: role.trim() || undefined,
          contactWarmth: warmth || undefined,
          relationshipStage: stage || undefined,
          nextAction: nextAction.trim() || undefined,
        }),
      });
      onOpenChange(false);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
        <SheetTitle className="text-base">{contact.name}</SheetTitle>
        <div className="mt-4 space-y-3">
          <div>
            <Label className="text-xs mb-1 block">name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="text-base" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="text-base" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">role</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} className="text-base" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">warmth</Label>
              <Select value={warmth} onValueChange={(v) => setWarmth(v ?? "")}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="select..." /></SelectTrigger>
                <SelectContent>
                  {WARMTH_OPTIONS.map((o) => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v ?? "stranger")}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((o) => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">next action</Label>
            <Textarea
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="follow up after event..."
              rows={2}
              className="text-sm"
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full h-11 text-base">
            {saving ? "saving..." : "save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
