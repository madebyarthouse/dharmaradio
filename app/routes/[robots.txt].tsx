import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { cacheHeader } from "pretty-cache-header";

export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "1day",
    sMaxage: "1week",
    staleWhileRevalidate: "1month",
  }),
};

export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = new URL(request.url).origin;

  const robotsTxt = `
User-agent: *
Allow: /
Disallow: /api/
Disallow: /centers/*
Disallow: /retreats/*
Disallow: /talks/*
Disallow: /teachers/*
Disallow: /*?page=
Disallow: /*/page
Disallow: /*?sort=
Disallow: /*?filter=

# Allow specific top-level pages
Allow: /centers$
Allow: /retreats$
Allow: /talks$
Allow: /teachers$

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
        staleWhileRevalidate: "1week",
      }),
    },
  });
}
