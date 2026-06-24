/**
 * Provider-agnostic batch text-to-speech.
 *
 * Used by the listen-library pipeline to render document text to audio files
 * (NOT real-time — that path is Vapi/Cartesia streaming). Kept provider-neutral
 * so the voice can swap from Cartesia (brand voice, ~$0.90/article) to a cheaper
 * provider (OpenAI tts ~$0.27/article) by config, without touching callers.
 *
 * No CF- or Node-specific APIs here — safe to import in any runtime.
 */

export interface TtsResult {
  /** Raw audio bytes for one synthesis call. */
  audio: Uint8Array;
  /** MIME type of the audio (e.g. "audio/mpeg"). */
  contentType: string;
  /** File extension without the dot (e.g. "mp3"). */
  ext: string;
  /** Characters synthesised — for cost accounting. */
  charCount: number;
}

export interface TtsProvider {
  /** Stable provider id, stored on listen_items.voice for provenance. */
  readonly id: string;
  /** Synthesise one chunk of text to audio bytes. Throws on a provider error. */
  synthesize(text: string, opts?: { voiceId?: string }): Promise<TtsResult>;
}
