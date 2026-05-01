"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const ROWS = ["kick", "snare", "hi-hat", "clap"] as const;
const COLS = 4;

function createKick(ctx: AudioContext, time: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(100, time);
  osc.frequency.exponentialRampToValueAtTime(50, time + 0.1);
  gain.gain.setValueAtTime(1, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.3);
}

function createSnare(ctx: AudioContext, time: number) {
  // noise burst
  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.8, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  noise.connect(noiseGain).connect(ctx.destination);
  noise.start(time);
  // tone
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 200;
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.5, time);
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
  osc.connect(oscGain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.1);
}

function createHiHat(ctx: AudioContext, time: number) {
  const bufferSize = ctx.sampleRate * 0.05;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 8000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(time);
}

function createClap(ctx: AudioContext, time: number) {
  const bufferSize = ctx.sampleRate * 0.08;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2000;
  filter.Q.value = 1;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.7, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(time);
}

const SOUND_FNS = { kick: createKick, snare: createSnare, "hi-hat": createHiHat, clap: createClap };

export default function BeatGrid() {
  const [grid, setGrid] = useState<boolean[][]>(() =>
    ROWS.map(() => Array(COLS).fill(false))
  );
  const [playing, setPlaying] = useState(false);
  const [activeCol, setActiveCol] = useState(-1);
  const [tempo, setTempo] = useState(120);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const colRef = useRef(0);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const toggle = (row: number, col: number) => {
    setGrid((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = !next[row][col];
      return next;
    });
  };

  const gridRef = useRef(grid);
  useEffect(() => { gridRef.current = grid; }, [grid]);

  const tempoRef = useRef(tempo);
  useEffect(() => { tempoRef.current = tempo; }, [tempo]);

  const playingRef = useRef(playing);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  const step = useCallback(() => {
    const ctx = getCtx();
    const col = colRef.current;
    setActiveCol(col);
    const currentGrid = gridRef.current;
    ROWS.forEach((name, rowIdx) => {
      if (currentGrid[rowIdx][col]) {
        SOUND_FNS[name](ctx, ctx.currentTime);
      }
    });
    colRef.current = (col + 1) % COLS;
  }, [getCtx]);

  const startPlayback = useCallback(() => {
    colRef.current = 0;
    setPlaying(true);
    step();
    const tick = () => {
      if (!playingRef.current) return;
      const ms = (60 / tempoRef.current) * 1000;
      timerRef.current = window.setTimeout(() => {
        step();
        tick();
      }, ms);
    };
    const ms = (60 / tempoRef.current) * 1000;
    timerRef.current = window.setTimeout(() => {
      tick();
    }, ms);
  }, [step]);

  const stopPlayback = useCallback(() => {
    setPlaying(false);
    setActiveCol(-1);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div>
      {/* grid */}
      <div className="space-y-2 mb-6">
        {ROWS.map((name, rowIdx) => (
          <div key={name} className="flex items-center gap-2">
            <span className="w-14 text-xs text-[var(--color-text-on-dark-muted)] shrink-0">{name}</span>
            <div className="flex gap-2 flex-1">
              {Array.from({ length: COLS }).map((_, colIdx) => (
                <button
                  key={colIdx}
                  aria-label={`${name} beat ${colIdx + 1} ${grid[rowIdx][colIdx] ? "on" : "off"}`}
                  onClick={() => toggle(rowIdx, colIdx)}
                  className="flex-1 aspect-square rounded-lg transition-all duration-100 border"
                  style={{
                    background: grid[rowIdx][colIdx]
                      ? "var(--wv-champagne)"
                      : "var(--color-surface-raised)",
                    borderColor: activeCol === colIdx
                      ? "var(--wv-sienna)"
                      : "rgba(255,255,255,0.1)",
                    boxShadow: activeCol === colIdx
                      ? "0 0 12px var(--wv-sienna)"
                      : "none",
                    color: grid[rowIdx][colIdx] ? "var(--wv-cadet)" : "inherit",
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* controls */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button
          onClick={playing ? stopPlayback : startPlayback}
          className="px-6 py-2 rounded-lg font-semibold text-sm transition-colors"
          style={{
            background: playing ? "var(--wv-redwood)" : "var(--wv-sienna)",
            color: "var(--wv-champagne)",
          }}
        >
          {playing ? "stop" : "play"}
        </button>

        <div className="flex items-center gap-3 flex-1">
          <label htmlFor="tempo" className="text-xs text-[var(--color-text-on-dark-muted)]">
            tempo
          </label>
          <input
            id="tempo"
            type="range"
            min={80}
            max={160}
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
            className="flex-1 accent-[var(--wv-sienna)]"
          />
          <span className="text-xs text-[var(--color-text-on-dark-muted)] w-12 text-right">
            {tempo} BPM
          </span>
        </div>
      </div>
    </div>
  );
}
