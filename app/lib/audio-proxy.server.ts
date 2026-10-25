/**
 * Same-origin streaming for talk audio, so the browser may analyse it.
 *
 * dharmaseed.org redirects to media.dharmaseed.org, which only grants CORS to
 * another origin; a cross-origin element routed into Web Audio would be silent.
 * This is deliberately not an open proxy: the route resolves a talk id to the
 * URL stored in D1 and only fetches from dharmaseed hosts.
 */

const ALLOWED_HOSTS = ["dharmaseed.org", "media.dharmaseed.org", "www.dharmaseed.org"];

/** Response headers worth passing through from the upstream media server. */
const PASS_HEADERS = ["Content-Length", "Content-Range", "ETag", "Last-Modified"];

export function isAllowedAudioUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

/** Accepts a single `bytes=` range, the only kind a media element sends. */
export function sanitizeRange(value: string | null): string | null {
  if (!value) return null;
  return /^bytes=\d*-\d*$/.test(value.trim()) && value.trim() !== "bytes=-" ? value.trim() : null;
}

function contentTypeFor(upstream: string | null, url: string) {
  if (upstream && upstream.startsWith("audio/")) return upstream;
  const ext = new URL(url).pathname.split(".").pop()?.toLowerCase();
  return ext === "m4a" ? "audio/mp4" : ext === "ogg" ? "audio/ogg" : "audio/mpeg";
}

export async function proxyAudio(
  request: Request,
  audioUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (!isAllowedAudioUrl(audioUrl)) return new Response("Not Found", { status: 404 });
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });

  const headers = new Headers({ Accept: "audio/*,*/*;q=0.5" });
  const range = sanitizeRange(request.headers.get("Range"));
  if (range) headers.set("Range", range);

  let upstream: Response;
  try {
    upstream = await fetchImpl(audioUrl, {
      method: request.method,
      headers,
      redirect: "follow",
      signal: request.signal,
    });
  } catch {
    return new Response("Bad Gateway", { status: 502 });
  }

  // A redirect must not have taken us off the allow-list.
  if (upstream.url && !isAllowedAudioUrl(upstream.url)) {
    await upstream.body?.cancel();
    return new Response("Bad Gateway", { status: 502 });
  }

  if (upstream.status !== 200 && upstream.status !== 206 && upstream.status !== 416) {
    await upstream.body?.cancel();
    return new Response("Bad Gateway", { status: 502 });
  }

  const out = new Headers({
    "Content-Type": contentTypeFor(upstream.headers.get("Content-Type"), upstream.url || audioUrl),
    "Accept-Ranges": "bytes",
    // Talks never change once published; ranges are cached by the browser, not the edge.
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
  });
  for (const name of PASS_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: out,
  });
}
