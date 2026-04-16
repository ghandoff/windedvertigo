import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchSiteContent } from "@/lib/notion";
import type { SiteSection } from "@/lib/notion";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "what. – winded.vertigo",
  description:
    "learning is change. the winded.vertigo collective is dedicated to fostering human development through experiences with the interconnectedness of everything.",
  alternates: { canonical: "/what/" },
  openGraph: {
    title: "what. – winded.vertigo",
    description:
      "learning is change. the winded.vertigo collective is dedicated to fostering human development through experiences with the interconnectedness of everything.",
    url: "/what/",
  },
};

const brandColor: Record<string, string> = {
  cadet: "var(--wv-cadet)",
  redwood: "var(--wv-redwood)",
  sienna: "var(--wv-sienna)",
  champagne: "var(--wv-champagne)",
  white: "var(--wv-white)",
};

function groupBySection(sections: SiteSection[]): Record<string, SiteSection[]> {
  const groups: Record<string, SiteSection[]> = {};
  for (const s of sections) {
    const key = s.section || "ungrouped";
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  // Sort each group by order, then deduplicate by name (keep first)
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    const seen = new Set<string>();
    groups[key] = groups[key].filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
  }
  return groups;
}

/** Desired pillar display order */
const PILLAR_ORDER = ["play", "justice", "aliveness"];

export default async function WhatPage() {
  const sections = await fetchSiteContent("what");
  const groups = groupBySection(sections);

  const hero = groups.hero?.find((s) => s.type === "hero" && s.name.includes("what"));
  const bodyParagraphs = groups.body ?? [];
  const pillarMap = new Map((groups.pillars ?? []).map((p) => [p.name, p]));
  const pillars = PILLAR_ORDER.map((name) => pillarMap.get(name)).filter(Boolean) as SiteSection[];
  const processSteps = (groups.process ?? []).sort((a, b) => {
    const ORDER = ["find", "fold", "unfold", "find again"];
    return ORDER.indexOf(a.name) - ORDER.indexOf(b.name);
  });

  return (
    <>
      <SiteHeader />

      <main id="main-content">
        {/* ── hero ──────────────────────────────────── */}
        <div className="container content-narrow">
          <section className="what-hero" id="what-content">
            <h1 className="what-hero-title">
              {hero?.name || "learning is change."}
            </h1>

            {bodyParagraphs.map((p, i) => (
              <p key={i} className="what-hero-body">
                {p.content}
              </p>
            ))}
          </section>

          {/* ── pillars ────────────────────────────────── */}
          {pillars.length > 0 && (
            <section className="what-values" aria-label="core values">
              <h2 className="what-values-label">what guides us</h2>
              {pillars.map((pillar) => (
                <div key={pillar.name} className="what-value">
                  <h2
                    className="what-value-heading"
                    style={
                      pillar.textColor
                        ? { color: brandColor[pillar.textColor] || undefined }
                        : undefined
                    }
                  >
                    {pillar.name}
                  </h2>
                  <p className="what-value-body">{pillar.content}</p>
                </div>
              ))}
            </section>
          )}
        </div>

        {/* ── photo band + process strip (shared bottom edge) ── */}
        <div className="what-imagery">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="what-photo-band-img"
            src="/images/what/photo-band.png"
            alt="winded.vertigo community in action"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="what-process-strip"
            src="/images/what/process-strip.png"
            alt="find, fold, unfold, find again — the winded.vertigo learning process"
          />
        </div>

        {/* ── process ────────────────────────────────── */}
        {processSteps.length > 0 && (
          <section className="what-process-section" aria-label="our process">
            <div className="container content-narrow">
              <div className="what-process">
                {processSteps.map((step) => (
                  <div key={step.name} className="what-process-step">
                    <h3 className="what-process-heading">{step.name}</h3>
                    <p className="what-process-body">{step.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter sections={sections} />
    </>
  );
}
