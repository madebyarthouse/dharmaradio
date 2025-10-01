import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

export function PHProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    posthog.init("phc_65Fx0LC2y0dM34zHimAxI0TyltiOYbXAOr6S3pER5NU", {
      api_host: "https://eu.i.posthog.com",
      defaults: "2025-05-24",
      person_profiles: "identified_only", // or 'always' to create profiles for anonymous users as well
    });

    setHydrated(true);
  }, []);

  if (!hydrated) return <>{children}</>;
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
