/**
 * RfpFunderProfile — server component that renders an intelligence card
 * about the organisation linked to an RFP.
 *
 * Shows org metadata (type, geography, website, email) plus a list of
 * prior bids from wv against the same funder, with an average bid value.
 * Used in the RFP detail page right sidebar (Phase 5 of the Biz roadmap).
 */

import Link from "next/link";
import { Building2, Globe, MapPin, Mail } from "lucide-react";
import { getOrganization } from "@/lib/notion/organizations";
import { getRfpsByOrg } from "@/lib/supabase/rfp-opportunities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── status colour map (mirrors detail page) ─────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  radar: "bg-blue-50 text-blue-700 border-blue-200",
  reviewing: "bg-yellow-50 text-yellow-700 border-yellow-200",
  pursuing: "bg-orange-50 text-orange-700 border-orange-200",
  interviewing: "bg-cyan-50 text-cyan-700 border-cyan-200",
  submitted: "bg-purple-50 text-purple-700 border-purple-200",
  won: "bg-green-50 text-green-700 border-green-200",
  lost: "bg-red-50 text-red-700 border-red-200",
  "no-go": "bg-gray-100 text-gray-600 border-gray-200",
  "missed deadline": "bg-red-50 text-red-400 border-red-100",
};

// ── helpers ──────────────────────────────────────────────────────────────────

function formatAvgValue(values: number[]): string {
  if (values.length === 0) return "";
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (avg >= 1_000_000) return `$${(avg / 1_000_000).toFixed(1)}m`;
  if (avg >= 1_000) return `$${Math.round(avg / 1_000)}k`;
  return `$${Math.round(avg)}`;
}

function yearFromDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  return dateStr.slice(0, 4);
}

// ── component ────────────────────────────────────────────────────────────────

interface Props {
  rfpId: string;
  organizationIds: string[];
}

export async function RfpFunderProfile({ rfpId, organizationIds }: Props) {
  if (organizationIds.length === 0) return null;

  const orgId = organizationIds[0];

  // Fetch org + prior bids in parallel
  let org: Awaited<ReturnType<typeof getOrganization>>;
  let pastBids: Awaited<ReturnType<typeof getRfpsByOrg>>;

  try {
    [org, pastBids] = await Promise.all([
      getOrganization(orgId),
      getRfpsByOrg(orgId, rfpId),
    ]);
  } catch {
    // Non-fatal: silently skip if either call fails
    return null;
  }

  if (!org) return null;

  // Compute average bid value across past bids that have a value set
  const values = pastBids
    .map((b) => b.estimatedValue)
    .filter((v): v is number => v !== null);
  const avgValue = formatAvgValue(values);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0" />
          funder profile
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">

        {/* ── org identity ─────────────────────────────────── */}
        <div className="space-y-1">
          <p className="font-semibold text-base leading-snug">
            <Link
              href={`/organizations/${orgId}`}
              className="hover:underline"
            >
              {org.organization}
            </Link>
          </p>

          {org.type && (
            <p className="text-xs text-muted-foreground">{org.type}</p>
          )}
        </div>

        {/* ── quick-facts row ──────────────────────────────── */}
        <div className="space-y-1.5">
          {org.regions && org.regions.length > 0 && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{org.regions.join(", ")}</span>
            </div>
          )}

          {org.website && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <a
                href={org.website.startsWith("http") ? org.website : `https://${org.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline truncate"
              >
                {org.website.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}

          {org.email && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <a href={`mailto:${org.email}`} className="hover:underline">
                {org.email}
              </a>
            </div>
          )}
        </div>

        {/* ── past bids ────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              past bids
            </p>
            {avgValue && (
              <span className="text-xs text-muted-foreground">
                avg {avgValue}
              </span>
            )}
          </div>

          {pastBids.length === 0 ? (
            <p className="text-xs text-muted-foreground">no prior bids recorded.</p>
          ) : (
            <ul className="space-y-1.5">
              {pastBids.map((bid) => (
                <li key={bid.id} className="flex items-start gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 shrink-0 ${STATUS_COLORS[bid.status] ?? ""}`}
                  >
                    {bid.status}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/rfp-radar/${bid.id}`}
                      className="text-xs hover:underline line-clamp-1"
                    >
                      {bid.opportunityName}
                    </Link>
                    <p className="text-[10px] text-muted-foreground">
                      {[
                        yearFromDate(bid.dueDate?.start),
                        bid.estimatedValue
                          ? formatAvgValue([bid.estimatedValue])
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
