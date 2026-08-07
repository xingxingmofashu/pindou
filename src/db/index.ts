import { Pool } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-serverless"
import * as schema from "./schema"

/**
 * The pooled connection is cached on `globalThis` so dev HMR reloads reuse the
 * existing pool instead of leaking new connections; production loads this
 * module once, so the cached reference is simply reused.
 */
const globalForDb = globalThis as unknown as { pool?: Pool }

const pool = (globalForDb.pool ??= new Pool({ connectionString: process.env.DATABASE_URL }))

export const db = drizzle(pool, { schema })
