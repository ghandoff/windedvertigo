/**
 * Cloudflare R2 client for evidence photo storage.
 *
 * Uses the S3-compatible API with presigned URLs so the browser
 * uploads directly to R2 without proxying through our server.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID       — Cloudflare account ID
 *   R2_ACCESS_KEY_ID    — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   R2_BUCKET_NAME      — bucket name (default: creaseworks-evidence)
 *   R2_PUBLIC_URL       — public bucket URL for reading (optional)
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.R2_BUCKET_NAME ?? "creaseworks-evidence";

let _client: S3Client | null = null;

function getR2Client(): S3Client {
  if (_client) return _client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
  }

  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return _client;
}

/** Accepted MIME types for evidence photos. */
export const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
]);

/** Max file size: 5MB (phone photos). */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Storage key convention: {orgId}/{runId}/{evidenceId}.{ext}
 */
export function buildStorageKey(
  orgId: string,
  runId: string,
  evidenceId: string,
  ext: string,
): string {
  return `${orgId}/${runId}/${evidenceId}.${ext}`;
}

/**
 * Thumbnail key — same structure with a -thumb suffix.
 */
export function buildThumbnailKey(storageKey: string): string {
  const dot = storageKey.lastIndexOf(".");
  if (dot === -1) return `${storageKey}-thumb`;
  return `${storageKey.slice(0, dot)}-thumb${storageKey.slice(dot)}`;
}

/**
 * Generate a presigned PUT URL for direct browser upload.
 * Expires in 10 minutes.
 */
export async function generateUploadUrl(
  key: string,
  contentType: string,
): Promise<string> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn: 600 });
}

/**
 * Delete an object from R2.
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getR2Client();
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  await client.send(command);
}

/**
 * Public read URL for a stored object.
 * If R2_PUBLIC_URL is set, uses that; otherwise falls back to the
 * presigned URL pattern (not ideal for production).
 */
export function getPublicUrl(key: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) {
    return `${publicUrl.replace(/\/$/, "")}/${key}`;
  }
  // Fallback: callers should use a presigned GET URL instead
  return key;
}
