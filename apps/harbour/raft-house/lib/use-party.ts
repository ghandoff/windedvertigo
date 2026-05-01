"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RoomState, FacilitatorMessage, ParticipantMessage, ServerBroadcast } from "./types";

export interface Notification {
  id: string;
  type: "hint" | "look-up";
  message: string;
  durationMs?: number;
  timestamp: number;
}

const PARTYKIT_HOST =
  process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999";

interface UsePartyOptions {
  roomCode: string;
  role: "facilitator" | "participant";
  name?: string;
  participantRole?: string;
}

const MAX_RECONNECT_ATTEMPTS = 10;
const MAX_BACKOFF_MS = 16_000;

function getBackoffMs(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), MAX_BACKOFF_MS);
}

export function useParty({ roomCode, role, name, participantRole }: UsePartyOptions) {
  const [state, setState] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [connectTrigger, setConnectTrigger] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<string[]>([]);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!roomCode) return;
    if (failed) return;

    const protocol = PARTYKIT_HOST.startsWith("localhost") ? "ws" : "wss";
    const params = new URLSearchParams({ role });
    if (name) params.set("name", name);
    if (participantRole) params.set("participantRole", participantRole);

    const url = `${protocol}://${PARTYKIT_HOST}/party/${roomCode}?${params}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      setConnected(true);
      setReconnecting(false);
      attemptRef.current = 0;
      // flush queued messages
      for (const msg of queueRef.current) {
        ws.send(msg);
      }
      queueRef.current = [];
    });

    ws.addEventListener("message", (event) => {
      try {
        const msg: ServerBroadcast = JSON.parse(event.data);
        if (msg.type === "state-update") {
          if (msg.yourId) setMyId(msg.yourId);
          setState(msg.state);
        } else if (msg.type === "activity-changed") {
          setState((prev) =>
            prev
              ? { ...prev, currentActivityIndex: msg.activityIndex, resultsRevealed: false, timer: null }
              : prev,
          );
        } else if (msg.type === "timer-sync") {
          setState((prev) => (prev ? { ...prev, timer: msg.timer } : prev));
        } else if (msg.type === "results-revealed") {
          setState((prev) => (prev ? { ...prev, resultsRevealed: true } : prev));
        } else if (msg.type === "participant-joined") {
          setState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              participants: { ...prev.participants, [msg.participant.id]: msg.participant },
            };
          });
        } else if (msg.type === "participant-left") {
          setState((prev) => {
            if (!prev) return prev;
            const participants = { ...prev.participants };
            if (participants[msg.participantId]) {
              participants[msg.participantId] = {
                ...participants[msg.participantId],
                connectionStatus: "disconnected",
              };
            }
            return { ...prev, participants };
          });
        } else if (msg.type === "session-ended") {
          setState((prev) => (prev ? { ...prev, status: "completed" } : prev));
        } else if (msg.type === "hint") {
          const n: Notification = {
            id: crypto.randomUUID(),
            type: "hint",
            message: msg.hint,
            timestamp: Date.now(),
          };
          setNotifications((prev) => [...prev, n]);
        } else if (msg.type === "look-up") {
          const n: Notification = {
            id: crypto.randomUUID(),
            type: "look-up",
            message: msg.message,
            durationMs: msg.durationMs,
            timestamp: Date.now(),
          };
          setNotifications((prev) => [...prev, n]);
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.addEventListener("close", () => {
      setConnected(false);
      if (wsRef.current !== ws) return;
      wsRef.current = null;

      const attempt = attemptRef.current;
      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        setReconnecting(false);
        setFailed(true);
        return;
      }

      setReconnecting(true);
      attemptRef.current = attempt + 1;
      const delay = getBackoffMs(attempt);
      reconnectTimerRef.current = setTimeout(() => {
        setConnectTrigger((t) => t + 1);
      }, delay);
    });

    return () => {
      ws.close();
      wsRef.current = null;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [roomCode, role, name, participantRole, connectTrigger, failed]);

  const send = useCallback(
    (msg: FacilitatorMessage | ParticipantMessage) => {
      const fullMsg = role === "facilitator"
        ? { ...msg, role: "facilitator" as const }
        : { ...msg, role: "participant" as const, participantId: "" };

      const str = JSON.stringify(fullMsg);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(str);
      } else {
        queueRef.current.push(str);
      }
    },
    [role],
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { state, connected, reconnecting, failed, send, notifications, dismissNotification, myId };
}
