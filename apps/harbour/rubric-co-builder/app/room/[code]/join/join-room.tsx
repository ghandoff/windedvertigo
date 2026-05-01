"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/app/_components/wordmark";
import { apiPath } from "@/lib/paths";

const STORAGE_KEY = "rcb:participant";

type Stored = { code: string; participant_id: string };

export function JoinRoom({ code }: { code: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"joining" | "error">("joining");
  const [error, setError] = useState("");

  useEffect(() => {
    async function join() {
      const cachedRaw =
        typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : null;
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as Stored;
          if (cached.code === code) {
            router.replace(`/room/${code}`);
            return;
          }
        } catch {
          // ignore bad cache
        }
      }

      try {
        const res = await fetch(apiPath(`/api/rooms/${code}/join`), {
          method: "POST",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setStatus("error");
          setError(data?.error ?? "no room at that code.");
          return;
        }
        const { participant_id } = (await res.json()) as { participant_id: string };
        window.sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ code, participant_id }),
        );
        router.replace(`/room/${code}`);
      } catch {
        setStatus("error");
        setError("the network blinked. try again?");
      }
    }
    join();
  }, [code, router]);

  if (status === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <Wordmark />
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold mb-3">can&apos;t get you in.</h1>
          <p className="text-[color:var(--color-cadet)]/80">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <Wordmark />
      <p className="text-[color:var(--color-cadet)]/70">joining room {code}…</p>
    </main>
  );
}
