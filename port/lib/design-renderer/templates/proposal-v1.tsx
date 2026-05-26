/**
 * proposal-v1 — first React-PDF template for the design renderer (W2).
 *
 * Layout: cover (title + client + date) → body sections rendered from markdown.
 * Brand: WV palette (navy + redwood + champagne accents), Helvetica.
 *
 * Markdown handling: lightweight inline parser — recognizes # / ## / ### /
 * lists / bold / italic / paragraphs. Not a full markdown spec; intentional
 * minimum so the renderer is predictable. Heavy formatting belongs in
 * Google Docs, not here.
 */

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";

// ── Brand ─────────────────────────────────────────────────────────────────

const COLORS = {
  navy:       "#273248",
  redwood:    "#b15043",
  sienna:     "#cb7858",
  champagne:  "#ffebd2",
  teal:       "#43b187",
  body:       "#1f2937",
  muted:      "#6b7280",
  rule:       "#e5e7eb",
  cardBg:     "#fafaf7",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 64,
    fontFamily: "Helvetica",
    color: COLORS.body,
    fontSize: 11,
    lineHeight: 1.6,
  },
  cover: {
    paddingTop: 200,
    paddingBottom: 100,
  },
  coverEyebrow: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.sienna,
    textTransform: "lowercase",
    letterSpacing: 2,
    marginBottom: 24,
  },
  coverTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 36,
    color: COLORS.navy,
    lineHeight: 1.15,
    marginBottom: 16,
  },
  coverSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 40,
  },
  coverMetaRow: {
    flexDirection: "row",
    gap: 32,
    marginTop: 60,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.rule,
  },
  coverMetaCol: {
    flex: 1,
  },
  coverMetaLabel: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: "lowercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  coverMetaValue: {
    fontSize: 11,
    color: COLORS.navy,
  },
  // body
  h1: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: COLORS.navy,
    marginTop: 18,
    marginBottom: 10,
  },
  h2: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: COLORS.navy,
    marginTop: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.rule,
    paddingBottom: 4,
  },
  h3: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12.5,
    color: COLORS.redwood,
    marginTop: 12,
    marginBottom: 6,
  },
  p: {
    marginBottom: 8,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 10,
  },
  bulletDot: {
    width: 12,
    color: COLORS.sienna,
  },
  callout: {
    backgroundColor: COLORS.cardBg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.teal,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 12,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 64,
    right: 64,
    fontSize: 8,
    color: COLORS.muted,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.rule,
    paddingTop: 8,
  },
});

// ── Lightweight markdown renderer ─────────────────────────────────────────

interface Block {
  type: "h1" | "h2" | "h3" | "p" | "ul" | "callout";
  text?: string;
  items?: string[];
}

function parseMarkdown(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  let callout: string[] | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: "p", text: para.join(" ") });
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: "ul", items: list });
      list = null;
    }
  };
  const flushCallout = () => {
    if (callout) {
      blocks.push({ type: "callout", text: callout.join(" ") });
      callout = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushPara();
      flushList();
      flushCallout();
      continue;
    }

    if (line.startsWith("> ")) {
      flushPara();
      flushList();
      (callout ??= []).push(line.slice(2).trim());
      continue;
    } else if (callout) {
      flushCallout();
    }

    if (line.startsWith("### ")) {
      flushPara(); flushList();
      blocks.push({ type: "h3", text: line.slice(4) });
    } else if (line.startsWith("## ")) {
      flushPara(); flushList();
      blocks.push({ type: "h2", text: line.slice(3) });
    } else if (line.startsWith("# ")) {
      flushPara(); flushList();
      blocks.push({ type: "h1", text: line.slice(2) });
    } else if (line.match(/^[-*]\s+/)) {
      flushPara();
      (list ??= []).push(line.replace(/^[-*]\s+/, ""));
    } else {
      flushList();
      para.push(line);
    }
  }

  flushPara();
  flushList();
  flushCallout();

  return blocks;
}

// Strip inline markdown (**bold**, *italic*, `code`) — render plain text.
// Full inline-style support deferred; React-PDF needs nested <Text> wrapping
// which complicates the parser. Plain text is fine for v1.
function stripInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}

function renderBlock(block: Block, key: number): React.ReactElement | null {
  switch (block.type) {
    case "h1":
      return <Text key={key} style={s.h1}>{stripInline(block.text ?? "")}</Text>;
    case "h2":
      return <Text key={key} style={s.h2}>{stripInline(block.text ?? "")}</Text>;
    case "h3":
      return <Text key={key} style={s.h3}>{stripInline(block.text ?? "")}</Text>;
    case "p":
      return <Text key={key} style={s.p}>{stripInline(block.text ?? "")}</Text>;
    case "ul":
      return (
        <View key={key}>
          {(block.items ?? []).map((item, i) => (
            <View key={i} style={s.bullet}>
              <Text style={s.bulletDot}>•</Text>
              <Text>{stripInline(item)}</Text>
            </View>
          ))}
        </View>
      );
    case "callout":
      return (
        <View key={key} style={s.callout}>
          <Text>{stripInline(block.text ?? "")}</Text>
        </View>
      );
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export interface ProposalV1Frontmatter {
  title?: string;
  client?: string;
  proposedFor?: string;
  date?: string;
  preparedBy?: string;
  version?: string;
  eyebrow?: string;
}

export interface ProposalV1Props {
  title: string;
  contentMarkdown: string;
  frontmatter?: ProposalV1Frontmatter;
}

export function ProposalV1({ title, contentMarkdown, frontmatter = {} }: ProposalV1Props): React.ReactElement {
  const blocks = parseMarkdown(contentMarkdown);
  const date = frontmatter.date ?? new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <Document title={title} author="winded.vertigo">
      {/* Cover page */}
      <Page size="LETTER" style={s.page}>
        <View style={s.cover}>
          <Text style={s.coverEyebrow}>
            {frontmatter.eyebrow ?? "winded.vertigo · proposal"}
          </Text>
          <Text style={s.coverTitle}>{frontmatter.title ?? title}</Text>
          {frontmatter.client && (
            <Text style={s.coverSubtitle}>prepared for {frontmatter.client}</Text>
          )}
          <View style={s.coverMetaRow}>
            <View style={s.coverMetaCol}>
              <Text style={s.coverMetaLabel}>date</Text>
              <Text style={s.coverMetaValue}>{date}</Text>
            </View>
            {frontmatter.preparedBy && (
              <View style={s.coverMetaCol}>
                <Text style={s.coverMetaLabel}>prepared by</Text>
                <Text style={s.coverMetaValue}>{frontmatter.preparedBy}</Text>
              </View>
            )}
            {frontmatter.version && (
              <View style={s.coverMetaCol}>
                <Text style={s.coverMetaLabel}>version</Text>
                <Text style={s.coverMetaValue}>{frontmatter.version}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={s.footer}>
          <Text>winded.vertigo collective</Text>
          <Text>windedvertigo.com</Text>
        </View>
      </Page>

      {/* Body page(s) — React-PDF auto-paginates */}
      <Page size="LETTER" style={s.page}>
        {blocks.map((b, i) => renderBlock(b, i))}
        <View style={s.footer} fixed>
          <Text>{frontmatter.client ?? "winded.vertigo"}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
