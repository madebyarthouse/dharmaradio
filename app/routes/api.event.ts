import type { ActionFunctionArgs } from "@remix-run/cloudflare";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { method, body, headers } = request;

  // https://plausible.io/docs/proxy-referrer#ip-address
  const clientIp =
    headers.get("CF-Connecting-IP") ||
    headers.get("X-Forwarded-For") ||
    request.headers.get("x-real-ip") ||
    headers.get("x-vercel-ip") ||
    headers.get("x-nf-client-connection-ip");

  const userAgent = headers.get("User-Agent");

  const response = await fetch("https://plausible.io/api/event", {
    body,
    method,
    headers: {
      "Content-Type": "application/json",
      ...(clientIp && { "X-Forwarded-For": clientIp }),
      ...(userAgent && { "User-Agent": userAgent }),
    },
  });

  const responseBody = await response.text();

  return new Response(responseBody, {
    status: response.status,
    headers: response.headers,
  });
};
