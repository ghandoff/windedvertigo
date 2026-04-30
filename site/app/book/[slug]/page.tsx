/**
 * /book/[slug] — visitor-facing booking page.
 *
 * Resolves event-type metadata directly from Supabase (server component, same
 * Worker as the API routes — direct DB access avoids a network hop).
 *
 * Optional `?prefill=<token>` query param prefills the form when arriving from
 * a campaign link. Token is verified server-side via the booking signing key.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { select, selectOne } from "@/lib/booking/supabase";
import type { EventType, Host } from "@/lib/booking/supabase";
import { verify, type PrefillTokenPayload } from "@/lib/booking/sign";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BookingFlow } from "@/components/booking/BookingFlow";
import styles from "@/components/booking/booking.module.css";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ prefill?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  let title = "book a playdate · winded.vertigo";
  let description = "pick a time to play with the winded.vertigo collective.";
  try {
    const ev = await selectOne<EventType>("event_types", {
      slug: `eq.${slug}`,
      active: "eq.true",
    });
    if (ev) {
      title = `${ev.title} · winded.vertigo`;
      description = ev.description ?? description;
    }
  } catch {
    // best-effort; keep defaults
  }
  return {
    title,
    description,
    robots: { index: false, follow: false },
  };
}

async function resolveHostNames(ev: EventType): Promise<string[]> {
  const ids: string[] = [];
  if (ev.primary_host_id) ids.push(ev.primary_host_id);
  for (const h of ev.host_pool) if (!ids.includes(h)) ids.push(h);
  if (ids.length === 0) return [];
  try {
    const hosts = await select<Host>("hosts", `id=in.(${ids.join(",")})`);
    // Preserve the input order
    const byId = new Map(hosts.map((h) => [h.id, h.display_name]));
    return ids.map((id) => byId.get(id)).filter((n): n is string => Boolean(n));
  } catch {
    return [];
  }
}

export default async function BookSlugPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;

  const ev = await selectOne<EventType>("event_types", {
    slug: `eq.${slug}`,
    active: "eq.true",
  });
  if (!ev) notFound();

  const hostNames = await resolveHostNames(ev);

  let prefill: {
    name?: string;
    email?: string;
    curious?: string;
    valuable?: string;
    quadrant?: string | null;
  } | undefined;

  if (sp.prefill) {
    try {
      const payload = await verify<PrefillTokenPayload>(sp.prefill);
      prefill = {
        name: payload.name,
        email: payload.email,
        curious: payload.curious,
        valuable: payload.valuable,
        quadrant: payload.quadrant,
      };
    } catch {
      // bad/expired token — silently ignore
    }
  }

  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY;

  const modeLabel =
    ev.mode === "round_robin"
      ? "with one of us"
      : ev.mode === "collective"
        ? "with the collective"
        : "1:1";

  return (
    <>
      <SiteHeader />
      <main id="main-content" className={styles.page}>
        <div className={styles.shell}>
          <header className={styles.hero}>
            <h1 className={styles.heroTitle}>{ev.title.toLowerCase()}</h1>
            <div className={styles.heroMeta}>
              <span>{ev.duration_min} minutes</span>
              <span>·</span>
              <span>{modeLabel}</span>
              {hostNames.length > 0 && (
                <>
                  <span>·</span>
                  <span>{hostNames.map((n) => n.toLowerCase()).join(", ")}</span>
                </>
              )}
            </div>
            {ev.description && <p className={styles.heroDescription}>{ev.description}</p>}
          </header>

          <BookingFlow
            eventTypeId={ev.id}
            slug={ev.slug}
            durationMin={ev.duration_min}
            prefill={prefill}
            turnstileSiteKey={turnstileSiteKey}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
