import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { health } from "./routes/health";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.WEB_BASE_URL ?? "http://localhost:3000",
    credentials: true,
  })
);

app.route("/", health);

const port = Number(process.env.API_PORT) || 3001;

console.log(`Envoy API running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
