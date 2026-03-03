# @envoy/sdk

TypeScript SDK for verifying Envoy agent identity tokens.

## Installation

```bash
npm install @envoy/sdk
```

## Quick Start

```ts
import { EnvoyVerifier } from "@envoy/sdk";

const verifier = new EnvoyVerifier({
  issuerUrl: "https://api.useenvoy.dev",
});

// Full verification (signature + expiry + revocation check)
const result = await verifier.verify(token);

if (result.valid) {
  console.log("Agent:", result.manifest.agent_name);
  console.log("Scopes:", result.scopes);
}

// Offline verification (signature + expiry only, no API call)
const offlineResult = await verifier.verifyOffline(token);
```

## API

### `new EnvoyVerifier(options)`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `issuerUrl` | `string` | Yes | Base URL of the Envoy API |
| `fetch` | `typeof fetch` | No | Custom fetch implementation |

### `verifier.verify(token): Promise<VerificationResult>`

Full online verification: JWT signature, expiry, and revocation status.

### `verifier.verifyOffline(token): Promise<VerificationResult>`

Offline verification: JWT signature and expiry only. Faster, no API call.

### `verifier.resetKeys(): void`

Clear the cached JWKS keys. Call after key rotation.

## Types

```ts
interface VerificationResult {
  valid: boolean;
  manifest: ManifestPayload | null;
  expired: boolean;
  revoked: boolean;
  scopes: string[];
  error?: string;
}

interface ManifestPayload {
  agent_name: string;
  agent_id: string;
  owner_ref: string;
  wallet_addresses: string[];
  scopes: string[];
  policy_refs: Record<string, string>;
  issued_at: string;
  expires_at: string;
}
```

## License

MIT
