/**
 * Tests for the poll tally computation and timezone display helpers.
 *
 * computeTallies is a pure function (no DB calls) so these are fast unit tests.
 */

import { describe, it, expect } from "vitest";
import { computeTallies } from "../booking/queries";
import type { PollOption, PollResponse, PollResponseChoice } from "../booking/types";

function makeOption(id: string, startsAt = "2026-09-01T14:00:00Z", endsAt = "2026-09-01T15:00:00Z"): PollOption {
  return { id, poll_id: "poll-1", starts_at: startsAt, ends_at: endsAt, sort_order: 0 };
}

function makeResponse(id: string, name: string): PollResponse {
  return { id, poll_id: "poll-1", respondent_name: name, created_at: "2026-06-30T12:00:00Z" };
}

function makeChoice(responseId: string, optionId: string, availability: "yes" | "if_need_be" | "no"): PollResponseChoice {
  return { id: `${responseId}-${optionId}`, response_id: responseId, option_id: optionId, availability };
}

// ── basic tallying ─────────────────────────────────────────────────────────

describe("computeTallies", () => {
  it("returns an empty array for no options", () => {
    expect(computeTallies([], [], [])).toEqual([]);
  });

  it("counts zeros when there are no responses", () => {
    const opts = [makeOption("opt-1"), makeOption("opt-2")];
    const tallies = computeTallies(opts, [], []);
    expect(tallies).toHaveLength(2);
    for (const t of tallies) {
      expect(t.yes).toBe(0);
      expect(t.if_need_be).toBe(0);
      expect(t.no).toBe(0);
      expect(t.respondents).toHaveLength(0);
      expect(t.isBest).toBe(false);
    }
  });

  it("correctly counts yes / if_need_be / no per slot", () => {
    const opts = [makeOption("opt-a"), makeOption("opt-b")];
    const responses = [makeResponse("r1", "alice"), makeResponse("r2", "bob"), makeResponse("r3", "charlie")];
    const choices = [
      makeChoice("r1", "opt-a", "yes"),
      makeChoice("r2", "opt-a", "if_need_be"),
      makeChoice("r3", "opt-a", "no"),
      makeChoice("r1", "opt-b", "no"),
      makeChoice("r2", "opt-b", "no"),
      makeChoice("r3", "opt-b", "no"),
    ];

    const tallies = computeTallies(opts, responses, choices);
    const a = tallies.find((t) => t.option.id === "opt-a")!;
    const b = tallies.find((t) => t.option.id === "opt-b")!;

    expect(a.yes).toBe(1);
    expect(a.if_need_be).toBe(1);
    expect(a.no).toBe(1);

    expect(b.yes).toBe(0);
    expect(b.if_need_be).toBe(0);
    expect(b.no).toBe(3);
  });

  it("populates respondent names with correct availability", () => {
    const opts = [makeOption("opt-a")];
    const responses = [makeResponse("r1", "alice"), makeResponse("r2", "bob")];
    const choices = [makeChoice("r1", "opt-a", "yes"), makeChoice("r2", "opt-a", "if_need_be")];

    const [tally] = computeTallies(opts, responses, choices);
    expect(tally.respondents).toContainEqual({ name: "alice", availability: "yes" });
    expect(tally.respondents).toContainEqual({ name: "bob", availability: "if_need_be" });
  });

  // ── best-slot selection ────────────────────────────────────────────────

  it("marks the slot with most 'yes' votes as best", () => {
    const opts = [makeOption("opt-low"), makeOption("opt-high")];
    const responses = [makeResponse("r1", "alice"), makeResponse("r2", "bob")];
    const choices = [
      makeChoice("r1", "opt-low", "yes"),
      makeChoice("r2", "opt-low", "no"),
      makeChoice("r1", "opt-high", "yes"),
      makeChoice("r2", "opt-high", "yes"),
    ];

    const tallies = computeTallies(opts, responses, choices);
    const low = tallies.find((t) => t.option.id === "opt-low")!;
    const high = tallies.find((t) => t.option.id === "opt-high")!;

    expect(high.isBest).toBe(true);
    expect(low.isBest).toBe(false);
  });

  it("uses if_need_be as tiebreaker when yes counts are equal", () => {
    const opts = [makeOption("opt-a"), makeOption("opt-b")];
    const responses = [makeResponse("r1", "alice"), makeResponse("r2", "bob"), makeResponse("r3", "charlie")];
    const choices = [
      makeChoice("r1", "opt-a", "yes"),
      makeChoice("r2", "opt-a", "no"),
      makeChoice("r3", "opt-a", "no"),
      makeChoice("r1", "opt-b", "yes"),
      makeChoice("r2", "opt-b", "if_need_be"),
      makeChoice("r3", "opt-b", "no"),
    ];

    const tallies = computeTallies(opts, responses, choices);
    const a = tallies.find((t) => t.option.id === "opt-a")!;
    const b = tallies.find((t) => t.option.id === "opt-b")!;

    // both have 1 yes, but opt-b has 1 if_need_be vs opt-a's 0
    expect(b.isBest).toBe(true);
    expect(a.isBest).toBe(false);
  });

  it("does not mark any slot as best when all responses are 'no'", () => {
    const opts = [makeOption("opt-a")];
    const responses = [makeResponse("r1", "alice")];
    const choices = [makeChoice("r1", "opt-a", "no")];

    const [tally] = computeTallies(opts, responses, choices);
    expect(tally.isBest).toBe(false);
  });

  it("only one slot is marked best even when multiple slots tie on yes", () => {
    const opts = [makeOption("opt-a"), makeOption("opt-b")];
    const responses = [makeResponse("r1", "alice")];
    const choices = [makeChoice("r1", "opt-a", "yes"), makeChoice("r1", "opt-b", "yes")];

    const tallies = computeTallies(opts, responses, choices);
    const bestCount = tallies.filter((t) => t.isBest).length;
    expect(bestCount).toBe(1);
  });

  it("ignores choices for options not in the options list", () => {
    const opts = [makeOption("opt-real")];
    const responses = [makeResponse("r1", "alice")];
    const choices = [
      makeChoice("r1", "opt-real", "yes"),
      makeChoice("r1", "opt-ghost", "yes"), // unknown option — should be ignored
    ];

    const tallies = computeTallies(opts, responses, choices);
    expect(tallies).toHaveLength(1);
    expect(tallies[0].yes).toBe(1);
  });
});

// ── timezone display (pure helpers, no browser APIs) ───────────────────────

describe("timezone formatting", () => {
  it("UTC timestamp parses to the correct date", () => {
    const dt = new Date("2026-09-01T14:00:00Z");
    expect(dt.getUTCHours()).toBe(14);
    expect(dt.getUTCDate()).toBe(1);
    expect(dt.getUTCMonth()).toBe(8); // 0-indexed
  });

  it("LA-timezone offset is applied correctly for PDT (UTC-7)", () => {
    // 14:00 UTC = 07:00 PDT on 1 Sep 2026
    const dt = new Date("2026-09-01T14:00:00Z");
    const laStr = dt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Los_Angeles",
    });
    expect(laStr).toBe("7:00 AM");
  });
});
