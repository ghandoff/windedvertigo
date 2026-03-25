import { Sidebar } from "@/app/components/sidebar";
import { MobileSidebar } from "@/app/components/mobile-sidebar";
import { UserProvider } from "@/app/components/user-provider";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
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
          <div className="p-6 md:p-8 max-w-7xl">{children}</div>
        </main>
      </div>
    </UserProvider>
  );
}
