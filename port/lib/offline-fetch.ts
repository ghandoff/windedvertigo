/**
 * Drop-in fetch wrapper that queues failed write requests when offline.
 *
 * Usage:
 *   import { offlineFetch } from "@/lib/offline-fetch";
 *   const res = await offlineFetch("/api/activities", { method: "POST", ... });
 *
 * Behavior:
 * - GET/HEAD requests pass through to native fetch (reads are not queued).
 * - For write methods (POST, PUT, PATCH, DELETE):
 *   - If navigator.onLine is false, the request is immediately queued.
 *   - If fetch throws a TypeError (network failure), the request is queued.
 *   - A synthetic 202 Response is returned so callers can detect queuing.
 */

import { enqueue } from "./offline-queue";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function offlineFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method ?? "GET").toUpperCase();

  // Read requests always go straight through
  if (!WRITE_METHODS.has(method)) {
    return fetch(input, init);
  }

  // Extract serializable headers
  const headers: Record<string, string> = {};
  if (init?.headers) {
    const h = new Headers(init.headers);
    h.forEach((value, key) => {
      headers[key] = value;
    });
  }

  const body = typeof init?.body === "string" ? init.body : init?.body != null ? String(init.body) : null;

  // If we already know we're offline, skip the network call
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueue({ url, method, body, headers });
    return queuedResponse();
  }

  // Try the real fetch
  try {
    const res = await fetch(input, init);
    return res;
  } catch (err) {
    // TypeError = network failure (offline, DNS, etc.)
    if (err instanceof TypeError) {
      await enqueue({ url, method, body, headers });
      return queuedResponse();
    }
    throw err;
  }
}

/** Synthetic 202 response indicating the request was queued for later. */
function queuedResponse(): Response {
  return new Response(
    JSON.stringify({ queued: true, message: "request queued for offline sync" }),
    {
      status: 202,
      statusText: "Accepted",
      headers: { "Content-Type": "application/json", "X-Offline-Queued": "true" },
    },
  );
}

/** Check whether a response was a queued offline response. */
export function isQueuedResponse(res: Response): boolean {
  return res.headers.get("X-Offline-Queued") === "true";
}
