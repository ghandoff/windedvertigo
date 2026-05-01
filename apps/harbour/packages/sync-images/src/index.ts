// Re-exports for @windedvertigo/sync-images.
//
// Today this package exposes the Notion-image → R2 sync logic that was
// previously duplicated across creaseworks and vertigo-vault. Consumers
// build a per-app syncer by passing their local R2 primitives:
//
//     import { createImageSyncer } from "@windedvertigo/sync-images";
//     import { uploadBuffer, getPublicUrl } from "@/lib/r2";
//
//     const { syncImageToR2, imageUrl, getImageFailureCount,
//             resetImageFailureCount } = createImageSyncer({
//       uploadBuffer, getPublicUrl,
//     });
//
// As more shared image-sync primitives land (e.g. thumbnail generation,
// batched re-sync, S3-style presigned uploads) they should be re-exported
// here so consumers import everything from the package root.
export { createImageSyncer } from "./r2-client";
export type {
  ImageSyncer,
  ImageSyncerOptions,
  UploadBufferFn,
  GetPublicUrlFn,
  R2UploadBody,
} from "./types";
