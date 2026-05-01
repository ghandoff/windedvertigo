import { describe, it, expect } from "vitest";
import {
  wrapWithSecurityHeaders,
  HARBOUR_DEFAULT_CSP,
  type WorkerHandler,
} from "./cf-headers";

// Minimal ExecutionContext mock — only the methods used in tests.
const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
};

function makeHandler(
  responseFactory: (req: Request) => Response | Promise<Response>,
): WorkerHandler<unknown> {
  return {
    fetch: async (request) => responseFactory(request),
  };
}

describe("wrapWithSecurityHeaders", () => {
  it("adds all 5 always-on headers to a 200 response", async () => {
    const handler = makeHandler(() => new Response("ok", { status: 200 }));
    const wrapped = wrapWithSecurityHeaders(handler);
    const res = await wrapped.fetch(
      new Request("https://example.com/"),
      {},
      ctx,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(res.headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });

  it("preserves headers on a 302 redirect", async () => {
    const handler = makeHandler(
      () =>
        new Response(null, {
          status: 302,
          headers: { Location: "/somewhere" },
        }),
    );
    const wrapped = wrapWithSecurityHeaders(handler);
    const res = await wrapped.fetch(
      new Request("https://example.com/old"),
      {},
      ctx,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/somewhere");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("injects CSP when option is set and inner response has none", async () => {
    const handler = makeHandler(() => new Response("ok"));
    const wrapped = wrapWithSecurityHeaders(handler, {
      csp: HARBOUR_DEFAULT_CSP,
    });
    const res = await wrapped.fetch(
      new Request("https://example.com/"),
      {},
      ctx,
    );
    expect(res.headers.get("Content-Security-Policy")).toBe(
      HARBOUR_DEFAULT_CSP,
    );
  });

  it("does not clobber an inner Content-Security-Policy", async () => {
    const innerCsp = "default-src 'none'";
    const handler = makeHandler(
      () =>
        new Response("ok", {
          headers: { "Content-Security-Policy": innerCsp },
        }),
    );
    const wrapped = wrapWithSecurityHeaders(handler, {
      csp: HARBOUR_DEFAULT_CSP,
    });
    const res = await wrapped.fetch(
      new Request("https://example.com/"),
      {},
      ctx,
    );
    expect(res.headers.get("Content-Security-Policy")).toBe(innerCsp);
  });

  it("does not emit CSP when option is omitted", async () => {
    const handler = makeHandler(() => new Response("ok"));
    const wrapped = wrapWithSecurityHeaders(handler);
    const res = await wrapped.fetch(
      new Request("https://example.com/"),
      {},
      ctx,
    );
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
    // But the 5 always-on headers are still present.
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("skipPaths bypasses header injection", async () => {
    const handler = makeHandler(() => new Response("raw"));
    const wrapped = wrapWithSecurityHeaders(handler, {
      csp: HARBOUR_DEFAULT_CSP,
      skipPaths: [/^\/cdn-cgi\//, /^\/_next\/static\//],
    });
    const skipped = await wrapped.fetch(
      new Request("https://example.com/cdn-cgi/image/foo.png"),
      {},
      ctx,
    );
    expect(skipped.headers.get("X-Frame-Options")).toBeNull();
    expect(skipped.headers.get("Content-Security-Policy")).toBeNull();
    const wrapped2 = await wrapped.fetch(
      new Request("https://example.com/anything-else"),
      {},
      ctx,
    );
    expect(wrapped2.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("preserves response body", async () => {
    const handler = makeHandler(() => new Response("hello world"));
    const wrapped = wrapWithSecurityHeaders(handler);
    const res = await wrapped.fetch(
      new Request("https://example.com/"),
      {},
      ctx,
    );
    expect(await res.text()).toBe("hello world");
  });

  it("passes through sibling exports unchanged via spread", () => {
    const sentinel = Symbol("sentinel");
    const handler = {
      fetch: async () => new Response("ok"),
      customField: sentinel,
    } as WorkerHandler<unknown> & { customField: symbol };
    const wrapped = wrapWithSecurityHeaders(handler) as typeof handler;
    expect(wrapped.customField).toBe(sentinel);
  });
});
