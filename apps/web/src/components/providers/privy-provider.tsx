"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

export function PrivyProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID environment variable is required");
  }

  return (
    <BasePrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#3B82F6",
        },
        loginMethods: ["email", "google", "wallet"],
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}
