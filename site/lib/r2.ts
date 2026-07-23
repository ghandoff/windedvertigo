/**
 * Cloudflare R2 client — site image sync.
 *
 * Minimal subset for syncing Notion images to R2 during ISR.
 * Shares the same bucket as vertigo-vault and creaseworks.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID        — Cloudflare account ID
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   R2_BUCKET_NAME       — bucket name (default: creaseworks-evidence)
 *   R2_PUBLIC_URL        — public bucket URL for reading
 *
 * Uses aws4fetch, not @aws-sdk/client-s3. The full SDK resolves several
 * runtime settings (user-agent app id, retry mode, checksum config, dualstack/
 * FIPS endpoint flags, ...) via loadConfig(), which falls back to reading
 * ~/.aws/config through fs.readFile whenever no explicit value or env var is
 * set — even with credentials passed explicitly. fs.readFile is unimplemented
 * in the Workers nodejs_compat polyfill, so every S3Client request threw
 * (confirmed live via wrangler tail: every syncImageToR2 call failed with
 * "[unenv] fs.readFile is not implemented yet!", 100% of the time — passing
 * `credentials` directly instead of `credentialDefaultProvider` fixed the
 * credential-resolution path specifically but not the other loadConfig()
 * calls). aws4fetch is a ~10KB SigV4 signer built on fetch + Web Crypto with
 * no Node dependencies, so none of this applies.
 */

import { AwsClient } from "aws4fetch";

const BUCKET = process.env.R2_BUCKET_NAME ?? "creaseworks-evidence";

let _client: AwsClient | null = null;
let _endpoint: string | null = null;

function getR2Client(): { client: AwsClient; endpoint: string } {
  if (_client && _endpoint) return { client: _client, endpoint: _endpoint };

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY",
    );
  }

  _client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  _endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  return { client: _client, endpoint: _endpoint };
}

function objectUrl(key: string): string {
  const { endpoint } = getR2Client();
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${endpoint}/${BUCKET}/${encodedKey}`;
}

/** Upload a buffer to R2. */
export async function uploadBuffer(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<void> {
  const { client } = getR2Client();
  const res = await client.fetch(objectUrl(key), {
    method: "PUT",
    // TS's DOM lib types Uint8Array as generic over ArrayBufferLike, which
    // isn't structurally assignable to BodyInit — but it's a valid fetch body.
    body: body as BodyInit,
    headers: { "content-type": contentType },
  });

  if (!res.ok) {
    throw new Error(`R2 upload failed for ${key}: HTTP ${res.status}`);
  }
}

/**
 * Check whether an object already exists in R2 without fetching its body.
 * Uses a HEAD request — fast (metadata only, no download).
 */
export async function objectExists(key: string): Promise<boolean> {
  try {
    const { client } = getR2Client();
    const res = await client.fetch(objectUrl(key), { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Public read URL for a stored object. */
export function getPublicUrl(key: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) {
    return `${publicUrl.replace(/\/$/, "")}/${key}`;
  }
  // no proxy fallback for the static site — R2_PUBLIC_URL is required.
  // This hardcoded base is only a last resort; it points at the current
  // garrett-account creaseworks-evidence bucket (the old anotheroption
  // base pub-c685a810… was decommissioned on 2026-04-25).
  return `https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev/${key}`;
}
