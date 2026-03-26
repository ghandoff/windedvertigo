import { redirect } from "next/navigation";
import { Sidebar } from "@/app/components/sidebar";
import { MobileSidebar } from "@/app/components/mobile-sidebar";
import { AiSearchBar } from "@/app/components/ai-search-bar";
import { UserProvider } from "@/app/components/user-provider";
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
      <div className="min-h-screen">
        <Sidebar />
        <MobileSidebar />
        <main className="md:pl-60">
          <div className="hidden md:flex items-center justify-end px-8 pt-4 pb-0">
            <AiSearchBar />
          </div>
          <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </UserProvider>
  );
}
