"use client";

/**
 * /m/listen — "Carl's Reading Booth".
 *
 * The playful consumption surface for the listen library: feed Carl a Google
 * Doc, an article URL, or a file, and he reads it back in his own voice for
 * walks/rides. Audio is pre-rendered into chunks (server-side, Cartesia TTS) and
 * played here as a seamless sequential playlist. Carl is an animated character
 * who mouths along while reading; controls stay simple (play/pause, scrub by
 * chunk, turtle→hare speed). Resume position is remembered per item.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "queued" | "rendering" | "ready" | "failed";
interface Item {
  id: string;
  title: string;
  status: Status;
  est_minutes: number | null;
  chunk_count: number | null;
  source_type: string;
  clean_level: string;
  error: string | null;
  created_at: string;
  char_count: number | null;
}
interface Chunk { idx: number; url: string }

/** Rough render-time estimate (seconds) from the extracted character count —
 *  calibrated on observed renders (~600 raw chars/sec incl. queue pickup). */
function etaSeconds(item: Item): number {
  return Math.max(10, Math.round((item.char_count ?? 4000) / 600));
}

const SPEEDS = [
  { rate: 0.8, label: "🐢", name: "amble" },
  { rate: 1.0, label: "🚶", name: "stroll" },
  { rate: 1.25, label: "🏃", name: "brisk" },
  { rate: 1.5, label: "🐇", name: "bolt" },
];

const STATUS_COPY: Record<Status, string> = {
  queued: "in Carl's stack",
  rendering: "Carl's warming up his voice…",
  ready: "ready when you are",
  failed: "Carl fumbled this one",
};

