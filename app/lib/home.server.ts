import { and, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { centers, retreats, talks, teachers } from "~/db/schema";
import { withCachedJson } from "~/lib/cache.server";
import { fromNestedRow } from "~/lib/talk";
import { daySeed, varied } from "~/lib/home";

/**
 * Everything the home page shows. "Random" teachers and centers are a shuffle seeded
 * by the UTC day: the same for everyone all day, so the KV entry and the edge-cached
 * HTML stay valid, and fresh tomorrow.
 */
export async function getHome(env: Env, now = Date.now()) {
  const seed = daySeed(now);
  return withCachedJson(env.DB_QUERY_CACHE, `home:v2:${seed}`, 26 * 3600, async () => {
    const database = db(env.DB);
    // A multiplicative hash of the id, offset by the day: a stable daily shuffle.
    const shuffled = (id: typeof teachers.id | typeof centers.id) =>
      sql`((${id} * 1103515245 + ${seed * 2654435761}) % 2147483647)`;

    const [[talkStats], [teacherStats], latest, recentRetreats, someTeachers, someCenters] = await Promise.all([
      database.select({ count: count() }).from(talks),
      database.select({ count: count() }).from(teachers),
      database
        .select({
          id: talks.id,
          title: talks.title,
          slug: talks.slug,
          duration: talks.duration,
          audioUrl: talks.audioUrl,
          publicationDate: talks.publicationDate,
          teacher: { name: teachers.name, slug: teachers.slug, profileImageUrl: teachers.profileImageUrl },
          center: { name: centers.name, slug: centers.slug },
          retreat: { title: retreats.title, slug: retreats.slug },
        })
        .from(talks)
        .leftJoin(teachers, eq(talks.teacherId, teachers.id))
        .leftJoin(centers, eq(talks.centerId, centers.id))
        .leftJoin(retreats, eq(talks.retreatId, retreats.id))
        .orderBy(desc(talks.publicationDate))
        .limit(48),
      database
        .select({
          slug: retreats.slug,
          title: retreats.title,
          talksCount: sql<number>`count(${talks.id})`.as("talks_count"),
          teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as("teachers_count"),
          // Stored in seconds; cards take milliseconds like every Date-derived value.
          firstDate: sql<number>`min(${talks.publicationDate}) * 1000`.as("first_date"),
          lastDate: sql<number>`max(${talks.publicationDate}) * 1000`.as("last_date"),
        })
        .from(retreats)
        .innerJoin(talks, eq(talks.retreatId, retreats.id))
        .groupBy(retreats.id)
        .orderBy(sql`last_date desc`)
        .limit(10),
      database
        .select({
          slug: teachers.slug,
          name: teachers.name,
          profileImageUrl: teachers.profileImageUrl,
          talksCount: sql<number>`count(${talks.id})`.as("talks_count"),
        })
        .from(teachers)
        .innerJoin(talks, eq(talks.teacherId, teachers.id))
        .where(and(isNotNull(teachers.profileImageUrl), sql`${teachers.profileImageUrl} != ''`))
        .groupBy(teachers.id)
        .having(sql`count(${talks.id}) >= 5`)
        .orderBy(shuffled(teachers.id))
        .limit(16),
      database
        .select({
          slug: centers.slug,
          name: centers.name,
          talksCount: sql<number>`count(${talks.id})`.as("talks_count"),
          teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as("teachers_count"),
        })
        .from(centers)
        .innerJoin(talks, eq(talks.centerId, centers.id))
        .groupBy(centers.id)
        .having(sql`count(${talks.id}) >= 10`)
        .orderBy(shuffled(centers.id))
        .limit(9),
    ]);

    return {
      stats: { talks: talkStats?.count ?? 0, teachers: teacherStats?.count ?? 0 },
      latest: varied(latest.map(fromNestedRow), 10),
      retreats: recentRetreats,
      teachers: someTeachers,
      centers: someCenters,
    };
  });
}
