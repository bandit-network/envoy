"use client";

import { usePrivy } from "@privy-io/react-auth";
import type { ReactNode } from "react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-xl font-semibold">Sign in to Envoy</h1>
        <p className="text-sm text-muted">
          Authenticate to manage your agent identities
        </p>
        <button
          onClick={login}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          Sign In
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
