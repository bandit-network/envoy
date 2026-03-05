import { db, agents } from "@envoy/db";
import { eq } from "drizzle-orm";
import { Keypair } from "@solana/web3.js";
import { SolanaSDK, IPFSClient } from "8004-solana";
import bs58 from "bs58";

const REGISTRY_ENABLED = process.env.REGISTRY_ENABLED === "true";
const REGISTRY_SIGNER_PRIVATE_KEY = process.env.REGISTRY_SIGNER_PRIVATE_KEY ?? "";
const REGISTRY_CLUSTER = (process.env.REGISTRY_CLUSTER ?? "devnet") as
  | "devnet"
  | "mainnet-beta";
const REGISTRY_COLLECTION_POINTER =
  process.env.REGISTRY_COLLECTION_POINTER ?? undefined;
const REGISTRY_RPC_URL = process.env.REGISTRY_RPC_URL ?? undefined;
const PINATA_JWT = process.env.PINATA_JWT ?? undefined;

/**
 * Build an IPFSClient for metadata uploads (Pinata-backed).
 */
function getIPFSClient(): IPFSClient | undefined {
  if (!PINATA_JWT) return undefined;
  return new IPFSClient({ pinataEnabled: true, pinataJwt: PINATA_JWT });
}

/**
 * Build a SolanaSDK instance.
 * @param readOnly If true, no signer is attached (for queries only).
 */
function getRegistrySDK(readOnly = false): SolanaSDK | null {
  try {
    if (!readOnly && !REGISTRY_SIGNER_PRIVATE_KEY) {
      console.warn(
        "[registry] REGISTRY_SIGNER_PRIVATE_KEY not set — cannot write"
      );
      return null;
    }

    const signer = readOnly
      ? undefined
      : Keypair.fromSecretKey(bs58.decode(REGISTRY_SIGNER_PRIVATE_KEY));

    return new SolanaSDK({
      cluster: REGISTRY_CLUSTER,
      signer,
      rpcUrl: REGISTRY_RPC_URL,
      ipfsClient: readOnly ? undefined : getIPFSClient(),
    });
  } catch (err) {
    console.error(
      "[registry] Failed to initialise SolanaSDK:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Register an agent on the 8004 Solana agent registry.
 *
 * - If REGISTRY_ENABLED is false, returns null silently.
 * - If registration fails, logs the error and returns null.
 *   Agent creation NEVER fails due to registry errors.
 *
 * On success, updates the agent's registryAssetId column and returns the asset public key.
 */
export async function registerAgentOnChain(
  agentId: string,
  agentName: string,
  agentDescription: string,
  walletAddress: string
): Promise<string | null> {
  if (!REGISTRY_ENABLED) {
    return null;
  }

  try {
    const sdk = getRegistrySDK(false);
    if (!sdk) return null;

    // Build agent metadata for IPFS
    const metadata = {
      name: agentName,
      description: agentDescription || `AI agent registered via Envoy`,
      properties: {
        envoy_agent_id: agentId,
        wallet_address: walletAddress,
        platform: "envoy",
        registered_at: new Date().toISOString(),
      },
    };

    // Upload metadata to IPFS
    const ipfs = getIPFSClient();
    if (!ipfs) {
      console.warn(
        "[registry] PINATA_JWT not set — cannot upload metadata to IPFS"
      );
      return null;
    }

    const metadataUri = await ipfs.addJson(metadata);

    // Register agent on-chain
    const result = await sdk.registerAgent(metadataUri, {
      collectionPointer: REGISTRY_COLLECTION_POINTER,
    });

    // Type guard: check if this is a sent transaction result
    if (!("success" in result) || !result.success) {
      const errorMsg =
        "error" in result ? (result as { error?: string }).error : "Unknown error";
      console.error("[registry] On-chain registration failed:", errorMsg);
      return null;
    }

    const assetPubkey = result.asset?.toBase58?.() ?? null;

    if (!assetPubkey) {
      console.warn(
        "[registry] Registration succeeded but no asset pubkey returned"
      );
      return null;
    }

    // Store the asset ID on the agent
    await db
      .update(agents)
      .set({ registryAssetId: assetPubkey })
      .where(eq(agents.id, agentId));

    console.log(
      `[registry] Registered agent ${agentId} on 8004 → asset ${assetPubkey}`
    );

    return assetPubkey;
  } catch (err) {
    // Never let registry registration block agent creation
    console.error(
      "[registry] Failed to register agent on-chain:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Look up an agent's on-chain registry entry.
 * Read-only — no signer required.
 */
export async function lookupAgentRegistry(
  assetPubkey: string
): Promise<{
  registered: boolean;
  assetId: string;
  name?: string;
  uri?: string;
} | null> {
  try {
    const sdk = getRegistrySDK(true);
    if (!sdk) return null;

    const { PublicKey } = await import("@solana/web3.js");
    const agent = await sdk.loadAgent(new PublicKey(assetPubkey));

    if (!agent) return null;

    return {
      registered: true,
      assetId: assetPubkey,
      name: agent.nft_name ?? undefined,
      uri: agent.agent_uri ?? undefined,
    };
  } catch (err) {
    console.error(
      "[registry] Failed to look up agent:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
