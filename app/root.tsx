import type { LinksFunction } from "react-router";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  useRouteLoaderData,
} from "react-router";
import stylesheet from "~/tailwind.css?url";
import { LibraryProvider } from "~/contexts/library-context";
import { AudioProvider } from "~/contexts/audio-context";
import { UIProvider } from "~/contexts/ui-context";
import { config } from "~/config";
import { PHProvider } from "./contexts/posthog";
import { MobileTopBar, Sidebar, TabBar } from "~/components/shell";
import { PlayerBar } from "~/components/player";
import { AddToPlaylistDialog, SignInDialog, Toaster } from "~/components/overlays";
import { buttonClass } from "~/components/ui/primitives";
import { BrandMark } from "~/components/brand";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: stylesheet }];

export const loader = async () => ({
  posthogApiHost: process.env.PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
  posthogPublicKey: process.env.PUBLIC_POSTHOG_KEY || null,
});

/** Runs before paint so an explicit light/dark choice never flashes. */
const themeScript = `try{var t=localStorage.getItem("dharmaradio:theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Meta />
        <Links />
        <script defer data-api="/api/event" src="/js/script.js" data-domain={config.productionDomain}></script>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Dharma Radio" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content={config.themeColor} />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content={config.themeColorDark} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={config.productionUrl} />
        <meta property="og:image" content={`${config.productionUrl}/og.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@dharmarad_io" />
      </head>
      <body className="min-h-dvh">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  return (
    <PHProvider apiHost={data?.posthogApiHost ?? ""} publicKey={data?.posthogPublicKey ?? null}>
      <LibraryProvider>
        <AudioProvider>
          <UIProvider>{children}</UIProvider>
        </AudioProvider>
      </LibraryProvider>
    </PHProvider>
  );
}

function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div aria-hidden className="grain fixed inset-0 z-[70]" />
      <div className="lg:flex">
        <div className="sticky top-0 hidden h-dvh lg:block">
          <Sidebar />
        </div>
        <div className="min-w-0 flex-1">
          <MobileTopBar />
          <main className="mx-auto w-full max-w-5xl px-5 pb-44 sm:px-8 lg:px-12 lg:pb-32">
            {children}
          </main>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 lg:left-64">
        <PlayerBar />
        <TabBar />
      </div>
      <Toaster />
      <SignInDialog />
      <AddToPlaylistDialog />
    </Providers>
  );
}

export default function App() {
  return (
    <Chrome>
      <Outlet />
    </Chrome>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  if (!notFound) console.error(error);

  return (
    <Chrome>
      <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
        <BrandMark size={48} />
        <h1 className="mt-6 font-serif text-4xl tracking-tight">
          {notFound ? "Nothing here" : "Something went quiet"}
        </h1>
        <p className="mt-3 max-w-sm text-ink-soft">
          {notFound
            ? "This page doesn’t exist, or the talk has moved."
            : "An unexpected error occurred. Breathe in, and try again in a moment."}
        </p>
        <Link to="/" className={buttonClass("primary") + " mt-8"}>
          Back home
        </Link>
      </div>
    </Chrome>
  );
}
