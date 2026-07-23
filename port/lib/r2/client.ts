/**
 * Cloudflare R2 client — S3-compatible storage for campaign assets.
 *
 * Uses aws4fetch, not @aws-sdk/client-s3. The full SDK resolves several
 * runtime settings (user-agent app id, retry mode, checksum config, dualstack/
 * FIPS endpoint flags, S3 ARN-region handling, S3 Express session auth, ...)
 * via loadConfig(), which falls back to reading ~/.aws/config through
 * fs.readFile whenever no explicit value or env var is set — even with
 * credentials passed explicitly via `credentials`. fs.readFile is
 * unimplemented in the Workers nodejs_compat polyfill, so any S3Client
 * request throws inside wv-port. This is the same bug found and fixed in
 * site/lib/r2.ts (PRs #382, #384) — aws4fetch is a ~10KB SigV4 signer built
 * on fetch + Web Crypto with no Node dependencies, so none of this applies.
 */

import { AwsClient } from "aws4fetch";

export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? "port-assets";
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? "";

let _client: AwsClient | null = null;
let _endpoint: string | null = null;

function getR2Client(): { client: AwsClient; endpoint: string } {
  if (_client && _endpoint) return { client: _client, endpoint: _endpoint };

  const accountId = process.env.CF_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials not configured — set CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY",
    );
  }

  _client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  _endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  return { client: _client, endpoint: _endpoint };
}

function objectUrl(key: string): string {
  const { endpoint } = getR2Client();
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${endpoint}/${R2_BUCKET}/${encodedKey}`;
}

/** Upload a buffer to R2 (PutObject). */
export async function putObject(
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

/** Fetch an object from R2 (GetObject). Returns the raw signed Response. */
export async function getObject(key: string): Promise<Response> {
  const { client } = getR2Client();
  return client.fetch(objectUrl(key), { method: "GET" });
}

/** Delete an object from R2 (DeleteObject). */
export async function deleteObject(key: string): Promise<void> {
  const { client } = getR2Client();
  const res = await client.fetch(objectUrl(key), { method: "DELETE" });

  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed for ${key}: HTTP ${res.status}`);
  }
}
