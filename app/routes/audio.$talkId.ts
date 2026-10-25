import type { LoaderFunctionArgs } from "react-router";
import { eq } from "drizzle-orm";
import { db } from "~/db/client.server";
import { talks } from "~/db/schema";
import { proxyAudio } from "~/lib/audio-proxy.server";

/**
 * GET /audio/:talkId streams a talk's audio from the same origin, for the
 * full-screen player's visualizer. Playback itself keeps using the original URL.
 */
export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const id = Number(params.talkId);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response("Not Found", { status: 404 });

  const [talk] = await db(context.cloudflare.env.DB)
    .select({ audioUrl: talks.audioUrl })
    .from(talks)
    .where(eq(talks.id, id))
    .limit(1);
  if (!talk) return new Response("Not Found", { status: 404 });

  return proxyAudio(request, talk.audioUrl);
}
