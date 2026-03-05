"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@envoy/ui";

const navItems = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/api-reference", label: "API Reference" },
  { href: "/docs/authentication", label: "Authentication" },
  { href: "/docs/platform-guide", label: "Platform Guide" },
  { href: "/docs/sdk", label: "SDK" },
  { href: "/docs/agent-sdk", label: "Agent SDK" },
  { href: "/docs/webhooks", label: "Webhooks" },
  { href: "/docs/registry", label: "8004 Registry" },
];

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top navbar */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <button
            type="button"
            className="md:hidden rounded p-1.5 text-muted hover:text-foreground"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>

          <Link
            href="/"
            className="font-semibold tracking-tight text-foreground"
          >
            Envoy
          </Link>
          <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
            Docs
          </span>

          <div className="flex-1" />

          <Link
            href="/dashboard"
            className="text-sm text-muted hover:text-foreground"
          >
            Dashboard
          </Link>
        </div>
      </nav>

      <div className="mx-auto flex max-w-7xl">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] w-64 border-r border-border bg-background p-4 transition-transform md:sticky md:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm transition-colors",
                  pathname === item.href
                    ? "bg-accent/10 font-medium text-accent"
                    : "text-muted hover:bg-surface hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 p-6 md:p-8 lg:p-12">
          <div className="mx-auto max-w-3xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
