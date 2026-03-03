import { db, agents } from "@envoy/db";
import { eq } from "drizzle-orm";
import { privyClient } from "../lib/privy";

const WALLET_ENABLED = process.env.WALLET_PROVISIONING_ENABLED === "true";

/**
 * Provision an Ethereum wallet for an agent using Privy's wallet API.
 *
 * - If WALLET_PROVISIONING_ENABLED is false, returns null silently.
 * - If wallet provisioning fails, logs the error and returns null.
 *   Agent creation NEVER fails due to wallet errors.
 *
 * On success, updates the agent's walletAddress column and returns the address.
 */
export async function provisionWallet(
  agentId: string,
  userId: string
): Promise<string | null> {
  if (!WALLET_ENABLED) {
    return null;
  }

  try {
    // Use Privy's server-side wallet API to create an Ethereum wallet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Privy SDK types may vary between versions
    const walletApi = (privyClient as any).walletApi;

    if (!walletApi?.create) {
      console.warn(
        "[wallet] Privy walletApi.create not available — skipping wallet provisioning"
      );
      return null;
    }

    const wallet = await walletApi.create({
      chainType: "ethereum",
    });

    const address: string = wallet.address;

    if (!address) {
      console.warn("[wallet] Privy wallet created but no address returned");
      return null;
    }

    // Store the wallet address on the agent
    await db
      .update(agents)
      .set({ walletAddress: address })
      .where(eq(agents.id, agentId));

    console.log(
      `[wallet] Provisioned wallet ${address} for agent ${agentId}`
    );

    return address;
  } catch (err) {
    // Never let wallet provisioning block agent creation
    console.error(
      "[wallet] Failed to provision wallet:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
