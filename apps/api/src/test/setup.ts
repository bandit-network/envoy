/**
 * Test setup: runs BEFORE any test file imports.
 * Sets required environment variables to prevent module-level throws.
 */
import { TEST_PRIVATE_KEY, TEST_KEY_ID } from "./fixtures/keys";

// Issuer keys (prevents issuer.ts from throwing)
process.env.ENVOY_ISSUER_PRIVATE_KEY = TEST_PRIVATE_KEY;
process.env.ENVOY_ISSUER_KEY_ID = TEST_KEY_ID;

// Privy (prevents privy.ts from throwing -- will be mocked anyway)
process.env.PRIVY_APP_ID = "test-privy-app-id";
process.env.PRIVY_APP_SECRET = "test-privy-app-secret";

// Database (test database)
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://envoy:envoy@localhost:5432/envoy_test";

// Redis
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// Webhook
process.env.WEBHOOK_SIGNING_SECRET = "test-webhook-secret";

// Wallet provisioning off by default in tests
process.env.WALLET_PROVISIONING_ENABLED = "false";
