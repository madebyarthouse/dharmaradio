import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { cacheHeader } from "pretty-cache-header";

export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = new URL(request.url).origin;

  const robotsTxt = `
User-agent: *
Allow: /
Disallow: /api/

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml
`.trim();

  const encoder = new TextEncoder();
  const encoded = encoder.encode(robotsTxt);

  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Length": encoded.length.toString(),
      "Cache-Control": cacheHeader({
        sMaxage: "24h",
        staleWhileRevalidate: "12h",
      }),
    },
  });
}
