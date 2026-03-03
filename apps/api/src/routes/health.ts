import { Hono } from "hono";

export const health = new Hono();

health.get("/health", (c) => {
  return c.json({
    success: true,
    data: {
      status: "ok",
      service: "envoy-api",
      timestamp: new Date().toISOString(),
    },
  });
});
