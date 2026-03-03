import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { health } from "../../routes/health";

const app = new Hono();
app.route("/", health);

describe("GET /health - Health check", () => {
  it("returns healthy status", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("ok");
    expect(json.data.service).toBe("envoy-api");
    expect(json.data.timestamp).toBeDefined();
  });
});
