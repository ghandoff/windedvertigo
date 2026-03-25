/**
 * Branded PDF template for package builder quadrants.
 *
 * Uses @react-pdf/renderer — this runs server-side only (API route / cron).
 * Each quadrant produces one PDF with current Notion content.
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
  Font,
} from "@react-pdf/renderer";
import type { PackData, ModalAsset } from "@/lib/notion";

/* ── Brand colors ── */

const COLORS: Record<string, { primary: string; text: string }> = {
  "people-design": { primary: "#273248", text: "#ffffff" },
  "people-research": { primary: "#cb7858", text: "#ffffff" },
  "product-design": { primary: "#b15043", text: "#ffffff" },
  "product-research": { primary: "#ffebd2", text: "#273248" },
};

const QUADRANT_LABELS: Record<string, string> = {
  "people-design": "people × design",
  "people-research": "people × research",
  "product-design": "product × design",
  "product-research": "product × research",
};

const BG = "#1a2332";
const SURFACE = "#1e2738";
const CARD = "#3a4459";
const TEXT_PRIMARY = "#ffffff";
const TEXT_SECONDARY = "rgba(255,255,255,0.7)";
const SIENNA = "#cb7858";
const CHAMPAGNE = "#ffebd2";

/* ── Styles ── */

const s = StyleSheet.create({
  page: {
    backgroundColor: BG,
    padding: 40,
    fontFamily: "Helvetica",
    color: TEXT_PRIMARY,
    fontSize: 10,
    lineHeight: 1.6,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: CARD,
  },
  logo: {
    width: 100,
    height: 53,
  },
  quadrantBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  // Title area
  title: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  promise: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 20,
    lineHeight: 1.5,
  },
  // Section label
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: "lowercase",
  },
  // Quadrant story
  storyBox: {
    backgroundColor: SURFACE,
    padding: 16,
    borderRadius: 6,
    marginBottom: 20,
  },
  storyText: {
    fontSize: 10,
    color: TEXT_SECONDARY,
    lineHeight: 1.7,
    textAlign: "center",
  },
  // Outcomes
  outcomeCard: {
    backgroundColor: CARD,
    padding: 12,
    marginBottom: 6,
    borderRadius: 4,
    borderLeftWidth: 3,
  },
  outcomeTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  outcomeDetail: {
    fontSize: 9,
    color: TEXT_SECONDARY,
    lineHeight: 1.5,
  },
  // How we work
  howWeWork: {
    backgroundColor: SURFACE,
    padding: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: CARD,
    marginBottom: 10,
    fontSize: 10,
    color: TEXT_SECONDARY,
    lineHeight: 1.7,
  },
  // Crossover
  crossover: {
    padding: 12,
    borderRadius: 4,
    borderLeftWidth: 3,
    marginBottom: 20,
    fontSize: 9,
    lineHeight: 1.6,
    color: CHAMPAGNE,
  },
  crossoverLabel: {
    fontFamily: "Helvetica-Bold",
  },
  // Examples
  exampleCard: {
    backgroundColor: CARD,
    padding: 10,
    marginBottom: 6,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  exampleTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  exampleType: {
    fontSize: 8,
    color: SIENNA,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  exampleDetail: {
    fontSize: 8,
    color: TEXT_SECONDARY,
    lineHeight: 1.4,
  },
  // Footer
  footer: {
    marginTop: "auto",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: CARD,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: TEXT_SECONDARY,
  },
  footerCta: {
    fontSize: 9,
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

  return (
    <Document
      title={`${label} — winded.vertigo`}
      author="winded.vertigo"
      subject={pack.promise}
    >
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Image
            src="https://www.windedvertigo.com/images/logo.png"
            style={s.logo}
          />
          <View
            style={[
              s.quadrantBadge,
              { backgroundColor: colors.primary, color: colors.text },
            ]}
          >
            <Text>{label}</Text>
          </View>
        </View>

        {/* Title + promise */}
        <Text style={[s.title, { color: colors.primary === "#273248" ? SIENNA : colors.primary }]}>
          {pack.title}
        </Text>
        <Text style={s.promise}>{pack.promise}</Text>

        {/* Quadrant story */}
        {pack.quadrantStory && (
          <View style={s.storyBox}>
            <Text style={s.storyText}>{pack.quadrantStory}</Text>
          </View>
        )}

        {/* Outcomes */}
        {pack.outcomes.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={[s.sectionLabel, { color: colors.primary === "#273248" ? SIENNA : colors.primary }]}>
              what you&apos;ll get
            </Text>
            {pack.outcomes.map((o, i) => (
              <View
                key={i}
                style={[s.outcomeCard, { borderLeftColor: colors.primary === "#273248" ? SIENNA : colors.primary }]}
              >
                <Text style={s.outcomeTitle}>{o.title}</Text>
                {o.detail && <Text style={s.outcomeDetail}>{o.detail}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* How we'll work together */}
        {pack.story && (
          <View style={{ marginBottom: 16 }}>
            <Text style={[s.sectionLabel, { color: colors.primary === "#273248" ? SIENNA : colors.primary }]}>
              how we&apos;ll work together
            </Text>
            <View style={s.howWeWork}>
              <Text>{pack.story}</Text>
            </View>
          </View>
        )}

        {/* Crossover */}
        {pack.crossover && (
          <View
            style={[
              s.crossover,
              {
                borderLeftColor: colors.primary === "#273248" ? SIENNA : colors.primary,
                backgroundColor: `${colors.primary}22`,
              },
            ]}
          >
            <Text>
              <Text style={s.crossoverLabel}>crossing boundaries: </Text>
              {pack.crossover}
            </Text>
          </View>
        )}

        {/* Examples */}
        {pack.examples.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={[s.sectionLabel, { color: colors.primary === "#273248" ? SIENNA : colors.primary }]}>
              see it in action
            </Text>
            {pack.examples.map((ex) => (
              <View key={ex.id} style={s.exampleCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.exampleTitle}>{ex.title}</Text>
                  {ex.type && <Text style={s.exampleType}>{ex.type}</Text>}
                  {ex.detail && <Text style={s.exampleDetail}>{ex.detail}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            windedvertigo.com — © winded.vertigo {new Date().getFullYear()}
          </Text>
          <Link src={ctaLink} style={s.footerCta}>
            book a playdate →
          </Link>
        </View>
      </Page>
    </Document>
  );
}
