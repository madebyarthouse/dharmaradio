import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { eq, sql } from "drizzle-orm";
import { motion } from "motion/react";
import { Play } from "lucide-react";
import { db } from "~/db/client.server";
import { talks, teachers, retreats, centers } from "~/db/schema";
import { useAudio } from "~/contexts/audio-context";
import { cacheHeader } from "pretty-cache-header";
import { withCachedJson } from "~/lib/cache.server";

const cacheHeaders = {
  "Cache-Control": cacheHeader({
    maxAge: "3day",
    sMaxage: "1month",
    staleWhileRevalidate: "1year",
  }),
};

export const headers = () => cacheHeaders;

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.talk) {
    return [{ title: "Talk Not Found" }];
  }

  const { talk } = data;
  const teacherName = talk.teacher?.name;
  const title = `${talk.title}${teacherName ? ` - ${teacherName}` : ""} | Dharma Radio`;

  return [
    { title },
    {
      name: "description",
      content: talk.description || `Listen to ${talk.title} by ${teacherName}`,
    },
    { property: "og:title", content: title },
    {
      property: "og:description",
      content: talk.description || `Listen to ${talk.title} by ${teacherName}`,
    },
  ];
};

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Talk slug is required");
  }

  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    `talk:${slug}`,
    900,
    async () => {
      const database = db(context.cloudflare.env.DB);

      // Get talk with basic relations
      const talk = await database.query.talks.findFirst({
        where: eq(talks.slug, slug),
      });

      if (!talk) {
        throw new Response("Not Found", { status: 404 });
      }

      // Get teacher with counts
      const teacherQuery = database
        .select({
          id: teachers.id,
          name: teachers.name,
          slug: teachers.slug,
          description: teachers.description,
          profileImageUrl: teachers.profileImageUrl,
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
          retreatsCount:
            sql<number>`count(distinct case when ${talks.retreatId} is not null then ${talks.retreatId} end)`.as(
              "retreats_count",
            ),
          centersCount:
            sql<number>`count(distinct case when ${talks.centerId} is not null then ${talks.centerId} end)`.as(
              "centers_count",
            ),
        })
        .from(teachers)
        .leftJoin(talks, eq(talks.teacherId, teachers.id))
        .where(eq(teachers.id, talk.teacherId))
        .groupBy(teachers.id);

      // Get retreat with counts
      const retreatQuery = database
        .select({
          id: retreats.id,
          title: retreats.title,
          slug: retreats.slug,
          description: retreats.description,
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
          teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as(
            "teachers_count",
          ),
        })
        .from(retreats)
        .leftJoin(talks, eq(talks.retreatId, retreats.id))
        .where(talk.retreatId ? eq(retreats.id, talk.retreatId) : undefined)
        .groupBy(retreats.id);

      // Get center with counts
      const centerQuery = database
        .select({
          id: centers.id,
          name: centers.name,
          slug: centers.slug,
          description: centers.description,
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
          teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as(
            "teachers_count",
          ),
          retreatsCount: sql<number>`count(distinct ${talks.retreatId})`.as(
            "retreats_count",
          ),
        })
        .from(centers)
        .leftJoin(talks, eq(talks.centerId, centers.id))
        .where(talk.centerId ? eq(centers.id, talk.centerId) : undefined)
        .groupBy(centers.id);

      const [teacher] = await teacherQuery;
      const [retreat] = await retreatQuery;
      const [center] = await centerQuery;

      return {
        talk: {
          ...talk,
          teacher,
          retreat,
          center,
        },
      };
    },
  );
}

