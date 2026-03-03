import { Hono } from "hono";
import { getPublicJWK } from "../lib/issuer";

export const wellKnown = new Hono();

wellKnown.get("/.well-known/envoy-issuer", async (c) => {
  const publicJwk = await getPublicJWK();

  c.header("Cache-Control", "public, max-age=3600");

  return c.json({
    issuer: "envoy",
    keys: [publicJwk],
  });
});
