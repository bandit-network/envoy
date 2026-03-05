"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import type { AuthUser } from "@envoy/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const STORAGE_KEY = "envoy_session";

interface StoredSession {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

interface EnvoyAuthContextValue {
  /** True once the provider has restored session state */
  ready: boolean;
  /** True if the user has a valid session */
  authenticated: boolean;
  /** Current user info (null if not authenticated) */
  user: AuthUser | null;
  /** Connect wallet + sign challenge to authenticate */
  login: () => Promise<void>;
  /** Clear session + disconnect wallet */
  logout: () => void;
  /** Get the current access token (null if expired/missing) */
  getAccessToken: () => string | null;
  /** Whether a login is currently in progress */
  loggingIn: boolean;
}

const EnvoyAuthContext = createContext<EnvoyAuthContextValue | null>(null);

/**
 * Provides Envoy wallet-based authentication context.
 *
 * Auth flow:
 * 1. User connects wallet (via Solana wallet adapter)
 * 2. login() requests a challenge nonce from the API
 * 3. User signs the challenge message in their wallet
 * 4. Signature is submitted to the API for verification
 * 5. API returns a session JWT stored in localStorage
 */
export function EnvoyAuthProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, disconnect, connected } = useWallet();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [ready, setReady] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as StoredSession;
        // Check if token is still valid
        if (new Date(stored.expiresAt) > new Date()) {
          setSession(stored);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
  }, []);

  const login = useCallback(async () => {
    if (!publicKey || !signMessage) {
      throw new Error("Wallet not connected or does not support message signing");
    }

    setLoggingIn(true);

    try {
      const walletAddress = publicKey.toBase58();

      // Step 1: Request challenge nonce
      const challengeRes = await fetch(`${API_BASE_URL}/api/v1/auth/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      if (!challengeRes.ok) {
        const err = await challengeRes.json().catch(() => ({}));
        throw new Error(
          (err as { error?: { message?: string } })?.error?.message ??
            "Failed to request challenge"
        );
      }

      const challengeData = (await challengeRes.json()) as {
        data: { nonce: string; message: string; expiresAt: string };
      };
      const { nonce, message } = challengeData.data;

      // Step 2: Sign message with wallet
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      // Step 3: Submit signature for verification
      const verifyRes = await fetch(`${API_BASE_URL}/api/v1/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, signature, nonce }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(
          (err as { error?: { message?: string } })?.error?.message ??
            "Signature verification failed"
        );
      }

      const verifyData = (await verifyRes.json()) as {
        data: { token: string; expiresAt: string; user: AuthUser };
      };

      const stored: StoredSession = {
        token: verifyData.data.token,
        expiresAt: verifyData.data.expiresAt,
        user: verifyData.data.user,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      setSession(stored);
    } finally {
      setLoggingIn(false);
    }
  }, [publicKey, signMessage]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    disconnect().catch(() => {
      // Disconnect errors are non-critical
    });
  }, [disconnect]);

  const getAccessToken = useCallback((): string | null => {
    if (!session) return null;
    // Check if still valid
    if (new Date(session.expiresAt) <= new Date()) {
      localStorage.removeItem(STORAGE_KEY);
      setSession(null);
      return null;
    }
    return session.token;
  }, [session]);

  const value = useMemo<EnvoyAuthContextValue>(
    () => ({
      ready,
      authenticated: !!session,
      user: session?.user ?? null,
      login,
      logout,
      getAccessToken,
      loggingIn,
    }),
    [ready, session, login, logout, getAccessToken, loggingIn]
  );

  return (
    <EnvoyAuthContext.Provider value={value}>
      {children}
    </EnvoyAuthContext.Provider>
  );
}

/**
 * Hook to access Envoy auth state and methods.
 *
 * Must be used within <EnvoyAuthProvider>.
 */
export function useEnvoyAuth(): EnvoyAuthContextValue {
  const ctx = useContext(EnvoyAuthContext);
  if (!ctx) {
    throw new Error("useEnvoyAuth must be used within <EnvoyAuthProvider>");
  }
  return ctx;
}
