import type { LoaderFunctionArgs } from "react-router";
import { and, asc, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db/client.server";
import {
  centers,
  likedTalks,
  playlistItems,
  playlists,
  retreats,
  savedTalks,
  talkProgress,
  talks,
  teachers,
} from "~/db/schema";
import { handlePractice } from "~/lib/practice.server";
import { createAuth } from "~/lib/auth.server";

import { privateJson } from "~/lib/private-response.server";
export { privateHeaders, privateJson } from "~/lib/private-response.server";
const idSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
const progressSchema = z.object({
  positionSec: z.number().finite().min(0).max(1e8),
  durationSec: z.number().finite().min(0).max(1e8).nullable(),
  completed: z.boolean(),
});
const progressItemSchema = progressSchema.extend({
  talkId: idSchema,
  updatedAt: z
    .string()
    .datetime()
    .refine(
      (v) => Date.parse(v) <= Date.now() + 60_000,
      "Timestamp is in the future",
    ),
});
const idsSchema = z
  .array(idSchema)
  .max(100)
  .refine((v) => new Set(v).size === v.length, "Duplicate talks");
const nameSchema = z.string().trim().min(1).max(120);
type Database = ReturnType<typeof db>;

async function summaries(database: Database, userId: string, id?: string) {
  const rows = await database
    .select({
      id: playlists.id,
      name: playlists.name,
      updatedAt: playlists.updatedAt,
      talkCount: count(playlistItems.talkId),
      totalDurationSec: sql<number>`coalesce(sum(${talks.duration}), 0)`,
    })
    .from(playlists)
    .leftJoin(playlistItems, eq(playlistItems.playlistId, playlists.id))
    .leftJoin(talks, eq(talks.id, playlistItems.talkId))
    .where(
      and(eq(playlists.userId, userId), id ? eq(playlists.id, id) : undefined),
    )
    .groupBy(playlists.id)
    .orderBy(desc(playlists.updatedAt));
  return rows.map((r) => ({
    ...r,
    totalDurationSec: Number(r.totalDurationSec),
    updatedAt: r.updatedAt.toISOString(),
  }));
}
const talkFields = {
  id: talks.id,
  slug: talks.slug,
  title: talks.title,
  description: talks.description,
  duration: talks.duration,
  publicationDate: talks.publicationDate,
  audioUrl: talks.audioUrl,
  teacher: {
    name: teachers.name,
    slug: teachers.slug,
    profileImageUrl: teachers.profileImageUrl,
  },
  center: { name: centers.name, slug: centers.slug },
  retreat: { title: retreats.title, slug: retreats.slug },
};
function talkQuery(database: Database) {
  return database
    .select(talkFields)
    .from(talks)
    .leftJoin(teachers, eq(talks.teacherId, teachers.id))
    .leftJoin(centers, eq(talks.centerId, centers.id))
    .leftJoin(retreats, eq(talks.retreatId, retreats.id))
    .$dynamic();
}
async function requireTalks(database: Database, ids: number[]) {
  if (!ids.length) return;
  const found = await database
    .select({ id: talks.id })
    .from(talks)
    .where(inArray(talks.id, ids));
  if (found.length !== new Set(ids).size)
    throw privateJson({ error: "Talk not found" }, 404);
}
async function body(request: Request) {
  try {
    return await request.json();
  } catch {
    throw privateJson({ error: "Invalid JSON" }, 400);
  }
}

export async function handleLibrary(args: LoaderFunctionArgs): Promise<Response> {
  const { request, context } = args;
  if (/^\/api\/me\/practice(?:\/|$)/.test(new URL(request.url).pathname))
    return handlePractice(args);
  try {
    const env = context.cloudflare.env;
    const session = await createAuth(env).api.getSession({
      headers: request.headers,
    });
    const path = new URL(request.url).pathname
      .replace(/\/$/, "")
      .split("/")
      .slice(3);
    const method = request.method;
    if (!session) {
      return !path.length && method === "GET"
        ? privateJson({
            user: null,
            savedIds: [],
            likedIds: [],
            progress: [],
            playlists: [],
          })
        : privateJson({ error: "Unauthorized" }, 401);
    }
    // Cookie credentials are same-origin only. Protect custom mutations as well as auth routes.
    if (method !== "GET" && method !== "HEAD") {
      const origin = request.headers.get("Origin");
      if (
        (origin && origin !== new URL(request.url).origin) ||
        request.headers.get("Sec-Fetch-Site") === "cross-site"
      )
        return privateJson({ error: "Invalid origin" }, 403);
    }
    const database = db(env.DB);
    const userId = session.user.id;
    const userWhere = eq(talkProgress.userId, userId);
    if (!path.length && method === "GET") {
      const [saved, liked, progress, lists] = await Promise.all([
        database
          .select({ talkId: savedTalks.talkId })
          .from(savedTalks)
          .where(eq(savedTalks.userId, userId)),
        database
          .select({ talkId: likedTalks.talkId })
          .from(likedTalks)
          .where(eq(likedTalks.userId, userId)),
        database.select().from(talkProgress).where(userWhere),
        summaries(database, userId),
      ]);
      return privateJson({
        user: {
          id: userId,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        },
        savedIds: saved.map((r) => r.talkId),
        likedIds: liked.map((r) => r.talkId),
        progress: progress.map((r) => ({
          talkId: r.talkId,
          positionSec: r.positionSec,
          durationSec: r.durationSec,
          completed: r.completed,
          updatedAt: r.updatedAt.toISOString(),
        })),
        playlists: lists,
      });
    }
    if (
      (path[0] === "saved" || path[0] === "liked") &&
      path.length === 2 &&
      ["PUT", "DELETE"].includes(method)
    ) {
      const talkId = idSchema.parse(path[1]);
      const table = path[0] === "saved" ? savedTalks : likedTalks;
      if (method === "PUT") {
        await requireTalks(database, [talkId]);
        await database
          .insert(table)
          .values({ userId, talkId })
          .onConflictDoNothing();
      } else
        await database
          .delete(table)
          .where(and(eq(table.userId, userId), eq(table.talkId, talkId)));
      return privateJson({ ok: true });
    }
    if (
      path[0] === "progress" &&
      path.length === 2 &&
      ((path[1] === "bulk" && method === "POST") || method === "PUT")
    ) {
      const items =
        path[1] === "bulk"
          ? z
              .object({ items: z.array(progressItemSchema).max(100) })
              .parse(await body(request)).items
          : [
              {
                ...progressSchema.parse(await body(request)),
                talkId: idSchema.parse(path[1]),
                updatedAt: new Date().toISOString(),
              },
            ];
      // Ignore deleted catalogue talks when importing browser history; direct updates still 404.
      if (path[1] !== "bulk")
        await requireTalks(
          database,
          items.map((i) => i.talkId),
        );
      const found = items.length
        ? await database
            .select({ id: talks.id })
            .from(talks)
            .where(
              inArray(
                talks.id,
                items.map((i) => i.talkId),
              ),
            )
        : [];
      const validIds = new Set(found.map((t) => t.id));
      for (const item of items.filter((i) => validIds.has(i.talkId))) {
        const values = { ...item, userId, updatedAt: new Date(item.updatedAt) };
        await database
          .insert(talkProgress)
          .values(values)
          .onConflictDoUpdate({
            target: [talkProgress.userId, talkProgress.talkId],
            set: values,
            setWhere: gt(sql`excluded.updated_at`, talkProgress.updatedAt),
          });
      }
      return privateJson({ ok: true });
    }
    if (path[0] === "talks" && path.length === 1 && method === "GET") {
      const url = new URL(request.url);
      const view = z
        .enum(["saved", "liked", "in-progress", "history"])
        .parse(url.searchParams.get("view"));
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .parse(url.searchParams.get("page") ?? 1);
      const table =
        view === "saved"
          ? savedTalks
          : view === "liked"
            ? likedTalks
            : talkProgress;
      const condition = and(
        eq(table.userId, userId),
        view === "in-progress"
          ? and(
              eq(talkProgress.completed, false),
              gt(talkProgress.positionSec, 0),
            )
          : undefined,
      );
      const [{ total }] = await database
        .select({ total: count() })
        .from(table)
        .where(condition);
      const dateColumn =
        "updatedAt" in table ? table.updatedAt : table.createdAt;
      const rows = await talkQuery(database)
        .innerJoin(table, eq(table.talkId, talks.id))
        .where(condition)
        .orderBy(desc(dateColumn), desc(talks.id))
        .limit(25)
        .offset((page - 1) * 25);
      const extras = await database
        .select()
        .from(table)
        .where(
          and(
            condition,
            inArray(
              table.talkId,
              rows.map((r) => r.id),
            ),
          ),
        );
      const result = rows.map((r) => {
        const extra = extras.find((e) => e.talkId === r.id)!;
        return {
          ...r,
          publicationDate: r.publicationDate.toISOString(),
          ...("createdAt" in extra
            ? {
                [view === "saved" ? "savedAt" : "likedAt"]:
                  extra.createdAt.toISOString(),
              }
            : {
                progress: {
                  positionSec: extra.positionSec,
                  durationSec: extra.durationSec,
                  completed: extra.completed,
                  updatedAt: extra.updatedAt.toISOString(),
                },
              }),
        };
      });
      return privateJson({
        talks: result,
        page,
        total,
        totalPages: Math.ceil(total / 25),
      });
    }
    if (path[0] === "playlists") {
      if (path.length === 1 && method === "POST") {
        const data = z
          .object({ name: nameSchema, talkIds: idsSchema.optional() })
          .parse(await body(request));
        await requireTalks(database, data.talkIds ?? []);
        const id = crypto.randomUUID();
        await database.batch([
          database.insert(playlists).values({ id, userId, name: data.name }),
          ...(data.talkIds ?? []).map((talkId, position) =>
            database
              .insert(playlistItems)
              .values({ playlistId: id, talkId, position }),
          ),
        ]);
        return privateJson((await summaries(database, userId, id))[0], 201);
      }
      const id = z.string().min(1).max(128).parse(path[1]);
      const ownership = and(eq(playlists.id, id), eq(playlists.userId, userId));
      const [playlist] = await summaries(database, userId, id);
      if (!playlist) return privateJson({ error: "Playlist not found" }, 404);
      if (path.length === 2) {
        if (method === "GET") {
          const rows = await talkQuery(database)
            .innerJoin(playlistItems, eq(playlistItems.talkId, talks.id))
            .where(eq(playlistItems.playlistId, id))
            .orderBy(
              asc(playlistItems.position),
              asc(playlistItems.addedAt),
              asc(talks.id),
            );
          const positions = await database
            .select()
            .from(playlistItems)
            .where(eq(playlistItems.playlistId, id));
          return privateJson({
            playlist,
            talks: rows.map((r) => ({
              ...r,
              publicationDate: r.publicationDate.toISOString(),
              position: positions.find((i) => i.talkId === r.id)?.position,
            })),
          });
        }
        if (method === "PATCH") {
          const { name } = z
            .object({ name: nameSchema })
            .parse(await body(request));
          await database
            .update(playlists)
            .set({ name, updatedAt: new Date() })
            .where(ownership);
          return privateJson({ ok: true });
        }
        if (method === "DELETE") {
          await database.delete(playlists).where(ownership);
          return privateJson({ ok: true });
        }
      }
      if (path[2] === "items" && path.length === 3 && method === "POST") {
        const { talkId } = z
          .object({ talkId: idSchema })
          .parse(await body(request));
        await requireTalks(database, [talkId]);
        const [{ next }] = await database
          .select({
            next: sql<number>`coalesce(max(${playlistItems.position}), -1) + 1`,
          })
          .from(playlistItems)
          .where(eq(playlistItems.playlistId, id));
        await database.batch([
          database
            .insert(playlistItems)
            .values({ playlistId: id, talkId, position: next })
            .onConflictDoNothing(),
          database
            .update(playlists)
            .set({ updatedAt: new Date() })
            .where(ownership),
        ]);
        return privateJson({ ok: true });
      }
      if (path[2] === "items" && path.length === 4 && method === "DELETE") {
        const talkId = idSchema.parse(path[3]);
        await database.batch([
          database
            .delete(playlistItems)
            .where(
              and(
                eq(playlistItems.playlistId, id),
                eq(playlistItems.talkId, talkId),
              ),
            ),
          database
            .update(playlists)
            .set({ updatedAt: new Date() })
            .where(ownership),
        ]);
        return privateJson({ ok: true });
      }
      if (path[2] === "order" && path.length === 3 && method === "PUT") {
        const { talkIds } = z
          .object({ talkIds: idsSchema })
          .parse(await body(request));
        const current = await database
          .select({ talkId: playlistItems.talkId })
          .from(playlistItems)
          .where(eq(playlistItems.playlistId, id));
        if (
          current.length !== talkIds.length ||
          current.some((i) => !talkIds.includes(i.talkId))
        )
          return privateJson(
            { error: "Order must contain every playlist talk exactly once" },
            400,
          );
        await database.batch([
          database
            .update(playlists)
            .set({ updatedAt: new Date() })
            .where(ownership),
          ...talkIds.map((talkId, position) =>
            database
              .update(playlistItems)
              .set({ position })
              .where(
                and(
                  eq(playlistItems.playlistId, id),
                  eq(playlistItems.talkId, talkId),
                ),
              ),
          ),
        ]);
        return privateJson({ ok: true });
      }
    }
    return privateJson({ error: "Not found or method not allowed" }, 404);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError)
      return privateJson(
        { error: "Invalid request", issues: error.issues },
        400,
      );
    console.error("library:request-failed", error);
    return privateJson({ error: "Library request failed" }, 500);
  }
}
