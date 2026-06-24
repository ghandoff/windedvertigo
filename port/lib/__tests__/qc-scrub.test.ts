/**
 * BIZ-Q1 QC scrub tests.
 *
 * Tests the pure scrub logic against the acceptance criteria:
 *
 *   - Returns 'fail' on a draft containing an unsourced figure (canonical: "$20M")
 *   - Returns 'fail' on a draft containing an unverified CV claim
 *   - Returns 'fail' on a draft that contradicts the verified ToR
 *     (phase/timeline/page/word limit or missing required section)
 *   - QC 'pass' is only reachable with zero blocking items
 *   - The James → Jamie Galpin alias is applied in CV lookups
 */

import { describe, it, expect } from "vitest";
import {
  scanFigures,
  findUnsourcedFigures,
  findUnverifiedCvClaims,
  checkTorMismatches,
  type DeliverableSpec,
} from "../biz/qc-scrub";

// ── (a) Unsourced figure detection ────────────────────────────────────────────

describe("findUnsourcedFigures", () => {
  it("flags a bare currency amount with no source — canonical $20M case", () => {
    const text = "winded.vertigo has managed portfolios of up to $20M in international programmes.";
    const hits = findUnsourcedFigures(text);
    expect(hits).toContain("$20M");
  });

  it("does NOT flag a large plain number (≥1000) — these go to warnings, not blocking", () => {
    const hits = findUnsourcedFigures("The programme reached 5,000 teachers across three provinces.");
    expect(hits).toHaveLength(0);
  });

  it("does NOT flag a figure immediately followed by a citation bracket", () => {
    const hits = findUnsourcedFigures("The programme reached $20M [1] in disbursements.");
    expect(hits).toHaveLength(0);
  });

  it("does NOT flag a figure followed by 'per ToR'", () => {
    const hits = findUnsourcedFigures("Budget ceiling: $500,000 per ToR section 4.2.");
    expect(hits).toHaveLength(0);
  });

  it("does NOT flag a figure followed by 'per RFP'", () => {
    const hits = findUnsourcedFigures("The expected contract value is $250,000 per RFP clause 3.");
    expect(hits).toHaveLength(0);
  });

  it("does NOT flag a year (4-digit number without currency)", () => {
    const hits = findUnsourcedFigures("Our work started in 2019 and expanded through 2023.");
    expect(hits).toHaveLength(0);
  });

  it("does NOT flag a small count (< 1000, no currency)", () => {
    const hits = findUnsourcedFigures("The cohort included 45 facilitators across 6 regions.");
    expect(hits).toHaveLength(0);
  });

  it("flags a figure with a euro sign", () => {
    const hits = findUnsourcedFigures("Total budget envelope: €1.2 million.");
    expect(hits.length).toBeGreaterThan(0);
  });

  it("returns empty array for a clean draft with no figures", () => {
    const hits = findUnsourcedFigures("winded.vertigo designs learning experiences for practitioners.");
    expect(hits).toHaveLength(0);
  });
});

// ── (b) Unverified CV claim detection ─────────────────────────────────────────

