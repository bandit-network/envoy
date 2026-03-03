import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { verifyApiKey } from "../services/platform";

export type PlatformEnv = {
  Variables: {
    platform: {
      platformId: string;
      keyId: string;
      scopes: string[];
    };
  };
};

/**
 * Platform auth middleware: verify API key from X-API-Key header.
 * Used for platform-scoped endpoints.
 */
export const platformAuthMiddleware = createMiddleware<PlatformEnv>(
  async (c, next) => {
    const apiKey = c.req.header("X-API-Key");

    if (!apiKey) {
      throw new HTTPException(401, {
        message: "Missing X-API-Key header",
      });
    }

    const result = await verifyApiKey(apiKey);

    if (!result.valid) {
      throw new HTTPException(401, {
        message: result.error ?? "Invalid API key",
      });
    }

    c.set("platform", {
      platformId: result.platformId!,
      keyId: result.keyId!,
      scopes: result.scopes ?? [],
    });

    await next();
  }
);
