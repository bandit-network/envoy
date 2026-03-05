import { db, agents } from "@envoy/db";
import { eq } from "drizzle-orm";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const WALLET_ENABLED = process.env.WALLET_PROVISIONING_ENABLED === "true";

/**
 * Provision a Solana wallet for an agent (no-custody model).
 *
 * Generates a new Ed25519 keypair using Keypair.generate().
 * - Only the PUBLIC key is stored in the database.
 * - The SECRET key is returned to the caller ONCE and never stored.
 * - The human operator is responsible for securely storing the secret key.
 *
 * If WALLET_PROVISIONING_ENABLED is false, returns null silently.
 * Agent creation NEVER fails due to wallet errors.
 *
 * On success, updates the agent's walletAddress column and returns
 * both the public key (base58) and secret key (base58, shown once).
 */
export async function provisionWallet(
  agentId: string,
  _userId: string
): Promise<{ publicKey: string; secretKey: string } | null> {
  if (!WALLET_ENABLED) {
    return null;
  }

  try {
    // Generate a new Solana keypair
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const secretKey = bs58.encode(keypair.secretKey);

    // Store ONLY the public key on the agent
    await db
      .update(agents)
      .set({ walletAddress: publicKey })
      .where(eq(agents.id, agentId));

    console.log(
      `[wallet] Provisioned wallet ${publicKey} for agent ${agentId}`
    );

    // Return both keys — secretKey is shown once, never stored
    return { publicKey, secretKey };
  } catch (err) {
    // Never let wallet provisioning block agent creation
    console.error(
      "[wallet] Failed to provision wallet:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
