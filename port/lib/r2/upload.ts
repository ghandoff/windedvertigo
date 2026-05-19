/**
 * R2 upload/delete operations for campaign assets.
 *
 * Upload strategy (two-tier):
 *   1. Native CF R2 binding — `PORT_ASSETS.put()` via getCloudflareContext().
 *      Zero Node.js fs/stream usage; works everywhere in CF Workers.
 *      This is the normal production path.
 *   2. S3 SDK fallback — used only in local Next.js dev server where
 *      getCloudflareContext() is not available.
 *
 * Background: @aws-sdk/client-s3 internally calls fs.readFile (credential
 * chain detection) which unenv polyfills as not-implemented, breaking every
 * PutObjectCommand call inside CF Workers. The native binding avoids this
 * entirely. See: github.com/unjs/unenv / cloudflare workers compat flags.
 */

import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "./client";
import "@/lib/cf-env"; // ensure CloudflareEnv is augmented with PORT_ASSETS

/**
 * Upload a file buffer to R2.
 * Returns the public URL of the uploaded asset.
 *
 * Prefers the native CF R2 binding (PORT_ASSETS) over the S3 SDK.
 * Falls back to the S3 SDK when running outside a CF Workers context
 * (i.e. local Next.js dev server).
 */
export async function uploadAsset(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  // ── Native CF R2 binding (production path) ──────────────────────────────
  // getCloudflareContext() throws when called outside a CF Workers context
  // (local dev server), so we catch and fall through to the S3 SDK.
  try {
    const { env } = getCloudflareContext();
    // PORT_ASSETS is the R2 bucket binding declared in wrangler.jsonc.
    // It is always present in the wv-port worker; the cast satisfies TS since
    // CloudflareEnv types PORT_ASSETS with a minimally-typed put() signature.
    const bucket = (env as unknown as { PORT_ASSETS: { put(k: string, b: unknown, o?: unknown): Promise<void> } }).PORT_ASSETS;
    if (bucket?.put) {
      await bucket.put(key, buffer, { httpMetadata: { contentType } });
      const publicUrl = process.env.R2_PUBLIC_URL ?? R2_PUBLIC_URL;
      return `${publicUrl}/${key}`;
    }
  } catch {
    // Not in CF Workers context — fall through to S3 SDK below.
  }

  // ── S3 SDK fallback (local dev only) ───────────────────────────────────
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return `${R2_PUBLIC_URL}/${key}`;
}

/** Delete an asset from R2. */
export async function deleteAsset(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    }),
  );
}

/** Generate a storage key from a filename. */
export function generateAssetKey(filename: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const slug = filename
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");
  const ts = Date.now();
  return `campaigns/${year}/${month}/${ts}-${slug}`;
}
