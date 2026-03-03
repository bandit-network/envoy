import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const queryClient = postgres(connectionString, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
});

/** Drizzle ORM instance with full schema for relational queries */
export const db = drizzle(queryClient, { schema });

/** Type helper for the database instance */
export type Database = typeof db;
