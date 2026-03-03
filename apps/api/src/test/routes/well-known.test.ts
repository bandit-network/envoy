import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { wellKnown } from "../../routes/well-known";

const app = new Hono();
app.route("/", wellKnown);

describe("GET /.well-known/envoy-issuer - JWKS endpoint", () => {
  it("returns JWKS with public key", async () => {
    const res = await app.request("/.well-known/envoy-issuer");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.issuer).toBe("envoy");
    expect(json.keys).toHaveLength(1);

    const key = json.keys[0];
    expect(key.kty).toBe("RSA");
    expect(key.alg).toBe("RS256");
    expect(key.use).toBe("sig");
    expect(key.kid).toBeDefined();
    expect(key.n).toBeDefined();
    expect(key.e).toBeDefined();
    // Private components should NOT be exposed
    expect(key.d).toBeUndefined();
    expect(key.p).toBeUndefined();
    expect(key.q).toBeUndefined();
  });

  it("sets cache-control header", async () => {
    const res = await app.request("/.well-known/envoy-issuer");
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toBe("public, max-age=3600");
  });
});
