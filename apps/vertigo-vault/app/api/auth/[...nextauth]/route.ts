/**
 * NextAuth catch-all API route for vertigo-vault.
 *
 * Uses the handlers export from NextAuth() which correctly handles
 * the basePath configuration. The older pattern of importing Auth()
 * directly from @auth/core causes dual-package type conflicts when
 * next-auth bundles its own copy of @auth/core.
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
