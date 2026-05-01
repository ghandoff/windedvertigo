import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getPublicStats } from "@/lib/queries/stats";
import { getCopyForPage } from "@/lib/queries/site-copy";
import { getSession } from "@/lib/auth-helpers";
import { getUserCredits, REDEMPTION_THRESHOLDS } from "@/lib/queries/credits";
import { getRunsForUser } from "@/lib/queries/runs/list-queries";
import { getGalleryEvidence } from "@/lib/queries/gallery";
import { getUserMaterialIds } from "@/lib/queries/user-materials";
import { getAllMaterials } from "@/lib/queries/materials";
import MaterialPickerHero from "@/components/landing/material-picker-hero";

/**
 * Landing page for creaseworks.
 *
 * Bifurcated experience:
 *   - Authenticated users see a play dashboard (recent activity,
 *     credits, community, and a big matcher CTA pre-filled from
 *     their workshop inventory).
 *   - Logged-out visitors see the marketing page with an interactive
 *     material picker hero — "tap what you have on hand."
 *
 * Dark theme matching windedvertigo.com design language:
 *   - cadet (#273248) background, white text, #1e2738 card surfaces
 *   - redwood accent, champagne hover, lowercase everything
 *
 * Copy is sourced from the Notion "site copy" database via getCopyForPage().
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "creaseworks — playdates that use what you already have" },
  description:
    "simple, tested playdates for parents, teachers, and kids. notice the world around you, see possibility everywhere, and make things with whatever's on hand.",
  alternates: { canonical: "https://windedvertigo.com/harbour/creaseworks" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "creaseworks",
      url: "https://windedvertigo.com/harbour/creaseworks",
      description:
        "simple, tested playdates for parents, teachers, and kids. use what you already have.",
      parentOrganization: {
        "@type": "Organization",
        name: "winded vertigo",
        url: "https://windedvertigo.com",
      },
    },
    {
      "@type": "WebSite",
      name: "creaseworks",
      url: "https://windedvertigo.com/harbour/creaseworks",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://windedvertigo.com/harbour/creaseworks/matcher",
        description: "find playdates that match what you have on hand",
      },
    },
  ],
};

/* JSON-LD is a hardcoded schema.org object — not user content, safe to inline */
const jsonLdScript = JSON.stringify(jsonLd);

