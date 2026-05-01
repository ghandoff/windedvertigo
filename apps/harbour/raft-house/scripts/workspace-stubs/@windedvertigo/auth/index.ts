export { createHarbourAuth } from "./config";
export { createAuthRouteHandler } from "./route-handler";
export { harbourAdapter } from "./adapter";
export { harbourCookies } from "./cookies";
export type {
  HarbourSession,
  HarbourToken,
  HarbourAuthOptions,
  EnrichTokenResult,
} from "./types";

// Re-export the type augmentations so consuming apps get typed sessions
// by importing "@windedvertigo/auth/types" in their tsconfig
import "./types";
