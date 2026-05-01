"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import "./prowl.css";

/* ── constants ────────────────────────────────────────────────── */

const TOTAL_SCREENS = 9;
const TRANSITION_MS = 1200;
const POLL_INTERVAL_MS = 1500;
const GATE_INDICES = new Set([1, 3, 5, 7]);

const YOUTUBE_ID = "p7ULTbxj9tQ"; // alan watts lectures over lo-fi beats — audio only, 0:00–4:15

const DEEP_DECK_PROMPTS = [
  "what's a sound from your childhood that you can still hear perfectly?",
  "what's something you believe that you can't prove?",
  "who taught you something without knowing they were teaching?",
  "what's a question you've stopped asking?",
  "what are you pretending not to know?",
  "if you could un-learn one thing, what would it be?",
  "what's the bravest thing you've never told anyone about?",
  "when did you last feel like a beginner?",
];

const NICASIO_PHOTOS: string[] = [
  "/harbour/prowl/photos/nicasio-hills.jpg",
  "/harbour/prowl/photos/card-workshop.jpg",
  "/harbour/prowl/photos/group-hike.jpg",
  "/harbour/prowl/photos/cows-hillside.jpg",
  "/harbour/prowl/photos/team-couch.jpg",
  "/harbour/prowl/photos/pizza-making.jpg",
  "/harbour/prowl/photos/aaron-fruit.jpg",
  "/harbour/prowl/photos/maria-art.jpg",
];

const STONE_COLOURS = [
  "#273248", // cadet
  "#b15043", // redwood
  "#cb7858", // sienna
  "#ffebd2", // champagne
  "#8b6f5e", // warm brown
  "#3d5a80", // steel blue
];

const DRIFT_LINES = [
  "the technology strand of what we do",
  "is not about making people more tech-like.",
  "it is about using ai and automation",
  "to clear the path back to presence —",
  "so people touch grass,",
  "meet strangers,",
  "stay curious,",
  "remain vulnerable,",
  "and discover their aliveness.",
];

/* ── shared state type (mirrors server) ───────────────────────── */

interface ProwlState {
  screen: number;
  arriveBegun: boolean;
  gatherWords: { text: string; x: number; y: number }[];
  oraclePhase: "intro" | "countdown" | "spotlight";
  countdownStart: number | null;
  oracleReadings: string[];
  knockTimes: number[];
  deckIndex: number;
  cardFlipped: boolean;
  breathHeld: number;
  stonesPlaced: number[];
  driftLanterns: { text: string; x: number; id: number }[];
  driftFinal: boolean;
}

/* ── API helpers ──────────────────────────────────────────────── */

