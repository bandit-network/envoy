import { PrivyClient } from "@privy-io/server-auth";

const appId = process.env.PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

let _privyClient: PrivyClient | null = null;

/**
 * Get the Privy server client (lazy initialization).
 *
 * Only call this when AUTH_PROVIDER=privy. Will throw if Privy
 * env vars are not configured.
 */
export function getPrivyClient(): PrivyClient {
  if (!_privyClient) {
    if (!appId || !appSecret) {
      throw new Error(
        "PRIVY_APP_ID and PRIVY_APP_SECRET are required when AUTH_PROVIDER=privy"
      );
    }
    _privyClient = new PrivyClient(appId, appSecret);
  }
  return _privyClient;
}
