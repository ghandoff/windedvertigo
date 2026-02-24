/**
 * /evidence/shared/[token] — public shared evidence view.
 *
 * No auth required. Looks up the share by token, checks expiry,
 * fetches the user's evidence using the share's filters, and
 * renders a read-only gallery.
 *
 * Phase D — evidence export (practitioner tier).
 */

import { notFound } from "next/navigation";
import { getShareByToken } from "@/lib/queries/evidence-shares";
import {
  getPortfolioEvidence,
  type EvidenceType,
} from "@/lib/queries/evidence";
import { generateReadUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

export default async function SharedEvidencePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await getShareByToken(token);

  if (!share) {
    notFound();
  }

  // Parse filters from the share record
  const filters = share.filters ?? {};
  const evidenceType = (filters.type as EvidenceType) ?? undefined;
  const playdateSlug = (filters.playdate as string) ?? undefined;

  // Fetch evidence using the share owner's userId + filters
  const items = await getPortfolioEvidence(share.user_id, {
    evidenceType,
    playdateSlug,
    limit: 100,
    offset: 0,
  });

  // Sign photo URLs on the server side
  const enriched = await Promise.all(
    items.map(async (item) => {
      if (item.evidence_type === "photo" && item.storage_key) {
        try {
          const photoUrl = await generateReadUrl(item.storage_key);
          const thumbUrl = item.thumbnail_key
            ? await generateReadUrl(item.thumbnail_key)
            : photoUrl;
          return { ...item, photoUrl, thumbUrl };
        } catch {
          return { ...item, photoUrl: null, thumbUrl: null };
        }
      }
      return { ...item, photoUrl: null, thumbUrl: null };
    }),
  );

  const expiryDate = new Date(share.expires_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Filter labels for display
  const filterParts: string[] = [];
  if (evidenceType) filterParts.push(evidenceType + "s");
  if (playdateSlug) filterParts.push(playdateSlug);

  return (
    <main className="min-h-screen px-6 py-16 max-w-5xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-1">
        shared evidence
      </h1>
      <p className="text-sm text-cadet/50 mb-1">
        a curated collection of photos, quotes, and observations.
      </p>
      <p className="text-[11px] text-cadet/30 mb-8">
        this link expires {expiryDate}
        {filterParts.length > 0 && (
          <>
            {" "}
            &middot; showing {filterParts.join(", ")}
          </>
        )}
      </p>

      {items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-cadet/40">
            no evidence to display.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {enriched.map((item) => (
            <div
              key={item.id}
              className="rounded-xl overflow-hidden border border-cadet/8 bg-white"
            >
              {item.evidence_type === "photo" && item.thumbUrl ? (
                <div className="aspect-square bg-cadet/5">
                  <img
                    src={item.thumbUrl}
                    alt={`evidence from ${item.run_title}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : item.evidence_type === "quote" ? (
                <div
                  className="aspect-square flex items-center justify-center p-4"
                  style={{ backgroundColor: "rgba(203, 120, 88, 0.06)" }}
                >
                  <div className="text-center">
                    <p className="text-xs italic text-cadet/70 line-clamp-4 leading-relaxed">
                      &ldquo;{item.quote_text}&rdquo;
                    </p>
                    {item.quote_attribution && (
                      <p className="text-[10px] text-cadet/40 mt-1.5">
                        — {item.quote_attribution}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="aspect-square flex flex-col justify-center p-4"
                  style={{ backgroundColor: "rgba(39, 50, 72, 0.03)" }}
                >
                  {item.prompt_key && (
                    <p className="text-[10px] font-medium text-sienna/60 mb-1">
                      {item.prompt_key.replace(/_/g, " ")}
                    </p>
                  )}
                  <p className="text-xs text-cadet/60 line-clamp-5 leading-relaxed">
                    {item.body}
                  </p>
                </div>
              )}

              {/* caption strip */}
              <div className="px-3 py-2 border-t border-cadet/5">
                <p className="text-[11px] font-medium text-cadet truncate">
                  {item.playdate_title ?? item.run_title}
                </p>
                <p className="text-[10px] text-cadet/40">
                  {item.run_date
                    ? new Date(item.run_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* footer branding */}
      <div className="mt-12 pt-6 border-t border-cadet/8 text-center">
        <p className="text-[11px] text-cadet/30">
          powered by{" "}
          <a
            href="https://windedvertigo.com"
            className="hover:text-cadet/50 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            creaseworks
          </a>
        </p>
      </div>
    </main>
  );
}
