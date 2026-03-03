import { Hono } from "hono";

interface TestUser {
  userId: string;
  privyUserId: string;
  email: string | null;
}

/**
 * Create a Hono app with mocked auth middleware for testing.
 * Injects a test user into the context without touching Privy.
 */
export function createAuthenticatedApp(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono generics vary per router
  router: Hono<any>,
  testUser: TestUser
): Hono {
  const app = new Hono();

  // Mock auth middleware: inject user into context
  app.use("*", async (c, next) => {
    c.set("user", testUser);
    await next();
  });

  app.route("/", router);

  return app;
}
