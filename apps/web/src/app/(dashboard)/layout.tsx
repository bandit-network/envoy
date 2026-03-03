"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex flex-1 flex-col overflow-auto">
          {/* Mobile header */}
          <header className="flex items-center gap-3 border-b border-border p-4 md:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded p-1 text-muted hover:bg-elevated hover:text-foreground"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <span className="text-sm font-bold tracking-widest text-foreground">ENVOY</span>
          </header>

          <main className="flex-1 p-4 sm:p-6 md:p-8">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
