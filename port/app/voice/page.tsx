"use client";

/**
 * /voice — in-browser click-to-talk playground for the six voice agents.
 *
 * Uses the Vapi browser Web SDK with the org PUBLIC key (publishable — safe in
 * client code). Each card starts a live web call to that agent's Vapi assistant,
 * which in turn calls our custom-llm endpoint on the port. No phone numbers.
 *
 * Session-gated by middleware (not in the public allowlist), so only a
 * logged-in port user can reach it.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// Publishable key — designed to live in client code. NOT the private API key.
const VAPI_PUBLIC_KEY = "9248eb66-2766-42e5-8022-b749368dc750";

interface VapiClient {
  start: (assistantId: string) => Promise<unknown>;
  stop: () => void;
  on: (event: string, cb: (payload: unknown) => void) => void;
}
type VapiCtor = new (key: string) => VapiClient;

interface VapiMessage {
  type?: string;
  role?: string;
  transcript?: string;
  transcriptType?: string;
}

type Agent = {
  id: string;
  name: string;
  tagline: string;
  voice: string;
  ring: string;
  dot: string;
};

const AGENTS: Agent[] = [
  { id: "ba635645-717d-4415-8bd6-640aa7a62a5c", name: "Pam", tagline: "projects & momentum — what's moving, what's stuck", voice: "Ariana", ring: "hover:border-rose-400/60", dot: "bg-rose-400" },
  { id: "50aee5b0-e4e5-4b4f-8b19-d3ad05adae97", name: "Mo", tagline: "marketing — strategy, campaigns, positioning", voice: "Amélie", ring: "hover:border-amber-400/60", dot: "bg-amber-400" },
  { id: "9e3d60f5-47bd-4ca1-ad18-a0cc407c51f5", name: "Carl", tagline: "research & learning — evidence, citations, findings", voice: "Adrian", ring: "hover:border-sky-400/60", dot: "bg-sky-400" },
  { id: "083e9950-420e-459f-ae58-90f9ccb96ed9", name: "Finn", tagline: "finance — runway, receivables, what's due", voice: "Brent", ring: "hover:border-emerald-400/60", dot: "bg-emerald-400" },
  { id: "d7d2a1e8-da87-42ad-997c-f0aa354f3549", name: "Opsy", tagline: "infrastructure — is everything up and healthy?", voice: "Andi", ring: "hover:border-violet-400/60", dot: "bg-violet-400" },
  { id: "eadd9571-8cf7-44bc-a4b9-a2d0c4aaed69", name: "Claude", tagline: "general thinking partner — no memory, just help", voice: "Cameron", ring: "hover:border-slate-300/60", dot: "bg-slate-300" },
];

type Status = "idle" | "connecting" | "live";

export default function VoicePlaygroundPage() {
  const vapiRef = useRef<VapiClient | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [lines, setLines] = useState<{ role: string; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const ensureVapi = useCallback(async (): Promise<VapiClient> => {
    if (vapiRef.current) return vapiRef.current;
    const mod = await import("@vapi-ai/web");
    const Vapi = mod.default as unknown as VapiCtor;
    const v = new Vapi(VAPI_PUBLIC_KEY);
    v.on("call-start", () => setStatus("live"));
    v.on("call-end", () => {
      setStatus("idle");
      setActiveId(null);
    });
    v.on("error", (e) => {
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      setError(msg || "call error");
      setStatus("idle");
      setActiveId(null);
    });
    v.on("message", (m) => {
      const msg = m as VapiMessage;
      if (msg?.type === "transcript" && msg.transcriptType === "final" && msg.transcript) {
        setLines((prev) => [...prev, { role: msg.role ?? "?", text: msg.transcript! }].slice(-40));
      }
    });
    vapiRef.current = v;
    return v;
  }, []);

  const startCall = useCallback(
    async (id: string) => {
      setError(null);
      setLines([]);
      setActiveId(id);
      setStatus("connecting");
      try {
        const v = await ensureVapi();
        await v.start(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "could not start the call");
        setStatus("idle");
        setActiveId(null);
      }
    },
    [ensureVapi],
  );

  const stopCall = useCallback(() => {
    vapiRef.current?.stop();
    setStatus("idle");
    setActiveId(null);
  }, []);

  useEffect(() => {
    return () => {
      vapiRef.current?.stop();
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">winded.vertigo — voice agents</h1>
          <p className="mt-1 text-sm text-slate-400">
            Tap an agent to talk. Uses your mic; allow access when prompted. Each agent answers in its
            own voice and knows your live context.
          </p>
        </header>

        {error && (
          <div className="mb-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {AGENTS.map((a) => {
            const isActive = activeId === a.id;
            return (
              <div
                key={a.id}
                className={`rounded-xl border bg-slate-900/60 p-4 transition-colors ${
                  isActive ? "border-slate-200/70" : `border-slate-800 ${a.ring}`
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${a.dot}`} />
                    <span className="text-lg font-medium">{a.name}</span>
                  </div>
                  <span className="text-xs text-slate-500">{a.voice}</span>
                </div>
                <p className="mt-2 min-h-[2.5rem] text-sm text-slate-400">{a.tagline}</p>

                {isActive ? (
                  <button
                    onClick={stopCall}
                    className="mt-3 w-full rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500"
                  >
                    {status === "connecting" ? "Connecting…" : "● End call"}
                  </button>
                ) : (
                  <button
                    onClick={() => startCall(a.id)}
                    disabled={status !== "idle"}
                    className="mt-3 w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Talk to {a.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {lines.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              live transcript
            </h2>
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm">
              {lines.map((l, i) => (
                <p key={i} className={l.role === "assistant" ? "text-slate-100" : "text-slate-400"}>
                  <span className="mr-2 text-xs uppercase text-slate-600">
                    {l.role === "assistant" ? "agent" : "you"}
                  </span>
                  {l.text}
                </p>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-10 text-xs text-slate-600">
          Browser web calls use Vapi minutes (small per-minute usage) — same as the dashboard tester.
          No phone numbers are involved.
        </footer>
      </div>
    </main>
  );
}
