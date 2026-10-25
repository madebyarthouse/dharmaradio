import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { centers, retreats, talks, teachers } from "~/db/schema";
import { withCachedJson } from "~/lib/cache.server";
import { GUIDED_LENGTHS, type GuidedLengthKey } from "~/lib/guided";
import { fromNestedRow, type TalkListItem } from "~/lib/talk";
export {
  GUIDED_LENGTHS,
  isGuidedTitle,
  type GuidedLengthKey,
} from "~/lib/guided";

// SQLite LIKE alone also matches "unguided"; punctuation becomes a word boundary,
// exactly as in the client heuristic. SQLite's core build has no REGEXP function.
export const guidedTitleCondition = sql`(' ' || lower(${talks.title}) || ' ') GLOB '*[^a-z0-9_]guided[^a-z0-9_]*'`;
export function guidedLengthCondition(key: GuidedLengthKey) {
  const length = GUIDED_LENGTHS.find((length) => length.key === key)!;
  return and(
    gte(talks.duration, length.minSec),
    Number.isFinite(length.maxSec)
      ? lt(talks.duration, length.maxSec)
      : undefined,
  );
}
export async function getGuidedShelves(env: {
  DB: D1Database;
  DB_QUERY_CACHE?: KVNamespace;
}): Promise<Record<GuidedLengthKey, TalkListItem[]>> {
  return withCachedJson(
    env.DB_QUERY_CACHE,
    "guided-shelves:v1",
    3600,
    async () => {
      const database = db(env.DB);
      const shelves = await Promise.all(
        GUIDED_LENGTHS.map(async ({ key }) => {
          const rows = await database
            .select({
              id: talks.id,
              slug: talks.slug,
              title: talks.title,
              duration: talks.duration,
              audioUrl: talks.audioUrl,
              publicationDate: talks.publicationDate,
              teacher: {
                name: teachers.name,
                slug: teachers.slug,
                profileImageUrl: teachers.profileImageUrl,
              },
              center: { name: centers.name, slug: centers.slug },
              retreat: { title: retreats.title, slug: retreats.slug },
            })
            .from(talks)
            .leftJoin(teachers, eq(talks.teacherId, teachers.id))
            .leftJoin(centers, eq(talks.centerId, centers.id))
            .leftJoin(retreats, eq(talks.retreatId, retreats.id))
            .where(and(guidedTitleCondition, guidedLengthCondition(key)))
            .orderBy(desc(talks.publicationDate), desc(talks.id))
            .limit(8);
          return [key, rows.map(fromNestedRow)] as const;
        }),
      );
      return Object.fromEntries(shelves) as Record<
        GuidedLengthKey,
        TalkListItem[]
      >;
    },
  );
}
