/**
 * Branded PDF template for package builder quadrants.
 *
 * Uses @react-pdf/renderer — this runs server-side only (API route / cron).
 * Each quadrant produces one PDF (max 2 pages) with current Notion content.
 *
 * Key layout decisions:
 *  - wrap={false} on each section prevents awkward page splits
 *  - Compact font sizes (8-10pt body) to fit within 2 pages
 *  - Footer pinned to bottom of last page via marginTop: "auto"
 */

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Link,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { PackData } from "@/lib/notion";

/* ── Brand colors ── */

const COLORS: Record<string, { primary: string; text: string }> = {
  "people-design": { primary: "#273248", text: "#ffffff" },
  "people-research": { primary: "#cb7858", text: "#ffffff" },
  "product-design": { primary: "#b15043", text: "#ffffff" },
  "product-research": { primary: "#ffebd2", text: "#273248" },
};

const QUADRANT_LABELS: Record<string, string> = {
  "people-design": "people \u00d7 design",
  "people-research": "people \u00d7 research",
  "product-design": "product \u00d7 design",
  "product-research": "product \u00d7 research",
};

const BG = "#1a2332";
const SURFACE = "#1e2738";
const CARD = "#3a4459";
const TEXT_SECONDARY = "#a0aec0";
const SIENNA = "#cb7858";
const CHAMPAGNE = "#ffebd2";

/** Resolve accent color — cadet blue is invisible on dark bg, use sienna instead */
function accent(quadrantKey: string): string {
  const c = COLORS[quadrantKey];
  return c && c.primary !== "#273248" ? c.primary : SIENNA;
}

/* ── Styles ── */

const s = StyleSheet.create({
  page: {
    backgroundColor: BG,
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    color: "#ffffff",
    fontSize: 9,
    lineHeight: 1.5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: CARD,
  },
  logo: { width: 80, height: 42 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 3,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 16,
    lineHeight: 1.2,
  },
  promise: {
    fontSize: 10,
    color: TEXT_SECONDARY,
    marginBottom: 14,
    lineHeight: 1.4,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: "lowercase",
  },
  storyBox: {
    backgroundColor: SURFACE,
    padding: 12,
    borderRadius: 4,
    marginBottom: 14,
  },
  storyText: {
    fontSize: 8,
    color: TEXT_SECONDARY,
    lineHeight: 1.6,
    textAlign: "center",
  },
  outcomeCard: {
    backgroundColor: CARD,
    padding: 8,
    marginBottom: 4,
    borderRadius: 3,
    borderLeftWidth: 3,
  },
  outcomeTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  outcomeDetail: {
    fontSize: 8,
    color: TEXT_SECONDARY,
    lineHeight: 1.4,
  },
  howWeWork: {
    backgroundColor: SURFACE,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: CARD,
    fontSize: 8,
    color: TEXT_SECONDARY,
    lineHeight: 1.6,
  },
  crossover: {
    padding: 10,
    borderRadius: 3,
    borderLeftWidth: 3,
    fontSize: 8,
    lineHeight: 1.5,
    color: CHAMPAGNE,
  },
  crossoverBold: { fontFamily: "Helvetica-Bold" },
  exampleCard: {
    backgroundColor: CARD,
    padding: 7,
    marginBottom: 4,
    borderRadius: 3,
  },
  exampleTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 1,
  },
  exampleType: {
    fontSize: 7,
    color: SIENNA,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  exampleDetail: {
    fontSize: 7,
    color: TEXT_SECONDARY,
    lineHeight: 1.3,
  },
  footer: {
    marginTop: "auto",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: CARD,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 7, color: TEXT_SECONDARY },
  footerCta: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: SIENNA,
    textDecoration: "none",
  },
});

/* ── Template ── */

export function PackagePDF({
  pack,
  quadrantKey,
  ctaLink = "https://calendar.app.google/ZXVqJLdprmUZk1DW6",
}: {
  pack: PackData;
  quadrantKey: string;
  ctaLink?: string;
}) {
  const colors = COLORS[quadrantKey] ?? COLORS["product-design"];
  const label = QUADRANT_LABELS[quadrantKey] ?? quadrantKey;
  const ac = accent(quadrantKey);

  return (
    <Document
      title={`${label} — winded.vertigo`}
      author="winded.vertigo"
      subject={pack.promise}
    >
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header} fixed>
          <Image
            src="https://www.windedvertigo.com/images/logo.png"
            style={s.logo}
          />
          <View style={[s.badge, { backgroundColor: colors.primary, color: colors.text }]}>
            <Text>{label}</Text>
          </View>
        </View>

        {/* Title + promise — wrap={false} keeps together */}
        <View wrap={false}>
          <Text style={[s.title, { color: ac }]}>{pack.title}</Text>
          <Text style={s.promise}>{pack.promise}</Text>
        </View>

        {/* Quadrant story */}
        {pack.quadrantStory && (
          <View style={s.storyBox} wrap={false}>
            <Text style={s.storyText}>{pack.quadrantStory}</Text>
          </View>
        )}

        {/* Outcomes — each card won't split, but the group can flow across pages */}
        {pack.outcomes.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={[s.sectionLabel, { color: ac }]}>
              what you'll get
            </Text>
            {pack.outcomes.map((o, i) => (
              <View key={i} style={[s.outcomeCard, { borderLeftColor: ac }]} wrap={false}>
                <Text style={s.outcomeTitle}>{o.title}</Text>
                {o.detail && <Text style={s.outcomeDetail}>{o.detail}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* How we'll work together — wrap={false} keeps the whole block on one page */}
        {pack.story && (
          <View style={{ marginBottom: 12 }} wrap={false}>
            <Text style={[s.sectionLabel, { color: ac }]}>
              how we'll work together
            </Text>
            <View style={s.howWeWork}>
              <Text>{pack.story}</Text>
            </View>
          </View>
        )}

        {/* Crossover */}
        {pack.crossover && (
          <View
            style={[s.crossover, { borderLeftColor: ac, backgroundColor: `${colors.primary}15` }]}
            wrap={false}
          >
            <Text>
              <Text style={s.crossoverBold}>crossing boundaries: </Text>
              {pack.crossover}
            </Text>
          </View>
        )}

        {/* Examples */}
        {pack.examples.length > 0 && (
          <View style={{ marginTop: 10, marginBottom: 12 }} wrap={false}>
            <Text style={[s.sectionLabel, { color: ac }]}>
              see it in action
            </Text>
            {pack.examples.map((ex) => (
              <View key={ex.id} style={s.exampleCard}>
                <Text style={s.exampleTitle}>{ex.title}</Text>
                {ex.type && <Text style={s.exampleType}>{ex.type}</Text>}
                {ex.detail && <Text style={s.exampleDetail}>{ex.detail}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Footer — pinned to bottom of last page */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            windedvertigo.com  —  © winded.vertigo {new Date().getFullYear()}
          </Text>
          <Link src={ctaLink} style={s.footerCta}>
            book a playdate →
          </Link>
        </View>
      </Page>
    </Document>
  );
}
