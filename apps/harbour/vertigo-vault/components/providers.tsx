"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/harbour/vertigo-vault/api/auth">
      {children}
    </SessionProvider>
  );
}
