"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, Mail, Globe, Hash, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { StepChannel } from "@/lib/notion/types";

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  linkedin: Globe,
  twitter: Hash,
  bluesky: Cloud,
};

const CHANNEL_OPTIONS: StepChannel[] = ["email", "linkedin", "twitter", "bluesky"];

export interface WizardStep {
  id: string;
  channel: StepChannel;
  subject: string;
  body: string;
  delayDays: number;
  delayReference: string;
  templateName?: string;
}

interface StepCustomizerProps {
  steps: WizardStep[];
  onChange: (steps: WizardStep[]) => void;
}

export function StepCustomizer({ steps, onChange }: StepCustomizerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  function moveUp(index: number) {
    if (index === 0) return;
    const newSteps = [...steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    onChange(newSteps);
  }

  function moveDown(index: number) {
    if (index >= steps.length - 1) return;
    const newSteps = [...steps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    onChange(newSteps);
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }

  function updateStep(id: string, updates: Partial<WizardStep>) {
    onChange(steps.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }

  function addStep() {
    onChange([
      ...steps,
      {
        id: crypto.randomUUID(),
        channel: "email",
        subject: "",
        body: "",
        delayDays: 3,
        delayReference: "after previous step",
      },
    ]);
  }

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const Icon = CHANNEL_ICONS[step.channel] ?? Mail;
        const isEditing = editingId === step.id;

        return (
          <div
            key={step.id}
            className="border rounded-lg p-3 space-y-2 hover:border-accent/30 transition-colors"
          >
            {/* Header row */}
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-muted shrink-0">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className="text-sm font-medium flex-1 truncate">
                step {index + 1} — {step.channel}
                {step.templateName && (
                  <span className="text-muted-foreground font-normal ml-1.5">({step.templateName})</span>
                )}
              </span>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {step.delayDays === 0 ? "day 0" : `+${step.delayDays}d`}
              </Badge>
              <div className="flex gap-0.5">
                <button onClick={() => moveUp(index)} disabled={index === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => moveDown(index)} disabled={index >= steps.length - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setEditingId(isEditing ? null : step.id)} className="p-1 text-muted-foreground hover:text-accent text-xs">
                  {isEditing ? "done" : "edit"}
                </button>
                <button onClick={() => removeStep(index)} className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Preview */}
            {!isEditing && step.subject && (
              <p className="text-xs text-muted-foreground truncate pl-9">
                {step.subject}
              </p>
            )}

            {/* Edit form */}
            {isEditing && (
              <div className="pl-9 space-y-3 pt-2 border-t">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">channel</Label>
                    <Select value={step.channel} onValueChange={(v) => v && updateStep(step.id, { channel: v as StepChannel })}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CHANNEL_OPTIONS.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">delay (days)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={step.delayDays}
                      onChange={(e) => updateStep(step.id, { delayDays: Number(e.target.value) })}
                      className="text-xs"
                    />
                  </div>
                </div>
                {step.channel === "email" && (
                  <div>
                    <Label className="text-xs mb-1 block">subject</Label>
                    <Input
                      value={step.subject}
                      onChange={(e) => updateStep(step.id, { subject: e.target.value })}
                      placeholder="{{orgName}} + winded.vertigo — ..."
                      className="text-xs"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs mb-1 block">body</Label>
                  <Textarea
                    value={step.body}
                    onChange={(e) => updateStep(step.id, { body: e.target.value })}
                    placeholder="email/post content..."
                    rows={4}
                    className="text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Button variant="outline" size="sm" onClick={addStep} className="w-full">
        <Plus className="h-4 w-4 mr-1.5" />
        add step
      </Button>
    </div>
  );
}