export default async function Home() {
  const session = await getSession();

  if (session) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: "var(--wv-cadet)" }}>
        <script type="application/ld+json">{jsonLdScript}</script>
        <PlayDashboard userId={session.userId} orgId={session.orgId} isAdmin={session.isAdmin} />
      </main>
    );
  }

  // logged-out: marketing page with interactive material hero
  const [stats, c, allMaterials] = await Promise.all([
    getPublicStats(),
    getCopyForPage("landing"),
    getAllMaterials(),
  ]);

  // pick 12 diverse materials (one per form, then fill to 12)
  const heroMaterials = pickHeroMaterials(allMaterials, 12);

  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--wv-cadet)" }}>
      <script type="application/ld+json">{jsonLdScript}</script>

      {/* -- hero with material picker ------------------------------ */}
      <section className="px-6 pt-28 pb-16 sm:pt-36 sm:pb-20" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="flex flex-col items-center text-center">
          <p
            className="text-xs font-semibold tracking-widest mb-6"
            style={{ color: "var(--wv-redwood)", letterSpacing: "0.1em" }}
          >
            {c["landing.hero.kicker"]?.copy ?? "a winded.vertigo project"}
          </p>

          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold font-serif tracking-tight mb-4 leading-tight"
            style={{ color: "var(--wv-white)", maxWidth: 800 }}
          >
            tap what you have on hand
          </h1>

          <p
            className="text-base sm:text-lg mb-10 leading-relaxed"
            style={{ color: "var(--color-text-on-dark-muted)", maxWidth: 520 }}
          >
            pick a material below and we&apos;ll instantly find playdates you can do with it. no sign-up needed.
          </p>

          <MaterialPickerHero materials={heroMaterials} />

          <p
            className="text-xs mt-6"
            style={{ color: "var(--color-text-on-dark-muted)" }}
          >
            or{" "}
            <Link href="/find" className="underline" style={{ color: "var(--wv-sienna)" }}>
              try the full matcher
            </Link>
            {" "}with everything you have
          </p>
        </div>
      </section>

      {/* -- what you get ----------------------------------------- */}
      <section className="px-6 py-20 sm:py-24" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p
          className="text-xs font-semibold tracking-widest text-center mb-3"
          style={{ color: "var(--wv-redwood)", letterSpacing: "0.08em" }}
        >
          {c["landing.features.kicker"]?.copy ?? "what\u2019s included"}
        </p>
        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-4 text-center"
          style={{ color: "var(--wv-white)" }}
        >
          {c["landing.features.headline"]?.copy ?? "everything you need to get started"}
        </h2>
        <p
          className="text-center mb-12"
          style={{ color: "var(--color-text-on-dark-muted)", maxWidth: 560, margin: "0 auto 48px" }}
        >
          {c["landing.features.description"]?.copy ?? "every playdate is a complete package \u2014 not just a concept, but step-by-step instructions so you can jump in right away."}
        </p>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<ScriptIcon />}
            title={c["landing.features.card.1.title"]?.copy ?? "step-by-step guide"}
            description={c["landing.features.card.1.description"]?.copy ?? "a simple three-part playdate you can do in under two hours. clear steps, timing, and tips \u2014 no prep degree needed."}
          />
          <FeatureCard
            icon={<MaterialsIcon />}
            title={c["landing.features.card.2.title"]?.copy ?? "use what you have"}
            description={c["landing.features.card.2.description"]?.copy ?? "every playdate tells you what to grab \u2014 cardboard, tape, sticks, whatever's around. plus easy swaps when you don't have the exact thing."}
          />
          <FeatureCard
            icon={<TransferIcon />}
            title={c["landing.features.card.3.title"]?.copy ?? "find again"}
            description={c["landing.features.card.3.description"]?.copy ?? "the fun part after playing. a prompt that helps you notice the same idea popping up in totally different places."}
          />
          <FeatureCard
            icon={<PdfIcon />}
            title={c["landing.features.card.4.title"]?.copy ?? "printable cards"}
            description={c["landing.features.card.4.description"]?.copy ?? "download any playdate as a handy PDF card. keep it in your bag, stick it on the fridge, or hand it to a babysitter."}
          />
        </div>
      </section>

      {/* -- matcher highlight ------------------------------------- */}
      <section className="px-6 py-16 sm:py-20" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          className="rounded-2xl px-8 py-12 sm:px-12 sm:py-16 text-center"
          style={{ backgroundColor: "rgba(250, 241, 232, 0.06)" }}
        >
          <p
            className="text-xs font-semibold tracking-widest mb-3"
            style={{ color: "var(--wv-sienna)", letterSpacing: "0.08em" }}
          >
            {c["landing.matcher.kicker"]?.copy ?? "free tool"}
          </p>
          <h2
            className="text-2xl sm:text-3xl font-bold tracking-tight mb-4"
            style={{ color: "var(--wv-white)" }}
          >
            {c["landing.matcher.headline"]?.copy ?? "what do you have on hand?"}
          </h2>
          <p
            className="mb-8 leading-relaxed"
            style={{ color: "var(--color-text-on-dark-muted)", maxWidth: 500, margin: "0 auto 32px" }}
          >
            {c["landing.matcher.description"]?.copy ?? "tell us what\u2019s around \u2014 cardboard, sticks, fabric, whatever \u2014 and we\u2019ll instantly match you with playdates that work."}
          </p>
          <Link
            href="/find"
            className="inline-block rounded-lg px-8 py-3.5 font-medium transition-colors"
            style={{ backgroundColor: "var(--wv-sienna)", color: "var(--wv-white)" }}
          >
            {c["landing.matcher.cta"]?.copy ?? "try the matcher"}
          </Link>
        </div>
      </section>

      {/* -- how it works ----------------------------------------- */}
      <section className="px-6 py-20 sm:py-24" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p
          className="text-xs font-semibold tracking-widest text-center mb-3"
          style={{ color: "var(--wv-redwood)", letterSpacing: "0.08em" }}
        >
          {c["landing.how-it-works.kicker"]?.copy ?? "getting started"}
        </p>
        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-12 text-center"
          style={{ color: "var(--wv-white)" }}
        >
          {c["landing.how-it-works.headline"]?.copy ?? "how it works"}
        </h2>

        <div className="space-y-8" style={{ maxWidth: 640, margin: "0 auto" }}>
          <Step
            number="1"
            title={c["landing.how-it-works.step.1.title"]?.copy ?? "find a playdate"}
            description={c["landing.how-it-works.step.1.description"]?.copy ?? "browse free previews or tell us what you have on hand \u2014 we'll find playdates that work with your stuff."}
          />
          <Step
            number="2"
            title={c["landing.how-it-works.step.2.title"]?.copy ?? "grab a pack"}
            description={c["landing.how-it-works.step.2.description"]?.copy ?? "packs are bundles of playdates. buy once and everyone in your family or classroom gets access forever."}
          />
          <Step
            number="3"
            title={c["landing.how-it-works.step.3.title"]?.copy ?? "play!"}
            description={c["landing.how-it-works.step.3.description"]?.copy ?? "follow the steps, see what happens, and try to find the same idea in the wild. no new toys needed."}
          />
        </div>
      </section>

      {/* -- who it's for ----------------------------------------- */}
      <section className="px-6 py-20 sm:py-24" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p
          className="text-xs font-semibold tracking-widest text-center mb-3"
          style={{ color: "var(--wv-redwood)", letterSpacing: "0.08em" }}
        >
          {c["landing.who-its-for.kicker"]?.copy ?? "who it\u2019s for"}
        </p>
        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-12 text-center"
          style={{ color: "var(--wv-white)" }}
        >
          {c["landing.who-its-for.headline"]?.copy ?? "made for kids, parents, teachers, and anyone who likes to make things"}
        </h2>

        <div className="grid gap-5 sm:grid-cols-3" style={{ maxWidth: 900, margin: "0 auto" }}>
          <AudienceCard
            title={c["landing.who-its-for.card.1.title"]?.copy ?? "parents"}
            description={c["landing.who-its-for.card.1.description"]?.copy ?? "play right now with whatever's around. no shopping trip needed."}
          />
          <AudienceCard
            title={c["landing.who-its-for.card.2.title"]?.copy ?? "teachers"}
            description={c["landing.who-its-for.card.2.description"]?.copy ?? "bring hands-on playdates into your classroom. works with any budget and any age."}
          />
          <AudienceCard
            title={c["landing.who-its-for.card.3.title"]?.copy ?? "anyone, really"}
            description={c["landing.who-its-for.card.3.description"]?.copy ?? "babysitters, grandparents, camp counselors, kids on their own \u2014 if you like making things, you'll find something here."}
          />
        </div>
      </section>

      {/* -- social proof stats ----------------------------------- */}
      {(stats.playdateCount > 0 || stats.materialCount > 0) && (
        <section className="px-6 py-16 sm:py-20" style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="grid gap-8 sm:grid-cols-3 text-center" style={{ maxWidth: 700, margin: "0 auto" }}>
            {stats.playdateCount > 0 && (
              <div>
                <p
                  className="text-3xl sm:text-4xl font-bold mb-1"
                  style={{ color: "var(--wv-redwood)" }}
                >
                  {stats.playdateCount}
                </p>
                <p className="text-sm" style={{ color: "var(--color-text-on-dark-muted)" }}>
                  {c["landing.stats.playdates"]?.copy ?? "playdates and counting"}
                </p>
              </div>
            )}
            {stats.materialCount > 0 && (
              <div>
                <p
                  className="text-3xl sm:text-4xl font-bold mb-1"
                  style={{ color: "var(--wv-sienna)" }}
                >
                  {stats.materialCount}
                </p>
                <p className="text-sm" style={{ color: "var(--color-text-on-dark-muted)" }}>
                  {c["landing.stats.materials"]?.copy ?? "everyday materials"}
                </p>
              </div>
            )}
            {stats.reflectionCount > 0 && (
              <div>
                <p
                  className="text-3xl sm:text-4xl font-bold mb-1"
                  style={{ color: "var(--wv-champagne)" }}
                >
                  {stats.reflectionCount}
                </p>
                <p className="text-sm" style={{ color: "var(--color-text-on-dark-muted)" }}>
                  {c["landing.stats.reflections"]?.copy ?? "reflections logged"}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* -- CTA -------------------------------------------------- */}
      <section className="px-6 py-20 sm:py-24 text-center" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-4"
          style={{ color: "var(--wv-white)" }}
        >
          {c["landing.cta.headline"]?.copy ?? "start exploring \u2014 it\u2019s free"}
        </h2>
        <p
          className="mb-8 leading-relaxed"
          style={{ color: "var(--color-text-on-dark-muted)", maxWidth: 500, margin: "0 auto 32px" }}
        >
          {c["landing.cta.description"]?.copy ?? "peek at playdates, try the matcher, and see if creaseworks is your kind of thing \u2014 no sign-up needed."}
        </p>
        <Link
          href="/sampler"
          className="inline-block rounded-lg px-8 py-3.5 font-medium transition-colors"
          style={{ backgroundColor: "var(--wv-redwood)", color: "var(--wv-white)" }}
        >
          {c["landing.cta.button"]?.copy ?? "see free playdates"}
        </Link>
      </section>

    </main>
  );
}

/* ── play dashboard (authenticated) ────────────────────────────── */

async function PlayDashboard({
  userId,
  orgId,
  isAdmin,
}: {
  userId: string;
  orgId: string | null;
  isAdmin: boolean;
}) {
  const [credits, recentRuns, galleryItems, inventoryIds] = await Promise.all([
    getUserCredits(userId),
    getRunsForUser({ userId, orgId, isAdmin }, 3, 0),
    getGalleryEvidence(3, 0),
    getUserMaterialIds(userId),
  ]);

  // next credit milestone
  const thresholds = [
    { label: "a free sampler PDF", target: REDEMPTION_THRESHOLDS.sampler_pdf },
    { label: "a free playdate", target: REDEMPTION_THRESHOLDS.single_playdate },
    { label: "a free pack", target: REDEMPTION_THRESHOLDS.full_pack },
  ];
  const nextGoal = thresholds.find((t) => credits < t.target) ?? thresholds[thresholds.length - 1];
  const creditsToGo = Math.max(nextGoal.target - credits, 0);

  // pre-fill matcher URL with workshop inventory
  const matcherHref = inventoryIds.length > 0
    ? `/find?from=workshop`
    : `/find`;

  return (
    <div className="px-5 pt-24 pb-32 sm:pt-28" style={{ maxWidth: 720, margin: "0 auto" }}>

      {/* -- main CTA ------------------------------------------- */}
      <section className="text-center mb-10">
        <h1
          className="text-3xl sm:text-4xl font-bold font-serif tracking-tight mb-3"
          style={{ color: "var(--wv-white)" }}
        >
          what should we do today?
        </h1>
        <p
          className="text-sm mb-6"
          style={{ color: "var(--color-text-on-dark-muted)" }}
        >
          {inventoryIds.length > 0
            ? `your workshop has ${inventoryIds.length} material${inventoryIds.length === 1 ? "" : "s"} \u2014 let\u2019s find something to make.`
            : "tell us what you have on hand and we\u2019ll find a playdate."}
        </p>
        <Link
          href={matcherHref}
          className="inline-block rounded-xl px-10 py-4 text-base font-bold transition-all hover:scale-105 active:scale-95"
          style={{
            backgroundColor: "var(--wv-redwood)",
            color: "var(--wv-white)",
            boxShadow: "0 4px 20px rgba(177, 80, 67, 0.3)",
          }}
        >
          find a playdate
        </Link>
      </section>

      {/* -- credit counter ------------------------------------- */}
      {credits > 0 && (
        <section
          className="rounded-xl px-5 py-4 mb-6"
          style={{
            backgroundColor: "rgba(255,235,210,0.06)",
            border: "1px solid rgba(255,235,210,0.08)",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center justify-center rounded-full font-bold tabular-nums flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                fontSize: credits >= 100 ? "0.65rem" : "0.8rem",
                backgroundColor: "var(--wv-sienna)",
                color: "var(--wv-white)",
              }}
            >
              {credits}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--wv-champagne)" }}>
                crease credits
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-on-dark-muted)" }}>
                {creditsToGo > 0
                  ? `${creditsToGo} more for ${nextGoal.label}`
                  : `you\u2019ve earned enough for ${nextGoal.label}!`}
              </p>
            </div>
            <Link
              href="/profile"
              className="text-xs font-medium"
              style={{ color: "var(--wv-sienna)" }}
            >
              view
            </Link>
          </div>
        </section>
      )}

      {/* -- recent activity ------------------------------------ */}
      {recentRuns.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ color: "var(--wv-white)" }}>
              recent activity
            </h2>
            <Link
              href="/log"
              className="text-xs font-medium"
              style={{ color: "var(--wv-sienna)" }}
            >
              see all
            </Link>
          </div>
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <Link
                key={run.id}
                href={run.playdate_slug ? `/play/${run.playdate_slug}` : "/log"}
                className="flex items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-white/5"
                style={{ backgroundColor: "var(--color-surface-raised)" }}
              >
                <span
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: run.run_type === "find_again"
                      ? "rgba(88, 203, 178, 0.15)"
                      : "rgba(203, 120, 88, 0.15)",
                    color: run.run_type === "find_again"
                      ? "var(--wv-seafoam)"
                      : "var(--wv-sienna)",
                  }}
                >
                  {run.run_type === "find_again" ? "FA" : "R"}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--wv-white)" }}
                  >
                    {run.playdate_title ?? run.title}
                  </p>
                  {run.run_date && (
                    <p className="text-2xs" style={{ color: "var(--color-text-on-dark-muted)" }}>
                      {formatRunDate(run.run_date)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* -- new in the community ------------------------------- */}
      {galleryItems.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ color: "var(--wv-white)" }}>
              new in the community
            </h2>
            <Link
              href="/community"
              className="text-xs font-medium"
              style={{ color: "var(--wv-sienna)" }}
            >
              explore
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {galleryItems.map((item) => (
              <Link
                key={item.id}
                href="/community"
                className="rounded-lg overflow-hidden aspect-square relative group"
                style={{ backgroundColor: "var(--color-surface-raised)" }}
              >
                {item.thumbnail_key || item.storage_key ? (
                  <Image
                    src={`/harbour/creaseworks/api/evidence/${item.id}/thumb`}
                    alt={item.playdate_title ? `from ${item.playdate_title}` : "community share"}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="(max-width: 640px) 33vw, 200px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-3">
                    <p
                      className="text-xs text-center line-clamp-4 leading-relaxed"
                      style={{ color: "var(--color-text-on-dark-muted)" }}
                    >
                      {item.quote_text ?? item.body ?? "shared by " + item.user_first_name}
                    </p>
                  </div>
                )}
                {item.playdate_title && (
                  <div
                    className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                    style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.6))" }}
                  >
                    <p className="text-2xs text-white truncate">{item.playdate_title}</p>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────── */

/** Pick N hero materials with form diversity. */
function pickHeroMaterials(
  allMaterials: { id: string; title: string; emoji: string | null; icon: string | null; form_primary: string | null }[],
  count: number,
) {
  const picked: typeof allMaterials = [];
  const seenForms = new Set<string>();

  // first pass: one per form
  for (const m of allMaterials) {
    if (picked.length >= count) break;
    const form = m.form_primary ?? "other";
    if (!seenForms.has(form)) {
      seenForms.add(form);
      picked.push(m);
    }
  }

  // second pass: fill remaining slots
  for (const m of allMaterials) {
    if (picked.length >= count) break;
    if (!picked.includes(m)) {
      picked.push(m);
    }
  }

  return picked;
}

/** Format a run date for display. */
function formatRunDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

/* -- sub-components (co-located) ----------------------------------- */

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-xl p-6 transition-all"
      style={{ backgroundColor: "var(--color-surface-raised)" }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
        style={{ backgroundColor: "rgba(175,79,65,0.15)", color: "var(--wv-sienna)" }}
      >
        {icon}
      </div>
      <h3 className="text-sm font-bold mb-2" style={{ color: "var(--wv-white)" }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-on-dark-muted)" }}>
        {description}
      </p>
    </div>
  );
}

function AudienceCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-xl p-6 text-center"
      style={{ backgroundColor: "var(--color-surface-raised)" }}
    >
      <h3 className="text-base font-bold mb-2" style={{ color: "var(--wv-white)" }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-on-dark-muted)" }}>
        {description}
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-5 items-start">
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
        style={{ backgroundColor: "var(--wv-redwood)", color: "var(--wv-white)" }}
      >
        {number}
      </div>
      <div className="pt-1">
        <h3 className="text-base font-bold mb-1" style={{ color: "var(--wv-white)" }}>
          {title}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-on-dark-muted)" }}>
          {description}
        </p>
      </div>
    </div>
  );
}

/* -- inline SVG icons (brand-matched to w.v colour system) --------- */

function ScriptIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 3h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 7h8M6 10h6M6 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MaterialsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TransferIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 16l-3-3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 13H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 2h7l5 5v10a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 2v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 12h6M7 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