async function fetchState(): Promise<ProwlState | null> {
  try {
    const res = await fetch("/harbour/prowl/api/state", { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function sendAction(
  action: string,
  payload?: Record<string, unknown>
): Promise<ProwlState | null> {
  try {
    const res = await fetch("/harbour/prowl/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/* ── audio hook ───────────────────────────────────────────────── */

function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const playKnock = useCallback(() => {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }, [getCtx]);

  const playStone = useCallback(() => {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  }, [getCtx]);

  const playBreathTone = useCallback(() => {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.5);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1);
  }, [getCtx]);

  return { playKnock, playStone, playBreathTone };
}

/* ── particles ────────────────────────────────────────────────── */

function Particles({
  count,
  color,
  direction = "up",
}: {
  count: number;
  color: string;
  direction?: "up" | "down";
}) {
  const [particles] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      key: i,
      size: 2 + Math.random() * 4,
      left: Math.random() * 100,
      top: 40 + Math.random() * 60,
      po: (0.1 + Math.random() * 0.25).toString(),
      py: `${-(100 + Math.random() * 300)}px`,
      pyDown: `${100 + Math.random() * 300}px`,
      px: `${Math.random() * 60 - 30}px`,
      duration: `${8 + Math.random() * 12}s`,
      delay: `${Math.random() * 10}s`,
    }))
  );

  return (
    <div className={`particles${direction === "down" ? " particles-down" : ""}`}>
      {particles.map((p) => (
        <div
          key={p.key}
          className="particle"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            top: `${p.top}%`,
            background: color,
            "--po": p.po,
            "--py": p.py,
            "--py-down": p.pyDown,
            "--px": p.px,
            "--duration": p.duration,
            "--delay": p.delay,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ── main component ───────────────────────────────────────────── */

export function ProwlClient() {
  /* ── role detection ── */
  const [isHost, setIsHost] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsHost(params.get("role") === "host");
  }, []);

  /* ── shared state (from server) ── */
  const [shared, setShared] = useState<ProwlState | null>(null);
  const prevScreenRef = useRef(0);

  /* ── local-only UI state ── */
  const [transitioning, setTransitioning] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const audio = useAudio();

  // youtube miniplayer state (host only)
  const [ytPlaying, setYtPlaying] = useState(true);
  const [ytVolume, setYtVolume] = useState(80);

  // input fields (local only)
  const [gatherInput, setGatherInput] = useState("");
  const [oracleInput, setOracleInput] = useState("");
  const [driftInput, setDriftInput] = useState("");
  const gatherInputRef = useRef<HTMLInputElement>(null);

  // arrive breathing animation (state-driven, triggered by shared.arriveBegun)
  const [breathProgress, setBreathProgress] = useState(-1); // -1 = not started, 0..1 = progress through sequence
  const [breathDone, setBreathDone] = useState(false);
  const [revealDone, setRevealDone] = useState(false);
  const [typewriterText, setTypewriterText] = useState("");
  const [typewriterDone, setTypewriterDone] = useState(false);
  const fullQuestion =
    "what's one thing that made you feel alive this week that had nothing to do with work?";

  // oracle countdown (local tick derived from shared.countdownStart)
  const [countdown, setCountdown] = useState(60);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // knock ripples (local visual only)
  const [knockRipples, setKnockRipples] = useState<number[]>([]);

  // breath gate spacebar (local, sends deltas to server)
  const [spaceDown, setSpaceDown] = useState(false);
  const breathIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // nicasio staged reveal (local timers)
  const [nicasioStage, setNicasioStage] = useState(0);
  const [nicasioTimer, setNicasioTimer] = useState(0);
  const [nicasioPhotoIndex, setNicasioPhotoIndex] = useState(0);

  // drift staged reveal (local timers)
  const [driftStage, setDriftStage] = useState(0);

  /* ── derived values from shared state ── */
  const cur = shared?.screen ?? 0;
  const arriveBegun = shared?.arriveBegun ?? false;
  const gatherWords = shared?.gatherWords ?? [];
  const gatherReady = gatherWords.length >= 5;
  const oraclePhase = shared?.oraclePhase ?? "intro";
  const oracleReadings = shared?.oracleReadings ?? [];
  const knockTimes = shared?.knockTimes ?? [];
  const doorOpen = cur > 3;
  const deckIndex = shared?.deckIndex ?? -1;
  const cardFlipped = shared?.cardFlipped ?? false;
  const breathHeld = shared?.breathHeld ?? 0;
  const breathGateDone = breathHeld >= 30000;
  const stonesPlaced = shared?.stonesPlaced ?? [];
  const cairnDone = stonesPlaced.length >= STONE_COLOURS.length;
  const driftLanterns = shared?.driftLanterns ?? [];
  const driftFinal = shared?.driftFinal ?? false;

  /* ── polling ────────────────────────────────────────────────── */

  useEffect(() => {
    let active = true;

    const poll = async () => {
      const state = await fetchState();
      if (active && state) {
        setShared((prev) => {
          // detect screen change for transition animation
          if (prev && state.screen !== prev.screen) {
            prevScreenRef.current = prev.screen;
            setTransitioning(true);
            setTimeout(() => setTransitioning(false), TRANSITION_MS);
          }
          return state;
        });
      }
    };

    poll(); // initial fetch
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  /* ── action sender (updates local state optimistically) ───── */

  const act = useCallback(
    async (action: string, payload?: Record<string, unknown>) => {
      const result = await sendAction(action, payload);
      if (result) {
        setShared((prev) => {
          if (prev && result.screen !== prev.screen) {
            prevScreenRef.current = prev.screen;
            setTransitioning(true);
            setTimeout(() => setTransitioning(false), TRANSITION_MS);
          }
          return result;
        });
      }
    },
    []
  );

  /* ── keyboard navigation ────────────────────────────────────── */

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (cur === 5 && e.code === "Space") {
        e.preventDefault();
        return;
      }

      if (e.key === "ArrowRight" || e.code === "Space") {
        e.preventDefault();
        if (!GATE_INDICES.has(cur)) {
          act("advance");
        }
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        // back navigation disabled in multiplayer — forward-only
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [cur, act]);

  /* ── screen 0: arrive breathing sequence (state-driven) ─────── */

  useEffect(() => {
    if (!arriveBegun || breathProgress >= 0) return;

    // restart YouTube audio from beginning and unmute
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [0, true] }),
      "*"
    );
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "unMute" }),
      "*"
    );
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "playVideo" }),
      "*"
    );

    // Breathing: 3s delay + 3×14s = 45s. Audio: 4:15 = 255s.
    // Reveal text syncs with end of audio so "when you open your eyes..."
    // lands as Alan Watts fades out.
    const BREATH_MS = 45000;
    const AUDIO_MS = 255000;   // 4m15s
    const REVEAL_AT = AUDIO_MS - 5000;  // 4:10 — reveal fades in 5s before audio ends
    const TYPEWRITER_AT = AUDIO_MS;     // 4:15 — question starts as audio ends
    const start = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / BREATH_MS, 1);
      setBreathProgress(progress);

      if (progress >= 1) {
        clearInterval(interval);
        setBreathDone(true);
      }
    }, 33); // ~30fps

    // post-breath sequence: reveal text synced to audio end, then typewriter
    const t3 = setTimeout(() => setRevealDone(true), REVEAL_AT);
    const t4 = setTimeout(() => {
      let i = 0;
      const tw = setInterval(() => {
        i++;
        setTypewriterText(fullQuestion.slice(0, i));
        if (i >= fullQuestion.length) {
          clearInterval(tw);
          setTypewriterDone(true);
        }
      }, 45);
    }, TYPEWRITER_AT);

    return () => {
      clearInterval(interval);
      clearTimeout(t3);
      clearTimeout(t4);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arriveBegun]);

  // derive breathing visuals from progress
  const breathVisuals = (() => {
    if (breathProgress < 0) return { scale: 0.6, opacity: 0, label: "" };
    if (breathDone) return { scale: 0.6, opacity: 0, label: "" };

    const DELAY_FRAC = 3000 / 45000;      // first 3s = delay
    const CYCLE_FRAC = 14000 / 45000;      // each cycle
    const INHALE_FRAC = 4000 / 14000;
    const HOLD_FRAC = 4000 / 14000;

    // fade-in during delay
    if (breathProgress < DELAY_FRAC) {
      const t = breathProgress / DELAY_FRAC;
      return { scale: 0.6, opacity: Math.min(t * (DELAY_FRAC / (1000 / 45000)), 1) * 0.3, label: "" };
    }

    const breathFrac = (breathProgress - DELAY_FRAC) / (1 - DELAY_FRAC); // 0..1 through breathing
    const cycleFrac = breathFrac * 3; // 0..3 (which cycle)
    const inCycle = cycleFrac % 1;    // 0..1 within current cycle

    const smoothstep = (t: number) => t * t * (3 - 2 * t);

    if (inCycle < INHALE_FRAC) {
      const t = inCycle / INHALE_FRAC;
      const e = smoothstep(t);
      return { scale: 0.6 + 0.4 * e, opacity: 0.3 + 0.5 * e, label: "breathe in..." };
    } else if (inCycle < INHALE_FRAC + HOLD_FRAC) {
      return { scale: 1.0, opacity: 0.8, label: "hold..." };
    } else {
      const t = (inCycle - INHALE_FRAC - HOLD_FRAC) / (1 - INHALE_FRAC - HOLD_FRAC);
      const e = smoothstep(t);
      return { scale: 1.0 - 0.4 * e, opacity: 0.8 - 0.5 * e, label: "breathe out..." };
    }
  })();

  /* ── oracle countdown (local tick from shared start time) ──── */

  useEffect(() => {
    if (oraclePhase !== "countdown" || !shared?.countdownStart) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    const tick = () => {
      const elapsed = Math.floor((Date.now() - shared.countdownStart!) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setCountdown(remaining);
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        act("end_countdown");
      }
    };

    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [oraclePhase, shared?.countdownStart, act]);

  /* ── gate 5: breath spacebar ────────────────────────────────── */

  useEffect(() => {
    if (cur !== 5 || breathGateDone) return;

    const handleDown = (e: globalThis.KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      setSpaceDown(true);
      audio.playBreathTone();
    };

    const handleUp = (e: globalThis.KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      setSpaceDown(false);
    };

    document.addEventListener("keydown", handleDown);
    document.addEventListener("keyup", handleUp);
    return () => {
      document.removeEventListener("keydown", handleDown);
      document.removeEventListener("keyup", handleUp);
    };
  }, [cur, breathGateDone, audio]);

  // send breath increments to server while spacebar held
  useEffect(() => {
    if (!spaceDown || breathGateDone) {
      if (breathIntervalRef.current) {
        clearInterval(breathIntervalRef.current);
        breathIntervalRef.current = null;
      }
      return;
    }
    breathIntervalRef.current = setInterval(() => {
      act("add_breath", { ms: 500 });
    }, 500);
    return () => {
      if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
    };
  }, [spaceDown, breathGateDone, act]);

  /* ── screen 6: nicasio staged reveal ────────────────────────── */

  useEffect(() => {
    if (cur !== 6) return;
    setNicasioStage(0);
    setNicasioTimer(0);

    const stages = [3000, 7000, 11000, 15000, 25000];
    const timers = stages.map((delay, i) =>
      setTimeout(() => setNicasioStage(i + 1), delay)
    );

    const arrowTimer = setTimeout(() => setNicasioTimer(1), 120000);

    let photoTimer: ReturnType<typeof setInterval> | null = null;
    if (NICASIO_PHOTOS.length > 0) {
      photoTimer = setInterval(() => {
        setNicasioPhotoIndex((prev) => (prev + 1) % NICASIO_PHOTOS.length);
      }, 8000);
    }

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(arrowTimer);
      if (photoTimer) clearInterval(photoTimer);
    };
  }, [cur]);

  /* ── screen 8: drift staged reveal ──────────────────────────── */

  useEffect(() => {
    if (cur !== 8) return;
    setDriftStage(0);

    const timers = DRIFT_LINES.map((_, i) =>
      setTimeout(() => setDriftStage(i + 1), 2000 * (i + 1))
    );

    return () => timers.forEach(clearTimeout);
  }, [cur]);

  /* ── screen class helper ────────────────────────────────────── */

  const forward = cur > prevScreenRef.current;

  function scClass(i: number, extra: string = "") {
    let cls = `sc ${extra}`;
    if (i === cur) cls += " active";
    else if (transitioning && i === prevScreenRef.current)
      cls += forward ? " exit-left" : " exit-right";
    return cls;
  }

  /* ── loading state ── */
  if (!shared) {
    return (
      <div className="prowl-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--prowl-champagne)", fontFamily: "var(--font-inter, system-ui)", textTransform: "lowercase", opacity: 0.5 }}>
          connecting...
        </p>
      </div>
    );
  }

  /* ── render ─────────────────────────────────────────────────── */

  return (
    <div className="prowl-root">
      {/* progress bar */}
      <div
        className="prowl-progress"
        style={{ width: `${(cur / (TOTAL_SCREENS - 1)) * 100}%` }}
      />

      {/* ── youtube iframe (host only, persists across screens) ── */}
      {isHost && (
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1&mute=1&start=0&end=255&controls=0&showinfo=0&rel=0&modestbranding=1&enablejsapi=1&origin=${typeof window !== "undefined" ? window.location.origin : ""}`}
          allow="autoplay; encrypted-media"
          title="ambient audio — alan watts"
          style={{ position: "fixed", width: 1, height: 1, opacity: 0, pointerEvents: "none", zIndex: -1 }}
        />
      )}

      {/* ── youtube miniplayer (host only) ── */}
      {isHost && arriveBegun && (
        <div className="mini-player">
          <button
            className="mini-player-btn"
            onClick={() => {
              const cmd = ytPlaying ? "pauseVideo" : "playVideo";
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: "command", func: cmd }),
                "*"
              );
              setYtPlaying(!ytPlaying);
            }}
            aria-label={ytPlaying ? "pause audio" : "play audio"}
          >
            {ytPlaying ? "⏸" : "▶"}
          </button>
          <button
            className="mini-player-btn"
            onClick={() => {
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: "command", func: "seekTo", args: [0, true] }),
                "*"
              );
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: "command", func: "playVideo" }),
                "*"
              );
              setYtPlaying(true);
            }}
            aria-label="restart audio"
          >
            ↺
          </button>
          <input
            className="mini-player-volume"
            type="range"
            min="0"
            max="100"
            value={ytVolume}
            onChange={(e) => {
              const vol = Number(e.target.value);
              setYtVolume(vol);
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: "command", func: "setVolume", args: [vol] }),
                "*"
              );
            }}
            aria-label="volume"
          />
        </div>
      )}

      {/* ── host navigation controls (visible on all screens) ── */}
      {isHost && (
        <div className="host-nav">
          <button
            className="host-nav-btn"
            onClick={() => act("reset")}
            aria-label="restart from beginning"
            title="restart"
          >
            ⟲
          </button>
          <span className="host-nav-sep" />
          <button
            className="host-nav-btn"
            onClick={() => act("set_screen", { screen: Math.max(cur - 1, 0) })}
            disabled={cur === 0}
            aria-label="go back"
          >
            ←
          </button>
          <span className="host-nav-label">{cur + 1}/{TOTAL_SCREENS}</span>
          <button
            className="host-nav-btn"
            onClick={() => act("set_screen", { screen: Math.min(cur + 1, TOTAL_SCREENS - 1) })}
            disabled={cur === TOTAL_SCREENS - 1}
            aria-label="go forward"
          >
            →
          </button>
        </div>
      )}

      {/* ── screen 0: arrive ── */}
      <div className={scClass(0, "arrive")} aria-label="arrive — land here">

        <Particles count={20} color="var(--prowl-champagne)" />

        <div className="arrive-content">
          <h1 className="arrive-title">play reconnect</h1>

          {!arriveBegun ? (
            <button
              className="prowl-btn"
              onClick={() => act("begin")}
              style={{ marginTop: "2rem", opacity: 0, animation: "fadeInSlow 2s ease 1.5s forwards" }}
            >
              begin →
            </button>
          ) : (
            <>
              <p className="arrive-subtitle">
                close your eyes. breathe in for 4. hold for 4. out for 6.
              </p>

              <div
                className="breath-ring"
                style={{
                  transform: `scale(${breathVisuals.scale})`,
                  opacity: breathVisuals.opacity,
                  transition: breathDone ? "opacity 1s ease" : undefined,
                }}
              />
              <p className={`breath-label${breathVisuals.label ? " visible" : ""}`}>
                {breathVisuals.label}
              </p>

              {breathDone && (
                <>
                  <p className={`arrive-reveal${revealDone ? " visible" : ""}`}>
                    when you open your eyes, look at the faces on your screen like
                    you&apos;re seeing them for the first time.
                  </p>
                  {revealDone && (
                    <p className={`typewriter${typewriterText ? " visible" : ""}`}>
                      {typewriterText}
                      {!typewriterDone && <span className="typewriter-cursor" />}
                    </p>
                  )}
                  {typewriterDone && (
                    <button
                      className="prowl-btn"
                      onClick={() => act("advance")}
                      style={{ marginTop: "2rem", opacity: 0, animation: "fadeInSlow 1.5s ease 1s forwards" }}
                    >
                      continue →
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── gate 1: the gathering ── */}
      <div className={scClass(1, "gathering")} aria-label="the gathering — word cloud">
        <p className="gathering-prompt">
          everyone type one word for how you feel right now.
        </p>

        <div className="gathering-cloud">
          {gatherWords.map((w, i) => (
            <div
              key={i}
              className={`cloud-word${gatherReady ? " clustered" : ""}`}
              style={{
                left: gatherReady ? "45%" : `${w.x}%`,
                top: gatherReady ? "40%" : `${w.y}%`,
              }}
            >
              {w.text}
            </div>
          ))}
        </div>

        <div className="gathering-input">
          <input
            ref={gatherInputRef}
            type="text"
            placeholder="one word..."
            value={gatherInput}
            onChange={(e) => setGatherInput(e.target.value)}
            onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const word = gatherInput.trim();
                if (word) {
                  act("add_word", { text: word });
                  setGatherInput("");
                }
              }
            }}
            maxLength={24}
          />
        </div>

        {gatherReady && (
          <button
            className="prowl-btn glow"
            onClick={() => act("advance")}
            style={{
              position: "absolute",
              bottom: "12%",
              opacity: 0,
              animation: "fadeInSlow 1s ease forwards",
            }}
          >
            ready to prowl →
          </button>
        )}
      </div>

      {/* ── screen 2: object oracle ── */}
      <div className={scClass(2, "oracle")} aria-label="the object oracle">
        {oraclePhase === "intro" && (
          <div className="oracle-content">
            <h2 className="oracle-title">the object oracle</h2>
            <p className="oracle-instruction">
              leave your screen. 60 seconds. bring back one object that is
              interesting, weird, beautiful, or inexplicable.
            </p>
            <button className="prowl-btn" onClick={() => act("start_countdown")}>
              start the timer →
            </button>
          </div>
        )}

        {oraclePhase === "countdown" && (
          <div className="oracle-content">
            <div className="countdown-wrap">
              <svg className="countdown-ring" viewBox="0 0 200 200">
                <circle className="ring-bg" cx="100" cy="100" r="90" />
                <circle
                  className="ring-fg"
                  cx="100"
                  cy="100"
                  r="90"
                  style={{
                    strokeDashoffset: (1 - countdown / 60) * 565.48,
                  }}
                />
              </svg>
              <div className="countdown-number">{countdown}</div>
            </div>
          </div>
        )}

        {oraclePhase === "spotlight" && (
          <div className="oracle-spotlight">
            <p className="oracle-spotlight-text">
              hold up your object. the group will now read your fortune.
            </p>
            <div className="oracle-readings">
              {oracleReadings.map((r, i) => (
                <div key={i} className="oracle-card">
                  {r}
                </div>
              ))}
            </div>
            <div className="oracle-input">
              <input
                type="text"
                placeholder="type the oracle's reading..."
                value={oracleInput}
                onChange={(e) => setOracleInput(e.target.value)}
                onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const text = oracleInput.trim();
                    if (text) {
                      act("add_reading", { text });
                      setOracleInput("");
                    }
                  }
                }}
              />
              <button
                className="prowl-btn"
                onClick={() => {
                  const text = oracleInput.trim();
                  if (text) {
                    act("add_reading", { text });
                    setOracleInput("");
                  }
                }}
              >
                pin
              </button>
            </div>
            <button
              className="prowl-btn"
              onClick={() => act("advance")}
              style={{ marginTop: "1.5rem" }}
            >
              next →
            </button>
          </div>
        )}
      </div>

      {/* ── gate 3: the knock ── */}
      <div className={scClass(3, "knock")} aria-label="the knock — open the door together">
        <p className="knock-text">knock together to open the door.</p>

        <div className={`knock-door${doorOpen ? " open" : ""}`}>
          <div className="knock-handle" />
          {knockRipples.map((id) => (
            <div key={id} className="knock-ripple" />
          ))}
        </div>

        {!doorOpen && (
          <>
            <button
              className="knock-btn"
              onClick={() => {
                audio.playKnock();
                setKnockRipples((prev) => [...prev, Date.now()]);
                act("knock");
              }}
              aria-label="knock"
            >
              knock
            </button>
            {knockTimes.length > 0 && (
              <p className="knock-hint">{Math.min(knockTimes.length, 5)}/5</p>
            )}
          </>
        )}
      </div>

      {/* ── screen 4: deep deck ── */}
      <div className={scClass(4, "deepdeck")} aria-label="deep deck live">
        <div className="deepdeck-content">
          <h2 className="deepdeck-title">deep deck live</h2>
          <p className="deepdeck-rule">
            the layering rule: each person goes one layer deeper than the last.
          </p>

          <div
            className="card-flip-wrap"
            onClick={() => {
              if (deckIndex >= 0) act("flip_card");
            }}
          >
            <div
              className={`card-flip-inner${cardFlipped ? " flipped" : ""}`}
            >
              <div className="card-face card-front">
                {deckIndex < 0 ? (
                  <span style={{ opacity: 0.5 }}>pull a card to begin</span>
                ) : (
                  <span style={{ opacity: 0.5 }}>
                    card {deckIndex + 1} — click to flip
                  </span>
                )}
              </div>
              <div className="card-face card-back">
                {deckIndex >= 0 && (
                  <span className="card-back-prompt">
                    &ldquo;{DEEP_DECK_PROMPTS[deckIndex % DEEP_DECK_PROMPTS.length]}&rdquo;
                  </span>
                )}
              </div>
            </div>
          </div>

          <button className="prowl-btn" onClick={() => act("pull_card")}>
            pull a card →
          </button>
          <button
            className="prowl-btn"
            onClick={() => act("advance")}
            style={{ marginTop: "0.5rem", opacity: 0.6 }}
          >
            move on →
          </button>
        </div>
      </div>

      {/* ── gate 5: the breath ── */}
      <div className={scClass(5, "breath-gate")} aria-label="the breath — exhale together">
        <p className="breath-gate-text">
          breathe together. hold the spacebar to exhale. the flame needs all of
          you.
        </p>

        <div className="flame-wrap">
          <div className="flame-base" />
          <div
            className={`flame${spaceDown ? " exhaling" : ""}${breathGateDone ? " calm" : ""}`}
          />
        </div>

        <div className="breath-meter">
          <div
            className="breath-meter-fill"
            style={{ width: `${(breathHeld / 30000) * 100}%` }}
          />
        </div>

        <p className="breath-gate-hint">
          {breathGateDone
            ? ""
            : spaceDown
              ? "exhaling..."
              : "hold spacebar to exhale"}
        </p>
      </div>

      {/* ── screen 6: the nicasio question ── */}
      <div className={scClass(6, "nicasio")} aria-label="the nicasio question — alive">
        {NICASIO_PHOTOS.length > 0 && (
          <div className="nicasio-gallery">
            {NICASIO_PHOTOS.map((url, i) => (
              <div
                key={i}
                className={`nicasio-photo${i === nicasioPhotoIndex ? " visible" : ""}`}
                style={{ backgroundImage: `url(${url})` }}
              />
            ))}
          </div>
        )}

        <div className="nicasio-content">
          <p className={`nicasio-line${nicasioStage >= 1 ? " visible" : ""}`}>
            a year ago in nicasio valley, something happened that none of us
            could have planned.
          </p>

          <p
            className={`nicasio-line${nicasioStage >= 2 ? " visible" : ""}`}
            style={{ marginTop: "1.5rem" }}
          >
            lamis said something about alive versus thrive. jamie described why
            we hide from uncertainty. and we stumbled onto the reason
            winded.vertigo exists.
          </p>

          <p
            className={`nicasio-line nicasio-question${nicasioStage >= 3 ? " visible" : ""}`}
            style={{ marginTop: "2.5rem" }}
          >
            when was the last time you felt truly alive?
          </p>

          <p
            className={`nicasio-line nicasio-qualifier${nicasioStage >= 4 ? " visible" : ""}`}
          >
            not thriving. not productive. not impressive. just alive.
          </p>

          <p
            className={`nicasio-line nicasio-followup${nicasioStage >= 5 ? " visible" : ""}`}
          >
            and what were you doing?
          </p>
        </div>

        <button
          className={`nicasio-advance${nicasioTimer > 0 ? " visible" : ""}`}
          onClick={() => act("advance")}
          aria-label="continue"
        >
          →
        </button>
      </div>

      {/* ── gate 7: the cairn ── */}
      <div
        className={`${scClass(7, "cairn")}${cairnDone ? " bright" : ""}`}
        aria-label="the cairn — place a stone"
      >
        <p className="cairn-text">each of you, place a stone.</p>

        <div className="cairn-landscape" />

        <div className="cairn-stack">
          {stonesPlaced.map((stoneIdx, i) => (
            <svg
              key={i}
              className="cairn-stone-placed"
              width={50 - i * 4}
              height={24 - i * 2}
              viewBox="0 0 50 24"
            >
              <ellipse
                cx="25"
                cy="12"
                rx="24"
                ry="11"
                fill={STONE_COLOURS[stoneIdx]}
                stroke="rgba(0,0,0,0.1)"
                strokeWidth="0.5"
              />
            </svg>
          ))}
        </div>

        <div className="cairn-stones-source">
          {STONE_COLOURS.map((colour, i) => (
            <button
              key={i}
              className={`cairn-stone-btn${stonesPlaced.includes(i) ? " placed" : ""}`}
              onClick={() => {
                if (!stonesPlaced.includes(i)) {
                  audio.playStone();
                  act("place_stone", { index: i });
                }
              }}
              aria-label={`place stone ${i + 1}`}
            >
              <svg width={40 + i * 4} height={22 + i * 2} viewBox="0 0 50 24">
                <ellipse
                  cx="25"
                  cy="12"
                  rx="24"
                  ry="11"
                  fill={colour}
                  stroke="rgba(0,0,0,0.15)"
                  strokeWidth="0.5"
                />
              </svg>
            </button>
          ))}
        </div>

        {cairnDone && (
          <>
            <p className="cairn-question visible">
              what are you taking with you from this room?
            </p>
            <button
              className="prowl-btn"
              onClick={() => act("advance")}
              style={{
                position: "absolute",
                bottom: "8%",
                opacity: 0,
                animation: "fadeInSlow 1.5s ease 2s forwards",
              }}
            >
              drift →
            </button>
          </>
        )}
      </div>

      {/* ── screen 8: drift ── */}
      <div className={scClass(8, "drift")} aria-label="drift — the closing current">
        <Particles count={15} color="rgba(39, 50, 72, 0.15)" direction="down" />

        <div className="drift-content">
          {DRIFT_LINES.map((line, i) => (
            <p
              key={i}
              className={`drift-line${i === DRIFT_LINES.length - 1 ? " drift-emphasis" : ""}${driftStage > i ? " visible" : ""}`}
            >
              {line}
            </p>
          ))}

          <p
            className={`drift-line drift-emphasis${driftStage >= DRIFT_LINES.length ? " visible" : ""}`}
            style={{ marginTop: "2rem" }}
          >
            technology in service of return, not replacement.
          </p>

          <p
            className={`drift-question${driftStage >= DRIFT_LINES.length ? " visible" : ""}`}
          >
            what are you taking with you from this room?
          </p>

          <div
            className={`drift-input${driftStage >= DRIFT_LINES.length ? " visible" : ""}`}
          >
            <input
              type="text"
              placeholder="share something..."
              value={driftInput}
              onChange={(e) => setDriftInput(e.target.value)}
              onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const text = driftInput.trim();
                  if (text) {
                    act("add_lantern", { text });
                    setDriftInput("");
                    if (driftLanterns.length >= 4) {
                      setTimeout(() => act("trigger_final"), 3000);
                    }
                  }
                }
              }}
            />
            <button
              className="drift-btn"
              onClick={() => {
                const text = driftInput.trim();
                if (text) {
                  act("add_lantern", { text });
                  setDriftInput("");
                  if (driftLanterns.length >= 4) {
                    setTimeout(() => act("trigger_final"), 3000);
                  }
                }
              }}
            >
              release
            </button>
          </div>
        </div>

        {/* rising lanterns */}
        <div className="drift-lanterns">
          {driftLanterns.map((l) => (
            <div
              key={l.id}
              className="drift-lantern"
              style={{ left: `${l.x}%`, bottom: "-2rem" }}
            >
              {l.text}
            </div>
          ))}
        </div>

        {/* final fade */}
        <div className={`drift-final${driftFinal ? " visible" : ""}`}>
          <p className="drift-final-text">see you wednesday. no homework.</p>
          <span className="drift-final-emoji">🌀</span>
          <span className="drift-final-mark">winded.vertigo</span>
        </div>
      </div>
    </div>
  );
}
