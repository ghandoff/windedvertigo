import { redirect } from "next/navigation";
import { Sidebar } from "@/app/components/sidebar";
import { MobileSidebar } from "@/app/components/mobile-sidebar";
import { AiSearchBar } from "@/app/components/ai-search-bar";
import { UserProvider } from "@/app/components/user-provider";
import { FeedbackWidget } from "@/app/components/feedback-widget";
import { TimerProvider } from "@/app/components/timer-context";
import { TopBarTools } from "@/app/components/top-bar-tools";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirect unauthenticated users to login
  if (!session?.user) {
    redirect("/login");
  }
  const userInfo = session?.user ? {
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    firstName:
      (session as unknown as Record<string, unknown>).firstName as string ??
      session.user.name?.split(" ")[0]?.toLowerCase() ??
      session.user.email?.split("@")[0] ??
      "",
  } : null;

  return (
    <UserProvider user={userInfo}>
      <TimerProvider>
        <div className="min-h-screen">
          <Sidebar />
          <MobileSidebar />
          <main className="md:pl-60">
            {/* Desktop header: AI search + tools, right-aligned */}
            <div className="hidden md:flex items-center justify-end gap-3 px-8 pt-4 pb-0">
              <AiSearchBar />
              <TopBarTools />
            </div>
            {/* Mobile header: compact tools only, right-aligned below MobileSidebar */}
            <div className="md:hidden flex items-center justify-end gap-2 px-4 pt-3 pb-0">
              <TopBarTools compact />
            </div>
            <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
        <FeedbackWidget />
      </TimerProvider>
    </UserProvider>
  );
}
