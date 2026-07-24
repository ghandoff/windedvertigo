import { describe, it, expect } from "vitest";
import {
  sweepAction,
  allResponded,
  canTransitionItem,
  shouldAutoClose,
} from "../soundings/logic";
import type { SoundingItemStatus } from "../supabase/sounding-items";

const open = { status: "open", deadlineAt: "2026-07-22T16:00:00Z" };
const before = new Date("2026-07-21T12:00:00Z");
const after = new Date("2026-07-22T17:00:00Z");

const responded = { respondedAt: "2026-07-21T10:00:00Z" };
const silent = { respondedAt: null };

describe("sweepAction", () => {
  it("does nothing before the deadline while responses are outstanding", () => {
    expect(sweepAction(open, [responded, silent], 1, before)).toBe("none");
  });

  it("digests past the deadline when there is at least one note", () => {
    expect(sweepAction(open, [responded, silent], 1, after)).toBe("digest");
  });

  it("expires gracefully past the deadline with zero notes", () => {
    expect(sweepAction(open, [silent, silent], 0, after)).toBe("expire");
  });

  it("digests EARLY when everyone has responded — nobody waits on a dead deadline", () => {
    expect(sweepAction(open, [responded, responded], 2, before)).toBe("digest");
  });

  it("all-passed counts as all-responded (passes are items too)", () => {
    // two reviewers both 🙅'd: responded_at set, and each pass is an item
    expect(sweepAction(open, [responded, responded], 2, before)).toBe("digest");
  });

  it("no early digest with zero reviewers configured", () => {
    expect(sweepAction(open, [], 1, before)).toBe("none");
  });

  it("never acts on a non-open sounding", () => {
    expect(sweepAction({ ...open, status: "digested" }, [responded], 3, after)).toBe("none");
    expect(sweepAction({ ...open, status: "expired" }, [], 0, after)).toBe("none");
  });
});

describe("allResponded", () => {
  it("true only when every reviewer has responded", () => {
    expect(allResponded([responded, responded])).toBe(true);
    expect(allResponded([responded, silent])).toBe(false);
  });
  it("false for an empty reviewer list", () => {
    expect(allResponded([])).toBe(false);
  });
});

describe("canTransitionItem — terminal states are immutable", () => {
  const states: SoundingItemStatus[] = ["new", "integrated", "declined", "expired"];
  it("new can move to any terminal state", () => {
    expect(canTransitionItem("new", "integrated")).toBe(true);
    expect(canTransitionItem("new", "declined")).toBe(true);
    expect(canTransitionItem("new", "expired")).toBe(true);
  });
  it("nothing moves out of a terminal state, and new→new is not a transition", () => {
    for (const from of states) {
      for (const to of states) {
        if (from === "new" && to !== "new") continue;
        expect(canTransitionItem(from, to)).toBe(false);
      }
    }
  });
});

describe("shouldAutoClose", () => {
  const now = new Date("2026-07-30T12:00:00Z");
  it("closes digested soundings past the grace window", () => {
    expect(shouldAutoClose({ status: "digested", digestedAt: "2026-07-20T12:00:00Z" }, now)).toBe(true);
  });
  it("leaves recently-digested soundings alone", () => {
    expect(shouldAutoClose({ status: "digested", digestedAt: "2026-07-28T12:00:00Z" }, now)).toBe(false);
  });
  it("ignores non-digested soundings", () => {
    expect(shouldAutoClose({ status: "open", digestedAt: null }, now)).toBe(false);
    expect(shouldAutoClose({ status: "closed", digestedAt: "2026-07-01T12:00:00Z" }, now)).toBe(false);
  });
});
