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

export type { TtsProvider, TtsResult } from "./types";
export { createCartesiaProvider, CARL_VOICE_ID } from "./cartesia";

export function getTtsProvider(opts: {
  provider?: string;
  cartesiaApiKey?: string;
  voiceId?: string;
}): TtsProvider {
  const provider = opts.provider ?? "cartesia";

  if (provider === "cartesia") {
    if (!opts.cartesiaApiKey) {
      throw new Error("CARTESIA_API_KEY is required for the cartesia TTS provider");
    }
    return createCartesiaProvider(opts.cartesiaApiKey, { voiceId: opts.voiceId });
  }

  // future: case "openai" → createOpenAiProvider(opts.openAiApiKey)
  throw new Error(`unknown TTS provider: ${provider}`);
}
