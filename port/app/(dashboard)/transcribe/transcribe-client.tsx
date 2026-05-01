"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Square,
  Pause,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * TranscribeClient — in-browser meeting recorder.
 *
 * Flow:
 *   1. User fills in title, date, attendees, category, project tag
 *   2. Clicks record → browser asks for mic permission → MediaRecorder
 *      captures audio to a Blob in memory
 *   3. Click stop → preview the clip, option to re-record or save
 *   4. On save → POST the Blob + metadata to /api/transcribe
 *   5. Server uploads to R2, transcribes via Whisper, summarises via
 *      Claude, creates the Notion meeting page, returns pageUrl
 *   6. Success state shows "open in notion →" deep-link
 *
 * Audio is held only in browser memory until save. No auto-upload.
 * Refreshing the page loses the recording — intentional: if you didn't
 * save, you didn't mean to.
 */

const MEETING_CATEGORIES = [
  "1 on 1",
  "review",
  "strategic",
  "discovery",
  "alignment",
  "workshop",
  "retrospective",
  "check-in",
  "planning",
  "demo",
  "connecting",
] as const;

type MemberOption = { id: string; name: string; email: string };
type ProjectOption = { id: string; name: string; type: string | null };

type RecorderState =
  | { kind: "idle" }
  | { kind: "requesting-permission" }
  | { kind: "recording"; startedAt: number; elapsed: number }
  | { kind: "paused"; elapsed: number }
  | { kind: "stopped"; blob: Blob; elapsed: number; url: string }
  | { kind: "error"; message: string };

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting"; stage: string }
  | { kind: "success"; pageUrl: string; pageId: string }
  | { kind: "error"; message: string };

interface TranscribeClientProps {
  members: MemberOption[];
  projects: ProjectOption[];
}

