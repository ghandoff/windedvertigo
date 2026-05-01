import type { Metadata } from "next";
import { ProwlClient } from "./prowl-client";

export const metadata: Metadata = {
  title: "play reconnect — winded.vertigo",
  description:
    "90 minutes of play, presence, and each other. play reconnect from winded.vertigo.",
  robots: { index: false, follow: false },
};

export default function ProwlPage() {
  return <ProwlClient />;
}
