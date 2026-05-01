"use client";

import { useEffect, useState } from "react";
import type { RoomSnapshot } from "./types";
import { apiPath } from "./paths";

const POLL_INTERVAL_MS = 1500;

type State =
  | { status: "loading"; snapshot: null; error: null }
  | { status: "ready"; snapshot: RoomSnapshot; error: null }
  | { status: "error"; snapshot: RoomSnapshot | null; error: string };

export function useRoom(code: string): State {
  const [state, setState] = useState<State>({
    status: "loading",
    snapshot: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const res = await fetch(apiPath(`/api/rooms/${code}`), {
          cache: "no-store",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          if (!cancelled) {
            setState((prev) => ({
              status: "error",
              snapshot: prev.snapshot,
              error: data?.error ?? "room not reachable.",
            }));
          }
        } else {
          const snapshot = (await res.json()) as RoomSnapshot;
          if (!cancelled) {
            setState({ status: "ready", snapshot, error: null });
          }
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({
            status: "error",
            snapshot: prev.snapshot,
            error: "the network blinked.",
          }));
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(tick, POLL_INTERVAL_MS);
        }
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [code]);

  return state;
}
