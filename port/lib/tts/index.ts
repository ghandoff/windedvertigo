/**
 * TTS provider selection.
 *
 * Pass the api key explicitly so this works both on the port (process.env) and
 * in the port-jobs queue consumer (where secrets arrive via the handler `env`
 * arg, not process.env). Provider defaults to cartesia; set TTS_PROVIDER to
 * switch once another impl (e.g. openai) is added.
 */

import type { TtsProvider } from "./types";
import { createCartesiaProvider } from "./cartesia";
import {
  createCloudflareMeloTtsProvider,
  createCloudflareAuraProvider,
  type WorkersAi,
} from "./cloudflare";

export type { TtsProvider, TtsResult } from "./types";
export type { WorkersAi } from "./cloudflare";
export { createCartesiaProvider, CARL_VOICE_ID } from "./cartesia";
export { AURA_SPEAKERS, CARL_READING_SPEAKER, resolveAuraSpeaker } from "./cloudflare";

/** Default engine for the listen library — overridable via LISTEN_TTS_PROVIDER. */
export const DEFAULT_LISTEN_PROVIDER = "cloudflare-aura";

export function getTtsProvider(opts: {
  provider?: string;
  cartesiaApiKey?: string;
  voiceId?: string;
  ai?: WorkersAi;
  speaker?: string;
}): TtsProvider {
  const provider = opts.provider ?? "cartesia";

  if (provider === "cloudflare-aura") {
    if (!opts.ai) throw new Error("Workers AI binding required for cloudflare-aura");
    return createCloudflareAuraProvider(opts.ai, { speaker: opts.speaker });
  }

  if (provider === "cloudflare-melotts") {
    if (!opts.ai) throw new Error("Workers AI binding required for cloudflare-melotts");
    return createCloudflareMeloTtsProvider(opts.ai);
  }

  if (provider === "cartesia") {
    if (!opts.cartesiaApiKey) {
      throw new Error("CARTESIA_API_KEY is required for the cartesia TTS provider");
    }
    return createCartesiaProvider(opts.cartesiaApiKey, { voiceId: opts.voiceId });
  }

  throw new Error(`unknown TTS provider: ${provider}`);
}
