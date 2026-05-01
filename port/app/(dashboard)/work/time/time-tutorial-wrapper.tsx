"use client";

/**
 * Client-side wrapper that mounts the time-tracking tutorial modal
 * and provides the "guide" button for the server-rendered PageHeader.
 *
 * Rendered in the page's `children` slot alongside the invoice link.
 * Accepts the user's visibility tier so the tutorial can adapt its
 * content — admins see Gusto sync + invoicing steps; members see a
 * focused 3-step version.
 */

import { TimeTutorial, TutorialButton, useTimeTutorial } from "./time-tutorial";
import type { VisibilityTier } from "@/lib/role";

export function TimeTutorialWrapper({ tier }: { tier: VisibilityTier }) {
  const { open, setOpen, dismiss, reopen } = useTimeTutorial();

  return (
    <>
      <TutorialButton onClick={reopen} />
      <TimeTutorial open={open} onOpenChange={setOpen} onDismiss={dismiss} tier={tier} />
    </>
  );
}