describe("findUnverifiedCvClaims", () => {
  const verifiedMap = new Map<string, "verified" | "needs-review" | "draft">([
    ["Garrett Jaeger", "verified"],
    ["Lamis Sabra", "verified"],
    ["Jamie Galpin", "verified"],
    ["Maria Altamirano Gonzalez", "verified"],
    ["Payton Jaeger", "verified"],
  ]);

  const needsReviewMap = new Map<string, "verified" | "needs-review" | "draft">([
    ["Garrett Jaeger", "verified"],
    ["Lamis Sabra", "verified"],
    ["Jamie Galpin", "needs-review"],
    ["Maria Altamirano Gonzalez", "verified"],
    ["Payton Jaeger", "verified"],
  ]);

  const draftMap = new Map<string, "verified" | "needs-review" | "draft">([
    ["Garrett Jaeger", "verified"],
    ["Lamis Sabra", "draft"],
    ["Jamie Galpin", "verified"],
    ["Maria Altamirano Gonzalez", "verified"],
    ["Payton Jaeger", "verified"],
  ]);

  it("passes when all named team members have verified CVs", () => {
    const text = "Team lead: Garrett Jaeger. Curriculum: Jamie Galpin. Operations: Maria Altamirano Gonzalez.";
    const flags = findUnverifiedCvClaims(text, verifiedMap);
    expect(flags).toHaveLength(0);
  });

  it("flags a team member with needs-review CV", () => {
    const text = "Jamie Galpin will lead the curriculum development workstream.";
    const flags = findUnverifiedCvClaims(text, needsReviewMap);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0].canonicalName).toBe("Jamie Galpin");
    expect(flags[0].confidence).toBe("needs-review");
  });

  it("flags a team member with draft CV", () => {
    const text = "Lamis Sabra will coordinate stakeholder engagement.";
    const flags = findUnverifiedCvClaims(text, draftMap);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0].confidence).toBe("draft");
  });

  it("applies James → Jamie Galpin alias and checks Jamie's CV", () => {
    const text = "James will lead curriculum design.";
    const flags = findUnverifiedCvClaims(text, needsReviewMap);
    // "James" matches alias → looks up "Jamie Galpin" which is needs-review
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0].name).toBe("James");
    expect(flags[0].canonicalName).toBe("Jamie Galpin");
    expect(flags[0].confidence).toBe("needs-review");
  });

  it("applies James Galpin → Jamie Galpin alias", () => {
    const text = "James Galpin has 8 years of curriculum development experience.";
    const flags = findUnverifiedCvClaims(text, needsReviewMap);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0].canonicalName).toBe("Jamie Galpin");
  });

  it("does not double-flag when both alias and canonical name appear", () => {
    const text = "James (Jamie Galpin) will lead the curriculum workstream.";
    const flags = findUnverifiedCvClaims(text, needsReviewMap);
    // Should produce at most one flag per canonical member
    const jamieFlags = flags.filter((f) => f.canonicalName === "Jamie Galpin");
    expect(jamieFlags.length).toBeLessThanOrEqual(1);
  });

  it("returns not-found confidence for a name not in the CV map", () => {
    const emptyMap = new Map<string, "verified" | "needs-review" | "draft">();
    const text = "Garrett Jaeger will serve as engagement lead.";
    const flags = findUnverifiedCvClaims(text, emptyMap);
    expect(flags[0].confidence).toBe("not-found");
  });
});

// ── (c) ToR mismatch detection ────────────────────────────────────────────────

