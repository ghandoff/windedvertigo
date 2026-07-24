import { describe, it, expect } from "vitest";
import { reminderEligible } from "../soundings/logic";

// Fixture: sounding created mon 9am PDT, deadline wed 9am PDT.
// Reminder window = [tue 9am PDT, wed 9am PDT).
const sounding = {
  status: "open",
  createdAt: "2026-07-20T16:00:00Z",
  deadlineAt: "2026-07-22T16:00:00Z",
};
const silent = { respondedAt: null, remindedAt: null };

describe("reminderEligible", () => {
  it("eligible inside the window for a silent, never-reminded reviewer", () => {
    const now = new Date("2026-07-21T20:00:00Z"); // tue 1pm PDT
    expect(reminderEligible(silent, sounding, now)).toBe(true);
  });

  it("not eligible before the window opens", () => {
    const now = new Date("2026-07-21T10:00:00Z"); // tue 3am PDT
    expect(reminderEligible(silent, sounding, now)).toBe(false);
  });

  it("not eligible at/after the deadline (expiry owns it now)", () => {
    expect(reminderEligible(silent, sounding, new Date("2026-07-22T16:00:00Z"))).toBe(false);
    expect(reminderEligible(silent, sounding, new Date("2026-07-22T18:00:00Z"))).toBe(false);
  });

  it("never for a reviewer who already responded", () => {
    const now = new Date("2026-07-21T20:00:00Z");
    expect(
      reminderEligible({ respondedAt: "2026-07-20T18:00:00Z", remindedAt: null }, sounding, now),
    ).toBe(false);
  });

  it("never twice — a reminded reviewer is done being nudged", () => {
    const now = new Date("2026-07-21T20:00:00Z");
    expect(
      reminderEligible({ respondedAt: null, remindedAt: "2026-07-21T17:00:00Z" }, sounding, now),
    ).toBe(false);
  });

  it("never on a non-open sounding", () => {
    const now = new Date("2026-07-21T20:00:00Z");
    expect(reminderEligible(silent, { ...sounding, status: "digested" }, now)).toBe(false);
    expect(reminderEligible(silent, { ...sounding, status: "expired" }, now)).toBe(false);
  });

  it("suppressed when the sounding was created just before the window (kickoff IS the nudge)", () => {
    // created tue 7am PDT — window opens tue 9am, only 2h later (< 4h min age)
    const late = { ...sounding, createdAt: "2026-07-21T14:00:00Z" };
    const now = new Date("2026-07-21T20:00:00Z"); // inside the window
    expect(reminderEligible(silent, late, now)).toBe(false);
  });
});
