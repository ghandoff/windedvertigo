/**
 * R2 upload/delete operations for campaign assets.
 */

import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "./client";

/**
 * Upload a file buffer to R2.
 * Returns the public URL of the uploaded asset.
 */
export async function uploadAsset(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
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
