import type { AuthProvider } from "./auth-provider";
import { WalletAuthProvider } from "./auth-wallet";

const AUTH_PROVIDER_TYPE = process.env.AUTH_PROVIDER ?? "wallet";

let _provider: AuthProvider | null = null;

/**
 * Get the configured auth provider.
 *
 * Reads AUTH_PROVIDER env var:
 * - "wallet" (default) — Solana wallet adapter + Envoy-issued JWTs
 * - "privy" — Privy server SDK verification
 *
 * Privy provider is lazy-loaded to avoid requiring Privy env vars
 * when using wallet auth.
 */
export function getAuthProvider(): AuthProvider {
  if (!_provider) {
    if (AUTH_PROVIDER_TYPE === "privy") {
      // Lazy import avoids requiring Privy env vars for wallet-only deployments
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PrivyAuthProvider } = require("./auth-privy") as {
        PrivyAuthProvider: new () => AuthProvider;
      };
      _provider = new PrivyAuthProvider();
    } else {
      _provider = new WalletAuthProvider();
    }
  }
  return _provider;
}
