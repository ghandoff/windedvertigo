import { MobileTabBar } from "@/app/components/mobile-tab-bar";
import { SyncIndicator } from "@/app/components/sync-indicator";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-border bg-background sticky top-0 z-40">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/crm/images/wordmark.png"
            alt="winded vertigo"
            width={80}
            height={42}
          />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CRM</span>
        </div>
        <SyncIndicator />
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 pb-20">
        {children}
      </main>

      {/* Bottom tabs */}
      <MobileTabBar />
    </div>
  );
}
