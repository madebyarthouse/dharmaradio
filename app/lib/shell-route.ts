import { cacheHeader } from "pretty-cache-header";

/**
 * Personal pages (library, account, sign-in) render an identical shell for everyone
 * and load user data client-side from /api/me, so they can be edge-cached like the rest.
 */
export const shellHeaders = () => ({
  "Cache-Control": cacheHeader({
    maxAge: "1hour",
    sMaxage: "1day",
    staleWhileRevalidate: "1week",
  }),
});

export const noindex = { name: "robots", content: "noindex" } as const;
