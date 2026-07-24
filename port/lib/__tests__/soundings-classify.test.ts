import { describe, it, expect } from "vitest";
import {
  classifyThreadReply,
  isPassReaction,
  audioExtFromMime,
  slackMessagePermalink,
  deriveAgentQuestions,
  assembleDigestInput,
} from "../soundings/logic";
import type { OnePager } from "../notion/types";
import type { SoundingItemRow } from "../supabase/sounding-items";
import type { SoundingReviewerRow } from "../supabase/sounding-reviewers";

const baseMsg = { ts: "1753731000.000100", user: "U0MARIA" };

function makeItem(overrides: Partial<SoundingItemRow>): SoundingItemRow {
  return {
    id: "i1",
    soundingId: "s1",
    slackUserId: "U0MARIA",
    reviewerEmail: "maria@windedvertigo.com",
    kind: "voice",
    slackMsgTs: "1753731000.000100",
    slackFileId: "F123",
    audioR2Key: null,
    audioR2Url: null,
    audioContentType: null,
    textBody: null,
    transcript: null,
    transcriptStatus: "done",
    transcriptError: null,
    status: "new",
    statusReason: null,
    statusSetBy: null,
    statusSetAt: null,
    receiptSentAt: null,
    createdAt: "2026-07-20T18:00:00Z",
    ...overrides,
  };
}

function makeReviewer(overrides: Partial<SoundingReviewerRow>): SoundingReviewerRow {
  return {
    id: "r1",
    soundingId: "s1",
    email: "maria@windedvertigo.com",
    slackUserId: "U0MARIA",
    respondedAt: null,
    passedAt: null,
    remindedAt: null,
    createdAt: "2026-07-20T16:00:00Z",
    ...overrides,
  };
}

describe("classifyThreadReply", () => {
  it("slack voice note (file_share, audio/mp4) → voice", () => {
    const r = classifyThreadReply({
      ...baseMsg,
      subtype: "file_share",
      files: [{ id: "F123", mimetype: "audio/mp4", url_private_download: "https://files.slack.com/x" }],
    });
    expect(r.kind).toBe("voice");
    if (r.kind === "voice") expect(r.file.id).toBe("F123");
  });

  it("slack_audio file subtype counts as voice even without a mimetype", () => {
    const r = classifyThreadReply({
      ...baseMsg,
      subtype: "file_share",
      files: [{ id: "F456", subtype: "slack_audio", url_private_download: "https://files.slack.com/y" }],
    });
    expect(r.kind).toBe("voice");
  });

  it("audio file without a download url is ignored (not crashed on)", () => {
    const r = classifyThreadReply({
      ...baseMsg,
      subtype: "file_share",
      files: [{ id: "F9", mimetype: "audio/mp4" }],
    });
    expect(r.kind).toBe("ignore");
  });

  it("non-audio file upload is ignored", () => {
    const r = classifyThreadReply({
      ...baseMsg,
      subtype: "file_share",
      files: [{ id: "F7", mimetype: "image/png", url_private_download: "https://files.slack.com/z" }],
    });
    expect(r.kind).toBe("ignore");
  });

  it("bot messages are ignored — including on the cron catch-up path", () => {
    const r = classifyThreadReply({ ...baseMsg, bot_id: "B0CLAW", text: "🌀 sounding digest — …" });
    expect(r.kind).toBe("ignore");
  });

  it("message_changed and other bookkeeping subtypes are ignored", () => {
    expect(classifyThreadReply({ ...baseMsg, subtype: "message_changed", text: "edited text here" }).kind).toBe("ignore");
  });

  it("plain threaded text with substance → text", () => {
    const r = classifyThreadReply({ ...baseMsg, text: "the LOE table understates field time" });
    expect(r).toEqual({ kind: "text", text: "the LOE table understates field time" });
  });

  it("trivially short text is chatter, not feedback", () => {
    expect(classifyThreadReply({ ...baseMsg, text: "+1" }).kind).toBe("ignore");
  });
});

