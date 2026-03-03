"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";

export function PrivyProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const { resolvedTheme } = useTheme();

  if (!appId) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID environment variable is required");
  }

  return (
    <BasePrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: resolvedTheme === "dark" ? "dark" : "light",
          accentColor: resolvedTheme === "dark" ? "#E2DFED" : "#18181B",
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
