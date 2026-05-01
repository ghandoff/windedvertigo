/**
 * Shared types for @windedvertigo/sync-images.
 */

/** Buffer body type accepted by R2 upload primitives. */
export type R2UploadBody = Uint8Array | Buffer;

/**
 * Function the consumer app provides for writing bytes to R2.
 * Signature matches both creaseworks' and vault's `lib/r2.ts`
 * `uploadBuffer` so existing app helpers can be passed in unchanged.
 */
export type UploadBufferFn = (
  key: string,
  body: R2UploadBody,
  contentType: string,
) => Promise<void>;

/**
 * Function the consumer app provides for resolving a stored R2 key
 * to a public-readable URL. Signature matches creaseworks/vault.
 */
export type GetPublicUrlFn = (key: string) => string;

/**
 * Options for {@link createImageSyncer}.
 */
export interface ImageSyncerOptions {
  /** R2 byte-upload primitive — supplied by the consumer app. */
  uploadBuffer: UploadBufferFn;
  /** R2 public-URL resolver — supplied by the consumer app. */
  getPublicUrl: GetPublicUrlFn;
}

/**
 * Public surface returned by {@link createImageSyncer}.
 *
 * Mirrors the original per-app `sync-image.ts` exports so consumers can
 * keep using the same names after the refactor.
 */
export interface ImageSyncer {
  syncImageToR2: (
    sourceUrl: string,
    notionPageId: string,
    slot: string,
  ) => Promise<string | null>;
  imageUrl: (r2Key: string | null | undefined) => string | null;
  getImageFailureCount: () => number;
  resetImageFailureCount: () => void;
}
