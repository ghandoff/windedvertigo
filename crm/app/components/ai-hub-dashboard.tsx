"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  Search,
  HeartPulse,
  Lightbulb,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Minus,
  ArrowRight,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

// ── types (mirrors server types for client use) ──────────

interface UsageSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byFeature: Record<string, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
}

interface Budget {
  monthlyLimitUsd: number;
  warningThresholdPct: number;
  currentSpendUsd: number;
  remainingUsd: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
}

interface CostBreakdown {
  apiCosts: {
    monthly: number;
    projected: number;
    byFeature: Record<string, number>;
  };
  notionApiCosts: {
    estimatedCallsPerMonth: number;
    withinFreeTier: boolean;
  };
  computeCosts: {
    estimatedFunctionMs: number;
    estimatedGbSeconds: number;
    monthlyEstimate: number;
  };
  infrastructureCosts: {
    vercelBandwidthGb: number;
    r2StorageGb: number;
    monthlyEstimate: number;
  };
  operationalCosts: {
    estimatedDevHoursPerMonth: number;
    maintenanceNotes: string[];
  };
  totalMonthlyEstimate: number;
}

interface RelationshipScore {
  contactId: string;
  contactName: string;
  score: number;
  trend: "improving" | "stable" | "declining" | "at-risk";
  factors: string[];
  daysSinceContact: number;
  activityCount: number;
}

interface NextAction {
  contactId?: string;
  contactName?: string;
  organizationId?: string;
  organizationName?: string;
  action: string;
  reason: string;
  priority: "high" | "medium" | "low";
  suggestedDate: string;
  channel: string;
}

interface NlSearchContact {
  id: string;
  name: string;
  contactWarmth?: string;
  relationshipStage?: string;
}

interface NlSearchOrg {
  id: string;
  organization: string;
  priority?: string;
  connection?: string;
}

interface NlSearchResult {
  filters: { explanation: string };
  results: {
    contacts: NlSearchContact[];
    organizations: NlSearchOrg[];
  };
  usage: { costUsd: number };
}

// ── feature labels ───────────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  "email-draft": "AI Email Drafting",
  "nl-search": "Natural Language Search",
  "relationship-score": "Relationship Health",
  "next-best-action": "Next Best Action",
};

// ── main component ───────────────────────────────────────

export function AiHubDashboard() {
  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList>
        <TabsTrigger value="overview">
          <DollarSign className="h-4 w-4 mr-1.5" />
          economics
        </TabsTrigger>
        <TabsTrigger value="search">
          <Search className="h-4 w-4 mr-1.5" />
          AI search
        </TabsTrigger>
        <TabsTrigger value="relationships">
          <HeartPulse className="h-4 w-4 mr-1.5" />
          relationships
        </TabsTrigger>
        <TabsTrigger value="actions">
          <Lightbulb className="h-4 w-4 mr-1.5" />
          next actions
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <EconomicsTab />
      </TabsContent>
      <TabsContent value="search">
        <NlSearchTab />
      </TabsContent>
      <TabsContent value="relationships">
        <RelationshipsTab />
      </TabsContent>
      <TabsContent value="actions">
        <NextActionsTab />
      </TabsContent>
    </Tabs>
  );
}

// ── economics tab ────────────────────────────────────────

