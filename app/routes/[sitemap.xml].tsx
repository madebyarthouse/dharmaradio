import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { cacheHeader } from "pretty-cache-header";
import { db } from "~/db/client.server";
import { talks, teachers, centers, retreats } from "~/db/schema";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const baseUrl = new URL(request.url).origin;
  const database = db(context.cloudflare.env.DB);

  // Fetch all dynamic routes
  const [allTalks, allTeachers, allCenters, allRetreats] = await Promise.all([
    database.select({ slug: talks.slug }).from(talks),
    database.select({ slug: teachers.slug }).from(teachers),
    database.select({ slug: centers.slug }).from(centers),
    database.select({ slug: retreats.slug }).from(retreats),
  ]);

  // Define static and dynamic routes
  const routes = [
    { url: "", priority: "1.0", changefreq: "daily" }, // homepage
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

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
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
      `
        )
        .join("")}
    </urlset>`.trim();

  const encoder = new TextEncoder();
  const encoded = encoder.encode(sitemap);

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Content-Length": encoded.length.toString(),
      "Cache-Control": cacheHeader({
        sMaxage: "24h",
        staleWhileRevalidate: "12h",
      }),
    },
  });
}
