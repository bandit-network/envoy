import { AuthGuard } from "@/components/auth/auth-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-border bg-surface p-4">
          <div className="text-sm font-semibold tracking-wide text-muted">
            ENVOY
          </div>
        </aside>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </AuthGuard>
  );
}
