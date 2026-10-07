import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import LiveStatus from "@/components/LiveStatus";
import NewListingToasts from "@/components/NewListingToasts";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <header className="h-14 border-b border-border-soft flex items-center justify-between px-6 sticky top-0 bg-ink/85 backdrop-blur z-10">
          <div className="text-sm text-text-muted">
            Signed in as <span className="text-text">{user.email}</span>
          </div>
          <LiveStatus />
        </header>
        <main className="p-6">{children}</main>
      </div>
      <NewListingToasts />
    </div>
  );
}
