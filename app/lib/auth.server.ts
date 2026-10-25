import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { emailOTP } from "better-auth/plugins";
import { db } from "~/db/client.server";
import * as schema from "~/db/schema";
import { sendSignInCode, type EmailBinding } from "~/lib/email.server";

/** Construct inside the request: bindings must never escape their Worker scope. */
export function createAuth(env: { DB: D1Database; EMAIL?: EmailBinding }) {
  const baseURL =
    process.env.BETTER_AUTH_URL ||
    (import.meta.env.DEV ? "http://localhost:5180" : undefined);
  if (!baseURL) throw new Error("BETTER_AUTH_URL is required");
  if (!process.env.BETTER_AUTH_SECRET && !import.meta.env.DEV)
    throw new Error("BETTER_AUTH_SECRET is required");
  return betterAuth({
    appName: "Dharma Radio",
    baseURL,
    secret:
      process.env.BETTER_AUTH_SECRET ||
      "local-development-only-dharma-radio-secret-change-in-production",
    database: drizzleAdapter(db(env.DB), {
      provider: "sqlite",
      schema,
      transaction: false,
    }),
    trustedOrigins: [new URL(baseURL).origin],
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp }) {
          await sendSignInCode(env, email, otp);
        },
      }),
    ],
  });
}
