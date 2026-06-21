/**
 * /partners — teaming partner database.
 * Greenfield (BIZ-J1). Shows local and international sub-contractors,
 * consortium members, and other teaming partners for international bids.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/app/components/page-header";
import { EmptyState } from "@/app/components/empty-state";
import { FilterSelect } from "@/app/components/filter-select";
import { Badge } from "@/components/ui/badge";
import { Users2 } from "lucide-react";
import {
  getPartners,
  type RfpPartner,
  type PartnerType,
  type PartnerRelationship,
} from "@/lib/supabase/rfp-partners";
import { PartnersShell } from "./partners-shell";

export const metadata: Metadata = { robots: "noindex", title: "partners" };
export const dynamic = "force-dynamic";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Best-effort ISO 3166-1 alpha-2 → flag emoji. Returns null for unknowns. */
function countryFlag(country: string | null): string | null {
  if (!country) return null;
  const MAP: Record<string, string> = {
    "Kenya": "🇰🇪", "Uganda": "🇺🇬", "Tanzania": "🇹🇿", "Ethiopia": "🇪🇹",
    "Rwanda": "🇷🇼", "Ghana": "🇬🇭", "Nigeria": "🇳🇬", "Senegal": "🇸🇳",
    "Cameroon": "🇨🇲", "Côte d'Ivoire": "🇨🇮", "Malawi": "🇲🇼",
    "Zambia": "🇿🇲", "Zimbabwe": "🇿🇼", "Mozambique": "🇲🇿",
    "South Africa": "🇿🇦", "Egypt": "🇪🇬", "Morocco": "🇲🇦",
    "Jordan": "🇯🇴", "Lebanon": "🇱🇧", "India": "🇮🇳", "Nepal": "🇳🇵",
    "Bangladesh": "🇧🇩", "Philippines": "🇵🇭", "Indonesia": "🇮🇩",
    "Vietnam": "🇻🇳", "Cambodia": "🇰🇭", "Myanmar": "🇲🇲",
    "Haiti": "🇭🇹", "Guatemala": "🇬🇹", "Honduras": "🇭🇳",
    "Colombia": "🇨🇴", "Ecuador": "🇪🇨", "Peru": "🇵🇪", "Bolivia": "🇧🇴",
    "Canada": "🇨🇦", "United States": "🇺🇸", "United Kingdom": "🇬🇧",
    "Germany": "🇩🇪", "France": "🇫🇷", "Netherlands": "🇳🇱",
    "Sweden": "🇸🇪", "Norway": "🇳🇴", "Denmark": "🇩🇰",
    "Switzerland": "🇨🇭", "Belgium": "🇧🇪", "Australia": "🇦🇺",
    "New Zealand": "🇳🇿",
  };
  return MAP[country] ?? null;
}

const RELATIONSHIP_STYLES: Record<PartnerRelationship, string> = {
  known:       "border-border text-muted-foreground",
  nda_signed:  "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  ta_on_file:  "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800",
  active_sub:  "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
};

const RELATIONSHIP_LABELS: Record<PartnerRelationship, string> = {
  known:      "known",
  nda_signed: "NDA signed",
  ta_on_file: "TA on file",
  active_sub: "active sub",
};

// ── sub-components ────────────────────────────────────────────────────────────

function PartnerCard({ partner }: { partner: RfpPartner }) {
  const flag = countryFlag(partner.country);

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
      {/* header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm leading-tight">{partner.name}</p>
          {partner.country && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {flag ? `${flag} ` : ""}{partner.country}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1 shrink-0">
          <Badge variant="outline" className="text-xs capitalize">{partner.type}</Badge>
          <span
            className={`inline-flex items-center rounded-4xl border px-2 py-0.5 text-xs font-medium ${RELATIONSHIP_STYLES[partner.relationship]}`}
          >
            {RELATIONSHIP_LABELS[partner.relationship]}
          </span>
        </div>
      </div>

      {/* capabilities */}
      {partner.capabilities && partner.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {partner.capabilities.map((cap) => (
            <span
              key={cap}
              className="inline-flex items-center rounded-4xl border border-border px-2 py-0.5 text-xs text-muted-foreground"
            >
              {cap}
            </span>
          ))}
        </div>
      )}

      {/* contact */}
      {(partner.contactName || partner.contactEmail) && (
        <div className="text-xs text-muted-foreground border-t pt-2 mt-auto">
          {partner.contactName && <span>{partner.contactName}</span>}
          {partner.contactName && partner.contactEmail && " · "}
          {partner.contactEmail && (
            <a
              href={`mailto:${partner.contactEmail}`}
              className="text-accent hover:underline"
            >
              {partner.contactEmail}
            </a>
          )}
        </div>
      )}

      {/* notes */}
      {partner.notes && (
        <p className="text-xs text-muted-foreground leading-relaxed border-t pt-2 line-clamp-2">
          {partner.notes}
        </p>
      )}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

const TYPE_OPTIONS    = ["local", "international", "academic", "government"] as const;
const REL_OPTIONS     = ["known", "nda_signed", "ta_on_file", "active_sub"] as const;

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function PartnerGrid({ searchParams }: Props) {
  const params = await searchParams;

  const partners = await getPartners({
    type:         params.type as PartnerType | undefined,
    relationship: params.relationship as PartnerRelationship | undefined,
    country:      params.country,
  }).catch((): RfpPartner[] => []);

  if (partners.length === 0) {
    return (
      <EmptyState
        icon={Users2}
        title="no partners added yet"
        description="add your first teaming partner to start building the database."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {partners.map((p) => (
        <PartnerCard key={p.id} partner={p} />
      ))}
    </div>
  );
}

export default async function PartnersPage(props: Props) {
  return (
    <>
      <PartnersShell />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense>
          <FilterSelect
            paramKey="type"
            placeholder="type"
            options={TYPE_OPTIONS}
          />
          <FilterSelect
            paramKey="relationship"
            placeholder="relationship"
            options={REL_OPTIONS}
          />
        </Suspense>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-4 h-36 animate-pulse" />
            ))}
          </div>
        }
      >
        <PartnerGrid searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
