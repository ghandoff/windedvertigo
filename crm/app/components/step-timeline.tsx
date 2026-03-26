"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Globe, Hash, Cloud, Plus, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { CampaignStep } from "@/lib/notion/types";

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  linkedin: Globe,
  twitter: Hash,
  bluesky: Cloud,
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-700",
  sending: "bg-yellow-100 text-yellow-700",
  sent: "bg-green-100 text-green-700",
  skipped: "bg-gray-100 text-gray-500",
};

interface StepTimelineProps {
  campaignId: string;
  steps: CampaignStep[];
  audienceCount: number;
}

export function StepTimeline({ campaignId, steps, audienceCount }: StepTimelineProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [sendingStep, setSendingStep] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ stepId: string; message: string; ok: boolean } | null>(null);

  // add step form state
  const [newChannel, setNewChannel] = useState<string | null>("email");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newDelay, setNewDelay] = useState("0");

  async function handleAddStep() {
    if (!newBody.trim()) return;
    await fetch(`/api/campaigns/${campaignId}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: newChannel ?? "email",
        subject: newSubject,
        body: newBody,
        delayDays: parseInt(newDelay) || 0,
      }),
    });
    setNewSubject("");
    setNewBody("");
    setNewDelay("0");
    setShowAddForm(false);
    startTransition(() => router.refresh());
  }

  async function handleSendStep(stepId: string) {
    setSendingStep(stepId);
    setSendResult(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendResult({ stepId, message: `sent ${data.sent}, skipped ${data.skipped}, failed ${data.failed}`, ok: true });
        startTransition(() => router.refresh());
      } else {
        setSendResult({ stepId, message: data.error || "send failed", ok: false });
      }
    } catch {
      setSendResult({ stepId, message: "network error", ok: false });
    } finally {
      setSendingStep(null);
    }
  }

  return (
    <div className="space-y-4">
      {steps.length === 0 && !showAddForm && (
        <p className="text-sm text-muted-foreground text-center py-4">
          no steps yet. add your first step to get started.
        </p>
      )}

      {steps.map((step, i) => {
        const Icon = CHANNEL_ICONS[step.channel] ?? Mail;
        return (
          <div key={step.id} className="relative">
            {/* connector line */}
            {i < steps.length - 1 && (
              <div className="absolute left-4 top-10 bottom-0 w-px bg-border" />
            )}
            <div className="flex gap-3">
              {/* step indicator */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              {/* step content */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{step.name}</span>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[step.status] ?? ""}`}>
                    {step.status}
                  </Badge>
                </div>
                {step.subject && (
                  <p className="text-xs text-muted-foreground truncate">
                    subject: {step.subject}
                  </p>
                )}
                {step.body && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {step.body}
                  </p>
                )}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  {(step.delayDays ?? 0) > 0 && (
                    <span>{step.delayDays} days after previous step</span>
                  )}
                  {step.sendDate?.start && (
                    <span>
                      {new Date(step.sendDate.start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
                {/* send button for draft/scheduled email steps */}
                {step.channel === "email" && (step.status === "draft" || step.status === "scheduled") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSendStep(step.id)}
                    disabled={sendingStep === step.id || audienceCount === 0}
                    className="mt-1 text-xs h-7"
                  >
                    {sendingStep === step.id ? (
                      "sending..."
                    ) : (
                      <>
                        <Send className="h-3 w-3 mr-1" />
                        send to {audienceCount} orgs
                      </>
                    )}
                  </Button>
                )}
                {/* send result */}
                {sendResult?.stepId === step.id && (
                  <div className={`flex items-center gap-1.5 text-xs mt-1 ${sendResult.ok ? "text-green-600" : "text-destructive"}`}>
                    {sendResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {sendResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* add step form */}
      {showAddForm ? (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">channel</Label>
              <Select value={newChannel ?? "email"} onValueChange={setNewChannel}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">email</SelectItem>
                  <SelectItem value="linkedin">linkedin</SelectItem>
                  <SelectItem value="twitter">twitter</SelectItem>
                  <SelectItem value="bluesky">bluesky</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">delay (days)</Label>
              <Input
                type="number"
                value={newDelay}
                onChange={(e) => setNewDelay(e.target.value)}
                className="h-8 text-xs"
                min={0}
              />
            </div>
          </div>
          {(newChannel === "email" || !newChannel) && (
            <div>
              <Label className="text-xs">subject</Label>
              <Input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="email subject with {{orgName}}"
                className="h-8 text-xs"
              />
            </div>
          )}
          <div>
            <Label className="text-xs">body</Label>
            <Textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="content with {{orgName}}, {{senderName}}, etc."
              rows={4}
              className="text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddStep} disabled={!newBody.trim()} className="text-xs h-7">
              add step
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)} className="text-xs h-7">
              cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          add step
        </button>
      )}
    </div>
  );
}