describe("checkTorMismatches", () => {
  const SHORT_DRAFT = "This is a short draft. " + "word ".repeat(100); // ~100 words

  const LONG_DRAFT = "word ".repeat(3000); // ~3000 words

  it("passes a draft within all ToR limits", () => {
    const deliverables: DeliverableSpec[] = [
      { label: "Technical Proposal", pageLimit: 20, wordLimit: 5000, requiredSections: [] },
    ];
    const mismatches = checkTorMismatches(SHORT_DRAFT, deliverables);
    expect(mismatches).toHaveLength(0);
  });

  it("flags a draft that exceeds the word limit (5% tolerance)", () => {
    const deliverables: DeliverableSpec[] = [
      { label: "Technical Proposal", pageLimit: null, wordLimit: 500, requiredSections: [] },
    ];
    const mismatches = checkTorMismatches(LONG_DRAFT, deliverables);
    expect(mismatches.some((m) => m.field === "word_limit")).toBe(true);
  });

  it("flags a draft that exceeds the page limit", () => {
    const deliverables: DeliverableSpec[] = [
      { label: "Expression of Interest", pageLimit: 2, wordLimit: null, requiredSections: [] },
    ];
    // 3000 words / 300 words-per-page = 10 pages >> 2 page limit
    const mismatches = checkTorMismatches(LONG_DRAFT, deliverables);
    expect(mismatches.some((m) => m.field === "page_limit")).toBe(true);
  });

  it("flags a draft missing a required section", () => {
    const deliverables: DeliverableSpec[] = [
      {
        label: "Technical Proposal",
        pageLimit: null,
        wordLimit: null,
        requiredSections: ["Track record", "Proposed methodology"],
      },
    ];
    const draftWithOneSection = "Track record: We have done X. Our team has experience in Y.";
    const mismatches = checkTorMismatches(draftWithOneSection, deliverables);
    expect(mismatches.some((m) => m.field === "required_section" && m.detail.includes("Proposed methodology"))).toBe(true);
    // "Track record" IS present, so should not be flagged
    expect(mismatches.some((m) => m.field === "required_section" && m.detail.includes("Track record"))).toBe(false);
  });

  it("does not flag a required section found in the draft (case-insensitive)", () => {
    const deliverables: DeliverableSpec[] = [
      {
        label: "Technical Proposal",
        pageLimit: null,
        wordLimit: null,
        requiredSections: ["Track Record"],
      },
    ];
    const draft = "track record: we have managed programmes in 12 countries.";
    const mismatches = checkTorMismatches(draft, deliverables);
    expect(mismatches).toHaveLength(0);
  });

  it("flags a draft contradicting multiple ToR limits", () => {
    const deliverables: DeliverableSpec[] = [
      {
        label: "Full Proposal",
        pageLimit: 5,
        wordLimit: 1000,
        requiredSections: ["Risk mitigation"],
      },
    ];
    const mismatches = checkTorMismatches(LONG_DRAFT, deliverables);
    // word_limit + page_limit + required_section all violated
    expect(mismatches.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Integrated QC outcome ─────────────────────────────────────────────────────

describe("QC pass/fail integration", () => {
  it("pass: clean draft, verified CVs, no figures, no limits", () => {
    const text =
      "Garrett Jaeger will lead engagement design. Maria Altamirano Gonzalez ensures cultural fit.";
    const cvMap = new Map<string, "verified" | "needs-review" | "draft">([
      ["Garrett Jaeger", "verified"],
      ["Maria Altamirano Gonzalez", "verified"],
    ]);
    const deliverables: DeliverableSpec[] = [];

    const figures = findUnsourcedFigures(text);
    const cvClaims = findUnverifiedCvClaims(text, cvMap);
    const torMismatches = checkTorMismatches(text, deliverables);

    const blockingItems = [...figures, ...cvClaims, ...torMismatches];
    expect(blockingItems).toHaveLength(0);
  });

  it("fail: $20M figure with no source is the only blocker", () => {
    const text =
      "winded.vertigo has managed portfolios of up to $20M. Garrett Jaeger leads the team.";
    const cvMap = new Map<string, "verified" | "needs-review" | "draft">([
      ["Garrett Jaeger", "verified"],
    ]);
    const deliverables: DeliverableSpec[] = [];

    const figures = findUnsourcedFigures(text);
    const cvClaims = findUnverifiedCvClaims(text, cvMap);
    const torMismatches = checkTorMismatches(text, deliverables);

    expect(figures.length).toBeGreaterThan(0);
    expect(cvClaims).toHaveLength(0);
    expect(torMismatches).toHaveLength(0);
  });
});

// ── (a2) scanFigures — blocking vs. warning split ─────────────────────────────

describe("scanFigures", () => {
  it("puts $20M with no source in blocking", () => {
    const { blocking, warnings } = scanFigures(
      "winded.vertigo has managed portfolios of up to $20M in international programmes.",
    );
    expect(blocking).toContain("$20M");
    expect(warnings).toHaveLength(0);
  });

  it("puts '40,000 educators' (plain large integer) in warnings, not blocking", () => {
    const { blocking, warnings } = scanFigures(
      "Our platform has reached 40,000 educators across the region.",
    );
    expect(blocking).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("puts '45,000+ professionals' in warnings, not blocking", () => {
    const { blocking, warnings } = scanFigures(
      "winded.vertigo's network includes 45,000 professionals in the field.",
    );
    expect(blocking).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("clears $20M when followed by a standard citation bracket [1]", () => {
    const { blocking, warnings } = scanFigures("The programme reached $20M [1] in disbursements.");
    expect(blocking).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("clears $20M when followed by a markdown footnote [^1]", () => {
    const { blocking, warnings } = scanFigures("The programme reached $20M [^1] in disbursements.");
    expect(blocking).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("clears a large plain integer when followed by [^1]", () => {
    const { blocking, warnings } = scanFigures(
      "The programme trained 12,000 teachers [^2] across three provinces.",
    );
    expect(blocking).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("returns both empty for a clean draft with no figures", () => {
    const { blocking, warnings } = scanFigures(
      "winded.vertigo designs learning experiences for practitioners.",
    );
    expect(blocking).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});
