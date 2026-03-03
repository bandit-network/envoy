import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { health } from "./routes/health";
import { wellKnown } from "./routes/well-known";
import { authMiddleware, type AuthEnv } from "./middleware/auth";
import { agentsRouter } from "./routes/agents";
import { pairingRouter } from "./routes/pairing";
import { verifyRouter } from "./routes/verify";

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

// Public routes
app.route("/", health);
app.route("/", wellKnown);
app.route("/api/v1", pairingRouter);
app.route("/api/v1", verifyRouter);

// Protected routes (Privy JWT required)
const v1 = new Hono<AuthEnv>();
v1.use("*", authMiddleware);

v1.get("/me", (c) => {
  return c.json({
    success: true,
    data: { user: c.get("user") },
  });
});

v1.route("/agents", agentsRouter);

app.route("/api/v1", v1);

const port = Number(process.env.API_PORT) || 3001;

console.log(`Envoy API running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
