import { describe, it, expect } from "vitest";
import { evaluate, type ProbeResult, type Target } from "./probes";

function makeProbe(over: Partial<ProbeResult> = {}): ProbeResult {
  return {
    ok: true,
    status: 200,
    elapsed: 100,
    headers: { "content-type": "text/html" },
    bodySample: "<html><head><title>ok</title></head><body>ok</body></html>",
    ...over,
  };
}

describe("evaluate", () => {
  it("status match — single value, exact", () => {
    const target: Target = ["x", "https://e", 200];
    const ev = evaluate(target, makeProbe());
    expect(ev.red).toBe(false);
  });

  it("status match — single value, mismatch", () => {
    const target: Target = ["x", "https://e", 200];
    const ev = evaluate(target, makeProbe({ status: 404 }));
    expect(ev.red).toBe(true);
    expect(ev.reasons.join(" ")).toContain("expected 200, got 404");
  });

  it("status match — array, member", () => {
    const target: Target = ["x", "https://e", [200, 308]];
    const ev = evaluate(target, makeProbe({ status: 308, headers: {} }));
    expect(ev.red).toBe(false);
  });

  it("status match — array, non-member", () => {
    const target: Target = ["x", "https://e", [200, 308]];
    const ev = evaluate(target, makeProbe({ status: 500 }));
    expect(ev.red).toBe(true);
    expect(ev.reasons.join(" ")).toContain("expected 200|308, got 500");
  });

  it("x-vercel-error header detected", () => {
    const target: Target = ["x", "https://e", 200];
    const ev = evaluate(
      target,
      makeProbe({
        headers: {
          "content-type": "text/html",
          "x-vercel-error": "DEPLOYMENT_NOT_FOUND",
        },
      }),
    );
    expect(ev.red).toBe(true);
    expect(ev.reasons.join(" ")).toContain("x-vercel-error");
  });

  it("body error markers — could not route", () => {
    const target: Target = ["x", "https://e", 200];
    const ev = evaluate(
      target,
      makeProbe({
        bodySample: "could not route to the requested URL",
      }),
    );
    expect(ev.red).toBe(true);
    expect(ev.reasons.join(" ")).toContain("error marker");
  });

  it("body error markers — Worker threw exception", () => {
    const target: Target = ["x", "https://e", 200];
    const ev = evaluate(
      target,
      makeProbe({ bodySample: "Worker threw exception at line 42" }),
    );
    expect(ev.red).toBe(true);
  });

  it("body error markers — Error 5xx title", () => {
    const target: Target = ["x", "https://e", 200];
    const ev = evaluate(
      target,
      makeProbe({ bodySample: "<title>Error 502 Bad Gateway</title>" }),
    );
    expect(ev.red).toBe(true);
  });

  it("missing <title> in 2xx HTML — red", () => {
    const target: Target = ["x", "https://e", 200];
    const ev = evaluate(
      target,
      makeProbe({
        bodySample: "<html><body>no title here</body></html>",
      }),
    );
    expect(ev.red).toBe(true);
    expect(ev.reasons.join(" ")).toContain("missing <title>");
  });

  it("missing <title> ignored for non-HTML", () => {
    const target: Target = ["x", "https://e", 200];
    const ev = evaluate(
      target,
      makeProbe({
        headers: { "content-type": "application/json" },
        bodySample: '{"ok":true}',
      }),
    );
    expect(ev.red).toBe(false);
  });

  it("slow flag without status mismatch — slow but not red", () => {
    const target: Target = ["x", "https://e", 200];
    const ev = evaluate(target, makeProbe({ elapsed: 2500 }));
    expect(ev.red).toBe(false);
    expect(ev.slow).toBe(true);
  });

  it("slow + status mismatch — both red and slow", () => {
    const target: Target = ["x", "https://e", 200];
    const ev = evaluate(target, makeProbe({ status: 500, elapsed: 2500 }));
    expect(ev.red).toBe(true);
    expect(ev.slow).toBe(true);
  });

  it("network error — red with reason", () => {
    const target: Target = ["x", "https://e", 200];
    const ev = evaluate(target, {
      ok: false,
      status: 0,
      elapsed: 10,
      reason: "fetch error: ETIMEDOUT",
      headers: {},
      bodySample: "",
    });
    expect(ev.red).toBe(true);
    expect(ev.reasons.join(" ")).toContain("fetch error");
  });

  it("3xx redirect with no body — not red when expected", () => {
    const target: Target = ["x", "https://e", 308];
    const ev = evaluate(
      target,
      makeProbe({ status: 308, headers: {}, bodySample: "" }),
    );
    expect(ev.red).toBe(false);
  });
});
