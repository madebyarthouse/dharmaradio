import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "~/db/schema";

declare global {
  interface Env {
    DB: D1Database;
  }
}

export type DbClient = DrizzleD1Database<typeof schema>;

// Extend Remix's LoaderFunctionArgs
declare module "@remix-run/cloudflare" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
    };
  }
}