export default function TalkDetail() {
  const { talk } = useLoaderData<typeof loader>();
  const { playTalk, pauseTalk, isPlaying, currentTalk } = useAudio();
  const isCurrentlyPlaying = currentTalk?.id === String(talk.id) && isPlaying;

  const handlePlayToggle = () => {
    if (isCurrentlyPlaying) {
      pauseTalk();
    } else {
      playTalk({
        id: String(talk.id),
        title: talk.title,
        teacher: talk.teacher?.name || null,
        duration: talk.duration,
        audioUrl: talk.audioUrl,
        teacherSlug: talk.teacher?.slug || null,
        centerName: talk.center?.name || null,
        centerSlug: talk.center?.slug || null,
        retreatTitle: talk.retreat?.title || null,
        retreatSlug: talk.retreat?.slug || null,
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateInput: Date | number | string) => {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-8 py-6 md:py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-start gap-4 mb-6">
          {/* Play Button */}
          <button
            onClick={handlePlayToggle}
            className="shrink-0 mt-1 w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-text-primary/30 flex items-center justify-center hover:border-text-primary hover:bg-text-primary/5 active:bg-text-primary active:text-white transition-all cursor-pointer"
            aria-label={isCurrentlyPlaying ? "Pause" : "Play"}
          >
            {isCurrentlyPlaying ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="w-2.5 h-2.5 bg-text-primary rounded-full"
              />
            ) : (
              <Play size={18} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-serif font-light text-text-primary mb-3 tracking-tight leading-tight">
              {talk.title}
            </h1>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-tertiary mb-4">
              <span>{formatDate(talk.publicationDate)}</span>
              <span className="text-text-tertiary/40">·</span>
              <span className="tabular-nums">{formatDuration(talk.duration)}</span>
            </div>

            {/* Related Links */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              {talk.teacher && (
                <Link
                  to={`/teachers/${talk.teacher.slug}`}
                  className="inline-flex items-center gap-2 text-text-primary hover:text-text-primary/60 transition-colors"
                >
                  {talk.teacher.profileImageUrl && (
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-text-primary/5 border border-text-primary/10">
                      <img
                        src={talk.teacher.profileImageUrl}
                        alt={talk.teacher.name}
                        className="w-full h-full object-cover grayscale opacity-90"
                      />
                    </div>
                  )}
                  <span>{talk.teacher.name}</span>
                </Link>
              )}

              {talk.retreat && (
                <>
                  <span className="text-text-tertiary/40">·</span>
                  <Link
                    to={`/retreats/${talk.retreat.slug}`}
                    className="italic text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {talk.retreat.title}
                  </Link>
                </>
              )}

              {talk.center && (
                <>
                  <span className="text-text-tertiary/40">·</span>
                  <Link
                    to={`/centers/${talk.center.slug}`}
                    className="text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {talk.center.name}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {talk.description && (
          <div className="border-t border-text-primary/10 pt-6">
            <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">
              {talk.description}
            </p>
          </div>
        )}
      </motion.div>

      {/* Related Information */}
      {(talk.teacher || talk.retreat || talk.center) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {talk.teacher && (
            <div className="border-t border-text-primary/10 pt-6">
              <h2 className="text-xs uppercase tracking-wide text-text-tertiary mb-3">
                Teacher
              </h2>
              <Link
                to={`/teachers/${talk.teacher.slug}`}
                className="block group"
              >
                <div className="flex items-start gap-4">
                  {talk.teacher.profileImageUrl && (
                    <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-text-primary/5 border border-text-primary/10">
                      <img
                        src={talk.teacher.profileImageUrl}
                        alt={talk.teacher.name}
                        className="w-full h-full object-cover grayscale opacity-90"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-light text-text-primary group-hover:text-text-primary/60 transition-colors mb-1">
                      {talk.teacher.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-text-tertiary">
                      <span>{Number(talk.teacher.talksCount)} talks</span>
                      {Number(talk.teacher.retreatsCount) > 0 && (
                        <>
                          <span className="text-text-tertiary/40">·</span>
                          <span>{Number(talk.teacher.retreatsCount)} retreats</span>
                        </>
                      )}
                      {Number(talk.teacher.centersCount) > 0 && (
                        <>
                          <span className="text-text-tertiary/40">·</span>
                          <span>{Number(talk.teacher.centersCount)} centers</span>
                        </>
                      )}
                    </div>
                    {talk.teacher.description && (
                      <p className="text-xs text-text-tertiary mt-2 line-clamp-2">
                        {talk.teacher.description}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          )}

          {talk.retreat && (
            <div className="border-t border-text-primary/10 pt-6">
              <h2 className="text-xs uppercase tracking-wide text-text-tertiary mb-3">
                Retreat
              </h2>
              <Link to={`/retreats/${talk.retreat.slug}`} className="block group">
                <h3 className="text-base font-light text-text-primary group-hover:text-text-primary/60 transition-colors mb-1 italic">
                  {talk.retreat.title}
                </h3>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-text-tertiary">
                  <span>{Number(talk.retreat.talksCount)} talks</span>
                  {Number(talk.retreat.teachersCount) > 0 && (
                    <>
                      <span className="text-text-tertiary/40">·</span>
                      <span>{Number(talk.retreat.teachersCount)} teachers</span>
                    </>
                  )}
                </div>
                {talk.retreat.description && (
                  <p className="text-xs text-text-tertiary mt-2 line-clamp-2">
                    {talk.retreat.description}
                  </p>
                )}
              </Link>
            </div>
          )}

          {talk.center && (
            <div className="border-t border-text-primary/10 pt-6">
              <h2 className="text-xs uppercase tracking-wide text-text-tertiary mb-3">
                Center
              </h2>
              <Link to={`/centers/${talk.center.slug}`} className="block group">
                <h3 className="text-base font-light text-text-primary group-hover:text-text-primary/60 transition-colors mb-1">
                  {talk.center.name}
                </h3>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-text-tertiary">
                  <span>{Number(talk.center.talksCount)} talks</span>
                  {Number(talk.center.teachersCount) > 0 && (
                    <>
                      <span className="text-text-tertiary/40">·</span>
                      <span>{Number(talk.center.teachersCount)} teachers</span>
                    </>
                  )}
                  {Number(talk.center.retreatsCount) > 0 && (
                    <>
                      <span className="text-text-tertiary/40">·</span>
                      <span>{Number(talk.center.retreatsCount)} retreats</span>
                    </>
                  )}
                </div>
                {talk.center.description && (
                  <p className="text-xs text-text-tertiary mt-2 line-clamp-2">
                    {talk.center.description}
                  </p>
                )}
              </Link>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