export default function ReadingBoothPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [cleanLevel, setCleanLevel] = useState<"clean" | "faithful">("clean");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── player state ─────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null);
  const wantPlay = useRef(false); // intent: play the current chunk once it can
  const [active, setActive] = useState<Item | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [chunkIdx, setChunkIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [frac, setFrac] = useState(0); // 0..1 within current chunk
  const [playErr, setPlayErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now()); // ticks for live ETA countdown
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/listen");
      if (!res.ok) return;
      const data = (await res.json()) as { items: Item[] };
      setItems(data.items);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const cooking = items.some((i) => i.status === "queued" || i.status === "rendering");

  // poll while anything is still cooking
  useEffect(() => {
    if (!cooking) return;
    const t = setInterval(fetchItems, 4000);
    return () => clearInterval(t);
  }, [cooking, fetchItems]);

  // 1s tick for the live "~Ns left" countdown while items render
  useEffect(() => {
    if (!cooking) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooking]);

  const deleteItem = useCallback(async (it: Item) => {
    if (deleting) return;
    setDeleting(it.id);
    if (active?.id === it.id) { wantPlay.current = false; audioRef.current?.pause(); setActive(null); }
    setItems((prev) => prev.filter((p) => p.id !== it.id)); // optimistic
    try {
      await fetch(`/api/listen/${it.id}`, { method: "DELETE" });
    } catch {
      fetchItems(); // restore on failure
    } finally {
      setDeleting(null);
    }
  }, [deleting, active, fetchItems]);

  // ── submit ────────────────────────────────────────────────────────────────
  const submitUrl = useCallback(async () => {
    const url = input.trim();
    if (!url) return;
    setSubmitting(true); setErr(null);
    const sourceType = /docs\.google\.com\/document/.test(url) ? "google-doc" : "url";
    try {
      const res = await fetch("/api/listen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, url, cleanLevel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "couldn't hand that to Carl");
      setInput("");
      fetchItems();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "something went sideways");
    } finally {
      setSubmitting(false);
    }
  }, [input, cleanLevel, fetchItems]);

  const submitFile = useCallback(async (file: File) => {
    setSubmitting(true); setErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("cleanLevel", cleanLevel);
      const res = await fetch("/api/listen", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "couldn't read that file");
      fetchItems();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "something went sideways");
    } finally {
      setSubmitting(false);
    }
  }, [cleanLevel, fetchItems]);

  // ── playback engine ─────────────────────────────────────────────────────--
  // Playback is event-driven: we set `wantPlay` intent + the current chunk, and
  // the <audio onCanPlay> handler starts it once the media is ready. Avoids the
  // race of calling play() before the new src has loaded, and surfaces errors.
  const tryPlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.play().catch((e) => setPlayErr(e?.message ? `couldn't play — ${e.message}` : "couldn't play this audio"));
  }, []);

  const openItem = useCallback(async (item: Item) => {
    if (item.status !== "ready") return;
    setPlayErr(null);
    setActive(item);
    setPlaying(false);
    try {
      const res = await fetch(`/api/listen/${item.id}`);
      const data = (await res.json()) as { chunks: Chunk[] };
      if (!data.chunks?.length) { setPlayErr("no audio found for this one"); return; }
      setChunks(data.chunks);
      const saved = Number(localStorage.getItem(`listen-pos-${item.id}`) || 0);
      setChunkIdx(saved < data.chunks.length ? saved : 0);
      setFrac(0);
      wantPlay.current = true; // onCanPlay will start it
    } catch {
      setPlayErr("couldn't load this item");
    }
  }, []);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setPlayErr(null);
    if (a.paused) { wantPlay.current = true; tryPlay(); }
    else { wantPlay.current = false; a.pause(); }
  }, [tryPlay]);

  const onEnded = useCallback(() => {
    if (!active) return;
    if (chunkIdx + 1 < chunks.length) {
      const next = chunkIdx + 1;
      wantPlay.current = true; // new src → onCanPlay plays it
      setChunkIdx(next);
      setFrac(0);
      localStorage.setItem(`listen-pos-${active.id}`, String(next));
    } else {
      wantPlay.current = false;
      setPlaying(false);
      localStorage.removeItem(`listen-pos-${active.id}`); // finished → reset
      setChunkIdx(0);
      setFrac(0);
    }
  }, [active, chunkIdx, chunks.length]);

  const jump = useCallback((delta: number) => {
    if (!active) return;
    const next = Math.max(0, Math.min(chunks.length - 1, chunkIdx + delta));
    wantPlay.current = true;
    setChunkIdx(next);
    setFrac(0);
    localStorage.setItem(`listen-pos-${active.id}`, String(next));
  }, [active, chunkIdx, chunks.length]);

  // keep playbackRate synced
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = rate; }, [rate, chunkIdx]);

  // pre-buffer the next chunk while the current one plays, so the boundary swap
  // is near-instant instead of a ~100–300ms silence at each chunk transition.
  useEffect(() => {
    const next = chunks[chunkIdx + 1];
    if (!next) return;
    const pre = new Audio();
    pre.preload = "auto";
    pre.src = next.url;
    pre.load();
    return () => { pre.src = ""; };
  }, [chunkIdx, chunks]);

  const overall = chunks.length ? (chunkIdx + frac) / chunks.length : 0;

  return (
    <div className="booth">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{BOOTH_CSS}</style>

      <header className="booth-head">
        <h1>carl&apos;s reading booth</h1>
        <p>hand him something. he&apos;ll read it to you on your walk.</p>
      </header>

      {/* ── feed Carl ─────────────────────────────────────────────── */}
      <section className="feeder">
        <input
          className="feed-input"
          placeholder="paste a google doc or article link…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submitUrl(); }}
          disabled={submitting}
        />
        <div className="feed-row">
          <button className="feed-go" onClick={submitUrl} disabled={submitting || !input.trim()}>
            {submitting ? "handing it over…" : "→ hand to carl"}
          </button>
          <button className="feed-file" onClick={() => fileRef.current?.click()} disabled={submitting}>
            📎 file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) submitFile(f); e.target.value = ""; }}
          />
        </div>
        <label className="skip-toggle">
          <input
            type="checkbox"
            checked={cleanLevel === "clean"}
            onChange={(e) => setCleanLevel(e.target.checked ? "clean" : "faithful")}
          />
          <span>skip the citations &amp; footnotes (recommended for articles)</span>
        </label>
        {err && <p className="feed-err">⚠ {err}</p>}
      </section>

      {/* ── Carl the reader ───────────────────────────────────────── */}
      {active && (
        <section className={`stage ${playing ? "is-reading" : ""}`}>
          <div className="carl" aria-hidden>
            <div className="carl-glow" />
            <div className="carl-face">
              <span className="eye left" />
              <span className="eye right" />
              <span className="mouth" />
            </div>
          </div>
          <div className="now">
            <div className="now-title">{active.title}</div>
            <div className="now-sub">
              {playing ? "reading aloud" : "paused"} · part {Math.min(chunkIdx + 1, chunks.length)} of {chunks.length || "…"}
            </div>
          </div>

          <div className="track"><div className="track-fill" style={{ width: `${overall * 100}%` }} /></div>

          <div className="controls">
            <button className="ctl" onClick={() => jump(-1)} disabled={chunkIdx === 0} aria-label="back">↺</button>
            <button className="ctl play" onClick={togglePlay} aria-label={playing ? "pause" : "play"}>
              {playing ? "❚❚" : "▶"}
            </button>
            <button className="ctl" onClick={() => jump(1)} disabled={chunkIdx >= chunks.length - 1} aria-label="forward">↻</button>
          </div>

          <div className="speeds">
            {SPEEDS.map((s) => (
              <button
                key={s.rate}
                className={`speed ${rate === s.rate ? "on" : ""}`}
                onClick={() => setRate(s.rate)}
                title={s.name}
              >
                {s.label}
              </button>
            ))}
          </div>

          {playErr && <p className="feed-err" style={{ textAlign: "center" }}>⚠ {playErr}</p>}

          <audio
            ref={audioRef}
            src={chunks[chunkIdx]?.url}
            preload="auto"
            onCanPlay={() => { if (wantPlay.current) tryPlay(); }}
            onPlay={() => { setPlaying(true); setPlayErr(null); }}
            onPause={() => setPlaying(false)}
            onEnded={onEnded}
            onError={() => { if (chunks[chunkIdx]) setPlayErr("audio didn't load — tap play to retry"); }}
            onTimeUpdate={(e) => {
              const a = e.currentTarget;
              if (a.duration) setFrac(a.currentTime / a.duration);
            }}
          />
          <button className="close-stage" onClick={() => { wantPlay.current = false; audioRef.current?.pause(); setActive(null); }}>
            tuck carl away
          </button>
        </section>
      )}

      {/* ── the stack ─────────────────────────────────────────────── */}
      <section className="stack">
        <h2>carl&apos;s stack</h2>
        {!loaded && <p className="muted">opening the booth…</p>}
        {loaded && items.length === 0 && (
          <p className="muted">empty. hand carl his first read above. 📚</p>
        )}
        {items.map((it) => {
          const processing = it.status === "queued" || it.status === "rendering";
          const eta = etaSeconds(it);
          const elapsed = Math.max(0, (now - new Date(it.created_at).getTime()) / 1000);
          const remaining = Math.max(0, Math.round(eta - elapsed));
          const pct = Math.min(96, Math.round((elapsed / eta) * 100));
          return (
            <div key={it.id} className={`card ${it.status} ${active?.id === it.id ? "active" : ""}`}>
              <button
                className="card-hit"
                onClick={() => openItem(it)}
                disabled={it.status !== "ready"}
              >
                <div className="card-main">
                  <div className="card-title">{it.title}</div>
                  <div className="card-sub">
                    {processing
                      ? (remaining > 0
                          ? `${it.status === "queued" ? "queued" : "reading it aloud"} · ~${remaining}s left`
                          : "almost ready…")
                      : STATUS_COPY[it.status]}
                    {it.status === "ready" && it.est_minutes ? ` · ~${it.est_minutes} min listen` : ""}
                    {it.status === "failed" && it.error ? ` · ${it.error}` : ""}
                  </div>
                  {processing && (
                    <div className="card-prog"><div className="card-prog-fill" style={{ width: `${pct}%` }} /></div>
                  )}
                </div>
                <div className="card-badge">
                  {it.status === "ready" && "▶"}
                  {it.status === "rendering" && <span className="spin">◔</span>}
                  {it.status === "queued" && "⏳"}
                  {it.status === "failed" && "↻"}
                </div>
              </button>
              <button
                className="card-del"
                onClick={() => deleteItem(it)}
                disabled={deleting === it.id}
                aria-label={`delete ${it.title}`}
                title="delete"
              >
                {deleting === it.id ? "…" : "🗑"}
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}

const BOOTH_CSS = `
.booth {
  --ink: #1b1230; --ink2: #2a1c46; --cream: #fff4e0; --amber: #ffb347;
  --tomato: #ff6b5e; --teal: #5ee7c7; --muted: #c4b3e6;
  font-family: "Fredoka", ui-rounded, "Segoe UI", system-ui, sans-serif;
  margin: -1rem -1rem 0; padding: 1.1rem 1.1rem 2rem; min-height: 100%;
  color: var(--cream);
  background:
    radial-gradient(120% 80% at 50% -10%, #3a2566 0%, var(--ink2) 40%, var(--ink) 100%);
}
.booth-head h1 { font-size: 1.55rem; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
.booth-head p { margin: .15rem 0 1rem; color: var(--muted); font-size: .82rem; }

.feeder { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.09);
  border-radius: 18px; padding: .8rem; box-shadow: 0 10px 30px -18px #000; }
.feed-input { width: 100%; box-sizing: border-box; background: rgba(0,0,0,.28);
  border: 1px solid rgba(255,255,255,.12); color: var(--cream); border-radius: 12px;
  padding: .7rem .8rem; font: inherit; font-size: .9rem; outline: none; }
.feed-input:focus { border-color: var(--amber); }
.feed-input::placeholder { color: #9784bf; }
.feed-row { display: flex; gap: .5rem; margin-top: .55rem; }
.feed-go { flex: 1; background: linear-gradient(180deg, var(--amber), #f59428); color: #3a1c00;
  font: inherit; font-weight: 700; border: 0; border-radius: 12px; padding: .7rem; cursor: pointer;
  box-shadow: 0 6px 0 #b96d12; transition: transform .08s, box-shadow .08s; }
.feed-go:active:not(:disabled) { transform: translateY(4px); box-shadow: 0 2px 0 #b96d12; }
.feed-go:disabled { opacity: .55; box-shadow: 0 6px 0 #7a5535; }
.feed-file { background: rgba(255,255,255,.1); color: var(--cream); border: 0; border-radius: 12px;
  padding: .7rem .85rem; font: inherit; font-weight: 600; cursor: pointer; }
.skip-toggle { display: flex; align-items: center; gap: .5rem; margin-top: .65rem;
  font-size: .76rem; color: var(--muted); cursor: pointer; }
.skip-toggle input { accent-color: var(--teal); width: 16px; height: 16px; }
.feed-err { color: var(--tomato); font-size: .8rem; margin: .6rem 0 0; }

/* ── stage ── */
.stage { margin-top: 1.1rem; text-align: center; background: rgba(0,0,0,.22);
  border: 1px solid rgba(255,255,255,.08); border-radius: 22px; padding: 1.2rem 1rem 1rem; }
.carl { position: relative; width: 116px; height: 116px; margin: .2rem auto .6rem; }
.carl-glow { position: absolute; inset: -14px; border-radius: 50%;
  background: radial-gradient(circle, var(--amber) 0%, transparent 68%); opacity: .35;
  transition: opacity .3s; }
.is-reading .carl-glow { animation: pulse 1.3s ease-in-out infinite; opacity: .6; }
@keyframes pulse { 0%,100% { transform: scale(1); opacity: .4 } 50% { transform: scale(1.12); opacity: .75 } }
.carl-face { position: absolute; inset: 0; border-radius: 46% 46% 50% 50%;
  background: linear-gradient(160deg, #ffe8c2, #ffcf94); box-shadow: inset 0 -10px 18px #d99a4f55, 0 8px 22px -8px #000;
  animation: bob 3.4s ease-in-out infinite; }
@keyframes bob { 0%,100% { transform: translateY(0) rotate(-1.5deg) } 50% { transform: translateY(-5px) rotate(1.5deg) } }
.eye { position: absolute; top: 42px; width: 13px; height: 13px; background: #3a2317; border-radius: 50%; }
.eye.left { left: 34px; } .eye.right { right: 34px; }
.is-reading .eye { animation: blink 4s infinite; }
@keyframes blink { 0%,94%,100% { transform: scaleY(1) } 97% { transform: scaleY(.1) } }
.mouth { position: absolute; left: 50%; bottom: 28px; width: 26px; height: 8px; transform: translateX(-50%);
  background: #6b2b1e; border-radius: 0 0 16px 16px; transition: height .1s; }
.is-reading .mouth { animation: talk .28s ease-in-out infinite; }
@keyframes talk { 0%,100% { height: 6px } 50% { height: 18px } }

.now-title { font-weight: 600; font-size: 1rem; line-height: 1.2; }
.now-sub { color: var(--muted); font-size: .76rem; margin-top: .15rem; }
.track { height: 8px; background: rgba(255,255,255,.12); border-radius: 99px; margin: .9rem .2rem .9rem; overflow: hidden; }
.track-fill { height: 100%; background: linear-gradient(90deg, var(--teal), var(--amber)); border-radius: 99px; transition: width .25s linear; }
.controls { display: flex; align-items: center; justify-content: center; gap: 1.1rem; }
.ctl { background: rgba(255,255,255,.1); color: var(--cream); border: 0; width: 48px; height: 48px;
  border-radius: 50%; font-size: 1.1rem; cursor: pointer; }
.ctl:disabled { opacity: .35; }
.ctl.play { width: 70px; height: 70px; font-size: 1.5rem; color: #3a1c00;
  background: radial-gradient(circle at 38% 32%, #ffe0a3, var(--amber)); box-shadow: 0 8px 0 #b96d12; }
.ctl.play:active { transform: translateY(4px); box-shadow: 0 4px 0 #b96d12; }
.speeds { display: flex; justify-content: center; gap: .5rem; margin-top: 1rem; }
.speed { background: rgba(255,255,255,.08); border: 1px solid transparent; border-radius: 12px;
  font-size: 1.05rem; padding: .35rem .6rem; cursor: pointer; filter: grayscale(.5) opacity(.7); }
.speed.on { background: rgba(94,231,199,.18); border-color: var(--teal); filter: none; }
.close-stage { margin-top: 1rem; background: none; border: 0; color: var(--muted);
  font: inherit; font-size: .78rem; text-decoration: underline; cursor: pointer; }

/* ── stack ── */
.stack { margin-top: 1.4rem; }
.stack h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .12em; color: var(--muted); margin: 0 0 .6rem; }
.muted { color: var(--muted); font-size: .85rem; }
.card { display: flex; align-items: stretch; width: 100%; overflow: hidden;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); border-radius: 14px;
  margin-bottom: .55rem; color: var(--cream);
  transition: transform .08s, border-color .15s; }
.card.ready { border-left: 3px solid var(--teal); }
.card.rendering { border-left: 3px solid var(--amber); }
.card.queued { border-left: 3px solid #8a76c0; }
.card.failed { border-left: 3px solid var(--tomato); }
.card.active { border-color: var(--amber); background: rgba(255,179,71,.1); }
.card-hit { flex: 1; min-width: 0; display: flex; align-items: center; gap: .7rem;
  text-align: left; background: none; border: 0; color: inherit; font: inherit;
  padding: .75rem .85rem; cursor: pointer; }
.card-hit:active:not(:disabled) { transform: scale(.985); }
.card-hit:disabled { cursor: default; }
.card-del { flex-shrink: 0; background: none; border: 0; border-left: 1px solid rgba(255,255,255,.08);
  color: var(--muted); padding: 0 .85rem; font-size: 1rem; cursor: pointer; transition: color .15s, background .15s; }
.card-del:hover:not(:disabled) { color: var(--tomato); background: rgba(255,107,94,.08); }
.card-del:disabled { opacity: .5; cursor: default; }
.card-prog { height: 5px; background: rgba(255,255,255,.12); border-radius: 99px; margin-top: .45rem; overflow: hidden; }
.card-prog-fill { height: 100%; background: linear-gradient(90deg, var(--amber), var(--teal)); border-radius: 99px; transition: width .8s linear; }
.card-main { flex: 1; min-width: 0; }
.card-title { font-weight: 600; font-size: .92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-sub { color: var(--muted); font-size: .74rem; margin-top: .1rem; }
.card-badge { font-size: 1.1rem; flex-shrink: 0; }
.spin { display: inline-block; animation: spin 1.4s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }
`;
