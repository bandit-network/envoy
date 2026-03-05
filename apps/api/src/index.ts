import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { health } from "./routes/health";
import { wellKnown } from "./routes/well-known";
import { authMiddleware, type AuthEnv } from "./middleware/auth";
import { createRateLimit } from "./middleware/rate-limit";
import { agentsRouter } from "./routes/agents";
import { pairingRouter } from "./routes/pairing";
import { verifyRouter } from "./routes/verify";
import { auditRouter } from "./routes/audit";
import { platformsRouter } from "./routes/platforms";
import { revocationsRouter } from "./routes/revocations";
import { webhooksRouter } from "./routes/webhooks";
import { tokenRouter } from "./routes/token";
import { publicAgentsRouter } from "./routes/public-agents";
import { statsRouter } from "./routes/stats";
import { organizationsRouter } from "./routes/organizations";
import { registerRouter } from "./routes/register";
import { authRouter } from "./routes/auth";
import { startWebhookWorker, stopWebhookWorker } from "./services/webhook-queue";
import { startExpiryScanner, stopExpiryScanner } from "./services/expiry-scanner";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.WEB_BASE_URL ?? "http://localhost:3000",
    credentials: true,
  })
);

// Rate limiting
const RATE_LIMIT_PUBLIC = Number(process.env.RATE_LIMIT_PUBLIC) || 60;
const RATE_LIMIT_VERIFY = Number(process.env.RATE_LIMIT_VERIFY) || 300;
const RATE_LIMIT_AUTHENTICATED = Number(process.env.RATE_LIMIT_AUTHENTICATED) || 120;
const RATE_LIMIT_PAIR = Number(process.env.RATE_LIMIT_PAIR) || 10;
const RATE_LIMIT_TOKEN_REFRESH = Number(process.env.RATE_LIMIT_TOKEN_REFRESH) || 10;
const RATE_LIMIT_TOKEN_STATUS = Number(process.env.RATE_LIMIT_TOKEN_STATUS) || 60;
const RATE_LIMIT_AUTH = Number(process.env.RATE_LIMIT_AUTH) || 20;

const MINUTE = 60_000;

// Public route rate limiting (60 req/min per IP)
app.use(
  "/api/v1/pair-confirm",
  createRateLimit({ limit: RATE_LIMIT_PAIR, windowMs: MINUTE })
);
app.use(
  "/api/v1/verify",
  createRateLimit({ limit: RATE_LIMIT_VERIFY, windowMs: MINUTE })
);
app.use(
  "/api/v1/revocations/*",
  createRateLimit({ limit: RATE_LIMIT_PUBLIC, windowMs: MINUTE })
);
app.use(
  "/api/v1/token/refresh",
  createRateLimit({ limit: RATE_LIMIT_TOKEN_REFRESH, windowMs: MINUTE })
);
app.use(
  "/api/v1/token/status",
  createRateLimit({ limit: RATE_LIMIT_TOKEN_STATUS, windowMs: MINUTE })
);
app.use(
  "/api/v1/agents/public/*",
  createRateLimit({ limit: RATE_LIMIT_PUBLIC, windowMs: MINUTE })
);
app.use(
  "/api/v1/auth/*",
  createRateLimit({ limit: RATE_LIMIT_AUTH, windowMs: MINUTE })
);

// Public routes
app.route("/", health);
app.route("/", wellKnown);
app.route("/api/v1", authRouter);
app.route("/api/v1", pairingRouter);
app.route("/api/v1", verifyRouter);
app.route("/api/v1", revocationsRouter);
app.route("/api/v1", tokenRouter);
app.route("/api/v1", publicAgentsRouter);

// Protected routes (authenticated session required)
const v1 = new Hono<AuthEnv>();
v1.use("*", authMiddleware);
v1.use(
  "*",
  createRateLimit({
    limit: RATE_LIMIT_AUTHENTICATED,
    windowMs: MINUTE,
    keyFn: (c) => c.get("user")?.userId ?? "anon",
  })
);

v1.get("/me", (c) => {
  return c.json({
    success: true,
    data: { user: c.get("user") },
  });
});

v1.route("/agents", agentsRouter);
v1.route("/", registerRouter); // Mounted at root of v1 — routes define /agents/:id/register-*
v1.route("/audit", auditRouter);
v1.route("/platforms", platformsRouter);
v1.route("/webhooks", webhooksRouter);
v1.route("/stats", statsRouter);
v1.route("/organizations", organizationsRouter);

app.route("/api/v1", v1);

// Global error handler — always return JSON envelope
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    const status = err.status;
    return c.json(
      {
        success: false,
        error: {
          code: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "ERROR",
          message: err.message,
        },
      },
      status
    );
  }
  console.error("[api] Unhandled error:", err);
  return c.json(
    {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    },
    500
  );
});

// 404 handler — always return JSON envelope
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: { code: "NOT_FOUND", message: `Route not found: ${c.req.method} ${c.req.path}` },
    },
    404
  );
});

const port = Number(process.env.API_PORT) || 3001;

// Start webhook worker + expiry scanner
startWebhookWorker();
startExpiryScanner();

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[api] SIGTERM received, shutting down...");
  stopExpiryScanner();
  await stopWebhookWorker();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[api] SIGINT received, shutting down...");
  stopExpiryScanner();
  await stopWebhookWorker();
  process.exit(0);
});

console.log(`Envoy API running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
