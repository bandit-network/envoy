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
 * Upload JSON metadata to Pinata directly using the v1 API.
 * The 8004-solana SDK's IPFSClient uses Pinata v3 API which requires
 * a different key format. This fallback uses the v1/v2 endpoint that
 * works with standard scoped JWTs.
 */
async function uploadToPinataDirect(
  data: Record<string, unknown>
): Promise<string | null> {
  if (!PINATA_JWT) return null;

  try {
    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: JSON.stringify({
          pinataContent: data,
          pinataMetadata: { name: `envoy-agent-metadata` },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[registry] Pinata v1 upload failed: HTTP ${response.status} - ${errorText}`
      );
      return null;
    }

    const result = (await response.json()) as {
      IpfsHash?: string;
    };
    const cid = result.IpfsHash;
    if (!cid) {
      console.error("[registry] Pinata v1 returned no IpfsHash");
      return null;
    }

    return `ipfs://${cid}`;
  } catch (err) {
    console.error(
      "[registry] Pinata v1 upload error:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
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
  walletAddress: string,
  imageUrl?: string | null,
  username?: string | null
): Promise<string | null> {
  if (!REGISTRY_ENABLED) {
    return null;
  }

  try {
    const sdk = getRegistrySDK(false);
    if (!sdk) return null;

    // Resolve image: custom avatar → DiceBear identicon fallback
    const image =
      imageUrl || `https://api.dicebear.com/9.x/identicon/svg?seed=${agentId}`;

    // Build agent metadata for IPFS (Metaplex-compatible JSON)
    const metadata: Record<string, unknown> = {
      name: agentName,
      description: agentDescription || `AI agent registered via Envoy`,
      image,
      properties: {
        envoy_agent_id: agentId,
        wallet_address: walletAddress,
        platform: "envoy",
        registered_at: new Date().toISOString(),
        ...(username ? { username } : {}),
      },
    };

    // Upload metadata to IPFS via Pinata
    // Try direct v1 API first (works with standard scoped JWTs),
    // fall back to SDK's IPFSClient (uses v3 API) if that fails.
    let metadataUri: string | null = await uploadToPinataDirect(metadata);

    if (!metadataUri) {
      const ipfs = getIPFSClient();
      if (!ipfs) {
        console.warn(
          "[registry] PINATA_JWT not set — cannot upload metadata to IPFS"
        );
        return null;
      }
      metadataUri = await ipfs.addJson(metadata);
    }

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
 * Update an agent's on-chain metadata on the 8004 Solana registry.
 *
 * Called when agent metadata (name, avatar, username) changes.
 * Uploads new metadata JSON to IPFS and calls setAgentUri() to update the NFT.
 *
 * - If REGISTRY_ENABLED is false, returns false silently.
 * - If update fails, logs the error and returns false.
 *   Agent metadata updates NEVER fail due to registry errors.
 */
export async function updateAgentMetadataOnChain(
  agentId: string,
  agentName: string,
  agentDescription: string,
  walletAddress: string,
  registryAssetId: string,
  imageUrl?: string | null,
  username?: string | null
): Promise<boolean> {
  if (!REGISTRY_ENABLED) {
    return false;
  }

  try {
    const sdk = getRegistrySDK(false);
    if (!sdk) return false;

    // Resolve image: custom avatar → DiceBear identicon fallback
    const image =
      imageUrl || `https://api.dicebear.com/9.x/identicon/svg?seed=${agentId}`;

    // Build updated metadata (same structure as registerAgentOnChain)
    const metadata: Record<string, unknown> = {
      name: agentName,
      description: agentDescription || `AI agent registered via Envoy`,
      image,
      properties: {
        envoy_agent_id: agentId,
        wallet_address: walletAddress,
        platform: "envoy",
        updated_at: new Date().toISOString(),
        ...(username ? { username } : {}),
      },
    };

    // Upload updated metadata to IPFS
    let metadataUri: string | null = await uploadToPinataDirect(metadata);

    if (!metadataUri) {
      const ipfs = getIPFSClient();
      if (!ipfs) {
        console.warn(
          "[registry] PINATA_JWT not set — cannot upload metadata to IPFS"
        );
        return false;
      }
      metadataUri = await ipfs.addJson(metadata);
    }

    // Update on-chain via setAgentUri()
    const { PublicKey } = await import("@solana/web3.js");
    const result = await sdk.setAgentUri(
      new PublicKey(registryAssetId),
      metadataUri
    );

    if (!("success" in result) || !result.success) {
      const errorMsg =
        "error" in result ? (result as { error?: string }).error : "Unknown error";
      console.error("[registry] On-chain metadata update failed:", errorMsg);
      return false;
    }

    console.log(
      `[registry] Updated agent ${agentId} metadata on 8004 → ${metadataUri}`
    );
    return true;
  } catch (err) {
    // Never let metadata update block the DB update
    console.error(
      "[registry] Failed to update agent metadata on-chain:",
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

/**
 * Create the global Envoy collection on the 8004 Solana registry.
 *
 * This is a one-time setup operation. The returned `pointer` should be
 * stored as the REGISTRY_COLLECTION_POINTER environment variable.
 */
export async function createEnvoyCollection(): Promise<{
  pointer: string;
  uri: string;
  cid: string;
} | null> {
  if (!REGISTRY_ENABLED) {
    console.warn("[registry] REGISTRY_ENABLED is false — cannot create collection");
    return null;
  }

  try {
    const sdk = getRegistrySDK(false);
    if (!sdk) return null;

    const result = await sdk.createCollection({
      name: "Envoy Agents",
      description:
        "AI agents registered via Envoy — human-owned identities trusted by platforms everywhere.",
      category: "assistant",
      image: "https://api.dicebear.com/9.x/shapes/svg?seed=envoy-collection",
      socials: { website: "https://useenvoy.dev" },
    });

    if (!result.pointer || !result.uri || !result.cid) {
      console.error(
        "[registry] Collection created but missing pointer/uri/cid:",
        result
      );
      return null;
    }

    console.log(
      `[registry] Created Envoy collection → pointer: ${result.pointer}`
    );

    return {
      pointer: result.pointer,
      uri: result.uri,
      cid: result.cid,
    };
  } catch (err) {
    console.error(
      "[registry] Failed to create collection:",
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
