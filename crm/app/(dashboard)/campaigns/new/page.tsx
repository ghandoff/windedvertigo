"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AudienceBuilderInline } from "@/app/components/audience-builder-inline";
import type { AudienceFilter } from "@/lib/notion/types";

export default function NewCampaignPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [type, setType] = useState<string | null>("one-off blast");
  const [owner, setOwner] = useState("");
  const [notes, setNotes] = useState("");
  const [audienceFilters, setAudienceFilters] = useState<AudienceFilter>({});
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Live audience count
  useEffect(() => {
    if (Object.keys(audienceFilters).length === 0) {
      setAudienceCount(null);
      return;
    }
    const timeout = setTimeout(() => {
      fetch("/crm/api/audience/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(audienceFilters),
      })
        .then((r) => r.json())
        .then((d) => setAudienceCount(d.count ?? 0))
        .catch(() => setAudienceCount(null));
    }, 500);
    return () => clearTimeout(timeout);
  }, [audienceFilters]);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/crm/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: type ?? "one-off blast",
          status: "draft",
          owner,
          audienceFilters,
          notes,
        }),
      });
      const data = await res.json();
      if (data.id) {
        startTransition(() => router.push(`/campaigns/${data.id}`));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to campaigns
      </Link>

      <PageHeader title="new campaign" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">basics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">campaign name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., LEGO conference 2026 outreach"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">type</Label>
                  <Select value={type ?? "one-off blast"} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="event-based">event-based</SelectItem>
                      <SelectItem value="recurring cadence">recurring cadence</SelectItem>
                      <SelectItem value="one-off blast">one-off blast</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">owner</Label>
                  <Input
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="e.g., payton"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="campaign goals, context, etc."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">target audience</CardTitle>
                {audienceCount !== null && (
                  <Badge variant="secondary">{audienceCount} orgs</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <AudienceBuilderInline
                value={audienceFilters}
                onChange={setAudienceFilters}
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardContent className="p-6 space-y-4">
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || saving}
                className="w-full"
              >
                {saving ? "creating..." : "create campaign"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                you can add steps after creating the campaign
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
