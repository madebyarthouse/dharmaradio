import { createRequestHandler } from "react-router";
import { cronScheduleMap, runCronJob, type CronJob } from "../app/cron/jobs";

const CACHE_NAMESPACE = "dharmaradio:ssr";
const CACHE_VERSION_PARAM = "__cv";
const CACHE_DEBUG_PARAM = "cacheDebug";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const parseCacheControlInt = (value: string, directive: string) => {
  const match = new RegExp(`${directive}\\s*=\\s*(\\d+)`, "i").exec(value);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
};

const isCacheable = (cacheControl: string | null) => {
  if (!cacheControl) return false;

  const value = cacheControl.toLowerCase();
  if (
    value.includes("no-store") ||
    value.includes("no-cache") ||
    value.includes("private")
  ) {
    return false;
  }

  const sMaxAge = parseCacheControlInt(value, "s-maxage");
  const maxAge = parseCacheControlInt(value, "max-age");
  const ttl = sMaxAge ?? maxAge;

  return typeof ttl === "number" && ttl > 0;
};

const getCacheDebugFlag = (request: Request) => {
  if (request.headers.get("X-Cache-Debug") === "1") return true;
  return new URL(request.url).searchParams.get(CACHE_DEBUG_PARAM) === "1";
};

const getCacheVersion = (env: Env) =>
  env.CF_VERSION_METADATA?.id ?? "unversioned";

const createCacheKey = (request: Request, env: Env) => {
  const keyUrl = new URL(request.url);
  keyUrl.searchParams.delete(CACHE_DEBUG_PARAM);
  keyUrl.searchParams.set(CACHE_VERSION_PARAM, getCacheVersion(env));
  return new Request(keyUrl.toString(), { method: "GET" });
};

const hasVaryWildcard = (vary: string | null) =>
  Boolean(vary && vary.split(",").some((token) => token.trim() === "*"));

const resolveCronJob = (cron: string): CronJob | null => {
  const entry = Object.entries(cronScheduleMap).find(
    ([, schedule]) => schedule === cron,
  );
  return entry ? (entry[0] as CronJob) : null;
};

export default {
  async fetch(request, env, ctx) {
    const handlerContext = { cloudflare: { env, ctx } };

    if (request.method !== "GET") {
      return requestHandler(request, handlerContext);
    }

    const requestCacheControl = request.headers.get("Cache-Control") ?? "";
    const lowerRequestCacheControl = requestCacheControl.toLowerCase();
    const bypassRead =
      lowerRequestCacheControl.includes("no-cache") ||
      lowerRequestCacheControl.includes("max-age=0") ||
      request.headers.has("Pragma");
    const skipWrite = lowerRequestCacheControl.includes("no-store");
    const hasSensitiveHeaders = request.headers.has("Authorization");
    const cacheDebug = getCacheDebugFlag(request);

    const cache = await caches.open(CACHE_NAMESPACE);
    const cacheKey = createCacheKey(request, env);

    if (!bypassRead && !hasSensitiveHeaders) {
      try {
        const cached = await cache.match(cacheKey);
        if (cached) {
          if (!cacheDebug) {
            return cached;
          }

          const response = new Response(cached.body, cached);
          response.headers.set("X-Cache-Debug", "hit");
          response.headers.set("X-Cache-Version", getCacheVersion(env));
          return response;
        }
      } catch (error) {
        console.warn("cache:match-error", {
          error: String(error),
          url: request.url,
        });
      }
    }

    const response = await requestHandler(request, handlerContext);

    if (
      response.status === 200 &&
      !skipWrite &&
      !hasSensitiveHeaders &&
      !response.headers.has("Set-Cookie") &&
      !hasVaryWildcard(response.headers.get("Vary"))
    ) {
      const edgeCacheControl =
        response.headers.get("CDN-Cache-Control") ??
        response.headers.get("Cloudflare-CDN-Cache-Control") ??
        response.headers.get("Cache-Control");

      if (isCacheable(edgeCacheControl)) {
        try {
          const cachedResponse = response.clone();
          const responseToStore = new Response(
            cachedResponse.body,
            cachedResponse,
          );

          if (edgeCacheControl) {
            responseToStore.headers.set("Cache-Control", edgeCacheControl);
          }

          ctx.waitUntil(cache.put(cacheKey, responseToStore));
        } catch (error) {
          console.warn("cache:put-error", {
            error: String(error),
            url: request.url,
          });
        }
      }
    }

    if (!cacheDebug) {
      return response;
    }

    const debugResponse = new Response(response.body, response);
    debugResponse.headers.set("X-Cache-Debug", "miss");
    debugResponse.headers.set("X-Cache-Version", getCacheVersion(env));
    return debugResponse;
  },

  async scheduled(controller, env, ctx) {
    const cron = controller.cron ?? "";
    const job = resolveCronJob(cron);

    if (!job) {
      console.warn("cron:unmapped", { cron });
      return;
    }

    ctx.waitUntil(
      (async () => {
        const startedAt = new Date().toISOString();
        console.log("cron:start", { cron, job, startedAt });

        try {
          const result = await runCronJob(job, env, ctx, {
            cron,
            type: "scheduled",
          });
          console.log("cron:success", {
            cron,
            failedCount: result.failedCount,
            startedAt,
            finishedAt: new Date().toISOString(),
            job,
            processedCount: result.processedCount,
            runId: result.runId ?? null,
            status: result.status,
          });
        } catch (error) {
          console.error("cron:error", {
            cron,
            finishedAt: new Date().toISOString(),
            job,
            error: String(error),
          });
          throw error;
        }
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
