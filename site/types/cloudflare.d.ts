/// <reference types="@cloudflare/workers-types" />

// Augment OpenNext's global CloudflareEnv interface with wv-site bindings.
// This types env.NOTION_CACHE_KV / env.CACHE_REFRESH_SECRET etc. on every
// getCloudflareContext() call in the codebase without needing type casts.
declare global {
  interface CloudflareEnv {
    SESSION_KV: KVNamespace;
    NOTION_CACHE_KV: KVNamespace;
    CACHE_REFRESH_SECRET?: string;
    SITE_URL?: string;
  }
}

export {};
