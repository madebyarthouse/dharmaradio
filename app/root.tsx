import type { LinksFunction } from "@remix-run/cloudflare";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { Navbar } from "~/components/Navbar";
import { Player } from "~/components/Player";
import stylesheet from "~/tailwind.css?url";
import { AudioProvider } from "~/contexts/audio-context";
import { config } from "~/config";
import { PHProvider } from "./contexts/posthog";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
];

export default function App() {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script
          defer
          data-api="/api/event"
          src="/js/script.js"
          data-domain={config.productionDomain}
        ></script>
        <link
          rel="icon"
          type="image/png"
          href="/favicon-96x96.png"
          sizes="96x96"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <meta name="apple-mobile-web-app-title" content="DharmaRadio" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="og:url" content={config.productionUrl} />
        <meta name="og:locale" content="de_AT" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:creator" content="@dharmarad_io" />
        <meta name="twitter:site" content={config.productionDomain} />
        <meta name="msapplication-TileColor" content={config.themeColor} />
        <meta name="theme-color" content={config.themeColor} />
        <meta name="og:type" content="website" />
        <meta name="og:url" content={config.productionUrl} />
        <meta name="og:image" content={`${config.productionUrl}/og.png`} />
        <meta name="og:image:width" content="1200" />
        <meta name="og:image:height" content="630" />
        <meta
          name="og:image"
          content={`${config.productionUrl}/og-square.png`}
        />
        <meta name="og:image:width" content="1200" />
        <meta name="og:image:height" content="1200" />
      </head>
      <body className="h-full">
        <PHProvider>
          <AudioProvider>
            <div className="min-h-full flex flex-col">
              <div className="sticky top-0 z-50 bg-brandLight/95 backdrop-blur-sm border-b border-brandLight-200">
                <Navbar />
              </div>
              <main className="flex-1 px-4 py-8 overflow-auto">
                <div className="max-w-5xl mx-auto">
                  <Outlet />
                </div>
              </main>
              <div className="sticky pt-40 bottom-0 z-50">
                <Player />
              </div>
            </div>
          </AudioProvider>
        </PHProvider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
