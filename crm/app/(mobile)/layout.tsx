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
        <span className="text-sm font-semibold tracking-tight">w.v CRM</span>
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