export function TranscribeClient({ members, projects }: TranscribeClientProps) {
  // Form fields
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("check-in");
  const [projectId, setProjectId] = useState<string>("");

  // Recorder state
  const [recorder, setRecorder] = useState<RecorderState>({ kind: "idle" });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Submit state
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recorder.kind === "stopped") {
        URL.revokeObjectURL(recorder.url);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = useCallback(async () => {
    setRecorder({ kind: "requesting-permission" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer webm/opus (widely supported, compact). Fall back to default.
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : undefined;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = rec;
      chunksRef.current = [];

      rec.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      });

      rec.addEventListener("stop", () => {
        const blob = new Blob(chunksRef.current, { type: mime ?? "audio/webm" });
        const url = URL.createObjectURL(blob);
        const startedAt =
          recorder.kind === "recording" || recorder.kind === "paused"
            ? recorder.kind === "recording"
              ? recorder.startedAt
              : Date.now() - recorder.elapsed * 1000
            : Date.now();
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setRecorder({ kind: "stopped", blob, url, elapsed });

        // Free the mic
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      });

      rec.start(1000); // collect data every second

      const startedAt = Date.now();
      setRecorder({ kind: "recording", startedAt, elapsed: 0 });

      tickRef.current = setInterval(() => {
        setRecorder((r) =>
          r.kind === "recording"
            ? { ...r, elapsed: Math.floor((Date.now() - r.startedAt) / 1000) }
            : r,
        );
      }, 1000);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "microphone permission was denied. enable it in your browser settings and try again."
          : err instanceof Error
            ? err.message
            : "couldn't access the microphone.";
      setRecorder({ kind: "error", message });
    }
    // intentionally depend on nothing — we refer to recorder via closure once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRecording = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
  }, []);

  const pauseRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === "recording") {
      rec.pause();
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      setRecorder((r) =>
        r.kind === "recording" ? { kind: "paused", elapsed: r.elapsed } : r,
      );
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === "paused") {
      rec.resume();
      setRecorder((r) =>
        r.kind === "paused"
          ? {
              kind: "recording",
              startedAt: Date.now() - r.elapsed * 1000,
              elapsed: r.elapsed,
            }
          : r,
      );
      tickRef.current = setInterval(() => {
        setRecorder((r) =>
          r.kind === "recording"
            ? { ...r, elapsed: Math.floor((Date.now() - r.startedAt) / 1000) }
            : r,
        );
      }, 1000);
    }
  }, []);

  const discardRecording = useCallback(() => {
    if (recorder.kind === "stopped") {
      URL.revokeObjectURL(recorder.url);
    }
    setRecorder({ kind: "idle" });
    setSubmit({ kind: "idle" });
    chunksRef.current = [];
  }, [recorder]);

  const toggleAttendee = (id: string) => {
    setAttendeeIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const canSubmit =
    recorder.kind === "stopped" &&
    title.trim().length > 0 &&
    submit.kind !== "submitting";

  const handleSubmit = useCallback(async () => {
    if (recorder.kind !== "stopped") return;
    if (!title.trim()) return;

    setSubmit({ kind: "submitting", stage: "uploading audio to r2…" });

    try {
      const form = new FormData();
      form.append("audio", recorder.blob, `meeting-${Date.now()}.webm`);
      form.append("title", title.trim());
      form.append("date", date);
      form.append("category", category);
      form.append("duration", String(recorder.elapsed));
      form.append("attendeeIds", JSON.stringify(attendeeIds));
      if (projectId) form.append("projectId", projectId);

      const res = await fetch("/api/transcribe", { method: "POST", body: form });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { pageId: string; pageUrl: string };
      setSubmit({ kind: "success", pageId: data.pageId, pageUrl: data.pageUrl });
    } catch (err) {
      setSubmit({
        kind: "error",
        message: err instanceof Error ? err.message : "something went wrong.",
      });
    }
  }, [recorder, title, date, category, attendeeIds, projectId]);

  // ─ rendering ────────────────────────────────────────────────────

  if (submit.kind === "success") {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" aria-hidden="true" />
          <h2 className="text-xl font-semibold">meeting filed. 🎙️</h2>
          <p className="text-muted-foreground">
            audio uploaded. transcript + summary written to notion. the nightly
            ingest-meeting-notes cron will pull action items into work items.
          </p>
          <div className="flex gap-2 justify-center">
            <a
              href={submit.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 h-9 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
              open in notion
            </a>
            <Button variant="outline" onClick={() => { discardRecording(); setTitle(""); }}>
              record another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* form fields */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            meeting details
          </h2>

          <div className="space-y-1.5">
            <Label htmlFor="meeting-title">title</Label>
            <Input
              id="meeting-title"
              placeholder="e.g., garrett × maria weekly — 17 april 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="meeting-date">date</Label>
              <Input
                id="meeting-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meeting-category">category</Label>
              <Select
                value={category}
                onValueChange={(v) => v && setCategory(v)}
              >
                <SelectTrigger id="meeting-category">
                  <SelectValue placeholder="pick one" />
                </SelectTrigger>
                <SelectContent>
                  {MEETING_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>attendees</Label>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => {
                const selected = attendeeIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleAttendee(m.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      selected
                        ? "bg-accent text-white border-accent"
                        : "bg-background border-border text-muted-foreground hover:border-accent/50 hover:text-foreground",
                    )}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>

          {projects.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="meeting-project">project (optional)</Label>
              <Select
                value={projectId || "__none__"}
                onValueChange={(v) => setProjectId(!v || v === "__none__" ? "" : v)}
              >
                <SelectTrigger id="meeting-project">
                  <SelectValue placeholder="pick a project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">no project tag</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* recorder */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            recording
          </h2>

          <RecorderUi
            state={recorder}
            onStart={startRecording}
            onStop={stopRecording}
            onPause={pauseRecording}
            onResume={resumeRecording}
            onDiscard={discardRecording}
          />
        </CardContent>
      </Card>

      {/* submit */}
      {recorder.kind === "stopped" && (
        <Card>
          <CardContent className="p-6 space-y-3">
            {submit.kind === "error" && (
              <div className="flex items-start gap-2 text-sm text-destructive" role="alert">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{submit.message}</span>
              </div>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full"
              size="lg"
            >
              {submit.kind === "submitting" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  {submit.stage}
                </>
              ) : (
                <>transcribe + file to notion</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              this will take ~30 seconds per minute of audio while Whisper
              transcribes and Claude summarises.
            </p>
          </CardContent>
        </Card>
      )}

      {/* back link */}
      <div className="text-center">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-accent transition-colors"
        >
          ← back to dashboard
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// recorder UI sub-component
// ─────────────────────────────────────────────────────────────────
function RecorderUi({
  state,
  onStart,
  onStop,
  onPause,
  onResume,
  onDiscard,
}: {
  state: RecorderState;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onDiscard: () => void;
}) {
  if (state.kind === "error") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 text-sm text-destructive" role="alert">
          <MicOff className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
        <Button onClick={onStart} variant="outline">
          try again
        </Button>
      </div>
    );
  }

  const elapsed =
    state.kind === "recording" || state.kind === "paused" || state.kind === "stopped"
      ? state.elapsed
      : 0;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div
          className={cn(
            "inline-flex items-center gap-3 rounded-full px-4 py-2",
            state.kind === "recording" && "bg-destructive/10 text-destructive",
            state.kind === "paused" && "bg-muted text-muted-foreground",
            state.kind === "stopped" && "bg-emerald-100 text-emerald-700",
            state.kind === "idle" && "bg-muted text-muted-foreground",
            state.kind === "requesting-permission" && "bg-muted text-muted-foreground",
          )}
        >
          {state.kind === "recording" && (
            <>
              <span
                className="h-2 w-2 rounded-full bg-destructive motion-safe:animate-pulse"
                aria-hidden="true"
              />
              <span className="font-mono text-lg tabular-nums">
                {formatTime(elapsed)}
              </span>
              <span className="text-xs">recording</span>
            </>
          )}
          {state.kind === "paused" && (
            <>
              <Pause className="h-4 w-4" aria-hidden="true" />
              <span className="font-mono text-lg tabular-nums">
                {formatTime(elapsed)}
              </span>
              <span className="text-xs">paused</span>
            </>
          )}
          {state.kind === "stopped" && (
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span className="font-mono text-lg tabular-nums">
                {formatTime(elapsed)}
              </span>
              <span className="text-xs">ready to submit</span>
            </>
          )}
          {state.kind === "idle" && (
            <>
              <Mic className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm">not recording</span>
            </>
          )}
          {state.kind === "requesting-permission" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span className="text-sm">asking for mic access…</span>
            </>
          )}
        </div>
      </div>

      {/* audio playback when stopped */}
      {state.kind === "stopped" && (
        <audio
          controls
          src={state.url}
          className="w-full"
          aria-label="recorded meeting audio"
        />
      )}

      {/* controls */}
      <div className="flex justify-center gap-2">
        {state.kind === "idle" && (
          <Button onClick={onStart} className="gap-2" size="lg">
            <Mic className="h-4 w-4" aria-hidden="true" />
            start recording
          </Button>
        )}
        {state.kind === "recording" && (
          <>
            <Button onClick={onPause} variant="outline" className="gap-2">
              <Pause className="h-4 w-4" aria-hidden="true" />
              pause
            </Button>
            <Button onClick={onStop} variant="destructive" className="gap-2">
              <Square className="h-4 w-4" aria-hidden="true" />
              stop
            </Button>
          </>
        )}
        {state.kind === "paused" && (
          <>
            <Button onClick={onResume} className="gap-2">
              <Play className="h-4 w-4" aria-hidden="true" />
              resume
            </Button>
            <Button onClick={onStop} variant="destructive" className="gap-2">
              <Square className="h-4 w-4" aria-hidden="true" />
              stop
            </Button>
          </>
        )}
        {state.kind === "stopped" && (
          <Button onClick={onDiscard} variant="ghost" className="gap-2 text-muted-foreground">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            discard + re-record
          </Button>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}
