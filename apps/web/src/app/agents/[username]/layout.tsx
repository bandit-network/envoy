import Link from "next/link";

export default function PublicProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Minimal nav */}
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="text-[15px] font-bold tracking-tight text-foreground"
          >
            ENVOY
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/docs"
              className="text-[13px] text-muted transition-colors hover:text-foreground"
            >
              Docs
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-elevated"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="text-[12px] text-muted">
            &copy; {new Date().getFullYear()} Envoy
          </span>
          <Link
            href="/"
            className="text-[12px] text-muted transition-colors hover:text-foreground"
          >
            useenvoy.dev
          </Link>
        </div>
      </footer>
    </div>
  );
}
