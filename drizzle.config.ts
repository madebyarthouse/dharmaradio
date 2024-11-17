import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./app/db/schema.ts",
  out: "./app/db/migrations",
  driver: "d1-http",
  dialect: "sqlite",
  dbCredentials: {
    accountId: `${process.env.CLOUDFLARE_ACCOUNT_ID}`,
    databaseId: `${process.env.CLOUDFLARE_DATABASE_ID}`,
    token: `${process.env.CLOUDFLARE_API_TOKEN}`,
  },
});
