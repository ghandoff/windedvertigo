import { createAuthRouteHandler } from "@windedvertigo/auth/route-handler";
import { authConfig } from "@/lib/auth";

const { GET, POST } = createAuthRouteHandler("vertigo-vault", authConfig);
export { GET, POST };