describe("isPassReaction", () => {
  it("recognises 🙅 in its emoji names", () => {
    expect(isPassReaction("no_good")).toBe(true);
    expect(isPassReaction("woman-gesturing-no")).toBe(true);
    expect(isPassReaction("man-gesturing-no")).toBe(true);
  });
  it("everything else is not a pass", () => {
    expect(isPassReaction("thumbsup")).toBe(false);
    expect(isPassReaction("white_check_mark")).toBe(false);
  });
});

describe("small helpers", () => {
  it("audioExtFromMime maps slack's usual types", () => {
    expect(audioExtFromMime("audio/mp4")).toBe("m4a");
    expect(audioExtFromMime("audio/mpeg")).toBe("mp3");
    expect(audioExtFromMime("audio/ogg")).toBe("ogg");
    expect(audioExtFromMime("audio/webm;codecs=opus")).toBe("webm");
  });

  it("slackMessagePermalink strips the ts dot", () => {
    expect(slackMessagePermalink("C0AB12CD3", "1753731000.000100")).toBe(
      "https://slack.com/archives/C0AB12CD3/p1753731000000100",
    );
  });
});

describe("deriveAgentQuestions", () => {
  const onePager: OnePager = {
    summary: "s",
    whyApply: "w",
    deliverables: [],
    capabilitiesRequested: "",
    eligibility: { verdict: "uncertain", note: "requires a locally registered entity." },
    suggestedApproach: "",
    itemsToVerify: ["whether a consortium partner counts as local presence"],
    requiredConditions: ["national consultant based in Kenya"],
    requiredMaterials: [],
    torIsReal: true,
    torConcern: null,
    sourceBasis: "verified-tor",
  };

  it("derives at most two 🤖 questions with agent provenance", () => {
    const qs = deriveAgentQuestions(onePager);
    expect(qs.length).toBe(2);
    for (const q of qs) {
      expect(q.askedByType).toBe("agent");
      expect(q.askedByName).toBe("biz");
    }
    expect(qs[0].text).toContain("locally registered entity");
  });

  it("returns nothing without a one-pager", () => {
    expect(deriveAgentQuestions(null)).toEqual([]);
  });
});

describe("assembleDigestInput", () => {
  it("renders provenance icons, transcripts, fallbacks, passes, and non-responders neutrally", () => {
    const input = assembleDigestInput(
      {
        docTitle: "UNDP MEL one-pager",
        docUrl: "https://port.windedvertigo.com/rfp-radar/abc",
        questions: [
          { text: "can we staff the MEL lead?", askedByType: "human", askedByName: "maria" },
          { text: "eligibility is uncertain — thoughts?", askedByType: "agent", askedByName: "biz" },
        ],
      },
      [
        makeItem({ kind: "voice", transcript: "the LOE feels understated", transcriptStatus: "done" }),
        makeItem({
          id: "i2",
          slackUserId: "U0GARRETT",
          reviewerEmail: "garrett@windedvertigo.com",
          kind: "voice",
          transcriptStatus: "failed",
          audioR2Url: "https://r2.example/soundings/s1/F2.m4a",
          slackMsgTs: "1753731001.000100",
        }),
        makeItem({
          id: "i3",
          slackUserId: "U0LAMIS",
          reviewerEmail: "lamis@windedvertigo.com",
          kind: "pass",
          slackMsgTs: "1753731002.000100",
        }),
      ],
      [
        makeReviewer({ respondedAt: "2026-07-21T10:00:00Z" }),
        makeReviewer({ id: "r2", email: "jamie@windedvertigo.com", slackUserId: "U0JAMIE" }),
      ],
    );

    expect(input).toContain("👤 maria: can we staff the MEL lead?");
    expect(input).toContain("🤖 biz: eligibility is uncertain — thoughts?");
    expect(input).toContain("the LOE feels understated");
    expect(input).toContain("transcription failed — listen: https://r2.example/soundings/s1/F2.m4a");
    expect(input).toContain("lamis@windedvertigo.com: responded — pass on this one");
    expect(input).toContain("jamie@windedvertigo.com: no response (that's fine)");
    // zero gamification: no response counts framed as scores
    expect(input).not.toMatch(/score|streak|leaderboard/i);
  });
});
