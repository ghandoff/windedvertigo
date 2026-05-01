import { createAuthRouteHandler } from "@windedvertigo/auth/route-handler";
import { authConfig } from "@/lib/auth";

const { GET, POST } = createAuthRouteHandler("code-weave", authConfig);
export { GET, POST };
