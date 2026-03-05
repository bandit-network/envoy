"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useEnvoyAuth } from "@/components/providers/auth-context";
import { useState, type ReactNode } from "react";

/**
 * Inline auth guard — wraps content that requires authentication.
 *
 * Instead of blocking the full page, this shows a compact
 * connect/sign-in prompt in place of the protected content.
 * The rest of the page (sidebar, nav, etc.) remains accessible.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { authenticated, login, loggingIn } = useEnvoyAuth();
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [error, setError] = useState<string | null>(null);

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="flex flex-col items-center gap-4 max-w-xs text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface">
          <svg className="h-5 w-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>

        <div>
          <p className="text-[13px] font-medium text-foreground">
            Connect wallet to continue
          </p>
          <p className="mt-1 text-[12px] text-muted">
            This section requires authentication
          </p>
        </div>

        {!connected ? (
          <button
            onClick={() => setVisible(true)}
            className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
              <circle cx="17" cy="14" r="1" fill="currentColor" stroke="none" />
            </svg>
            Connect Wallet
          </button>
        ) : (
          <button
            onClick={async () => {
              setError(null);
              try {
                await login();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Auth failed");
              }
            }}
            disabled={loggingIn}
            className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {loggingIn ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                Signing...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        )}

        {error && (
          <p className="text-[11px] text-danger">{error}</p>
        )}
      </div>
    </div>
  );
}
