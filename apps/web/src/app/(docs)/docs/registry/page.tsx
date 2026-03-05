import { CodeBlock, Section, Prose, EndpointCard } from "@/components/docs/doc-layout";

export default function RegistryPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">8004 Registry</h1>
        <p className="mt-2 text-sm text-muted">
          On-chain AI agent registration on Solana via the 8004 standard.
          Make your agents discoverable and verifiable on the blockchain.
        </p>
      </div>

      <Section id="what-is-8004" title="What is 8004?">
        <Prose>
          <p>
            <strong>8004</strong> is an open standard for registering AI agents on
            the Solana blockchain using Metaplex Core NFTs. Each registered agent
            gets a unique on-chain asset that stores its metadata, making it
            publicly discoverable and cryptographically verifiable.
          </p>
          <p>
            Envoy integrates with 8004 to provide on-chain identity for agents.
            When an agent is registered on 8004, its identity can be verified
            by anyone using the Solana blockchain — no trust in Envoy required.
          </p>
        </Prose>

        <div className="mt-4 rounded-lg border border-registry/20 bg-registry/5 p-4">
          <p className="text-sm text-muted">
            <strong className="text-foreground">Registry Explorer:</strong>{" "}
            View registered agents at{" "}
            <a
              href="https://8004market.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-registry hover:underline"
            >
              8004market.io
            </a>
          </p>
        </div>
      </Section>

      <Section id="how-it-works" title="How It Works">
        <Prose>
          <p>
            When you create an agent with Envoy, the following happens automatically
            (if registry is enabled):
          </p>
          <ul>
            <li><strong>Wallet provisioned</strong> — Envoy provisions a Solana wallet for the agent via Privy.</li>
            <li><strong>Metadata uploaded</strong> — Agent metadata (name, description, Envoy ID) is uploaded to IPFS via Pinata.</li>
            <li><strong>On-chain registration</strong> — A Metaplex Core NFT is minted on Solana, linking the agent to its metadata.</li>
            <li><strong>Asset ID stored</strong> — The on-chain asset public key is saved in Envoy for verification.</li>
          </ul>
        </Prose>
      </Section>

      <Section id="auto-registration" title="Automatic Registration">
        <Prose>
          <p>
            When <code>REGISTRY_ENABLED=true</code> is set, Envoy automatically
            registers agents on the 8004 registry during creation. This is a
            non-blocking operation — if registration fails, the agent is still
            created successfully and can be registered manually later.
          </p>
          <p>
            The registration flow is:
          </p>
          <ul>
            <li>Agent created → Wallet provisioned → Registry registration attempted</li>
            <li>On success: <code>registryAssetId</code> is stored on the agent record</li>
            <li>On failure: Agent is created without registry — can be registered manually</li>
          </ul>
        </Prose>
      </Section>

      <Section id="manual-registration" title="Manual Registration">
        <Prose>
          <p>
            Agents that were created before registry was enabled, or where
            auto-registration failed, can be registered manually via the API
            or the dashboard.
          </p>
        </Prose>

        <EndpointCard
          method="POST"
          path="/api/v1/agents/:id/register"
          auth="Bearer"
          description="Manually register an agent on the 8004 Solana registry."
        >
          <CodeBlock title="Prerequisites">{`- Agent must be active
- Agent must have a wallet address
- Agent must not already be registered`}</CodeBlock>

          <CodeBlock title="Response">{`{
  "success": true,
  "data": {
    "registryAssetId": "8oo4..."
  }
}`}</CodeBlock>
        </EndpointCard>

        <Prose>
          <p>
            From the dashboard, navigate to the agent detail page and click the
            &ldquo;Register on 8004&rdquo; button. This button only appears for
            active agents with a wallet that aren&apos;t already registered.
          </p>
        </Prose>
      </Section>

      <Section id="verification" title="On-Chain Verification">
        <Prose>
          <p>
            The Envoy verify endpoint includes registry information in its
            response. When verifying an agent token, the <code>registry</code>
            field indicates whether the agent is registered on 8004.
          </p>
        </Prose>

        <EndpointCard
          method="POST"
          path="/api/v1/verify"
          auth="API Key"
          description="Verify an agent token. Response includes 8004 registry status."
        >
          <CodeBlock title="Response (registered agent)">{`{
  "success": true,
  "data": {
    "valid": true,
    "manifest": { ... },
    "onchainIdentity": {
      "verified": true,
      "walletAddress": "So1ana..."
    },
    "registry": {
      "registered": true,
      "assetId": "8oo4..."
    }
  }
}`}</CodeBlock>
        </EndpointCard>
      </Section>

      <Section id="reading-registry" title="Reading Registry Data">
        <Prose>
          <p>
            Agent registry data is publicly available on the Solana blockchain.
            You can read it using the <code>8004-solana</code> SDK:
          </p>
        </Prose>

        <CodeBlock title="Reading agent data from chain">{`import { SolanaSDK } from "8004-solana";

const sdk = new SolanaSDK({ cluster: "devnet" });

// Load agent data using the asset public key
const agent = await sdk.loadAgent("8oo4AssetPublicKey...");

console.log("Agent name:", agent.name);
console.log("Agent metadata:", agent.uri);`}</CodeBlock>

        <Prose>
          <p>
            You can also view any registered agent on the 8004 explorer by
            navigating to:
          </p>
        </Prose>

        <CodeBlock>{`https://8004market.io/asset/{registryAssetId}`}</CodeBlock>
      </Section>

      <Section id="public-profile" title="Public Profile Integration">
        <Prose>
          <p>
            Agents registered on 8004 display an &ldquo;8004 Registered&rdquo;
            badge on their public profile page. The badge links directly to the
            agent&apos;s entry on 8004market.io.
          </p>
          <p>
            Public profile URL format:
          </p>
        </Prose>

        <CodeBlock>{`https://useenvoy.dev/discover/{username}`}</CodeBlock>
      </Section>
    </div>
  );
}
