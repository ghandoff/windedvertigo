"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export default function AuthSessionProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider basePath="/harbour/time-prism/api/auth">
      {children}
    </SessionProvider>
  );
}
