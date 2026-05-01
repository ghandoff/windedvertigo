"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OrgSearchField } from "./org-search-field";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import type { Contact } from "@/lib/notion/types";

const WARMTH_OPTIONS = ["cold", "lukewarm", "warm", "hot"] as const;
const TYPE_OPTIONS = [
  "decision maker", "program officer", "collaborator", "referral source",
  "team member", "manager", "ceo", "consultant",
] as const;
const STAGE_OPTIONS = [
  "stranger", "introduced", "in conversation", "warm connection",
  "active collaborator", "inner circle",
] as const;
const RESPONSIVENESS_OPTIONS = [
  "very responsive", "usually responsive", "slow to respond", "non-responsive",
] as const;

interface ContactEditDialogProps {
  contact: Contact;
  trigger?: React.ReactNode;
}

export function ContactEditDialog({ contact, trigger }: ContactEditDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email);
  const [role, setRole] = useState(contact.role);
  const [contactType, setContactType] = useState<string | null>(contact.contactType);
  const [contactWarmth, setContactWarmth] = useState<string | null>(contact.contactWarmth);
  const [relationshipStage, setRelationshipStage] = useState<string | null>(contact.relationshipStage);
  const [responsiveness, setResponsiveness] = useState<string | null>(contact.responsiveness);
  const [nextAction, setNextAction] = useState(contact.nextAction);
  const [organizationIds, setOrganizationIds] = useState(contact.organizationIds);
  const [linkedin, setLinkedin] = useState(contact.linkedin);
  const [phoneNumber, setPhoneNumber] = useState(contact.phoneNumber);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email || undefined,
          role: role || undefined,
          contactType: contactType || undefined,
          contactWarmth: contactWarmth || undefined,
          relationshipStage: relationshipStage || undefined,
          responsiveness: responsiveness || undefined,
          nextAction: nextAction || undefined,
          organizationIds,
          linkedin: linkedin || undefined,
          phoneNumber: phoneNumber || undefined,
        }),
      });
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
        <Pencil className="h-4 w-4" />
        edit
      </SheetTrigger>
      <SheetContent side="right" className="w-96 overflow-y-auto px-6 py-6">
        <SheetTitle>edit contact</SheetTitle>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="mb-1.5 block">name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">role</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} />
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
            <Label className="mb-1.5 block">warmth</Label>
            <Select value={contactWarmth ?? ""} onValueChange={(v) => setContactWarmth(v)}>
              <SelectTrigger><SelectValue placeholder="select warmth..." /></SelectTrigger>
              <SelectContent>
                {WARMTH_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">relationship stage</Label>
            <Select value={relationshipStage ?? ""} onValueChange={(v) => setRelationshipStage(v)}>
              <SelectTrigger><SelectValue placeholder="select stage..." /></SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">responsiveness</Label>
            <Select value={responsiveness ?? ""} onValueChange={(v) => setResponsiveness(v)}>
              <SelectTrigger><SelectValue placeholder="select..." /></SelectTrigger>
              <SelectContent>
                {RESPONSIVENESS_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">organisations</Label>
            <OrgSearchField value={organizationIds} onChange={setOrganizationIds} />
          </div>
          <div>
            <Label className="mb-1.5 block">next action</Label>
            <Textarea value={nextAction} onChange={(e) => setNextAction(e.target.value)} rows={2} placeholder="follow up after LEGO conf..." />
          </div>
          <div>
            <Label className="mb-1.5 block">linkedin</Label>
            <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." />
          </div>
          <div>
            <Label className="mb-1.5 block">phone</Label>
            <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1..." />
          </div>
          <Button onClick={handleSave} disabled={!name.trim() || saving} className="w-full">
            {saving ? "saving..." : "save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
