import type { LoaderFunctionArgs } from "react-router";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db/client.server";
import { practiceSessions, talks } from "~/db/schema";
import { createAuth } from "~/lib/auth.server";
import { privateJson } from "~/lib/private-response.server";

const sessionSchema = z.object({
  id: z.uuid(),
  startedAt: z
    .number()
    .int()
    .min(0)
    .max(8.64e15)
    .refine((v) => v <= Date.now() + 60_000),
  durationSec: z.number().int().min(60).max(14400),
  kind: z.enum(["timer", "guided"]),
  talkId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  talkTitle: z.string().max(2000).nullable().optional(),
});

export async function handlePractice({
  request,
  context,
}: LoaderFunctionArgs): Promise<Response> {
  try {
    const env = context.cloudflare.env;
    const session = await createAuth(env).api.getSession({
      headers: request.headers,
    });
    if (!session) return privateJson({ error: "Unauthorized" }, 401);
    const url = new URL(request.url);
    if (
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      ((request.headers.get("Origin") &&
        request.headers.get("Origin") !== url.origin) ||
        request.headers.get("Sec-Fetch-Site") === "cross-site")
    )
      return privateJson({ error: "Invalid origin" }, 403);
    const database = db(env.DB);
    const path = url.pathname.replace(/\/$/, "").split("/").slice(4);
    const userId = session.user.id;
    if (!path.length && request.method === "GET") {
      const rows = await database
        .select({
          id: practiceSessions.id,
          startedAt: practiceSessions.startedAt,
          durationSec: practiceSessions.durationSec,
          kind: practiceSessions.kind,
          talkId: practiceSessions.talkId,
          talkTitle: talks.title,
        })
        .from(practiceSessions)
        .leftJoin(talks, eq(practiceSessions.talkId, talks.id))
        .where(
          and(
            eq(practiceSessions.userId, userId),
            gte(
              practiceSessions.startedAt,
              new Date(Date.now() - 400 * 86400000),
            ),
          ),
        )
        .orderBy(desc(practiceSessions.startedAt), desc(practiceSessions.id));
      return privateJson({
        sessions: rows.map((r) => ({ ...r, startedAt: r.startedAt.getTime() })),
      });
    }
    if (!path.length && request.method === "POST") {
      let json: unknown;
      try {
        json = await request.json();
      } catch {
        return privateJson({ error: "Invalid JSON" }, 400);
      }
      const { sessions } = z
        .object({ sessions: z.array(sessionSchema).max(100) })
        .parse(json);
      const ids = sessions.flatMap((s) =>
        s.talkId === null ? [] : [s.talkId],
      );
      const found = ids.length
        ? await database
            .select({ id: talks.id })
            .from(talks)
            .where(inArray(talks.id, ids))
        : [];
      const valid = new Set(found.map((r) => r.id));
      const inserts = sessions.map((s) =>
        database
          .insert(practiceSessions)
          .values({
            id: s.id,
            userId,
            startedAt: new Date(s.startedAt),
            durationSec: s.durationSec,
            kind: s.kind,
            // Deleted catalogue entries must not prevent importing a local practice history.
            talkId: s.talkId !== null && valid.has(s.talkId) ? s.talkId : null,
          })
          .onConflictDoNothing(),
      );
      if (inserts.length)
        await database.batch([inserts[0], ...inserts.slice(1)]);
      return privateJson({ ok: true });
    }
    if (path.length === 1 && request.method === "DELETE") {
      const id = z.uuid().parse(path[0]);
      await database
        .delete(practiceSessions)
        .where(
          and(eq(practiceSessions.userId, userId), eq(practiceSessions.id, id)),
        );
      return privateJson({ ok: true });
    }
    return privateJson({ error: "Not found or method not allowed" }, 404);
  } catch (error) {
    if (error instanceof z.ZodError)
      return privateJson(
        { error: "Invalid request", issues: error.issues },
        400,
      );
    console.error("practice:request-failed", error);
    return privateJson({ error: "Practice request failed" }, 500);
  }
}
