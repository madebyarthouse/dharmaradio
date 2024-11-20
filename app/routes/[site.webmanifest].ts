import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { cacheHeader } from "pretty-cache-header";
import { config } from "~/config";

export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "1day",
    sMaxage: "1week",
    staleWhileRevalidate: "1month",
  }),
};

export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = new URL(request.url).origin;

  const manifest = {
    name: config.manifest.name,
    short_name: config.manifest.shortName,
    description: config.manifest.description,
    start_url: "/",
    display: config.manifest.display,
    background_color: config.manifest.backgroundColor,
    theme_color: config.manifest.themeColor,
    orientation: config.manifest.orientation,
    icons: config.manifest.icons.map((icon) => ({
      ...icon,
      src: `${baseUrl}${icon.src}`,
    })),
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": cacheHeader({
        sMaxage: "24h",
        staleWhileRevalidate: "12h",
      }),
    },
  });
}
