import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import { AppLoadContext } from "@remix-run/cloudflare";

export const db = (env: AppLoadContext["env"]) => {
  const url = env.TURSO_DATABASE_URL?.trim();
  if (url === undefined) {
    throw new Error("TURSO_DATABASE_URL is not defined");
  }

  const authToken = env.TURSO_DATABASE_TOKEN?.trim();
  if (authToken === undefined) {
    throw new Error("TURSO_AUTH_TOKEN is not defined");
  }

  return drizzle(createClient({ url, authToken }), { schema });
};
