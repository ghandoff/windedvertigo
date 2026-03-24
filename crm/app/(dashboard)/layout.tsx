import { Sidebar } from "@/app/components/sidebar";
import { MobileSidebar } from "@/app/components/mobile-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <MobileSidebar />
      <main className="md:pl-60">
        <div className="p-6 md:p-8 max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
