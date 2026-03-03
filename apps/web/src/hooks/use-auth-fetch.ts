"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

/**
 * Returns a fetch function pre-configured with the Privy auth token.
 *
 * Usage:
 *   const authFetch = useAuthFetch();
 *   const res = await authFetch("/api/v1/agents");
 *   const data = await res.json();
 */
export function useAuthFetch() {
  const { getAccessToken } = usePrivy();

  return useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Not authenticated");
      }

      return fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...init?.headers,
        },
      });
    },
    [getAccessToken]
  );
}
