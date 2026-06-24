/**
 * Cartesia batch TTS provider — POST https://api.cartesia.ai/tts/bytes.
 *
 * Returns audio bytes for one chunk of text. This is the brand-voice path:
 * Carl reads in his own Cartesia voice (Adrian, the same voiceId his live calls
 * use). The real-time call path goes through Vapi; this is a separate, direct
 * Cartesia HTTP call so we can render files offline.
 *
 * Requires a CARTESIA_API_KEY (an `sk_car_...` key) — today the Cartesia key
 * lives only inside Vapi, so this needs its own secret on the port + port-jobs
 * workers. The key is passed in explicitly (callers read it from process.env on
 * the port, or from the queue handler's `env` arg in port-jobs).
 */

import type { TtsProvider, TtsResult } from "./types";

const CARTESIA_TTS_URL = "https://api.cartesia.ai/tts/bytes";
const CARTESIA_VERSION = "2026-03-01";
const MODEL_ID = "sonic-3.5";

/** Carl's voice — "Adrian", the same id his Vapi assistant uses. */
export const CARL_VOICE_ID = "e2d48e7b-cd73-4c4c-bc1e-f232580e8709";

export function createCartesiaProvider(
  apiKey: string,
  opts?: { voiceId?: string },
): TtsProvider {
  const defaultVoiceId = opts?.voiceId ?? CARL_VOICE_ID;

  return {
    id: "cartesia",
    async synthesize(text: string, callOpts): Promise<TtsResult> {
      const res = await fetch(CARTESIA_TTS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Cartesia-Version": CARTESIA_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_id: MODEL_ID,
          transcript: text,
          voice: { mode: "id", id: callOpts?.voiceId ?? defaultVoiceId },
          // mp3 keeps files small for mobile playback. bit_rate is bits/sec
          // (128 kbps); sample_rate 44.1kHz. If Cartesia rejects these, the
          // 400 body will say so — easy to tune.
          output_format: { container: "mp3", sample_rate: 44100, bit_rate: 128000 },
          language: "en",
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`cartesia tts ${res.status}: ${body.slice(0, 300)}`);
      }

      const audio = new Uint8Array(await res.arrayBuffer());
      return { audio, contentType: "audio/mpeg", ext: "mp3", charCount: text.length };
    },
  };
}
