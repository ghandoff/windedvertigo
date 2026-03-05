"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/harbor/vertigo-vault/api/auth">
      {children}
    </SessionProvider>
  );
}
