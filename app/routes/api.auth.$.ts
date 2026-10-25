import type { LoaderFunctionArgs } from "react-router";
import { createAuth } from "~/lib/auth.server";
import { privateHeaders, privateJson } from "~/lib/library.server";

export const headers = () => privateHeaders;
async function handle({ request, context }: LoaderFunctionArgs) {
  try {
    const response = await createAuth(context.cloudflare.env).handler(request);
    const result = new Response(response.body, response);
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  } catch (error) {
    console.error("auth:request-failed", error);
    return privateJson({ error: "Authentication unavailable" }, 500);
  }
}
export const loader = handle;
export const action = handle;
