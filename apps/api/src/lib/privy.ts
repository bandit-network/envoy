import { PrivyClient } from "@privy-io/server-auth";

const appId = process.env.PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

if (!appId || !appSecret) {
  throw new Error(
    "PRIVY_APP_ID and PRIVY_APP_SECRET environment variables are required"
  );
}

/** Server-side Privy client for JWT verification (singleton) */
export const privyClient = new PrivyClient(appId, appSecret);
