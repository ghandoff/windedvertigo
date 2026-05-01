import { createAuthRouteHandler } from "@windedvertigo/auth/route-handler";
import { authConfig } from "@/lib/auth";

// Empty appName matches `lib/auth.ts` — the hub mounts at /harbour, not
// /harbour/<sub>. The shared route handler treats empty appName as
// basePath = "/harbour" (no trailing sub-path).
const { GET, POST } = createAuthRouteHandler("", authConfig);
export { GET, POST };
