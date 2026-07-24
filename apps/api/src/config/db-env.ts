import 'dotenv/config';
import { z } from 'zod';

// Deliberately minimal: this is imported by db/pool.ts, which is on the
// import path of both the server (via app.ts) and the standalone migrate
// script (db/migrate.ts). The migrate script connects to Postgres and
// exits - it never starts a server - so it must not be forced to satisfy
// server-only requirements (PORT, JWT_SECRET, ALLOWED_ORIGINS, ...) from
// the full schema in env.ts. Validate only what a Postgres connection
// needs.
const dbEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
});

export const dbEnv = dbEnvSchema.parse(process.env);
