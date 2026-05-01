import { createAuthRouteHandler } from "@windedvertigo/auth/route-handler";
import { authConfig } from "@/lib/auth";

const { GET, POST } = createAuthRouteHandler("proof-garden", authConfig);
export { GET, POST };
