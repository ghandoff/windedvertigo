/**
 * Notion-image → R2 sync — vertigo-vault binding.
 *
 * The download / size-guard / failure-counter logic lives in the shared
 * `@windedvertigo/sync-images` package (extracted in Cleanup A of the
 * stack-migration plan). This file just wires the package to vault's
 * local R2 primitives and re-exports the same surface the rest of the
 * app already imports from `./sync-image`.
 *
 * Behaviour: identical to the previous inline implementation.
 */

import { createImageSyncer } from "@windedvertigo/sync-images";
import { uploadBuffer, getPublicUrl } from "@/lib/r2";

const syncer = createImageSyncer({ uploadBuffer, getPublicUrl });

export const {
  syncImageToR2,
  imageUrl,
  getImageFailureCount,
  resetImageFailureCount,
} = syncer;
