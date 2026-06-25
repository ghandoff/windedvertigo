/**
 * Cloudflare Workers AI batch TTS providers — on our own stack, no API key.
 *
 * Two engines, both via the `AI` binding:
 *  - MeloTTS (@cf/myshell-ai/melotts) — $0.0002/audio-min, returns base64 MP3.
 *    Cheapest by far; clear but more robotic.
 *  - Deepgram Aura-1 (@cf/deepgram/aura-1) — $0.015/1k chars, 12 natural named
 *    voices, returns a ReadableStream (MPEG). Used as Carl's reading voice.
 *
 * Both removes Cartesia's per-credit cap. Cartesia stays for live phone calls.
 */

import type { TtsProvider, TtsResult } from "./types";

/** Duck-typed Workers AI binding (avoids a @cloudflare/workers-types dependency). */
export interface WorkersAi {
  run(model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
}

const MELOTTS_MODEL = "@cf/myshell-ai/melotts";
const AURA_MODEL = "@cf/deepgram/aura-1";

/** Carl's reading voice on Aura — a warm male speaker. */
export const CARL_READING_SPEAKER = "arcas";

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function createCloudflareMeloTtsProvider(ai: WorkersAi): TtsProvider {
  return {
    id: "cloudflare-melotts",
    async synthesize(text: string): Promise<TtsResult> {
      const res = (await ai.run(MELOTTS_MODEL, { prompt: text, lang: "en" })) as { audio?: string };
      if (!res?.audio) throw new Error("melotts returned no audio");
      return { audio: base64ToBytes(res.audio), contentType: "audio/mpeg", ext: "mp3", charCount: text.length };
    },
  };
}

export function createCloudflareAuraProvider(ai: WorkersAi, opts?: { speaker?: string }): TtsProvider {
  const speaker = opts?.speaker ?? CARL_READING_SPEAKER;
  return {
    id: "cloudflare-aura",
    async synthesize(text: string): Promise<TtsResult> {
      // returnRawResponse → a standard Response carrying the MPEG audio stream.
      const resp = (await ai.run(
        AURA_MODEL,
        { text, speaker, encoding: "mp3" },
        { returnRawResponse: true },
      )) as Response;
      const audio = new Uint8Array(await resp.arrayBuffer());
      if (!audio.length) throw new Error("aura returned no audio");
      return { audio, contentType: "audio/mpeg", ext: "mp3", charCount: text.length };
    },
  };
}
