"use client";

import nextDynamic from "next/dynamic";

// Base UI's Menu (used by DropdownMenu) calls useSyncExternalStore's fast-path
// that does not work during Cloudflare Workers SSR. This wrapper ensures the
// component only ever renders on the client, eliminating the crash.
export const ProposalReviewActionsClient = nextDynamic(
  () =>
    import("@/app/components/proposal-review-actions").then(
      (m) => m.ProposalReviewActions,
    ),
  { ssr: false },
);
