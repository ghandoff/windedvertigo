import type { Metadata } from "next";
import { ThreadPullClient } from "./thread-pull-client";

export const metadata: Metadata = {
  title: "thread pull — winded.vertigo",
  description:
    "find the threads that matter most. an interactive tool that maps how worries connect, based on network analysis research.",
  robots: { index: false, follow: false },
};

export default function ThreadPullPage() {
  return <ThreadPullClient />;
}
