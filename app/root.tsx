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
      </head>
      <body className="h-full bg-sage-50">
        <AudioProvider>
          <div className="min-h-full flex flex-col">
            <div className="sticky top-0 z-50 bg-sage-50/95 backdrop-blur-sm border-b border-sage-200">
              <Navbar />
            </div>
            <main className="flex-1 px-4 py-8 overflow-auto">
              <Outlet />
            </main>
            <div className="sticky bottom-0 z-50">
              <Player />
            </div>
          </div>
        </AudioProvider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
