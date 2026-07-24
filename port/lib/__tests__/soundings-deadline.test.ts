import { describe, it, expect } from "vitest";
import { nextWhirlpoolDeadline } from "../soundings/logic";

// US DST in 2026: PDT (UTC-7) begins Sun Mar 8, ends Sun Nov 1 (back to PST/UTC-8).
// Wed 9am PDT = 16:00 UTC · Wed 9am PST = 17:00 UTC.

describe("nextWhirlpoolDeadline", () => {
  it("monday → this wednesday 9am PDT as an exact UTC instant", () => {
    const now = new Date("2026-07-20T18:00:00Z"); // mon 11am PDT
    expect(nextWhirlpoolDeadline(now).toISOString()).toBe("2026-07-22T16:00:00.000Z");
  });

  it("tuesday 10am PT (23h lead) rolls to the FOLLOWING wednesday", () => {
    const now = new Date("2026-07-21T17:00:00Z"); // tue 10am PDT — wed 9am is 23h away
    expect(nextWhirlpoolDeadline(now).toISOString()).toBe("2026-07-29T16:00:00.000Z");
  });

  it("wednesday morning before 9am still rolls (same-day deadline is no deadline)", () => {
    const now = new Date("2026-07-22T15:00:00Z"); // wed 8am PDT, 1h before whirlpool
    expect(nextWhirlpoolDeadline(now).toISOString()).toBe("2026-07-29T16:00:00.000Z");
  });

  it("wednesday after the whirlpool → next wednesday", () => {
    const now = new Date("2026-07-22T20:00:00Z"); // wed 1pm PDT
    expect(nextWhirlpoolDeadline(now).toISOString()).toBe("2026-07-29T16:00:00.000Z");
  });

  it("minLeadHours=0 allows a same-day deadline", () => {
    const now = new Date("2026-07-22T15:00:00Z"); // wed 8am PDT
    expect(nextWhirlpoolDeadline(now, 0).toISOString()).toBe("2026-07-22T16:00:00.000Z");
  });

  it("crosses the spring PST→PDT boundary correctly", () => {
    // thu mar 5 2026 (PST); next wed is mar 11, after the mar 8 spring-forward.
    const now = new Date("2026-03-05T12:00:00Z");
    expect(nextWhirlpoolDeadline(now).toISOString()).toBe("2026-03-11T16:00:00.000Z"); // 9am PDT
  });

  it("crosses the fall PDT→PST boundary correctly", () => {
    // thu oct 29 2026 (PDT); next wed is nov 4, after the nov 1 fall-back.
    const now = new Date("2026-10-29T12:00:00Z");
    expect(nextWhirlpoolDeadline(now).toISOString()).toBe("2026-11-04T17:00:00.000Z"); // 9am PST
  });

  it("stays within PST when both now and target are PST", () => {
    const now = new Date("2026-01-05T20:00:00Z"); // mon jan 5, noon PST
    expect(nextWhirlpoolDeadline(now).toISOString()).toBe("2026-01-07T17:00:00.000Z"); // wed 9am PST
  });
});
