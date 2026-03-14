import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

type PHProviderProps = {
  apiHost?: string | null;
  children: React.ReactNode;
  publicKey?: string | null;
};

export function PHProvider({
  apiHost,
  children,
  publicKey,
}: PHProviderProps) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setHydrated(true);
      return;
    }

    posthog.init(publicKey, {
      api_host: apiHost || "https://eu.i.posthog.com",
      defaults: "2025-05-24",
      person_profiles: "identified_only",
    });

    setHydrated(true);
  }, [apiHost, publicKey]);

  if (!hydrated) return <>{children}</>;
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
