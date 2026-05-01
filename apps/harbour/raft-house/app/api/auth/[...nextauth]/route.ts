import { createAuthRouteHandler } from "@windedvertigo/auth/route-handler";
import { authConfig } from "@/lib/auth";

const { GET, POST } = createAuthRouteHandler("raft-house", authConfig);
export { GET, POST };
