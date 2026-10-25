import { LoaderFunctionArgs } from "react-router";
import { cacheHeader } from "pretty-cache-header";
import { config } from "~/config";

const cacheHeaders = {
  "Cache-Control": cacheHeader({
    maxAge: "1day",
    sMaxage: "1week",
    staleWhileRevalidate: "1month",
  }),
};

export const headers = () => cacheHeaders;

export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = new URL(request.url).origin;

  const manifest = {
    name: config.manifest.name,
    short_name: config.manifest.shortName,
    description: config.manifest.description,
    id: "/",
    scope: "/",
    start_url: "/",
    categories: ["education", "lifestyle"],
    shortcuts: [
      { name: "Sit", url: "/sit", description: "Start the meditation timer" },
      { name: "Listen", url: "/listen", description: "Dharma talks and guided meditations" },
      {
        name: "Practice",
        url: "/practice",
        description: "Your sits, saved talks and listening progress",
      },
      { name: "Talks", url: "/talks", description: "Browse meditation talks" },
    ],
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