function EconomicsTab() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [costs, setCosts] = useState<CostBreakdown | null>(null);
  const [editBudget, setEditBudget] = useState(false);
  const [newLimit, setNewLimit] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/crm/api/ai/usage").then((r) => r.json()),
      fetch("/crm/api/ai/budget").then((r) => r.json()),
      fetch("/crm/api/ai/costs").then((r) => r.json()),
    ])
      .then(([u, b, c]) => {
        setUsage(u);
        setBudget(b);
        setCosts(c);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleBudgetSave() {
    const limit = parseFloat(newLimit);
    if (isNaN(limit) || limit <= 0) return;
    const res = await fetch("/crm/api/ai/budget", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyLimitUsd: limit }),
    });
    if (res.ok) {
      const updated = await fetch("/crm/api/ai/budget").then((r) => r.json());
      setBudget(updated);
      setEditBudget(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">loading economics data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Budget banner */}
      {budget && (
        <Card className={budget.isOverBudget ? "border-destructive" : budget.isNearLimit ? "border-yellow-500" : ""}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {budget.isOverBudget && <AlertTriangle className="h-5 w-5 text-destructive" />}
                {budget.isNearLimit && !budget.isOverBudget && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                <div>
                  <p className="font-medium">
                    monthly budget: ${budget.currentSpendUsd.toFixed(4)} / ${budget.monthlyLimitUsd.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ${budget.remainingUsd.toFixed(4)} remaining
                    {budget.isOverBudget && " — AI features paused"}
                    {budget.isNearLimit && !budget.isOverBudget && " — approaching limit"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editBudget ? (
                  <>
                    <Input
                      type="number"
                      placeholder="50.00"
                      value={newLimit}
                      onChange={(e) => setNewLimit(e.target.value)}
                      className="w-24"
                    />
                    <Button size="sm" onClick={handleBudgetSave}>save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditBudget(false)}>cancel</Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => { setEditBudget(true); setNewLimit(String(budget.monthlyLimitUsd)); }}>
                    <Settings className="h-3.5 w-3.5 mr-1" />
                    adjust
                  </Button>
                )}
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  budget.isOverBudget ? "bg-destructive" : budget.isNearLimit ? "bg-yellow-500" : "bg-primary"
                }`}
                style={{ width: `${Math.min(100, (budget.currentSpendUsd / budget.monthlyLimitUsd) * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">total requests</p>
            <p className="text-2xl font-semibold">{usage?.totalRequests ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">input tokens</p>
            <p className="text-2xl font-semibold">{(usage?.totalInputTokens ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">output tokens</p>
            <p className="text-2xl font-semibold">{(usage?.totalOutputTokens ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">API cost (month)</p>
            <p className="text-2xl font-semibold">${(usage?.totalCostUsd ?? 0).toFixed(4)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-feature breakdown */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">cost by feature</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(usage.byFeature).map(([feature, data]) => (
                <div key={feature} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{FEATURE_LABELS[feature] ?? feature}</span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{data.requests} calls</span>
                    <span>{(data.inputTokens + data.outputTokens).toLocaleString()} tokens</span>
                    <span className="font-medium text-foreground">${data.costUsd.toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full cost breakdown — hidden costs */}
      {costs && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">total cost of ownership (monthly)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">Claude API (tokens)</p>
                    <p className="text-sm text-muted-foreground">direct per-call costs for AI features</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${costs.apiCosts.monthly.toFixed(4)}</p>
                    <p className="text-xs text-muted-foreground">projected: ${costs.apiCosts.projected.toFixed(2)}/mo</p>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">Notion API</p>
                    <p className="text-sm text-muted-foreground">
                      ~{costs.notionApiCosts.estimatedCallsPerMonth.toLocaleString()} calls/mo
                      {costs.notionApiCosts.withinFreeTier ? " (within free tier)" : " (may exceed free tier)"}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={costs.notionApiCosts.withinFreeTier ? "secondary" : "destructive"}>
                      {costs.notionApiCosts.withinFreeTier ? "free" : "overage risk"}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">Vercel compute</p>
                    <p className="text-sm text-muted-foreground">
                      serverless function execution ({costs.computeCosts.estimatedGbSeconds.toFixed(1)} GB-s)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${costs.computeCosts.monthlyEstimate.toFixed(4)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">infrastructure</p>
                    <p className="text-sm text-muted-foreground">
                      bandwidth ({costs.infrastructureCosts.vercelBandwidthGb.toFixed(3)} GB) + R2 storage
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${costs.infrastructureCosts.monthlyEstimate.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">maintenance & operations</p>
                    <p className="text-sm text-muted-foreground">
                      ~{costs.operationalCosts.estimatedDevHoursPerMonth} dev hrs/month
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">human time</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 bg-muted/50 rounded px-3 -mx-3">
                  <p className="font-semibold">projected total (excl. labor)</p>
                  <p className="text-lg font-semibold">${costs.totalMonthlyEstimate.toFixed(2)}/mo</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Maintenance notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">operational overhead</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {costs.operationalCosts.maintenanceNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Minus className="h-4 w-4 mt-0.5 shrink-0" />
                    {note}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── natural language search tab ──────────────────────────

function NlSearchTab() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<NlSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/crm/api/ai/nl-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Search failed");
        return;
      }
      setResult(await res.json());
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-2">
            <Input
              placeholder={'try: "warm contacts at Tier 1 orgs I haven\'t emailed in 30 days"'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading || !query.trim()}>
              {loading ? "searching..." : (
                <>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  AI search
                </>
              )}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">{result.filters.explanation}</p>
              <p className="text-xs text-muted-foreground mt-1">cost: ${result.usage.costUsd.toFixed(4)}</p>
            </CardContent>
          </Card>

          {result.results.contacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">contacts ({result.results.contacts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.results.contacts.map((c) => (
                    <a
                      key={c.id}
                      href={`/crm/contacts/${c.id}`}
                      className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted transition-colors"
                    >
                      <span className="font-medium text-sm">{c.name}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {c.contactWarmth && <Badge variant="outline">{c.contactWarmth}</Badge>}
                        {c.relationshipStage && <Badge variant="secondary">{c.relationshipStage}</Badge>}
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.results.organizations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">organizations ({result.results.organizations.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.results.organizations.map((o) => (
                    <a
                      key={o.id}
                      href={`/crm/organizations/${o.id}`}
                      className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted transition-colors"
                    >
                      <span className="font-medium text-sm">{o.organization}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {o.priority && <Badge variant="outline">{o.priority.replace(/ – .+/, "")}</Badge>}
                        {o.connection && <Badge variant="secondary">{o.connection}</Badge>}
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.results.contacts.length === 0 && result.results.organizations.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                no results found — try a different query
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── relationships tab ────────────────────────────────────

function RelationshipsTab() {
  const [scores, setScores] = useState<RelationshipScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [costUsd, setCostUsd] = useState(0);

  async function handleScore() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/crm/api/ai/relationship-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed");
        return;
      }
      const data = await res.json();
      setScores(data.scores);
      setCostUsd(data.usage.costUsd);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const trendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining": return <TrendingDown className="h-4 w-4 text-yellow-500" />;
      case "at-risk": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    if (score >= 30) return "text-orange-500";
    return "text-destructive";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4 flex items-center justify-between">
          <div>
            <p className="font-medium">relationship health analysis</p>
            <p className="text-sm text-muted-foreground">
              AI analyzes activity patterns, response rates, and engagement to score each contact
            </p>
          </div>
          <Button onClick={handleScore} disabled={loading}>
            {loading ? "analyzing..." : (
              <>
                <HeartPulse className="h-4 w-4 mr-1.5" />
                run analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {scores.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">analysis cost: ${costUsd.toFixed(4)}</p>
          <div className="space-y-2">
            {scores
              .sort((a, b) => a.score - b.score)
              .map((s) => (
                <Card key={s.contactId}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-2xl font-bold ${scoreColor(s.score)}`}>{s.score}</span>
                        <div>
                          <a
                            href={`/crm/contacts/${s.contactId}`}
                            className="font-medium text-sm hover:underline"
                          >
                            {s.contactName}
                          </a>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {trendIcon(s.trend)}
                            <span>{s.trend}</span>
                            <span>|</span>
                            <span>{s.activityCount} activities</span>
                            <span>|</span>
                            <span>
                              {s.daysSinceContact < 999
                                ? `${s.daysSinceContact}d ago`
                                : "never contacted"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.factors.map((f, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── next actions tab ─────────────────────────────────────

function NextActionsTab() {
  const [actions, setActions] = useState<NextAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [costUsd, setCostUsd] = useState(0);

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/crm/api/ai/next-best-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed");
        return;
      }
      const data = await res.json();
      setActions(data.actions);
      setCostUsd(data.usage.costUsd);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const priorityColor = (p: string) => {
    switch (p) {
      case "high": return "destructive" as const;
      case "medium": return "default" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4 flex items-center justify-between">
          <div>
            <p className="font-medium">next best action recommendations</p>
            <p className="text-sm text-muted-foreground">
              AI suggests who to follow up with and what to do, based on your CRM data
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? "thinking..." : (
              <>
                <Lightbulb className="h-4 w-4 mr-1.5" />
                get recommendations
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {actions.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">analysis cost: ${costUsd.toFixed(4)}</p>
          <div className="space-y-2">
            {actions.map((a, i) => (
              <Card key={i}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={priorityColor(a.priority)}>{a.priority}</Badge>
                        <Badge variant="outline">{a.channel}</Badge>
                        {a.suggestedDate && (
                          <span className="text-xs text-muted-foreground">{a.suggestedDate}</span>
                        )}
                      </div>
                      <p className="font-medium text-sm">{a.action}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{a.reason}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-xs">
                        {a.contactName && (
                          <a
                            href={`/crm/contacts/${a.contactId}`}
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {a.contactName} <ArrowRight className="h-3 w-3" />
                          </a>
                        )}
                        {a.organizationName && (
                          <a
                            href={`/crm/organizations/${a.organizationId}`}
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {a.organizationName} <ArrowRight className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
