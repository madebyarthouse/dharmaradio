import { config } from "~/config";

export const trackPlausibleEvent = async ({
  event,
  url,
  ip,
  props = {},
  userAgent,
}: {
  event: string;
  url: string;
  ip?: string;
  props?: Record<string, string>;
  userAgent?: string;
}) => {
  const body = JSON.stringify({
    name: event,
    url,
    domain: config.productionDomain,
    props: {
      ...props,
    },
  });

  return await fetch("/api/event", {
    body,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(userAgent ? { "User-Agent": userAgent } : {}),
      ...(ip ? { "X-Forwarded-For": ip } : {}),
    },
  });
};
