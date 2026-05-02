/**
 * CF Workers security-header wrapper for OpenNext-emitted Next.js workers.
 *
 * WHY: OpenNext on Cloudflare Workers does not honour Next.js's
 * `next.config.ts` `headers()` directive. The OpenNext-emitted
 * `.open-next/worker.js` runs `runWithCloudflareRequestContext` and delegates
 * to the Next.js server-functions handler, which produces a Response object
 * — but the headers configured in `next.config.ts` never make it onto that
 * Response under the OpenNext-on-CF runtime path. (They DO get applied on
 * Vercel, where `next.config.ts` headers are translated to Vercel
 * platform-level header rules at build time.)
 *
 * SOLUTION: A custom worker entry imports the OpenNext default export,
 * passes through any sibling exports (Durable Objects), and wraps `fetch`
 * with a function that injects security headers on every Response.
 *
 * Usage from `apps/harbour/worker.ts`:
 *
 *   import openNextHandler, {
 *     DOQueueHandler,
 *     DOShardedTagCache,
 *     BucketCachePurge,
 *   } from "./.open-next/worker.js";
 *   import { wrapWithSecurityHeaders, HARBOUR_DEFAULT_CSP } from "@windedvertigo/security";
 *
 *   export { DOQueueHandler, DOShardedTagCache, BucketCachePurge };
 *   export default wrapWithSecurityHeaders(openNextHandler, {
 *     csp: HARBOUR_DEFAULT_CSP,
 *   });
 */

/**
 * Minimal CF Workers types declared inline.
 *
 * We DON'T rely on `@cloudflare/workers-types` ambient globals here because
 * the package is imported by Next.js apps whose tsconfig may not include
 * those types — the import would fail with "Cannot find name
 * 'ExecutionContext'". By declaring the bits we need locally, the package
 * is self-contained and consumable from any tsconfig.
 *
 * The structural types match the CF Workers runtime exactly; `as unknown
 * as ExecutionContext` casts at the runtime boundary are not needed.
 */
export interface MinimalExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export interface MinimalScheduledController {
  cron: string;
  scheduledTime: number;
  noRetry(): void;
}

/**
 * Minimal subset of the Cloudflare ExportedHandler shape we depend on.
 */
export type WorkerHandler<Env = unknown> = {
  fetch: (
    request: Request,
    env: Env,
    ctx: MinimalExecutionContext,
  ) => Response | Promise<Response>;
  // Pass through any other handler hooks OpenNext (or Next.js's own
  // middleware) might add in future versions. `scheduled` is the most
  // likely candidate; we currently don't see one in OpenNext's emit.
  scheduled?: (
    controller: MinimalScheduledController,
    env: Env,
    ctx: MinimalExecutionContext,
  ) => void | Promise<void>;
  // Allow arbitrary additional hooks without breaking the type contract.
  [key: string]: unknown;
};

export type SecurityHeadersOptions = {
  /**
   * Content-Security-Policy value to set if the wrapped response does NOT
   * already set its own CSP. Omit to disable CSP injection (the wrapper
   * still applies the other 5 headers).
   *
   * If the inner Response already has a Content-Security-Policy header
   * (e.g. set by a Next.js Route Handler), it is preserved unchanged —
   * the wrapper does not clobber explicit CSPs.
   */
  csp?: string;
  /**
   * Patterns of URL pathnames that should NOT have headers injected.
   * Useful for static-asset paths or specific routes where header
   * injection would be incorrect (e.g. cdn-cgi internal paths).
   *
   * Matched against `new URL(request.url).pathname`.
   */
  skipPaths?: RegExp[];
};

/**
 * The 5 always-on headers. CSP is added separately because it's
 * configurable and may be skipped.
 *
 * Values mirror what `apps/harbour/next.config.ts` and
 * `apps/creaseworks/vercel.json` already specify, to keep observable
 * behaviour consistent across the Vercel-hosted and CF-Workers-hosted
 * harbour apps.
 */
const ALWAYS_ON_HEADERS: ReadonlyArray<readonly [string, string]> = [
  [
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  ],
  ["X-Frame-Options", "DENY"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  [
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  ],
];

/**
 * Default Content-Security-Policy for the harbour hub. Mirrors
 * `apps/harbour/next.config.ts` exactly, plus adds `frame-ancestors 'none'`
 * (defence-in-depth alongside `X-Frame-Options: DENY`).
 *
 * Exported as a named constant so consumers (depth-chart, the 14
 * threshold-concept apps) can reuse it or compose their own variant.
 */
export const HARBOUR_DEFAULT_CSP: string = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://api.notion.com",
  "frame-src 'self' https://www.youtube.com",
  "frame-ancestors 'none'",
  "worker-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/**
 * Wrap an OpenNext-emitted (or any) Cloudflare Workers handler so that
 * every Response it produces carries the standard security headers.
 *
 * Implementation notes:
 *  - Returns a NEW handler object. Spreads the input to preserve any
 *    sibling fields (e.g. a future `scheduled` handler).
 *  - Replaces `fetch` with a wrapping function. Calls the inner `fetch`,
 *    then constructs a new Response (since OpenNext can return immutable
 *    cached responses whose `headers.set` throws). Headers from the
 *    original response are copied first; security headers are then
 *    overlaid (without clobbering an explicit inner CSP).
 *  - `skipPaths` short-circuits the wrapping: the inner response is
 *    returned untouched. This is intended for static-asset or
 *    image-pipeline paths where header injection is unwanted.
 */
export function wrapWithSecurityHeaders<Env>(
  handler: WorkerHandler<Env>,
  options: SecurityHeadersOptions = {},
): WorkerHandler<Env> {
  const { csp, skipPaths = [] } = options;
  const innerFetch = handler.fetch;

  const wrappedFetch = async (
    request: Request,
    env: Env,
    ctx: MinimalExecutionContext,
  ): Promise<Response> => {
    const innerResponse = await innerFetch(request, env, ctx);

    // skipPaths: bypass injection for matching pathnames.
    if (skipPaths.length > 0) {
      let pathname: string | null = null;
      try {
        pathname = new URL(request.url).pathname;
      } catch {
        // Malformed URL — fall through and apply headers anyway.
      }
      if (pathname !== null && skipPaths.some((re) => re.test(pathname!))) {
        return innerResponse;
      }
    }

    // Clone the response with a fresh Headers object so we can mutate it
    // even when the inner response came from an immutable source (e.g.
    // ISR cache hit, asset binding fallback).
    const newHeaders = new Headers(innerResponse.headers);

    for (const [name, value] of ALWAYS_ON_HEADERS) {
      newHeaders.set(name, value);
    }

    if (csp !== undefined && !newHeaders.has("Content-Security-Policy")) {
      newHeaders.set("Content-Security-Policy", csp);
    }

    return new Response(innerResponse.body, {
      status: innerResponse.status,
      statusText: innerResponse.statusText,
      headers: newHeaders,
    });
  };

  return {
    ...handler,
    fetch: wrappedFetch,
  };
}
