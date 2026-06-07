"use client";

/**
 * AgentChat — a mobile-friendly chat interface for Mo, PaM, and cARL.
 *
 * Reads SSE from /api/chat and appends text chunks to the current
 * assistant message in real time. Tool calls happen server-side and
 * are invisible to the user; only the final text response streams in.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { AgentId } from "@/lib/agent/agent-router";

type MessageRole = "user" | "assistant";

interface ChatMessage {
  role: MessageRole;
  content: string;
  streaming?: boolean;
}

const AGENT_META: Record<
  Exclude<AgentId, "port">,
  { label: string; role: string; colour: string }
> = {
  mo: {
    label: "Mo",
    role: "chief marketing officer",
    colour: "bg-[oklch(0.26_0.04_250)]", // cadet
  },
  pam: {
    label: "PaM",
    role: "project & momentum manager",
    colour: "bg-[oklch(0.50_0.12_30)]", // sienna-ish
  },
  carl: {
    label: "cARL",
    role: "research & learning",
    colour: "bg-[oklch(0.40_0.10_200)]", // teal-ish
  },
};

function generateThreadId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface AgentChatProps {
  initialAgent: Exclude<AgentId, "port">;
  userName: string;
}

export function AgentChat({ initialAgent, userName }: AgentChatProps) {
  const [agent, setAgent] = useState<Exclude<AgentId, "port">>(initialAgent);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const threadIdRef = useRef<string>(generateThreadId());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reset thread when switching agents so context doesn't bleed.
  const switchAgent = useCallback((next: Exclude<AgentId, "port">) => {
    if (abortRef.current) abortRef.current.abort();
    setAgent(next);
    setMessages([]);
    threadIdRef.current = generateThreadId();
    setInput("");
  }, []);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);

    // Add a streaming placeholder for the assistant reply.
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", streaming: true },
    ]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent,
          message: text,
          threadId: threadIdRef.current,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "request failed" }));
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.streaming) {
            next[next.length - 1] = {
              role: "assistant",
              content: `(error: ${err.error ?? "something went wrong"})`,
              streaming: false,
            };
          }
          return next;
        });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data) as { text?: string };
            if (parsed.text) {
              accumulated += parsed.text;
              // Update the streaming message in place.
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.streaming) {
                  next[next.length - 1] = {
                    role: "assistant",
                    content: accumulated,
                    streaming: true,
                  };
                }
                return next;
              });
            }
          } catch {
            // Malformed SSE chunk — skip.
          }
        }
      }

      // Mark streaming done.
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.streaming) {
          next[next.length - 1] = { ...last, streaming: false };
        }
        return next;
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.streaming) {
          next[next.length - 1] = {
            role: "assistant",
            content: "(sorry — something went wrong. try again.)",
            streaming: false,
          };
        }
        return next;
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, agent]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const meta = AGENT_META[agent];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-10rem)]">
      {/* Agent selector header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="flex gap-1.5">
          {(["mo", "pam", "carl"] as const).map((a) => (
            <button
              key={a}
              onClick={() => switchAgent(a)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                agent === a
                  ? `${AGENT_META[a].colour} text-[oklch(0.95_0.03_80)]`
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {AGENT_META[a].label}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
          {meta.role}
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div
              className={`w-12 h-12 rounded-full ${meta.colour} flex items-center justify-center text-[oklch(0.95_0.03_80)] text-lg font-semibold mb-3`}
            >
              {meta.label[0]}
            </div>
            <p className="text-sm text-muted-foreground">
              hey {userName} — i&apos;m {meta.label.toLowerCase()},{" "}
              {meta.role}.
              <br />
              what would you like to talk about?
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div
                className={`w-7 h-7 rounded-full ${meta.colour} flex-shrink-0 flex items-center justify-center text-[oklch(0.95_0.03_80)] text-xs font-semibold mr-2 mt-1`}
              >
                {meta.label[0]}
              </div>
            )}
            <div
              className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
            >
              {msg.content || (msg.streaming ? <ThinkingDots /> : null)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`message ${meta.label.toLowerCase()}…`}
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 min-h-[48px] max-h-40 overflow-y-auto"
            style={{
              height: "auto",
              minHeight: "48px",
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
            aria-label="send"
          >
            <SendIcon />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          enter to send · shift+enter for new line
        </p>
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex gap-1 items-center">
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" />
    </span>
  );
}

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}
