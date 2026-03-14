import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "~/db/schema";

declare global {
  type VersionMetadata = {
    id?: string;
    tag?: string;
    timestamp?: string;
  };

  interface Env {
    DB: D1Database;
    DB_QUERY_CACHE?: KVNamespace;
    CF_VERSION_METADATA?: VersionMetadata;
  }
}

export type DbClient = DrizzleD1Database<typeof schema>;

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      ctx: ExecutionContext;
      env: Env;
    };
  }
}
