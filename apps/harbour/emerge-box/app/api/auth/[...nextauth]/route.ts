import { createAuthRouteHandler } from "@windedvertigo/auth/route-handler";
import { authConfig } from "@/lib/auth";

const { GET, POST } = createAuthRouteHandler("emerge-box", authConfig);
export { GET, POST };
