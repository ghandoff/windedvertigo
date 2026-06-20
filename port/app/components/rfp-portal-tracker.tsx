"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Clock, XCircle, Plus, Trash2, ShieldAlert } from "lucide-react";
import type { PortalRegistration, PortalStatus } from "@/lib/supabase/rfp-portal-registrations";

const STATUS_CONFIG: Record<PortalStatus, {
  label: string;
  icon: React.ElementType;
  cls: string;
  badgeCls: string;
}> = {
  "registered":   { label: "registered",   icon: CheckCircle2,  cls: "text-green-700",  badgeCls: "bg-green-50 text-green-700 border-green-200" },
  "pending":      { label: "pending",       icon: Clock,         cls: "text-yellow-600", badgeCls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  "blocked":      { label: "blocked",       icon: XCircle,       cls: "text-red-600",    badgeCls: "bg-red-50 text-red-700 border-red-200" },
  "not-required": { label: "not required",  icon: CheckCircle2,  cls: "text-gray-500",   badgeCls: "bg-gray-50 text-gray-500 border-gray-200" },
};

const STATUS_OPTIONS: { value: PortalStatus; label: string }[] = [
  { value: "registered",   label: "registered" },
  { value: "pending",      label: "pending — awaiting approval" },
  { value: "blocked",      label: "blocked — can't register" },
  { value: "not-required", label: "not required for this bid" },
];

const KNOWN_PORTALS = ["UNGM", "UNICEF eSourcing", "IDB", "World Bank eSourcing", "UNOPS", "direct submission"];

interface Props {
  rfpId: string;
  registrations: PortalRegistration[];
}

export function RfpPortalTracker({ rfpId, registrations: initial }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [registrations, setRegistrations] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [portalName, setPortalName] = useState("");
  const [status, setStatus] = useState<PortalStatus>("pending");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const hasBlocker = registrations.some((r) => r.status === "blocked");
  const hasPending = registrations.some((r) => r.status === "pending");

  async function submit() {
    if (!portalName.trim()) { setErr("portal name is required"); return; }
    setErr(null);
    const res = await fetch(`/api/rfp-radar/${rfpId}/portal-registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portalName: portalName.trim(), status, notes: notes || null }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error ?? "save failed"); return; }
    setRegistrations((prev) => {
      const existing = prev.findIndex((r) => r.portalName === data.portalName);
      if (existing >= 0) { const next = [...prev]; next[existing] = data; return next; }
      return [...prev, data];
    });
    setPortalName(""); setStatus("pending"); setNotes(""); setAdding(false);
    startTransition(() => router.refresh());
  }

  async function remove(id: string) {
    await fetch(`/api/rfp-radar/${rfpId}/portal-registrations`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId: id }),
    });
    setRegistrations((prev) => prev.filter((r) => r.id !== id));
    startTransition(() => router.refresh());
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          portal registrations
          {hasBlocker && <ShieldAlert className="h-4 w-4 text-red-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* warning banner */}
        {(hasBlocker || hasPending) && (
          <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
            hasBlocker
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-yellow-200 bg-yellow-50 text-yellow-700"
          }`}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {hasBlocker
                ? "one or more portals are blocked — resolve before submitting."
                : "portal registration pending — confirm before submission deadline."}
            </span>
          </div>
        )}

        {registrations.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            no portals tracked yet. add the funder&apos;s procurement portal to ensure registration doesn&apos;t block submission.
          </p>
        )}

        {/* registration rows */}
        <div className="space-y-2">
          {registrations.map((r) => {
            const cfg = STATUS_CONFIG[r.status];
            const Icon = cfg.icon;
            return (
              <div key={r.id} className="flex items-start gap-2">
                <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.cls}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{r.portalName}</span>
                    <Badge variant="outline" className={`text-[10px] ${cfg.badgeCls}`}>
                      {cfg.label}
                    </Badge>
                  </div>
                  {r.notes && <p className="text-xs text-muted-foreground mt-0.5">{r.notes}</p>}
                </div>
                <button
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  onClick={() => remove(r.id)}
                  title="remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* add form */}
        {adding ? (
          <div className="space-y-2 pt-1 border-t border-border/40">
            <div>
              <label className="text-xs text-muted-foreground">portal</label>
              <input
                list="known-portals"
                value={portalName}
                onChange={(e) => setPortalName(e.target.value)}
                placeholder="e.g. UNGM, UNICEF eSourcing"
                className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <datalist id="known-portals">
                {KNOWN_PORTALS.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PortalStatus)}
                className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">notes (optional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. applied 15 Jun, awaiting org-level approval"
                className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={isPending}
                className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                save
              </button>
              <button
                onClick={() => { setAdding(false); setErr(null); setPortalName(""); setNotes(""); }}
                className="rounded px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            add portal
          </button>
        )}
      </CardContent>
    </Card>
  );
}
