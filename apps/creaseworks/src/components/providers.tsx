"use client";

import { SessionProvider } from "next-auth/react";
import PwaInstall from "@/components/pwa-install";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/reservoir/creaseworks/api/auth">
      {children}
      <PwaInstall />
    </SessionProvider>
  );
}
