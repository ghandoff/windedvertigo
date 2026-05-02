/**
 * Extends the global CloudflareEnv interface (declared by @opennextjs/cloudflare)
 * with bindings specific to the wv-ancestry Cloudflare Worker.
 *
 * R2Bucket and other CF primitives are global types from wrangler's type gen
 * (transitively available through @opennextjs/cloudflare).
 */
declare interface CloudflareEnv {
  /** R2 binding for ancestry media (photos, documents) — bucket: ancestry-media */
  ANCESTRY_MEDIA: R2Bucket;
}
