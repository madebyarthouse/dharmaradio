import { LoaderFunctionArgs } from "react-router";
import { cacheHeader } from "pretty-cache-header";
import { db } from "~/db/client.server";
import { talks, teachers, centers, retreats } from "~/db/schema";
import { withCachedJson } from "~/lib/cache.server";

const cacheHeaders = {
  "Cache-Control": cacheHeader({
    maxAge: "1day",
    sMaxage: "1week",
    staleWhileRevalidate: "1month",
  }),
};

export const headers = () => cacheHeaders;

export async function loader({ request, context }: LoaderFunctionArgs) {
  const baseUrl = new URL(request.url).origin;
  const sitemap = await withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    `sitemap:${baseUrl}`,
    3600,
    async () => {
      const database = db(context.cloudflare.env.DB);
      const [allTalks, allTeachers, allCenters, allRetreats] = await Promise.all(
        [
          database.select({ slug: talks.slug }).from(talks),
          database.select({ slug: teachers.slug }).from(teachers),
          database.select({ slug: centers.slug }).from(centers),
          database.select({ slug: retreats.slug }).from(retreats),
        ],
      );

      const routes = [
        { url: "", priority: "1.0", changefreq: "daily" },
        { url: "talks", priority: "0.9", changefreq: "daily" },
        { url: "teachers", priority: "0.8", changefreq: "weekly" },
        { url: "centers", priority: "0.8", changefreq: "weekly" },
        { url: "retreats", priority: "0.8", changefreq: "weekly" },
        ...allTalks.map((talk) => ({
          url: `talks/${talk.slug}`,
          priority: "0.7",
          changefreq: "monthly",
        })),
        ...allTeachers.map((teacher) => ({
          url: `teachers/${teacher.slug}`,
          priority: "0.6",
          changefreq: "monthly",
        })),
        ...allCenters.map((center) => ({
          url: `centers/${center.slug}`,
          priority: "0.6",
          changefreq: "monthly",
        })),
        ...allRetreats.map((retreat) => ({
          url: `retreats/${retreat.slug}`,
          priority: "0.6",
          changefreq: "monthly",
        })),
      ];

      return `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${routes
        .map(
          (route) => `
        <url>
          <loc>${baseUrl}/${route.url}</loc>
          <lastmod>${new Date().toISOString()}</lastmod>
          <changefreq>${route.changefreq}</changefreq>
          <priority>${route.priority}</priority>
        </url>
      `,
        )
        .join("")}
    </urlset>`.trim();
    },
  );

  const encoder = new TextEncoder();
  const encoded = encoder.encode(sitemap);

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Content-Length": encoded.length.toString(),
      ...cacheHeaders,
    },
  });
}
